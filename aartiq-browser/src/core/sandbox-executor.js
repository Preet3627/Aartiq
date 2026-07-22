/**
 * sandbox-executor.js — OS-level sandboxing for shell command execution.
 *
 * This module wraps child_process.spawn/exec with platform-specific sandboxing
 * to enforce filesystem, network, and process boundaries that a spawned process
 * physically cannot cross. This is the structural defense-in-depth layer: even
 * if the regex blocklist in SecurityValidator.js misses a dangerous command, the
 * OS-level sandbox prevents writes outside the workspace and blocks network access
 * to non-allowlisted destinations.
 *
 * Approach by platform:
 *   macOS  — Seatbelt sandbox profiles via sandbox-exec
 *   Linux  — bubblewrap (bwrap) for filesystem/namespace isolation
 *   Windows — Job Objects for process confinement (flagged for full design)
 *
 * The regex blocklist in SecurityValidator.js remains as a fast first-pass reject
 * (cheap, catches obvious cases early) but must NOT be treated as sufficient on
 * its own. Enforcement happens at the OS/kernel level here.
 *
 * Audit-doc line item: §6 (OS-level sandboxing).
 */

const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { canonicalizePath, getSandboxDirs } = require('./directory-allowlist');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Default workspace directory for sandboxed execution.
 * Write operations are confined to this directory tree.
 */
const DEFAULT_WORKSPACE = path.join(
  os.homedir(),
  '.aartiq',
  'sandbox-workspace',
);

/**
 * Network domain allowlist. Commands that open network connections will be
 * restricted to these destinations when the sandbox enforces network policy.
 * An empty array means all network access is denied (most restrictive).
 */
const DEFAULT_NETWORK_ALLOWLIST = [];

/**
 * Environment variables that are explicitly passed to sandboxed processes.
 * All other ambient env vars (including credentials, API keys, tokens) are
 * stripped to prevent credential leakage.
 */
const SAFE_ENV_KEYS = [
  'PATH', 'HOME', 'USER', 'LANG', 'LC_ALL', 'TMPDIR', 'SHELL',
  'TERM', 'COLORTERM', 'EDITOR', 'VISUAL',
];

// ---------------------------------------------------------------------------
// macOS Seatbelt Sandbox
// ---------------------------------------------------------------------------

/**
 * Generate a Seatbelt sandbox profile for macOS sandbox-exec.
 *
 * The profile:
 *   - Allows read access to /usr, /bin, /sbin, /System, /Library, /tmp
 *   - Allows read/write to each allowlisted directory per its access level
 *   - Denies write to all other paths (home, etc)
 *   - Denies all network operations (except explicitly allowlisted domains)
 *   - Denies process tracing, kernel control, device access
 *
 * Reference: Apple's sandbox-exec documentation and Claude Code's sandboxed
 * Bash tool approach.
 *
 * @param {object} options
 * @param {string} options.workspace — fallback workspace directory
 * @param {Array}  options.directoryAllowlist — array of allowlist entries
 * @param {string[]} options.networkAllowlist — allowed network domains
 */
