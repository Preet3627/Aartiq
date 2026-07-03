# Action Inventory — All AI-Action Execution Entry Points

Architecture: AI output text → `AICommandParser.prepareCommandsForExecution()` (parsing only) → `AIChatSidebar.processNextCommand()` giant switch (renderer) → `window.electronAPI.xxx()` IPC → main process handlers.

## 1. Command Parsing (Renderer, No Side Effects)

| File | Function | Lines |
|------|----------|-------|
| `src/lib/AICommandParser.ts` | `prepareCommandsForExecution()` | 545-580 |
| `src/lib/AICommandParser.ts` | `parseAICommands()` | 260-468 |
| `src/lib/ActionTagParser.ts` | `parseActionTags()` | Separate parser, NOT called from main execution path |

Both `AICommandParser.ts` and `ActionTagParser.ts` do **parsing only** — they produce structured objects but never execute anything.

## 2. Action Execution (Renderer, AIChatSidebar.tsx)

All command types handled in `processNextCommand()` at `src/components/AIChatSidebar.tsx:1417` via a giant `switch(command.type)`. Each case maps to:

### 2a. No Permission Gate — Executes Immediately

| Command Type | IPC Channel / Action | File:Line | Risk |
|---|---|---|---|
| `WAIT` | In-renderer timeout | :1447 | None |
| `THINK` / `PLAN` | In-renderer UI update | :1454, :1462 | None |
| `NAVIGATE` | `router.push()` or `openTabAndWaitForLoad()` | :1468 | Low |
| `SEARCH` / `WEB_SEARCH` | Browser nav + DOM extraction | :1640 | Low |
| `READ_PAGE_CONTENT` | `window.electronAPI.extractPageContent()` | (via IPC) | Low |
| `SCROLL_TO` | `window.electronAPI.executeJavaScript()` | :1622 | Low |
| `SHELL_COMMAND` | **`window.electronAPI.executeShellCommand()`** | **:2207** | **CRITICAL — NO permission dialog** |
| `OCR_SCREEN` | `window.electronAPI.performOCR()` | (via IPC) | Low |
| `LIST_OPEN_TABS` | In-renderer | Low |
| `GENERATE_PDF` / `CREATE_PDF_JSON` / `CREATE_FILE_JSON` | `window.electronAPI.generatePDF()` / `generatePPTX()` | :2355, :2778 | Low |
| `GENERATE_DIAGRAM` | In-renderer (Mermaid) | Low |
| `LIST_AUTOMATIONS` | `window.electronAPI.getScheduledTasks()` | :2251 | Low |
| `DELETE_AUTOMATION` | `window.electronAPI.deleteScheduledTask()` | :2267 | Low |
| `SCHEDULE_TASK` | Opens scheduling modal (in-renderer) | :2301 | Low |
| `OPEN_SCHEDULING_MODAL` | Opens scheduling modal | Low |
| `OPEN_MCP_SETTINGS` / `OPEN_AUTOMATION_SETTINGS` | Opens settings panel | Low |
| `DOM_SEARCH` / `DOM_READ_FILTERED` | `window.electronAPI.searchDOM()` | Low |
| `ORGANIZE_TABS` / `CLOSE_TAB` | Browser tab management | Low |
| `SET_THEME` | In-renderer state | None |
| `EXPLAIN_CAPABILITIES` | In-renderer | None |
| `ENABLE_CLI` | `window.electronAPI.enableCLI()` | Low |
| `PLUGIN_COMMAND` | `window.electronAPI.plugins.executeCommand()` | Medium |
| `GMAIL_*` | Various `window.electronAPI.gmail*()` | Medium |
| `OPEN_VIEW` | In-renderer `setActiveView()` | None |

### 2b. Has Permission Dialog (`requestActionPermission()`)

