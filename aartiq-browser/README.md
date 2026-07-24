# Aartiq Browser (Desktop)

> **Aartiq — For the questions that matter.**

The Electron desktop application for Aartiq — an AI-native browser with OS automation capabilities.

## Overview

This package contains the desktop browser built with Electron + Next.js. It includes the main process, renderer UI, AI chat sidebar, security layer, MCP bridge, DOM engine v2, and native OS automation backends.

## Quick Start

```bash
# From repository root
cd aartiq-browser
npm install
npm run dev              # Next.js frontend (port 3003)
npm run electron-start   # Electron shell
```

## Project Structure

```
aartiq-browser/
├── main.js                 # Electron main process entry
├── preload.js              # Secure IPC bridge
├── package.json
├── next.config.js
├── src/
│   ├── components/         # React UI (126+ components)
│   │   ├── AIChatSidebar.tsx
│   │   ├── CommandPalette.tsx
│   │   ├── ActionChain.tsx
│   │   └── ...
│   ├── lib/                # Core services
│   │   ├── AICommandParser.ts
│   │   ├── DOMEngine.ts
│   │   ├── Security.ts
│   │   ├── webauthn-service.js     # WebAuthn/FIDO2 native verification
│   │   ├── AdvancedDocumentEngine.ts
│   │   ├── WiFiSyncService.ts
│   │   ├── tesseract-service.js
│   │   └── plugin-manager.js
│   ├── service/            # Background services
│   │   ├── biometric-auth.js        # Cross-platform biometric auth
│   │   ├── windows-hello-auth.js    # Windows Hello WebAuthn
│   │   └── ...
│   ├── store/              # Zustand state + selectors
│   ├── automation/         # Cross-platform OS automation
│   │   ├── mac.js
│   │   ├── win.js
│   │   ├── linux.js
│   │   └── fallback.js
│   └── lib/native-panels/  # SwiftUI panels (macOS)
└── scripts/                # Build & install scripts
```

## Key Services (src/lib/)

| File | Purpose |
|------|---------|
| `Security.ts` / `SecurityValidator.js` | Command validation, risk levels, injection detection |
| `webauthn-service.js` | WebAuthn/FIDO2 native verification (Windows Hello, macOS Touch ID via caBLE) |
| `AIChatSidebar.tsx` | Main AI chat interface |
| `AICommandParser.ts` | Parses AI output into executable commands |
| `DOMEngine.ts` | Centralized DOM interaction engine v2 with cascading fallbacks |
| `skill-loader.js` | On-demand AI skill loading and management |
| `AdvancedDocumentEngine.ts` | PDF/XLSX/PPTX generation |
| `WiFiSyncService.ts` | WebSocket sync desktop↔mobile |
| `P2PFileSyncService.ts` | Peer-to-peer file transfer |
| `CloudSyncService.ts` | Firebase cloud sync |
| `SiriShortcutsIntegration.ts` | macOS Siri/Shortcuts bridge |
| `tesseract-service.js` | OCR via Tesseract.js |
| `plugin-manager.js` | Dynamic plugin loading |
| `context-compactor.ts` | Token-aware message history compaction |
| `command-validator.js` | Pre-execution command validation with audit log |
| `policy-generator.ts` | Natural language → structured policy rules |
| `policy-engine.ts` | Dual-layer (local+cloud) policy evaluation |
| `approval-gate.js` | SHA-256 input-bound approval tickets |
| `entity-extractor.ts` | Regex extraction of prices, PII, API keys from page content |
| `domain-tracker.ts` | Per-domain cumulative agent time tracking |
| `guardrails/` | Two-tier content sanitization (normal/strict) |
| `task-lifecycle.ts` | Formal task state machine with guarded transitions |
| `approval-waiter.ts` | Promise-based async approval with timeout |
| `agent/` | Planner + Navigator multi-agent architecture |
| `action-replay.ts` | Action replay with element remapping and retry |
| `event-bus.ts` | Typed pub/sub event system |
| `llm-factory.ts` | Multi-provider LLM factory (10+ providers) |
| `content-tagging.ts` | XML tagging for anti-prompt-injection |
| `structured-output.ts` | Dual-path JSON parser with repair fallback |
| `sw-resilience.js` | Service worker lifecycle approval persistence |

