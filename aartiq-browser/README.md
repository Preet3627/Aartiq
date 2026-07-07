#  Aartiq Browser (v0.2.8)!      [Made with Love in India](https://madewithlove.org.in/badge.svg)

### Performance Pass (2026-04-09)
- **Action Chain Queue**: Replaced the renderer busy-wait loop with an event-driven queue completion flow, eliminating the `setTimeout(..., 0)` spin that could spike CPU during long action chains
- **Centralized Store Selectors**: Added shared Zustand selectors in `src/store/selectors.ts` so `AIChatSidebar`, `ClientOnlyPage`, and `useOptimizedTabs` no longer subscribe to the full app store
- **Duplicate Approval Listener Cleanup**: Merged repeated shell-approval and high-risk mobile approval listeners into a single path to avoid duplicate prompts and conflicting state updates
- **Native macOS Sync Throttling**: Debounced `updateNativeMacUIState` snapshots so large message/action payloads are not rebuilt and sent on every tiny render
- **Shared AIChatSidebar Helpers**: Centralized queue-settlement and command-signature helpers to reduce repeated inline logic in the action-chain executor

### v0.2.8 Nebula (2026-04-08)
- **Automation Layer**: Cross-platform native automation (macOS/Windows/Linux)
- **Plugin System**: Full plugin SDK with lifecycle management
- **Jest Test Suite**: 79 passing tests with coverage
- **GitHub Actions**: Updated to Node 20, npm ci
- **Secure DOM Parser**: Fast, reliable page analysis + OCR fallback
- **TypeScript Compilation Fixes**: Fixed all TS errors for `npm run dev`
- **Plugin API Types**: Added complete type definitions for plugins interface
- **Regex Compatibility**: Replaced ES2018 flags with compatible patterns
- **AIChatSidebar Modularization**: Split into AIChatSidebar/ subdirectory with types.ts, helpers.ts
- **Core Refactoring**: Extracted network-security.js, window-manager.js, command-executor.js

### v0.2.6 New Features
- **On-Demand Skill Loading**: Document generation skills (PDF/DOCX/PPTX) now load dynamically when needed, reducing AI context size by ~150 lines
- **DMG Build Compatibility**: Skills moved to `public/skills/` folder for .dmg builds, with fallback instructions if files missing
- **Simplified AI Constants**: Removed embedded document instructions from AIConstants.ts, now loaded on-demand
- **P2P & Clipboard Panels**: Added to Flutter mobile settings for sync mode, auto-reconnect, and clipboard history

### v0.2.5 New Features
- **Auto-Executing Shell Commands**: All shell commands now auto-execute without permission dialogs
- **New Permission Settings**: Dedicated Settings > Permissions section for macOS system permissions
- **Fixed JSON Parsing**: Improved `{"commands": [...]}` format parsing
- **Updated AI Instructions**: AI no longer asks for permission, commands execute automatically


<div align="center"><a id="top"></a>

