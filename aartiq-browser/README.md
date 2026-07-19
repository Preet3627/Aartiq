# Aartiq Browser (Desktop)

The Electron desktop application for Aartiq — an AI-native browser with OS automation capabilities.

## Overview

This package contains the desktop browser built with Electron + Next.js. It includes the main process, renderer UI, AI chat sidebar, security layer, MCP bridge, and native OS automation backends.

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
│   ├── components/         # React UI (126 components)
│   │   ├── AIChatSidebar.tsx
│   │   ├── CommandPalette.tsx
│   │   ├── ActionChain.tsx
│   │   └── ...
│   ├── lib/                # Core services
│   │   ├── AICommandParser.ts
│   │   ├── DOMEngine.ts
│   │   ├── Security.ts
│   │   ├── AdvancedDocumentEngine.ts
│   │   ├── WiFiSyncService.ts
│   │   ├── tesseract-service.js
│   │   └── plugin-manager.js
│   ├── service/            # Background scheduler
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
| `AIChatSidebar.tsx` | Main AI chat interface |
| `AICommandParser.ts` | Parses AI output into executable commands |
| `DOMEngine.ts` | Centralized DOM interaction engine |
| `AdvancedDocumentEngine.ts` | PDF/XLSX/PPTX generation |
| `WiFiSyncService.ts` | WebSocket sync desktop↔mobile |
| `P2PFileSyncService.ts` | Peer-to-peer file transfer |
| `CloudSyncService.ts` | Firebase cloud sync |
| `SiriShortcutsIntegration.ts` | macOS Siri/Shortcuts bridge |
| `tesseract-service.js` | OCR via Tesseract.js |
| `plugin-manager.js` | Dynamic plugin loading |

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