| Command Type | IPC Channel | File:Line | Risk |
|---|---|---|---|
| `CLICK_ELEMENT` | `window.electronAPI.clickElement()` | :1483 | Medium — gated |
| `CLICK_AT` | `window.electronAPI.performClick()` | :1517 | Medium — gated |
| `FIND_AND_CLICK` | `window.electronAPI.findAndClickText()` | :1552 | Medium — gated |
| `FILL_FORM` | `window.electronAPI.typeText()` | :1586 | Medium — gated |
| `SET_VOLUME` | `window.electronAPI.setVolume()` | :2167 | Medium — gated |
| `SET_BRIGHTNESS` | `window.electronAPI.setBrightness()` | :2187 | Medium — gated |
| `OPEN_APP` | `window.electronAPI.openExternalApp()` | :2231 | Medium — gated |

## 3. Main Process IPC Handlers (Actual System Execution)

### 3a. command-executor.js — Class-based, constructed in main.js

| IPC Channel | Lines | What It Does | Has Validation? |
|---|---|---|---|
| `shell-execute-command` | :190 | `spawn(command, args, { shell: true })` | **NONE** |
| `shell-open-external` | :142 | `shell.openExternal(url)` | None |
| `shell-open-path` | :150 | `shell.openPath(filePath)` | None |
| `shell-show-item` | :158 | `shell.showItemInFolder()` | None |
| `shell-move-to-trash` | :166 | `shell.trashItem(filePath)` | None |
| `shell-read-file` | :174 | `fs.readFileSync()` | None |
| `shell-write-file` | :182 | `fs.writeFileSync()` | **NONE — arbitrary file write** |
| `robot-execute` | :291 | `robotService.execute()` | None (relies on robotService) |
| `robot-execute-sequence` | :302 | `robotService.executeSequence()` | None |
| `clipboard-*` | :220-248 | Clipboard operations | None needed |
| `dialog-*` | :259-279 | Native dialogs | None needed |
| `window-*` | :97-131 | Window management | None needed |
| `store-*` | :354-381 | Key-value store ops | None needed |
| `network-*` | :334-343 | Network config | None needed |

### 3b. system-handlers.js (registered in main.js)

| IPC Channel | Lines | What It Does | Has Validation? |
|---|---|---|---|
| `execute-shell-command` | :10 | → `utils.execShellCommand()` — runs `exec()` | Partial (`validateCommand` in utils.js checks dangerous patterns) |
| `open-external-app` | :55 | `shell.openPath()` | None |
| `set-volume` | :61 | `exec("osascript -e 'set volume...'")` | **NONE — raw exec** |
| `set-brightness` | :68 | `exec("brightness...")` | **NONE — raw exec** |
| `set-alarm` | :75 | `exec("osascript -e 'tell application...'")` | **NONE — raw exec** |
| `encrypt-data` | :83 | Uses crypto with PBKDF2 | Uses old scheme |
| `decrypt-data` | :96 | Decrypt with old scheme | Uses old scheme |
| `create-desktop-shortcut` | :107 | Writes `.url` file to desktop | None |
| `biometric-*` | :123-125 | Biometric auth | Proper |
| `search-applications` | :50 | Filesystem scan | None needed |
| `get-extensions` / `toggle-extension` / etc. | :15-48 | Extension management | None needed |

### 3c. shell-executor.js (called from system-handlers.js)

| Function | Lines | What It Does | Has Validation? |
|---|---|---|---|
| `executeShellCommand()` | :4-40 | Parses command, calls `checkShellPermission()`, then `exec()` | **`checkShellPermission()` at command-validator.js:102-108 ALWAYS returns `true`** |

### 3d. command-validator.js

| Function | Lines | What It Does | Bug |
|---|---|---|---|
| `validateCommand()` | :17-54 | Checks forbidden tokens, safe commands list | OK |
| `checkShellPermission()` | :102-108 | Checks permission store for command key | **Line 107: `return true` — no real check** |
| `analyzeCommandRisk()` | :56-75 | Returns risk level string | OK |
| `explainCommand()` | :77-100 | Returns human description | OK |

### 3e. sync-handlers.js (WiFi Sync + Cloud Sync)

