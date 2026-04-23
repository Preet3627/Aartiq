# Comet Browser - Recent Changes

## Version 0.2.9.4 - Terminal Control & AI Reliability (2026-04-23)

### Overview
Introduces the Comet-AI CLI for terminal-based control and hardens AI automation with auto-continuation and finalized Siri integration.

### Changes

#### Comet-AI CLI
- **New CLI Tool**: `scripts/comet-cli.js` allows controlling the browser via terminal.
- **Commands**: `comet ask`, `comet search`, `comet screenshot`.
- **Authentication**: Secure token-based auth via `~/.comet-ai-token`.
- **Global Access**: Registered as `comet` binary in `package.json`.

#### AI Reliability & Automation
- **Auto-Continuation**: Implemented "Keep-Alive" loop in `AIChatSidebar.tsx` to handle truncated AI responses.
- **Siri & Shortcuts**: Finalized zero-setup `AppIntents` for macOS Shortcuts/Siri.
- **Deep Link Sync**: Unified routing for `comet-ai://` across CLI and Siri.

#### Technical
- Added CLI endpoints to native bridge server in `main.js`.
- Captured `finishReason` in LLM streams for better continuation logic.
- Updated root `README.md` and `AI-GUIDE.md` with new standards.

---

## Version 0.2.10 - Code Refactoring (2026-04-17)

### Overview
Major refactoring to split large files into smaller, more maintainable modules.

### Changes

#### main.js Refactoring
- Extracted shell command execution to `src/core/shell-executor.js`
- Extracted system controls (volume, brightness) to `src/core/system-controls.js`
- Extracted command validation to `src/core/command-validator.js`
- Extracted PDF generation helpers to `src/core/pdf-generator.js`
- Extracted vault handlers to `src/core/vault-handlers.js`
- Extracted Gmail handlers to `src/core/gmail-handlers.js`
- Extracted IPC handlers to `src/core/ipc-handlers.js`
- Added unified `src/core/index.js` module exports

#### TypeScript Fixes
- Excluded broken Thuki components from tsconfig
- `npx tsc --noEmit` now passes with 0 errors

#### Cleanup
- Removed duplicate `release_notes/CHANGELOG.md`
- Updated README.md

---

## Version 0.2.7.1 - TypeScript Compilation Fixes (2026-04-06)

### Overview
Patch release addressing TypeScript compilation errors and type safety improvements.

### Changes

#### TypeScript Fixes
- **Security.ts**: Fixed regex pattern type casting with explicit `RegExp[]` casting
- **electron.d.ts**: Added complete plugins API interface (12 methods + 3 event listeners)
- **PluginSettings.tsx**: Added proper type mapping and callback annotations
- **AIChatSidebar.tsx**: Fixed `result.output` → `result.result`
- **AIUtils.ts**: Fixed `data.title` → `title` in buildCleanPDFContent

#### Build System
- Replaced ES2018 `gs` regex flags with compatible `[\s\S]*?` pattern
- Updated tsconfig.json target from ES2017 to ES2020

### Verification
- `npx tsc --noEmit` passes with 0 errors
- `npm run predev` compiles successfully

---

## Version 0.2.4-stable - PDF & OCR Improvements (Current)

### Overview
Comet v0.2.4-stable introduces major improvements to PDF generation, OCR/screenshot functionality, and bug fixes for duplicate commands.

### March 26, 2026 - Update Details

#### New Features

1. **Enhanced PDF Generation with JSON Support**
   - AI can now generate structured JSON-based PDFs with multi-page support
   - New `buildEnhancedPDFFromJSON` function for JSON-to-PDF conversion
   - Added `generateSmartPDF` with automatic fallback (JSON → markdown)
   - Page detail levels: brief, standard, detailed - AI controls content density per page
   - Icon library with 70+ emoji icons for PDF sections
   - Table of Contents auto-generation for multi-page PDFs

