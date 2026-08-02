# ============================================================================
# win-job-runner.ps1 — Aartiq Windows Job Object containment runner.
#
# SECURITY INVARIANTS
# -------------------
# 1. The target process is created SUSPENDED and assigned to a Job Object
#    created by this helper BEFORE its first instruction runs. It can never
#    execute a single instruction outside the Job Object.
# 2. Job Object handles remain open (held by this process) for the entire
#    target-process lifetime. JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE guarantees
#    the whole process tree is terminated if this helper exits.
# 3. Limits (active process count, job memory, kill-on-close, unhandled
#    exception isolation) are applied and verified before the target resumes.
# 4. Every setup step failure returns a structured error and exits non-zero;
#    the target is never allowed to run uncontained.
# 5. This is process confinement ONLY. It does NOT provide filesystem or
#    network isolation — callers must not claim that it does.
#
# Usage: powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass `
#          -File win-job-runner.ps1 <payload.json>
#
# Payload schema:
# {
#   "command": "<resolved executable absolute path or name>",
#   "args": ["..."],
#   "env": { "KEY": "value" },        // sanitized environment (allowlist only)
#   "cwd": "<absolute working directory that exists>",
#   "maxProcesses": 64,               // active process limit (>0)
#   "maxMemoryBytes": 0,              // 0 = no job memory limit
#   "timeoutMs": 30000                // 0 = no timeout
# }
#
# The last stdout line that starts with the AARTIQ_SANDBOX_RESULT: marker is a
# JSON result object:
#   AARTIQ_SANDBOX_RESULT:{"exitCode":n,"sandboxed":true,"sandboxPlatform":"win32","jobAssigned":true}
#   AARTIQ_SANDBOX_RESULT:{"error":"...","code":"SANDBOX_SETUP_FAILED","sandboxed":false,"rc":n}
# The target's stdout/stderr are forwarded directly (inherited handles), so the
# marker line is the only reliable way to separate result metadata from output.
# ============================================================================

param([Parameter(Mandatory = $true)][string]$PayloadPath)

$ErrorActionPreference = 'Stop'

function Write-Result([object]$obj) {
  Write-Output ("AARTIQ_SANDBOX_RESULT:" + ($obj | ConvertTo-Json -Compress))
}

try {
  $payload = Get-Content -Raw -LiteralPath $PayloadPath | ConvertFrom-Json
} catch {
  Write-Result @{ error = 'SANDBOX_SETUP_FAILED'; sandboxed = $false }
  exit 1
}

Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Collections.Generic;