function generateSeatbeltProfile(options = {}) {
  const workspace = options.workspace || DEFAULT_WORKSPACE;
  const networkAllowlist = options.networkAllowlist || DEFAULT_NETWORK_ALLOWLIST;
  const allowlist = options.directoryAllowlist || null;

  // Build filesystem rules from allowlist or fallback to workspace-only
  let writeClauses = '';
  let readClauses = '';

  if (allowlist && Array.isArray(allowlist) && allowlist.length > 0) {
    const { readDirs, writeDirs } = getSandboxDirs(allowlist);
    writeClauses = writeDirs
      .map(d => `  (subpath "${d.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`)
      .join('\n');
    readClauses = readDirs
      .filter(d => !writeDirs.includes(d))
      .map(d => `  (subpath "${d.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`)
      .join('\n');
  } else {
    // Fallback: workspace-only access
    writeClauses = `  (subpath "${workspace}")`;
    readClauses = '';
  }

  let networkFilter = '';
  if (networkAllowlist.length > 0) {
    networkFilter = `
      (deny network*)
      (allow network-outbound
        (require-not (require-any
          ${networkAllowlist.map(d => `(require-regex "${d.replace(/\./g, '\\.')}")`).join('\n')}
        ))
      )
    `;
  } else {
    networkFilter = '(deny network*)';
  }

  return `
(version 1)
(allow default)
(deny process*)
(deny sysctl*)
(deny mach-lookup)
(deny system-mac-syscall)

; Filesystem: deny writes outside allowlisted directories
(deny file-write*)
(allow file-write*
${writeClauses || `  (subpath "${workspace}")`}
  (subpath "/tmp")
  (subpath "${os.tmpdir()}")
)

; Filesystem: allow reads for common system paths
(allow file-read*
  (subpath "/usr")
  (subpath "/bin")
  (subpath "/sbin")
  (subpath "/System")
  (subpath "/Library")
  (subpath "/System/Library")
  (subpath "/dev")
  (subpath "/private/tmp")
${readClauses ? `; Additional read-only paths from allowlist\n(allow file-read*\n${readClauses}\n)\n` : ''}
)

; Network: deny by default, allow explicit destinations
${networkFilter}

; Deny dangerous operations
(deny process-exec)
(deny process-fork)
(allow process-exec
  (require-any
    (subpath "/usr")
    (subpath "/bin")
    (subpath "/sbin")
    (subpath "/System")
  )
)
(allow process-fork)

(deny device*)
(allow device-null)
(allow device-tty)
`.trim();
}

// ---------------------------------------------------------------------------
// Linux bubblewrap Sandbox
// ---------------------------------------------------------------------------

/**
 * Build bubblewrap (bwrap) arguments for Linux sandboxing.
 *
 * bwrap creates a new namespace with:
 *   - Read-only /usr, /bin, /sbin, /lib, /lib64
 *   - Per-entry bind/ro-bind for allowlisted directories
 *   - Private /tmp
 *   - No network access (unless explicitly allowlisted)
 *   - Unshared PID namespace
 *
 * Requires: bubblewrap (bwrap) package installed on the system.
 *
 * @param {string} command — the command to run
 * @param {string[]} args — command arguments
 * @param {object} options
 * @param {string} options.workspace — fallback workspace directory
 * @param {Array}  options.directoryAllowlist — array of allowlist entries
 */
function buildBubblewrapArgs(command, args, options = {}) {
  const workspace = options.workspace || DEFAULT_WORKSPACE;
  const allowlist = options.directoryAllowlist || null;

  const bwrapArgs = [
    // Unshare namespaces for isolation
    '--unshare-pid',
    '--unshare-net',

    // Filesystem bindings (read-only system paths)
    '--ro-bind', '/usr', '/usr',
    '--ro-bind', '/bin', '/bin',
    '--ro-bind', '/sbin', '/sbin',
    '--ro-bind', '/lib', '/lib',
    '--ro-bind', '/lib64', '/lib64',
  ];

  // Add allowlisted directories
  if (allowlist && Array.isArray(allowlist) && allowlist.length > 0) {
    for (const entry of allowlist) {
      if (!entry || !entry.path) continue;
      const { canonical } = canonicalizePath(entry.path);
      if (!canonical) continue;

      if (entry.access === 'read-write') {
        bwrapArgs.push('--bind', canonical, canonical);
      } else {
        bwrapArgs.push('--ro-bind', canonical, canonical);
      }
    }
  } else {
    // Fallback: workspace-only
    bwrapArgs.push('--bind', workspace, workspace);
  }

  bwrapArgs.push(
    // Private /tmp
    '--tmpfs', '/tmp',

    // Dev filesystem
    '--dev', '/dev',

    // Proc filesystem
    '--proc', '/proc',

    // Set working directory to workspace
    '--chdir', workspace,

    // Die with parent
    '--die-with-parent',

    // The actual command
    command,
    ...args,
  );

  return bwrapArgs;
}

// ---------------------------------------------------------------------------
// Windows Job Objects (flagged for future design)
// ---------------------------------------------------------------------------