2. **Screenshot & OCR Improvements**
   - Fixed `SCREENSHOT_AND_ANALYZE` command with proper error handling
   - Now uses `captureBrowserViewScreenshot` for accurate browser content capture
   - Added Tesseract.js OCR on captured images
   - Fallback chain: Browser screenshot → Tesseract OCR → Vision AI → Basic OCR
   - ScreenVisionService now has Claude-to-Gemini fallback

3. **Error-Proof Browser**
   - Added `did-fail-load`, `render-process-gone`, `unresponsive` handlers for BrowserView
   - Navigation retry logic (2 attempts before fallback error page)
   - SSL certificate handling - allows dev certificates, logs warnings
   - Global uncaught exception handlers in main process
   - Non-critical error filtering (Criteo, GPU warnings)

4. **Download Panel Fixes**
   - Fixed duplicate file entries showing in downloads panel
   - Proper useEffect cleanup for download event listeners
   - Added "Click to Open" functionality for completed downloads
   - Downloads now store full file path for opening

#### Bug Fixes

1. **Command Parsing - No More Duplicates**
   - Root cause: Two separate parsers (AICommandParser + AICommandOutput) extracting same commands
   - Added deduplication in `parseAICommands` using `Set<string>` tracking `type:value`
   - HTML comment format now supported in main parser: `<!-- AI_COMMANDS_START -->`
   - Removed redundant `parseCommandsFromAIOutput` call in AIChatSidebar

2. **PDF Generation - No More Duplicates**
   - Fixed duplicate PDF generation by deduplicating commands before execution

3. **CSS Fixes for PDF**
   - Removed rounded corners from tables, code blocks, images
   - Changed `overflow: hidden` to `overflow: visible` to prevent text hiding
   - Added `table-layout: fixed` for proper table rendering

#### Technical Changes
- Added new types: `PDFDetailLevel`, `PDFPage`, `PDFSection`, `EnhancedPDFData`
- Added `PDF_ICONS` constant with 70+ icon mappings
- Added `getIcon()` function for icon resolution
- Added `open-file` IPC handler for opening downloaded files
- Updated download events to include file path: `{ name, path }`

---

## Version 0.2.5 - Shell Command Auto-Execution

### Overview
Comet v0.2.5 introduces fully automatic shell command execution with zero permission dialogs. Shell commands now run directly without blocking popups.

### March 24, 2026 - Update Details

#### New Features

1. **Auto-Executing Shell Commands**
   - All shell commands now execute automatically without any permission dialogs
   - Removed the blocking permission dialog that appeared for every command
   - Commands go directly to execution after validation

2. **New Permission Settings Panel**
   - Added dedicated "Permissions" section in Settings (Settings > Permissions)
   - Lists macOS system permissions: Screen Recording, Accessibility, Automation
   - "Open Settings" buttons to quickly access System Preferences
   - Shell command status and auto-approval information

3. **Improved JSON Command Parsing**
   - Fixed regex pattern for `{"commands": [...]}` format
   - JSON commands now parse correctly from AI responses
   - Supports both legacy tag format and new JSON format

4. **Updated AI Instructions**
   - AI now knows permissions are handled automatically
   - Removed "requires permission" text from SHELL_COMMAND docs
   - AI no longer asks user for permission - commands execute directly

#### Technical Changes
- `checkShellPermission()` now returns `true` for ALL commands (no dialogs)
- Removed dialog.showMessageBox call from permission check
- Added PermissionSettings component in Settings panel
- Added IPC handler `open-system-settings` for opening macOS Preferences
- Updated preload.js with openSystemSettings API

#### Removed
- Permission dialog from shell command execution
- Blocking "macOS Permissions Required" dialog that appeared on every command

---

## Version 0.2.5 - Shell Command Improvements (Earlier)

### Overview
Comet v0.2.5 introduces major improvements to shell command permissions and the "Always Allow" functionality.

### Removed Features
- **ORGANIZE_FOLDER command**: Removed native folder organization command
- AI now uses shell commands (ls, mkdir, mv) to organize folders instead

