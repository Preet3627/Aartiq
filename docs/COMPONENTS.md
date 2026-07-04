# Aartiq Component Documentation

Complete reference for all components across the Aartiq project.

---

## Desktop Browser (`aartiq-browser`)

### AI Components (`src/components/ai/`)

| Component | Lines | Description |
|-----------|-------|-------------|
| `AIChatSidebar.tsx` | 4096 | Main AI chat interface with streaming, command execution, scheduling |
| `SchedulingModal.tsx` | 494 | Modal for scheduling AI tasks with cron expressions |
| `AISetupGuide.tsx` | 474 | Setup wizard for AI provider configuration |
| `DOMSearchDisplay.tsx` | 359 | Visual DOM search results display |
| `FlowchartDiagram.tsx` | 256 | Flowchart rendering component |
| `ClickPermissionModal.tsx` | 222 | Permission dialog for click actions |
| `CollapsibleOCRMessage.tsx` | 216 | Expandable OCR results display |
| `ThinkingPanel.tsx` | 152 | Thinking/reasoning display panel |
| `ChartDiagram.tsx` | 146 | Chart rendering (mermaid/other) |
| `MermaidDiagram.tsx` | 108 | Mermaid diagram renderer |
| `ConversationHistoryPanel.tsx` | 112 | Chat history sidebar |
| `MessageActions.tsx` | 40 | Message action buttons (copy, edit, delete) |

### Settings Components

| Component | Lines | Description |
|-----------|-------|-------------|
| `SettingsPanel.tsx` | 1001 | Main settings container with all sections |
| `AutomationSettings.tsx` | 816 | Automation & scheduling settings |
| `SyncSettings.tsx` | 635 | WiFi/P2P sync configuration |
| `LLMProviderSettings.tsx` | 626 | AI model provider settings |
| `UpdatesSettings.tsx` | 538 | Auto-update configuration |
| `PermissionSettings.tsx` | 521 | Command permission management |
| `ThemeSettings.tsx` | 255 | Visual theme configuration |
| `PluginSettings.tsx` | 408 | Plugin management UI |
| `McpSettings.tsx` | 486 | Model Context Protocol settings |
| `ApiKeysSettings.tsx` | 104 | API key configuration |
| `ExtensionSettings.tsx` | 186 | Browser extension settings |
| `ExtensionManager.tsx` | 161 | Extension installation/management |
| `ProxySettings.tsx` | 81 | Proxy server configuration |
| `ProxyFirewallManager.tsx` | 373 | Advanced proxy & firewall rules |
| `BackendSettings.tsx` | 77 | Backend service configuration |
| `PerformanceSettings.tsx` | 91 | Performance tuning options |
| `AutofillSettings.tsx` | 114 | Form autofill configuration |
| `SearchEngineSettings.tsx` | 39 | Default search engine |
| `UserAgentSettings.tsx` | 48 | Custom user agent strings |
| `KeyboardShortcutSettings.tsx` | 64 | Keyboard shortcut customization |
| `StartupSetupUI.tsx` | 319 | First-run setup wizard |

### Browser Components

| Component | Lines | Description |
|-----------|-------|-------------|
| `BrowserViewContainer.tsx` | 132 | WebView container management |
| `TitleBar.tsx` | 177 | Custom window title bar |
| `TabManager.tsx` | 254 | Tab lifecycle management |
| `VirtualizedTabBar.tsx` | 317 | High-performance tab bar |
| `SpotlightSearchOverlay.tsx` | 303 | Spotlight-style search overlay |
| `QuickNavOverlay.tsx` | 212 | Quick navigation overlay |
| `TabSwitcherOverlay.tsx` | 78 | Tab switching overlay (⌘⇧]) |
| `ClipboardManager.tsx` | 85 | Clipboard history & sync |
| `HistoryPanel.tsx` | 48 | Browsing history view |

### AI Features

| Component | Lines | Description |
|-----------|-------|-------------|
| `AICommandQueue.tsx` | 404 | Queue for pending AI commands |
| `AIAssistOverlay.tsx` | 280 | Floating AI assist overlay |
| `AIFeatureDemo.tsx` | 472 | Interactive AI feature demo |
| `AISetupGuide.tsx` | 271 | AI configuration wizard |
| `PDFGenerationPanel.tsx` | 358 | PDF creation interface |
| `PDFWorkspace.tsx` | 266 | PDF editing workspace |
| `CrossAppOCR.tsx` | 370 | Cross-application OCR & click |
| `PhoneCamera.tsx` | 105 | Phone camera integration |

### Dashboard & Studio

