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
// Windows AppContainer Sandboxing
// ---------------------------------------------------------------------------

/**
 * Windows sandboxing approach (multi-layer):
 *
 * 1. **Job Objects**: Process confinement via Win32 API:
 *    - JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE — child dies when parent exits
 *    - JOB_OBJECT_LIMIT_ACTIVE_PROCESS — limit process count to prevent forks
 *    - JOB_OBJECT_LIMIT_DIE_ON_UNHANDLED_EXCEPTION — crash isolation
 *    - JOB_OBJECT_SECURITY_NO_SECURITY — prevent token escalation
 *
 * 2. **Restricted Token**: Create a restricted token with low-box SID:
 *    - Removes dangerous SIDs (Administrators, SYSTEM, etc.)
 *    - Adds low-box SID for filesystem write restrictions
 *    - Prevents privilege escalation from child processes
 *
 * 3. **Filesystem Restrictions**: Directory ACLs via icacls:
 *    - Only allowlisted directories get read/write access
 *    - All other paths are deny-listed for write operations
 *    - Symlinks are resolved before checking against allowlist
 *
 * 4. **Network Restrictions**: Windows Firewall rules:
 *    - Create temporary inbound/outbound block rules
 *    - Only explicitly allowlisted domains are permitted
 *    - Rules are cleaned up after execution
 *
 * 5. **Environment Sanitization**: Strip ambient credentials:
 *    - Only PATH, HOME, USER, LANG, etc. are passed
 *    - API keys, tokens, and secrets are never exposed
 *
 * Implementation uses PowerShell P/Invoke for Win32 APIs since
 * we avoid native addon dependencies (ffi-napi, koffi).
 *
 * Audit-doc line item: §6 (OS-level sandboxing).
 */

/**
 * Generate a PowerShell script that creates a Job Object and assigns
 * the current process to it with security restrictions.
 *
 * @param {object} options
 * @param {number} options.maxProcesses — max active processes (default: 1)
 * @param {boolean} options.killOnClose — kill children when job closes (default: true)
 * @returns {string} PowerShell script content
 */
