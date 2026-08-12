/**
 * sandbox-executor.js — OS-level sandboxing for command execution.
 *
 * SECURITY MODEL
 * --------------
 * All execution is FAIL-CLOSED. When `useSandbox` is true (the default), the
 * command is executed only after the platform sandbox has been created AND
 * verified. If sandbox setup is unavailable, malformed, or cannot be verified,
 * the command is NOT executed and a structured failure is returned.
 *
 * There is NO automatic fallback to unsandboxed execution. The only way to run
 * unsandboxed is the explicit `useSandbox: false` escape hatch, which is
 * documented as unsandboxed execution and reported as such in the result.
 *
 * Platform guarantees (v0.3.5+):
 *   macOS  — Seatbelt (sandbox-exec) with a closed-by-default profile:
 *            deny file-read/write, re-allow only system paths + allowlisted
 *            directories, deny all network, confine process-exec.
 *   Linux  — bubblewrap (bwrap): namespaces (pid/net/ipc/uts), read-only
 *            system mounts, allowlisted bind mounts (read-only vs read-write),
 *            private /tmp, network disabled via --unshare-net.
 *   Windows — "Windows Job Object containment": the target process is created
 *            suspended and assigned to a Job Object (verified) whose handles
 *            live for the entire target lifetime. Windows does NOT provide
 *            OS-level filesystem or network isolation in this release; those
 *            are NOT claimed. Requests for per-process network policy on
 *            Windows fail closed.
 *
 * RESULT CONTRACT
 * ---------------
 * Every result carries an `isolation` object so callers cannot mistake
 * process containment for filesystem/network isolation:
 *   { filesystem: boolean, network: boolean, process: boolean }
 *   darwin : { true,  true,  true  }
 *   linux  : { true,  true,  true  }
 *   win32  : { false, false, true  }   (process-only — documented)
 *   failure/unsandboxed : { false, false, false }
 *
 * bubblewrap gets an extra capability pre-flight: `--version` succeeds even
 * when user namespaces are disabled, so we run a real `--unshare-*` probe and
 * fail closed if the namespaces we require cannot be created.
 *
 * The regex blocklist in SecurityValidator.js remains a fast first-pass reject
 * but is NOT treated as sufficient on its own.
 */

const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { canonicalizePath, getSandboxDirs } = require('./directory-allowlist');

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

const SANDBOX_ERROR_CODES = [
  'SANDBOX_UNAVAILABLE',
  'SANDBOX_SETUP_FAILED',
  'SANDBOX_VERIFICATION_FAILED',
  'SANDBOX_POLICY_INVALID',
];

class SandboxError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'SandboxError';
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_WORKSPACE = path.join(os.homedir(), '.aartiq', 'sandbox-workspace');
const DEFAULT_NETWORK_ALLOWLIST = [];

const SAFE_ENV_KEYS = [
  'PATH', 'HOME', 'USER', 'LANG', 'LC_ALL', 'TMPDIR', 'SHELL',
  'TERM', 'COLORTERM', 'EDITOR', 'VISUAL',
];

// Windows needs these to launch and run a native process; they carry no
// credentials. Everything else (API keys, tokens, database URLs) is stripped.
const WINDOWS_SAFE_ENV_KEYS = [
  'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'SYSTEMDRIVE', 'PATHEXT', 'COMSPEC',
  'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA',
  'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE', 'PROCESSOR_IDENTIFIER',
];

// Default Windows Job Object limits. Deliberately generous enough for real
// pipelines/builds but still a hard ceiling against fork bombs.
const DEFAULT_MAX_PROCESSES = 64;

// Explicit isolation capabilities reported on every result. "sandboxed" alone
// is ambiguous across platforms; these fields state exactly what each platform
// enforces at the OS layer so callers cannot mistake process containment for
// filesystem/network isolation (see module header — Windows is process-only).
const NO_ISOLATION = { filesystem: false, network: false, process: false };
const DARWIN_ISOLATION = { filesystem: true, network: true, process: true };
const LINUX_ISOLATION = { filesystem: true, network: true, process: true };
const WIN_ISOLATION = { filesystem: false, network: false, process: true };

// ---------------------------------------------------------------------------
// Structured failure
// ---------------------------------------------------------------------------

function createFailure(code, message, extra = {}) {
  if (!SANDBOX_ERROR_CODES.includes(code)) code = 'SANDBOX_SETUP_FAILED';
  return { success: false, code, error: message, sandboxed: false, isolation: NO_ISOLATION, ...extra };
}

// ---------------------------------------------------------------------------
// Path / allowlist validation (shared)
// ---------------------------------------------------------------------------

/**
 * Validate and canonicalize the directory allowlist. Every entry must exist
 * and resolve to a canonical path. Invalid entries are a policy error, never
 * silently skipped.
 *
 * @returns {{readDirs: string[], writeDirs: string[]}}
 */