| Component | Lines | Description |
|-----------|-------|-------------|
| `WelcomeScreen.tsx` | 774 | First-time user welcome |
| `AdminDashboard.tsx` | 169 | Admin control panel |
| `CodingDashboard.tsx` | 204 | Development workspace |
| `WorkspaceDashboard.tsx` | 158 | General workspace hub |
| `PresentonStudio.tsx` | 395 | Presentation creation studio |
| `MediaStudio.tsx` | 168 | Media management studio |
| `WebStore.tsx` | 107 | Plugin/extension marketplace |
| `LandingPage.tsx` | 383 | Marketing landing page |

### Overlay Components

| Component | Lines | Description |
|-----------|-------|-------------|
| `UnifiedSearch.tsx` | 402 | Universal search overlay |
| `UnifiedCartPanel.tsx` | 66 | Shopping cart aggregator |
| `P2PSyncManager.tsx` | 185 | Peer-to-peer sync manager |
| `PasswordManager.tsx` | 382 | Saved passwords manager |
| `CloudSyncConsent.tsx` | 45 | Cloud sync permission dialog |
| `CapabilitiesPanel.tsx` | 74 | Browser capabilities display |
| `LoginPrompt.tsx` | 18 | Login dialog |

### Entertainment

| Component | Lines | Description |
|-----------|-------|-------------|
| `DinoGame.tsx` | 242 | Offline dinosaur game |
| `NoNetworkGame.tsx` | 139 | No-internet game |
| `ThinkingIndicator.tsx` | 78 | AI thinking animation |
| `MediaSuggestions.tsx` | 43 | Content suggestions |

### Documentation

| Component | Lines | Description |
|-----------|-------|-------------|
| `Documentation.tsx` | 269 | Built-in documentation viewer |

---

## Mobile App (`flutter_browser_app`)

### Pages (`lib/pages/`)

| Page | Lines | Route | Description |
|------|-------|-------|-------------|
| `desktop_control_page.dart` | 1172 | `/desktop-control` | Remote desktop control with AI chat |
| `agent_chat_page.dart` | 1020 | `/agent-chat` | Agent task execution interface |
| `connect_desktop_page.dart` | 996 | `/connect-desktop` | QR scanner for desktop pairing |
| `aartiq_agent_service.dart` | 888 | - | Background agent service |
| `sync_service.dart` | 843 | - | WiFi/WebRTC sync service |
| `remote_settings_page.dart` | 730 | `/remote-settings` | Remote settings control |
| `automation_page.dart` | 648 | `/automation` | Scheduled task management |
| `webview_tab.dart` | 642 | - | WebView tab renderer |
| `auth_page.dart` | 580 | `/auth` | Authentication page |
| `aartiq_home_page.dart` | 576 | `/` | Main browser home |
| `browser.dart` | 538 | - | Browser controller |
| `pdf_viewer_page.dart` | 511 | `/pdf-viewer` | PDF viewing & sharing |
| `splash_screen.dart` | 187 | - | App splash screen |
| `ai_chat_page.dart` | 261 | `/ai-chat` | Mobile AI chat |
| `bookmarks_page.dart` | 123 | `/bookmarks` | Bookmarks management |

### Developer Pages (`lib/pages/developers/`)

| Page | Lines | Description |
|------|-------|-------------|
| `javascript_console.dart` | - | JS console output viewer |
| `network_info.dart` | - | Network diagnostics |
| `storage_manager.dart` | - | Storage management |
| `main.dart` | - | Developer tools entry |

### Settings Pages (`lib/pages/settings/`)

| Page | Description |
|------|-------------|
| `main.dart` | Settings hub |
| `android_settings.dart` | Android-specific settings |
| `ios_settings.dart` | iOS-specific settings |
| `cross_platform_settings.dart` | Shared settings |

### Core Services (`lib/`)

| File | Lines | Description |
|------|-------|-------------|
| `sync_service.dart` | 843 | WebRTC P2P sync with desktop |
| `auth_service.dart` | 231 | Firebase authentication |
| `clipboard_monitor.dart` | 44 | Clipboard change detection |
| `url_predictor.dart` | 45 | URL autocomplete |
| `webview_tab.dart` | 642 | WebView tab controller |

### Models (`lib/models/`)

| Model | Description |
|-------|-------------|
| `browser_model.dart` | Browser state model |
| `webview_model.dart` | WebView tab model |
| `window_model.dart` | Window state model |
| `favorite_model.dart` | Bookmark model |
| `search_engine_model.dart` | Search engine config |
| `web_archive_model.dart` | Archived page model |

### App Bar Components (`lib/app_bar/`)

