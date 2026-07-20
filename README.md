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

Aartiq is an Electron-based browser with an integrated AI chat sidebar. You describe a task in natural language, an LLM plans the steps, and the browser executes them. Every action is permission-gated before execution.

**How it works:** Aartiq connects to LLM providers (Gemini, GPT, Claude, Groq, xAI, Ollama, Azure OpenAI, Apple Intelligence). You type a task like "search for React tutorials and save the top 3 results as a PDF". The AI returns structured commands (`NAVIGATE`, `CLICK_ELEMENT`, `SHELL_COMMAND`, `SEARCH_WEB`, etc.), Aartiq parses them, shows you a permission dialog for anything non-trivial, and then executes them in the browser.

**What it can do:**

- **Browse the web with AI** — navigate pages, click elements, fill forms, extract text, take screenshots. The AI can search DuckDuckGo/Google, read pages, and follow links without API keys.
- **Run system commands** — launch apps, adjust volume/brightness, set alarms, execute shell commands. Works cross-platform: AppleScript on macOS, PowerShell on Windows, GNOME/KDE on Linux.
- **Generate documents** — convert AI-written Markdown into PDF, Excel (XLSX), or PowerPoint (PPTX) with tables, charts, Mermaid diagrams, and watermarks.
- **Read your screen** — OCR via Tesseract.js for interacting with native desktop apps the AI can't access through the DOM.
- **Schedule tasks** — background task scheduling with natural language or cron expressions that runs even when the browser window is closed.
- **Sync across devices** — WiFi P2P pairing between desktop and Android, plus Firebase E2EE cloud sync.
- **Integrate with Claude Desktop** — MCP server exposing 64 tools for full browser control via Model Context Protocol.
- **Work offline** — connect to Ollama for local LLM inference with no cloud dependency.

For the full feature list, implementation details, and code references, see the [documentation site](https://aartiq.vercel.app/features).

---

## Architecture

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

For the full architecture documentation, component breakdown, and API reference, see [aartiq.vercel.app/docs/overview](https://aartiq.vercel.app/docs/overview).

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

The main subsystems: AI Engine, Command Parser, Security Layer (three-layer defense), MCP Server (64 tools), Document Engine (PDF/XLSX/PPTX), OCR Service (Tesseract.js), Background Scheduler, Native Bridge (macOS/Windows/Linux), Plugin SDK, and Sync Service (WiFi P2P + Firebase E2EE).

See the [components documentation](https://aartiq.vercel.app/docs/components) for a full breakdown with file references and line counts.

---

## Performance Benchmarks

Benchmarks measured on physical hardware using the methodology described below. Results may vary depending on hardware, operating system version, and installed extensions.

All benchmark scripts are included in the repository and can be executed unchanged on supported macOS systems.

### Test Environment

| Spec | Value |
|------|-------|
| **Device** | MacBook Pro (Mac16,8, MX2E3LL/A) |
| **Chip** | Apple M4 Pro — 12 cores (8P + 4E) |
| **RAM** | 24 GB |
| **OS** | macOS 26.5 (Build 25F71) |
| **App Version** | 0.3.4 |
| **Date** | 2026-07-20 |
| **Test Method** | `pkill` cold start → `open -a Aartiq` → `osascript` visible poll (100ms interval) |

### Cold Start (Window Visible)

> Measures the elapsed time from launching the application to the first visible application window. This is **not** a measurement of full renderer initialization, AI service readiness, or feature availability. Aartiq displays the Chromium window immediately while background services (AI providers, MCP bridge, sync, OCR, etc.) continue initializing asynchronously.

| Run | Time to First Visible Window | Main RSS | Total RSS | CPU (at launch) |
|-----|------------------------------|----------|-----------|------------------|
| 1   | **0.32s**                    | 432 MB   | 1,712 MB  | 14.7%            |
| 2   | **0.32s**                    | 432 MB   | —         | —                |
| 3   | **0.32s**                    | 427 MB   | —         | —                |
| **Avg** | **0.32s**                | **430 MB** | **1,712 MB** | **14.7%**    |

### Warm Start (From OS Cache)

| Metric | Value |
|--------|-------|
| Time to First Visible Window | **0.31s** |

### Resource Usage

| Metric | Value | Notes |
|--------|-------|-------|
| Main process RSS | 430–610 MB | Stabilizes higher after tab activity |
| Total RSS (all processes) | 1,712 MB | Electron main, renderer, GPU, utility, and helper processes |
| CPU (immediately after launch) | 14.7% | During initial window creation and first paint |
| CPU (idle after initialization) | < 1% | After background services finish loading |
| Memory (main process, % of 24 GB) | ~1.7% | — |
| Memory (total, % of 24 GB) | ~7.1% | Including all Chromium subprocesses |
| Active ports | 3001 (MCP), 3004 (WiFi sync), 46203 (bridge) | — |
| App bundle size | 1.2 GB | Frameworks: 276 MB, Resources: 958 MB |

### How to Reproduce

```bash
# Kill any running instance
pkill -f "Aartiq" && sleep 4

# Measure cold start (osascript polls window visibility at 100ms)
START=$(python3 -c "import time; print(time.time())")
open -a Aartiq
for i in $(seq 1 40); do
  sleep 0.1
  VISIBLE=$(osascript -e 'tell application "System Events" to tell process "Aartiq" to get visible' 2>/dev/null)
  if [ "$VISIBLE" = "true" ]; then
    END=$(python3 -c "import time; print(time.time())")
    echo "Window visible in: $(python3 -c "print(f'{$END - $START:.2f}')")s"
    break
  fi
done

# Measure memory at steady state
sleep 3
PID=$(pgrep -f "Aartiq.app/Contents/MacOS/Aartiq" | head -1)
ps -p $PID -o rss=,vsz=,%cpu=,%mem=
```

---

## Repository Structure

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