## Security

### Native OS Verification (WebAuthn/FIDO2)

Aartiq uses **WebAuthn/FIDO2** for cryptographic identity verification when approving high-risk AI actions. This replaces older PowerShell-based verification with proper low-level OS verification.

1. **Challenge-Response**: Each verification generates a 256-bit random challenge
2. **TPM-Backed Keys**: Private keys are stored in the device's TPM and never leave hardware
3. **Biometric/PIN**: Windows Hello prompts for fingerprint, face recognition, or PIN
4. **Attestation**: TPM 2.0 attestation verifies the key is genuine hardware-backed

| Platform | Method | API |
|----------|--------|-----|
| Windows 10 1903+ | WebAuthn via `webauthn.dll` | `win10Register` / `win10Authenticate` |
| macOS 12+ | caBLE WebAuthn via AuthenticationServices | `cableRegister` / `cableAuthenticate` |
| Linux | Falls back to password prompt | N/A |

### Directory Allowlist

AI file access is restricted to user-approved directories via a configurable allowlist. Shell commands that read or write outside allowed paths are blocked.

### Vault & Credentials

- Vault encryption key stored in native OS keychain (not plaintext config)
- Windows AppContainer sandbox for process isolation
- WebAuthn credentials in `~/.aartiq/webauthn-credentials.json` (mode `0600`)

## Context Compaction

Long AI conversations can exceed the LLM's context window. `context-compactor.ts` provides token-aware message history compaction that runs automatically during chat:

### How It Works

1. **Token Estimation**: Each message is scanned and its token count is estimated (~0.4 tokens per ASCII char, ~0.8 per Unicode char, +4 per message overhead)
2. **Compaction Trigger**: When total tokens exceed `maxTokens` (default 64K for chat, 128K general), compaction activates
3. **Preservation Rules**:
   - **System messages** — always preserved (instructions, skill context, preferences)
   - **Recent messages** — last 6 exchanges kept in full
   - **Middle messages** — compressed into a structured summary block
4. **Summary Generation**: Middle messages are grouped into blocks (≤2000 tokens each) and summarized per block using a template that captures the last user query and AI response
5. **Size Check**: If the compressed history is actually larger than the original (e.g., very few messages), the original is kept
6. **Last-Resort Truncation**: If still over the limit after compression, messages are progressively truncated from the oldest

### Integration Points

Compaction runs at three points in `AIChatSidebar.tsx`:
- After building the initial message history for a new AI request
- After appending the assistant's response
- After appending action execution results

### Configuration

```typescript
interface CompactionOptions {
  maxTokens: number;          // Token limit before compaction (default: 64000)
  preserveSystem: boolean;    // Always keep system messages (default: true)
  preserveRecentCount: number;// Recent exchanges to keep in full (default: 6)
}
```

## DOM Engine v2

Centralized DOM interaction engine with cascading fallback strategies:

- **Element Resolution**: CSS selector → text content → ARIA role → placeholder → broad scan
- **Multi-field Forms**: `dom-multi-fill-form` for atomic form filling
- **Click Hardening**: Default fallback strategies ensure buttons are found even with empty params
- **110 Jest Tests**: Full coverage for engine v2, skill loading, and handler fallbacks

## Build

```bash
# Development
npm run dev
npm run electron-start

# Production build
npm run build
npm run electron-build

# Platform-specific
npm run build:win
npm run build:mac
npm run build:linux
```

## License

Apache License 2.0 — see [LICENSE](LICENSE) in the repository root.