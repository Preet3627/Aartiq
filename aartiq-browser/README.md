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