# Aartiq™ — For The Questions That Matter

> “The most important question isn't what you ask AI. It's what AI asks you before it acts.”

Aartiq™ is an open-source AI browser that plans tasks, explains non-trivial actions, requests permission when required, and executes through controlled capabilities.

**Plan → Explain → Ask → Execute**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-cyan.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.3.5-blue.svg)](https://github.com/Preet3627/Aartiq/releases/tag/v0.3.5)
[![Downloads](https://img.shields.io/github/downloads/Preet3627/Aartiq/total?color=success&label=Downloads)](https://github.com/Preet3627/Aartiq/releases)
[![Windows](https://img.shields.io/badge/Windows-Supported-blue?logo=windows)](https://github.com/Preet3627/Aartiq/releases/latest)
[![macOS](https://img.shields.io/badge/macOS-Supported-blue?logo=apple)](https://github.com/Preet3627/Aartiq/releases/latest)
[![Linux](https://img.shields.io/badge/Linux-Supported-blue?logo=linux)](https://github.com/Preet3627/Aartiq/releases/latest)
[![Android](https://img.shields.io/badge/Android-Supported-blue?logo=android)](https://github.com/Preet3627/Aartiq/releases/latest)
[![Microsoft Store](https://img.shields.io/badge/Microsoft%20Store-Listed-blue?logo=microsoft)](https://apps.microsoft.com/detail/9nd6wg2rp7cm?hl=en-GB&gl=IN)

<p align="center">
  <img width="1912" height="1168" alt="Aartiq Browser" src="https://github.com/user-attachments/assets/fe9131d4-cfcf-4d3b-aea5-9cc451b4fbd1" />
</p>

---

## Why Aartiq?

Traditional browsers help you navigate the web.

AI assistants help you understand information.

**Aartiq is built for the space between the two: helping AI carry out tasks while keeping the user in control.**

Instead of manually opening tabs, searching websites, filling forms, creating documents, moving files, and repeating workflows, you describe the goal.

Aartiq can turn that goal into structured actions, evaluate those actions against its permission model, request approval when required, and execute through registered capabilities.

> **AI can act. You decide what it is allowed to do.**

---

## See Aartiq in Action

**Prompt:**

> *“Search for today's news, create a PDF summary, move it to my Desktop, and open it.”*

<p align="center">
  <img width="744" height="480" alt="Aartiq task execution demo" src="https://github.com/user-attachments/assets/051f5188-6e20-4b58-8087-74b9dd61b2e2" />
</p>

The workflow:

```text
Understand
    ↓
Plan
    ↓
Explain
    ↓
Ask
    ↓
Execute
    ↓
Result
````

Aartiq searches the web, gathers information, creates the document, requests approval for actions that require it, moves the resulting file, and opens it.

---

## Permission-First AI

Aartiq evaluates each command against its registered capability and permission policy.

Actions that require approval are presented before execution with information about what will happen and what resource or capability is involved.

### Risk-Based Permissions

| Risk         | Typical behavior                                     |
| ------------ | ---------------------------------------------------- |
| **Low**      | Automatic / policy-controlled                        |
| **Medium**   | Explicit approval                                    |
| **High**     | Stronger confirmation                                |
| **Critical** | Explicit authorization; never silently auto-approved |

Risk is assigned to the **capability being invoked**, rather than being inferred solely from the wording of the user's prompt.

For the complete command catalog, risk assignments, approval behavior, and implementation details:

**[AI Command Reference](https://aartiq.ponsrischool.in/docs/ai-commands)**

---

## How It Works

Aartiq converts natural-language goals into structured, permission-aware execution.

```text
┌───────────────────────────┐
│           USER            │
│     Natural-language      │
│           goal            │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│      AI ORCHESTRATOR      │
│ GPT • Claude • Gemini ... │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│      TASK PLANNING        │
│   Structured Commands     │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│   PERMISSION & SECURITY   │
│ Risk • Capability • Scope │
└─────────────┬─────────────┘
              │
              ▼
        ┌──────────────┐
        │   APPROVAL   │
        │   REQUIRED?  │
        └──────┬───────┘
               │
               ▼
┌───────────────────────────┐
│     CONTROLLED EXECUTION  │
│ Browser • Files • OS • OCR│
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│          RESULT           │
└───────────────────────────┘
```

Actions are exposed through registered capabilities rather than allowing the model unrestricted access to arbitrary system primitives.

---

## Security

Aartiq uses a defense-in-depth security model with risk-based permissions, capability controls, directory allowlists, platform-specific sandboxing, encrypted vault storage, and explicit approval for sensitive actions.

The full model — risk levels, defense-in-depth layers, encryption & vault migration, and remote-device security — is documented on the [Security Model page](https://aartiq.ponsrischool.in/docs/security).

> **Verified in CI — and honest about its limits.** These invariants are covered by an automated Jest suite that runs in GitHub Actions on every push and pull request (`.github/workflows/jest.yml`), including a dedicated **21-test** regression file (`aartiq-browser/tests/approval-ticket-security.test.js`) for the approval-ticket and capability-controller system. The newer agent-facing modules add their own coverage: a prompt-injection guard, the fail-closed origin/verb policy, the agent-trust registry, the CRX3 signature verifier, the encrypted autofill vault, accessibility snapshots, and multi-agent tab locking. Authorization decisions are emitted as pure, inspectable `AuthorizationDecision` objects that the executor consumes without re-deriving approval.
>
> What it proves: the security logic we wrote behaves as designed — approval gating, params-hash verification, fail-closed sandboxing, directory allowlists, capability scoping, and the agent tool-gate do not regress. What it does **not** prove: the absence of vulnerabilities. Automated tests guard against known regressions in code we control; they are not a substitute for a formal security audit, adversarial review, or fuzzing, and they cannot account for platform misconfiguration or zero-day attack classes. Treat the test suite as a safety net, not a guarantee.

---

## Agent API & Tool Server

Aartiq exposes its browser capabilities to AI agents through a single, security-enforced tool registry served over two transports:

* **MCP** (Model Context Protocol) for clients such as Claude Desktop, and
* **HTTP** for local scripts, the in-product assistant, and remote access over Tailscale / LAN.

Every tool call — navigation, tab control, form filling, extension management, snapshots, theming, or OS actions — is routed through the `SecurityPipeline` before it runs. The pipeline performs, in order: agent-trust checks (what verbs this agent may use), origin/verb policy enforcement (fail-closed: deny unless explicitly permitted), and, for tools returning web content, a prompt-injection scan that quarantines suspected injected text.

### Multiple agents, one browser

More than one agent can be connected to the same browser at once. Each connection is registered with a trust level that scopes its verbs and origins. A per-tab lock manager ensures two agents cannot drive the same tab concurrently: the first agent to claim a tab holds a lease (with a timeout and explicit handoff) until it releases or is disconnected.

### Accessibility snapshots with stable `@ref` ids

Instead of raw DOM dumps, agents receive an accessibility (AX) tree. Each interactive node carries an identity-bound `@ref` id derived from the page's backend node id, so a reference stays stable across snapshots and is never reused; a stale reference fails loudly rather than acting on the wrong element.

### Form filling

Stored credentials and profiles are kept in an encrypted vault (AES-GCM, passphrase-derived key; the same E2EE2 scheme used elsewhere). A field matcher maps page inputs to stored values by autocomplete token, name, type, and label — without the page ever seeing unrelated entries. Filling requires an explicit user action or approval.

### Chrome extensions

Extensions can be loaded from an on-disk unpacked directory or installed from the Chrome Web Store. Web Store packages are validated as CRX3: the signature is verified with the embedded public key (RSA-SHA256, exactly as Chromium's `sandboxed_unpacker` does) **before** any code is loaded. A package that fails verification, or that requests permissions outside the allowlist, is rejected.

### UI themes and modes

The interface supports selectable themes and UI modes (normal, focus, reader, zen, presentation) that adjust what is shown and how the assistant presents itself, independent of the underlying automation capabilities.

---

## Example Prompts

Try Aartiq with tasks such as:

| Prompt                                                    | Example workflow                              |
| --------------------------------------------------------- | --------------------------------------------- |
| `Search for React tutorials and open the top 3`           | Searches the web and opens relevant results   |
| `Summarize this page and save it as a PDF`                | Reads the page and generates a structured PDF |
| `Set brightness to 50% and open VS Code`                  | Uses supported system capabilities            |
| `Create a PowerPoint about climate change`                | Generates a structured presentation           |
| `Schedule a daily backup at 9 AM`                         | Creates a recurring background task           |
| `Read the text in this screenshot`                        | Uses OCR / visual intelligence                |
| `Fill this form with my details`                          | Identifies and fills supported form fields    |
| `Search for electron performance and extract the results` | Performs browser-based research               |

For every available command and its risk classification:

**[AI Command Reference →](https://aartiq.ponsrischool.in/docs/ai-commands)**

---

## AI Providers

Aartiq supports multiple AI backends, including:

* Google Gemini
* OpenAI GPT
* Anthropic Claude
* Groq
* xAI
* Azure OpenAI
* Ollama (local)
* LM Studio (local, OpenAI-compatible)
* Apple Intelligence on macOS

Provider availability depends on the platform and configuration. Local models (Ollama, LM Studio) keep request content on the device; an OpenClaw-compatible local-agent bridge is also supported for running agent logic without a cloud provider.

---

## Performance

Aartiq opens the Chromium window immediately and loads background services asynchronously, so the interface is usable before every subsystem has finished starting. Long-running automation runs as a separate background process, so it does not block the browser UI, and Ollama support allows capable models to run on-device.

### Benchmark

Measured on a **MacBook Pro M4 Pro**, 12-core CPU, 24 GB RAM, macOS 26.5.

**Benchmark version:** v0.3.4
**Current release:** v0.3.5
**Date:** 2026-07-20

| Metric                        | Result    |
| ----------------------------- | --------- |
| First visible window          | **0.32s** |
| Warm start                    | **0.31s** |
| Idle CPU after initialization | **<1%**   |

> Startup measurements represent time to the first visible window, not complete service initialization. Results vary by hardware, operating system, and configuration.
>first visible window ≠ complete service initialization
Detailed measurements and methodology:

**[Performance Benchmarks →](https://aartiq.ponsrischool.in/docs/overview#performance-benchmarks)**

---

## Installation

### Pre-built Binaries

| Platform              | Format           |
| --------------------- | ---------------- |
| Windows               | `.exe` / `.msix` |
| Windows               | Microsoft Store  |
| macOS — Apple Silicon | `.dmg`           |
| macOS — Intel         | `.dmg`           |
| Linux                 | `.AppImage`      |
| Android               | `.apk`           |

Download the latest release from:

**[Aartiq Releases →](https://github.com/Preet3627/Aartiq/releases)**

### macOS

If macOS blocks the application:

```bash
xattr -cr /Applications/Aartiq.app
```

### Build From Source

```bash
git clone https://github.com/Preet3627/Aartiq.git
cd Aartiq/aartiq-browser

npm install

# Next.js development server
npm run dev

# Electron shell
npm run electron-start
```

### Android

```bash
cd flutter_browser_app

flutter pub get
flutter run
```

---

## Documentation

The GitHub README provides the product overview. Detailed architecture and implementation documentation lives on the Aartiq documentation site.

| Topic                   | Documentation                                                          |
| ----------------------- | ---------------------------------------------------------------------- |
| Overview & Architecture | [Overview](https://aartiq.ponsrischool.in/docs/overview)               |
| Security Model          | [Security](https://aartiq.ponsrischool.in/docs/security)               |
| AI Commands             | [Command Reference](https://aartiq.ponsrischool.in/docs/ai-commands)   |
| API Reference           | [API Reference](https://aartiq.ponsrischool.in/docs/api-reference)     |
| Components              | [Components](https://aartiq.ponsrischool.in/docs/components)           |
| Automation              | [Automation](https://aartiq.ponsrischool.in/docs/automation)           |
| Cloud Sync              | [Cloud Sync](https://aartiq.ponsrischool.in/docs/cloud-sync)           |
| Troubleshooting         | [Troubleshooting](https://aartiq.ponsrischool.in/docs/troubleshooting) |
| Changelog               | [Changelog](https://aartiq.ponsrischool.in/docs/changelog)             |
| v0.3.5 Release Notes    | [Release Notes](release_notes/v0.3.5.md)                               |

---

## Contributors

Built by [Preet3627](https://github.com/Preet3627) with contributions from the community.

<a href="https://github.com/Preet3627/Aartiq/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Preet3627/Aartiq" />
</a>

---

> [!IMPORTANT]
>
> ## 🚧 Project Status
>
> **Aartiq™ is entering an AI-assisted maintenance phase.**
>
> Aartiq began as a small experiment called **Comet-AI**—built around a question about what AI could become.
>
> It started with almost nothing:
>
> **One student.  
> An Intel i5.  
> 8 GB of RAM.  
> Essentially zero-cost tooling.  
> And one question.**
>
> For the first 3–4 months, I built it on that machine while balancing school and JEE preparation—learning, experimenting, breaking things, and rebuilding them.
>
> There was no team, company, or large budget behind it. Just a computer, a lot of code, and a reason to keep building.
>
> Comet-AI eventually became **Aartiq™**—an open-source AI-native browser with permission-gated automation, native OS integrations, MCP support, local AI, synchronization, document generation, and multi-platform releases.
>
> Today, Aartiq is developed on a MacBook Pro with an M4 Pro.
>
> **The hardware changed.  
> The project evolved.  
> The question remained.**
>
> One moment that changed Aartiq philosophy, however, stayed constant:
>
> > **“What happened to my private diary should never happen to a computer system.”**
>
> That belief became part of Aartiq's approach to permission and control: AI can prepare and act, but important actions should not happen silently.
>
> After five months of independently building Aartiq, I am temporarily shifting my primary focus to my studies and upcoming exams.
>
> During this period, AI agents may assist with:
>
> - Reviewing and organizing issues
> - Analyzing bugs
> - Improving documentation
> - Maintaining the codebase
> - Preparing proposed fixes and updates
>
> **AI assistance does not replace human responsibility.** Changes involving security, permissions, user data, releases, or project direction remain subject to human review, approval, and repository safeguards.
>
> **Aartiq isn't abandoned. It's paused.**
>
> Once my exams are complete, I plan to return with a stronger foundation, better ideas, and hopefully people to build it with.
>
> There is a reason this project began with a question.
>
> There is a reason the project is called **Aartiq**.
>
> And there is a reason I still haven't written that original question here.
>
> **Maybe someday I'll tell you what it was.**
>
> Until then:
>
> **Aartiq is just 1 CM away from the future.**
>
> The **“1 CM”** is a personal reminder that respecting a boundary often begins with asking before crossing it.
>
> Thank you for your patience and support. ❤️
>
> — **Preet Patel**
---

## License

Aartiq uses a **dual-license** model:

| Component                                           | License                           |
| --------------------------------------------------- | --------------------------------- |
| **Aartiq Browser** — desktop, mobile, and core code | [Apache License 2.0](LICENSE)     |
| **Aartiq MCP Server** — `aartiq-mcp/`               | [MIT License](aartiq-mcp/LICENSE) |

The MCP server is MIT-licensed for compatibility with Claude Desktop and other MCP clients. All other components remain Apache 2.0.

---

## Trademark

**Aartiq™** is a trademark of Preet Patel (Latestinssan, Preet3627).

The applicable open-source license permits the use, modification, and redistribution of the source code. It does **not** grant permission to use the Aartiq name, logo, trademarks, or visual identity for modified or unofficial distributions.

Modified distributions must be rebranded under a different name and must not present themselves as official Aartiq releases.

---

<p align="center">

### For The Questions That Matter.

**The most important question isn't what you ask AI.
It's what AI asks you before it acts.**

**Plan → Explain → Ask → Execute**

**Aartiq™**

© 2026 Aartiq™. All rights reserved.
