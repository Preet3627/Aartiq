# Architecture Recommendations

**Date:** 2026-07-22
**Status:** Audit Complete — Recommendations Pending Implementation
**Scope:** Aartiq Browser (Electron) + Flutter Mobile Companion

---

## Executive Summary

Aartiq has grown into a sophisticated AI-native browser with OS automation, but the codebase carries significant technical debt from rapid iteration. The 9,012-line monolithic `main.js` and 7,131-line `AIChatSidebar.tsx` are the most visible symptoms. Beneath them lie 12 duplicate file pairs, 82 files in `src/lib/` with no organizational hierarchy, mixed module systems, and zero service lifecycle management. This document provides a prioritized, actionable roadmap to address these issues without halting feature development.

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Main Process Architecture](#2-main-process-architecture)
3. [Security Architecture](#3-security-architecture)
4. [Permission Architecture](#4-permission-architecture)
5. [Performance Architecture](#5-performance-architecture)
6. [Code Quality & Hygiene](#6-code-quality--hygiene)
7. [IPC Contract Architecture](#7-ipc-contract-architecture)
8. [Testing Architecture](#8-testing-architecture)
9. [Migration Roadmap](#9-migration-roadmap)
10. [Risk Register](#10-risk-register)

---

## 1. Current State Assessment

### 1.1 Monolith Inventory

| File | Lines | Modules | Responsibilities |
|------|-------|---------|------------------|
| `main.js` | 9,012 | CommonJS | IPC, window mgmt, all native APIs, services, menus, tray, auto-updater, security, 20+ domains |
| `AIChatSidebar.tsx` | 7,131 | ESM/TSX | Chat UI, message rendering, command parsing, permission flow, streaming, plugins, 15+ sub-features |
| `preload.js` | 801 | CommonJS | Massive contextBridge API surface, no input validation |

### 1.2 Duplicate File Pairs (12 Confirmed)

| Module | `.js` | `.ts` | Risk |
|--------|-------|-------|------|
| Security | `Security.js` | `Security.ts` | HIGH — dual validation logic |
| CloudSyncService | `CloudSyncService.js` | `CloudSyncService.ts` | HIGH — sync state divergence |
| FirebaseService | `FirebaseService.js` | `FirebaseService.ts` | HIGH — auth state confusion |
| WiFiSyncService | `WiFiSyncService.js` | `WiFiSyncService.ts` | MEDIUM — WebSocket conflicts |
| P2PFileSyncService | `P2PFileSyncService.js` | `P2PFileSyncService.ts` | MEDIUM — transfer protocol drift |
| modelRegistry | `modelRegistry.js` | `modelRegistry.ts` | MEDIUM — model list inconsistency |
| SyncMethodManager | `SyncMethodManager.js` | `SyncMethodManager.ts` | MEDIUM — sync method conflicts |
| SkillLoader | `SkillLoader.js` | `SkillLoader.ts` | LOW — skill loading divergence |
| crypto-utils | `crypto-utils.js` | `crypto-utils.ts` | HIGH — crypto implementations may differ |
| html-sanitizer | `html-sanitizer.js` | `html-sanitizer.ts` | HIGH — XSS surface |
| url-validator | `url-validator.js` | `url-validator.ts` | MEDIUM — URL validation gaps |
| firebaseConfigStorage | `firebaseConfigStorage.js` | `firebaseConfigStorage.ts` | LOW — config drift |

### 1.3 Module System Chaos

```
src/lib/
├── 47 CommonJS files (.js)     — require/module.exports
├── 35 TypeScript files (.ts)    — import/export
├── Mixed in same directory      — no barrel exports
├── .gradle/ artifacts           — shouldn't be in src/lib
└── build.gradle                 — Android artifact in Electron project
```

### 1.4 Handler Layer

`src/main/handlers/` contains 20 handler files (all CommonJS) that partially extract logic from `main.js` but still depend on its global state. They cannot be tested in isolation.

### 1.5 Missing Infrastructure

- No service registry or lifecycle management
- No dependency injection
- No service health checks
- No graceful degradation or circuit breakers
- No typed IPC contracts
- No startup performance budgets
- No memory budgets per process
- No automated tests for main process logic

---

## 2. Main Process Architecture

**Priority:** P0 (Critical)
**Effort:** 4–6 weeks
**Risk:** HIGH — touches every feature

### 2.1 Problem Statement

`main.js` at 9,012 lines is a single function-driven monolith. Every feature (AI, sync, OCR, automation, security, UI) lives in one file with shared mutable state. A crash in one subsystem cascades to all others. No subsystem can be started, stopped, or tested independently.

### 2.2 Target Architecture

```
src/main/
├── index.ts                          # Entry point — boots ServiceRegistry only
├── services/
│   ├── ServiceRegistry.ts            # Lifecycle management, dependency graph
│   ├── BaseService.ts                # Abstract base with start/stop/health
│   ├── WindowService.ts              # BrowserWindow creation, management
│   ├── IPCService.ts                 # IPC router with typed contracts
│   ├── MenuService.ts                # Application menus, context menus
│   ├── TrayService.ts                # System tray management
│   ├── AutoUpdateService.ts          # Electron auto-updater
│   ├── NotificationService.ts        # OS notifications
│   ├── AuthService.ts                # Auth, sessions, credentials
│   ├── SecurityService.ts            # Command validation, audit logging
│   ├── SyncService.ts                # WiFi, P2P, cloud sync orchestration
│   ├── AIService.ts                  # LLM orchestration, model management
│   ├── AutomationService.ts          # OS automation, AppleScript, shell
│   ├── PluginService.ts              # Plugin lifecycle, sandboxing
│   ├── OCRService.ts                 # Tesseract, screen vision
│   ├── VoiceService.ts               # Speech recognition, TTS
│   ├── MCPService.ts                 # MCP server management
│   └── StorageService.ts             # Persistent storage abstraction
├── ipc/
│   ├── contracts.ts                  # Type-safe IPC message definitions
│   ├── router.ts                     # Message routing to services
│   └── validation.ts                 # Input schema validation
├── middleware/
│   ├── security.ts                   # IPC security middleware
│   ├── audit-log.ts                  # Action audit trail
│   └── rate-limiter.ts               # IPC rate limiting
└── types/
    └── index.ts                      # Shared main process types
```

### 2.3 Service Base Class

```typescript
// Conceptual — not to be implemented literally
interface Service {
  name: string;
  dependencies: string[];
  start(context: ServiceContext): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): ServiceHealth;
}

interface ServiceRegistry {
  register(service: Service): void;
  startAll(): Promise<void>;
  stopAll(): Promise<void>;
  getHealth(): Map<string, ServiceHealth>;
}
```

### 2.4 Graceful Shutdown Sequencing

Current state: no shutdown ordering. `app.on('before-quit')` doesn't close WebSocket servers, sync services, or flush audit logs.

Target: reverse-dependency shutdown order:
1. Stop accepting new IPC messages
2. Stop plugin service (prevents new plugin operations)
3. Stop automation service (prevents new OS commands)
4. Stop sync services (flush pending transfers)
5. Stop AI service (cancel in-flight LLM calls)
6. Stop WebSocket servers
7. Flush audit logs
8. Close database connections
9. Close all windows

### 2.5 Migration Strategy

**Phase 1 (Week 1–2):** Extract `ServiceRegistry` and `BaseService`. Migrate 3 low-risk services (Tray, Menu, AutoUpdate) to prove the pattern. `main.js` shrinks by ~800 lines.

**Phase 2 (Week 2–4):** Extract window management, IPC routing, and auth. `main.js` shrinks to ~4,000 lines. Add typed IPC contracts for extracted services.

**Phase 3 (Week 4–6):** Extract remaining services (AI, sync, automation, security). `main.js` becomes a ~200-line bootstrapper. All services are independently testable.

---

## 3. Security Architecture

**Priority:** P0 (Critical)
**Effort:** 3–4 weeks
**Risk:** HIGH — security regressions possible during refactor

### 3.1 Problem Statement

Security logic is split across three files with overlapping concerns:
- `Security.ts` (981 lines) — command validation, risk levels, injection detection
- `SecurityValidator.js` — additional validation (JS, potential divergence from `.ts`)
- `Security.js` — older duplicate, likely stale

The 12 duplicate file pairs create a particularly dangerous situation for `Security.js`/`Security.ts` — two divergent validation implementations may be active simultaneously.

### 3.2 Target Architecture

```
src/lib/security/
├── index.ts                    # Public API barrel
├── CommandValidator.ts         # Command string parsing + risk classification
├── InjectionDetector.ts        # Prompt injection, code injection patterns
├── PermissionGuard.ts          # Runtime permission checking
├── AuditLogger.ts              # Immutable audit trail with integrity checks
├── InputSanitizer.ts           # HTML, URL, file path sanitization
├── RateLimiter.ts              # Per-action rate limiting
├── RiskClassifier.ts           # Risk level assignment (low/medium/high/critical)
├── SecurityPolicy.ts           # Policy definitions and enforcement rules
└── types.ts                    # Security-specific types
```

### 3.3 Security Middleware Pipeline

All IPC messages pass through a security middleware chain before reaching handlers:

```
IPC Message → Rate Limiter → Input Validator → Permission Guard → Risk Classifier → Handler
                  ↓                ↓                ↓                  ↓
              429 Too         400 Bad           403 Forbidden    requires approval
              Many Req        Request                             UI confirmation
```

### 3.4 Input Validation Layer

Current state: validation is ad-hoc within handler functions. No centralized schema validation.

Target: JSON Schema validation on every IPC message payload at the IPC boundary, before any handler logic executes. Use a schema registry that maps `channel:action` to a validation schema.

### 3.5 Audit Log Integrity

Current state: `ActionLogsStore.ts` stores action logs but has no integrity protection.

Target:
- Append-only log structure with HMAC chain
- Tamper detection on log read
- Log rotation with signed snapshots
- Export capability for compliance

### 3.6 Duplicate Security File Resolution

**Immediate action required:** Determine which of `Security.js`, `Security.ts`, and `SecurityValidator.js` is actively used. Delete the other(s). This is a security-critical decision — a stale validator could miss injection attacks.

---

## 4. Permission Architecture

**Priority:** P1 (High)
**Effort:** 2–3 weeks
**Risk:** MEDIUM — permission regression could expose user data

### 4.1 Problem Statement

Permission management is split across:
- `permission-store.js` — persistence
- `PermissionGuard` concepts in Security.ts
- `ai-action-security.ts` — action-level security
- `PermissionHandlers` in handlers/

No system exists for:
- Permission revocation propagation (revoking a permission doesn't cancel in-flight operations)
- Permission timeout/expiry
- Structured permission events (UI doesn't know when permissions change)
- Rate limiting per permission

### 4.2 Target Architecture

```
src/lib/permissions/
├── index.ts
├── PermissionStore.ts          # Persistent storage with versioning
├── PermissionGuard.ts          # Runtime enforcement
├── PermissionRevoker.ts        # Propagation of revocations
├── PermissionExpiry.ts         # TTL-based permission expiry
├── PermissionEventBus.ts       # Structured permission change events
├── RateLimiter.ts              # Per-permission rate limiting
└── types.ts                    # Permission types and enums
```

### 4.3 Permission Revocation Propagation

When a permission is revoked:
1. `PermissionRevoker` receives the event
2. It queries all active operations that depend on that permission
3. It sends cancellation signals to those operations
4. It notifies the UI via `PermissionEventBus`
5. It logs the revocation in the audit trail

### 4.4 Permission Expiry

Every permission grant includes an optional `expiresAt` timestamp. A background interval checks for expired permissions and triggers revocation. Default TTLs:
- `file:read` — 1 hour
- `file:write` — 1 hour
- `shell:execute` — 5 minutes
- `browser:navigate` — 30 minutes
- `automation:os` — 5 minutes

### 4.5 Structured Permission Events

The UI currently polls permission state. Replace with an event bus:

```typescript
interface PermissionEvent {
  type: 'granted' | 'revoked' | 'expired' | 'rate-limited';
  permission: Permission;
  source: 'user' | 'system' | 'timeout' | 'admin';
  timestamp: number;
  operationId?: string;  // For in-flight cancellation
}
```

---

## 5. Performance Architecture

**Priority:** P1 (High)
**Effort:** 3–4 weeks
**Risk:** MEDIUM — startup time regression if not careful

### 5.1 Problem Statement

All services initialize at startup regardless of whether they're needed:
- Tesseract OCR (~50MB model) loads at boot
- Voice service initializes microphone access
- MCP servers start before any MCP tool is used
- Firebase, WiFi sync, P2P sync all connect at startup
- Apple Intelligence, Siri integrations initialize on macOS even when unused

### 5.2 Lazy Loading Strategy

| Service | Current | Target | Savings |
|---------|---------|--------|---------|
| Tesseract OCR | Eager | Lazy (first OCR request) | ~2s boot, ~50MB RAM |
| Voice Service | Eager | Lazy (first voice interaction) | ~1s boot, mic permission |
| MCP Server | Eager | Lazy (first MCP tool call) | ~1.5s boot |
| WiFi Sync | Eager | Lazy (first sync attempt) | ~0.5s boot, UDP socket |
| P2P Sync | Eager | Lazy (first file transfer) | ~0.5s boot |
| Cloud Sync | Eager | Lazy (first cloud operation) | ~0.8s boot, Firebase init |
| Apple Intelligence | Eager | Lazy (first AI panel open) | ~0.3s boot |
| Siri Shortcuts | Eager | Lazy (first shortcut use) | ~0.3s boot |
| Research Pipeline | Eager | Lazy (first research query) | ~0.5s boot |
| Screen Vision | Eager | Lazy (first screen capture) | ~0.2s boot |

### 5.3 Service Dependency Graph

```
AuthService ─────────────────────────────────────────┐
    │                                                  │
    ├── SecurityService (depends: AuthService)         │
    │       │                                          │
    │       └── PermissionService (depends: Security)  │
    │                                                  │
    ├── StorageService (independent)                   │
    │                                                  │
    ├── WindowService (independent)                    │
    │                                                  │
    ├── IPCService (depends: WindowService)            │
    │                                                  │
    └── AIService (depends: StorageService)            │
            │                                          │
            ├── OCRService (depends: AIService)        │
            ├── VoiceService (depends: AIService)      │
            └── MCPService (depends: AIService)        │
                                                          │
    SyncService (depends: AuthService, StorageService) │
        ├── WiFiSyncService (depends: SyncService)     │
        ├── P2PFileSyncService (depends: SyncService)  │
        └── CloudSyncService (depends: SyncService)    │
```

Services with no dependencies start first. Dependent services wait for their dependencies to reach `healthy` state before starting.

### 5.4 Startup Performance Budgets

| Phase | Budget | What Runs |
|-------|--------|-----------|
| Critical path | < 500ms | Electron boot, IPC, window creation |
| Essential services | < 1000ms | AuthService, StorageService, SecurityService |
| UI services | < 1500ms | AIService (minimal), IPCService |
| Deferred services | < 3000ms | Sync, OCR, Voice, MCP, Plugins |
| Background services | < 5000ms | Everything else, health checks |

### 5.5 Memory Budgets

| Process | Current (est.) | Target | Notes |
|---------|----------------|--------|-------|
| Main process | Unbounded | 256MB | Service registry enforces |
| Renderer (per tab) | Unbounded | 512MB | Chrome limits apply |
| OCR worker | N/A | 128MB | Separate worker thread |
| Voice worker | N/A | 64MB | Separate worker thread |
| Plugin host | N/A | 128MB | Sandboxed per plugin |

### 5.6 Health Check Protocol

Each service exposes a health check:

```typescript
interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  lastError?: string;
  metrics?: Record<string, number>;
}
```

A background `HealthMonitor` polls all services every 30 seconds and:
- Logs health state transitions
- Triggers alerts for `unhealthy` services
- Attempts restart for `unhealthy` services (max 3 retries)
- Degrades gracefully (disables dependent features)

---

## 6. Code Quality & Hygiene

**Priority:** P2 (Medium)
**Effort:** 2–3 weeks
**Risk:** LOW — mostly cleanup

### 6.1 Duplicate File Elimination

**12 duplicate pairs must be resolved.** Process:

1. **Audit usage** — grep all imports for each duplicate pair to determine which is actively used
2. **Compare implementations** — diff the `.js` and `.ts` versions to identify divergent logic
3. **Consolidate to TypeScript** — the `.ts` version wins unless it's demonstrably incomplete
4. **Update all imports** — point all consumers to the single surviving file
5. **Delete the dead file** — remove from disk and git history

**Priority order for resolution:**

| Priority | Files | Why |
|----------|-------|-----|
| P0 | Security.js / Security.ts | Security divergence is dangerous |
| P0 | html-sanitizer.js / html-sanitizer.ts | XSS attack surface |
| P0 | crypto-utils.js / crypto-utils.ts | Crypto divergence is dangerous |
| P1 | FirebaseService.js / FirebaseService.ts | Auth state confusion |
| P1 | CloudSyncService.js / CloudSyncService.ts | Sync state divergence |
| P1 | WiFiSyncService.js / WiFiSyncService.ts | WebSocket conflicts |
| P2 | P2PFileSyncService.js / P2PFileSyncService.ts | Transfer protocol drift |
| P2 | modelRegistry.js / modelRegistry.ts | Model list inconsistency |
| P2 | SyncMethodManager.js / SyncMethodManager.ts | Sync method conflicts |
| P3 | SkillLoader.js / SkillLoader.ts | Skill loading divergence |
| P3 | url-validator.js / url-validator.ts | URL validation gaps |
| P3 | firebaseConfigStorage.js / firebaseConfigStorage.ts | Config drift |

### 6.2 TypeScript Strict Mode

Current `tsconfig.json` does not enable strict mode. Enabling it will surface:
- Implicit `any` types
- Null safety issues
- Missing return types
- Unreachable code

**Migration approach:**
1. Enable `strict: true` in a new `tsconfig.strict.json`
2. Run `tsc --noEmit` against it
3. Fix errors incrementally, one module at a time
4. Switch main `tsconfig.json` to strict once all modules pass

### 6.3 Shared Type Definitions

Create a centralized type package:

```
src/types/
├── ipc.ts              # IPC message types
├── services.ts         # Service interfaces
├── security.ts         # Security types
├── permissions.ts      # Permission types
├── ai.ts               # AI/LLM types
├── sync.ts             # Sync protocol types
├── events.ts           # Event bus types
└── index.ts            # Barrel export
```

### 6.4 Stale Artifact Cleanup

Remove from `src/lib/`:
- `.gradle/` directory (Android build artifact — doesn't belong in Electron)
- `build.gradle` (Android build file)
- Any test files (`test_*.swift`, `test_*.js` at root)

### 6.5 Barrel Exports

Create `index.ts` barrel files for each major directory:
- `src/lib/security/index.ts`
- `src/lib/sync/index.ts`
- `src/lib/ai/index.ts`
- `src/lib/permissions/index.ts`
- `src/main/services/index.ts`

---

## 7. IPC Contract Architecture

**Priority:** P1 (High)
**Effort:** 2–3 weeks
**Risk:** MEDIUM — breaking change for renderer process

### 7.1 Problem Statement

`preload.js` exposes 801 lines of `contextBridge.exposeInMainWorld` with no type safety. The renderer calls `window.electron.ipcRenderer.invoke(channel, ...args)` with string channels and untyped arguments. No contract exists between main and renderer processes.

### 7.2 Target Architecture

```
src/ipc/
├── contracts/
│   ├── auth.ipc.ts           # Auth-related IPC messages
│   ├── ai.ipc.ts             # AI-related IPC messages
│   ├── sync.ipc.ts           # Sync-related IPC messages
│   ├── automation.ipc.ts     # Automation-related IPC messages
│   ├── security.ipc.ts       # Security-related IPC messages
│   ├── permissions.ipc.ts    # Permission-related IPC messages
│   ├── window.ipc.ts         # Window management IPC
│   ├── plugin.ipc.ts         # Plugin-related IPC messages
│   └── types.ts              # Base IPC types
├── router.ts                 # Main process message routing
├── middleware/
│   ├── auth-check.ts         # Require authentication
│   ├── permission-check.ts   # Require specific permission
│   ├── rate-limit.ts         # Rate limiting
│   └── audit.ts              # Audit logging
└── preload/
    ├── index.ts              # Typed preload API
    └── api.ts                # contextBridge definitions
```

### 7.3 Typed IPC Example

```typescript
// contracts/ai.ipc.ts
interface AIIPC {
  'ai:chat': {
    request: { message: string; context?: ChatContext };
    response: { stream: AsyncIterable<ChatChunk>; id: string };
  };
  'ai:model:list': {
    request: void;
    response: ModelInfo[];
  };
  'ai:model:switch': {
    request: { provider: string; model: string };
    response: { success: boolean; model: ModelInfo };
  };
}
```

### 7.4 Backward Compatibility

The IPC contract refactor should be backward-compatible:
1. Old `channel: string` pattern continues to work via a compatibility layer
2. New typed API is opt-in per service
3. Deprecation warnings for old-style calls
4. Full migration completes when all services use typed contracts

---

## 8. Testing Architecture

**Priority:** P2 (Medium)
**Effort:** 4–6 weeks (ongoing)
**Risk:** LOW — additive only

### 8.1 Current State

- `tests/` directory exists but coverage is minimal
- `jest.config.js` is configured
- No main process tests
- No integration tests
- No security regression tests

### 8.2 Testing Strategy

| Layer | Tool | Coverage Target | Priority |
|-------|------|-----------------|----------|
| Unit (services) | Jest | 80% per service | P1 |
| Unit (security) | Jest | 95% for validation | P0 |
| Integration (IPC) | Jest + electron | All IPC contracts | P1 |
| E2E (UI flows) | Playwright | Critical user paths | P2 |
| Security regression | Custom | All known attack vectors | P0 |
| Performance | Custom | Startup, memory budgets | P2 |

### 8.3 Security Test Suite

Mandatory test categories:
- **Injection attacks** — prompt injection, SQL injection, XSS, command injection
- **Permission bypass** — attempts to access restricted APIs without permission
- **Rate limiting** — verify rate limits are enforced
- **Input validation** — malformed inputs to every IPC channel
- **Audit log integrity** — verify logs can't be tampered with

### 8.4 Test File Organization

```
tests/
├── unit/
│   ├── services/
│   ├── security/
│   ├── permissions/
│   └── ipc/
├── integration/
│   ├── ipc-contracts/
│   └── service-lifecycle/
├── security/
│   ├── injection/
│   ├── permission-bypass/
│   └── audit-integrity/
└── e2e/
    ├── chat-flow/
    ├── permission-flow/
    └── sync-flow/
```

---

## 9. Migration Roadmap

### Phase 0: Immediate (Week 0)
- [ ] Resolve 3 P0 duplicate security files (Security, html-sanitizer, crypto-utils)
- [ ] Audit all 12 duplicate pairs for usage patterns
- [ ] Remove `.gradle/` and `build.gradle` from `src/lib/`
- [ ] Add startup timing instrumentation to `main.js`

### Phase 1: Foundation (Weeks 1–3)
- [ ] Implement `ServiceRegistry` and `BaseService`
- [ ] Extract 3 low-risk services (Tray, Menu, AutoUpdate)
- [ ] Resolve remaining 9 duplicate file pairs
- [ ] Create `src/types/` with shared type definitions
- [ ] Enable TypeScript strict mode (incremental)

### Phase 2: Security & IPC (Weeks 3–6)
- [ ] Extract security into `src/lib/security/` module
- [ ] Implement IPC middleware pipeline (rate limiter, validator, audit)
- [ ] Define typed IPC contracts for extracted services
- [ ] Add permission revocation propagation
- [ ] Add permission expiry

### Phase 3: Performance (Weeks 6–9)
- [ ] Implement lazy loading for all non-essential services
- [ ] Add service dependency graph
- [ ] Implement startup performance budgets
- [ ] Add memory budgets and health checks
- [ ] Implement graceful shutdown sequencing

### Phase 4: Testing & Polish (Weeks 9–12)
- [ ] Add security regression test suite
- [ ] Add unit tests for all extracted services
- [ ] Add IPC integration tests
- [ ] Complete `main.js` decomposition (~200 line bootstrapper)
- [ ] Complete `AIChatSidebar.tsx` decomposition (see Section 9.1)

### 9.1 AIChatSidebar Decomposition

`AIChatSidebar.tsx` at 7,131 lines should be decomposed into:

```
src/components/chat/
├── ChatContainer.tsx              # Shell, layout, state management (~300 lines)
├── MessageList.tsx                # Virtual scrolling message list (~400 lines)
├── MessageRenderer.tsx            # Markdown, code, media rendering (~500 lines)
├── InputBar.tsx                   # Text input, voice, attachments (~300 lines)
├── PermissionFlow.tsx             # Permission request/approval UI (~400 lines)
├── CommandPreview.tsx             # Command parsing preview (~300 lines)
├── PluginPanel.tsx                # Plugin UI integration (~300 lines)
├── hooks/
│   ├── useChat.ts                 # Chat state management (~400 lines)
│   ├── useStreaming.ts            # Streaming response handling (~300 lines)
│   ├── usePermissions.ts          # Permission state (~200 lines)
│   └── usePlugins.ts             # Plugin state (~200 lines)
├── utils/
│   ├── message-utils.ts           # Message formatting helpers
│   ├── command-utils.ts           # Command parsing helpers
│   └── chat-helpers.ts            # General chat utilities
└── types.ts                       # Chat-specific types
```

---

## 10. Risk Register

### High Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Security regression during refactor | Vulnerable commands bypass validation | Security test suite must exist before refactor begins |
| Duplicate file deletion breaks hidden dependency | Runtime crash in production | Grep all imports before deletion; run full test suite |
| IPC contract change breaks renderer | UI completely non-functional | Backward-compatible compatibility layer; phased migration |
| Service extraction introduces race conditions | Intermittent startup failures | Dependency graph with health checks; integration tests |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Lazy loading increases first-use latency | Poor UX on first AI interaction | Pre-warm critical services during idle time |
| Permission expiry disrupts long operations | User loses work mid-operation | Expiry extends on active operation; warning before expiry |
| Module system migration (CJS→ESM) breaks bundler | Build failures | One file at a time; verify build after each migration |
| Shared types become stale | Runtime type mismatches | Generate types from runtime schemas; CI type-checking |

### Low Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| Barrel exports increase bundle size | Larger initial load | Tree-shaking verification; selective imports |
| Testing adds maintenance burden | Test failures block deployment | Focus on high-value tests; automated test health |
| Documentation drifts from implementation | Misleading architecture docs | AGENTS.md as source of truth; CI validation |

---

## Appendix A: File Inventory Summary

| Category | Count | Notes |
|----------|-------|-------|
| `src/lib/` top-level files | 82 | Should be ~40 after cleanup |
| `src/lib/` duplicate pairs | 12 | Must resolve all |
| `src/lib/` .gradle artifacts | ~10 | Must remove |
| `src/main/handlers/` files | 20 | Partially extracted from main.js |
| `src/lib/native-panels/` Swift | 15 | macOS only, separate concern |
| `src/lib/llm/` | 7 | Well-organized, keep as-is |
| `src/lib/extensions/` | 1 | Keep, add more structure |
| Root-level test files | 4 | Move to `tests/` |

## Appendix B: Estimated Impact

| Metric | Current | After Refactor | Improvement |
|--------|---------|----------------|-------------|
| `main.js` size | 9,012 lines | ~200 lines | 98% reduction |
| `AIChatSidebar.tsx` size | 7,131 lines | ~300 lines | 96% reduction |
| `preload.js` size | 801 lines | ~150 lines | 81% reduction |
| Files in `src/lib/` | 82 (+10 artifacts) | ~40 | 51% reduction |
| Duplicate file pairs | 12 | 0 | 100% elimination |
| Main process test coverage | 0% | 80%+ | New capability |
| Security test coverage | 0% | 95%+ | New capability |
| Startup time (est.) | ~4–5s | ~1.5–2s | 60% reduction |
| Memory at idle (est.) | ~400MB | ~200MB | 50% reduction |
| Time to onboard new developer | ~2 weeks | ~3 days | 78% reduction |

---

*This document should be treated as a living reference. Update as implementation progresses.*
