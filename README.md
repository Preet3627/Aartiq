# Aartiq Browser

**Website:** https://aartiq.ponsrischool.in | **Docs:** https://aartiq.ponsrischool.in/docs

Aartiq is an AI-native browser that understands your intent, automates your workflows, and interacts with your operating system — all through natural language, with every action permission-gated before execution.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-cyan.svg)](LICENSE)
[![MCP Server: MIT](https://img.shields.io/badge/MCP_Server-License%3A_MIT-green.svg)](aartiq-mcp/LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android-blue)]()
[![Version](https://img.shields.io/badge/Version-0.3.3-blue)]()
[![Downloads](https://img.shields.io/github/downloads/Preet3627/Aartiq/total?color=success&label=Total%20Downloads)](https://github.com/Preet3627/Aartiq/releases)
[![Microsoft Store](https://img.shields.io/badge/Microsoft%20Store-Download-blue?logo=microsoft)](https://apps.microsoft.com/detail/9nd6wg2rp7cm?hl=en-GB&gl=IN)

<img width="1512" height="1012" alt="image" src="https://github.com/user-attachments/assets/f289221f-4d40-451a-94bc-bf4392f28145" />

---

## What Aartiq Actually Does

### Talk to Your Browser

Aartiq has a built-in AI chat sidebar. You describe what you want in plain language — "find the cheapest flight to Tokyo next week and generate a comparison PDF" — and Aartiq's autonomous agent breaks it into steps, navigates pages, fills forms, extracts data, and produces the document. You watch it happen. Every potentially destructive action pops up an approval dialog first.

The AI supports your own API keys (OpenAI, Anthropic, Google Gemini, Groq, xAI) or runs entirely offline with Ollama. No data leaves your machine unless you choose to use a cloud provider.

### Search the Web Without API Keys

Aartiq's `web_search` tool opens a real browser, performs the search on DuckDuckGo or Google, navigates to the top results, reads their content, and returns structured results with titles, URLs, snippets, and full page text. No API keys. No rate limits. No third-party services.

### Automate Your Desktop

Aartiq can open and control native applications, adjust volume and brightness, set alarms, and execute shell commands — all from the AI chat or via the MCP protocol. On macOS, it bridges to AppleScript and Siri Shortcuts. On Windows, it connects to PowerShell and Windows Hello. On Linux, it integrates with GNOME/KDE and espeak.

### Generate Documents from Chat

Describe a document — "create a quarterly sales report with charts and a dark theme template" — and Aartiq generates a professional PDF, Excel spreadsheet, or PowerPoint presentation. Supports Markdown tables, headings, code blocks, Mermaid diagrams, charts, and watermarks. Files save to your Downloads folder.

---

## Claude Desktop Integration (MCP)

Aartiq exposes 22 tools to Claude Desktop via the **Model Context Protocol** on port `3001`. Claude can control Aartiq's browser, search the web, run system commands, and generate documents — all through the MCP interface.

### Option 1: Desktop Extension (Recommended)

Download and double-click the `.mcpb` file for one-click install — no config editing required:

| | |
|---|---|
| **Download** | [aartiq-mcp-extension.mcpb](https://github.com/Preet3627/Aartiq/releases/latest) |
| **Install** | Double-click the `.mcpb` file, or drag it into Claude Desktop |
| **Requirements** | Aartiq browser running (for browser tools); standalone for system tools |

### Option 2: Manual Configuration

1. Install the bridge package:
   ```bash
   npm install -g mcp-remote@0.1.17
   ```

2. Add this entry to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or the equivalent path on Windows/Linux:
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

3. Restart Claude Desktop. The connection indicator should turn green.

4. Alternatively, open Aartiq, go to **Settings → MCP Servers**, and click **Auto-Configure Claude Desktop** — this writes the config automatically.

### Available MCP Tools

| Tool | Risk | What It Does |
|------|------|-------------|
| `list_tabs` | Low | List all open browser tabs with IDs, titles, and URLs |
| `switch_tab` | Low | Switch to a tab by ID, index, or search term |
| `navigate` | Low | Navigate to a URL (optionally in a new tab) |
| `get_active_tab_url` | Low | Get the current tab's URL |
| `read_page` | Low | Extract the text content of a page |
| `go_back` / `go_forward` | Low | Browser history navigation |
| `reload` | Low | Reload the current page |
| `web_search` | Low | Search DuckDuckGo/Google with real browser navigation |
| `search_and_summarize` | Low | Search, read results, and generate a summary |
| `generate_pdf` | Low | Generate a PDF with Markdown content to Downloads |
| `search_applications` | Low | Find installed apps by name |
| `get_active_window` | Low | Get the frontmost window's process and title |
| `set_volume` | Low | Set system volume (0-100), macOS only |
| `set_brightness` | Low | Set screen brightness (0-1), macOS only |
| `set_alarm` | Low | Create a system reminder at a specific time |
| `click_element` | Medium | Click an element by CSS selector or text |
| `fill_form` | Medium | Fill a form field by CSS selector |
| `open_external_app` | Medium | Launch a native application |
| `close_tab` | Medium | Close a specific tab |
| `execute_shell_command` | **High** | Run a shell command (requires approval + biometric) |
| `run_applescript` | **High** | Run AppleScript on macOS (requires approval + biometric) |
| `run_powershell` | **High** | Run PowerShell on Windows (requires approval + biometric) |

### How Permission Gating Works

Every MCP tool call from Claude Desktop goes through Aartiq's triple-lock security model:

1. **Risk classification** — Each tool is pre-tagged as Low, Medium, or High risk
2. **Approval dialog** — Medium and High risk tools show a popup with the tool name, risk badge, and full argument preview. You click Approve or Deny
3. **Biometric gate** — High risk tools additionally require Touch ID (macOS) or Windows Hello (Windows) before execution

**Configurable security modes:**
- **Biometric per-session** — Touch ID once per session; subsequent low-risk actions auto-approve
- **Biometric every-action** — Touch ID for every single tool call
- **Batch shell approval** — Multiple consecutive shell commands shown in one modal with per-command toggles
- **Irreversible command warnings** — Red banners for destructive commands (`rm -rf`, `dd`, `mkfs`, etc.) before approval

**Destructive file operations** (file deletion, disk writes) are classified as high risk even if the command itself looks safe.

---

## Installation

### Pre-built Binaries

| Platform | Format |
|----------|--------|
| Windows | `.exe` / `.msix` |
| Windows | [Microsoft Store](https://apps.microsoft.com/detail/9nd6wg2rp7cm?hl=en-GB&gl=IN) |
| macOS (Apple Silicon) | `.dmg` |
| macOS (Intel) | `.dmg` |
| Linux | `.AppImage` |
| Android | `.apk` |

Download from the [releases page](https://github.com/Preet3627/Aartiq/releases).

If macOS blocks the app:
```bash
xattr -cr /Applications/Aartiq.app
```

### Build from Source

```bash
git clone https://github.com/Preet3627/Aartiq.git
cd Aartiq/aartiq-browser
npm install
npm run dev              # Start Next.js frontend
npm run electron-start   # Start Electron shell
```

### Mobile (Android)

```bash
cd flutter_browser_app
flutter pub get
flutter run
```

---

## Architecture

```
aartiq-browser/              Electron desktop app
├── main.js                  Main process (~8,300 lines)
├── src/components/          React UI components
├── src/lib/                 Core services
│   ├── AIChatSidebar.tsx        AI chat interface
│   ├── AICommandParser.ts       Parses AI output into executable commands
│   ├── mcp-browser-server.js    MCP server for Claude Desktop
│   ├── Security.ts              Triple-lock security model
│   ├── WiFiSyncService.ts       Desktop ↔ mobile WebSocket sync
│   ├── CloudSyncService.ts      Firebase E2EE cloud sync
│   ├── AdvancedDocumentEngine.ts PDF/XLSX/PPTX generation
│   ├── tesseract-service.js     OCR via Tesseract.js
│   └── plugin-manager.js        Dynamic plugin loading
├── src/service/             Background task scheduler
└── scripts/                 Build scripts, component scanner

flutter_browser_app/         Flutter mobile companion
├── WiFi sync, remote desktop control
├── PDF viewer, push notifications
└── Automation dashboard

Landing_Page/                Documentation website (Next.js)
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
| Ollama | Local (offline) |
| Apple Intelligence | Native macOS |

---

## Platform Integration

- **macOS** — Siri Shortcuts bridge (native Swift), Apple Intelligence integration, native SwiftUI panels, Raycast extension
- **Windows** — Native title bar controls, URL scheme handler, voice control, Microsoft Copilot companion, Power Automate
- **Linux** — GNOME/KDE detection, espeak TTS, desktop notifications, `.desktop` file generation

## Development Status

| Platform | Status |
|----------|--------|
| Windows | Stable |
| macOS | Stable |
| Linux | Stable |
| Android | Stable |
| iOS | Beta |

---

## Contributing

PRs are welcome. Please open an issue first to discuss significant changes.

## License

Aartiq uses a **dual-license** model:

| Component | License | File |
|-----------|---------|------|
| **Aartiq Browser** (desktop, mobile, all core code) | [Apache License 2.0](LICENSE) | [`LICENSE`](LICENSE) |
| **Aartiq MCP Server** (`aartiq-mcp/`) | [MIT License](aartiq-mcp/LICENSE) | [`aartiq-mcp/LICENSE`](aartiq-mcp/LICENSE) |

The MCP server (`aartiq-mcp/`) is licensed under the **MIT License** for maximum compatibility with the Claude Desktop ecosystem and other MCP clients. All other components remain under the **Apache License 2.0**.

© 2026 Aartiq