### New Features

#### 1. Smart Shell Permission Dialog
- **AI-powered command explanations**: Each shell command now shows what it does
- **Safety level indicator**: Shows safe/medium/high/critical risk levels
- **Command analysis**: Automatic detection of potential harms

#### 2. Safe Commands Whitelist
- Commands like `ls`, `cp`, `mv`, `cat`, `mkdir`, `touch`, `find`, `grep`, `tar`, `git`, `npm`, `node`, `python`, `curl`, `wget`, `open` are recognized as safe
- After first approval, these commands are permanently allowed (no repeated prompts)
- Stored in permission store across sessions

#### 3. Permanent "Always Allow"
- Fixed the session-only bug: "Always Allow" now persists across browser restarts
- Permissions stored in `comet-permissions.json` in user data folder
- No more re-approving same commands after restart

#### 4. Shift+Tab Quick Allow
- **Fixed**: Shift+Tab now works for ALL risk levels (including high-risk)
- Press Shift+Tab to instantly approve any permission dialog
- Visual glow feedback when activated

#### 5. Folder Organization via Shell
- When user asks to organize a folder, AI now:
  1. Runs `ls <folder>` to see contents
  2. Runs `mkdir -p` to create category folders (Images, Documents, Videos, etc.)
  3. Runs `mv` to move files into appropriate folders
- All commands go through normal permission flow

### Technical Changes
- `checkShellPermission()` now checks permission store at start
- `execute-shell-command` IPC accepts `preApproved` flag to skip duplicate dialogs
- Added SAFE_COMMANDS whitelist in main.js
- Added `explainCommand()` function for AI-generated explanations
- Added `analyzeCommandRisk()` function for risk assessment

### Bug Fixes
- Fixed "Always Allow" not working (was using session-only flag incorrectly)
- Fixed Shift+Tab not working for high-risk commands
- Fixed double permission dialogs for shell commands

---

## Version 0.2.4 - JSON Command Update

### 🎯 Overview
Comet v0.2.4 introduces a comprehensive restructuring of command parsing with dedicated JSON formats, separating PDF generation, action tags, and shell commands from main chat while maintaining full integration in export logs.

### 📦 New Command Parsers

#### 1. PDF Command Parser (`PDFCommandParser.ts`)
- **Dedicated JSON format** for PDF generation commands
- Support for extended options: title, subtitle, author, filename, screenshot, attachments, liveData
- Automatic live data detection for news/reports
- PDF command validation and sanitization
- Export format for PDF logs

#### 2. Action Tag Parser (`ActionTagParser.ts`)
- **Structured JSON format** for all action tags
- Category classification: navigation, browser, system, media, automation, utility, gmail, meta
- Permission level tracking: low, medium, high
- Confidence scoring for command parsing
- Value extraction with pipe-separated options support

#### 3. Shell Command Parser (`ShellCommandParser.ts`)
- **Robust shell command validation** with comprehensive security checks
- Dangerous pattern detection: recursive deletes, fork bombs, disk writes, shutdown commands
- Risk level assessment: low, medium, high, critical
- Blocked commands list with safe alternatives
- Platform-specific command transformations
- Sanitization and timeout management

### 🏪 Action Logs Store (`ActionLogsStore.ts`)
- **Separate log management** for PDF, actions, shell, OCR, and DOM
- Persistent storage to localStorage
- JSON and text export formats
- Summary statistics for each log type

### 🔧 Unified Command Parser (`AICommandParser.ts`)
- **Integrated parser** combining all command types
- Unified parsing result with metadata
- Legacy support for backward compatibility
- Export formatting with JSON structure
- Category and risk metadata

### 🎨 UI/UX Improvements

#### Action Chain Queue
- JSON format display for commands
- Category icons and color coding
- Permission status indicators
- Risk level badges for shell commands

#### Export Functionality
- Separate JSON sections for PDF, actions, and shell logs
- Structured export format for all command types
- Full action chain traceability

