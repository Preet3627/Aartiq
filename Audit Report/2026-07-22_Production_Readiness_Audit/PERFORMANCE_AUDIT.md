# Aartiq Performance Audit

Generated: 2026-07-22

---

## Startup Flame Chart (Text-Based)

```
TIME    PHASE                           NOTES
─────── ─────────────────────────────── ────────────────────────────────────────
  0ms   Process launch
 50ms   Electron app ready              electron-store, path, fs, crypto loaded
100ms   BrowserWindow created           PermissionStore, NetworkSecurityManager,
                                        CapabilityController, CommandExecutor init
150ms   Next.js page load begins        Entire framework + 96 components queued
200ms   preload.js contextBridge setup  801 lines, massive API surface exposed
320ms   First paint                     Window visible but not interactive
340ms   Browser interactive             DOMContentLoaded equivalent
500ms   ├─ AI providers init            OpenAI, Anthropic, Google, Groq, xAI
  1s    │  ├─ Firebase init             Auth, Firestore, Realtime DB
  2s    │  ├─ Sync services init        WiFi, P2P, Cloud sync all start
  3s    │  │  ├─ MCP server start       mcp-browser-server.js + discovery
  4s    │  │  ├─ Voice service start    voice-service.js
  5s    │  │  └─ OCR worker preload     tesseract-service.js + TF.js
─────── ─────────────────────────────── ────────────────────────────────────────
        TOTAL TO FULLY LOADED           ~5 seconds
```

**Critical path**: 320ms to first paint, 5s to fully loaded. The 320ms→5s gap is
dominated by eagerly-initialized services that could be deferred.

---

## Memory Analysis

### main.js (9012 lines) — Single Monolith

All main-process logic lives in one file. This means:

- Every `require()` at the top of main.js executes at startup, regardless of whether
  the feature is used.
- GC pressure from loading entire service graphs before they are needed.
- No ability to garbage-collect unused subsystems after boot.

### Duplicate Service Bundles

| Logical Service          | Duplicate Files                          | Wasted Memory |
|--------------------------|------------------------------------------|---------------|
| WiFi Sync                | `WiFiSyncService.js` + `WiFiSyncService.ts` | ~2x |
| P2P File Transfer        | `P2PFileSyncService.js` + `P2PFileSyncService.ts` | ~2x |
| Cloud Sync               | `CloudSyncService.js` + `CloudSyncService.ts` | ~2x |
| Firebase                 | `FirebaseService.js` + `FirebaseService.ts` | ~2x |

Each duplicate pair likely means both `.js` and `.ts` versions are compiled and
loaded or that the `.ts` source sits alongside a stale `.js` artifact. In either
case, bundler output includes both unless explicitly excluded.

### Heavy Eager Loads

| Module | Est. Size | Notes |
|--------|-----------|-------|
| `tesseract-service.js` | ~8 MB | Tesseract.js + worker threads + WASM |
| TensorFlow.js | ~5 MB | ML feature detection, not core |
| `pdf-lib` + `jsPDF` + `pptxgenjs` | ~3 MB | Three PDF engines loaded eagerly |
| `preload.js` (801 lines) | ~200 KB | contextBridge API surface |
| `electron-store` (multiple) | ~150 KB each | Multiple independent store instances |

**Total avoidable startup memory: ~16 MB**

---

## Renderer Performance

### AIChatSidebar.tsx (7131 lines)

This is the single largest React component in the codebase. At 7131 lines it:

- Cannot benefit from component-level memoization (too coarse).
- Re-renders the entire chat UI on any state change (message list, input, settings
  panel, tool outputs, all in one tree).
- Forces React reconciler to diff thousands of DOM nodes per update.

### Landing Page

`LandingPage.tsx` imports `framer-motion` eagerly. This adds ~40 KB gzipped of
animation library to the initial bundle, even though animations only fire when
specific sections scroll into view.

### Missing Optimizations

| Finding | Count |
|---------|-------|
| React.memo usage | 1 (ClickPermissionModal only) |
| Lazy-loaded components | 0 |
| useMemo/useCallback usage | Minimal across all 96 components |

---

## Code Splitting Recommendations

### Priority 1 — High Impact, Low Effort

| Module | Action | Est. Startup Savings |
|--------|--------|----------------------|
| `tesseract-service.js` | Dynamic `import()` on first OCR request | 8 MB memory, 500ms+ startup |
| `voice-service.js` | Dynamic import on first voice interaction | 200ms+ startup |
| `mcp-browser-server.js` | Defer to `app.whenReady()` after first paint | 300ms+ startup |
| PDF engines (`pdf-lib`, `jsPDF`, `pptxgenjs`) | Dynamic import inside `AdvancedDocumentEngine` | 3 MB memory |

### Priority 2 — High Impact, Medium Effort

| Module | Action | Est. Impact |
|--------|--------|-------------|
| `AIChatSidebar.tsx` | Split into `ChatMessageList`, `ChatInput`, `ChatToolOutput`, `ChatSettings` sub-components | 40-60% fewer re-renders |
| Sync services (WiFi/P2P/Cloud) | Lazy init on first sync request, not at boot | 1-2s startup, ~2 MB memory |
| `preload.js` | Split into `preload-core.js` (navigation, tabs) and `preload-ai.js` (AI, OCR, sync) | Smaller contextBridge surface |
| Landing page framer-motion | Dynamic import or replace with CSS animations | 40 KB bundle reduction |