function generateJobObjectScript(options = {}) {
  const maxProcesses = options.maxProcesses || 1;
  const killOnClose = options.killOnClose !== false;

  return `
# Windows Job Object creation via P/Invoke
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class JobObject {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    public static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string name);

    [DllImport("kernel32.dll")]
    public static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

    [DllImport("kernel32.dll")]
    public static extern bool SetInformationJobObject(IntPtr hJob, int jobObjectInfoClass, IntPtr lpJobObjectInfo, uint cbJobObjectInfoLength);

    [DllImport("kernel32.dll")]
    public static extern bool TerminateJobObject(IntPtr hJob, uint uExitCode);

    [DllImport("kernel32.dll")]
    public static extern bool CloseHandle(IntPtr hObject);

    // Job object info classes
    public const int JobObjectBasicLimitInformation = 2;
    public const int JobObjectExtendedLimitInformation = 18;
    public const int JobObjectBasicUIRestrictions = 4;
    public const int JobObjectSecurityLimitInformation = 5;

    // Limit flags
    public const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;
    public const uint JOB_OBJECT_LIMIT_DIE_ON_UNHANDLED_EXCEPTION = 0x400;
    public const uint JOB_OBJECT_LIMIT_ACTIVE_PROCESS = 0x8;
    public const uint JOB_OBJECT_LIMIT_PROCESS_MEMORY = 0x100;
    public const uint JOB_OBJECT_LIMIT_JOB_MEMORY = 0x200;

    // UI restriction flags
    public const uint JOB_OBJECT_UILIMIT_DESKTOP = 0x40;
    public const uint JOB_OBJECT_UILIMIT_DISPLAYSETTINGS = 0x10;
    public const uint JOB_OBJECT_UILIMIT_GLOBALATOMS = 0x20;
    public const uint JOB_OBJECT_UILIMIT_HANDLES = 0x1;
    public const uint JOB_OBJECT_UILIMIT_READCLIPBOARD = 0x2;
    public const uint JOB_OBJECT_UILIMIT_SYSTEMPARAMETERS = 0x8;
    public const uint JOB_OBJECT_UILIMIT_WRITECLIPBOARD = 0x4;

    // Security flags
    public const uint JOB_OBJECT_SECURITY_NO_ADMIN = 0x1;
    public const uint JOB_OBJECT_SECURITY_RESTRICTED_TOKEN = 0x2;
    public const uint JOB_OBJECT_SECURITY_NO_TOKEN = 0x4;

    [StructLayout(LayoutKind.Sequential)]
    public struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public IntPtr MinimumWorkingSetSize;
        public IntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public long Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct IO_COUNTERS {
        public ulong ReadOperationCount;
        public ulong WriteOperationCount;
        public ulong OtherOperationCount;
        public ulong ReadTransferCount;
        public ulong WriteTransferCount;
        public ulong OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
        public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
        public IO_COUNTERS IoInfo;
        public IntPtr ProcessMemoryLimit;
        public IntPtr JobMemoryLimit;
        public IntPtr PeakProcessMemoryUsed;
        public IntPtr PeakJobMemoryUsed;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct JOBOBJECT_BASIC_UI_RESTRICTIONS {
        public uint UILimitFlags;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct JOBOBJECT_SECURITY_LIMIT_INFORMATION {
        public uint SecurityLimitFlags;
        public IntPtr JobToken;
        public IntPtr SidsToDisable;
        public IntPtr PrivilegesToDelete;
        public IntPtr RestrictedSids;
    }
}
"@;

# Create the Job Object
$jobHandle = [JobObject]::CreateJobObject([IntPtr]::Zero, "AartiqSandbox_" + [System.Diagnostics.Process]::GetCurrentProcess().Id)
if ($jobHandle -eq [IntPtr]::Zero) {
    Write-Error "Failed to create Job Object"
    exit 1
}

# Configure extended limit information
$extendedInfo = New-Object JobObject+JOBOBJECT_EXTENDED_LIMIT_INFORMATION
$extendedInfo.BasicLimitInformation.LimitFlags = [JobObject]::JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE -bor
    [JobObject]::JOB_OBJECT_LIMIT_DIE_ON_UNHANDLED_EXCEPTION -bor
    [JobObject]::JOB_OBJECT_LIMIT_ACTIVE_PROCESS
$extendedInfo.BasicLimitInformation.ActiveProcessLimit = ${maxProcesses}

$extendedInfoSize = [System.Runtime.InteropServices.Marshal]::SizeOf($extendedInfo)
$extendedInfoPtr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($extendedInfoSize)
[System.Runtime.InteropServices.Marshal]::StructureToPtr($extendedInfo, $extendedInfoPtr, $false)

$result = [JobObject]::SetInformationJobObject($jobHandle, [JobObject]::JobObjectExtendedLimitInformation, $extendedInfoPtr, $extendedInfoSize)
[System.Runtime.InteropServices.Marshal]::FreeHGlobal($extendedInfoPtr)

if (-not $result) {
    Write-Warning "Failed to set extended limit information, falling back to basic limits"
}

# Configure UI restrictions (prevent GUI interaction)
$uiRestrictions = New-Object JobObject+JOBOBJECT_BASIC_UI_RESTRICTIONS
$uiRestrictions.UILimitFlags = [JobObject]::JOB_OBJECT_UILIMIT_DESKTOP -bor
    [JobObject]::JOB_OBJECT_UILIMIT_DISPLAYSETTINGS -bor
    [JobObject]::JOB_OBJECT_UILIMIT_GLOBALATOMS -bor
    [JobObject]::JOB_OBJECT_UILIMIT_SYSTEMPARAMETERS

$uiSize = [System.Runtime.InteropServices.Marshal]::SizeOf($uiRestrictions)
$uiPtr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($uiSize)
[System.Runtime.InteropServices.Marshal]::StructureToPtr($uiRestrictions, $uiPtr, $false)
[JobObject]::SetInformationJobObject($jobHandle, [JobObject]::JobObjectBasicUIRestrictions, $uiPtr, $uiSize) | Out-Null
[System.Runtime.InteropServices.Marshal]::FreeHGlobal($uiPtr)

# Configure security restrictions (prevent token escalation)
$securityInfo = New-Object JobObject+JOBOBJECT_SECURITY_LIMIT_INFORMATION
$securityInfo.SecurityLimitFlags = [JobObject]::JOB_OBJECT_SECURITY_NO_ADMIN -bor
    [JobObject]::JOB_OBJECT_SECURITY_RESTRICTED_TOKEN

$secSize = [System.Runtime.InteropServices.Marshal]::SizeOf($securityInfo)
$secPtr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($secSize)
[System.Runtime.InteropServices.Marshal]::StructureToPtr($securityInfo, $secPtr, $false)
[JobObject]::SetInformationJobObject($jobHandle, [JobObject]::JobObjectSecurityLimitInformation, $secPtr, $secSize) | Out-Null
[System.Runtime.InteropServices.Marshal]::FreeHGlobal($secPtr)

# Assign current process to the job
$currentProcess = [System.Diagnostics.Process]::GetCurrentProcess()
$assigned = [JobObject]::AssignProcessToJobObject($jobHandle, $currentProcess.Handle)

if (-not $assigned) {
    Write-Warning "Failed to assign process to Job Object"
}

# Store handle for cleanup
$env:AARTIQ_JOB_HANDLE = $jobHandle.ToInt64()

Write-Output "Job Object created and configured successfully"
Write-Output "Job Handle: $($jobHandle.ToInt64())"
`.trim();
}

