Aartiq™ — For the questions that matter

>The most important question isn't what you ask AI. It's what AI asks you before it acts.



Aartiq™ is an open-source AI browser that plans tasks, explains every non-trivial action, asks for permission, and only then executes it.


[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-cyan.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.3.5-blue.svg)](https://github.com/Preet3627/Aartiq/releases/tag/v0.3.5)
[![Downloads](https://img.shields.io/github/downloads/Preet3627/Aartiq/total?color=success&label=Downloads)](https://github.com/Preet3627/Aartiq/releases)
[![Windows](https://img.shields.io/badge/Windows-Passing-blue?logo=windows)](https://github.com/Preet3627/Aartiq/releases/latest)
[![macOS](https://img.shields.io/badge/macOS-Passing-blue?logo=apple)](https://github.com/Preet3627/Aartiq/releases/latest)
[![Linux](https://img.shields.io/badge/Linux-Passing-blue?logo=linux)](https://github.com/Preet3627/Aartiq/releases/latest)
[![Android](https://img.shields.io/badge/Android-Passing-blue?logo=android)](https://github.com/Preet3627/Aartiq/releases/latest)
[![Microsoft Store](https://img.shields.io/badge/Microsoft%20Store-Listed-blue?logo=microsoft)](https://apps.microsoft.com/detail/9nd6wg2rp7cm?hl=en-GB&gl=IN)

<img width="1912" height="1168" alt="Screenshot 2026-07-25 at 2 28 01 PM" src="https://github.com/user-attachments/assets/fe9131d4-cfcf-4d3b-aea5-9cc451b4fbd1" />

---

## Table of Contents

- [Why Aartiq?](#why-aartiq)
- [How It Works](#how-it-works)
- [Example Prompts](#example-prompts)
- [Installation](#installation)
- [Performance](#performance)
- [Security](#security)
- [Documentation](#documentation)
- [Contributors](#contributors)
- [Contributing](#contributing)
- [License](#license)

---


> "Aartiq™ exists because one unasked question taught me that the questions we don't ask matter most."

That idea became the foundation of Aartiq's permission-first design: before any non-trivial action, the AI explains its plan, asks for your approval, and only then executes it.




## Why Aartiq™?

Traditional browsers help you navigate the web. AI chatbots answer questions. Aartiq helps you complete real tasks.
Instead of opening 15 tabs yourself, you tell Aartiq what you need. It plans the steps, explains every non-trivial action, asks for your approval, and only then executes them.

---
## Permission-First AI

Aartiq makes planning, explanation, and user approval part of the action workflow—not an afterthought.

## Permission Workflow

| Plan | Permission | Results |
|:----:|:----------:|:-------:|
| <img src="https://github.com/user-attachments/assets/c55e93c0-fa3c-4ae1-b6ec-e4423b87a9c4" width="250" alt="Plan"> | <img src="https://github.com/user-attachments/assets/e554869b-b156-4538-bf5e-062468752c6c" width="250" alt="Permission"> | <img src="https://github.com/user-attachments/assets/ecdbd0d6-b673-4473-9f54-68d74ddb75c9" width="250" alt="Results"> |

**Plan → Explain → Ask → Execute**

Before accessing files, running shell commands, or performing sensitive actions, Aartiq:

-  Explains exactly what it wants to do
-  Shows the affected files, directories, or commands
-  Waits for your approval
-  Executes only after permission is granted
---
## How It Works

1. You type a task in the AI chat sidebar (e.g. "search for Rust tutorials and save the top 3 as a PDF")
2. The LLM returns structured commands (`NAVIGATE`, `CLICK_ELEMENT`, `SHELL_COMMAND`, etc.)
3. Aartiq parses the commands and shows a permission dialog for anything non-trivial
4. You approve, and Aartiq executes the actions in the browser


   ```text
                   ┌───────────────────────────┐
                   │           USER            │
                   └─────────────┬─────────────┘
                                 │
                                 ▼
                     Natural Language Request
                                 │
                                 ▼
                   ┌───────────────────────────┐
                   │      AI ORCHESTRATOR      │
                   │ GPT • Claude • Gemini ... │
                   └─────────────┬─────────────┘
                                 │
                         Structured Commands
                                 │
                                 ▼
                   ┌───────────────────────────┐
                   │      COMMAND PARSER       │
                   └─────────────┬─────────────┘
                                 │
                                 ▼

          ┌──────────────────────────────────────────────┐
          │      DEFENSE-IN-DEPTH SECURITY (7 Layers)    │
          │                                              │
          │  Regex Blocklist                             │
          │        ↓                                     │
          │  Permission Store                            │
          │        ↓                                     │
          │  Capability Controller                       │
          │        ↓                                     │
          │  Directory Allowlist                         │
          │        ↓                                     │
          │  OS-Level Sandboxing                         │
          │        ↓                                     │
          │  Native File API Bypass                      │
          │        ↓                                     │
          │  Renderer Approval                           │
          └──────────────────┬───────────────────────────┘
                             │
                        Approved?
                       Yes │   │ No
                           ▼   ▼
              ┌────────────────────────────┐
              │ Browser / Desktop / Files  │
              │ OCR / Office / Automation  │
              └─────────────┬──────────────┘
                            ▼
                    ┌──────────────┐
                    │   Results    │
                    └──────────────┘
```
```



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
## See Aartiq in Action

> **Prompt:** *"Search for today's news, create a PDF summary, move it to my Desktop, and open it."*

<p align="center">
  <img width="744" height="480" alt="3" src="https://github.com/user-attachments/assets/051f5188-6e20-4b58-8087-74b9dd61b2e2" />

</p>

Aartiq doesn't just answer questions—it plans the task, explains every non-trivial action, asks for your approval, and then executes it.

**What happens in this demo:**

1.  Searches the web for today's news
2.  Summarizes the results into a formatted PDF
3.  Moves the PDF to the Desktop
4.  Opens the generated document
5.  Shows the completed result

**Plan → Explain → Ask → Execute**


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
- **Critical risk** (remote shell commands, privilege escalation) — always requires explicit approval; never auto-approved

### Defense-in-depth layers

Aartiq enforces security through multiple independent layers:

1. **Regex blocklist** (`SecurityValidator.js`) — fast first-pass reject of obvious dangerous patterns. Cheap to run but bypassable by construction; not relied upon as the primary defense.
2. **Permission store** (`command-validator.js:checkShellPermission`) — risk-tiered permission checks against an explicit grant store. Commands are denied unless a matching grant exists at a sufficient level.<img width="324" height="422" alt="Screenshot 2026-07-25 at 12 02 56 PM" src="https://github.com/user-attachments/assets/5ca82b06-5643-492c-b1df-db36e1db296e" />

3. **Capability controller** (`capability-controller.js`) — ticket-based approval system that prevents param tampering across the IPC trust boundary. Every shell-execution and system-command entry point is routed through registered actions; unregistered actions are rejected outright.
4. **Directory allowlist** (`directory-allowlist.js`) — user-controlled set of directories the AI can access, replacing the single hardcoded sandbox workspace. Paths are canonicalized via `fs.realpath()` before checking (follows symlinks, prevents `../` traversal). Each entry specifies read-only or read-write access. The AI must request permission for directories not on the list.<img width="485" height="710" alt="Screenshot 2026-07-25 at 12 03 12 PM" src="https://github.com/user-attachments/assets/3ba9c577-36a6-4526-9364-8228426b82e4" />

5. **OS-level sandboxing** (`sandbox-executor.js`) — filesystem and network confinement via platform-specific mechanisms (macOS Seatbelt, Linux bubblewrap, Windows Job Objects with ACL-based filesystem restrictions and Windows Firewall network rules). Sandbox profiles are generated dynamically from the directory allowlist — read-only entries get `--ro-bind`/`file-read*`, read-write entries get `--bind`/`file-write*`. The spawned process physically cannot write outside the allowlisted directories.
6. **File management bypass** — `move_file`, `copy_file`, `open_file`, `print_file` route directly through `fs` APIs with `isPathAllowed()` checks on both source and destination. No subprocess spawn for common file operations: faster, more auditable, no shell injection surface.
7. **Renderer-side approval dialog** (`AIChatSidebar.tsx:requestActionPermission`) — user-facing confirmation before command dispatch.

### Encryption & vault migration

- **AES-256-GCM encryption** (E2EE2 format) — PBKDF2 with 600K iterations and per-entry random salt
- **Legacy vault migration** — automatic detection and re-encryption of old LCL (plaintext base64) and E2EE (PBKDF2 100K iterations, no salt) formats to modern E2EE2
- **Atomic vault writes** — backup before migration, rollback on failure

### Remote device security

WiFi Sync commands from paired mobile devices undergo the same validation and permission checks as local commands, with risk levels automatically elevated by one tier (remote origin = elevated risk). Power actions (shutdown, restart, sleep, lock) and shell commands require QR/PIN approval.

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
| v0.3.5 Release Notes | [release_notes/v0.3.5.md](release_notes/v0.3.5.md) |

---

## Contributors

Built by [Preet3627](https://github.com/Preet3627) with contributions from the community — see all [contributors](https://github.com/Preet3627/Aartiq/graphs/contributors).

<a href="https://github.com/Preet3627/Aartiq/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Preet3627/Aartiq" />
</a>

---
> [!IMPORTANT]
> ## 🚧 Project Status
>
> **Aartiq™ is temporarily on hold.**
>
> This project started as a simple experiment called **Comet-AI** — a question about what AI could become. Over time, that question evolved into **Aartiq™**, an AI-native browser built around the idea that AI should not only answer questions, but help execute tasks while keeping humans in control.
>
> After five months of building Aartiq independently, including its AI systems, security architecture, MCP integration, synchronization features, and multi-platform releases, I am taking a temporary pause to focus on my studies and recharge after balancing development with academics.
>
> Development, feature work, and issue responses will be limited until my exams are over.
>
> The repository will remain public, and existing releases will continue to be available. Once Exam is completed, development will resume with new features, improvements, and bug fixes.
>
> **"What happened to my private diary should never happen to a computer system."**
>
> Aartiq was built on one belief:
>
> **"Aartiq exists because one unasked question taught me that the questions we don't ask matter most."**
>
> This is not the end of the journey.
>
> **Aartiq is just 1 CM away from the future.**
>
> “The ‘1 CM’ in Aartiq is a personal reminder that respecting a boundary often begins with asking before crossing it.”
>
> Thank you for your patience and support. ❤️
>
> — Preet Patel


---
## License

Aartiq uses a **dual-license** model:

| Component | License |
|-----------|---------|
| **Aartiq Browser** (desktop, mobile, all core code) | [Apache License 2.0](LICENSE) |
| **Aartiq MCP Server** (`aartiq-mcp/`) | [MIT License](aartiq-mcp/LICENSE) |

The MCP server is MIT-licensed for maximum compatibility with Claude Desktop and other MCP clients. All other components remain Apache 2.0.


"Aartiq™ is a trademark of Preet3627(Latestinssan). While our source code is freely available under the Apache 2.0 License, this license does not grant permission to use the trade name, logos, or branding of Aartiq. Any modified distributions of this browser must be rebranded under a completely different name."


© 2026 Aartiq™. All rights reserved.
