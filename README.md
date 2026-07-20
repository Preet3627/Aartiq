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

## Table of Contents

- [Why Aartiq?](#why-aartiq)
- [How It Works](#how-it-works)
- [Example Prompts](#example-prompts)
- [Installation](#installation)
- [Performance](#performance)
- [Security](#security)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## Why Aartiq?

Most browsers answer questions. Aartiq **does the work**.

Instead of opening 15 tabs yourself, you tell Aartiq what you need and it executes the steps — navigating pages, clicking elements, running commands, generating documents — then shows you exactly what it did before anything non-trivial runs.

| | Chrome / Edge | Arc / Dia | Aartiq |
|---|---|---|---|
| AI chat | Extensions only | Built-in (answers questions) | Built-in (executes tasks) |
| OS automation | None | None | Shell, apps, volume, brightness, alarms |
| Document generation | None | None | PDF, Excel, PowerPoint from chat |
| Local LLM | No | No | Ollama (fully offline) |
| Permission gating | No | No | Every action requires approval |
| Cross-platform sync | Via Google account | Limited | WiFi P2P + E2EE cloud |
| MCP integration | No | No | 64 tools for Claude Desktop |
| Open source | No | No | Apache 2.0 |

---

## How It Works

1. You type a task in the AI chat sidebar (e.g. "search for Rust tutorials and save the top 3 as a PDF")
2. The LLM returns structured commands (`NAVIGATE`, `CLICK_ELEMENT`, `SHELL_COMMAND`, etc.)
3. Aartiq parses the commands and shows a permission dialog for anything non-trivial
4. You approve, and Aartiq executes the actions in the browser

**Supported providers:** Gemini, GPT, Claude, Groq, xAI, Azure OpenAI, Ollama (offline), Apple Intelligence (macOS).

---

## Example Prompts

Try these after installing:

| Task | What Aartiq does |
|------|------------------|
| `"Search for React tutorials and open the top 3"` | Searches DuckDuckGo, opens results in new tabs |
| `"Summarize this page and save as PDF"` | Reads page content, generates a formatted PDF |
| `"Set brightness to 50% and open VS Code"` | Runs system commands via OS bridge |
| `"Create a PowerPoint about climate change"` | Generates slides with charts from AI-written content |
| `"Schedule a daily backup at 9 AM"` | Creates a cron-based background task |
| `"Read the text in this screenshot"` | OCR via Tesseract.js on screen region |
| `"Fill this form with my details"` | Detects fields, fills them atomically |
| `"Search Google for 'electron performance' and extract results"` | Real browser search, extracts page text |

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

## Performance

Measured on a MacBook Pro M4 Pro (12-core, 24 GB), macOS 26.5:

| Metric | Value |
|--------|-------|
| Cold start (window visible) | **0.32s** |
| Warm start (OS cache) | **0.31s** |
| CPU (idle after init) | **< 1%** |
| Total memory (all processes) | **~1.7 GB** |
| App bundle size | **1.2 GB** |

> Measures time to first visible window, not full initialization. Aartiq displays the Chromium window immediately while AI providers, MCP bridge, sync, and OCR continue loading asynchronously.

For the full benchmark methodology, per-run data, and reproduction scripts, see [Performance Benchmarks](https://aartiq.ponsrischool.in/docs/overview#performance-benchmarks).

---

## Security

Every non-trivial action requires explicit approval before execution:

- **Low risk** (read tabs, navigate, search) — auto-approved based on user preferences
- **Medium risk** (shell commands, file writes, clipboard) — per-action approval dialog
- **High risk** (destructive operations, `rm -rf`, `dd`) — biometric confirmation (Touch ID / Windows Hello)

The MCP server binds to `127.0.0.1` only — no external network exposure. Pairing tokens expire after 10 minutes.

For the full security model, see [Security Documentation](https://aartiq.ponsrischool.in/docs/security).

---

## Documentation

| Topic | Link |
|-------|------|
| Features | [aartiq.ponsrischool.in/features](https://aartiq.ponsrischool.in/features) |
| Architecture | [aartiq.ponsrischool.in/docs/overview](https://aartiq.ponsrischool.in/docs/overview) |
| AI Commands | [aartiq.ponsrischool.in/docs/ai-commands](https://aartiq.ponsrischool.in/docs/ai-commands) |
| Security Model | [aartiq.ponsrischool.in/docs/security](https://aartiq.ponsrischool.in/docs/security) |
| MCP Server (64 tools) | [aartiq.ponsrischool.in/docs/api-reference](https://aartiq.ponsrischool.in/docs/api-reference) |
| Components | [aartiq.ponsrischool.in/docs/components](https://aartiq.ponsrischool.in/docs/components) |
| Automation | [aartiq.ponsrischool.in/docs/automation](https://aartiq.ponsrischool.in/docs/automation) |
| Cloud Sync | [aartiq.ponsrischool.in/docs/cloud-sync](https://aartiq.ponsrischool.in/docs/cloud-sync) |
| Troubleshooting | [aartiq.ponsrischool.in/docs/troubleshooting](https://aartiq.ponsrischool.in/docs/troubleshooting) |
| Changelog | [aartiq.ponsrischool.in/docs/changelog](https://aartiq.ponsrischool.in/docs/changelog) |

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