![Aartiq Browser](https://raw.githubusercontent.com/Preet3627/Aartiq/main/icon.ico)

**“Aartiq is one of the open-source AI browsers that enables permission-gated OS automation.”**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-cyan.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android%20%7C%20iOS-blue)]()
[![Version](https://img.shields.io/badge/Version-0.2.98--alpha-blue)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()
![Maintained](https://img.shields.io/badge/Maintained-Yes-green)
![Hardware](https://img.shields.io/badge/Tested_On-i5--8250U_|_8GB-orange)
![Security](https://img.shields.io/badge/Prompt_Injection-Protected-blueviolet)
![MCP](https://img.shields.io/badge/Protocol-MCP_Enabled-cyan)
<div align="center">

[![Built by 16yo](https://img.shields.io/badge/Developer-16_Year_Old_Student-FF69B4?style=for-the-badge&logo=github)](https://github.com/Preet3627)
[![Low Spec Optimized](https://img.shields.io/badge/Optimized-i5--U_|_8GB_RAM-success?style=for-the-badge&logo=cpu-z)](https://github.com/Preet3627/Aartiq)
[![Security Model](https://img.shields.io/badge/Security-Triple--Lock_HITL-blueviolet?style=for-the-badge&logo=shield)](https://github.com/Preet3627/Aartiq)
[![Low-Spec](https://img.shields.io/badge/Low-Spec_i5-U_8GB--green?style=flat&logo=electron)](https://github.com/Preet3627/Aartiq)
[![Microsoft Store](https://img.shields.io/badge/Microsoft%20Store-Download-blue?logo=microsoft)](https://apps.microsoft.com/detail/9nd6wg2rp7cm?hl=en-GB&gl=IN)

</div>

[Features](#-features) • [Download](#-download) • [Quick Start](#-quick-start) • [Development Status](#-development-status) • [Contributing](#-contributing)

</div>

***

Unlike traditional AI browsers that rely only on model guardrails, Comet enforces **architectural isolation**:

- 🔍 Secure DOM Parser + Visual Sandbox  
- 🔥 Syntactic command firewall  
- 🔐 Human-authorized native execution  

Built and optimized on **Intel i5-U | 8GB RAM | No GPU**

---

## 🌌 Why Comet Exists

Modern browsers are built for monetization and cloud dependency.

Comet is built for:

- 🧠 Autonomous browsing agency  
- 🔒 Privacy-first AI usage  
- 💻 OS-level automation with safety  
- ⚡ Low-spec hardware efficiency  

Comet is for developers, researchers, and power users who want programmable browsing — without sacrificing control.

---

## 🤖 Autonomous AI Agent

Comet includes a multimodal browser-level agent.

### Perception System
- **Secure DOM Parser** (Primary) - Fast, reliable structured data extraction with XSS prevention (DOMPurify)
- **DOM Search Display** - Visual element highlighting and metadata
- **OCR Engine** (Fallback) - Multi-tier chain: uniOCR → RustO! → Platform Native → Tesseract.js
- Vision models (Claude / Gemini) for complex visual reasoning

The AI sees **structured DOM data** for speed and reliability, with **OCR fallback** for screenshots, external apps, and visual verification.

### Action Engine

[NAVIGATE: url] [CLICK: text/selector] [TYPE: text | selector] [SCROLL: direction] [EXTRACT_DATA: query] [GENERATE_PDF: title | content] [SCREENSHOT_AND_ANALYZE] [EXEC_DESKTOP: intent] [OPEN_MCP_SETTINGS]

### Agent Capabilities
- Self-correcting navigation loop
- AI reasoning transparency ("Thinking Blocks")
- Workflow recording & replay
- Voice control (Whisper transcription)

---

## 🧠 AI Model Support

Supports latest models via API or local inference:

- OpenAI (GPT series)
- Microsoft Azure OpenAI
- Anthropic (Claude series)
- Google (Gemini series)
- Groq (ultra-fast inference)
- Ollama (local LLM execution)

Hybrid routing:
- ⚡ Groq → speed
- 🧠 Ollama → privacy
- 🏢 Azure OpenAI → Microsoft-managed cloud backend

---

## 🛡️ Triple-Lock Security Architecture

Comet does **not** claim LLM immunity.  
It enforces **system-level isolation.**

### 1️⃣ Secure DOM Parser + OCR Fallback
The agent perceives pages via **structured DOM extraction** with secure parsing (primary).  
OCR provides fallback for screenshots and cross-app text via a multi-tier chain.

**SecureDOMReader** features:
- XSS prevention via DOMPurify (replaced legacy regex sanitization in v0.2.98)
- Structured data extraction (text, links, images, tables)
- DOM search with element highlighting
- URL validation via protocol allowlist (http:, https:, mailto:)

**OCR Fallback Chain** — verified against actual tesseract-service.js runtime order (for external apps, screenshots, visual verification):
1. uniOCR (platform-native, macOS/Windows)
2. RustO! / PaddleOCR (macOS/Linux, 99.3% accuracy)
3. Platform Native (macOS @cherrystudio/mac-system-ocr, Windows native, Linux native)
4. Tesseract.js (universal fallback, with 2 retry attempts)

Prevents:
- Hidden prompt injection
- Script payload attacks
- DOM manipulation exploits
- HTML/JS injection attacks

---

### 2️⃣ Capability-Scoped Execution Model
Actions are gated by an allowlist of registered capabilities, not a regex denylist:

- **Capability Controller**: Only explicitly registered actions can execute — if `run_shell_command` is not registered, no prompt injection can invoke it
- **Syntactic Firewall (Legacy, First Pass)**: Regex-based pattern detection for known dangerous strings (rm -rf, sudo, encoded payloads). This is a warning layer, not an enforcement layer — bypassable patterns are documented
- **DOMPurify HTML Sanitization**: Replaced legacy regex HTML cleaning in v0.2.98 — eliminates years of known regex-bypass techniques
- **Protocol Allowlist URLs**: URL validation uses an allowlist (http:, https:, mailto:) instead of a denylist

Examples acked by the allowlist:

The only actions callable are those explicitly registered via `CapabilityController.registerAction()`

---

### 3️⃣ Human-in-the-Loop Authorization (HITL)

All native desktop actions require:

- 📱 QR-secured mobile handshake  
- 🔐 PIN verification  
- ✍️ Explicit human approval  

The AI generates **Action Intent**, not execution.

Even if socially engineered, it cannot act without approval.

---

### ✅ Security Summary

Comet enforces:

- Non-executable perception  
- Capability-scoped execution (allowlist, not denylist)  
- Human-authorized execution for high-risk actions  

**Encryption**: AES-256-GCM + PBKDF2 (600K iterations). Legacy base64 "encryption" replaced in v0.2.98 — no silent fallback to unauthenticated encoding.

This is **architectural isolation**, not prompt engineering.

---

## ⚡ Performance & Hardware Optimization

Engineered for low-resource environments.

Tested on:

- CPU: Intel i5-U (Ultra-Low Power)
- RAM: 8GB
- Storage: SATA SSD
- GPU: None

### Performance Snapshot

| Metric | Value |
|--------|--------|
| Speedometer 3 | ~12–14 ms |
| Cold Start | < 2 seconds |
| Electron RAM | ~462–500 MB |
| Agent Response | ~3–5s (Claude API) |

Optimization Techniques:

- Controlled renderer isolation  
- Efficient IPC routing  
- Lazy model loading  
- Sandboxed tab processes  

### Performance Work Completed

- Action-chain execution now waits on command completion events instead of spinning the renderer in a zero-delay loop
- Renderer-heavy surfaces use centralized selectors rather than subscribing to the entire Zustand store
- macOS native bridge state sync is batched to reduce repeated serialization during chat streaming
- Duplicate approval listeners were removed so shell/high-risk flows no longer register redundant handlers

Efficient engineering > expensive hardware.

---

## 🏗️ Architecture & Modularization

### Codebase Structure

```
aartiq-browser/src/
├── main.js                    # Main Electron process (orchestrator)
├── preload.js                 # Context bridge (secure IPC)
├── components/
│   ├── AIChatSidebar.tsx      # Main chat UI (4,419 lines)
│   ├── AIChatSidebar/         # Modularized sub-components
│   │   ├── types.ts          # Type definitions
│   │   └── helpers.ts        # Utility functions
│   └── ...
├── store/
│   ├── useAppStore.ts         # Global app state
│   └── selectors.ts           # Centralized performant selectors
├── core/                      # Extracted core modules
│   ├── network-security.js    # Security config
│   ├── window-manager.js      # Window lifecycle
│   └── command-executor.js    # Command handlers
├── automation/               # Cross-platform automation
│   ├── index.js              # Main automation layer
│   ├── mac.js                # macOS native
│   ├── win.js                # Windows native
│   ├── linux.js              # Linux native
│   └── fallback.js           # RobotJS fallback
├── lib/                      # Services & utilities
│   ├── SecureDOMReader.js    # DOM parsing
│   ├── DOMSearchDisplay.js   # Element search
│   ├── plugin-manager.js     # Plugin system
│   └── ...
├── workers/
│   └── task-queue.js         # Background tasks
└── service/                  # Background service
    └── ...                   # 12 service files
```

### Modularization Benefits
- **AIChatSidebar**: Split into `types.ts`, `helpers.ts` for better maintainability
- **Core Modules**: `network-security.js`, `window-manager.js`, `command-executor.js` extracted
- **Automation Layer**: Platform-specific backends with unified interface
- **Plugin System**: Full SDK with lifecycle management

---

## 🔄 Multi-Device Ecosystem

### 📱 Mobile ↔ Desktop Sync

- WiFi QR pairing
- WebSocket bridge
- P2P clipboard sharing
- Session recovery
- Remote task broadcasting

Mobile agent trigger:

> > 



---

## 🍱 Productivity Workspace

- 📄 Autonomous PDF generation  
- 🎞 Presenton Studio (AI slide creation)  
- 🔎 PopSearch (Ctrl+Shift+S)  
- 🧩 Modular extension system  
- 📋 Unified clipboard & history  

---

## 🖥️ Desktop Features

Framework: Electron + Next.js

### Automation Layer (Cross-Platform)
Comet uses **native OS automation** with platform-specific backends:

| Platform | Backend | Features |
|----------|---------|----------|
| **macOS** | `src/automation/mac.js` | AppleScript, native bridges |
| **Windows** | `src/automation/win.js` | PowerShell, Win32 API |
| **Linux** | `src/automation/linux.js` | xdotool, xte, X11 |
| **Fallback** | `src/automation/fallback.js` | nut.js → xa11y → robotjs fallback chain |

### Additional Features
- Secure DOM Parser for fast, reliable page analysis
- OCR fallback with Tesseract.js for cross-app automation
- Raycast integration (macOS)
- MCP Desktop servers (FileSystem / NativeApp)
- Keyboard shortcuts:
  - Shift+Enter → new line
  - Ctrl+Enter → search in new tab
  - Alt+Enter → background tab

---

## 📱 Mobile (Flutter)

- Autonomous Aartiq Agent
- Vision + OCR support
- QR Authorization system
- Production-ready Android build
- iOS in simulator testing phase

---

## 🚀 Development Status

| Platform | Status |
|----------|--------|
| Windows | ✅  Production Ready  |
| macOS | ✅  Production Ready |
| Linux | ✅   Production Ready |
| Android | ✅ Production Ready |
| iOS | 🧪 Testing Phase |

---


## 🚀 Project Status: v0.2.4 "The JSON Command Update"

Comet v0.2.4 introduces a comprehensive restructuring of command parsing with dedicated JSON formats for:
- **PDF Generation**: Structured JSON with options for screenshots, attachments, and live data
- **Action Tags**: Robust JSON parsing with category classification and permission levels
- **Shell Commands**: Comprehensive security validation with risk assessment
- **Export Logs**: Separate JSON logs for PDF, actions, and shell commands displayed in exports

### v0.2.4 Key Changes:
- ✅ Unified command parser integrating PDF, Action, and Shell parsers
- ✅ Robust shell command validation with dangerous pattern detection
- ✅ Separate action logs store for PDF, actions, OCR, and DOM results
- ✅ JSON format support for all command types
- ✅ Collapsible UI for OCR and DOM results in chat
- ✅ Enhanced export functionality with structured JSON logs
- ✅ Action categories: navigation, browser, system, media, automation, utility, gmail, meta

---

## 🌟 Comprehensive Features

### 🧠 Intelligence & RAG System
*   **Universal Neural Translation**: Integrated `free-translate` for unlimited, real-time translations in **all languages**. Respects your selected language settings.
*   **Neural Analysis Sidebar**: A context-aware analyst that "reads" the page with you. Summarize, extract data, or explain complex concepts.
*   **Find & Click (OCR)**: Screen capture + OCR + mouse automation—tell the AI to find and click visible text (e.g., "Submit").
*   **Persistent Neural Memory**: Local embeddings using TensorFlow.js. Your intelligence persists on your local disk.
*   **Google OAuth Integration**: Seamlessly sign in with Google for a personalized experience.
*   **Secure Auth Relay**: Deep-link synchronization using custom protocol handlers (`aartiq-browser://`).
*   **Export Actions**: One-click export of AI chats to PDF or Text.
*   **Centralized MCP Integration**: Connect external services like GitHub, Google Drive, and Dropbox via the Model Context Protocol. AI can now fetch files and repos with user permission.

### 🔐 Security & Privacy
*   **Native Firewall & Ad-Blocker**: Military-grade performance ad and tracker blocking.
*   **Local Password Vault**: AES-256 encrypted local storage for credentials.
*   **Zero Telemetry**: Your data never leaves your machine.
*   **Strict Shell Permissions**: New permission layer prevents unauthorized system commands.

### 🛡️ System Control Requirements
*   **Windows**: Powershell is used for most system controls. For precise volume control, `nircmd` is recommended but not required for basic functionality.
*   **macOS**: AppleScript is used for system automation.

---

## ⌨️ Global Shortcuts

| Shortcut | Action |
|----------|---------|
| `Win/CMD + Shift + Space` | **Spotlight Search** (Search apps, settings, web) |
| `Win/CMD + K` | **Cross-App OCR** (Find and click text anywhere) |
| `Ctrl + / Ctrl -` | **Zoom In / Zoom Out** |

---

## 📦 Download

| Platform | Version | Status | Size |
|----------|---------|--------|------|
| 🪟 **Windows** | [v0.2.0 (.exe)](https://browser.ponsrischool.in/download) | ✅ Stable | ~150 MB |
| 🪟 **Windows (Microsoft Store)** | [v0.2.0](https://apps.microsoft.com/detail/9nd6wg2rp7cm?hl=en-GB&gl=IN) | ✅ Stable | ~150 MB |
| 🍎 **macOS** | Coming soon | 🧪 Beta | – |
| 🐧 **Linux** | Coming soon | 🧪 Beta | – |

---

## 🛠️ Setup Guide

### 1. Prerequisites
*   **Node.js** (v18+)
*   **Ollama** (Optional, for Local AI: [Download](https://ollama.com))
*   **Azure OpenAI** (Optional, for Microsoft-managed cloud AI: Azure API key + `https://YOUR-RESOURCE.openai.azure.com/openai/v1`)
*   **NirCmd** (Optional, for Windows Volume Control: [Download](https://www.nirsoft.net/utils/nircmd.html))

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/Preet3627/Aartiq.git
cd Browser-AI/aartiq-browser
npm install
npm run build
```

### 3. Running in Development
```bash
npm run dev
```

---

## 🆕 v0.2.1 Update Guide

### 1. Restore AI Command Tags
If your AI tags (`websearch`, etc.) stopped working, v0.2.1 automatically migrates your configuration to the new **Neural Action Queue**. No manual steps required.

### 2. Large Model Support (120B)
To use the new `gpt-oss-cloud:120b` or other large models:
1. Open AI Sidebar Settings (Three-dot menu).
2. Go to the **Ollama** section.
3. Use the new **PULL GPT-120B** button.
4. *Recommendation: At least 32GB RAM is required for 120B models.*

### 3. Clear Session & Export
Use the new three-dot menu at the bottom of the chat to:
*   **Clear Session**: Instantly reset neural context.
*   **Export PDF/Text**: Save your research and analysis localy.

---
## 📦 Installation

### Clone Repository

```bash
git clone https://github.com/Preet3627/Aartiq.git
cd Aartiq
npm install

Run Desktop

cd aartiq-browser
npm run dev
npm run electron-start

Run Mobile

cd flutter_browser_app
flutter pub get
flutter run
```

Official documentation & builds:

👉 https://browser.ponsrischool.in
Local Ollama and Other Cloud LLM are suppoeted Natively and A 99% Accurate Ad Blocker

---

🗺️ Roadmap to v1.0

Native Chromium-based core

Fully offline LLM (1.5B–3B params)

Extension marketplace

Multi-agent collaborative workspace

Advanced OS tool permission gating



---

👥 Contributors

Special thanks to:

Otherwise_Wave9374 – Tool permission gating & agent loop refinement


PRs welcome.


---

🧑‍💻 About the Creator

Aartiq Browser is built by a 16-year-old student preparing for JEE.

Primary development machine:

Intel i5-U | 8GB RAM | SATA SSD

Proof that strong architecture beats large budgets.

---


📝 License

Apache License 2.0


---

[⬆ Back to Top](#top)

---


---
