# Comet AI Browser - Release Notes

## v0.2.8.2 (2026-04-12) - Stable

### New Features
- **Advanced Document Generation Engine** - Generate PDFs, Excel (XLSX), PowerPoint (PPTX), and Mermaid diagrams programmatically with charts, watermarks, tables, and images
- **Mermaid to PDF Converter** - Convert Mermaid flowcharts, sequence diagrams, and class diagrams to PDF/PNG with SVG rendering
- **Custom Typing Animation Hooks** - `useTypingAnimation` and `useStreamingParser` with multiple cursor styles (block, line, blink, glow)
- **Raycast Extension** - macOS Spotlight alternative integration with 6 commands (chat, browse, ocr, pdf, automation, settings)

### Bug Fixes
- **Google Cloud Sync Sign-In** - Fixed frontend auth-callback listener to properly handle OAuth redirects
- **OCR Collapsible Display** - Fixed using explicit type casting `(msg as any).isOcr`
- **Thinking Indicator** - Fixed to use theme-specific colors from gradient preset
- **Mobile Shell Approval** - Added deep link handler for QR codes (`comet-ai://shell-approve`)

### Improvements
- Updated TypeScript target to ES2020 for better compatibility
- Added AI streaming parser hook for smooth message parsing during streaming

---

## v0.2.8.1 (2026-04-10) - Stable

### Native UI Enhancements
- **9 New Liquid Glass Themes** - graphite, crystal, obsidian, azure, rose, aurora, nebula, liquidGlass, translucent
- **Ultra-Translucent Backgrounds** - 30-50% reduction in background opacity for true translucency
- **Enhanced Spring Animations** - 0.18-0.22s response, 0.5-0.7 damping
- **Specular Highlight Overlays** - Multi-layer gradients for depth
- **AICommandParser Robustness** - Multiple JSON parsing patterns with regex fallbacks

---

## v0.2.8 (2026-04-08) - Alpha

### TypeScript Compilation Fixes
- **Fixed Security.ts type errors**: Properly typed regex pattern iteration with explicit `RegExp[]` casting
- **Added plugins API to electron.d.ts**: Complete type definitions for all 12 plugin methods
- **Fixed PluginSettings.tsx**: Added proper type mapping and callback annotations
- **Fixed AIChatSidebar.tsx**: Corrected `result.result` property access
- **Fixed AIUtils.ts**: Replaced undefined `data.title` with `title` parameter
- **Regex flag compatibility**: Replaced ES2018 `gs` flags with `[\s\S]*?` pattern

### Build Verification
- `npx tsc --noEmit` now passes with 0 errors
- `npm run predev` compiles successfully

---

## v0.2.7.1 (2026-04-06)

### Authentication Hardening
- **Deep-Link Protocol Intercept**: Re-engineered Electron auth handling to properly catch custom `comet-browser://` deep links using `did-fail-load`
- **Multi-layered Redirect Fixes**: Added Next.js `did-navigate-in-page` fallback and console message intercept from the landing page
- **Landing Page Synchronization**: Updated `browser.ponsrischool.in` authentication signaling with `comet-auth-success` console payload

### Core Stability
- **IPC Handler Cleanup**: Stripped out extensive redundant IPC handlers in `main.js` resolving terminal startup crashes
- **Memory Leak Prevention**: Resolved `MaxListenersExceededWarning` by removing unbound process listeners
- **Automation Service Locks**: Implemented concurrency lock around `initializeAutomationService()`

### Documentation
- Added comprehensive documentation website at `/docs/*`
- New pages: AI Commands, Automation, Native API, Plugins, Deep Links, Document Generation

---

## v0.2.7 (2026-04-04)

### Core Features
- Complete WiFi Sync service implementation
- Mobile desktop control with Shell tab
- Automation page with task management

### Bug Fixes
- Clipboard sync echo prevention
- Download panel proper object handling

---

## v0.2.6 (2026-03-30)

### Native Authentication
- **Native Google Sign-In** via `google_sign_in` package
- **Firebase Auth Integration** for unified identity
- **Secure Token Storage** via Android Keystore / iOS Keychain
- **Cloud Sync Ready** with cross-device features

### Mobile Sync
- **Reliable Mobile Reconnect** with `shared_preferences`
- **Auto-Relay for Generated Files** to mobile instantly
- **Firebase Persistence Hygiene** cleanup routines

### Document Generation
- **DOCX page config** with proper Header/Footer blocks
- **JSON command parser** accepts `commands` and infers `pptx` from `slides`
- **Inline images** within analysis content
- **Watermark fixes** on thumbnails

---

## v0.2.5 (2026-03-26)

### Automation & Scheduling
- **AI scheduling intent detection** for natural language
- **Scheduling modal** with cron presets
- **Mobile push notifications** for task completion
- **PDF sync for mobile** viewing
- **Automation panel** with Raycast hooks

### macOS Polish
- **Native top menus** (Comet AI, File, Edit, View, Window, Help)
- **SwiftUI translucent AI chat sidebar**
- **Charm-themed setup guide** with theme selection
- **QR verifier modal** for mid-risk commands

### Human-in-the-Loop
- Low/mid-risk commands now show QR verifier modal for self-authorization
- Automation state visible to AI

---

## v0.2.4 (2026-03-20)

### Background Service
- Core automation engine with scheduling
- Task queue with priority and retry logic
- System tray for background service
- Mobile automation dashboard

### Document System
- 5 PDF templates (professional, executive, academic, minimalist, dark)
- Screenshot embedding in PDFs
- JSON format for AI commands
- Ollama integration for local AI

### Notifications
- Desktop notifications
- Mobile push notifications
- Task completion alerts

---

## v0.2.3 (2026-03-15)

### WiFi Sync
- Mobile-desktop pairing via QR code
- Desktop control from mobile (AI Chat, Shell, Control tabs)
- Shell command approval via QR
- PDF viewer on mobile
- Automation dashboard on mobile

### Clipboard Sync
- Real-time clipboard sharing
- Echo prevention with `_lastReceivedClipboard`

---

## v0.2.2 (2026-03-10)

### Permission System
- Permission settings panel
- Auto-run toggles for low/mid risk commands
- Command risk categorization
- `isAutoExecutable()` method

### Downloads
- Fixed download panel crash
- Proper `{name, path}` objects for downloads

---

## v0.2.1 (2026-03-05)

### AI Agent
- Multi-step autonomous task execution
- RAG with local vector memory
- Thinking transparency with `ThinkingPanel`
- `<think>` tag parsing for chain-of-thought

### Commands
- `[EXPLAIN_CAPABILITIES]` real-time demo
- CLICK, FILL_FORM, SCROLL, COORDINATE interaction
- Command deduplication
- Multi-format parsing (JSON, brackets, HTML comments)

---

## v0.2.0 (2026-02-25)

### Core Browser
- Chromium BrowserView engine
- Tab management with groups
- Built-in ad blocker
- Secure DOM extraction

### AI Vision
- OCR-based screen reading (Tesseract.js)
- Screenshot capture with visual analysis
- Robot service for automation

### Security
- Triple-Lock Architecture
- Visual Sandbox, Syntactic Firewall, HITL

---

## v0.1.0 (2026-02-01)

Initial release with core browsing capabilities.