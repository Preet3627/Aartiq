# Main.js Refactoring Guide

## Current State
- Original main.js: **10,821 lines**
- Created handler modules in `src/main/handlers/`:

## Created Files (14 handler files)
```
src/main/handlers/
├── index.js              # Main entry - registers all handlers
├── utils.js              # Helper functions
├── app-handlers.js       # App info, window controls, dialogs
├── ai-handlers.js        # LLM, AI engine, providers
├── auth-handlers.js      # Auth, session, vault, passwords
├── browser-handlers.js   # Tabs, navigation, webview
├── automation-handlers.js # Robot, OCR, vision
├── sync-handlers.js     # WiFi, cloud, P2P sync
├── file-handlers.js      # File ops, PDF, docs
├── permission-handlers.js # Permissions, security
├── mcp-handlers.js       # MCP servers, tools
├── system-handlers.js    # System settings, shell, extensions
├── plugin-handlers.js    # Plugin management
├── memory-handlers.js    # Memory/AI memory
├── rag-handlers.js       # RAG service
└── voice-workflow-handlers.js # Voice, workflow, popsearch
```

## Manual Integration Steps

### Step 1: Update main.js to import handlers

In main.js, after services are initialized (around line 5921), add:

```javascript
// After services initialized
const { registerAllHandlers } = require('./src/main/handlers/index.js');

const handlers = {
  mainWindow, store, tabViews, activeTabId, isOnline: true,
  extensionsPath, isMac, isDev, cometAiEngine, robotService,
  tesseractOcrService, screenVisionService, ragService,
  voiceService, flutterBridge, fileSystemMcp, nativeAppMcp,
  workflowRecorder, popSearch, wifiSyncService, cloudSyncService,
  p2pSyncService, mcpManager, networkSecurityManager,
  permissionStore, pluginManager, llmProviders,
  llmGenerateHandler, llmStreamHandler, adBlocker
};

registerAllHandlers(ipcMain, handlers);
```

### Step 2: Remove duplicate IPC handlers

Search for `ipcMain.handle(` in main.js and remove handlers that are now in separate files. Focus on:

- Lines 225-260: App handlers → app-handlers.js
- Lines 2820-2950: AI/LLM handlers → ai-handlers.js  
- Lines 3170-3650: Auth/Vault handlers → auth-handlers.js
- Lines 3986-4200: Browser/Tab handlers → browser-handlers.js
- Lines 5210-5400: Robot/OCR handlers → automation-handlers.js
- Lines 8000-8250: WiFi/Cloud handlers → sync-handlers.js
- Lines 8300-8700: File/PDF handlers → file-handlers.js
- Lines 9700-9900: Permission handlers → permission-handlers.js
- Lines 10100-10250: MCP handlers → mcp-handlers.js

### Step 3: Keep essential code in main.js

Keep these sections in main.js (don't move):
- `createWindow()` function (lines 2460+)
- Service initialization code
- Menu building
- Protocol handling
- Download handlers
- App lifecycle (will-quit, before-quit)

### Step 4: Test after each removal

```bash
cd comet-browser
npm run dev
```

### Step 5: Final line count target

After full refactoring, main.js should be ~2000-3000 lines (services + window management + lifecycle only).

## Quick Test

Run this to check syntax:
```bash
node --check main.js
```

## If something breaks

1. Check if handler file exists and is required
2. Check if all handler dependencies are passed in `handlers` object
3. Comment out problematic handler imports in index.js temporarily

## Handler Template (if adding new)

```javascript
const { ipcMain } = require('electron');

module.exports = function registerXyzHandlers(ipcMain, handlers) {
  const { mainWindow, store } = handlers;

  ipcMain.handle('handler-name', async (event, args) => {
    // handler code
  });

  console.log('[Handlers] XYZ handlers registered');
};
```

Then add to index.js:
```javascript
const registerXyzHandlers = require('./xyz-handlers.js');
// In registerAllHandlers:
registerXyzHandlers(ipcMain, handlers);
```