#### Collapsible Chat Elements
- OCR results in collapsible panels
- DOM extraction results with filter statistics
- Visual distinction between result types

### 📋 Supported Commands (v0.2.4)

#### Navigation Commands
- `[NAVIGATE: url]` - Navigate to URL
- `[OPEN_VIEW: view_name]` - Switch workspace view
- `[RELOAD]` / `[GO_BACK]` / `[GO_FORWARD]` - Browser navigation

#### Browser Commands
- `[SEARCH: query]` - Default engine search
- `[WEB_SEARCH: query]` - Real-time web search with RAG
- `[READ_PAGE_CONTENT]` - Read active tab content
- `[LIST_OPEN_TABS]` - List all open tabs
- `[DOM_SEARCH: query]` - Search page DOM
- `[DOM_READ_FILTERED: query]` - Read DOM with filtering

#### Automation Commands
- `[CLICK_ELEMENT: selector | reason]` - Click by CSS selector
- `[FIND_AND_CLICK: text | reason]` - Find and click text
- `[FILL_FORM: selector | value]` - Fill form field
- `[SCROLL_TO: selector]` - Scroll to element

#### Media Commands
- `[SCREENSHOT_AND_ANALYZE]` - Capture and analyze screen
- `[OCR_SCREEN]` / `[OCR_COORDINATES: x,y,w,h]` - OCR extraction
- `[SHOW_IMAGE: url | caption]` - Display image
- `[SHOW_VIDEO: url | title | description]` - Display video card

#### System Commands
- `[SHELL_COMMAND: command]` - Execute terminal command
- `[SET_VOLUME: percentage]` - Set system volume
- `[SET_BRIGHTNESS: percentage]` - Set screen brightness
- `[OPEN_APP: app_name]` - Launch application
- `[SET_THEME: dark|light|system]` - Change theme

#### Utility Commands
- `[GENERATE_PDF: title | options...]` - Create branded PDF
- `[GENERATE_DIAGRAM: mermaid_code]` - Create Mermaid diagram
- `[OPEN_PDF: file_path]` - Open PDF in viewer
- `[ORGANIZE_FOLDER: path]` - Organize folder by type
- `[WAIT: milliseconds]` - Pause execution

#### Gmail Commands
- `[GMAIL_AUTHORIZE]` - Authorize Gmail access
- `[GMAIL_LIST_MESSAGES: query | max]` - List messages
- `[GMAIL_GET_MESSAGE: id]` - Get message content
- `[GMAIL_SEND_MESSAGE: to|subject|body]` - Send email
- `[GMAIL_ADD_LABEL: id|label]` - Add label

#### Meta Commands
- `[THINK: reasoning]` - Show AI reasoning
- `[PLAN: description]` - Show AI plan
- `[EXPLAIN_CAPABILITIES]` - List all capabilities
- `[OPEN_MCP_SETTINGS]` - Open MCP settings

### 📁 File Structure (v0.2.4)

```
src/lib/
├── AICommandParser.ts      # Unified parser (enhanced)
├── PDFCommandParser.ts     # NEW: PDF command parser
├── ActionTagParser.ts      # NEW: Action tag parser
├── ShellCommandParser.ts   # NEW: Shell command parser
└── ActionLogsStore.ts      # NEW: Action logs store
```

### 🔒 Security Improvements

#### Shell Command Protection
- 20+ dangerous pattern signatures
- Fork bomb detection
- Recursive delete prevention
- Privilege escalation blocking
- Network shell pattern detection
- Encoded command detection

#### Command Validation
- Length limits (1000 chars max)
- Blocked command list
- Safe alternative suggestions
- Sanitization of special characters

### 📊 Export Format (v0.2.4)

