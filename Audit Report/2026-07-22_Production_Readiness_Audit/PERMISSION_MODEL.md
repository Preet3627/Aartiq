# Aartiq Permission Model

**Date:** 2026-07-22
**Auditor:** Automated Code Review (AI-assisted)
**Scope:** Permission system — PermissionStore, CapabilityController, Security.ts, IPC permission bridge

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Permission Levels](#permission-levels)
3. [Layer 1 — PermissionStore](#layer-1--permissionstore)
4. [Layer 2 — CapabilityController](#layer-2--capabilitycontroller)
5. [Layer 3 — Security.createCapabilityController](#layer-3--securitycreatecapabilitycontroller)
6. [Supporting Components](#supporting-components)
7. [State Diagram](#state-diagram)
8. [Permission Lifecycle](#permission-lifecycle)
9. [Approval Workflow](#approval-workflow)
10. [Audit Requirements](#audit-requirements)
11. [Known Issues and Fixes](#known-issues-and-fixes)
12. [Hardening Recommendations](#hardening-recommendations)
13. [Structured Permission Event Format](#structured-permission-event-format)
14. [Permission Revocation Propagation](#permission-revocation-propagation)

---

## Architecture Overview

Aartiq uses a three-layer permission system. Each layer handles a distinct concern — persistence, action-level gating, and capability-scoped execution.

```
┌──────────────────────────────────────────────────────────────────┐
│                     User / AI Agent Request                      │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  Layer 3: Security.createCapabilityController                   │
│  Capability-scoped execution model                              │
│  - Registers allowed actions with approval policy                │
│  - Gates execution on approval requirements                     │
│  Source: src/lib/Security.ts:528  (TS)                          │
│          src/lib/Security.js:502  (compiled JS)                 │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  Layer 2: CapabilityController                                  │
│  Action-level gating with approval policies                      │
│  - never / always / first-time-per-session                      │
│  - Delegates permission checks to PermissionStore               │
│  Source: src/core/capability-controller.js                      │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  Layer 1: PermissionStore                                       │
│  Permission persistence with grant/revoke/isGranted             │
│  - 8-hour session expiry                                        │
│  - Audit trail (JSONL)                                          │
│  - Auto-approval settings                                       │
│  Source: src/lib/permission-store.js                            │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
         ┌────────────┐ ┌──────────┐ ┌──────────────┐
         │ permission- │ │ native-  │ │ command-     │
         │ handlers.js │ │ approval-│ │ validator.js │
         │ (IPC bridge)│ │ manager  │ │ (shell check)│
         └────────────┘ └──────────┘ └──────────────┘
```

### Source Files

| File | Role |
|------|------|
| `src/lib/permission-store.js` | Layer 1 — Permission persistence, audit, auto-approval |
| `src/core/capability-controller.js` | Layer 2 — Action registration, approval gating |
| `src/lib/Security.ts` / `Security.js` | Layer 3 — Capability-scoped execution, encryption, validation |
| `src/main/handlers/permission-handlers.js` | IPC bridge for renderer → main process permission operations |
| `src/main/handlers/native-approval-manager.js` | Platform-specific approval dialogs (macOS/Windows/Linux) |
| `src/core/command-validator.js` | Shell command validation, risk analysis, permission check |
| `src/lib/SecurityValidator.js` | Single source of truth for shell command validation and risk classification |
| `src/lib/macos-permission-health.js` | macOS system permission probing (screen recording, accessibility) |

---

## Permission Levels

Five ordered permission levels, from least to most privileged:

```
read  <  interact  <  write  <  execute  <  send
 1        2           3          4           5
```

| Level | Description | Typical Use |
|-------|-------------|-------------|
| `read` | View-only access to data | File reads, DOM queries, OCR results |
| `interact` | UI interaction without data mutation | Clicks, scrolls, keyboard input |
| `write` | Create or modify local data | File writes, database updates |
| `execute` | Run commands or processes | Shell commands, scripts, plugins |
| `send` | Transmit data off-device | Network requests, email, API calls |

Permission keys follow the pattern `CAPABILITY:<action-name>` or `command_<binary>`.

---

## Layer 1 — PermissionStore

**File:** `src/lib/permission-store.js`

### Responsibilities

- Persist granted permissions to disk (`comet-permissions.json`)
- Enforce 8-hour session expiry on grants
- Maintain append-only audit log (`comet-audit.jsonl`)
- Manage auto-approval settings (`comet-security-settings.json`)
- Expose grant/revoke/isGranted/getLevel/getAll API

### Data Model

Each stored permission:

```json
{
  "key": "CAPABILITY:NAVIGATE",
  "level": "read",
  "granted_at": 1700000000000,
  "expires_at": 1700028800000,
  "description": "Allow navigation to URLs"
}
```

- `expires_at` is `null` for non-session grants (currently all grants are session-only by default)
- `sessionOnly` parameter controls whether `expires_at` is set

### Key Behaviors

**Grant:**
```js
permissionStore.grant(key, level, description, sessionOnly = true)
```
- Validates level against `['read', 'interact', 'write', 'execute', 'send']`
- Sets `expires_at = now + 8h` when `sessionOnly` is true
- Persists to disk and appends audit entry

**Revoke:**
```js
permissionStore.revoke(key)    // single key
permissionStore.revokeAll()    // clear all
```

**Check:**
```js
permissionStore.isGranted(key)  // boolean
permissionStore.getLevel(key)   // level string or null
```
- Both `isGranted` and `getLevel` perform lazy expiry — if `expires_at` has passed, the permission is deleted from the map and the store is re-saved.

**Auto-approval bypass:**
```js
permissionStore.isAutoExecutable(riskLevel)       // 'low' or 'medium' with settings enabled
permissionStore.canAutoExecute(command, riskLevel) // per-command or risk-based
permissionStore.canAutoExecuteAction(actionType, riskLevel) // per-action-type or risk-based
```
- `autoApproveLowRisk: true` — all low-risk actions skip approval
- `autoApproveMidRisk: true` — all medium-risk actions skip approval
- `autoApprovedCommands` — per-command whitelist
- `autoApprovedActions` — per-action-type whitelist
- High-risk actions are never auto-approved (`canAutoExecuteAction` returns `false` for `high`)

### Session Expiry Behavior

On `load()`, expired permissions are silently dropped:
```js
if (row.expires_at && Date.now() > row.expires_at) continue;
```
No audit entry is generated for expiry-based drops.

---

## Layer 2 — CapabilityController

**File:** `src/core/capability-controller.js`

### Responsibilities

- Register named actions with an approval policy and risk level
- Gate execution on approval requirements
- Track first-time approvals within a session

### Action Registration

```js
controller.registerAction({
  name: 'NAVIGATE',
  handler: async (params) => { /* ... */ },
  requiresApproval: 'never',       // 'never' | 'always' | 'first-time-per-session'
  riskLevel: 'low',                // 'low' | 'medium' | 'high'
  description: 'Navigate to URL',
});
```

### Approval Policies

| Policy | Behavior |
|--------|----------|
| `never` | Execute immediately without any approval check |
| `always` | Require approval on every invocation |
| `first-time-per-session` | Require approval on first invocation, then auto-approve for rest of session |

### Execution Flow

```
executeAction(name, params)
  │
  ├─ Action not found → { approved: false, reason: "not registered" }
  │
  ├─ requiresApproval === 'always'
  │     └─ Check PermissionStore for CAPABILITY:<name>
  │           ├─ Granted → proceed
  │           └─ Not granted → { approved: false, reason: "requires approval" }
  │
  ├─ requiresApproval === 'first-time-per-session'
  │     ├─ Already in firstTimeApprovals set → proceed
  │     └─ Not yet approved
  │           ├─ Check PermissionStore for CAPABILITY:<name>
  │           │     ├─ Granted → proceed
  │           │     └─ Not granted → { approved: false, reason: "requires approval" }
  │           └─ On approval → add to firstTimeApprovals set
  │
  ├─ requiresApproval === 'never'
  │     └─ Execute handler directly
  │
  └─ Handler execution
        ├─ Success → { approved: true, result }
        └─ Error → { approved: false, reason: "failed: <message>" }
```

---

## Layer 3 — Security.createCapabilityController

**File:** `src/lib/Security.ts:528` (TypeScript source), compiled to `src/lib/Security.js:502`

This is functionally identical to the standalone `CapabilityController` in Layer 2, but is defined as a factory method on the `Security` object. It creates a closure-based controller with its own `actions` Map and `firstTimeApprovals` Set.

**Difference from Layer 2:** The Layer 3 version does not accept a `permissionStore` option — it cannot delegate to `PermissionStore.isGranted()`. This means approval checks in Layer 3 rely solely on the in-memory `firstTimeApprovals` set and have no cross-session persistence.

---

## Supporting Components

### permission-handlers.js — IPC Bridge

**File:** `src/main/handlers/permission-handlers.js`

Bridges renderer-process IPC calls to `PermissionStore` methods:

| IPC Channel | Operation |
|-------------|-----------|
| `perm-grant` | Grant a permission |
| `perm-revoke` | Revoke a single permission |
| `perm-revoke-all` | Revoke all permissions |
| `perm-check` | Check if a permission is granted |
| `perm-list` | List all active permissions |
| `perm-audit-log` | Retrieve audit log entries |
| `permission-auto-command` | Toggle per-command auto-approval |
| `permission-auto-action` | Toggle per-action-type auto-approval |
| `permission-auto-commands` | List auto-approved commands |
| `permission-auto-actions` | List auto-approved actions |
| `security-settings-get` | Get all security settings |
| `security-settings-update` | Update security settings |

### native-approval-manager.js — Platform Approval Dialogs

**File:** `src/main/handlers/native-approval-manager.js`

Presents native OS dialogs for approval requests:

| Platform | Mechanism | Timeout |
|----------|-----------|---------|
| macOS | `dialog.showMessageBox` with Deny/Approve buttons | None (waits indefinitely) |
| Windows | PowerShell script (`native-approval-dialog.ps1`) | 120 seconds |
| Linux | Bash script (`native-approval-dialog.sh`) | 120 seconds |

High-risk actions show a warning dialog with "Approve with Touch ID" on macOS.

### command-validator.js — Shell Command Validation

**File:** `src/core/command-validator.js`

- `validateCommand(cmd)` — delegates to `SecurityValidator.validateCommand()`
- `analyzeCommandRisk(cmd)` — delegates to `SecurityValidator.getShellRisk()`
- `checkShellPermission(command, reason, riskLevel)` — checks `electron-store` for `command_<binary>` or `shell_all` keys

**Note:** `checkShellPermission` uses a separate `electron-store` instance, not `PermissionStore`. This creates two independent permission stores.

### SecurityValidator.js — Risk Classification

**File:** `src/lib/SecurityValidator.js`

Single source of truth for:
- Dangerous pattern detection (`DANGEROUS_PATTERNS`)
- Blocked command list (`BLOCKED_COMMANDS`)
- Destructive command detection (`DESTRUCTIVE_COMMAND_PATTERNS`)
- Risk level classification (`getShellRisk`, `getRiskLevel`)
- Auto-execution whitelist (`AUTO_EXEC_ALLOWED`)
- File path, URL, OCR coordinate, and AI command validation

**Risk classification:**
- `getShellRisk(command)` — returns `'high'` if destructive pattern matches, else `'medium'`
- `getRiskLevel(commandType)` — maps AI command types to low/medium/high

### macos-permission-health.js — System Permission Probing

**File:** `src/lib/macos-permission-health.js`

Probes macOS system-level permissions (not Aartiq's internal permission model):
- Screen Recording access status
- Accessibility trust status
- Bundle identifier for proper TCC attribution

---

## State Diagram

```
                    ┌──────────────┐
                    │   NOT GRANTED │
                    └──────┬───────┘
                           │
                    grant() called
                           │
                           ▼
                    ┌──────────────┐
              ┌─────│   GRANTED     │─────┐
              │     └──────┬───────┘     │
              │            │             │
        revoke()     expires_at     getLevel()
              │       reached            │
              │            │             │
              ▼            ▼             ▼
       ┌──────────┐ ┌───────────┐ ┌──────────────┐
       │ REVOKED  │ │  EXPIRED  │ │ RETURN LEVEL │
       └──────────┘ └───────────┘ └──────────────┘
              │            │
              └─────┬──────┘
                    │
                    ▼
             ┌──────────────┐
             │ DELETED FROM │
             │ STORE        │
             └──────────────┘
```

For `CapabilityController` actions:

```
  ┌───────────────────────────────────────┐
  │         Action Requested              │
  └──────────────────┬────────────────────┘
                     │
           requiresApproval?
           ┌────┼────┐
           │    │    │
         never always  first-time-per-session
           │    │    │
           ▼    │    ├── already approved this session?
      EXECUTE   │    │   ├─ yes → EXECUTE
                │    │   └─ no  → CHECK PermissionStore
                │    │              ├─ granted → EXECUTE, record in session
                │    │              └─ not granted → DENY, await approval
                │    │
                │    └── CHECK PermissionStore
                │          ├─ granted → EXECUTE
                │          └─ not granted → DENY, await approval
                │
                ▼
           DENY, await approval
           ┌──────────────────┐
           │ User Approves?   │
           ├─ yes → Grant perm → EXECUTE
           └─ no  → DENY
```

---

## Permission Lifecycle

### 1. Request Phase

An action or command is requested by the AI agent or user interaction.

### 2. Validation Phase

- `SecurityValidator.validateCommand()` checks for dangerous patterns and blocked commands
- `CommandValidator.validateCommand()` performs length and format checks
- Risk level is determined via `getShellRisk()` or `getRiskLevel()`

### 3. Approval Gate Phase

- `CapabilityController.executeAction()` checks the approval policy
- If approval is needed, checks `PermissionStore.isGranted()` for existing grant
- If no grant exists, returns denial and waits for user response

### 4. User Approval Phase

- `NativeApprovalManager` presents platform-specific dialog
- User can approve or deny
- On approve: `PermissionStore.grant()` stores the permission
- On deny: action is rejected, audit entry logged

### 5. Execution Phase

- Approved action handler is invoked
- Result or error is returned through the capability controller

### 6. Expiry / Revocation Phase

- Permissions expire after 8 hours (lazy check on next `isGranted`/`getLevel` call)
- Explicit `revoke()` or `revokeAll()` removes permissions immediately
- No notification is sent to dependent systems on expiry or revocation

---

## Approval Workflow

### Standard Approval Flow

```
AI Agent / User Action
       │
       ▼
  CapabilityController.executeAction()
       │
       ├── needsApproval = false?
       │     └── Yes → Execute handler directly
       │
       └── needsApproval = true
             │
             ├── PermissionStore.isGranted(key)?
             │     └── Yes → Execute handler
             │
             └── No → Return { approved: false, reason }
                   │
                   ▼
             NativeApprovalManager.requestNativeApproval()
                   │
                   ├── macOS: dialog.showMessageBox()
                   ├── Windows: PowerShell script (120s timeout)
                   └── Linux: Bash script (120s timeout)
                         │
                         ├── Approved → PermissionStore.grant() → Execute
                         └── Denied → Return denial, log audit
```

### Auto-Approval Bypass

Before reaching the approval gate, the system may bypass approval entirely:

1. **Risk-based bypass:** `PermissionStore.isAutoExecutable(riskLevel)` returns `true` for low/medium risk when settings are enabled
2. **Command-based bypass:** `PermissionStore.canAutoExecute(command, riskLevel)` checks per-command whitelist
3. **Action-based bypass:** `PermissionStore.canAutoExecuteAction(actionType, riskLevel)` checks per-action-type whitelist
4. **Capability-based bypass:** Actions with `requiresApproval: 'never'` skip all approval checks

### Approval for High-Risk Actions

High-risk actions (`riskLevel === 'high'`) are never auto-approved by `canAutoExecuteAction()`. They always require explicit user approval through the native dialog.

---

## Audit Requirements

### Current Audit Format

Each audit entry is a single JSONL line:

```json
{
  "entry": "permission.grant: CAPABILITY:NAVIGATE (read) — Allow navigation",
  "timestamp": 1700000000000,
  "date": "2023-11-14T22:13:20.000Z"
}
```

### Audit Events Currently Logged

| Event | Trigger |
|-------|---------|
| `permission.grant: <key> (<level>) — <description>` | `PermissionStore.grant()` |
| `permission.revoke: <key>` | `PermissionStore.revoke()` |
| `permission.revokeAll` | `PermissionStore.revokeAll()` |

### Audit Gaps

- No entry when permissions expire silently on `load()`
- No entry when `isGranted()` lazily removes an expired permission
- No entry for auto-approval bypass decisions
- No entry for denied approval requests
- No entry for `CapabilityController` execution results
- No entry for risk classification decisions
- No entry for security setting changes (autoApproveLowRisk, etc.)

### Audit Integrity

The audit log is a plain append-only JSONL file (`comet-audit.jsonl`). There is:
- No HMAC or signature over entries
- No chain hashing for tamper detection
- No file locking for concurrent writes
- No log rotation or size limits

---

## Known Issues and Fixes

### Fixed Issues

| ID | Issue | Status | Fix |
|----|-------|--------|-----|
| F-1 | Shift+Tab keyboard shortcut auto-approved permissions in AIChatSidebar and mcp-browser-server | **Fixed** | Removed auto-approval keyboard shortcut handling; added `stopPropagation` to prevent event bubbling |

### Open Issues

| ID | Issue | Severity | Description |
|----|-------|----------|-------------|
| O-1 | First-time-per-session approvals never revoked within session | Medium | Once an action is approved via `first-time-per-session`, it remains approved for the entire session with no way to revoke without restarting |
| O-2 | PermissionStore session expiry drops permissions silently on load | Low | `load()` skips expired permissions without logging audit entries |
| O-3 | No permission downgrade path | Medium | `grant()` overwrites the existing level; there is no way to change a permission from `execute` to `read` without revoking and re-granting |
| O-4 | Audit log has no integrity protection | High | Append-only JSONL with no HMAC, chain hashing, or file locking |
| O-5 | No permission delegation model | Low | Permissions cannot be delegated from one capability to another |
| O-6 | Risk classification inconsistencies | Medium | `SecurityValidator.getShellRisk()` classifies most commands as `medium`, while `CapabilityController` uses `low/medium/high` per action — the two systems can disagree |
| O-7 | No timeout on pending approval requests | Medium | macOS approval dialog (`dialog.showMessageBox`) waits indefinitely; user may walk away leaving the system in a pending state |
| O-8 | Missing denial reasons in some code paths | Low | Some denial paths return generic messages without specific reasons |
| O-9 | autoApproveLowRisk and autoApproveMidRisk bypass approval entirely | High | User-configurable settings that skip the entire approval workflow for low and medium risk actions |
| O-10 | Dual permission stores | Medium | `command-validator.js` uses `electron-store` while `permission-store.js` uses a JSON file — two independent stores with different APIs and no synchronization |

---

## Hardening Recommendations

### Critical Priority

1. **Audit log integrity** — Implement HMAC-SHA256 chaining over audit entries. Each entry includes the hash of the previous entry. Verify chain on read. Consider using `fsync` after writes.

2. **Approval timeout** — Add a configurable timeout (e.g., 120 seconds) to all approval dialogs, including macOS. Default to deny on timeout. Log timeout as an audit event.

3. **Auto-approval risk ceiling** — `autoApproveLowRisk` and `autoApproveMidRisk` should require explicit re-confirmation per session or per reboot. Display a warning when these are enabled.

### High Priority

4. **Session approval revocation** — Add `revokeSessionApproval(name)` to `CapabilityController` to allow revoking `first-time-per-session` approvals without restarting.

5. **Unified permission store** — Merge `command-validator.js`'s `electron-store` usage into `PermissionStore`. All permission checks should flow through a single store.

6. **Risk classification alignment** — Consolidate `SecurityValidator.getShellRisk()` and `CapabilityController` risk levels into a single classifier. Use a unified risk map that considers both command patterns and action types.

### Medium Priority

7. **Permission downgrade API** — Add `updateLevel(key, newLevel)` to `PermissionStore` that changes the level in place and logs the transition in the audit trail.

8. **Expiry audit entries** — Log `permission.expired: <key>` when permissions are lazily removed on `isGranted()` or `getLevel()` checks.

9. **Structured audit events** — Replace free-text audit entries with structured JSON objects (see [Structured Permission Event Format](#structured-permission-event-format)).

10. **Approval denial reasons** — Ensure all denial code paths include a specific, actionable reason string.

### Low Priority

11. **Permission delegation** — Implement a delegation model where a granted permission can authorize a sub-permission at a lower level. Track delegation chains in the audit log.

12. **Audit log rotation** — Implement size-based log rotation with signed archive files.

13. **CapabilityController session reset** — Add a `resetSession()` method to clear `firstTimeApprovals` and re-prompt on next invocation.

---

## Structured Permission Event Format

Replace the current free-text audit entries with a structured format:

```json
{
  "eventId": "evt_1700000000000_a1b2c3",
  "timestamp": 1700000000000,
  "date": "2023-11-14T22:13:20.000Z",
  "type": "permission.granted",
  "actor": "ai-agent",
  "key": "CAPABILITY:NAVIGATE",
  "level": "read",
  "previousLevel": null,
  "description": "Allow navigation to URLs",
  "sessionOnly": true,
  "expiresAt": 1700028800000,
  "context": {
    "riskLevel": "low",
    "approvalPolicy": "always",
    "source": "capability-controller"
  },
  "hash": "sha256:<previous-entry-hash>"
}
```

### Event Types

| Type | When |
|------|------|
| `permission.granted` | Permission granted via `grant()` |
| `permission.revoked` | Permission revoked via `revoke()` |
| `permission.revoked.all` | All permissions revoked via `revokeAll()` |
| `permission.expired` | Permission lazily expired on check |
| `permission.downgraded` | Permission level changed (future) |
| `permission.check.denied` | `isGranted()` returned false for a check |
| `approval.requested` | Approval dialog shown to user |
| `approval.granted` | User approved in dialog |
| `approval.denied` | User denied in dialog |
| `approval.timeout` | Approval dialog timed out |
| `auto.approval.bypassed` | Auto-approval skipped the approval gate |
| `capability.executed` | Action handler executed |
| `capability.denied` | Action execution denied by capability controller |
| `capability.failed` | Action handler threw an error |
| `settings.changed` | Security settings updated |

### Event Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `eventId` | string | yes | Unique monotonic identifier |
| `timestamp` | number | yes | Unix timestamp in milliseconds |
| `date` | string | yes | ISO 8601 date string |
| `type` | string | yes | Event type from the table above |
| `actor` | string | yes | Who initiated: `user`, `ai-agent`, `system` |
| `key` | string | conditional | Permission key (for permission.* events) |
| `level` | string | conditional | Permission level granted/checked |
| `previousLevel` | string | no | Previous level before change |
| `description` | string | no | Human-readable description |
| `sessionOnly` | boolean | no | Whether the grant is session-scoped |
| `expiresAt` | number | no | Expiration timestamp |
| `context` | object | no | Additional contextual information |
| `hash` | string | yes | SHA-256 hash of this entry concatenated with previous entry's hash |

---

## Permission Revocation Propagation

### Problem

When a permission is revoked (via `revoke()`, `revokeAll()`, or expiry), there is no mechanism to notify systems that currently depend on that permission. A capability may be mid-execution, a UI component may be displaying an "approved" state, or an auto-approval list may still reference the revoked permission.

### Current Propagation Points

| Revocation Source | Propagates To | Mechanism |
|-------------------|---------------|-----------|
| `revoke(key)` | PermissionStore map | Direct deletion |
| `revokeAll()` | PermissionStore map | Clear all |
| Lazy expiry in `isGranted()` | PermissionStore map | Direct deletion |
| Lazy expiry in `load()` | Skipped on load | Filter during deserialization |

### Propagation Gaps

1. **CapabilityController.firstTimeApprovals** — Not cleared when underlying permission is revoked
2. **Renderer process UI** — No IPC event sent to update permission status displays
3. **Auto-approved command/action lists** — Not affected by permission revocation
4. **Mid-execution capabilities** — No cancellation signal for in-flight operations
5. **Mobile companion (Flutter app)** — WebSocket sync does not propagate permission revocations

### Proposed Propagation Design

```
PermissionStore.revoke(key)
       │
       ├── 1. Remove from permissions Map
       │
       ├── 2. Persist to disk
       │
       ├── 3. Append audit entry
       │
       ├── 4. Emit revocation event
       │       │
       │       ├── CapabilityController.resetSessionApproval(name)
       │       │     └── Remove from firstTimeApprovals set
       │       │
       │       ├── IPC broadcast to renderer
       │       │     └── event: 'permission-revoked'
       │       │           payload: { key, level, revokedAt }
       │       │
       │       └── WebSocket broadcast to mobile companion
       │             └── message: 'permission-revoked'
       │                   payload: { key, level, revokedAt }
       │
       └── 5. Return success
```

### Implementation Sketch

```js
// PermissionStore.emitRevocation(key, reason)
emitRevocation(key, reason) {
  const event = {
    type: 'permission.revoked',
    key,
    reason,
    revokedAt: Date.now(),
  };

  // Notify registered listeners
  for (const listener of this.revocationListeners) {
    try { listener(event); } catch (e) { /* log, don't throw */ }
  }

  // IPC broadcast if main window is available
  if (global.mainWindow && !global.mainWindow.isDestroyed()) {
    global.mainWindow.webContents.send('permission-revoked', event);
  }

  this.logAudit({
    type: 'permission.revoked',
    key,
    reason,
    timestamp: Date.now(),
  });
}
```

```js
// CapabilityController.onRevocation(event)
onRevocation({ key }) {
  const actionName = key.replace('CAPABILITY:', '');
  this.firstTimeApprovals.delete(actionName);
}
```

### Revocation Cascading Rules

| Revoked Permission | Cascade Target | Action |
|--------------------|----------------|--------|
| `CAPABILITY:<name>` | CapabilityController.firstTimeApprovals | Remove entry |
| `CAPABILITY:<name>` | Active approval dialogs | Dismiss with "permission revoked" |
| `CAPABILITY:<name>` | Renderer permission UI | Send `permission-revoked` IPC |
| `CAPABILITY:<name>` | Mobile companion | Send via WebSocket |
| Any permission | Audit log | Append revocation event |
| `revokeAll()` | All of the above | Cascade for every active key |