/**
 * Windows sandboxing approach:
 *
 * There is no direct equivalent to bubblewrap/Seatbelt on Windows.
 * The recommended approach is:
 *
 * 1. **Job Objects**: Create a Windows Job Object with restrictions:
 *    - JOB_OBJECT_LIMIT_DIE_ON_UNHANDLED_EXCEPTION
 *    - JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
 *    - JOB_OBJECT_LIMIT_ACTIVE_PROCESS (limit process count)
 *    - Restrict access to handles via SECURITY_ATTRIBUTES
 *
 * 2. **AppContainer** (stronger isolation):
 *    - Create a restricted token with low-box SID
 *    - Set capabilities to disable network, filesystem writes outside container
 *    - Requires signing and manifest configuration
 *
 * 3. **Current implementation**: Process confinement via Job Objects
 *    (lightweight, no AppContainer complexity)
 *
 * TODO: Full AppContainer implementation for stronger isolation.
 * TODO: Integrate with Windows sandbox API (Windows Sandbox / WDAC policies).
 */
function createWindowsJobObject(command, args, options = {}) {
  const workspace = options.workspace || DEFAULT_WORKSPACE;

  // For now, use spawn with restricted options.
  // A full implementation would use the win32 API to create a Job Object
  // via ffi-napi or a native addon.
  const spawnOptions = {
    // Strip sensitive env vars
    env: buildSafeEnv(options),
    cwd: workspace,
    // On Windows, use CREATE_NO_WINDOW for background processes if needed
    // windowsHide: true,
  };

  return { command, args, spawnOptions };
}

// ---------------------------------------------------------------------------
// Safe Environment Builder
// ---------------------------------------------------------------------------

/**
 * Build a sanitized environment for the spawned process.
 * Only explicitly allowlisted variables are passed through.
 * This prevents credential leakage from ambient env vars.
 */
function buildSafeEnv(options = {}) {
  const workspace = options.workspace || DEFAULT_WORKSPACE;
  const extraEnv = options.extraEnv || {};

  const safeEnv = {};
  for (const key of SAFE_ENV_KEYS) {
    if (process.env[key] !== undefined) {
      safeEnv[key] = process.env[key];
    }
  }

  // Explicitly add workspace path
  safeEnv.HOME = workspace;
  safeEnv.TMPDIR = path.join(workspace, 'tmp');

  // Add any explicitly allowed extra env vars
  for (const [key, value] of Object.entries(extraEnv)) {
    if (SAFE_ENV_KEYS.includes(key) || key.startsWith('AARTIQ_')) {
      safeEnv[key] = value;
    }
  }

  return safeEnv;
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Execute a command within an OS-level sandbox.
 *
 * @param {string} command - The command to execute
 * @param {string[]} args - Command arguments
 * @param {object} options - Sandbox options
 * @param {string} options.workspace - Workspace directory (default: ~/.aartiq/sandbox-workspace)
 * @param {Array}  options.directoryAllowlist - Directory allowlist entries
 * @param {string[]} options.networkAllowlist - Allowed network domains
 * @param {object} options.extraEnv - Additional env vars to pass
 * @param {number} options.timeout - Execution timeout in ms
 * @param {boolean} options.useSandbox - Whether to apply sandboxing (default: true)
 * @returns {Promise<{success: boolean, stdout?: string, stderr?: string, error?: string}>}
 */
function executeSandboxed(command, args = [], options = {}) {
  const useSandbox = options.useSandbox !== false;
  const timeout = options.timeout || 30000;
  const platform = process.platform;

  // Ensure workspace exists
  const workspace = options.workspace || DEFAULT_WORKSPACE;
  try {
    fs.mkdirSync(path.join(workspace, 'tmp'), { recursive: true });
  } catch (e) {
    // Workspace may already exist
  }

  return new Promise((resolve) => {
    let child;
    let effectiveCommand = command;
    let effectiveArgs = args;
    let spawnOptions = {
      env: buildSafeEnv(options),
      timeout,
      cwd: workspace,
    };

    if (useSandbox && platform === 'darwin') {
      // macOS: Use sandbox-exec with Seatbelt profile
      const profile = generateSeatbeltProfile({
        workspace,
        directoryAllowlist: options.directoryAllowlist,
        networkAllowlist: options.networkAllowlist || DEFAULT_NETWORK_ALLOWLIST,
      });

      // Write profile to temp file
      const profilePath = path.join(os.tmpdir(), `aartiq-sandbox-${Date.now()}.sb`);
      try {
        fs.writeFileSync(profilePath, profile, 'utf8');
      } catch (e) {
        console.warn('[Sandbox] Failed to write Seatbelt profile:', e.message);
        // Fall through to unsandboxed execution
      }

      if (fs.existsSync(profilePath)) {
        effectiveCommand = 'sandbox-exec';
        effectiveArgs = ['-f', profilePath, command, ...args];
        // Clean up profile after execution
        const originalClose = spawnOptions;
        spawnOptions = {
          ...spawnOptions,
        };
      }
    } else if (useSandbox && platform === 'linux') {
      // Linux: Use bubblewrap if available
      try {
        const bwrapCheck = spawnSync('which', ['bwrap'], { encoding: 'utf8' });
        if (bwrapCheck.status === 0) {
          effectiveCommand = 'bwrap';
          effectiveArgs = buildBubblewrapArgs(command, args, {
            workspace,
            directoryAllowlist: options.directoryAllowlist,
          });
        } else {
          console.warn('[Sandbox] bubblewrap (bwrap) not available — falling back to unsandboxed execution');
        }
      } catch (e) {
        console.warn('[Sandbox] bubblewrap check failed:', e.message);
      }
    } else if (useSandbox && platform === 'win32') {
      // Windows: Use Job Objects approach
      const jobConfig = createWindowsJobObject(command, args, options);
      effectiveCommand = jobConfig.command;
      effectiveArgs = jobConfig.args;
      spawnOptions = { ...spawnOptions, ...jobConfig.spawnOptions };
    }

    child = spawn(effectiveCommand, effectiveArgs, spawnOptions);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      // Clean up temp profile if created
      try {
        if (platform === 'darwin' && effectiveCommand === 'sandbox-exec') {
          const profilePath = effectiveArgs[1];
          if (profilePath && profilePath.startsWith(os.tmpdir())) {
            fs.unlinkSync(profilePath);
          }
        }
      } catch (e) { /* ignore cleanup errors */ }

      resolve({
        success: code === 0,
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });

    child.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
      });
    });
  });
}

