# Aartiq Browser

**Website:** https://aartiq.vercel.app

Aartiq is an AI-native browser that can browse the web, understand your context, automate desktop tasks, and safely interact with your operating system through permission-gated actions.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-cyan.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android-blue)]()
[![Version](https://img.shields.io/badge/Version-0.3.2-blue)]()
[![Downloads](https://img.shields.io/github/downloads/Preet3627/Aartiq/total?color=success&label=Total%20Downloads)](https://github.com/Preet3627/Aartiq/releases)
[![Downloads Latest](https://img.shields.io/github/downloads/Preet3627/Aartiq/v0.3.2/total?color=blue&label=Downloads%20(v0.3.2))](https://github.com/Preet3627/Aartiq/releases/tag/v0.3.2)
[![Microsoft Store](https://img.shields.io/badge/Microsoft%20Store-Download-blue?logo=microsoft)](https://apps.microsoft.com/detail/9nd6wg2rp7cm?hl=en-GB&gl=IN)




<img width="1512" height="1012" alt="image" src="https://github.com/user-attachments/assets/f289221f-4d40-451a-94bc-bf4392f28145" />


## Features

### AI Agent
- Multi-step autonomous task execution via chained commands
- RAG using local vector memory with **cross-session persistence** (opt-in privacy toggle)
- **AI User Preference Auto-Learning** — AI detects and remembers user preferences (response style, language, behavior) with opt-in privacy control
- **SAVE_PREFERENCE** command for AI-driven preference storage
- Hybrid context: browser history + live web search + past conversation RAG
- `<think>` tag parsing for chain-of-thought models
- Agentic control: CLICK, FILL_FORM, SCROLL, COORDINATE interaction
- Multi-format command parsing (JSON, bracket `[CMD]:`, HTML comments)

### Browser
- Chromium-based browsing via Electron BrowserView
- Tab management with groups
- Secure DOM extraction with PII scrubbing
- In-page DOM search
- OCR-based screen reading (Tesseract.js)
- Built-in ad blocker
- **Compact toolbar navigation** — three-dot tools menu for quick access to Passwords, Coding, PDF Tools, Media Studio, and more

### Background Scheduling & Automation
- Natural language scheduling ("schedule PDF at 8am daily")
- Cron expression support
- Background service runs tasks when browser is closed
- Desktop and mobile notifications

### Document Generation
- PDF generation with templates (professional, executive, dark, minimalist)
- Excel (XLSX) and PowerPoint (PPTX) generation
- Mermaid diagram to PDF/PNG conversion
- Charts and watermarks

### Platform Integration
- **macOS**: Updated app icon, Siri Shortcuts native Swift bridge (rebranded to Aartiq), Apple Intelligence bridge, native Swift panels, Raycast extension
- **Windows**: Native title bar controls (minimize/maximize/close), URL scheme, voice control, Microsoft Copilot companion, Power Automate
- **Linux**: GNOME/KDE detection, espeak TTS, desktop notifications

### Mobile App (Flutter)
- WiFi sync with desktop
- Remote desktop control (AI Chat, Shell, Click, Type, Screenshot)
- Push notifications
- PDF viewer
- Automation dashboard

### Security
- Triple-lock architecture: visual sandbox, syntactic firewall, human-in-the-loop
- **Biometric per-session auth** — Touch ID required once per session; subsequent low-risk actions auto-approve
- **Biometric Every Action** — optional stricter mode requiring Touch ID for every low-risk action
- **Batch shell command approval** — multiple consecutive shell commands shown in one modal with per-command toggles
- **Irreversible command warnings** — red/amber banners for destructive commands (rm -rf, dd, mkfs, etc.) before approval
- **AES-256-GCM vault** — encrypted credential storage with native OS keychain backup (macOS/Windows/Linux)
- Prompt injection detection with strike-based banning
- Mobile high-risk approval relay via cloud sync

## Quick Start

```bash
git clone https://github.com/Preet3627/Aartiq.git
cd Aartiq/aartiq-browser
npm install
npm run dev          # Next.js frontend
npm run electron-start  # Electron shell
```

### Mobile (Android)

```bash
cd flutter_browser_app
flutter pub get
flutter run
```

## Installation

See the [releases page](https://github.com/Preet3627/Aartiq/releases) for pre-built binaries:

| Platform | Format |
|----------|--------|
| Windows | .exe / .msix |
| Windows | [Microsoft Store](https://apps.microsoft.com/detail/9nd6wg2rp7cm?hl=en-GB&gl=IN) |
| macOS (ARM64) | .dmg |
| macOS (x64) | .dmg |
| Linux | .AppImage |
| Android | .apk |
| iOS | .ipa (beta) |

If macOS blocks the app, run:
```bash
xattr -cr /Applications/Aartiq.app
```

## Documentation

Full documentation at [Official Site](https://aartiq.vercel.app)

## Development Status

| Platform | Status |
|----------|--------|
| Windows | Stable |
| macOS | Stable |
| Linux | Stable |
| Android | Stable |
| iOS | Beta |

## Architecture

```
Aartiq/
├── aartiq-browser/          # Electron desktop app
│   ├── main.js             # Main process
│   ├── src/
│   │   ├── components/     # React UI components
│   │   ├── lib/            # Core services and utilities
│   │   ├── service/        # Background automation service
│   │   └── types/          # TypeScript definitions
│   └── scripts/            # Build and install scripts
├── flutter_browser_app/    # Flutter mobile app
├── Landing_Page/           # Documentation website (Next.js)
└── docs/                   # Project documentation
```

## AI Providers

| Provider | Type |
|----------|------|
| Google Gemini | Cloud |
| OpenAI GPT | Cloud |
| Azure OpenAI | Cloud |
| Anthropic Claude | Cloud |
| Groq | Cloud |
| xAI Grok | Cloud |
| Ollama | Local |
| Apple Intelligence | Native macOS |

## Claude Desktop MCP Integration

Aartiq exposes 18 browser and OS automation tools via the **Model Context Protocol (MCP)** on port `3001`, enabling Claude Desktop to control the browser and desktop directly.

### Quick Setup (Claude Desktop)

1. Install the bridge package:
   ```bash
   npm install -g mcp-remote@0.1.17
   ```

2. Add this entry to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or the equivalent Windows/Linux path:
   ```json
   {
     "mcpServers": {
       "aartiq": {
         "command": "npx",
         "args": [
           "mcp-remote@0.1.17",
           "http://localhost:3001/sse"
         ]
       }
     }
   }
   ```

3. Restart Claude Desktop. The `🔌` connection indicator should turn green.

4. Alternatively, open Aartiq, go to **Settings → MCP Servers**, and click **Auto-Configure Claude Desktop** — this writes the config above automatically.

### Available Tools

| Tool | Description |
|------|-------------|
| `list_tabs` | List all open browser tabs |
| `switch_tab` | Switch to a specific tab by ID |
| `close_tab` | Close a tab by ID |
| `navigate` | Navigate to a URL in the active tab |
| `get_active_tab_url` | Get the URL of the active tab |
| `read_page` | Extract page text content |
| `click_element` | Click an element by CSS selector |
| `fill_form` | Fill a form field by selector |
| `go_back` | Navigate back |
| `go_forward` | Navigate forward |
| `reload` | Reload the active page |
| `generate_pdf` | Generate a PDF of the current page |
| `search_applications` | Search installed applications |
| `open_external_app` | Open a desktop application |
| `set_volume` | Set system volume (0-100) |
| `set_brightness` | Set screen brightness (0-100) |
| `set_alarm` | Set a system alarm |
| `execute_shell_command` | Execute a shell command (requires approval) |
| `run_applescript` | Run AppleScript (macOS only) |
| `run_powershell` | Run PowerShell (Windows only) |
| `get_active_window` | Get the active window title |
| `web_search` | Search the web (Google, Brave, DuckDuckGo, etc.) |

### Permission Model

Each MCP tool has a **risk level** that determines what approval is required:

| Risk Level | Tools | Auto-Approved | Approval UX |
|------------|-------|---------------|-------------|
| **Low** | `list_tabs`, `navigate`, `read_page`, `web_search`, `set_volume`, etc. | Yes (configurable) | Silent — no popup |
| **Medium** | `click_element`, `fill_form`, `open_external_app` | No | Popup window with Approve/Deny |
| **High** | `execute_shell_command`, `run_applescript`, `run_powershell` | No | Popup window + Touch ID / Windows Hello |

When a medium or high risk tool is called from Claude Desktop:

1. An **Aartiq approval popup** (separate window, not the main browser) appears with the tool name, risk badge, and arguments
2. Click **Approve** or **Deny** — the MCP call either executes or returns a permission error
3. For high risk tools, **biometric authentication** (Touch ID on macOS, Windows Hello on Windows) is also required
4. If auto-approve is enabled in Aartiq's security settings, low risk tools skip the popup entirely
5. Aartiq's security settings (biometric per-session, biometric every-action, device unlock for manual approval) all apply to MCP tool calls from Claude Desktop

### `/mcp` Command

Type `/mcp` in the AI chat to open the MCP Settings panel, where you can configure MCP servers and auto-configure Claude Desktop integration.

The AI also accepts the `OPEN_MCP_SETTINGS` command to navigate to MCP settings programmatically.

## Contributing

PRs are welcome. Please open an issue first to discuss significant changes.

## License

[Apache 2.0](LICENSE) © 2026 Aartiq