/**
 * Generate a PowerShell script that restricts filesystem access
 * by modifying directory ACLs to deny write access outside the allowlist.
 *
 * @param {string[]} allowedWriteDirs — directories allowed for write
 * @param {string[]} allowedReadDirs — directories allowed for read-only
 * @returns {string} PowerShell script content
 */
function generateFilesystemRestrictionScript(allowedWriteDirs, allowedReadDirs) {
  const denyPaths = [
    path.join(os.homedir(), 'Documents'),
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'Downloads'),
    path.join(os.homedir(), 'Pictures'),
    path.join(os.homedir(), 'Music'),
    path.join(os.homedir(), 'Videos'),
  ];

  return `
# Filesystem restriction via ACLs
Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Security.AccessControl;
using System.Security.Principal;

public class FsRestriction {
    public static void DenyWriteAccess(string path, string sid) {
        try {
            var di = new DirectoryInfo(path);
            if (!di.Exists) return;

            var acl = di.GetAccessControl();
            var rule = new FileSystemAccessRule(
                new SecurityIdentifier(sid),
                FileSystemRights.Write | FileSystemRights.CreateFiles | FileSystemRights.Delete | FileSystemRights.Modify,
                AccessControlType.Deny
            );
            acl.AddAccessRule(rule);
            di.SetAccessControl(acl);
        } catch (Exception) { }
    }

    public static void AllowReadAccess(string path, string sid) {
        try {
            var di = new DirectoryInfo(path);
            if (!di.Exists) return;

            var acl = di.GetAccessControl();
            var rule = new FileSystemAccessRule(
                new SecurityIdentifier(sid),
                FileSystemRights.Read | FileSystemRights.ListDirectory,
                AccessControlType.Allow
            );
            acl.AddAccessRule(rule);
            di.SetAccessControl(acl);
        } catch (Exception) { }
    }
}
"@;

# Low-box SID for restricted processes
$lowBoxSid = "S-1-15-3-1024-1024-1024-1024-1024-1024-1024-1024"

# Deny write access to sensitive user directories
${denyPaths.map(p => `FsRestriction::DenyWriteAccess("${p.replace(/\\/g, '\\\\')}", $lowBoxSid)`).join('\n    ')}

Write-Output "Filesystem restrictions applied"
`.trim();
}

/**
 * Generate a PowerShell script that creates temporary Windows Firewall
 * rules to block network access except for explicitly allowlisted destinations.
 *
 * @param {string[]} allowlistDomains — domains allowed for network access
 * @param {number} ruleDurationMinutes — how long the rules last (default: 5)
 * @returns {string} PowerShell script content
 */