| Component | Description |
|-----------|-------------|
| `browser_app_bar.dart` | Main browser toolbar |
| `webview_tab_app_bar.dart` | Tab-specific toolbar |
| `desktop_app_bar.dart` | Desktop mode toolbar |
| `find_on_page_app_bar.dart` | Find-in-page bar |
| `tab_viewer_app_bar.dart` | Tab grid toolbar |
| `custom_app_bar_wrapper.dart` | Theme wrapper |
| `url_info_popup.dart` | URL details popup |
| `certificates_info_popup.dart` | SSL certificate info |

---

## Background Service (`aartiq-browser/src/service/`)

| File | Description |
|------|-------------|
| `service-main.js` | Entry point |
| `tray-manager.js` | System tray |
| `scheduler.js` | Cron job scheduler |
| `task-queue.js` | Priority task queue |
| `storage.js` | File management |
| `model-selector.js` | AI model picker |
| `ollama-manager.js` | Ollama integration |
| `notifications.js` | Desktop notifications |
| `mobile-notifier.js` | Mobile push |
| `sleep-handler.js` | Sleep/wake recovery |
| `ipc-service.js` | Browser ↔ Service IPC |
| `pdf-sync.js` | PDF sync server |

---

## API Reference

### IPC Handlers (Desktop)

| Handler | Description |
|---------|-------------|
| `automation:schedule` | Schedule a task |
| `automation:list` | List all tasks |
| `automation:pause` | Pause a task |
| `automation:resume` | Resume a task |
| `automation:delete` | Delete a task |
| `automation:run-now` | Execute task immediately |
| `sync:status` | Get sync status |
| `sync:connect` | Connect to device |
| `sync:disconnect` | Disconnect device |
| `clipboard:get` | Get clipboard content |
| `clipboard:set` | Set clipboard content |

### WebSocket Messages (Mobile Sync)

| Message | Direction | Description |
|---------|-----------|-------------|
| `clipboard-sync` | Bidirectional | Clipboard content |
| `ai-prompt` | Mobile→Desktop | AI request |
| `ai-response` | Desktop→Mobile | AI response stream |
| `shell-command` | Mobile→Desktop | Shell execution |
| `shell-result` | Desktop→Mobile | Shell output |
| `desktop-control` | Mobile→Desktop | Remote control |
| `status-update` | Desktop→Mobile | Status broadcast |

---

## Component State Management

### React Context (Desktop)

```
AppContext
├── SettingsContext
├── AIContext
├── SyncContext
├── TabContext
└── ThemeContext
```

### Provider (Mobile)

```
MultiProvider
├── ChangeNotifierProvider<BrowserModel>
├── ChangeNotifierProvider<SyncService>
├── ChangeNotifierProvider<AuthService>
└── Provider<Database>
```

---

## File Organization

```
Aartiq/
├── aartiq-browser/                    # Electron Desktop
│   ├── main.js                       # Main process
│   ├── preload.js                    # Preload scripts
│   ├── src/
│   │   ├── components/               # React components (63 files)
│   │   │   ├── ai/                   # AI sub-components
│   │   │   └── settings/             # Settings sub-components
│   │   ├── lib/                      # Utilities
│   │   │   ├── WiFiSyncService.ts    # Desktop sync
│   │   │   ├── AICommandParser.ts    # Command parsing
│   │   │   └── plugin-manager.js     # Plugin system
│   │   └── service/                  # Background service
│   └── scripts/                      # Install scripts
│
├── flutter_browser_app/              # Flutter Mobile
│   ├── lib/
│   │   ├── main.dart                # Entry point
│   │   ├── browser.dart             # Browser controller
│   │   ├── sync_service.dart        # WebRTC sync
│   │   ├── auth_service.dart        # Firebase auth
│   │   ├── pages/                   # Screens (14 files)
│   │   │   ├── desktop_control_page.dart
│   │   │   ├── automation_page.dart
│   │   │   └── pdf_viewer_page.dart
│   │   ├── models/                  # Data models (6 files)
│   │   ├── app_bar/                 # App bar components (8 files)
│   │   └── ...
│   └── pubspec.yaml
│
└── Landing_Page/                     # Marketing site
```

---

## Dependencies

### Desktop Key Dependencies

| Package | Purpose |
|---------|---------|
| `electron` | Desktop framework |
| `react` | UI framework |
| `electron-store` | Persistent storage |
| `node-cron` | Task scheduling |
| `ollama` | Local AI models |
| `ws` | WebSocket server |
| `fluent-ffmpeg` | Media processing |

### Mobile Key Dependencies

| Package | Purpose |
|---------|---------|
| `flutter_inappwebview` | WebView rendering |
| `flutter_webrtc` | P2P connections |
| `firebase_core` | Firebase backend |
| `provider` | State management |
| `sqflite` | Local database |
| `path_provider` | File system access |
| `window_manager_plus` | Window control |

---

*Last Updated: 2026-04-06*