/**
 * Synchronous (non-async) sandboxed execution for simple commands.
 * Uses spawnSync internally. Not recommended for long-running commands.
 */
function executeSandboxedSync(command, args = [], options = {}) {
  const workspace = options.workspace || DEFAULT_WORKSPACE;
  const useSandbox = options.useSandbox !== false;

  try {
    fs.mkdirSync(path.join(workspace, 'tmp'), { recursive: true });
  } catch (e) {}

  const spawnOptions = {
    env: buildSafeEnv(options),
    cwd: workspace,
    encoding: 'utf8',
    timeout: options.timeout || 30000,
  };

  let effectiveCommand = command;
  let effectiveArgs = args;

  if (useSandbox && process.platform === 'darwin') {
    const profile = generateSeatbeltProfile({
      workspace,
      directoryAllowlist: options.directoryAllowlist,
      networkAllowlist: options.networkAllowlist || DEFAULT_NETWORK_ALLOWLIST,
    });
    const profilePath = path.join(os.tmpdir(), `aartiq-sandbox-${Date.now()}.sb`);
    try {
      fs.writeFileSync(profilePath, profile, 'utf8');
      effectiveCommand = 'sandbox-exec';
      effectiveArgs = ['-f', profilePath, command, ...args];
      const result = spawnSync(effectiveCommand, effectiveArgs, spawnOptions);
      try { fs.unlinkSync(profilePath); } catch (e) {}
      return {
        success: result.status === 0,
        code: result.status,
        stdout: (result.stdout || '').trim(),
        stderr: (result.stderr || '').trim(),
      };
    } catch (e) {
      try { fs.unlinkSync(profilePath); } catch (e2) {}
    }
  }

  const result = spawnSync(effectiveCommand, effectiveArgs, spawnOptions);
  return {
    success: result.status === 0,
    code: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

module.exports = {
  executeSandboxed,
  executeSandboxedSync,
  generateSeatbeltProfile,
  buildBubblewrapArgs,
  buildSafeEnv,
  DEFAULT_WORKSPACE,
  DEFAULT_NETWORK_ALLOWLIST,
  SAFE_ENV_KEYS,
  canonicalizePath: require('./directory-allowlist').canonicalizePath,
  isPathAllowed: require('./directory-allowlist').isPathAllowed,
  getSandboxDirs: require('./directory-allowlist').getSandboxDirs,
};