### Priority 3 — Medium Impact, High Effort

| Module | Action | Est. Impact |
|--------|--------|-------------|
| `main.js` monolith | Split into `main-ai.js`, `main-sync.js`, `main-automation.js`, `main-ipc.js` | Maintainability, enables tree-shaking |
| Duplicate service files | Audit and remove `.js` duplicates or consolidate to single source | Eliminates duplicate code paths |
| AI providers | Lazy init per-provider on first use of that provider | 500ms startup |
| Firebase services | Defer Firestore/auth init until user login | 1s startup, memory |

---

## File-Level Recommendations

### `main.js` (9012 lines)

```
Current:  One 9012-line file handles everything.

Target:   Split by domain:
          main/
            index.js          (entry point, app lifecycle, ~300 lines)
            window.js         (BrowserWindow creation, ~200 lines)
            ipc-handlers.js   (IPC registration, ~800 lines)
            services/
              ai-providers.js
              sync-services.js
              automation.js
              ocr.js
              voice.js
              mcp-server.js
```

Each service file uses `module.exports` with a lazy `init()` pattern instead of
eager top-level initialization.

### `preload.js` (801 lines)

```
Current:  Single preload exposes entire API surface to renderer.

Target:   preload-core.js      (navigation, tabs, bookmarks — ~200 lines)
          preload-ai.js        (AI chat, providers, commands — ~300 lines)
          preload-automation.js (OCR, voice, automation — ~300 lines)
```

Renderer loads only the preload script relevant to the current view. This reduces
contextBridge initialization cost and exposes fewer APIs to the renderer process.

### `AIChatSidebar.tsx` (7131 lines)

```
Current:  Single component owns chat state, message list, input, tool panel,
          settings, provider selection, and streaming logic.

Target:   AIChatSidebar.tsx            (~200 lines, layout + state provider)
          hooks/
            useChatState.ts            (message state, streaming)
            useChatProviders.ts        (AI provider selection)
          components/
            ChatMessageList.tsx         (virtualized message list)
            ChatInput.tsx               (input + attachments)
            ChatToolOutput.tsx          (tool call rendering)
            ChatSettingsPanel.tsx       (settings, provider config)
            ChatStreamingIndicator.tsx  (typing/streaming state)
```

Apply `React.memo` to `ChatMessageList` items and `useMemo` for message
transformations. Consider `react-window` for virtualization if chat history grows
beyond ~50 messages.

### `tesseract-service.js`

```
Current:  import Tesseract from 'tesseract.js' at module top level.

Target:   let worker = null;
          export async function initOCR() {
            if (!worker) {
              const Tesseract = await import('tesseract.js');
              worker = await Tesseract.createWorker('eng');
            }
            return worker;
          }
```

This eliminates ~8 MB from the startup heap and removes worker thread spawning
from the boot path.

### `voice-service.js`

```
Current:  Eagerly imports speech recognition and synthesis libraries.

Target:   Lazy-load on first user interaction with voice features.
          Wrap in a class with init() called on first use, not on import.
```

### `mcp-browser-server.js`

```
Current:  Starts MCP server and begins device discovery at startup.

Target:   Defer server start to app.whenReady() + 2000ms delay, or start
          on first external connection attempt.
```

---

## Target Metrics

| Metric | Current (Est.) | Target | How |
|--------|----------------|--------|-----|
| Time to first paint | ~320ms | <200ms | Defer non-essential preload APIs |
| Time to interactive | ~340ms | <300ms | Lazy load heavy renderer deps |
| Time to fully loaded | ~5s | <1.5s | Code split all Priority 1 services |
| Main process heap at boot | ~35 MB | <20 MB | Lazy imports for Tesseract, TF.js, PDF |
| Main.js line count | 9012 | <1000 per file | Split into domain modules |
| Largest React component | 7131 lines | <500 lines | Decompose AIChatSidebar |
| React.memo count | 1 | 30+ | Add to all list/item components |
| Lazy-loaded components | 0 | 40+ | React.lazy + Suspense for all views |

---

## Implementation Order

1. **Duplicate file cleanup** — Remove `.js`/`.ts` duplicates. Zero risk, immediate
   clarity gain. (1-2 hours)

2. **Lazy-load OCR, voice, MCP** — Dynamic imports in three files. Immediate startup
   improvement. (2-3 hours)

3. **Split `main.js`** — Domain-based extraction. Moderate risk, high maintainability
   gain. (1-2 days)

4. **Split `preload.js`** — Reduces contextBridge surface. Test renderer for missing
   APIs. (4-6 hours)

5. **Decompose `AIChatSidebar.tsx`** — Largest renderer improvement. Extract sub-
   components incrementally. (2-3 days)

6. **Add React.memo/useMemo** — Apply to all extracted components and message
   rendering. (1 day)

7. **Defer Firebase/sync services** — Move to on-login or on-demand init. Test sync
   reliability. (1 day)

8. **Replace framer-motion** — Use CSS transitions on landing page. (Half day)

---

## Risks

- Splitting `main.js` may break IPC channel registration order. Test all IPC
  handlers after refactor.
- Lazy-loading OCR/voice may surface timing bugs where callers assume synchronous
  availability. All call sites must await the dynamic import.
- Splitting `preload.js` requires auditing every renderer-side API call to ensure
  the correct preload script is loaded for that view.
- Decomposing `AIChatSidebar.tsx` risks introducing prop-drilling or state
  coordination bugs. Use React Context for shared chat state.