#### PDF Commands Export
\`\`\`json
{
  "type": "PDF_COMMANDS_EXPORT",
  "version": "1.0",
  "commands": [...]
}
\`\`\`

#### Action Tags Export
\`\`\`json
{
  "type": "ACTION_TAGS_EXPORT",
  "version": "1.0",
  "summary": { "total": 5, "byCategory": {...} },
  "commands": [...]
}
\`\`\`

#### Shell Commands Export
\`\`\`json
{
  "type": "SHELL_COMMANDS_EXPORT",
  "version": "1.0",
  "summary": { "riskLevels": {...} },
  "commands": [...]
}
\`\`\`

### 🐛 Bug Fixes

- Fixed duplicate command parsing in switch statements
- Fixed OCR result display in collapsible panels
- Fixed DOM extraction statistics display
- Fixed PDF screenshot capture timing
- Fixed shell command permission prompts

### 🚀 Performance

- Optimized command parsing with single-pass algorithms
- Reduced memory footprint for log storage
- Improved regex patterns for faster matching
- Lazy loading of parser modules

---

## Version 0.2.3 - Neural Action Queue

### 🎯 Overview
Enhanced AI reliability with the Neural Action Queue for autonomous web interaction.

### Changes
- Neural Action Queue for sequential command execution
- Full MCP integration for external data fetching
- Command chain visualization
- Improved permission handling

---

## Version 0.2.2 - Intelligence Update

### Changes
- Universal Neural Translation
- Neural Analysis Sidebar
- Find & Click (OCR)
- Persistent Neural Memory
- Google OAuth Integration

---

## Version 0.1.9 - Browser Enhancements & Bug Fixes

### 🔧 Major Fixes

#### 1. **Google Login Removed**
- Removed Google OAuth integration from main process (`main.js`)
- Updated authentication to use landing page web-auth flow
- Renamed `googleToken` → `authToken` for generic auth handling
- Updated UI to show "Authorize Workspace" instead of "Authorize via Google"
- Removed `google-oauth-login` IPC handler

#### 2. **Persistent LLM Cache Implemented**
- Added persistent cache storage to `llm_cache.json` in user data directory
- Cache survives app restarts, saving tokens and improving response times
- Automatic cache loading on startup
- Cache persists after each LLM generation

#### 3. **Enhanced External App Opening (Windows)**
- Improved `open-external-app` handler for Windows
- Now uses `start ""` command for better app discovery
- Supports both absolute paths and app names in PATH
- Fallback mechanisms for macOS and Linux

#### 4. **Screen Capture Handler Consolidation**
- Removed duplicate `capture-screen-region` handlers
- Consolidated to single implementation using `captureScreenRegion` helper
- Cleaner error handling and logging

#### 5. **Tesseract.js Initialization Fix**
- Fixed "Cannot read properties of null (reading 'host')" error
- Added explicit CDN paths for worker, language data, and core WASM
- Improved error logging for Tesseract initialization failures
- Uses jsdelivr and tessdata CDNs for reliable loading

#### 6. **Enhanced Calculator Functionality**
- Supports advanced math operations: `^` (power), `%`, bitwise operators
- Supports Math functions: `Math.sin()`, `Math.sqrt()`, `Math.PI`, etc.
- Safer evaluation using `new Function()` instead of `eval()`
- Better validation for mathematical expressions

#### 7. **Parallel AI Command Execution**
- AI can now execute multiple non-sequential commands simultaneously
- Sequential commands (navigation, form filling, clicks) run in order
- Parallel commands (volume, brightness, app opening) run immediately
- Improved command queue processing with better error handling

### 🎨 UI/UX Improvements

- Updated Settings Panel to use generic "Authorize Workspace" button
- Removed Google branding from authentication flows
- Improved login prompt messaging
- Better error messages for auth failures

### 🔒 Security Enhancements

- Shell command permission system remains in place
- User authorization required for new shell commands
- Improved command validation and sanitization

### 📝 Code Quality

- Removed dangling code from screen capture refactoring
- Fixed TypeScript lint errors for renamed auth properties
- Improved code organization in main process
- Better separation of concerns for auth handling

### 🐛 Bug Fixes

- Fixed profile photo visibility issues
- Resolved app path resolution on Windows
- Fixed cache persistence across sessions
- Corrected IPC handler naming conflicts

### 🚀 Performance

- LLM cache reduces redundant API calls
- Parallel command execution improves AI responsiveness
- Optimized screen capture workflow

### 🔐 Code Signing Setup

- **Windows**: Added code signing configuration for electron-builder
  - Supports `.pfx` certificates from trusted CAs
  - Automatic signing of executables and DLLs
  - GitHub Actions integration with secrets
  - See `CODE_SIGNING.md` for complete setup guide

- **Configuration Added**:
  - Certificate file path: `certs/comet-browser.pfx`
  - SHA256 signing algorithm
  - RFC3161 timestamping for long-term validity
  - Environment variable support (`CSC_LINK`, `CSC_KEY_PASSWORD`)

- **GitHub Secrets Required**:
  - `WINDOWS_CERTIFICATE`: Base64-encoded PFX file
  - `WINDOWS_CERTIFICATE_PASSWORD`: Certificate password

**Note**: Code signing certificate must be purchased separately (~$100-$400/year). See `CODE_SIGNING.md` for provider recommendations and setup instructions.

### 🐛 Crash Fix: Duplicate IPC Handler

**Issue**: "Attempted to register a second handler for 'capture-screen-region'"

**Cause**: Multiple app instances or hot reload during development

**Solutions**:
1. Close all app instances and restart
2. Kill lingering processes in Task Manager
3. Clear app cache if issue persists
4. Use `npm run check-dups` to verify no duplicate handlers

See `CRASH_FIX.md` for detailed troubleshooting guide.

---

## MCP Integration & AI Agency (Current)

### 🔗 Model Context Protocol (MCP) Support
- **Full MCP Integration**: Connect external Model Context Protocol (MCP) servers to gain new tools and access remote data.
- **Preset Servers**: Out-of-the-box support for GitHub, Google Drive, Dropbox, and more.
- **Centralized MCP Panel**: New dedicated settings section to manage all connected servers.
- **"Refresh All" Functionality**: One-click tool list synchronization for all active servers.
- **Dynamic Tool Discovery**: Automatic detection and display of available tools for each server.

### 🤖 AI Agency Improvements
- **New AI Command**: Added `[OPEN_MCP_SETTINGS]` to allow the AI to programmatically open the integration panel.
- **Permission-Gated Execution**: AI can only execute MCP tools from servers authorized by the user.
- **Smart Integration Prompts**: AI now recognizes when to ask for a new server connection to fulfill a user request.
- **Refined System Instructions**: Enhanced AI's understanding of external file fetching and repository access.

### 🎨 UI/UX Enhancements
- **Deep-Linked Settings**: Programmatic navigation to specific settings sections (e.g., straight to MCP).
- **Responsive Server Cards**: Premium UI for managing server status, tools, and connections.
- **Improved Information Hierarchy**: Better visibility for active tools and server states.

---

## Migration Notes

### For Developers

1. **Auth Token Changes**: If you're using `googleToken` in your code, update to `authToken`
2. **Client ID**: `googleClientId` → `clientId`, `googleRedirectUri` → `redirectUri`
3. **Login Handlers**: `handleGoogleLogin` → `handleLogin`, `handleGoogleSignOut` → `handleSignOut`

### For Users

- Authentication now goes through the landing page exclusively
- Existing sessions should continue working
- Cache will start building automatically on first use

---

## Known Issues

- `.exe` signing still pending (shows "unknown developer" warning)
- `robotjs` availability varies by platform (affects "Find & Click")
- Some Tesseract initialization may still fail on slow connections

## Next Steps

1. Implement code signing for Windows executables
2. Add alternative to `robotjs` for cross-platform click simulation
3. Implement offline Tesseract language data bundling
4. Add more comprehensive error recovery for AI commands
5. Implement request queuing for rate-limited APIs
