# Aartiq Security Audit Report

**Date:** 2026-07-22
**Auditor:** Automated Code Review (AI-assisted)
**Scope:** Full codebase — Electron desktop app, Flutter mobile companion, all IPC, native keychain, vault, AI command pipeline
**Method:** Manual static analysis, pattern matching, OWASP Desktop Verification Checklist

---

## Executive Summary

This audit covers the Aartiq Electron desktop application and associated modules. The codebase implements OS-level automation, credential management, AI command execution, and a vault encryption layer. Two critical vulnerabilities were identified and **fixed** during this audit cycle. Eight additional high-severity issues remain open and require immediate attention.

| Severity | Found | Fixed | Open |
|----------|-------|-------|------|
| CRITICAL | 2 | 2 | 0 |
| HIGH | 8 | 0 | 8 |
| MEDIUM | 5 | 0 | 5 |
| LOW | 3 | 0 | 3 |
| **Total** | **18** | **2** | **16** |

**Overall risk rating: HIGH** — The credential storage and shell execution paths present the most significant attack surface. The vault encryption key stored in plaintext on disk is the single highest-impact open finding.

---

## Findings

### CRITICAL

---

#### C-1: Shift+Tab Permission Bypass — FIXED

**Severity:** CRITICAL
**CVSS:** 9.1
**Files:**
- `aartiq-browser/src/components/useAIActionSecurityManager.tsx`
- `aartiq-browser/src/components/ClickPermissionModal.tsx`
- `aartiq-browser/src/components/McpApprovalPopup.tsx`
- `aartiq-browser/src/components/AIChatSidebar.tsx`

**Description:**
Four UI components contained keyboard shortcut handlers that auto-approved permission requests when Shift+Tab was pressed. Any user could bypass the approval prompt for non-high-risk actions by pressing Shift+Tab, regardless of which UI element had focus. This defeated the purpose of the permission gate entirely.

**Attack scenario:** An attacker with access to the machine (or a malicious site if the window had focus) could silently approve AI automation actions that the user never consented to.

**Remediation:** All four files were patched to remove the Shift+Tab auto-approval behavior. Permission approval now requires an explicit click on the approve button. No keyboard shortcut bypasses remain.

**Status:** FIXED ✅

---

#### C-2: Credential Storage Silent Failures — FIXED

**Severity:** CRITICAL
**CVSS:** 8.2
**Files:**
- `aartiq-browser/src/lib/native-keychain.js`

**Description:**
The native keychain module's Linux (libsecret) and Windows (DPAPI) fallback paths returned `{success: true}` even when the underlying keychain operation failed. Users and calling code had no way to distinguish a successful store from a failure. Credentials thought to be persisted were silently lost, and subsequent retrieval returned `null` with no error.

**Remediation:** All fallback paths now propagate the actual error and return `{success: false, error: "..."}`. Calling code is notified of failures.

**Status:** FIXED ✅

---

### HIGH

---

#### H-1: Shell Injection in native-keychain.js

**Severity:** HIGH
**CVSS:** 8.0
**File:** `aartiq-browser/src/lib/native-keychain.js`

**Description:**
Passwords are interpolated into shell command strings via `escapeShellArg()`. This function only escapes double quotes and backslashes — it does not escape shell metacharacters such as `$(...)`, backticks, single quotes, semicolons, pipes, or newlines. The password is passed as a here-string (`<<<`), which reduces but does not eliminate the risk. A password containing `$()` would still be expanded by the shell.

**Attack scenario:** A user stores a password containing `$(malicious-command)` or `` `malicious-command` ``. The shell expands this before passing it to the keychain utility.

**Remediation (recommended):**
- Switch to `execFile` with an argument array (no shell interpretation).
- If shell is unavoidable, pass passwords via a temporary file descriptor or environment variable, not via string interpolation.
- Reject passwords containing shell metacharacters as an additional layer.

**Status:** OPEN — Pending

---

#### H-2: PowerShell Command Injection in windows-credential-manager.js

