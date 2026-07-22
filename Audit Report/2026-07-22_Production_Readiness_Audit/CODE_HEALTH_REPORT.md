# Aartiq Code Health Report

Generated: 2026-07-22

---

## Executive Summary

Aartiq's codebase has significant technical debt concentrated in two critical monoliths (`main.js` at 9012 lines, `AIChatSidebar.tsx` at 7131 lines), a legacy JS-to-TS migration with ~12 dead duplicate file pairs, and missing architectural guardrails (no DI, no IPC validation, mixed module systems). The codebase is functional but increasingly fragile as features grow.

---

## 1. Dead Code & Duplicate Files

### Legacy JS/TS Duplicate Pairs

Each pair below has a `.js` file that should be deleted — the `.ts` version is the active implementation.

| # | Legacy `.js` File | Active `.ts` File | Est. Dead Lines |
|---|-------------------|-------------------|-----------------|
| 1 | `Security.js` | `Security.ts` | ~500 |
| 2 | `html-sanitizer.js` | `html-sanitizer.ts` | ~200 |
| 3 | `url-validator.js` | `url-validator.ts` | ~150 |
| 4 | `WiFiSyncService.js` | `WiFiSyncService.ts` | ~400 |
| 5 | `P2PFileSyncService.js` | `P2PFileSyncService.ts` | ~350 |
| 6 | `CloudSyncService.js` | `CloudSyncService.ts` | ~300 |
| 7 | `FirebaseService.js` | `FirebaseService.ts` | ~250 |
| 8 | `firebaseConfigStorage.js` | `firebaseConfigStorage.ts` | ~100 |
| 9 | `SkillLoader.js` | `SkillLoader.ts` | ~200 |
| 10 | `modelRegistry.js` | `modelRegistry.ts` | ~180 |
| 11 | `SyncMethodManager.js` | `SyncMethodManager.ts` | ~160 |

**Total estimated dead code: ~2,790 lines**

| Item | Severity | Effort | Impact |
|------|----------|--------|--------|
| Delete all `.js` duplicates where `.ts` versions exist | LOW | 1-2 hours | Removes ~2,790 lines of dead code, eliminates confusion about which file to edit, reduces bundle risk |

### Potential Overlap

| File Pair | Concern |
|-----------|---------|
| `appVersion.ts` / `useAppVersion.ts` | May contain overlapping version logic; audit for single source of truth |

---

## 2. Oversized Components

| File | Lines | Severity | Status |
|------|-------|----------|--------|
| `main.js` | 9012 | **CRITICAL** | Monolith — handles auth, IPC, PDF gen, window mgmt, tray, updates, services |
| `AIChatSidebar.tsx` | 7131 | **CRITICAL** | Monolith — renders chat, handles AI streaming, tool UI, session mgmt |
| `AICommandParser.ts` | 797 | MODERATE | Parsing logic could be split by command category |
| `preload.js` | 801 | MODERATE | Large context bridge — could be split per feature |
| `command-executor.js` | 433 | LOW | Acceptable but growing |

### `main.js` Breakdown (9012 lines)

Likely responsibilities crammed into one file:
- App lifecycle & window management
- IPC handler registration
- Authentication & credential management
- Tray & menu setup
- Auto-update logic
- Background service orchestration
- PDF/document generation triggers
- Native panel integration
- Plugin loading
- Notification handling

### `AIChatSidebar.tsx` Breakdown (7131 lines)

Likely responsibilities crammed into one file:
- Chat message rendering & streaming
- AI provider selection & routing
- Tool invocation UI (file ops, commands, web search)
- Session/conversation management
- Prompt template management
- Model settings panel
- Code block rendering & copy
- File attachment handling

---

## 3. Circular Dependency Risks

| Risk Point | File | Concern |
|------------|------|---------|
| Handler barrel import | `src/main/handlers/index.js` | Likely re-exports all handlers — any handler importing another handler creates a cycle |
| Core barrel import | `src/core/index.js` | Imports from multiple core modules — cross-imports between core modules risk cycles |
| Security re-exports | `Security.ts` | Re-exports from `html-sanitizer`, `url-validator`, `crypto-utils` — if those import anything from Security, it cycles |

---

## 4. Architecture Concerns

| Concern | Details | Severity |
|---------|---------|----------|
| Monolith main process | `main.js` handles everything — auth, IPC, UI, services, PDF, tray, updates | CRITICAL |
| No dependency injection | Services instantiate their own deps (e.g., `Security` creates its own `HtmlSanitizer`) | HIGH |
| No interface contracts | No TypeScript interfaces define IPC message shapes between main/renderer | HIGH |
| Mixed module systems | CommonJS `require()` in main process, ESM `import` in renderer — fragile boundaries | MEDIUM |
| No IPC validation | Renderer can send arbitrary payloads to main process handlers | HIGH |
| No error boundaries | No React error boundaries in component tree | MEDIUM |
| No service health checks | Services silently fail — no liveness/readiness probes | MEDIUM |