| Action | Lines | What It Does | Has Validation? |
|---|---|---|---|
| `desktop-control: shell-command` | :178-182 | `exec(args.command, ...)` | **NONE — remote shell execution from mobile** |
| `desktop-control: shutdown/restart/sleep/lock` | :191-196 | Power actions via QR approval | Has QR approval flow |
| `generate-high-risk-qr` | :40-47 | Generates QR code for approval | OK |

### 3f. bridge-server.js (Flutter WebSocket Bridge)

| Action | Lines | What It Does | Has Validation? |
|---|---|---|---|
| `ai:chat` | | AI chat via bridge | Safe — no shell/action exposure |
| `ocr:click` | | OCR + click | Safe |
| `screen:describe` | | Screen description | Safe |
| `ping` | | Health check | Safe |

## 4. Security Module Status

### Security.ts (`src/lib/Security.ts`)

| Feature | Status | Verified |
|---|---|---|
| `SecureDOMParser.analyze()` | Monitoring-only, no enforcement | Yes |
| `SecureDOMParser.sanitizeHTML()` | Delegates to html-sanitizer.ts | Yes |
| `SecureDOMParser.validateURL()` | Delegates to url-validator.ts | Yes |
| `encrypt()` / `decrypt()` | Delegates to crypto-utils.ts (AES-256-GCM) | Yes |
| `fortress()` | API key masking in AI content | Yes |
| `createCapabilityController()` | **ZERO callers — not wired** | Verified via grep |

### crypto-utils.ts (`src/lib/crypto-utils.ts`)

| Feature | Status | Verified |
|---|---|---|
| `encrypt()` / `decrypt()` | AES-256-GCM + PBKDF2 (600K iterations) | Yes |
| `migrateLegacyBlob()` | Strips `LCL:`/`E2EE:` prefixes only — **does not actually decrypt old format** | Yes — line 124-132 |

### html-sanitizer.ts (`src/lib/html-sanitizer.ts`)

| Feature | Status | Verified |
|---|---|---|
| `sanitizeHTML()` | Uses DOMPurify | Yes |
| Process context | Uses browser DOMPurify — **imported in renderer, but Security.ts runs in both contexts** | Unresolved |

## 5. Legacy `deriveKey` Usage (utils.js)

The old `deriveKey` in `src/main/handlers/utils.js:105-112` uses PBKDF2 with only 100K iterations, SHA-512, and produces a raw key (not a CryptoKey). The IPC handlers `encrypt-data`/`decrypt-data` in system-handlers.js still use this old scheme. This is a **parallel encryption path** that was NOT replaced by the new crypto-utils.ts — it only handles `encrypt-data`/`decrypt-data` IPC channels used by the password vault.

## 6. Direct `executeShellCommand` Callers (Outside AIChatSidebar)

| File | Lines | Context |
|---|---|---|
| `src/components/PresentonStudio.tsx` | 111, 113, 115 | Docker container management |
| `src/components/UnifiedSearch.tsx` | 270, 290 | Shell commands from unified search |
| `src/components/AIFeatureDemo.tsx` | 92, 151, 198 | Demo/feature showcase |

## Risk Summary

1. **CRITICAL**: `shell-execute-command` in command-executor.js:190 — `spawn(command, args, { shell: true })` with zero validation
2. **CRITICAL**: `execute-shell-command` in system-handlers.js → shell-executor.js → `checkShellPermission()` always returns true
3. **CRITICAL**: WiFi Sync `desktop-control: shell-command` in sync-handlers.js:178 — remote shell execution from mobile with no validation
4. **HIGH**: `set-volume`/`set-brightness`/`set-alarm` in system-handlers.js — raw `exec()` with no input sanitization
5. **MEDIUM**: `shell-write-file`/`shell-read-file` in command-executor.js — file operations with no path validation
6. **MEDIUM**: `encrypt-data`/`decrypt-data` in system-handlers.js — still uses old key derivation scheme (100K PBKDF2 vs 600K in crypto-utils.ts)
7. **LOW**: All other IPC handlers execute trusted operations
8. **ZERO**: `createCapabilityController()` — defined but never called