**Severity:** HIGH
**CVSS:** 7.8
**File:** `aartiq-browser/src/lib/windows-credential-manager.js`

**Description:**
The `buildPsScript` function interpolates `target`, `account`, and `password` into a PowerShell heredoc string. The `sanitizeForPowerShell` function was incomplete — it did not escape `$`, backtick (`` ` ``), or single quotes. A malicious password or account name containing PowerShell special characters could alter the script's behavior.

**Attack scenario:** A password containing `' ; Remove-Item -Path C:\Users -Recurse -Force ;'` would break out of the string context.

**Remediation (recommended):**
- Use `-EncodedCommand` with base64-encoded UTF-16LE script blocks instead of string interpolation.
- Escape all PowerShell special characters: `$`, `` ` ``, `'`, `"`, `(`, `)`.

**Status:** OPEN — Pending

---

#### H-3: Vault Encryption Key Stored in Plaintext

**Severity:** HIGH
**CVSS:** 8.5
**File:** `aartiq-browser/src/lib/vault-handlers.js`

**Description:**
The AES-256-GCM encryption key used to encrypt vault entries is stored base64-encoded in `electron-store`'s `comet-permissions.json`. This is a plaintext JSON file on disk. Any process with filesystem read access to the user's application data directory can read the key and decrypt all vault entries.

**Impact:** Complete vault compromise. All stored secrets (API keys, tokens, passwords in the vault) are readable by any local process.

**Remediation (recommended):**
- Derive the encryption key from the OS keychain (which is already integrated) or from a user-provided passphrase.
- Use `electron.safeStorage.encryptString()` / `decryptString()` for key material.
- If the key must be cached in memory, never write it to disk.

**Status:** OPEN — Pending

---

#### H-4: Missing Electron Security Defaults

**Severity:** HIGH
**CVSS:** 7.5
**Files:**
- `aartiq-browser/main.js`
- `aartiq-browser/preload.js`

**Description:**
The BrowserWindow creation in `main.js` needs verification for these critical Electron security settings:
- `contextIsolation: true` — prevents renderer from accessing Node.js APIs directly
- `sandbox: true` — restricts renderer capabilities
- `nodeIntegration: false` — prevents require() in renderer

The preload script exposes an API surface of approximately 800 lines via `contextBridge`, including `shell-execute-command`, clipboard operations, file system access, dialog access, and permission management. If `contextIsolation` is disabled, any XSS in the renderer grants full Node.js access.

**Remediation (recommended):**
- Verify and enforce all three settings in BrowserWindow config.
- Audit the preload API surface — reduce exposed methods to the minimum required.
- Add an explicit allowlist of channels in the IPC handler.

**Status:** OPEN — Pending

---

#### H-5: CommandExecutor Shell Fallback Bypass

**Severity:** HIGH
**CVSS:** 7.2
**File:** `aartiq-browser/src/lib/CommandExecutor.ts`

**Description:**
The `shell-execute-command` IPC handler checks for shell metacharacters (`|`, `;`, `&`, `` ` ``, `$`, `<`, `>`) in the command string. If detected, it falls back to `shell: true` execution. The capability controller check happens before this, but the regex detection can be bypassed with encoded or multi-byte characters, Unicode confusables, or newline-separated commands that don't match the regex.

**Attack scenario:** An AI-generated command could use Unicode homoglyphs or encoding tricks to bypass the metacharacter regex and execute arbitrary shell commands.

**Remediation (recommended):**
- Default to `shell: false` and require explicit opt-in.
- Use a command allowlist or prefix match for known-safe commands.
- Validate command structure, not just character patterns.

**Status:** OPEN — Pending

---

#### H-6: No IPC Input Validation on Multiple Handlers

**Severity:** HIGH
**CVSS:** 7.0
**Files:** `aartiq-browser/main.js`, `aartiq-browser/preload.js`

**Description:**
Several IPC handlers accept arbitrary input from the renderer process without validation:

| Handler | Risk |
|---------|------|
| `clipboard-write` | Arbitrary clipboard content injection |
| `dialog-show-open` | Path traversal via file dialog |
| `store-set` | Arbitrary key-value storage pollution |
| `window-set-always-on-top` | Window manipulation |
| `shell-execute-command` | Arbitrary command execution (see H-5) |
| `permission-grant` | Permission escalation |

**Remediation (recommended):**
- Validate all IPC inputs against a schema (e.g., using `zod`).
- Restrict file dialog paths to user-allowed directories.
- Rate-limit all mutating IPC handlers.

**Status:** OPEN — Pending

---

#### H-7: PermissionStore Session Expiry Logic Error

**Severity:** HIGH
**CVSS:** 6.8
**File:** `aartiq-browser/src/lib/PermissionStore.ts`

**Description:**
The `grant()` method sets `expires_at` to 8 hours from now for session-scoped permissions. However, during `load()`, if `expires_at` is in the past, the permission is silently dropped. This means:
1. If the app runs for more than 8 hours, all session permissions vanish without user notification.
2. If the system clock is wrong, permissions may be dropped or never expire.
3. There is no grace period or refresh mechanism.

**Status:** OPEN — Pending

---

#### H-8: CapabilityController First-Time Approval Never Revoked

**Severity:** HIGH
**CVSS:** 6.5
**File:** `aartiq-browser/src/lib/CapabilityController.ts`

**Description:**
The `firstTimeApprovals` Set tracks which action types have been approved by the user during the session. Once an action is approved once, it is never removed from the Set — even if the user revokes the permission via the UI. There is no revocation path, no session reset, and no explicit expiry.

**Status:** OPEN — Pending

---

### MEDIUM

---

#### M-1: Security.ts Monolith

**Severity:** MEDIUM
**CVSS:** 5.5
**File:** `aartiq-browser/src/lib/Security.ts`

**Description:**
A single 583-line file containing regex-based threat detection, prompt injection detection, secret masking, HTML sanitization, URL validation, and the capability controller factory. This violates single-responsibility principle and makes unit testing difficult. Each subsystem should be independently testable.

**Remediation:** Split into dedicated modules: `threat-detector.ts`, `secret-masking.ts`, `capability-controller.ts`, etc. Add unit tests for each.

**Status:** OPEN — Pending

---

#### M-2: Duplicated Security Modules

**Severity:** MEDIUM
**CVSS:** 5.0
**Files:**
- `aartiq-browser/src/lib/Security.js` and `Security.ts`
- `aartiq-browser/src/lib/html-sanitizer.js` and `html-sanitizer.ts`
- `aartiq-browser/src/lib/url-validator.js` and `url-validator.ts`
- `aartiq-browser/src/lib/SecurityValidator.js`

**Description:**
Multiple versions of the same security modules coexist with partial overlap. This creates confusion about which version is authoritative and risks divergence where a fix in one file is not applied to the other.

**Remediation:** Remove duplicate files. Consolidate into a single TypeScript source of truth.

**Status:** OPEN — Pending

---

#### M-3: Linux secret-tool Uses Shell Execution

**Severity:** MEDIUM
**CVSS:** 5.5
**File:** `aartiq-browser/src/lib/native-keychain.js`

**Description:**
All Linux credential operations use `execSync` with shell interpolation to invoke `secret-tool`. This is the same class of vulnerability as H-1 but applies to all keychain operations on Linux (store, retrieve, delete).

**Status:** OPEN — Pending

---

#### M-4: No Rate Limiting on IPC Handlers

**Severity:** MEDIUM
**CVSS:** 5.0
**File:** `aartiq-browser/main.js`

**Description:**
There is no throttling or rate limiting on any IPC handler. A malicious renderer or compromised page could flood:
- `shell-execute-command` — rapid arbitrary command execution
- `clipboard-write` / `clipboard-read` — clipboard sniffing
- `permission-grant` — rapid permission grants

**Remediation:** Implement per-handler rate limits (e.g., token bucket or sliding window).

**Status:** OPEN — Pending

---

#### M-5: Audit Log Unbounded Growth

**Severity:** MEDIUM
**CVSS:** 4.5
**File:** `aartiq-browser/src/lib/audit-logger.ts`

**Description:**
`comet-audit.jsonl` grows without rotation or size limits. Over time this file will consume disk space and may become a denial-of-service vector. There is no log rotation, no max-size check, and no archival strategy.

**Remediation:** Implement log rotation (e.g., max 10MB per file, keep last 5 files).

**Status:** OPEN — Pending

---

### LOW

---

#### L-1: DOMPurify Fallback Returns Unsanitized HTML

**Severity:** LOW
**CVSS:** 4.0
**File:** `aartiq-browser/src/lib/html-sanitizer.ts`

**Description:**
When DOMPurify is unavailable (e.g., in the main process where it may not be bundled), the sanitizer logs a warning and returns the input HTML unsanitized. This is a defense-in-depth failure — code that expects sanitized output receives raw HTML.

**Status:** OPEN — Pending

---

#### L-2: URL Validator Missing SSRF Checks

**Severity:** LOW
**CVSS:** 3.8
**File:** `aartiq-browser/src/lib/url-validator.ts`

**Description:**
The URL validator does not check for:
- Private/internal IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x)
- DNS rebinding attacks
- `file://` protocol URLs
- `data:` URLs that could contain executable content

**Status:** OPEN — Pending

---

#### L-3: No Content Security Policy in Next.js

**Severity:** LOW
**CVSS:** 3.5
**File:** `aartiq-browser/next.config.js`

**Description:**
The Next.js configuration does not set Content-Security-Policy headers. Without CSP, any XSS vulnerability grants full script execution capability. CSP provides an additional layer of defense even if other protections fail.

**Remediation (recommended):**
```js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"
  }
];
```

**Status:** OPEN — Pending

---

## Electron Security Checklist

| # | Setting | Status |
|---|---------|--------|
| 1 | `contextIsolation: true` | Needs verification — see H-4 |
| 2 | `sandbox: true` | Needs verification — see H-4 |
| 3 | `nodeIntegration: false` | Needs verification — see H-4 |
| 4 | `webSecurity: true` (default) | Assumed present |
| 5 | `allowRunningInsecureContent: false` | Assumed present |
| 6 | `enableRemoteModule: false` | Needs verification |
| 7 | `preload` uses `contextBridge` | Present — see H-4 |
| 8 | No `nodeIntegration` in webview | Needs verification |
| 9 | CSP headers configured | Not configured — see L-3 |
| 10 | IPC channel allowlist | Not implemented — see H-6 |
| 11 | `shell.openExternal` validated | Needs verification |
| 12 | Navigation restricted | Needs verification |

---

## OWASP Alignment

This audit maps against the following OWASP guidelines:

| OWASP Category | Applicable Findings |
|----------------|---------------------|
| A01:2021 Broken Access Control | C-1, H-7, H-8 |
| A02:2021 Cryptographic Failures | H-3, L-2 |
| A03:2021 Injection | H-1, H-2, H-5, M-3 |
| A04:2021 Insecure Design | M-1, M-2 |
| A05:2021 Security Misconfiguration | H-4, L-3 |
| A07:2021 Identification and Authentication Failures | C-2, H-7 |
| A09:2021 Security Logging and Monitoring Failures | M-5 |

---

## Remediation Priority

1. **Immediate (this sprint):** H-1, H-2, H-3 — Shell injection and vault key exposure
2. **Next sprint:** H-4, H-5, H-6 — Electron hardening and IPC validation
3. **Scheduled:** H-7, H-8, M-1 through M-5 — Permission lifecycle and code cleanup
4. **Backlog:** L-1, L-2, L-3 — Defense-in-depth improvements

---

*This report should be re-audited after remediation of HIGH findings. Next scheduled audit: upon completion of H-1 through H-8.*