function validateAllowlist(allowlist) {
  if (allowlist == null) return { readDirs: [], writeDirs: [] };
  if (!Array.isArray(allowlist)) {
    throw new SandboxError('SANDBOX_POLICY_INVALID', 'directoryAllowlist must be an array');
  }
  const readDirs = new Set();
  const writeDirs = new Set();
  for (const entry of allowlist) {
    if (!entry || typeof entry.path !== 'string' || entry.path.length === 0) {
      throw new SandboxError('SANDBOX_POLICY_INVALID', 'Allowlist entry is missing a path');
    }
    const { canonical } = canonicalizePath(entry.path);
    if (!canonical) {
      throw new SandboxError('SANDBOX_POLICY_INVALID', `Could not canonicalize allowlisted path: ${entry.path}`);
    }
    if (!fs.existsSync(canonical)) {
      throw new SandboxError('SANDBOX_POLICY_INVALID', `Allowlisted path does not exist: ${entry.path}`);
    }
    const access = entry.access || 'read';
    if (access === 'read-write') {
      writeDirs.add(canonical);
      readDirs.add(canonical);
    } else {
      readDirs.add(canonical);
    }
  }
  return { readDirs: [...readDirs], writeDirs: [...writeDirs] };
}

// ---------------------------------------------------------------------------
// Safe environment builder
// ---------------------------------------------------------------------------

/**
 * Build a sanitized environment for sandboxed processes. Only allowlisted
 * variables pass through. Secrets, API keys, and tokens never reach the
 * sandboxed process.
 */
function buildSafeEnv(options = {}) {
  const extraEnv = options.extraEnv || {};
  const safeEnv = {};

  for (const key of SAFE_ENV_KEYS) {
    if (process.env[key] !== undefined) safeEnv[key] = process.env[key];
  }
  if (process.platform === 'win32') {
    for (const key of WINDOWS_SAFE_ENV_KEYS) {
      if (process.env[key] !== undefined) safeEnv[key] = process.env[key];
    }
  }

  // HOME/TMPDIR are functional, non-secret. cwd confines the working dir.
  safeEnv.HOME = process.env.HOME || os.homedir();
  safeEnv.TMPDIR = process.env.TMPDIR || os.tmpdir();

  for (const [key, value] of Object.entries(extraEnv)) {
    if (SAFE_ENV_KEYS.includes(key)
      || WINDOWS_SAFE_ENV_KEYS.includes(key)
      || key.startsWith('AARTIQ_')) {
      safeEnv[key] = value;
    }
  }

  return safeEnv;
}

// ---------------------------------------------------------------------------
// macOS Seatbelt sandbox
// ---------------------------------------------------------------------------

const SYSTEM_READ_PATHS = [
  '/usr', '/bin', '/sbin', '/System', '/Library', '/opt',
  '/private/etc', '/private/tmp', '/private/var/db', '/dev',
];

const SYSTEM_EXEC_PATHS = [
  '/usr', '/bin', '/sbin', '/System', '/Library', '/opt',
];

// Literal root paths required to resolve/stat path components.
const ROOT_LITERALS = [
  '/', '/var', '/etc', '/tmp', '/private', '/dev', '/usr', '/bin', '/sbin', '/System',
];

