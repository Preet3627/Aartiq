# Aartiq Architecture

## Overview

Aartiq is a cross-platform AI-native browser with OS automation capabilities. It consists of three main components connected via WebSocket and IPC.

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   aartiq-browser (Electron)                   │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ main.js      │  │ Next.js UI   │  │ Background       │   │
│  │ (IPC, window │◄─┤ (React/TS)   │  │ Service          │   │
│  │  management) │  │ Port 3003    │  │ (scheduler,      │   │
│  └──────┬───────┘  └──────┬───────┘  │  notifications)  │   │
│         │                 │           └──────────────────┘   │
│         ▼                 ▼                                   │
│  ┌──────────────────────────────────────────────────┐        │
│  │  src/lib/ (services, automation, security, OCR)  │        │
│  └──────────────────────────────────────────────────┘        │
│         │                                                     │
│         ▼                                                     │
│  ┌──────────────────────────────────────────────────┐        │
│  │  Swift Native Panels (macOS only)                 │        │
│  │  - SidebarView, SettingsView, CommandCenterView   │        │
│  │  - SiriShortcutsProvider, AppleIntelligence       │        │
│  └──────────────────────────────────────────────────┘        │
└──────────────────┬──────────────────────────────────────────┘
                   │ WebSocket (port 3004)
                   ▼
┌─────────────────────────────────────────────────────────────┐
│               flutter_browser_app (Mobile)                   │
│  - WiFi sync, remote desktop control, PDF viewer             │
│  - Automation dashboard, push notifications                  │
└─────────────────────────────────────────────────────────────┘
```

## Directory Layout

| Path | Purpose |
|------|---------|
| `aartiq-browser/` | Electron desktop application |
| `aartiq-browser/main.js` | Main process entry point |
| `aartiq-browser/src/components/` | React UI components |
| `aartiq-browser/src/lib/` | Services, automation, utilities |
| `aartiq-browser/src/lib/native-panels/` | Swift native macOS panels (14 files) |
| `aartiq-browser/src/service/` | Background task scheduler |
| `aartiq-browser/scripts/` | Build and service installation scripts |
| `flutter_browser_app/` | Flutter mobile companion |
| `Landing_Page/` | Documentation site (Next.js) |

## Key Services (src/lib/)

| File | Purpose |
|------|---------|
| `Security.ts` / `SecurityValidator.js` | Command validation, risk levels, injection detection |
| `AIChatSidebar.tsx` | Main AI chat interface |
| `AICommandParser.ts` | Parses AI output into executable commands |
| `YouTubePlayer.tsx` | Inline YouTube iframe video player component |
| `WiFiSyncService.ts` | WebSocket sync between desktop and mobile |
| `P2PFileSyncService.ts` | Peer-to-peer file transfer |
| `CloudSyncService.ts` | Firebase cloud sync |
| `AdvancedDocumentEngine.ts` | PDF/XLSX/PPTX generation |
| `SiriShortcutsIntegration.ts` | macOS Siri and Shortcuts bridge |
| `tesseract-service.js` | OCR via Tesseract.js |
| `plugin-manager.js` | Dynamic plugin loading |
| `BackgroundNotifications.tsx` | Shows completed background task events on re-open |
| `AutomationPlanApproval.tsx` | Pre-execution plan with risk assessment + permission gates |
| `AutomationSettings.tsx` (enhanced) | Directory allowlisting for background automations |
| `WidgetContainer.tsx` | Collapsible/draggable/removable widget wrapper |
| `CustomizationPanel.tsx` | Widget enable/disable/reorder modal |
| `PrivacyControls.tsx` | Memory/preference/tab/animations toggles |
| `AIVisualTheme.tsx` | Glow mode, color, intensity sliders |
| `AITabAnimation.tsx` | CSS keyframe AI status animations |
| `widgets/DashboardWidget.tsx` | Greeting + stats + contextual tab actions |
| `widgets/MemoryWidget.tsx` | Learned preferences + session memory with search |
| `widgets/SessionTimelineWidget.tsx` | Live action chain step display |
| `widgets/TabIntelligenceWidget.tsx` | Domain-grouped tabs with smart icons |
| `widgets/QuickActionsWidget.tsx` | AI-powered contextual + hardcoded suggestions |
| `widgets/CapabilitiesWidget.tsx` | Lists AI capabilities |
| `widgets/TasksWidget.tsx` | Past automation runs with retry failed |

## Communication Protocols

| Protocol | Port | Purpose |
|----------|------|---------|
| HTTP (Next.js) | 3003 | Frontend UI |
| WebSocket | 3004 | Desktop-mobile sync |
| UDP | 3005 | Device discovery |
| HTTP (Nexus bridge) | 9922 | Nexus-AI integration |

## CI/CD

14 GitHub Actions workflows handle multi-platform builds. All workflows are triggered manually or by tag push. See `.github/workflows/` for details.

## Dependencies

- **Desktop**: Electron, Next.js, React, TypeScript, Framer Motion, Firebase, Mermaid
- **Mobile**: Flutter, flutter_inappwebview, Firebase Auth/DB, WebRTC
- **AI SDKs**: Vercel AI SDK (OpenAI, Anthropic, Google, Groq, xAI)
- **macOS**: SwiftUI, AppIntents, Apple Intelligence frameworks
