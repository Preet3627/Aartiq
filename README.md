# Aartiq Browser

An Electron-based browser with a built-in AI chat that executes LLM-planned browser actions, system commands, and document generation — every action is permission-gated before execution.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-cyan.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.3.3-blue.svg)](https://github.com/Preet3627/Aartiq/releases/tag/v0.3.3)
[![Downloads](https://img.shields.io/github/downloads/Preet3627/Aartiq/total?color=success&label=Downloads)](https://github.com/Preet3627/Aartiq/releases)
[![Windows](https://img.shields.io/badge/Windows-Passing-blue?logo=windows)](https://github.com/Preet3627/Aartiq/releases/latest)
[![macOS](https://img.shields.io/badge/macOS-Passing-blue?logo=apple)](https://github.com/Preet3627/Aartiq/releases/latest)
[![Linux](https://img.shields.io/badge/Linux-Passing-blue?logo=linux)](https://github.com/Preet3627/Aartiq/releases/latest)
[![Android](https://img.shields.io/badge/Android-Passing-blue?logo=android)](https://github.com/Preet3627/Aartiq/releases/latest)
[![Microsoft Store](https://img.shields.io/badge/Microsoft%20Store-Listed-blue?logo=microsoft)](https://apps.microsoft.com/detail/9nd6wg2rp7cm?hl=en-GB&gl=IN)
[![Claude MCP](https://img.shields.io/badge/Claude%20Desktop-MCP%20Server-purple)](#claude-desktop-integration-mcp)
[![Claude MCPB](https://img.shields.io/badge/Desktop%20Extension-.mcpb%20One--Click-green)](#option-1-desktop-extension-recommended)

<img width="1512" height="1012" alt="Aartiq Browser" src="https://github.com/user-attachments/assets/f289221f-4d40-451a-94bc-bf4392f28145" />

---

## What It Does

Aartiq embeds an AI chat sidebar in a Chromium browser. You describe a task in natural language, an LLM plans the steps, and the browser executes them — navigating pages, clicking elements, filling forms, running shell commands, or generating documents. Before any non-trivial action runs, a permission dialog shows you exactly what will happen.

### One-Sentence Summary

> Uses LLMs to plan browser actions, run system commands, and generate documents — with permission gating on every action.

### Core Capabilities

| Capability | How It Works |
|-----------|-------------|
| **AI Chat Sidebar** | Chat with any LLM (OpenAI, Anthropic, Gemini, Groq, xAI, Ollama). The AI returns structured commands (`NAVIGATE`, `CLICK_ELEMENT`, `SHELL_COMMAND`, etc.) that Aartiq parses and executes. |
| **Web Search** | Opens a real browser, searches DuckDuckGo/Google, navigates to top results, extracts page text. No API keys required. |
| **Document Generation** | Converts AI-generated Markdown into PDF, Excel (XLSX), or PowerPoint (PPTX). Supports tables, charts, Mermaid diagrams, watermarks. |
| **Desktop Automation** | Launches applications, adjusts volume/brightness, sets alarms, runs shell commands. macOS: AppleScript + Siri Shortcuts. Windows: PowerShell + Windows Hello. Linux: GNOME/KDE + espeak. |
| **OCR** | Reads text from screen regions via Tesseract.js. Used for interacting with native desktop apps the AI can't access through the DOM. |
| **MCP Server** | Exposes 22 tools to Claude Desktop via Model Context Protocol (port 3001). Every tool call is risk-classified and permission-gated. |

### AI Provider Support

| Provider | Connection |
|----------|-----------|
| Google Gemini | Cloud API |
| OpenAI GPT | Cloud API |
| Anthropic Claude | Cloud API |
| Groq | Cloud API |
| xAI Grok | Cloud API |
| Azure OpenAI | Cloud API |
| Ollama | Local (offline) |
| Apple Intelligence | Native macOS |

---

## How It's Different

| Feature | Aartiq | Chrome | Edge |
|---------|--------|--------|------|
| AI chat with structured command execution | Yes | No | Partial (Copilot) |
| Local LLM support (Ollama) | Yes | No | No |
| Permission-gated shell commands | Yes | No | No |
| MCP server for Claude Desktop | Yes | No | No |
| OCR-based desktop app control | Yes | No | No |
| PDF/Excel/PPTX generation from chat | Yes | No | No |
| Cross-platform OS automation | Yes | No | No |
| Open source | Apache 2.0 | No | No |

---

## Under the Hood

```
Claude Desktop / User
        │
        ▼
┌─────────────────┐
│   MCP Server    │  Exposes 22 tools via stdio/HTTP (port 3001)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI Command     │  Parses LLM output into structured commands
│  Parser         │  JSON, bracket [CMD], HTML comment formats
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Permission     │  Triple-lock: risk classification → approval
│  Layer          │  dialog → biometric gate (Touch ID/WinHello)
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│Browser │ │  OS    │  Shell, AppleScript, PowerShell, apps
│Engine  │ │ Bridge │  Volume, brightness, alarms, notifications
└────────┘ └────────┘
```

---

## Claude Desktop Integration (MCP)

Aartiq exposes 22 tools to Claude Desktop via the **Model Context Protocol** on port `3001`.

### Option 1: Desktop Extension (Recommended)

Download and double-click the `.mcpb` file — no config editing required:

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

2. Add this to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or equivalent:
   ```json
   {
     "mcpServers": {
       "aartiq": {
         "command": "npx",
         "args": ["mcp-remote@0.1.17", "http://localhost:3001/sse"]
       }
     }
   }
   ```

3. Restart Claude Desktop. The connection indicator should turn green.

4. Or in Aartiq: **Settings → MCP Servers → Auto-Configure Claude Desktop**.

### MCP Tools

| Tool | Risk | Description |
|------|------|-------------|
| `list_tabs` | Low | List all open browser tabs |
| `switch_tab` | Low | Switch to a tab by ID, index, or search |
| `navigate` | Low | Navigate to a URL |
| `get_active_tab_url` | Low | Get current tab URL |
| `read_page` | Low | Extract page text content |
| `go_back` / `go_forward` | Low | Browser history navigation |
| `reload` | Low | Reload current page |
| `web_search` | Low | Search DuckDuckGo/Google via real browser |
| `search_and_summarize` | Low | Search + read + summarize |
| `generate_pdf` | Low | Generate PDF with Markdown content |
| `search_applications` | Low | Find installed apps by name |
| `get_active_window` | Low | Get frontmost window process/title |
| `set_volume` | Low | Set system volume (0-100), macOS |
| `set_brightness` | Low | Set screen brightness (0-1), macOS |
| `set_alarm` | Low | Create a system reminder |
| `click_element` | Medium | Click element by CSS selector or text |
| `fill_form` | Medium | Fill form field by CSS selector |
| `open_external_app` | Medium | Launch a native application |
| `close_tab` | Medium | Close a specific tab |
| `execute_shell_command` | **High** | Run shell command (approval + biometric) |
| `run_applescript` | **High** | Run AppleScript on macOS |
| `run_powershell` | **High** | Run PowerShell on Windows |

### Permission Gating

Every MCP tool call goes through three layers:

1. **Risk classification** — Tools are tagged Low, Medium, or High
2. **Approval dialog** — Medium/High tools show a popup with tool name, risk badge, and argument preview. Approve or Deny
3. **Biometric gate** — High-risk tools additionally require Touch ID (macOS) or Windows Hello

Configurable modes:
- **Biometric per-session** — Touch ID once per session; low-risk auto-approves after
- **Biometric every-action** — Touch ID for every tool call
- **Batch shell approval** — Multiple shell commands in one modal with per-command toggles
- **Irreversible command warnings** — Red banners for destructive commands (`rm -rf`, `dd`, `mkfs`)
- **File operations as high risk** — File deletion and disk writes classified High regardless of command

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
npm run dev              # Next.js frontend
npm run electron-start   # Electron shell
```

### Mobile (Android)

```bash
cd flutter_browser_app
flutter pub get
flutter run
```

---

## Core Components

| Component | Purpose |
|-----------|---------|
| **AI Engine** | Chat sidebar, LLM provider management, structured command output |
| **Command Parser** | Parses AI output into executable commands (JSON, bracket, HTML comment formats) |
| **Security Layer** | Triple-lock: risk classification, approval dialogs, biometric gating, injection detection |
| **MCP Server** | 22-tool Model Context Protocol server for Claude Desktop integration |
| **Document Engine** | PDF/Excel/PPTX generation with templates, charts, Mermaid diagrams |
| **OCR Service** | Tesseract.js-based screen reading for native app interaction |
| **Background Scheduler** | Natural language and cron-based task scheduling |
| **Native Bridge** | macOS Swift panels + Siri Shortcuts, Windows title bar + PowerShell, Linux desktop integration |
| **Plugin SDK** | Dynamic plugin loading with manifest-based discovery |
| **Sync Service** | WiFi P2P desktop↔mobile sync, Firebase E2EE cloud sync |

---

## Directory Layout

```
aartiq-browser/              Electron desktop app (main process + renderer)
├── src/components/          React UI (126 components, 38K lines)
├── src/lib/                 Core services (AI, MCP, Security, Sync, OCR, Plugins)
├── src/service/             Background task scheduler
└── scripts/                 Build scripts, component scanner

flutter_browser_app/         Flutter mobile companion
├── WiFi sync, remote desktop control
├── PDF viewer, push notifications
└── Automation dashboard

aartiq-mcp/                  Standalone MCP server package
└── server/index.js          Stdio MCP server (Node.js, 21 tools)

Landing_Page/                Documentation website (Next.js)
```

---

## Contributing

PRs are welcome. Please open an issue first to discuss significant changes.

## License

Aartiq uses a **dual-license** model:

| Component | License |
|-----------|---------|
| **Aartiq Browser** (desktop, mobile, all core code) | [Apache License 2.0](LICENSE) |
| **Aartiq MCP Server** (`aartiq-mcp/`) | [MIT License](aartiq-mcp/LICENSE) |

The MCP server is MIT-licensed for maximum compatibility with Claude Desktop and other MCP clients. All other components remain Apache 2.0.

© 2026 Aartiq
