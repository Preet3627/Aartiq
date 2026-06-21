# Comet-AI Features Overview

## Project Structure

```
Comet-AI/
├── comet-browser/          # Electron Desktop Browser
├── flutter_browser_app/    # Flutter Mobile App
├── release_notes/          # Release documentation
├── Landing_Page/           # Documentation website
│   └── landing-page-v-0.1.0alpha/src/app/docs/
│       ├── ai-commands/       # AI command reference
│       ├── automation/         # Scheduling & automation
│       ├── native-api/         # System APIs
│       ├── plugins/            # Plugin marketplace
│       ├── deep-links/         # URL schemes
│       └── document-generation/ # PDF/PPTX/DOCX
└── skills/                 # AI generation skills
```

---

## Documentation Website

The landing page at [browser.ponsrischool.in](https://browser.ponsrischool.in) provides comprehensive documentation:

### Available Documentation Pages

| Page | Description |
|------|-------------|
| **AI Commands** | Complete guide to JSON commands, bracket format, HTML comments, multi-command chains |
| **Automation** | Background scheduling, cron expressions, task types, service installation |
| **Native API** | System APIs (window management, file system, network, media control) |
| **Plugins** | Plugin marketplace, SDK, manifest format, security verification |
| **Deep Links** | URL schemes (`comet-ai://`), web URLs, route reference, platform support |
| **Document Generation** | PDF templates, PPTX slides, DOCX styles, generation methods |

---

## Desktop Browser (comet-browser)

### Core Components

| Component | File | Description |
|-----------|------|-------------|
| Main Process | `main.js` | Electron main process, IPC handlers, BrowserView management |
| Preload | `preload.js` | Secure bridge between main and renderer |
| AI Chat Sidebar | `src/components/AIChatSidebar.tsx` | AI assistant with command parsing |
| Settings Panel | `src/components/SettingsPanel.tsx` | Unified settings UI |
| Welcome Screen | `src/components/WelcomeScreen.tsx` | Onboarding experience |
| Startup Setup | `src/components/StartupSetupUI.tsx` | 3-step setup wizard |
| App Store | `src/store/useAppStore.ts` | Zustand state management |

### Features

#### AI & Automation
- **AI Command Parser** - Parses JSON commands (CREATE_PDF_JSON, SHELL_COMMAND, etc.)
- **LLM Providers** - Support for Ollama, Gemini, OpenAI, Groq, Anthropic
- **Automation Engine** - Scheduled tasks, cron expressions, task queue
- **Background Service** - Runs scheduled tasks when browser is closed
- **Permission System** - Auto-approve low/mid risk commands

#### Document Generation
- **PDF Generation** - HTML to PDF with custom templates
- **PPTX Generation** - PowerPoint-style presentations via PptxGenJS
- **DOCX Generation** - Word documents via docx library
- **Templates** - Professional, Executive, Dark, Minimalist themes

#### Browser Features
- **BrowserView** - Embedded webviews with custom bounds
- **Tab Management** - Multiple tabs with suspend/resume
- **Ad Blocker** - Built-in ad blocking
- **Proxy/Firewall** - Proxy configuration

#### Desktop Integration
- **OCR** - Tesseract-based screen text recognition
- **Robot Service** - Click, type, keyboard automation
- **Vision AI** - Screen analysis with AI description
- **Shell Commands** - Secure command execution

#### Sync & Connectivity
- **WiFi Sync** - Local network device pairing
- **P2P File Sync** - Direct file transfer between devices
- **Clipboard Sync** - Cross-device clipboard sharing

#### Mobile Control
- **Remote Control** - Control desktop from mobile
- **Automation Page** - View/manage scheduled tasks from mobile
- **PDF Viewer** - View generated PDFs on mobile
- **Remote Settings** - Adjust desktop settings from mobile

---

## Mobile App (flutter_browser_app)

### Pages

| Page | File | Description |
|------|------|-------------|
| Home | `comet_home_page.dart` | Main dashboard |
| AI Chat | `agent_chat_page.dart` | AI assistant with streaming |
| Desktop Control | `desktop_control_page.dart` | Remote desktop control (3 tabs) |
| Connect Desktop | `connect_desktop_page.dart` | QR code pairing |
| Automation | `automation_page.dart` | Scheduled tasks management |
| PDF Viewer | `pdf_viewer_page.dart` | PDF viewing and sharing |
| Remote Settings | `remote_settings_page.dart` | Desktop settings control |

### Features
- WiFi discovery and pairing
- Real-time clipboard sync
- Remote AI chat with streaming
- Desktop shell command execution
- Task scheduling management
- PDF viewing and sharing

---

## Services (Backend)

### Desktop Services (`comet-browser/src/service/`)

| Service | Description |
|---------|-------------|
| `service-main.js` | Background service entry point |
| `tray-manager.js` | System tray icon and menu |
| `scheduler.js` | Cron-based task scheduling |
| `task-queue.js` | Priority queue with retry logic |
| `storage.js` | File management |
| `model-selector.js` | AI model picker |
| `ollama-manager.js` | Ollama integration |
| `notifications.js` | Desktop notifications |
| `mobile-notifier.js` | Mobile push notifications |
| `sleep-handler.js` | Sleep/wake recovery |
| `ipc-service.js` | Browser to Service IPC |
| `pdf-sync.js` | PDF sync server |

---

## Supported Commands

| Command | Description |
|---------|-------------|
| `CREATE_PDF_JSON` | Generate PDF from JSON |
| `CREATE_FILE_JSON` | Generate PDF/PPTX/DOCX |
| `SHELL_COMMAND` | Execute terminal command |
| `NAVIGATE` | Open URL in browser |
| `SET_VOLUME` | Set system volume |
| `OPEN_APP` | Launch application |
| `CLICK_ELEMENT` | Click screen element |
| `FIND_AND_CLICK` | Find text and click |

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| v0.2.7 | 2026-04-04 | Auth hardening, IPC cleanup, memory leak fixes |
| v0.2.6 | 2026-03-30 | Native sign-in, Firebase auth, mobile sync |
| v0.2.5 | 2026-03-26 | Scheduling modal, macOS polish, human-in-loop |
| v0.2.4 | 2026-03-xx | Previous stable release |

---

*Last Updated: 2026-04-05*