---

## 5. Top 20 Refactors by ROI

Ordered by impact-to-effort ratio.

### Tier 1: Quick Wins (High Impact, Low Effort)

| # | Refactor | Severity | Effort | Impact |
|---|----------|----------|--------|--------|
| 1 | **Delete all `.js` duplicate files** | LOW | 1-2 hrs | Eliminates ~2,790 dead lines; removes import ambiguity |
| 2 | **Add TypeScript strict mode** | MEDIUM | 2-4 hrs | Catches type bugs at compile time; improves IDE support |
| 3 | **Add input validation to all IPC handlers** | HIGH | 4-6 hrs | Prevents renderer from crashing main process with bad payloads |
| 4 | **Create shared types for IPC contracts** | HIGH | 4-8 hrs | Single source of truth for message shapes; enables compile-time checking |
| 5 | **Implement proper CSP headers** | HIGH | 2-4 hrs | Reduces XSS attack surface in renderer |

### Tier 2: High-Impact Structural (High Impact, Medium Effort)

| # | Refactor | Severity | Effort | Impact |
|---|----------|----------|--------|--------|
| 6 | **Split `main.js` into focused handler modules** | CRITICAL | 3-5 days | 9012 lines → ~20 files; enables team parallel work, reduces merge conflicts |
| 7 | **Split `AIChatSidebar.tsx` into composable components** | CRITICAL | 3-5 days | 7131 lines → ~15 components; improves testability and readability |
| 8 | **Create `CommandRegistry` pattern for AI commands** | HIGH | 2-3 days | Replace ad-hoc command handling with register/dispatch pattern |
| 9 | **Extract security modules from Security.ts monolith** | HIGH | 1-2 days | Split into auth, encryption, validation, sanitizer modules |
| 10 | **Implement lazy loading for non-critical services** | MEDIUM | 1-2 days | Faster app startup; services init on-demand |

### Tier 3: Architectural Improvements (Medium Impact, Medium Effort)

| # | Refactor | Severity | Effort | Impact |
|---|----------|----------|--------|--------|
| 11 | **Create proper IPC validation layer** | HIGH | 2-3 days | Schema-validated messages; prevents crashes and injection |
| 12 | **Standardize error handling across credential managers** | MEDIUM | 1 day | Consistent try/catch, logging, and retry patterns |
| 13 | **Add proper dependency injection** | HIGH | 3-5 days | Services receive deps via constructor; enables testing and swapping |
| 14 | **Create service initialization graph** | MEDIUM | 1-2 days | Declare service dependencies; prevent init-order bugs |
| 15 | **Implement service health checks** | MEDIUM | 1-2 days | Liveness probes for long-running services; auto-restart on failure |

### Tier 4: Operational Hardening (Lower Impact, Medium Effort)

| # | Refactor | Severity | Effort | Impact |
|---|----------|----------|--------|--------|
| 16 | **Add comprehensive error boundaries** | MEDIUM | 1-2 days | React error boundaries prevent full UI crash on component failure |
| 17 | **Create audit log rotation** | MEDIUM | 1 day | Prevents unbounded log growth; complies with retention policies |
| 18 | **Add rate limiting to IPC handlers** | MEDIUM | 1-2 days | Prevents renderer from flooding main process |
| 19 | **Implement proper session management** | MEDIUM | 2-3 days | Secure token lifecycle, expiry, refresh |
| 20 | **Add automated security scanning to CI** | MEDIUM | 1 day | Catch vulnerabilities before merge |

---

## 6. Recommended Execution Order

### Phase 1: Cleanup (Week 1)
- Delete all `.js` duplicates (#1)
- Add TypeScript strict mode (#2)
- Audit `appVersion.ts` / `useAppVersion.ts` overlap

### Phase 2: Safety (Week 2)
- Add IPC input validation (#3)
- Create shared IPC types (#4)
- Implement CSP headers (#5)

### Phase 3: Structure (Weeks 3-4)
- Split `main.js` (#6)
- Split `AIChatSidebar.tsx` (#7)
- Create `CommandRegistry` (#8)

### Phase 4: Architecture (Weeks 5-6)
- Extract security modules (#9)
- Add dependency injection (#13)
- Create service init graph (#14)

---

## 7. Metrics Summary

| Metric | Value |
|--------|-------|
| Estimated dead code | ~2,790 lines |
| Critical oversized files | 2 (16,143 lines combined) |
| Duplicate file pairs | 12 |
| Circular dependency risks | 3 |
| Architecture concerns | 7 |
| Recommended refactors | 20 |
| Total estimated effort (all 20) | 30-45 dev days |
| Phased delivery | ~6 weeks |

---

*This report should be re-evaluated after each phase to adjust priorities based on actual findings.*
