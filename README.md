# Aartiq Browser

An Electron-based browser with an integrated AI chat that executes LLM-planned browser actions, system commands, and document generation — every action is permission-gated before execution.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-cyan.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.3.4-blue.svg)](https://github.com/Preet3627/Aartiq/releases/tag/v0.3.4)
[![Downloads](https://img.shields.io/github/downloads/Preet3627/Aartiq/total?color=success&label=Downloads)](https://github.com/Preet3627/Aartiq/releases)
[![Windows](https://img.shields.io/badge/Windows-Passing-blue?logo=windows)](https://github.com/Preet3627/Aartiq/releases/latest)
[![macOS](https://img.shields.io/badge/macOS-Passing-blue?logo=apple)](https://github.com/Preet3627/Aartiq/releases/latest)
[![Linux](https://img.shields.io/badge/Linux-Passing-blue?logo=linux)](https://github.com/Preet3627/Aartiq/releases/latest)
[![Android](https://img.shields.io/badge/Android-Passing-blue?logo=android)](https://github.com/Preet3627/Aartiq/releases/latest)
[![Microsoft Store](https://img.shields.io/badge/Microsoft%20Store-Listed-blue?logo=microsoft)](https://apps.microsoft.com/detail/9nd6wg2rp7cm?hl=en-GB&gl=IN)

<img width="1512" height="1012" alt="Aartiq Browser" src="https://github.com/user-attachments/assets/f289221f-4d40-451a-94bc-bf4392f28145" />

---

## Overview

Aartiq embeds an AI chat sidebar in a Chromium browser. You describe a task in natural language, an LLM plans the steps, and the browser executes them — navigating pages, clicking elements, filling forms, running shell commands, or generating documents. Before any non-trivial action runs, a permission dialog shows you exactly what will happen.

> **One-sentence summary:** Uses LLMs to plan and execute browser actions, run system commands, and generate documents — with permission gating on every action.

---

## Core Capabilities

| Capability | Description |
|-----------|-------------|
| **AI Chat Sidebar** | Chat with any LLM (OpenAI, Anthropic, Gemini, Groq, xAI, Ollama). The AI returns structured commands (`NAVIGATE`, `CLICK_ELEMENT`, `SHELL_COMMAND`, etc.) that Aartiq parses and executes. |
| **Web Search** | Opens a real browser, searches DuckDuckGo/Google, navigates to top results, extracts page text. No API keys required. |
| **Document Generation** | Converts AI-generated Markdown into PDF, Excel (XLSX), or PowerPoint (PPTX). Supports tables, charts, Mermaid diagrams, watermarks. |
| **Desktop Automation** | Launches applications, adjusts volume/brightness, sets alarms, runs shell commands. macOS: AppleScript + Siri Shortcuts. Windows: PowerShell + Windows Hello. Linux: GNOME/KDE + espeak. |
| **OCR** | Reads text from screen regions via Tesseract.js. Used for interacting with native desktop apps the AI can't access through the DOM. |
| **MCP Server** | Exposes 64 tools to Claude Desktop via Model Context Protocol. Full browser control: AI chat, tabs, bookmarks, history, settings, scheduling, PDF, permissions, security. Every tool call is risk-classified and permission-gated. |

---

## AI Provider Support

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

## Architecture Overview

```
Claude Desktop / User
        │
        ▼
┌─────────────────┐
│   MCP Server    │  64 tools via stdio → HTTP bridge (port 46203)
│   (Node.js)     │  AI, tabs, bookmarks, history, settings,
│                 │  scheduling, permissions, security, PDF
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   HTTP Bridge   │  Cross-platform Express server (port 46203)
│   (main.js)     │  Routes to renderer via IPC or native APIs
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
| **MCP Server** | 64-tool Model Context Protocol server for Claude Desktop integration |
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

aartiq-mcp/                  Claude Desktop MCP server (64 tools)
├── server/index.js          Stdio MCP server (Node.js)
├── server/bridge-client.js  HTTP bridge client (talks to running browser)
├── manifest.json            MCP manifest
└── package.json

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