public static class JobRunnerNative {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool SetInformationJobObject(IntPtr hJob, int JobObjectInfoClass, IntPtr lpJobObjectInfo, uint cbJobObjectInfoLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool IsProcessInJob(IntPtr hProcess, IntPtr hJob, out bool bResult);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool CloseHandle(IntPtr hObject);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool TerminateJobObject(IntPtr hJob, uint uExitCode);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CreateProcessW(
        string lpApplicationName,
        StringBuilder lpCommandLine,
        IntPtr lpProcessAttributes,
        IntPtr lpThreadAttributes,
        bool bInheritHandles,
        uint dwCreationFlags,
        IntPtr lpEnvironment,
        string lpCurrentDirectory,
        ref STARTUPINFO lpStartupInfo,
        out PROCESS_INFORMATION lpProcessInformation);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern uint ResumeThread(IntPtr hThread);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern uint WaitForSingleObject(IntPtr hHandle, uint dwMilliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GetExitCodeProcess(IntPtr hProcess, out uint lpExitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool TerminateProcess(IntPtr hProcess, uint uExitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr GetStdHandle(int nStdHandle);

    // Job object info classes
    public const int JobObjectExtendedLimitInformation = 9;

    // Startup info flags
    public const uint STARTF_USESTDHANDLES = 0x00000100;
    public const int STD_INPUT_HANDLE = -10;
    public const int STD_OUTPUT_HANDLE = -11;
    public const int STD_ERROR_HANDLE = -12;

    // Limit flags
    public const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;
    public const uint JOB_OBJECT_LIMIT_ACTIVE_PROCESS = 0x00000008;
    public const uint JOB_OBJECT_LIMIT_JOB_MEMORY = 0x00000200;
    public const uint JOB_OBJECT_LIMIT_DIE_ON_UNHANDLED_EXCEPTION = 0x00000400;

    // Process creation flags
    public const uint CREATE_SUSPENDED = 0x00000004;
    public const uint CREATE_NO_WINDOW = 0x08000000;
    public const uint CREATE_BREAKAWAY_FROM_JOB = 0x01000000;
    public const uint CREATE_UNICODE_ENVIRONMENT = 0x00000400;

    public const uint WAIT_TIMEOUT = 0x00000102;
    public const uint WAIT_FAILED = 0xFFFFFFFF;

    [StructLayout(LayoutKind.Sequential)]
    public struct STARTUPINFO {
        public uint cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public uint dwX;
        public uint dwY;
        public uint dwXSize;
        public uint dwYSize;
        public uint dwXCountChars;
        public uint dwYCountChars;
        public uint dwFillAttribute;
        public uint dwFlags;
        public ushort wShowWindow;
        public ushort cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct PROCESS_INFORMATION {
        public IntPtr hProcess;
        public IntPtr hThread;
        public uint dwProcessId;
        public uint dwThreadId;
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
    public struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public IntPtr MinimumWorkingSetSize;
        public IntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public IntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
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

    // Quote a single argument for a Windows command line (inverse of
    // CommandLineToArgvW). Handles embedded quotes, backslashes, spaces.
    public static string QuoteArg(string a) {
        if (a == null) return "\"\"";
        if (a.Length == 0) return "\"\"";
        bool hasQuote = a.IndexOf('"') >= 0;
        bool hasSpace = false;
        for (int i = 0; i < a.Length; i++) {
            if (a[i] == ' ' || a[i] == '\t' || a[i] == '\n' || a[i] == '\r') { hasSpace = true; break; }
        }
        if (!hasQuote && !hasSpace) return a;
        StringBuilder sb = new StringBuilder();
        sb.Append('"');
        int backslashes = 0;
        foreach (char c in a) {
            if (c == '\\') {
                backslashes++;
            } else if (c == '"') {
                sb.Append('\\', backslashes * 2 + 1);
                sb.Append('"');
                backslashes = 0;
            } else {
                sb.Append('\\', backslashes);
                sb.Append(c);
                backslashes = 0;
            }
        }
        sb.Append('\\', backslashes * 2);
        sb.Append('"');
        return sb.ToString();
    }

    public static string BuildCommandLine(string exe, string[] args) {
        StringBuilder sb = new StringBuilder();
        sb.Append(QuoteArg(exe));
        if (args != null) {
            foreach (string a in args) {
                sb.Append(' ');
                sb.Append(QuoteArg(a));
            }
        }
        return sb.ToString();
    }

    // Build a double-null-terminated Unicode environment block from a map.
    public static IntPtr BuildEnvBlock(IDictionary<string, string> env) {
        StringBuilder sb = new StringBuilder();
        if (env != null) {
            foreach (KeyValuePair<string, string> kv in env) {
                if (kv.Key == null) continue;
                sb.Append(kv.Key).Append('=').Append(kv.Value ?? string.Empty).Append('\0');
            }
        }
        sb.Append('\0');
        IntPtr ptr = Marshal.StringToHGlobalUni(sb.ToString());
        return ptr;
    }

    public static int Run(string exe, string[] args, Dictionary<string, string> env,
        string cwd, int maxProcesses, long maxMemoryBytes, int timeoutMs,
        out uint exitCode, out string error) {
        exitCode = 0;
        error = null;

        IntPtr job = CreateJobObject(IntPtr.Zero, null);
        if (job == IntPtr.Zero) {
            error = "CreateJobObject failed (0x" + Marshal.GetLastWin32Error().ToString("X8") + ")";
            return 1;
        }

        try {
            // Apply and verify limits BEFORE the target runs.
            JOBOBJECT_EXTENDED_LIMIT_INFORMATION ext = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
            ext.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
                | JOB_OBJECT_LIMIT_DIE_ON_UNHANDLED_EXCEPTION;
            if (maxProcesses > 0) {
                ext.BasicLimitInformation.ActiveProcessLimit = (uint)maxProcesses;
                ext.BasicLimitInformation.LimitFlags |= JOB_OBJECT_LIMIT_ACTIVE_PROCESS;
            }
            if (maxMemoryBytes > 0) {
                ext.JobMemoryLimit = (IntPtr)maxMemoryBytes;
                ext.BasicLimitInformation.LimitFlags |= JOB_OBJECT_LIMIT_JOB_MEMORY;
            }

            int size = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
            IntPtr infoPtr = Marshal.AllocHGlobal(size);
            try {
                Marshal.StructureToPtr(ext, infoPtr, false);
            } catch {
                Marshal.FreeHGlobal(infoPtr);
                error = "Failed to marshal job limit information";
                return 2;
            }

            bool limitsApplied = SetInformationJobObject(job, JobObjectExtendedLimitInformation, infoPtr, (uint)size);
            Marshal.FreeHGlobal(infoPtr);
            if (!limitsApplied) {
                error = "SetInformationJobObject failed (0x" + Marshal.GetLastWin32Error().ToString("X8") + ")";
                return 2;
            }

            IntPtr envPtr = BuildEnvBlock(env);
            try {
                string cmdLine = BuildCommandLine(exe, args);
                STARTUPINFO si = new STARTUPINFO();
                si.cb = (uint)Marshal.SizeOf(typeof(STARTUPINFO));
                // Forward the helper's standard handles so the target's
                // stdout/stderr reach the Node pipe (not a hidden console).
                si.dwFlags = STARTF_USESTDHANDLES;
                si.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
                si.hStdOutput = GetStdHandle(STD_OUTPUT_HANDLE);
                si.hStdError = GetStdHandle(STD_ERROR_HANDLE);
                PROCESS_INFORMATION pi;
                if (!CreateProcessW(exe, new StringBuilder(cmdLine), IntPtr.Zero, IntPtr.Zero,
                        true, CREATE_SUSPENDED | CREATE_NO_WINDOW | CREATE_UNICODE_ENVIRONMENT | CREATE_BREAKAWAY_FROM_JOB,
                        envPtr, cwd, ref si, out pi)) {
                    error = "CreateProcessW failed (0x" + Marshal.GetLastWin32Error().ToString("X8") + ")";
                    return 3;
                }

                try {
                    // The process is suspended: assign it to the job and verify
                    // before it can run a single instruction.
                    if (!AssignProcessToJobObject(job, pi.hProcess)) {
                        error = "AssignProcessToJobObject failed (0x" + Marshal.GetLastWin32Error().ToString("X8") + ")";
                        TerminateProcess(pi.hProcess, 1);
                        return 4;
                    }
                    bool inJob = false;
                    if (!IsProcessInJob(pi.hProcess, job, out inJob) || !inJob) {
                        error = "Job assignment verification failed";
                        TerminateProcess(pi.hProcess, 1);
                        return 5;
                    }

                    // Resume the primary thread (previous suspend count = 1
                    // because the process was created suspended). On failure
                    // the return value is (DWORD)-1.
                    uint resume = ResumeThread(pi.hThread);
                    if (resume == uint.MaxValue) {
                        error = "ResumeThread failed (0x" + Marshal.GetLastWin32Error().ToString("X8") + ")";
                        TerminateProcess(pi.hProcess, 1);
                        return 8;
                    }

                    uint waitMs = (timeoutMs > 0) ? (uint)timeoutMs : uint.MaxValue;
                    uint wait = WaitForSingleObject(pi.hProcess, waitMs);
                    if (wait == WAIT_TIMEOUT) {
                        TerminateJobObject(job, 124);
                        error = "TIMEOUT";
                        return 124;
                    }
                    if (wait == WAIT_FAILED) {
                        error = "WaitForSingleObject failed (0x" + Marshal.GetLastWin32Error().ToString("X8") + ")";
                        return 6;
                    }
                    if (!GetExitCodeProcess(pi.hProcess, out exitCode)) {
                        error = "GetExitCodeProcess failed (0x" + Marshal.GetLastWin32Error().ToString("X8") + ")";
                        return 7;
                    }
                    return 0;
                } finally {
                    if (pi.hThread != IntPtr.Zero) CloseHandle(pi.hThread);
                    if (pi.hProcess != IntPtr.Zero) CloseHandle(pi.hProcess);
                }
            } finally {
                if (envPtr != IntPtr.Zero) Marshal.FreeHGlobal(envPtr);
            }
        } finally {
            // Closing the last job handle triggers KILL_ON_JOB_CLOSE for any
            // process tree still inside the job (orphan cleanup).
            CloseHandle(job);
        }
    }
}
"@

# ---------------------------------------------------------------------------
# Resolve the executable. Bare names are resolved against PATH + PATHEXT.
# ---------------------------------------------------------------------------
$command = [string]$payload.command
$resolved = $null
if ($command -match '[\\/]') {
  $resolved = $command
} else {
  $found = Get-Command $command -ErrorAction SilentlyContinue
  if ($found -and $found.Source) { $resolved = $found.Source }
}
if (-not $resolved -or -not (Test-Path -LiteralPath $resolved)) {
  Write-Result @{ error = 'SANDBOX_SETUP_FAILED'; sandboxed = $false }
  exit 1
}

# Batch files require cmd.exe interpretation.
$isBatch = $resolved -match '\.(cmd|bat)$'
if ($isBatch) {
  $exe = $env:COMSPEC
  if (-not $exe) { $exe = "$env:WINDIR\System32\cmd.exe" }
  $innerArgs = @()
  if ($payload.args -ne $null) { $innerArgs = @($payload.args) }
  $cmdLine = [JobRunnerNative]::BuildCommandLine($resolved, [string[]]$innerArgs)
  $argsArray = @('/d', '/s', '/c', $cmdLine)
} else {
  $exe = $resolved
  if ($payload.args -ne $null) { $argsArray = @($payload.args) } else { $argsArray = @() }
}

$envDict = New-Object 'System.Collections.Generic.Dictionary[string,string]'
if ($payload.env -ne $null) {
  foreach ($prop in $payload.env.PSObject.Properties) {
    $envDict[$prop.Name] = [string]$prop.Value
  }
}

$cwd = [string]$payload.cwd
$maxProcesses = [int]$payload.maxProcesses
if ($maxProcesses -le 0) { $maxProcesses = 64 }
$maxMemoryBytes = [long]$payload.maxMemoryBytes
if ($maxMemoryBytes -lt 0) { $maxMemoryBytes = 0 }
$timeoutMs = [int]$payload.timeoutMs
if ($timeoutMs -lt 0) { $timeoutMs = 0 }

$exitCode = [uint32]0
$errorMsg = $null
$rc = [JobRunnerNative]::Run($exe, [string[]]$argsArray, $envDict, $cwd, $maxProcesses, $maxMemoryBytes, $timeoutMs, [ref]$exitCode, [ref]$errorMsg)

if ($rc -eq 0) {
  Write-Result @{ exitCode = [int]$exitCode; sandboxed = $true; sandboxPlatform = 'win32'; jobAssigned = $true }
} else {
  $msg = $errorMsg
  if ($rc -eq 124) { $msg = 'TIMEOUT' }
  Write-Result @{ error = $msg; code = 'SANDBOX_SETUP_FAILED'; sandboxed = $false; rc = $rc }
  if ($rc -eq 124) { exit 124 } else { exit 1 }
}