function seatbeltQuote(p) {
  return String(p).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Generate a Seatbelt sandbox profile.
 *
 * Closed-by-default filesystem policy:
 *   - `(deny file-read*)` + explicit re-allow of system paths + allowlisted
 *     directories + workspace. Home is NOT broadly readable.
 *   - `(deny file-write*)` + explicit re-allow of write allowlist + workspace
 *     + temp directories. Read-only allowlist entries never receive write.
 *   - `(deny network*)` — full network denial. Seatbelt cannot express
 *     per-domain allowlists, so requesting one is a hard policy error.
 *   - `(deny process-exec*)` + re-allow of system + allowlisted paths.
 *
 * @throws {SandboxError} if a domain network allowlist is requested or the
 *   allowlist cannot be canonicalized.
 */
function generateSeatbeltProfile(options = {}) {
  const workspace = options.workspace || DEFAULT_WORKSPACE;
  const networkAllowlist = options.networkAllowlist || DEFAULT_NETWORK_ALLOWLIST;
  const allowlist = options.directoryAllowlist || null;

  if (Array.isArray(networkAllowlist) && networkAllowlist.length > 0) {
    throw new SandboxError(
      'SANDBOX_UNAVAILABLE',
      'Domain-level network allowlisting is not supported by macOS Seatbelt. ' +
      'Use an empty allowlist to deny all network, or pass useSandbox:false for unsandboxed execution.'
    );
  }

  const { readDirs, writeDirs } = validateAllowlist(allowlist);
  const workspaceCanonical = canonicalizePath(workspace).canonical || path.normalize(workspace);

  const tmpCanonical = canonicalizePath(os.tmpdir()).canonical || os.tmpdir();

  const sub = (p) => `  (subpath "${seatbeltQuote(p)}")`;
  const lit = (p) => `  (literal "${seatbeltQuote(p)}")`;

  const readBlock = [
    ...SYSTEM_READ_PATHS.map(sub),
    ...ROOT_LITERALS.map(lit),
    sub('/private/var/folders'),
    sub(workspaceCanonical),
    ...readDirs.map(sub),
  ].join('\n');

  const writeBlock = [
    sub(workspaceCanonical),
    sub('/private/tmp'),
    sub(tmpCanonical),
    lit('/dev/null'),
    ...writeDirs.map(sub),
  ].join('\n');

  // Read-only allowlist entries never receive write access, even when nested
  // inside a writable directory. Placed last so the deny wins on ties.
  const carveOuts = readDirs
    .filter((d) => !writeDirs.includes(d))
    .map((d) => `(deny file-write* (subpath "${seatbeltQuote(d)}"))`)
    .join('\n');

  const execBlock = [
    ...SYSTEM_EXEC_PATHS.map(sub),
    sub(workspaceCanonical),
    ...readDirs.map(sub),
    ...writeDirs.map(sub),
  ].join('\n');

  return `
(version 1)
(allow default)

; Network: fully denied. Seatbelt cannot match per-domain destinations.
(deny network*)

; Filesystem: closed by default, then allowlisted.
(deny file-read*)
(deny file-write*)

(allow file-read*
${readBlock}
)

(allow file-write*
${writeBlock}
)

; Read-only allowlist entries can never be written.
${carveOuts}

; Process execution confined to system + allowlisted paths.
(deny process-exec*)
(allow process-exec*
${execBlock}
)
(allow process-fork)
(allow signal (target self))
(allow signal (target children))
`.trim();
}

/**
 * Validate a Seatbelt profile by applying it to a harmless system binary.
 * The profile must compile and the bootstrap must succeed before any real
 * command is allowed to run under it.
 *
 * @returns {{ok: boolean, code?: string, error?: string}}
 */
function validateSeatbeltProfile(profilePath, sandboxExecPath, workspace) {
  const cwd = workspace || DEFAULT_WORKSPACE;
  let result;
  try {
    result = spawnSync(sandboxExecPath, ['-f', profilePath, '/usr/bin/true'], {
      timeout: 10000,
      encoding: 'utf8',
      cwd,
    });
  } catch (e) {
    return { ok: false, code: 'SANDBOX_SETUP_FAILED', error: e.message };
  }
  if (result.error) {
    if (result.error.code === 'ENOENT') {
      return { ok: false, code: 'SANDBOX_UNAVAILABLE', error: `sandbox-exec not found: ${sandboxExecPath}` };
    }
    return { ok: false, code: 'SANDBOX_SETUP_FAILED', error: result.error.message };
  }
  if (result.status !== 0) {
    return {
      ok: false,
      code: 'SANDBOX_POLICY_INVALID',
      error: (result.stderr || result.stdout || 'Seatbelt profile failed to compile').trim(),
    };
  }
  return { ok: true };
}

/**
 * Build the macOS sandboxed launch configuration.
 *
 * The Seatbelt profile is written to a temp file, validated with a pre-flight
 * `sandbox-exec` run, and only then used to launch the target command.
 *
 * @throws {SandboxError} on any failure — the caller must not execute.
 */
function createDarwinSandbox(command, args, options) {
  const workspace = options.workspace || DEFAULT_WORKSPACE;
  const sandboxExecPath = options.sandboxExecPath || '/usr/bin/sandbox-exec';

  if (!fs.existsSync(sandboxExecPath)) {
    throw new SandboxError('SANDBOX_UNAVAILABLE', `sandbox-exec not found at ${sandboxExecPath}`);
  }
  try {
    fs.accessSync(sandboxExecPath, fs.constants.X_OK);
  } catch (e) {
    throw new SandboxError('SANDBOX_UNAVAILABLE', `sandbox-exec is not executable: ${sandboxExecPath}`);
  }

  const profile = generateSeatbeltProfile(options);
  const profilePath = path.join(
    os.tmpdir(),
    `aartiq-sandbox-${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.sb`
  );
  try {
    fs.writeFileSync(profilePath, profile, { encoding: 'utf8', mode: 0o600 });
  } catch (e) {
    throw new SandboxError('SANDBOX_SETUP_FAILED', `Failed to write Seatbelt profile: ${e.message}`);
  }

  const validation = validateSeatbeltProfile(profilePath, sandboxExecPath, workspace);
  if (!validation.ok) {
    try { fs.unlinkSync(profilePath); } catch (e) { /* best-effort */ }
    throw new SandboxError(validation.code, `Seatbelt profile validation failed: ${validation.error}`);
  }

  return {
    command: sandboxExecPath,
    args: ['-f', profilePath, command, ...args],
    spawnOptions: {
      env: buildSafeEnv(options),
      cwd: workspace,
      timeout: options.timeout || 30000,
    },
    platform: 'darwin',
    isolation: DARWIN_ISOLATION,
    cleanup: () => {
      try { fs.unlinkSync(profilePath); } catch (e) { /* best-effort */ }
    },
  };
}

// ---------------------------------------------------------------------------
// Linux bubblewrap sandbox
// ---------------------------------------------------------------------------

/**
 * Build bubblewrap (bwrap) arguments.
 *
 * Namespaces: pid, net, ipc, uts. System mounts are read-only. Allowlisted
 * directories are bound read-only or read-write per entry access. Home is NOT
 * exposed unless explicitly allowlisted. /tmp is private. Network is disabled
 * via --unshare-net (domain allowlisting is not supported).
 *
 * @throws {SandboxError} if the network allowlist requests domains, or any
 *   allowlist path is invalid/missing.
 */
function buildBubblewrapArgs(command, args, options = {}) {
  const workspace = options.workspace || DEFAULT_WORKSPACE;
  const allowlist = options.directoryAllowlist || [];
  const networkAllowlist = options.networkAllowlist || DEFAULT_NETWORK_ALLOWLIST;

  if (Array.isArray(networkAllowlist) && networkAllowlist.length > 0) {
    throw new SandboxError(
      'SANDBOX_UNAVAILABLE',
      'Domain-level network allowlisting is not supported by bubblewrap (--unshare-net only). ' +
      'Use an empty allowlist to deny all network, or pass useSandbox:false for unsandboxed execution.'
    );
  }

  const { readDirs, writeDirs } = validateAllowlist(allowlist);

  const bwrapArgs = [
    '--unshare-pid',
    '--unshare-net',
    '--unshare-ipc',
    '--unshare-uts',
    '--ro-bind', '/usr', '/usr',
    '--ro-bind', '/bin', '/bin',
    '--ro-bind', '/sbin', '/sbin',
    '--ro-bind', '/lib', '/lib',
    '--ro-bind', '/lib64', '/lib64',
    '--ro-bind', '/etc', '/etc',
    '--dev', '/dev',
    '--proc', '/proc',
    '--tmpfs', '/tmp',
  ];

  for (const dir of writeDirs) {
    bwrapArgs.push('--bind', dir, dir);
  }
  for (const dir of readDirs) {
    if (!writeDirs.includes(dir)) {
      bwrapArgs.push('--ro-bind', dir, dir);
    }
  }

  const workspaceCanonical = canonicalizePath(workspace).canonical || path.normalize(workspace);
  bwrapArgs.push('--bind', workspaceCanonical, workspaceCanonical);
  bwrapArgs.push('--chdir', workspaceCanonical);
  bwrapArgs.push('--die-with-parent');

  bwrapArgs.push(command, ...args);
  return bwrapArgs;
}

// Cache the namespace-capability probe per bwrap path so we don't re-run it on
// every execution. A failed probe is sticky — once a bwrap cannot create the
// required namespaces we refuse to use it for the rest of the process.
let _bwrapCapabilityCache = new Map();

/**
 * Verify that bwrap can actually create the namespaces we depend on. `--version`
 * succeeds even when user namespaces are disabled (e.g. locked-down containers,
 * some CI runners), so we run a real, harmless `--unshare-*` invocation. If that
 * fails, bwrap would start the target UNCONTAINED — we must fail closed.
 */
function checkBwrapCapability(bwrapPath) {
  if (_bwrapCapabilityCache.has(bwrapPath)) return _bwrapCapabilityCache.get(bwrapPath);
  let cap;
  try {
    cap = spawnSync(
      bwrapPath,
      ['--ro-bind', '/', '/', '--unshare-pid', '--unshare-net', '--unshare-ipc', '--unshare-uts', '/bin/true'],
      { encoding: 'utf8', timeout: 15000 }
    );
  } catch (e) {
    _bwrapCapabilityCache.set(bwrapPath, false);
    return false;
  }
  const ok = !cap.error && cap.status === 0;
  _bwrapCapabilityCache.set(bwrapPath, ok);
  return ok;
}

/**
 * Build the Linux sandboxed launch configuration.
 *
 * @throws {SandboxError} if bubblewrap is unavailable, cannot create the
 *   required namespaces, or the policy is invalid.
 */
function createLinuxSandbox(command, args, options) {
  const bwrapPath = options.bwrapPath || 'bwrap';
  const workspace = options.workspace || DEFAULT_WORKSPACE;

  // Availability check: bwrap --version must succeed.
  let check;
  try {
    check = spawnSync(bwrapPath, ['--version'], { encoding: 'utf8', timeout: 5000 });
  } catch (e) {
    throw new SandboxError('SANDBOX_UNAVAILABLE', `Failed to check bubblewrap: ${e.message}`);
  }
  if (check.error) {
    if (check.error.code === 'ENOENT') {
      throw new SandboxError('SANDBOX_UNAVAILABLE', `bubblewrap (bwrap) is not available at ${bwrapPath}`);
    }
    throw new SandboxError('SANDBOX_UNAVAILABLE', `bubblewrap check failed: ${check.error.message}`);
  }
  if (check.status !== 0) {
    throw new SandboxError('SANDBOX_UNAVAILABLE', `bubblewrap (bwrap) is not functional (exit ${check.status})`);
  }

  // Capability check: bwrap must be able to create the namespaces we require.
  // --version passing while namespace creation failing is the classic
  // "bwrap present but unusable" trap (user namespaces disabled). Fail closed.
  if (!checkBwrapCapability(bwrapPath)) {
    throw new SandboxError(
      'SANDBOX_UNAVAILABLE',
      `bubblewrap (bwrap) cannot create the required namespaces on this system ` +
      `(user namespaces may be disabled). Refusing to run uncontained.`
    );
  }

  const bwrapArgs = buildBubblewrapArgs(command, args, options);

  return {
    command: bwrapPath,
    args: bwrapArgs,
    spawnOptions: {
      env: buildSafeEnv(options),
      cwd: process.cwd(),
      timeout: options.timeout || 30000,
    },
    platform: 'linux',
    isolation: LINUX_ISOLATION,
    cleanup: () => {},
  };
}

// ---------------------------------------------------------------------------
// Windows Job Object containment
// ---------------------------------------------------------------------------

const WIN_JOB_RUNNER = path.join(__dirname, 'win-job-runner.ps1');

function getWindowsJobRunnerScript() {
  try {
    return fs.readFileSync(WIN_JOB_RUNNER, 'utf8');
  } catch (e) {
    throw new SandboxError('SANDBOX_UNAVAILABLE', `Windows job runner script is missing: ${WIN_JOB_RUNNER}`);
  }
}

function resolveWindowsPowershellPath() {
  if (process.env.SystemRoot) {
    const candidate = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'powershell.exe';
}

/**
 * Build the Windows sandboxed launch configuration.
 *
 * The target command is run by win-job-runner.ps1, which creates a Job Object,
 * applies + verifies limits, creates the target SUSPENDED, assigns it to the
 * job, verifies the assignment, resumes it, and holds the job handles for the
 * target's entire lifetime (KILL_ON_JOB_CLOSE).
 *
 * Windows does NOT provide OS-level filesystem or network isolation in this
 * release. The directory allowlist is enforced at the application layer by
 * isPathAllowed() in directory-allowlist.js, not by the Job Object. Requesting
 * a per-process network policy (networkAllowlist !== undefined) fails closed.
 *
 * @throws {SandboxError} on any failure — the caller must not execute.
 */
function createWindowsSandbox(command, args, options = {}) {
  const workspace = options.workspace || DEFAULT_WORKSPACE;
  const networkAllowlist = options.networkAllowlist;

  if (networkAllowlist !== undefined) {
    throw new SandboxError(
      'SANDBOX_UNAVAILABLE',
      'Per-process network policy cannot be enforced on Windows in this release (requires AppContainer ' +
      'or elevated WFP rules). Pass networkAllowlist:undefined to run under Job Object containment.'
    );
  }

  // Even though Windows does not enforce the allowlist at the OS layer, invalid
  // or missing paths are still a policy error — never silently ignored.
  validateAllowlist(options.directoryAllowlist);

  const payload = {
    command,
    args,
    env: buildSafeEnv(options),
    cwd: workspace,
    maxProcesses: options.maxProcesses || DEFAULT_MAX_PROCESSES,
    maxMemoryBytes: options.maxMemoryBytes || 0,
    timeoutMs: options.timeout || 30000,
  };

  const runnerScript = getWindowsJobRunnerScript();
  const tmpTag = `${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const payloadPath = path.join(os.tmpdir(), `aartiq-payload-${tmpTag}.json`);
  const runnerPath = path.join(os.tmpdir(), `aartiq-runner-${tmpTag}.ps1`);

  try {
    fs.writeFileSync(payloadPath, JSON.stringify(payload), { encoding: 'utf8', mode: 0o600 });
    fs.writeFileSync(runnerPath, runnerScript, { encoding: 'utf8', mode: 0o600 });
  } catch (e) {
    try { fs.unlinkSync(payloadPath); } catch (e2) { /* best-effort */ }
    try { fs.unlinkSync(runnerPath); } catch (e2) { /* best-effort */ }
    throw new SandboxError('SANDBOX_SETUP_FAILED', `Failed to stage Windows sandbox files: ${e.message}`);
  }

  const powershell = resolveWindowsPowershellPath();

  return {
    command: powershell,
    args: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', runnerPath, payloadPath],
    spawnOptions: {
      env: { ...process.env, AARTIQ_SANDBOXED: '1' },
      windowsHide: true,
      timeout: (options.timeout || 30000) + 10000,
    },
    platform: 'win32',
    isolation: WIN_ISOLATION,
    cleanup: () => {
      try { fs.unlinkSync(payloadPath); } catch (e) { /* best-effort */ }
      try { fs.unlinkSync(runnerPath); } catch (e) { /* best-effort */ }
    },
  };
}

/**
 * Synchronous alias. The runner script itself is synchronous (it waits on the
 * target), so spawnSync of the helper is the synchronous execution path.
 */
function createWindowsSandboxSync(command, args, options) {
  return createWindowsSandbox(command, args, options);
}

// ---------------------------------------------------------------------------
// Process launcher
// ---------------------------------------------------------------------------

const WIN_RESULT_MARKER = 'AARTIQ_SANDBOX_RESULT:';

function parseWindowsHelperOutput(stdout, stderr) {
  // Strip the result marker (and anything after it) from caller-visible output.
  // The helper always emits its result last, so this never removes target data.
  const clean = (s) => {
    let text = String(s || '');
    const m = text.lastIndexOf(WIN_RESULT_MARKER);
    if (m !== -1) text = text.slice(0, m);
    return text.trim();
  };

  // Locate the LAST occurrence of the marker. The marker can be merged onto
  // the end of an unterminated target-output line, so we cannot require it to
  // start a line. Parse the first complete line after the marker as JSON.
  const out = String(stdout || '');
  const idx = out.lastIndexOf(WIN_RESULT_MARKER);
  let parsed = null;
  if (idx !== -1) {
    const after = out.slice(idx + WIN_RESULT_MARKER.length);
    const firstLine = after.split('\n').find((l) => l.trim().length > 0) || '';
    try {
      parsed = JSON.parse(firstLine.trim());
    } catch (e) {
      parsed = null;
    }
  }
  if (parsed && parsed.sandboxed === true && typeof parsed.exitCode === 'number') {
    return {
      success: parsed.exitCode === 0,
      code: parsed.exitCode,
      stdout: clean(stdout),
      stderr: clean(stderr),
      sandboxed: true,
      sandboxPlatform: 'win32',
      jobAssigned: parsed.jobAssigned === true,
      isolation: WIN_ISOLATION,
    };
  }
  if (parsed && parsed.sandboxed === false) {
    return createFailure(parsed.code || 'SANDBOX_SETUP_FAILED', parsed.error || 'Windows sandbox setup failed');
  }
  return createFailure('SANDBOX_SETUP_FAILED', (stderr || stdout || 'Windows sandbox runner produced no result').trim());
}

function runProcess(command, args, spawnOptions, meta) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    let child;
    try {
      child = spawn(command, args, spawnOptions);
    } catch (e) {
      resolve(createFailure('SANDBOX_SETUP_FAILED', `Failed to spawn ${command}: ${e.message}`));
      return;
    }

    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });

    child.on('error', (err) => {
      const code = (err && err.code === 'ENOENT') ? 'SANDBOX_UNAVAILABLE' : 'SANDBOX_SETUP_FAILED';
      finish(createFailure(code, `Failed to launch sandbox: ${err.message}`));
    });

    child.on('close', (code) => {
      if (meta.platform === 'win32') {
        const r = parseWindowsHelperOutput(stdout, stderr);
        // On setup failure the job was never applied; do not claim process
        // containment. On success the Job Object was verified assigned.
        r.isolation = (r.sandboxed === true) ? meta.isolation : NO_ISOLATION;
        finish(r);
        return;
      }
      // bubblewrap setup errors are reported on stderr prefixed with "bwrap:".
      if (meta.platform === 'linux' && code !== 0 && /^bwrap:/m.test(String(stderr))) {
        finish(createFailure('SANDBOX_SETUP_FAILED', String(stderr).trim()));
        return;
      }
      finish({
        success: code === 0,
        code,
        stdout: String(stdout).trim(),
        stderr: String(stderr).trim(),
        sandboxed: meta.sandboxed,
        sandboxPlatform: meta.platform,
        isolation: meta.isolation,
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

function ensureWorkspace(workspace) {
  try {
    fs.mkdirSync(path.join(workspace, 'tmp'), { recursive: true });
  } catch (e) {
    throw new SandboxError('SANDBOX_SETUP_FAILED', `Failed to create workspace ${workspace}: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Main entry points
// ---------------------------------------------------------------------------

/**
 * Execute a command within a verified OS-level sandbox (fail-closed).
 *
 * @param {string} command - executable path or name
 * @param {string[]} args - arguments (passed verbatim, never shell-reconstructed)
 * @param {object} options
 * @param {boolean} [options.useSandbox=true] - explicit escape hatch; when
 *   false the command runs unsandboxed (environment still sanitized) and the
 *   result reports sandboxed:false.
 * @param {string} [options.workspace] - sandbox workspace directory
 * @param {Array}  [options.directoryAllowlist] - allowlist entries
 * @param {string[]} [options.networkAllowlist] - domain allowlist; platform
 *   support is limited (see module header). Do not pass on Windows.
 * @param {object} [options.extraEnv] - extra allowlisted env vars
 * @param {number} [options.timeout] - timeout in ms
 * @param {number} [options.maxProcesses] - Windows job active-process limit
 * @param {number} [options.maxMemoryBytes] - Windows job memory limit (0 = none)
 * @returns {Promise<{success:boolean, code:number|string, stdout?:string,
 *   stderr?:string, sandboxed:boolean, sandboxPlatform?:string, error?:string}>}
 */
async function executeSandboxed(command, args = [], options = {}) {
  const useSandbox = options.useSandbox !== false;
  const platform = process.platform;
  const workspace = options.workspace || DEFAULT_WORKSPACE;

  if (!command || typeof command !== 'string') {
    return createFailure('SANDBOX_POLICY_INVALID', 'A command is required');
  }
  if (!Array.isArray(args)) {
    return createFailure('SANDBOX_POLICY_INVALID', 'args must be an array');
  }

  try {
    // Explicit development/testing escape hatch. Never the automatic fallback.
    if (!useSandbox) {
      ensureWorkspace(workspace);
      const result = await runProcess(command, args, {
        env: buildSafeEnv(options),
        cwd: workspace,
        timeout: options.timeout || 30000,
      }, { platform: 'none', sandboxed: false, isolation: NO_ISOLATION });
      return result;
    }

    // 1. Ensure workspace exists (cwd inside the sandbox).
    ensureWorkspace(workspace);

    // 2. Build + verify the platform sandbox (throws SandboxError on failure).
    let config;
    if (platform === 'darwin') {
      config = createDarwinSandbox(command, args, options);
    } else if (platform === 'linux') {
      config = createLinuxSandbox(command, args, options);
    } else if (platform === 'win32') {
      config = createWindowsSandbox(command, args, options);
    } else {
      throw new SandboxError('SANDBOX_UNAVAILABLE', `Platform ${platform} is not supported for sandboxed execution`);
    }

    // 3. Launch the target inside the verified sandbox. The target never
    //    starts before mandatory sandbox setup succeeds.
    // 4. Clean up sandbox resources in a finally block so cleanup runs even if
    //    the process lifecycle is interrupted (e.g. promise rejection).
    try {
      return await runProcess(config.command, config.args, config.spawnOptions, {
        platform: config.platform,
        sandboxed: true,
        isolation: config.isolation,
      });
    } finally {
      if (config.cleanup) {
        try { config.cleanup(); } catch (e) { /* best-effort */ }
      }
    }
  } catch (e) {
    if (e instanceof SandboxError) return createFailure(e.code, e.message);
    return createFailure('SANDBOX_SETUP_FAILED', e.message);
  }
}

/**
 * Synchronous, fail-closed sandboxed execution.
 * Uses spawnSync; the Windows runner is itself synchronous.
 */
function executeSandboxedSync(command, args = [], options = {}) {
  const useSandbox = options.useSandbox !== false;
  const platform = process.platform;
  const workspace = options.workspace || DEFAULT_WORKSPACE;

  if (!command || typeof command !== 'string') {
    return createFailure('SANDBOX_POLICY_INVALID', 'A command is required');
  }
  if (!Array.isArray(args)) {
    return createFailure('SANDBOX_POLICY_INVALID', 'args must be an array');
  }

  try {
    if (!useSandbox) {
      ensureWorkspace(workspace);
      const r = spawnSync(command, args, {
        env: buildSafeEnv(options),
        cwd: workspace,
        encoding: 'utf8',
        timeout: options.timeout || 30000,
      });
      if (r.error) return createFailure('SANDBOX_SETUP_FAILED', `Failed to launch: ${r.error.message}`);
      return {
        success: r.status === 0,
        code: r.status,
        stdout: (r.stdout || '').trim(),
        stderr: (r.stderr || '').trim(),
        sandboxed: false,
        sandboxPlatform: 'none',
        isolation: NO_ISOLATION,
      };
    }

    ensureWorkspace(workspace);

    let config;
    if (platform === 'darwin') {
      config = createDarwinSandbox(command, args, options);
    } else if (platform === 'linux') {
      config = createLinuxSandbox(command, args, options);
    } else if (platform === 'win32') {
      config = createWindowsSandbox(command, args, options);
    } else {
      return createFailure('SANDBOX_UNAVAILABLE', `Platform ${platform} is not supported for sandboxed execution`);
    }

    let r;
    try {
      r = spawnSync(config.command, config.args, { ...config.spawnOptions, encoding: 'utf8' });
    } catch (e) {
      return createFailure('SANDBOX_SETUP_FAILED', `Failed to launch sandbox: ${e.message}`);
    } finally {
      if (config.cleanup) {
        try { config.cleanup(); } catch (e) { /* best-effort */ }
      }
    }

    if (r.error) {
      return createFailure(
        r.error.code === 'ENOENT' ? 'SANDBOX_UNAVAILABLE' : 'SANDBOX_SETUP_FAILED',
        `Failed to launch sandbox: ${r.error.message}`
      );
    }

    if (platform === 'win32') {
      const res = parseWindowsHelperOutput(r.stdout, r.stderr);
      res.isolation = (res.sandboxed === true) ? config.isolation : NO_ISOLATION;
      return res;
    }
    if (platform === 'linux' && r.status !== 0 && /^bwrap:/m.test(String(r.stderr))) {
      return createFailure('SANDBOX_SETUP_FAILED', String(r.stderr).trim());
    }
    return {
      success: r.status === 0,
      code: r.status,
      stdout: (r.stdout || '').trim(),
      stderr: (r.stderr || '').trim(),
      sandboxed: true,
      sandboxPlatform: platform,
      isolation: config.isolation,
    };
  } catch (e) {
    if (e instanceof SandboxError) return createFailure(e.code, e.message);
    return createFailure('SANDBOX_SETUP_FAILED', e.message);
  }
}

/**
 * Explicit shell-script execution mode.
 *
 * Shell interpretation is a separate, intentional feature: the script string
 * is passed verbatim as a single argument to the platform shell (sh -c on
 * POSIX, cmd.exe /d /s /c on Windows) INSIDE the sandbox. It is never built by
 * string-concatenating arguments. Callers must have already completed the
 * permission/risk classification before calling this.
 */
function executeShellScript(script, options = {}) {
  if (typeof script !== 'string' || script.length === 0) {
    return Promise.resolve(createFailure('SANDBOX_POLICY_INVALID', 'Shell script is required'));
  }
  const platform = process.platform;
  if (platform === 'win32') {
    const comspec = process.env.COMSPEC
      || (process.env.SystemRoot ? path.join(process.env.SystemRoot, 'System32', 'cmd.exe') : 'C:\\Windows\\System32\\cmd.exe');
    return executeSandboxed(comspec, ['/d', '/s', '/c', script], options);
  }
  return executeSandboxed('/bin/sh', ['-c', script], options);
}

// ---------------------------------------------------------------------------
// Command tokenization & execution-mode selection
// ---------------------------------------------------------------------------

// Metacharacters that REQUIRE shell interpretation (outside quotes): pipes,
// redirection, control operators, command substitution, globs, grouping,
// comments, and newlines.
const SHELL_META = '|&;<>`$()*?';

const POSIX_SHELL_BUILTINS = new Set([
  'cd', 'export', 'alias', 'unalias', 'source', 'set', 'unset', 'declare',
  'typeset', 'local', 'readonly', 'shift', 'ulimit', 'umask', 'trap', 'type',
  'hash', 'logout', 'exit', 'return', 'break', 'continue', 'wait', 'read',
  'command', 'exec', 'builtin', 'eval', 'history', 'jobs', 'bg', 'fg',
  'suspend', 'enable', 'let', 'time', 'getopts',
]);

const WINDOWS_SHELL_BUILTINS = new Set([
  'cd', 'chdir', 'dir', 'type', 'copy', 'del', 'erase', 'mkdir', 'md',
  'rmdir', 'rd', 'ren', 'rename', 'move', 'cls', 'date', 'time', 'ver',
  'vol', 'echo', 'set', 'if', 'for', 'goto', 'pause', 'path', 'prompt',
  'pushd', 'popd', 'shift', 'start', 'title', 'color', 'chcp', 'call',
  'assoc', 'ftype', 'where', 'endlocal', 'setlocal', 'exit',
]);

/**
 * Tokenize a command string for EXECUTION-MODE CLASSIFICATION ONLY.
 *
 * This is a lightweight heuristic tokenizer, NOT a shell parser and NOT a
 * security boundary. It roughly honors quotes and backslash escapes so it can
 * tell "this string needs a real shell" from "this is a plain argv", but it
 * does NOT implement shell grammar (expansion, arithmetic, process
 * substitution, $'' ANSI-C, etc.). It must never be used to validate or
 * "sanitize" a command — any decision it makes is advisory input to
 * resolveExecutionMode(), and the resulting mode only changes HOW the command
 * is spawned (direct argv vs sh -c / cmd /c), never whether it is allowed.
 *
 * @param {string} command
 * @returns {{tokens: string[], hasShellMeta: boolean}}
 */
function tokenizeShellCommand(command) {
  const tokens = [];
  let current = '';
  let quote = null;
  let hasShellMeta = false;
  let i = 0;
  const str = String(command || '');
  while (i < str.length) {
    const c = str[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      else current += c;
    } else if (quote === '"') {
      if (c === '"') quote = null;
      else if (c === '\\' && i + 1 < str.length && '"$`\\'.includes(str[i + 1])) {
        current += str[i + 1];
        i += 1;
      } else if (c === '$' || c === '`') {
        hasShellMeta = true;
        current += c;
      } else {
        current += c;
      }
    } else if (c === "'" || c === '"') {
      quote = c;
    } else if (c === '\\' && i + 1 < str.length) {
      current += str[i + 1];
      i += 1;
    } else if (/\s/.test(c)) {
      if (current) { tokens.push(current); current = ''; }
    } else if (c === '~' && current.length === 0) {
      hasShellMeta = true;
      current += c;
    } else if (SHELL_META.includes(c) || c === '#' || c === '{' || c === '}') {
      hasShellMeta = true;
      current += c;
    } else {
      current += c;
    }
    i += 1;
  }
  if (current) tokens.push(current);
  return { tokens, hasShellMeta };
}

/**
 * Decide how a command string must be executed:
 *   - 'direct' — no shell syntax; safe to spawn `tokens[0]` with `tokens[1..]`
 *     verbatim (arguments are preserved exactly, never re-quoted).
 *   - 'shell'  — contains shell syntax, or the first token is a shell builtin
 *     with no standalone executable; must go through executeShellScript().
 *   - 'invalid'— empty / no tokens.
 */
function resolveExecutionMode(command) {
  if (typeof command !== 'string' || command.trim().length === 0) {
    return { mode: 'invalid', tokens: [] };
  }
  const { tokens, hasShellMeta } = tokenizeShellCommand(command);
  if (tokens.length === 0) return { mode: 'invalid', tokens };

  const first = tokens[0].toLowerCase();
  const builtins = process.platform === 'win32' ? WINDOWS_SHELL_BUILTINS : POSIX_SHELL_BUILTINS;
  const envAssignment = /^[a-z_][a-z0-9_]*=/i.test(tokens[0]);

  const needsShell = hasShellMeta || builtins.has(first) || envAssignment;
  return needsShell ? { mode: 'shell', tokens } : { mode: 'direct', tokens };
}

module.exports = {
  executeSandboxed,
  executeSandboxedSync,
  executeShellScript,
  tokenizeShellCommand,
  resolveExecutionMode,
  // macOS
  generateSeatbeltProfile,
  validateSeatbeltProfile,
  createDarwinSandbox,
  // Linux
  buildBubblewrapArgs,
  createLinuxSandbox,
  // Windows
  createWindowsSandbox,
  createWindowsSandboxSync,
  getWindowsJobRunnerScript,
  resolveWindowsPowershellPath,
  parseWindowsHelperOutput,
  // Env / errors
  buildSafeEnv,
  SandboxError,
  createFailure,
  DEFAULT_WORKSPACE,
  DEFAULT_NETWORK_ALLOWLIST,
  SAFE_ENV_KEYS,
  WINDOWS_SAFE_ENV_KEYS,
  // allowlist helpers
  canonicalizePath: require('./directory-allowlist').canonicalizePath,
  isPathAllowed: require('./directory-allowlist').isPathAllowed,
  getSandboxDirs: require('./directory-allowlist').getSandboxDirs,
};