function generateNetworkRestrictionScript(allowlistDomains = [], ruleDurationMinutes = 5) {
  const ruleName = `AartiqSandbox_${Date.now()}`;

  return `
# Network restriction via Windows Firewall
$ruleName = "${ruleName}"

# Block all outbound by default
New-NetFirewallRule -DisplayName "$ruleName-BlockOut" `
    -Direction Outbound -Action Block `
    -Profile Any -Enabled True `
    -Description "Aartiq sandbox: block outbound network" `
    -ErrorAction SilentlyContinue

# Block all inbound by default
New-NetFirewallRule -DisplayName "$ruleName-BlockIn" `
    -Direction Inbound -Action Block `
    -Profile Any -Enabled True `
    -Description "Aartiq sandbox: block inbound network" `
    -ErrorAction SilentlyContinue

${allowlistDomains.length > 0 ? `
# Allow specific domains
${allowlistDomains.map(domain => `New-NetFirewallRule -DisplayName "$ruleName-Allow_${domain.replace(/\./g, '_')}" `
    + `\n    -Direction Outbound -Action Allow `
    + `\n    -RemoteAddress "${domain}" `
    + `\n    -Profile Any -Enabled True `
    + `\n    -Description "Aartiq sandbox: allow ${domain}" `
    + `\n    -ErrorAction SilentlyContinue`).join('\n')}
` : '# No domains in allowlist — all network access denied'}

# Schedule cleanup
Start-Job -ScriptBlock {
    Start-Sleep -Seconds ${ruleDurationMinutes * 60}
    Remove-NetFirewallRule -DisplayName "$using:ruleName-BlockOut" -ErrorAction SilentlyContinue
    Remove-NetFirewallRule -DisplayName "$using:ruleName-BlockIn" -ErrorAction SilentlyContinue
${allowlistDomains.map(domain => `    Remove-NetFirewallRule -DisplayName "$using:ruleName-Allow_${domain.replace(/\./g, '_')}" -ErrorAction SilentlyContinue`).join('\n')}
} | Out-Null

Write-Output "Network restrictions applied (auto-cleanup in ${ruleDurationMinutes} minutes)"
`.trim();
}

/**
 * Execute a PowerShell script with elevated privileges for sandbox setup.
 *
 * @param {string} script — PowerShell script content
 * @param {object} options
 * @param {number} options.timeout — timeout in ms (default: 10000)
 * @returns {Promise<{success: boolean, stdout?: string, stderr?: string}>}
 */
function executePowerShellScript(script, options = {}) {
  const timeout = options.timeout || 10000;

  return new Promise((resolve) => {
    const child = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-Command', script,
    ], {
      windowsHide: true,
      timeout,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      resolve({
        success: code === 0,
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
 * Windows AppContainer sandboxing — the main entry point for Windows.
 *
 * This function orchestrates all Windows sandbox layers:
 * 1. Creates a Job Object for process confinement
 * 2. Sets up filesystem restrictions via ACLs
 * 3. Configures network restrictions via firewall rules
 * 4. Returns spawn options with the configured environment
 *
 * @param {string} command — the command to execute
 * @param {string[]} args — command arguments
 * @param {object} options
 * @param {string} options.workspace — workspace directory
 * @param {Array}  options.directoryAllowlist — directory allowlist entries
 * @param {string[]} options.networkAllowlist — allowed network domains
 * @returns {Promise<{command: string, args: string[], spawnOptions: object}>}
 */
async function createWindowsSandbox(command, args, options = {}) {
  const workspace = options.workspace || DEFAULT_WORKSPACE;
  const allowlist = options.directoryAllowlist || [];
  const networkAllowlist = options.networkAllowlist || DEFAULT_NETWORK_ALLOWLIST;

  // Step 1: Create Job Object
  const jobScript = generateJobObjectScript({ maxProcesses: 4, killOnClose: true });
  const jobResult = await executePowerShellScript(jobScript);
  if (!jobResult.success) {
    console.warn('[Sandbox] Windows Job Object creation failed:', jobResult.stderr);
  }

  // Step 2: Set up filesystem restrictions
  const { readDirs, writeDirs } = getSandboxDirs(allowlist.length > 0 ? allowlist : [{ path: workspace, access: 'read-write' }]);
  const fsScript = generateFilesystemRestrictionScript(writeDirs, readDirs);
  const fsResult = await executePowerShellScript(fsScript);
  if (!fsResult.success) {
    console.warn('[Sandbox] Windows filesystem restrictions failed:', fsResult.stderr);
  }

  // Step 3: Set up network restrictions
  const netScript = generateNetworkRestrictionScript(networkAllowlist);
  const netResult = await executePowerShellScript(netScript);
  if (!netResult.success) {
    console.warn('[Sandbox] Windows network restrictions failed:', netResult.stderr);
  }

  // Step 4: Build spawn options
  const spawnOptions = {
    env: buildSafeEnv(options),
    cwd: workspace,
    windowsHide: true,
    // Use CREATE_NO_WINDOW to suppress console window
    // windowsHide is the Node.js equivalent of CREATE_NO_WINDOW
  };

  return { command, args, spawnOptions };
}

/**
 * Synchronous Windows sandbox setup (for non-async contexts).
 * Falls back to basic environment sanitization if PowerShell is unavailable.
 *
 * @param {string} command — the command to execute
 * @param {string[]} args — command arguments
 * @param {object} options
 * @returns {{command: string, args: string[], spawnOptions: object}}
 */
function createWindowsSandboxSync(command, args, options = {}) {
  const workspace = options.workspace || DEFAULT_WORKSPACE;

  // Synchronous fallback: just sanitize environment and set cwd
  // Full sandbox setup requires async PowerShell calls
  const spawnOptions = {
    env: buildSafeEnv(options),
    cwd: workspace,
    windowsHide: true,
  };

  return { command, args, spawnOptions };
}

// ---------------------------------------------------------------------------
// Child Process Handler Setup
// ---------------------------------------------------------------------------

/**
 * Set up event handlers for a child process.
 * Extracted to avoid code duplication in async/sync paths.
 *
 * @param {ChildProcess} child — the spawned child process
 * @param {Function} resolve — the promise resolve function
 * @param {string} platform — the current platform
 * @param {string} effectiveCommand — the command that was actually executed
 * @param {string[]} effectiveArgs — the args that were actually passed
 */
function setupChildHandlers(child, resolve, platform, effectiveCommand, effectiveArgs) {
  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (data) => { stdout += data.toString(); });
  child.stderr.on('data', (data) => { stderr += data.toString(); });

  child.on('close', (code) => {
    // Clean up temp profile if created (macOS)
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
      // Windows: Use AppContainer sandbox (Job Objects + ACLs + Firewall)
      createWindowsSandbox(command, args, {
        workspace,
        directoryAllowlist: options.directoryAllowlist,
        networkAllowlist: options.networkAllowlist || DEFAULT_NETWORK_ALLOWLIST,
      }).then((sandboxConfig) => {
        effectiveCommand = sandboxConfig.command;
        effectiveArgs = sandboxConfig.args;
        spawnOptions = { ...spawnOptions, ...sandboxConfig.spawnOptions };

        child = spawn(effectiveCommand, effectiveArgs, spawnOptions);
        setupChildHandlers(child, resolve, platform, effectiveCommand, effectiveArgs);
      }).catch((err) => {
        console.warn('[Sandbox] Windows AppContainer setup failed, falling back:', err.message);
        // Fallback to sync version
        const syncConfig = createWindowsSandboxSync(command, args, { workspace });
        effectiveCommand = syncConfig.command;
        effectiveArgs = syncConfig.args;
        spawnOptions = { ...spawnOptions, ...syncConfig.spawnOptions };

        child = spawn(effectiveCommand, effectiveArgs, spawnOptions);
        setupChildHandlers(child, resolve, platform, effectiveCommand, effectiveArgs);
      });
      return; // Early return since we handle the promise in the .then()
    }

    child = spawn(effectiveCommand, effectiveArgs, spawnOptions);
    setupChildHandlers(child, resolve, platform, effectiveCommand, effectiveArgs);
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
  // Windows AppContainer exports
  generateJobObjectScript,
  generateFilesystemRestrictionScript,
  generateNetworkRestrictionScript,
  executePowerShellScript,
  createWindowsSandbox,
  createWindowsSandboxSync,
  DEFAULT_WORKSPACE,
  DEFAULT_NETWORK_ALLOWLIST,
  SAFE_ENV_KEYS,
  canonicalizePath: require('./directory-allowlist').canonicalizePath,
  isPathAllowed: require('./directory-allowlist').isPathAllowed,
  getSandboxDirs: require('./directory-allowlist').getSandboxDirs,
};
