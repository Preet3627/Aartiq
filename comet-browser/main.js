const { app, BrowserWindow, ipcMain, WebContentsView, session, shell, clipboard, dialog, globalShortcut, Menu, protocol, desktopCapturer, screen, nativeImage, net } = require('electron');
const QRCode = require('qrcode');
const contextMenuRaw = require('electron-context-menu');
const contextMenu = contextMenuRaw.default || contextMenuRaw;
const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const path = require('path');
const os = require('os');
const { spawn, exec } = require('child_process');
const Store = require('electron-store');
const store = new Store();
const { createWorker } = require('tesseract.js');
const screenshot = require('screenshot-desktop');
const Jimp = require('jimp');
const util = require('util');
const execPromise = util.promisify(exec);

// Register the custom `app://` scheme early so we can safely load static assets from the exported build.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

// Augment PATH for macOS/Linux to find common command-line tools like docker
if (process.platform !== 'win32') {
  const extraPaths = [
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
    '/opt/homebrew/bin',
    '/usr/local/sbin'
  ];
  const currentPath = process.env.PATH || '';
  const newPath = Array.from(new Set([...extraPaths, ...currentPath.split(':')])).join(':');
  process.env.PATH = newPath;
}

let robot = null;
try {
  robot = require('robotjs');
} catch (e) {
  console.warn('[Main] robotjs not available (Find & Click disabled):', e.message);
}

let tesseractWorker; // Declare tesseractWorker here
// Production mode detection:
// 1. app.isPackaged - true when running from built .exe
// 2. NODE_ENV === 'production' - for manual testing before build
// 3. Check if out/index.html exists - fallback to prod if dev server isn't available
const isDev = !app.isPackaged;
const express = require('express');
const bodyParser = require('body-parser');
const { getP2PSync } = require('./src/lib/P2PFileSyncService.js'); // Import the P2P service

// ERROR-PROOFING: Global error handlers for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[MAIN] Uncaught Exception:', error.message, error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[MAIN] Unhandled Rejection at:', promise, 'reason:', reason);
});

let p2pSyncService = null; // Declare p2pSyncService here
let wifiSyncService = null; // Declare wifiSyncService here

// Desktop Automation Services (Comet-AI Guide v2)
const { PermissionStore } = require('./src/lib/permission-store.js');
const { RobotService } = require('./src/lib/robot-service.js');
const { TesseractOcrService } = require('./src/lib/tesseract-service.js');
const { CometAiEngine } = require('./src/lib/ai-engine.js');
const { ScreenVisionService } = require('./src/lib/screen-vision-service.js');
const { FlutterBridgeServer } = require('./src/lib/bridge-server.js');
const { FileSystemMcpServer, NativeAppMcpServer } = require('./src/lib/mcp-desktop-server.js');
const { RagService } = require('./src/lib/rag-service.js');
const { VoiceService } = require('./src/lib/voice-service.js');
const { WorkflowRecorder } = require('./src/lib/workflow-recorder.js');
const { PopSearchService, popSearchService } = require('./src/lib/pop-search-service.js');
const { getRecommendedGeminiModel } = require('./src/lib/modelRegistry.js');
const { mcpManager } = require('./src/lib/mcp-server-registry.js');


const permissionStore = new PermissionStore();
let cometAiEngine = null;
let robotService = null;
const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const performRobotClick = async ({ x, y, button = 'left', doubleClick = false }) => {
  if (robotService) {
    try {
      await robotService.execute({ type: 'click', x, y, button, double: doubleClick });
      return { success: true, source: 'robotService' };
    } catch (err) {
      console.warn('[Main] RobotService click failed, falling back to robotjs:', err.message);
    }
  }

  if (!robot) {
    throw new Error('robotjs not available');
  }

  robot.moveMouseSmooth(x, y);
  await sleepMs(30);
  if (doubleClick) {
    robot.mouseClick(button, true);
  } else {
    robot.mouseClick(button);
  }
  await sleepMs(20);
  return { success: true, source: 'robotjs' };
};
let tesseractOcrService = null;
let screenVisionService = null;
let flutterBridge = null;
let fileSystemMcp = null;
let nativeAppMcp = null;
let ragService = null;
let voiceService = null;
let workflowRecorder = null;
let popSearch = null;

let mcpServer;
let networkCheckInterval;
let clipboardCheckInterval;
let activeTabId = null;
let isOnline = true;
const tabViews = new Map(); // Map of tabId -> WebContentsView
const audibleTabs = new Set(); // Track tabs currently playing audio
const suspendedTabs = new Set(); // Track suspended tabs
let adBlocker = null;

const extensionsPath = path.join(app.getPath('userData'), 'extensions');
const memoryPath = path.join(app.getPath('userData'), 'ai_memory.jsonl');

const searchCache = new Map();
const shellApprovalResolvers = new Map();

const RAYCAST_PORT = parseInt(process.env.RAYCAST_PORT || '9877', 10);
const RAYCAST_HOST = process.env.RAYCAST_HOST || '127.0.0.1';
const raycastState = {
  tabs: [],
  history: [],
};
let raycastServer = null;

const isMac = process.platform === 'darwin';
const openWindows = new Set();
let mainWindow = null;
let macSidebarWindow = null;
let popupWindows = new Map();
let popupViews = new Map();
let latestAiOverviewData = null;
let latestDownloadPanelData = [];
let lastRegisteredShortcutsSignature = '';
const embeddedPopupTypes = new Set(['ai-overview', 'downloads', 'clipboard', 'cart', 'unified-cart', 'search', 'search-apps', 'extensions', 'plugins', 'translate', 'context-menu', 'rightclick']);

const getTopWindow = () => {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  for (const win of openWindows) {
    if (!win.isDestroyed()) return win;
  }
  return null;
};

const sendToActiveWindow = (channel, ...args) => {
  const target = getTopWindow();
  if (target && !target.isDestroyed()) {
    target.webContents.send(channel, ...args);
    return target;
  }
  return null;
};

const registerWindow = (win) => {
  openWindows.add(win);
  mainWindow = win;
  win.on('focus', () => {
    if (!win.isDestroyed()) mainWindow = win;
  });
  win.on('closed', () => {
    openWindows.delete(win);
    if (mainWindow === win) {
      mainWindow = openWindows.size ? Array.from(openWindows).pop() : null;
    }
  });
};

function broadcastAiOverviewData() {
  if (!latestAiOverviewData) return;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ai-overview-data', latestAiOverviewData);
  }

  const popup = popupWindows.get('ai-overview');
  if (popup && !popup.isDestroyed()) {
    popup.webContents.send('ai-overview-data', latestAiOverviewData);
  }

  const popupView = popupViews.get('ai-overview');
  if (popupView && !popupView.webContents.isDestroyed()) {
    popupView.webContents.send('ai-overview-data', latestAiOverviewData);
  }
}

function broadcastDownloadPanelData() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('download-panel-data', latestDownloadPanelData);
  }

  const popup = popupWindows.get('downloads');
  if (popup && !popup.isDestroyed()) {
    popup.webContents.send('download-panel-data', latestDownloadPanelData);
  }

  const popupView = popupViews.get('downloads');
  if (popupView && !popupView.webContents.isDestroyed()) {
    popupView.webContents.send('download-panel-data', latestDownloadPanelData);
  }
}

const hasChildView = (view) => Boolean(mainWindow && view && mainWindow.contentView.children.includes(view));

const addChildView = (view) => {
  if (!mainWindow || !view) return;
  mainWindow.contentView.addChildView(view);
};

const removeChildView = (view) => {
  if (!mainWindow || !view) return;
  mainWindow.contentView.removeChildView(view);
};

const bringPopupViewsToFront = () => {
  if (!mainWindow) return;
  for (const view of popupViews.values()) {
    if (view && !view.webContents.isDestroyed()) {
      mainWindow.contentView.addChildView(view);
    }
  }
};

const sendPopupClosed = (type) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('popup-closed', type);
  }
  if (type === 'ai-overview') {
    latestAiOverviewData = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ai-overview-closed');
    }
  }
};

const destroyPopupView = (type) => {
  const view = popupViews.get(type);
  if (!view) return;

  popupViews.delete(type);
  removeChildView(view);

  if (!view.webContents.isDestroyed()) {
    view.webContents.destroy();
  }

  sendPopupClosed(type);
};

const toggleMacSidebarWindow = () => {
  if (!isMac) return;

  if (macSidebarWindow && !macSidebarWindow.isDestroyed()) {
    if (macSidebarWindow.isVisible()) {
      macSidebarWindow.hide();
    } else {
      macSidebarWindow.show();
      macSidebarWindow.focus();
    }
    return;
  }

  macSidebarWindow = new BrowserWindow({
    width: 360,
    height: 820,
    show: false,
    frame: false,
    transparent: true,
    vibrancy: 'ultra-dark',
    visualEffectState: 'active',
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    resizable: false,
    title: 'Comet AI Sidebar',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  macSidebarWindow.setIgnoreMouseEvents(false);
  macSidebarWindow.on('blur', () => {
    if (macSidebarWindow && !macSidebarWindow.isDestroyed()) {
      macSidebarWindow.hide();
    }
  });
  macSidebarWindow.on('closed', () => {
    macSidebarWindow = null;
  });
  macSidebarWindow.loadURL('app://./mac/ai-sidebar').catch(err => {
    console.error('[Main] Failed to load mac sidebar:', err);
  });
  macSidebarWindow.once('ready-to-show', () => {
    if (macSidebarWindow && !macSidebarWindow.isDestroyed()) {
      macSidebarWindow.show();
    }
  });
};

const buildApplicationMenu = () => {
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Window', accelerator: 'CmdOrCtrl+N', click: () => createWindow() },
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => sendToActiveWindow('add-new-tab', 'https://www.comet.ai') },
        { type: 'separator' },
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => sendToActiveWindow('execute-shortcut', 'open-settings') },
        { label: 'Close Window', role: 'close' },
        ...(!isMac ? [{ type: 'separator' }, { role: 'quit' }] : [])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        {
          label: 'Toggle AI Sidebar',
          accelerator: 'CmdOrCtrl+Shift+S',
          visible: isMac,
          click: () => toggleMacSidebarWindow()
        }
      ]
    },
    {
      label: 'Window',
      role: 'window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }])
      ]
    },
    {
      label: 'Help',
      role: 'help',
      submenu: [
        {
          label: 'Documentation',
          click: () => sendToActiveWindow('add-new-tab', 'https://docs.latestinssan.com')
        },
        {
          label: 'Release Notes',
          click: () => sendToActiveWindow('add-new-tab', 'https://www.comet.ai/release-notes')
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

const resolveAppAssetPath = (requestUrl) => {
  try {
    const parsedUrl = new URL(requestUrl);
    let pathname = decodeURI(parsedUrl.pathname || '');
    if (!pathname || pathname === '/') {
      pathname = '/index.html';
    }
    const normalizedPath = path.normalize(path.join(__dirname, 'out', pathname));
    const outDir = path.join(__dirname, 'out');
    if (!normalizedPath.startsWith(outDir)) {
      console.warn('[Main] App protocol blocked path escape attempt:', normalizedPath);
      return path.join(outDir, 'index.html');
    }
    if (!fs.existsSync(normalizedPath)) {
      console.warn('[Main] App protocol asset missing, falling back to index.html:', normalizedPath);
      return path.join(outDir, 'index.html');
    }
    return normalizedPath;
  } catch (error) {
    console.error('[Main] Failed to resolve app:// request', error);
    return path.join(__dirname, 'out', 'index.html');
  }
};

const registerAppFileProtocol = () => {
  protocol.registerFileProtocol('app', (request, callback) => {
    const assetPath = resolveAppAssetPath(request.url);
    callback({ path: assetPath });
  });
};

// ============================================================================
// PDF GENERATION ENGINE (Branded & Robust)
// ============================================================================
const PDF_TEMPLATES = {
  professional: (title, content, iconBase64, metadata = {}) => {
    const { author = '', category = '', tags = [], watermark = '', bgColor = '#ffffff' } = metadata;
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&family=Inter:wght@400;500;700&family=JetBrains+Mono:wght@400;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; line-height: 1.8; color: #1e293b; background: ${bgColor}; padding: 50px 60px; min-height: 100vh; overflow-x: hidden; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 100px; color: rgba(0,0,0,0.03); font-weight: 900; white-space: nowrap; z-index: -1; font-family: 'Outfit', sans-serif; pointer-events: none; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0ea5e9; padding-bottom: 25px; margin-bottom: 40px; flex-wrap: wrap; }
    .brand { display: flex; align-items: center; gap: 15px; }
    .brand-name { font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 1.6rem; color: #0ea5e9; }
    .brand-name span { color: #0f172a; }
    .doc-tag { background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%); color: white; padding: 8px 20px; border-radius: 30px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; }
    h1 { font-family: 'Outfit', sans-serif; color: #0f172a; font-size: 2.5rem; font-weight: 900; letter-spacing: -0.03em; line-height: 1.1; margin: 30px 0 15px; word-wrap: break-word; }
    .meta-grid { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 40px; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; }
    .meta-item { display: flex; flex-direction: column; gap: 4px; min-width: 120px; }
    .meta-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.15em; color: #64748b; font-weight: 700; }
    .meta-value { font-size: 0.9rem; color: #0f172a; font-weight: 600; word-break: break-word; }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 30px; }
    .tag { background: rgba(14, 165, 233, 0.1); color: #0ea5e9; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
    .content { font-size: 1rem; line-height: 1.8; width: 100%; }
    .content h2 { margin: 40px 0 20px; color: #0f172a; font-family: 'Outfit', sans-serif; font-size: 1.6rem; font-weight: 800; border-left: 6px solid #0ea5e9; padding-left: 15px; word-wrap: break-word; }
    .content h3 { margin: 30px 0 15px; color: #334155; font-family: 'Outfit', sans-serif; font-size: 1.2rem; font-weight: 700; }
    .content p { margin-bottom: 20px; text-align: left; word-wrap: break-word; }
    .content ul, .content ol { margin: 15px 0 20px 25px; }
    .content li { margin-bottom: 10px; }
    .table-wrapper { width: 100%; overflow-x: auto; margin: 30px 0; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    table { width: 100%; min-width: 500px; border-collapse: collapse; background: white; }
    thead { display: table-header-group; }
    tbody { display: table-row-group; }
    tr { display: table-row; }
    th { background: linear-gradient(135deg, #0f172a 0%, #334155 100%); color: white; padding: 16px 18px; text-align: left; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; display: table-cell; }
    td { padding: 14px 18px; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; display: table-cell; word-break: break-word; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #f8fafc; }
    hr { border: none; height: 3px; background: linear-gradient(to right, #0ea5e9, transparent); margin: 40px 0; border-radius: 3px; }
    pre { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #e2e8f0; padding: 25px; border-radius: 15px; font-family: 'JetBrains Mono', monospace; overflow-x: auto; margin: 25px 0; font-size: 0.85rem; line-height: 1.6; border: 1px solid #334155; word-wrap: break-word; white-space: pre-wrap; }
    code { background: #f1f5f9; padding: 2px 8px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 0.85em; color: #0ea5e9; word-break: break-all; }
    pre code { background: none; padding: 0; color: inherit; }
    blockquote { border-left: 6px solid #0ea5e9; padding: 20px 25px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 0 15px 15px 0; color: #0369a1; margin: 25px 0; font-style: italic; font-size: 1rem; }
    .footer { margin-top: 60px; padding-top: 25px; border-top: 2px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; }
    .footer-left { font-size: 0.75rem; color: #64748b; }
    .footer-center { text-align: center; }
    .footer-right { text-align: right; font-size: 0.8rem; color: #0ea5e9; font-weight: 700; }
    img { max-width: 100%; border-radius: 16px; margin: 25px 0; box-shadow: 0 10px 40px rgba(0,0,0,0.15); }
    @page { margin: 0; size: A4; }
  </style>
</head>
<body>
  ${watermark ? `<div class="watermark">${watermark}</div>` : ''}
  <div class="header">
    <div class="brand">
      ${iconBase64 ? `<img src="data:${iconMimeType};base64,${iconBase64}" alt="Comet" style="width:40px;height:40px;object-fit:contain;"/>` : '<span style="font-size:1.8rem">🌠</span>'}
      <span class="brand-name">Comet<span>AI</span></span>
    </div>
    <div class="doc-tag">${category || 'Intelligence Report'}</div>
  </div>
  
  <h1>${title || 'Research Document'}</h1>
  
  <div class="meta-grid">
    ${author ? `<div class="meta-item"><span class="meta-label">Author</span><span class="meta-value">${author}</span></div>` : ''}
    <div class="meta-item"><span class="meta-label">Document ID</span><span class="meta-value">CMT-${Math.random().toString(36).slice(2, 8).toUpperCase()}</span></div>
    <div class="meta-item"><span class="meta-label">Generated</span><span class="meta-value">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
    <div class="meta-item"><span class="meta-label">Engine</span><span class="meta-value">COMET V2.5</span></div>
  </div>
  
  ${tags && tags.length ? `<div class="tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
  
  <div class="content">${content}</div>
  
  <div class="footer">
    <div class="footer-left">&copy; ${new Date().getFullYear()} Comet AI Browser • Neural Intelligence Export</div>
    <div class="footer-center">${iconBase64 ? `<img src="data:${iconMimeType};base64,${iconBase64}" alt="" style="width:28px;height:28px;object-fit:contain;"/>` : '🌠'}</div>
    <div class="footer-right">CONFIDENTIAL • AI GENERATED</div>
  </div>
</body>
</html>`;
  },

  executive: (title, content, iconBase64, metadata = {}) => {
    const { author = '', department = '', priority = 'normal', watermark = '' } = metadata;
    const priorityColors = { high: '#ef4444', medium: '#f59e0b', normal: '#22c55e' };
    const priorityColor = priorityColors[priority] || priorityColors.normal;
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; line-height: 1.7; color: #1a1a2e; background: #ffffff; padding: 50px 60px; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 100px; color: rgba(0,0,0,0.015); font-weight: 900; z-index: -1; pointer-events: none; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 60px; padding-bottom: 30px; border-bottom: 1px solid #e5e7eb; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-text { font-family: 'Playfair Display', serif; font-weight: 900; font-size: 1.6rem; color: #1a1a2e; }
    .brand-text span { color: #4f46e5; }
    .priority-badge { padding: 8px 20px; border-radius: 25px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; background: ${priorityColor}15; color: ${priorityColor}; border: 2px solid ${priorityColor}; }
    h1 { font-family: 'Playfair Display', serif; font-size: 2.8rem; font-weight: 900; color: #1a1a2e; line-height: 1.1; margin-bottom: 30px; letter-spacing: -0.02em; word-wrap: break-word; }
    .meta-bar { display: flex; flex-wrap: wrap; gap: 30px; padding: 20px 0; margin-bottom: 40px; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
    .meta-item { display: flex; flex-direction: column; gap: 4px; min-width: 100px; }
    .meta-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.2em; color: #9ca3af; font-weight: 600; }
    .meta-value { font-size: 0.95rem; color: #1a1a2e; font-weight: 600; word-break: break-word; }
    .content { font-size: 1.05rem; line-height: 1.9; width: 100%; }
    .content h2 { margin: 40px 0 20px; font-family: 'Playfair Display', serif; font-size: 1.4rem; font-weight: 700; color: #4f46e5; }
    .content h3 { margin: 30px 0 15px; font-size: 1.2rem; font-weight: 700; color: #1a1a2e; }
    .content p { margin-bottom: 20px; word-wrap: break-word; }
    .table-wrapper { width: 100%; overflow-x: auto; margin: 30px 0; }
    table { width: 100%; min-width: 400px; border-collapse: collapse; }
    th { background: #4f46e5; color: white; padding: 14px 18px; text-align: left; font-weight: 600; font-size: 0.85rem; }
    td { padding: 12px 18px; border-bottom: 1px solid #e5e7eb; font-size: 0.9rem; word-break: break-word; }
    tr:nth-child(even) td { background: #f9fafb; }
    blockquote { border-left: 4px solid #4f46e5; padding: 20px 25px; background: #f9fafb; margin: 25px 0; font-style: italic; }
    .footer { margin-top: 60px; padding-top: 25px; border-top: 2px solid #1a1a2e; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; }
    .footer-text { font-size: 0.75rem; color: #6b7280; }
    .confidential { font-size: 0.8rem; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.1em; }
    @page { margin: 0; }
  </style>
</head>
<body>
  ${watermark ? `<div class="watermark">${watermark}</div>` : ''}
  <div class="header">
    <div class="brand">
      ${iconBase64 ? `<img src="data:${iconMimeType};base64,${iconBase64}" alt="" style="width:40px;height:40px;"/>` : '<span style="font-size:1.8rem">🌠</span>'}
      <span class="brand-text">Comet<span>AI</span></span>
    </div>
    ${priority !== 'normal' ? `<span class="priority-badge">${priority} Priority</span>` : ''}
  </div>
  
  <h1>${title || 'Executive Summary'}</h1>
  
  <div class="meta-bar">
    ${author ? `<div class="meta-item"><span class="meta-label">Prepared By</span><span class="meta-value">${author}</span></div>` : ''}
    ${department ? `<div class="meta-item"><span class="meta-label">Department</span><span class="meta-value">${department}</span></div>` : ''}
    <div class="meta-item"><span class="meta-label">Date</span><span class="meta-value">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
    <div class="meta-item"><span class="meta-label">Reference</span><span class="meta-value">EX-${Date.now().toString(36).toUpperCase()}</span></div>
  </div>
  
  <div class="content">${content}</div>
  
  <div class="footer">
    <div class="footer-text">&copy; ${new Date().getFullYear()} Comet AI Browser • Executive Intelligence</div>
    <div class="confidential">Confidential Document</div>
  </div>
</body>
</html>`;
  },

  academic: (title, content, iconBase64, metadata = {}) => {
    const { author = '', institution = '', subject = '', doi = '', watermark = '' } = metadata;
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700;900&family=Source+Sans+3:wght@400;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Source Sans 3', sans-serif; line-height: 1.8; color: #333333; background: #ffffff; padding: 50px 60px; min-height: 100vh; overflow-x: hidden; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 80px; color: rgba(0,0,0,0.02); font-weight: 900; z-index: -1; pointer-events: none; }
    .header { text-align: center; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 3px double #333; }
    .institution { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.3em; color: #666; margin-bottom: 25px; font-weight: 600; }
    h1 { font-family: 'Merriweather', serif; font-size: 2.2rem; font-weight: 900; color: #1a1a1a; line-height: 1.2; margin-bottom: 20px; word-wrap: break-word; }
    .authors { font-size: 1rem; color: #333; margin-bottom: 12px; }
    .affiliation { font-size: 0.85rem; color: #666; font-style: italic; margin-bottom: 15px; }
    .meta-row { display: flex; justify-content: center; gap: 25px; font-size: 0.8rem; color: #666; flex-wrap: wrap; }
    .meta-item { display: flex; gap: 8px; }
    .meta-label { font-weight: 600; }
    .abstract { background: #f8f9fa; padding: 25px 35px; margin: 35px 0; border-left: 5px solid #1a1a1a; font-style: italic; }
    .abstract-label { font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; display: block; }
    .content { font-size: 1rem; text-align: left; width: 100%; }
    .content h2 { margin: 40px 0 20px; font-family: 'Merriweather', serif; font-size: 1.4rem; font-weight: 700; color: #1a1a1a; border-bottom: 2px solid #333; padding-bottom: 8px; }
    .content h3 { margin: 30px 0 12px; font-size: 1.1rem; font-weight: 700; color: #333; }
    .content p { margin-bottom: 18px; word-wrap: break-word; }
    .content ol, .content ul { margin: 15px 0 20px 30px; }
    .content li { margin-bottom: 8px; }
    .table-wrapper { width: 100%; overflow-x: auto; margin: 25px 0; }
    table { width: 100%; min-width: 400px; border-collapse: collapse; }
    th { background: #333; color: white; padding: 12px 16px; text-align: left; font-weight: 600; font-size: 0.85rem; }
    td { padding: 10px 16px; border: 1px solid #ddd; font-size: 0.9rem; word-break: break-word; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .references { margin-top: 50px; padding-top: 25px; border-top: 2px solid #333; }
    .references h2 { border: none; margin-bottom: 25px; }
    .ref-item { margin-bottom: 12px; font-size: 0.9rem; text-indent: -30px; padding-left: 30px; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 0.8rem; color: #666; }
    @page { margin: 0; }
  </style>
</head>
<body>
  ${watermark ? `<div class="watermark">${watermark}</div>` : ''}
  <div class="header">
    <div class="institution">${institution || 'Comet AI Research Institute'}</div>
    <h1>${title || 'Research Paper'}</h1>
    ${author ? `<div class="authors">${author}</div>` : ''}
    ${subject ? `<div class="affiliation">${subject}</div>` : ''}
    <div class="meta-row">
      <div class="meta-item"><span class="meta-label">Date:</span><span>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
      ${doi ? `<div class="meta-item"><span class="meta-label">DOI:</span><span>${doi}</span></div>` : ''}
    </div>
  </div>
  
  <div class="abstract">
    <span class="abstract-label">Abstract</span>
    ${content.substring(0, 500)}${content.length > 500 ? '...' : ''}
  </div>
  
  <div class="content">${content}</div>
  
  <div class="footer">
    <p>Generated by Comet AI Browser &bull; ${new Date().getFullYear()}</p>
    <p>This is an AI-generated research document. Verify all citations and data independently.</p>
  </div>
</body>
</html>`;
  },

  minimalist: (title, content, iconBase64, metadata = {}) => {
    const { author = '', date = '', watermark = '', bgColor = '#fefefe' } = metadata;
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Space Grotesk', sans-serif; line-height: 1.8; color: #111; background: ${bgColor}; padding: 60px 60px; min-height: 100vh; overflow-x: hidden; max-width: 800px; margin: 0 auto; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 100px; color: rgba(0,0,0,0.015); font-weight: 700; z-index: -1; pointer-events: none; }
    .header { margin-bottom: 50px; }
    .brand { margin-bottom: 30px; opacity: 0.3; }
    h1 { font-size: 2.5rem; font-weight: 700; line-height: 1.1; margin-bottom: 15px; letter-spacing: -0.03em; word-wrap: break-word; }
    .meta { font-size: 0.85rem; opacity: 0.6; }
    .content { font-size: 1rem; width: 100%; }
    .content h2 { font-size: 1.4rem; font-weight: 700; margin: 40px 0 20px; }
    .content h3 { font-size: 1.2rem; font-weight: 700; margin: 30px 0 15px; }
    .content p { margin-bottom: 20px; word-wrap: break-word; }
    .content ul, .content ol { margin: 15px 0 20px 25px; }
    .content li { margin-bottom: 10px; }
    .table-wrapper { width: 100%; overflow-x: auto; margin: 25px 0; }
    table { width: 100%; min-width: 300px; border-collapse: collapse; }
    th { background: #111; color: white; padding: 12px 15px; text-align: left; font-weight: 600; font-size: 0.85rem; }
    td { padding: 10px 15px; border-bottom: 1px solid #eee; font-size: 0.9rem; }
    blockquote { border-left: 3px solid #111; padding-left: 20px; margin: 25px 0; font-style: italic; opacity: 0.8; }
    .footer { margin-top: 60px; padding-top: 25px; border-top: 1px solid #eee; font-size: 0.75rem; opacity: 0.5; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
    @page { margin: 0; }
  </style>
</head>
<body>
  ${watermark ? `<div class="watermark">${watermark}</div>` : ''}
  <div class="header">
    <div class="brand">Comet AI</div>
    <h1>${title || 'Document'}</h1>
    <div class="meta">${author ? author + ' • ' : ''}${date || new Date().toLocaleDateString()}</div>
  </div>
  <div class="content">${content}</div>
  <div class="footer">
    <span>Generated by Comet AI</span>
    <span>${new Date().toISOString().split('T')[0]}</span>
  </div>
</body>
</html>`;
  },

  dark: (title, content, iconBase64, metadata = {}) => {
    const { author = '', category = '', watermark = '', bgColor = '#0f0f0f' } = metadata;
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Oxanium:wght@400;600;700&family=Share+Tech+Mono&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Oxanium', sans-serif; line-height: 1.8; color: #e0e0e0; background: ${bgColor}; padding: 50px 60px; min-height: 100vh; overflow-x: hidden; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 100px; color: rgba(255,255,255,0.02); font-weight: 700; z-index: -1; pointer-events: none; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #22d3ee; flex-wrap: wrap; gap: 15px; }
    .brand { display: flex; align-items: center; gap: 15px; }
    .brand-name { font-weight: 700; font-size: 1.4rem; color: #22d3ee; }
    .brand-name span { color: #e0e0e0; }
    .category { background: #22d3ee20; color: #22d3ee; padding: 6px 14px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; border: 1px solid #22d3ee40; }
    h1 { font-size: 2.2rem; font-weight: 700; color: #ffffff; line-height: 1.1; margin-bottom: 25px; text-shadow: 0 0 30px rgba(34,211,238,0.3); word-wrap: break-word; }
    .meta-grid { display: flex; flex-wrap: wrap; gap: 25px; margin-bottom: 35px; padding: 18px; background: #1a1a1a; border-radius: 12px; border: 1px solid #333; }
    .meta-item { display: flex; flex-direction: column; gap: 4px; min-width: 100px; }
    .meta-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.15em; color: #666; font-weight: 600; }
    .meta-value { font-size: 0.9rem; color: #22d3ee; word-break: break-word; }
    .content { font-size: 1rem; width: 100%; }
    .content h2 { margin: 40px 0 20px; color: #22d3ee; font-size: 1.4rem; font-weight: 700; border-left: 4px solid #22d3ee; padding-left: 15px; }
    .content h3 { margin: 30px 0 15px; color: #22d3ee; font-size: 1.1rem; font-weight: 700; }
    .content p { margin-bottom: 20px; word-wrap: break-word; }
    .content ul, .content ol { margin: 15px 0 20px 25px; }
    .content li { margin-bottom: 10px; }
    .table-wrapper { width: 100%; overflow-x: auto; margin: 25px 0; }
    table { width: 100%; min-width: 400px; border-collapse: collapse; }
    th { background: linear-gradient(135deg, #22d3ee 0%, #6366f1 100%); color: #000; padding: 14px 18px; text-align: left; font-weight: 700; font-size: 0.85rem; }
    td { padding: 12px 18px; border-bottom: 1px solid #333; font-size: 0.9rem; word-break: break-word; }
    tr:nth-child(even) td { background: #1a1a1a; }
    blockquote { border-left: 4px solid #22d3ee; padding: 18px 25px; background: #1a1a1a; margin: 25px 0; color: #22d3ee; }
    .accent { background: linear-gradient(135deg, #22d3ee20 0%, #6366f120 100%); padding: 20px; border-radius: 12px; border: 1px solid #22d3ee30; margin: 25px 0; }
    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #333; display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #666; flex-wrap: wrap; gap: 15px; }
    .cyber-badge { color: #22d3ee; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
    @page { margin: 0; background: #0f0f0f; }
  </style>
</head>
<body>
  ${watermark ? `<div class="watermark">${watermark}</div>` : ''}
  <div class="header">
    <div class="brand">
      ${iconBase64 ? `<img src="data:${iconMimeType};base64,${iconBase64}" alt="" style="width:40px;height:40px;filter:brightness(0) invert(1);"/>` : '<span style="font-size:1.5rem;filter:brightness(0) invert(1);">🌠</span>'}
      <span class="brand-name">Comet<span>AI</span></span>
    </div>
    ${category ? `<span class="category">${category}</span>` : ''}
  </div>
  
  <h1>${title || 'Cyber Intelligence'}</h1>
  
  <div class="meta-grid">
    ${author ? `<div class="meta-item"><span class="meta-label">Agent</span><span class="meta-value">${author}</span></div>` : ''}
    <div class="meta-item"><span class="meta-label">Timestamp</span><span class="meta-value">${new Date().toISOString()}</span></div>
    <div class="meta-item"><span class="meta-label">ID</span><span class="meta-value">NX-${Math.random().toString(36).slice(2, 8).toUpperCase()}</span></div>
  </div>
  
  <div class="content">${content}</div>
  
  <div class="footer">
    <span>© ${new Date().getFullYear()} Comet AI Browser • Neural Export</span>
    <span class="cyber-badge">Classified • Neural Intelligence</span>
  </div>
</body>
</html>`;
  }
};

const TEMPLATE_NAMES = Object.keys(PDF_TEMPLATES);

function generateCometPDFTemplate(title, content, iconBase64, templateName = 'professional', metadata = {}) {
  const isFullHTML = /<html/i.test(content);
  if (isFullHTML) return content;

  let cleanContent = content
    .replace(/\[WATERMARK:\s*([^\]]+)\]/gi, (_, w) => { metadata.watermark = w; return ''; })
    .replace(/\[BG_COLOR:\s*([^\]]+)\]/gi, (_, c) => { metadata.bgColor = c; return ''; })
    .replace(/\[TEMPLATE:\s*([^\]]+)\]/gi, (_, t) => { templateName = t.toLowerCase(); return ''; })
    .replace(/\[AUTHOR:\s*([^\]]+)\]/gi, (_, a) => { metadata.author = a; return ''; })
    .replace(/\[CATEGORY:\s*([^\]]+)\]/gi, (_, c) => { metadata.category = c; return ''; })
    .replace(/\[TAGS:\s*([^\]]+)\]/gi, (_, t) => { metadata.tags = t.split(',').map(s => s.trim()); return ''; })
    .replace(/\[PRIORITY:\s*([^\]]+)\]/gi, (_, p) => { metadata.priority = p.toLowerCase(); return ''; })
    .replace(/\[SUBJECT:\s*([^\]]+)\]/gi, (_, s) => { metadata.subject = s; return ''; })
    .replace(/\[INSTITUTION:\s*([^\]]+)\]/gi, (_, i) => { metadata.institution = i; return ''; });

  // Parse markdown tables to HTML
  cleanContent = parseMarkdownTables(cleanContent);

  // Parse markdown content to HTML
  cleanContent = parseMarkdownToHTML(cleanContent);

  const template = PDF_TEMPLATES[templateName] || PDF_TEMPLATES.professional;
  return template(title, cleanContent, iconBase64, metadata);
}

function parseMarkdownTables(content) {
  const tableRegex = /\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g;
  return content.replace(tableRegex, (match, headerRow, bodyRows) => {
    const headers = headerRow.split('|').map(h => h.trim()).filter(h => h);
    const rows = bodyRows.trim().split('\n').map(row => 
      row.split('|').map(cell => cell.trim()).filter(c => c)
    );
    
    let html = '<div class="table-wrapper"><table><thead><tr>';
    headers.forEach(h => { html += `<th>${h}</th>`; });
    html += '</tr></thead><tbody>';
    rows.forEach(row => {
      html += '<tr>';
      row.forEach(cell => { html += `<td>${cell}</td>`; });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  });
}

function parseMarkdownToHTML(content) {
  let html = content;
  
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  
  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr/>');
  
  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  
  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  
  // Paragraphs - wrap lines not already in tags
  const lines = html.split('\n');
  html = lines.map(line => {
    line = line.trim();
    if (!line) return '';
    if (line.startsWith('<')) return line;
    return `<p>${line}</p>`;
  }).join('\n');
  
  return html;
}


if (!fs.existsSync(extensionsPath)) {
  try { fs.mkdirSync(extensionsPath, { recursive: true }); } catch (e) { }
}

const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const fetch = require('cross-fetch'); // Make sure cross-fetch is always available globally

// Vercel AI SDK & Ollama Provider (ESM loaded via dynamic import in handler)
// Removed legacy @google/genai dependency

const MCP_SERVER_PORT = process.env.MCP_SERVER_PORT || 3001;

// Global Context Menu for all windows and views
contextMenu({
  showSaveImageAs: true,
  showDragLink: true,
  showInspectElement: true,
  showLookUpSelection: true,
  showSearchWithGoogle: true,
  prepend: (defaultActions, params, browserWindow) => [
    {
      label: 'Open in New Tab',
      visible: params.linkURL.length > 0,
      click: () => {
        if (mainWindow) mainWindow.webContents.send('add-new-tab', params.linkURL);
      }
    },
    {
      label: 'Search Comet for "{selection}"',
      visible: params.selectionText.trim().length > 0,
      click: () => {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(params.selectionText)}`;
        if (mainWindow) mainWindow.webContents.send('add-new-tab', searchUrl);
      }
    }
  ]
});

ipcMain.handle('set-as-default-browser', async () => {
  try {
    const protocols = ['http', 'https'];
    let overallSuccess = true;

    for (const proto of protocols) {
      // On Windows/Mac, this triggers a system dialog or registry change
      if (!app.setAsDefaultProtocolClient(proto)) {
        overallSuccess = false;
      }
    }

    // Linux specific refinement
    if (process.platform === 'linux') {
      try {
        const { exec } = require('child_process');
        // comet-ai.desktop is the likely filename based on package.json name
        exec('xdg-settings set default-web-browser comet-ai.desktop');
        overallSuccess = true;
      } catch (e) {
        console.error('[Main] Linux xdg-settings failed:', e);
      }
    }

    return { success: overallSuccess, isDefault: app.isDefaultProtocolClient('https') };
  } catch (error) {
    console.error('[Main] Failed to set default browser:', error);
    return { success: false, error: error.message };
  }
});
let mcpServerPort = MCP_SERVER_PORT;
// Custom protocol for authentication
const PROTOCOL = 'comet-browser';

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  console.error(`[SSL] Handshake failed for: ${url} (Error: ${error})`);
  if (isDev && (url.includes('localhost') || url.includes('127.0.0.1'))) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

app.on('open-url', async (event, url) => {
  event.preventDefault();
  let target = getTopWindow();
  if (!target) {
    await createWindow();
    target = mainWindow;
  }
  if (!target || target.isDestroyed()) return;
  if (url.startsWith(`${PROTOCOL}://`)) {
    target.webContents.send('auth-callback', url);
  } else if (url.startsWith('http://') || url.startsWith('https://')) {
    target.webContents.send('add-new-tab', url);
  }
  if (target.isMinimized()) target.restore();
  target.focus();
});

// Function to check network status
const checkNetworkStatus = () => {
  require('dns').lookup('google.com', (err) => {
    const online = !err || err.code === 'ENOTFOUND';
  if (online !== isOnline) {
    isOnline = online;
    const target = getTopWindow();
    if (target) target.webContents.send('network-status-changed', isOnline);
  }
  });
};

function appendToMemory(entry) {
  const log = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n';
  fs.appendFileSync(memoryPath, log);
}

function readMemory() {
  if (!fs.existsSync(memoryPath)) return [];
  const lines = fs.readFileSync(memoryPath, 'utf-8').trim().split('\n');
  return lines.map(l => {
    try { return JSON.parse(l); } catch (e) { return null; }
  }).filter(Boolean);
}

// Persistent LLM Cache
const CACHE_TTL = 3600 * 1000 * 24; // 24-hour persistent cache
const cacheFilePath = path.join(app.getPath('userData'), 'llm_cache.json');
let llmCache = new Map();

function loadLLMCache() {
  try {
    if (fs.existsSync(cacheFilePath)) {
      const data = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
      const now = Date.now();
      // Only load entries that haven't expired
      llmCache = new Map(
        Object.entries(data).filter(([_, entry]) => now - (entry.timestamp || 0) < CACHE_TTL)
      );
      console.log(`[LLM] Loaded ${llmCache.size} valid items from cache.`);
    }
  } catch (e) {
    console.error('[LLM] Failed to load cache:', e);
  }
}

function saveLLMCache() {
  try {
    const data = Object.fromEntries(llmCache);
    fs.writeFileSync(cacheFilePath, JSON.stringify(data), 'utf8');
  } catch (e) {
    console.error('[LLM] Failed to save cache:', e);
  }
}

loadLLMCache();

// Global LLM Generation Handler
const prepareLLM = async (messages, options = {}) => {
  // Composable Capabilities Object (Persistence across requests)
  const capabilities = {
    browser: true,
    terminal: true,
    filesystem: true,
    tools: true,
    vision: true,
    voice: true,
    pdf: true,
    automation: true,
    description: 'Comet AI Agent — Full system access. Never claim to be text-only.',
    pdfGeneration: {
      PRIMARY_FORMAT: 'JSON',
      FALLBACK_FORMAT: 'GENERATE_PDF',
      templates: ['professional', 'executive', 'academic', 'minimalist', 'dark'],
      metadata: ['author', 'category', 'tags', 'priority', 'watermark', 'bgColor', 'subject', 'institution', 'doi'],
      instructions: [
        'IMPORTANT: Always use CREATE_PDF_JSON command for PDF generation (JSON format is preferred)',
        'Only use GENERATE_PDF as fallback if JSON parsing fails',
        'JSON format provides better structure and template control',
      ],
      jsonFormat: {
        description: 'Structured JSON for precise PDF generation with full template control',
        structure: {
          title: 'Document title (string)',
          subtitle: 'Optional subtitle (string)',
          author: 'Author name (string)',
          category: 'Document category (string)',
          tags: 'Array of tags for organization (string[])',
          template: 'Template name: professional|executive|academic|minimalist|dark (string)',
          watermark: 'Watermark text for confidential docs (string)',
          bgColor: 'Custom background color hex (string, e.g., #f8f9fa)',
          priority: 'For executive: high|medium|normal (string)',
          pages: 'Array of page objects (Page[])'
        },
        pageStructure: {
          title: 'Page title (string)',
          icon: 'Icon emoji for page header (string, optional)',
          detailLevel: 'brief|detailed|comprehensive (string)',
          sections: 'Array of section objects (Section[])'
        },
        sectionStructure: {
          title: 'Section heading (string)',
          content: 'Section content in markdown (string)',
          icon: 'Section icon emoji (string, optional)',
          detailLevel: 'Override page detail level (string, optional)'
        }
      },
      markdownFormat: {
        description: 'Use ONLY as fallback when JSON parsing fails',
        instructions: [
          'Include [TEMPLATE:name] to select template style',
          'Include [AUTHOR:name] for attribution',
          'Include [CATEGORY:text] for document classification',
          'Include [TAGS:tag1,tag2,tag3] for organization',
          'Include [WATERMARK:text] for confidential markings',
          'Include [BG_COLOR:#hexcode] for custom backgrounds',
          'Use proper markdown: ## for h2, ### for h3, --- for dividers',
        ]
      },
      examples: {
        json: [
          `\`\`\`json
{
  "title": "Q4 Sales Report 2026",
  "subtitle": "Quarterly Performance Analysis",
  "author": "John Smith",
  "template": "executive",
  "priority": "high",
  "pages": [
    {
      "title": "Executive Summary",
      "sections": [
        { "title": "Key Highlights", "content": "## Revenue Growth\\n\\nRevenue increased by **24%** YoY..." },
        { "title": "Market Position", "content": "### Competitive Analysis\\n\\n| Metric | Value | Change |\\n|-------|-------|--------|\\n| Market Share | 32% | +5%" }
      ]
    }
  ]
}
\`\`\``,
        ],
        markdown: [
          '[TEMPLATE:executive][AUTHOR:John Smith][PRIORITY:high]## Q4 Sales Report',
          '[TEMPLATE:academic][SUBJECT:AI Research][INSTITUTION:MIT]## Neural Networks Paper',
        ]
      }
    },
  };

  // Determine active provider
  // Fallback order: options.provider -> module variable -> store
  // Normalize provider aliases so 'gemini' maps correctly to 'google'
  const rawProviderId = options.provider || activeLlmProvider || store.get('active_llm_provider') || 'google';
  const providerId = rawProviderId === 'gemini' ? 'google' : rawProviderId;
  const config = (typeof llmConfigs !== 'undefined' ? llmConfigs[providerId] : {}) || {};

  let modelInstance;

  if (providerId === 'ollama') {
    const { createOllama } = await import('ai-sdk-ollama');
    const baseUrl = options.baseUrl || config.baseUrl || store.get('ollama_base_url') || 'http://127.0.0.1:11434';
    const modelName = options.model || config.model || store.get('ollama_model') || 'deepseek-r1:1.5b';

    console.log('[Ollama] Base URL:', baseUrl, 'Model:', modelName);

    const ollamaEnabled = store.get('ollama_enabled') !== false;
    if (!ollamaEnabled) {
      throw new Error('Ollama is disabled in settings.');
    }

    try {
      const ollama = createOllama({ baseURL: baseUrl });
      modelInstance = ollama(modelName);
    } catch (ollamaError) {
      console.error('[Ollama] Failed to create Ollama instance:', ollamaError);
      throw new Error(`Ollama connection failed: ${ollamaError.message}. Make sure Ollama is running on ${baseUrl}`);
    }
  }
  else if (providerId === 'google' || providerId === 'google-flash') {
    const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
    const apiKey = config.apiKey || store.get('gemini_api_key');
    if (!apiKey) throw new Error('Google Gemini API Key is missing.');

    const recommendedModel = getRecommendedGeminiModel(providerId);
    const modelName = options.model || config.model || store.get('gemini_model') || recommendedModel;

    const google = createGoogleGenerativeAI({ apiKey });

    modelInstance = google(modelName, {
      structuredOutputs: true,
    });
  }
  else if (providerId === 'openai') {
    const { createOpenAI } = await import('@ai-sdk/openai');
    const apiKey = config.apiKey || store.get('openai_api_key');
    if (!apiKey) throw new Error('OpenAI API Key is missing.');
    const openai = createOpenAI({ apiKey });
    modelInstance = openai(options.model || config.model || store.get('openai_model') || 'gpt-4o');
  }
  else if (providerId === 'anthropic') {
    const { createAnthropic } = await import('@ai-sdk/anthropic');
    const apiKey = config.apiKey || store.get('anthropic_api_key');
    if (!apiKey) throw new Error('Anthropic API Key is missing.');
    const anthropic = createAnthropic({ apiKey });
    modelInstance = anthropic(options.model || config.model || store.get('anthropic_model') || 'claude-3-5-sonnet-latest');
  }
  else if (providerId === 'xai') {
    const { createXai } = await import('@ai-sdk/xai');
    const apiKey = config.apiKey || store.get('xai_api_key');
    if (!apiKey) throw new Error('xAI API Key is missing.');
    const xai = createXai({ apiKey });
    modelInstance = xai(options.model || config.model || store.get('xai_model') || 'grok-2-latest');
  }
  else if (providerId === 'groq') {
    const { createGroq } = await import('@ai-sdk/groq');
    const apiKey = config.apiKey || store.get('groq_api_key');
    if (!apiKey) throw new Error('Groq API Key is missing.');
    const groq = createGroq({ apiKey });
    modelInstance = groq(options.model || config.model || store.get('groq_model') || 'llama-3.3-70b-versatile');
  }
  else {
    throw new Error(`Unsupported provider: ${providerId}`);
  }

  // SYSTEM MESSAGE PIPELINE
  const systemMsgs = messages.filter(m => m.role === 'system');
  const systemPrompt = [
    ...systemMsgs.map(m => m.content),
    `[COMET_CAPABILITIES]\n${JSON.stringify(capabilities, null, 2)}\n(You are an AGENT with full system access. Use reasoning for complex tasks.)`
  ].join('\n\n');

  const chatMessages = messages.filter(m => m.role !== 'system').map(m => {
    let experimental_attachments = [];
    if (m.attachments && Array.isArray(m.attachments)) {
      experimental_attachments = m.attachments.map(att => ({
        url: att.data.startsWith('data:') ? att.data : `data:${att.mimeType || 'image/png'};base64,${att.data}`,
        contentType: att.mimeType || 'image/png'
      }));
    }
    return {
      role: m.role === 'model' ? 'assistant' : m.role,
      content: m.content || '',
      experimental_attachments
    };
  });

  const cacheKey = JSON.stringify({ providerId, messages, options });
  return { modelInstance, systemPrompt, chatMessages, cacheKey, providerId, config };
};

const THINKING_LEVEL_BY_MODE = {
  light: 'low',
  normal: 'medium',
  heavy: 'high',
};

const THINKING_BUDGET_BY_LEVEL = {
  low: 4000,
  medium: 9500,
  high: 16500,
};

const resolveReasoningPreferences = (options = {}, config = {}) => {
  const mode = options.localLlmMode || config.localLlmMode || store.get('local_llm_mode') || 'normal';
  const thinkingLevel = options.thinkingLevel || THINKING_LEVEL_BY_MODE[mode] || 'medium';
  const budgetTokens = options.thinkingBudget ?? THINKING_BUDGET_BY_LEVEL[thinkingLevel] ?? 9500;
  return { mode, thinkingLevel, budgetTokens };
};

const buildProviderOptions = (providerId, options = {}, config = {}) => {
  const baseOptions = { ...(options.providerOptions || {}) };
  const { thinkingLevel, budgetTokens } = resolveReasoningPreferences(options, config);

  if (providerId.startsWith('google')) {
    const existing = baseOptions.google ?? {};
    baseOptions.google = {
      ...existing,
      thinking: {
        includeThoughts: true,
        thinkingLevel,
        ...(existing.thinking || {}),
      },
    };
  }

  if (providerId === 'anthropic') {
    const existing = baseOptions.anthropic ?? {};
    baseOptions.anthropic = {
      ...existing,
      thinking: {
        type: 'enabled',
        budgetTokens,
        ...(existing.thinking || {}),
      },
      effort: existing.effort || thinkingLevel,
    };
  }

  if (providerId === 'ollama') {
    const existing = baseOptions.ollama ?? {};
    baseOptions.ollama = {
      ...existing,
      sendReasoning: existing.sendReasoning ?? true,
      num_ctx: existing.num_ctx || options.ollamaContext || 32768,
      numCtx: existing.numCtx || existing.num_ctx || options.ollamaContext || 32768,
    };
  }

  return baseOptions;
};

/**
 * LLM Generation Implementation
 */
const llmGenerateHandler = async (messages, options = {}) => {
  try {
    const { generateText } = await import('ai');
    const { modelInstance, systemPrompt, chatMessages, cacheKey, providerId, config } = await prepareLLM(messages, options);

    if (llmCache.has(cacheKey)) {
      console.log('[LLM] Cache hit');
      return llmCache.get(cacheKey);
    }

    const mcpTools = await mcpManager.getTools(permissionStore);

    console.log(`[LLM-Generate] Starting generation with model: ${modelInstance.modelId} and ${Object.keys(mcpTools).length} MCP tools.`);

    const providerOptions = buildProviderOptions(providerId, options, config);
    const { text, reasoning } = await generateText({
      model: modelInstance,
      system: systemPrompt,
      messages: chatMessages,
      temperature: 0.7,
      maxTokens: 8192,
      tools: mcpTools,
      maxSteps: 5, // Allow tool usage steps
      providerOptions: {
        ...providerOptions,
      }
    });

    console.log(`[LLM-Generate] Success. Text length: ${text?.length || 0}`);
    const result = {
      text: text,
      thought: reasoning || null,
      timestamp: Date.now() // Add timestamp for TTL
    };

    llmCache.set(cacheKey, result);
    saveLLMCache();
    return result;

  } catch (error) {
    console.error("Vercel AI SDK Error:", error);
    return { error: `Intelligence Failure: ${error.message}` };
  }
};

/**
 * LLM Streaming Implementation
 */
const llmStreamHandler = async (event, messages, options = {}) => {
  try {
    // First try to use the AI Engine's streaming capability
    if (cometAiEngine) {
      // Normalize provider aliases: 'gemini' -> 'google' so switch-cases match
      const rawProviderId = options.provider || activeLlmProvider || store.get('active_llm_provider') || 'google';
      const providerId = rawProviderId === 'gemini' ? 'google' : rawProviderId;
      let model = options.model;
      if (!model) {
        switch (providerId) {
          case 'ollama': model = store.get('ollama_model') || 'llama3'; break;
          case 'gemini':
          case 'google':
          case 'google-flash': model = store.get('gemini_model') || 'gemini-2.0-flash'; break;
          case 'openai': model = store.get('openai_model') || 'gpt-4o'; break;
          case 'anthropic': model = store.get('anthropic_model') || 'claude-3-5-sonnet-latest'; break;
          case 'groq': model = store.get('groq_model') || 'llama-3.3-70b-versatile'; break;
          case 'xai': model = store.get('xai_model') || 'grok-2-latest'; break;
          default: model = store.get('gemini_model') || 'gemini-2.0-flash'; // safe default
        }
      }

      const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
      const nonSystemMessages = messages.filter(m => m.role !== 'system');
      const message = nonSystemMessages[nonSystemMessages.length - 1]?.content || '';
      const history = nonSystemMessages.slice(0, -1).map(m => ({
        role: m.role === 'model' ? 'assistant' : m.role,
        content: m.content || ''
      }));

      console.log(`[llmStreamHandler] Provider: ${providerId} (raw: ${rawProviderId}), Model: ${model}, History: ${history.length} turns`);

      const engineKeys = {};
      // 'google', 'google-flash', and 'gemini' all use the same Gemini API key
      if (providerId.startsWith('google') || providerId === 'gemini') {
        const apiKey = store.get('gemini_api_key') || '';
        if (!apiKey) {
          console.error('[llmStreamHandler] Gemini API key is missing! Cannot stream.');
          event.sender.send('llm-chat-stream-part', { type: 'error', error: 'Gemini API key is not configured. Please open AI settings and add your key.' });
          return;
        }
        engineKeys.GEMINI_API_KEY = apiKey;
      }
      if (providerId === 'openai') engineKeys.OPENAI_API_KEY = store.get('openai_api_key') || '';
      if (providerId === 'anthropic') engineKeys.ANTHROPIC_API_KEY = store.get('anthropic_api_key') || '';
      if (providerId === 'groq') engineKeys.GROQ_API_KEY = store.get('groq_api_key') || '';
      if (providerId === 'ollama') engineKeys.OLLAMA_BASE_URL = options.baseUrl || store.get('ollama_base_url') || 'http://127.0.0.1:11434';
      if (Object.keys(engineKeys).length > 0) cometAiEngine.configure(engineKeys);

      await cometAiEngine.chat({
        message, model, systemPrompt, history,
        onChunk: (chunk) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send('llm-chat-stream-part', { type: 'text-delta', textDelta: chunk });
          }
        }
      });

      if (!event.sender.isDestroyed()) {
        event.sender.send('llm-chat-stream-part', { type: 'finish' });
      }
      return;
    }

    const { streamText } = await import('ai');
    const { modelInstance, systemPrompt, chatMessages, providerId, config } = await prepareLLM(messages, options);
    const providerOptions = buildProviderOptions(providerId, options, config);
    const mcpTools = await mcpManager.getTools(permissionStore);
    const result = await streamText({
      model: modelInstance,
      system: systemPrompt,
      messages: chatMessages,
      temperature: 0.7,
      maxTokens: 8192,
      tools: mcpTools,
      maxSteps: 5,
      providerOptions: { ...providerOptions }
    });

    for await (const part of result.fullStream) {
      if (event.sender.isDestroyed()) break;
      event.sender.send('llm-chat-stream-part', part);
    }
    event.sender.send('llm-chat-stream-part', { type: 'finish' });
  } catch (error) {
    console.error("Streaming Error:", error);
    event.sender.send('llm-chat-stream-part', { type: 'error', error: error.message });
  }
};

/**
 * AI Gateway Layer
 * Handles routing, logging, and error normalization for LLM providers.
 */
const AiGateway = {
  async generate(messages, options = {}) {
    const start = Date.now();
    const provider = options.provider || 'google';
    try {
      const result = await llmGenerateHandler(messages, options);
      if (result.error) {
        return { ...result, error: `[${provider}] ${result.error}`, durationMs: Date.now() - start };
      }
      return { ...result, durationMs: Date.now() - start };
    } catch (e) {
      console.error(`[AiGateway] Generate failed for ${provider}:`, e);
      return { error: `[${provider}] Gateway error: ${e.message}`, durationMs: Date.now() - start };
    }
  },

  async stream(event, messages, options = {}) {
    const provider = options.provider || 'google';
    try {
      await llmStreamHandler(event, messages, options);
    } catch (e) {
      console.error(`[AiGateway] Stream failed for ${provider}:`, e);
      if (!event.sender.isDestroyed()) {
        event.sender.send('llm-chat-stream-part', {
          type: 'error',
          error: `[${provider}] Stream failed: ${e.message}`
        });
      }
    }
  }
};

ipcMain.handle('extract-search-results', async (event, tabId) => {
  const targetTabId = tabId || activeTabId;
  const view = tabViews.get(targetTabId);
  if (!view) return { error: 'No active view for extraction' };

  try {
    const results = await view.webContents.executeJavaScript(`
      (() => {
        const selectors = [
          'div.g a[href] h3',
          'main a[href] h3',
          'article a[href] h3',
          '.result__title a[href]',
          '.result__a[href]',
          'a[data-ved] h3',
          'a[href] h2'
        ];
        const anchors = [];
        const seen = new Set();

        const pushAnchor = (anchor) => {
          if (!anchor || !anchor.href || seen.has(anchor.href)) return;
          if (!/^https?:/i.test(anchor.href)) return;
          seen.add(anchor.href);
          anchors.push(anchor);
        };

        selectors.forEach((selector) => {
          document.querySelectorAll(selector).forEach((node) => {
            pushAnchor(node.closest('a'));
          });
        });

        if (anchors.length === 0) {
          document.querySelectorAll('a[href]').forEach((anchor) => {
            const text = (anchor.innerText || anchor.textContent || '').trim();
            if (text.length > 25 && /^https?:/i.test(anchor.href)) {
              pushAnchor(anchor);
            }
          });
        }

        return anchors.slice(0, 8).map((anchor) => {
          const container = anchor.closest('div.g, li.g, article, main article, .result, [data-snc]') || anchor.parentElement || anchor;
          const title = (
            anchor.querySelector('h3, h2')?.innerText ||
            anchor.getAttribute('aria-label') ||
            anchor.innerText ||
            anchor.textContent ||
            anchor.href
          ).trim();
          const snippet = (
            container.querySelector('.VwiC3b, .yXK7lf, .MUxGbd, .result__snippet, .st, span, p')?.innerText ||
            container.innerText ||
            ''
          ).replace(/\\s+/g, ' ').trim();

          return {
            title,
            url: anchor.href,
            snippet: snippet.slice(0, 500)
          };
        }).filter((item) => item.title && item.url);
      })();
    `);
    return { success: true, results };
  } catch (e) {
    console.error("Failed to extract search results:", e);
    return { success: false, error: e.message };
  }
});

// IPC handler for search suggestions
ipcMain.handle('get-suggestions', async (event, query) => {
  // TODO: Implement actual history and bookmark suggestions
  // For now, return some dummy data based on the query
  const suggestions = [];
  if (query.length > 0) {
    suggestions.push({ type: 'search', text: `Search Google for "${query}"`, url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
    suggestions.push({ type: 'history', text: `History: ${query} past visit`, url: `https://example.com/history/${query}` });
    suggestions.push({ type: 'bookmark', text: `Bookmark: ${query} docs`, url: `https://docs.example.com/${query}` });
  }
  return suggestions;
});


// When menu opens
function hideWebview() {
  if (!mainWindow) return;
  const view = tabViews.get(activeTabId);
  if (view) {
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  }
}

// When menu closes
function showWebview() {
  if (!mainWindow) return;
  const view = tabViews.get(activeTabId);
  if (view) {
    // Current window bounds are handled by setBrowserViewBounds usually, 
    // but we can force it here if needed.
    // For now, let's just trigger a re-render from renderer or use stored bounds
  }
}



async function createWindow() {
  // GPU compositing optimizations for transparent overlays
  app.commandLine.appendSwitch('--enable-gpu-rasterization');
  app.commandLine.appendSwitch('--enable-zero-copy');
  app.commandLine.appendSwitch('--enable-hardware-overlays');
  app.commandLine.appendSwitch('--enable-features', 'VaapiVideoDecoder,CanvasOopRasterization,TranslationAPI');
  app.commandLine.appendSwitch('--disable-background-timer-throttling');
  app.commandLine.appendSwitch('--disable-renderer-backgrounding');
  app.commandLine.appendSwitch('--disable-features', 'TranslateUI,BlinkGenPropertyTrees');

  // Force GPU acceleration and compositing
  app.commandLine.appendSwitch('--ignore-gpu-blacklist');
  app.commandLine.appendSwitch('--disable-gpu-driver-bug-workarounds');
  app.commandLine.appendSwitch('--enable-native-gpu-memory-buffers');
  app.commandLine.appendSwitch('--enable-gpu-memory-buffer-compositor-resources');

  if (isDev) {
    // Clear cache and service workers in development to avoid 404s on stale chunks
    session.defaultSession.clearStorageData({
      storages: ['serviceworkers', 'cachestorage']
    }).then(() => {
      console.log('[Main] Dev storage (Service Workers & Cache) cleared');
    });
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    transparent: false, // Keep opaque to avoid compositing issues with overlays
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      // Enable GPU acceleration for web content
      offscreen: false,
      webSecurity: false, // Disable web security to allow file:// protocol
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      enableRemoteModule: false,
      contextIsolation: true,
      additionalArguments: ['--enable-features=VizDisplayCompositor']
    },
    titleBarStyle: 'hidden',
    backgroundColor: '#0D0E1C',
    icon: path.join(__dirname, 'out', 'icon.ico'),
    // Optimize for GPU compositing
    show: false,
    paintWhenInitiallyHidden: false
  });

  registerWindow(mainWindow);

  const notifyWindowLayoutChanged = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('window-layout-changed', {
      isFullScreen: mainWindow.isFullScreen(),
      isMaximized: mainWindow.isMaximized(),
      bounds: mainWindow.getContentBounds(),
    });
  };

  // CRITICAL: Multiple safeguards to ensure window ALWAYS shows
  let windowShown = false;

  // PRODUCTION FIX: For packaged apps (.exe), show immediately
  // In production, we want the window visible even if content is loading
  // This prevents the "hidden window" bug completely
  if (app.isPackaged) {
    console.log('[Main] Packaged app detected - showing window immediately');
    mainWindow.show();
    mainWindow.focus();
    windowShown = true;
  } else {
    // Development: Use ready-to-show for smooth loading
    mainWindow.once('ready-to-show', () => {
      if (!windowShown) {
        console.log('[Main] Window ready-to-show event fired');
        mainWindow.show();
        mainWindow.focus();
        windowShown = true;
      }
    });
  }

  // Fallback: Force show window after 3 seconds if not already shown
  setTimeout(() => {
    if (!windowShown && mainWindow) {
      console.log('[Main] Forcing window to show (3s timeout fallback)');
      mainWindow.show();
      mainWindow.focus();
      windowShown = true;
    }
  }, 3000);

  mainWindow.setMenuBarVisibility(false);

  const url = isDev
    ? 'http://localhost:3003'
    : 'app://./index.html';

  console.log(`[Main] Loading URL: ${url}`);
  console.log(`[Main] __dirname: ${__dirname}`);
  console.log(`[Main] isDev: ${isDev}`);

  // Check if out directory exists in production
  if (!isDev) {
    const outPath = path.join(__dirname, 'out');
    const indexPath = path.join(outPath, 'index.html');
    if (!fs.existsSync(outPath)) {
      console.error(`[Main] ERROR: Out directory does not exist: ${outPath}`);
      console.error('[Main] Run "npm run build" before building the Electron app');
    } else if (!fs.existsSync(indexPath)) {
      console.error(`[Main] ERROR: index.html does not exist: ${indexPath}`);
      console.error('[Main] Run "npm run build" to generate the static export');
    } else {
      console.log('[Main] Build files verified');
    }
  }

  mainWindow.loadURL(url).catch(err => {
    console.error('[Main] Failed to load URL:', err);
    // Still show window even if load fails
    if (!windowShown && mainWindow) {
      console.log('[Main] Showing window despite load error');
      mainWindow.show();
      mainWindow.focus();
      windowShown = true;
    }
  });

  // Tesseract initialization is now lazy-loaded in 'find-and-click-text' handler to improve startup time

  // Handle load failures
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`[Main] Page failed to load: ${errorCode} - ${errorDescription}`);
    // Show window anyway so user can see the error
    if (!windowShown && mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      windowShown = true;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Explicitly quit for multi-process environments like Windows
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  mainWindow.on('resize', notifyWindowLayoutChanged);
  mainWindow.on('maximize', notifyWindowLayoutChanged);
  mainWindow.on('unmaximize', notifyWindowLayoutChanged);
  mainWindow.on('enter-full-screen', notifyWindowLayoutChanged);
  mainWindow.on('leave-full-screen', notifyWindowLayoutChanged);

  // Delayed initialization for startup safety
  setTimeout(() => {
    checkNetworkStatus();
    networkCheckInterval = setInterval(checkNetworkStatus, 60000);

    ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
      adBlocker = blocker;
      console.log('Ad blocker initialized (deferred).');
    }).catch(e => console.error("Ad blocker failed to load:", e));
  }, 5000);

  // Handle external links
  // Handle external links - Open in new tab within the app instead of default browser
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('file://') && url !== mainWindow.webContents.getURL()) {
      event.preventDefault();
      mainWindow.webContents.send('add-new-tab', url);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('file://')) {
      mainWindow.webContents.send('add-new-tab', url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Set Chrome User-Agent for all sessions (for browser detection)
  const chromeUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  session.defaultSession.setUserAgent(chromeUserAgent);

  // ERROR-PROOFING: Handle SSL certificate errors gracefully
  session.defaultSession.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    console.warn(`[SSL] Certificate error for ${url}: ${error}`);
    // Allow certificates for development or known issues, but log them
    // For production, you might want to be stricter
    const allowedHosts = ['localhost', '127.0.0.1', '*.local'];
    const isAllowed = allowedHosts.some(host => url.includes(host));
    if (isAllowed) {
      callback(true); // Allow
    } else {
      // Don't block - just warn and allow for better UX
      console.warn('[SSL] Allowing certificate error for:', url);
      callback(true); 
    }
  });

  // Handle login prompts (authentication)
  session.defaultSession.on('login', (event, webContents, url, realm, callback) => {
    console.log(`[Auth] Login prompt for: ${url}`);
    // Don't auto-handle - let user see the prompt
    event.preventDefault();
  });

  // ERROR-PROOFING: Handle webRequest errors
  session.defaultSession.webRequest.onErrorOccurred({ urls: ['*://*/*'] }, (details) => {
    const criticalErrors = [-105, -106, -7]; // DNS errors, connection failed
    if (criticalErrors.includes(details.error)) {
      console.warn(`[WebRequest] Non-critical error: ${details.url} - ${details.error}`);
    }
  });

  // Header stripping for embedding and Google Workspace compatibility
  session.defaultSession.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
    const { responseHeaders } = details;
    const headerKeys = Object.keys(responseHeaders);

    const filteredHeaders = headerKeys.reduce((acc, key) => {
      const lowerKey = key.toLowerCase();
      // Expanded list of headers to strip for maximum compatibility with Google/MS Workspace
      if (
        lowerKey !== 'x-frame-options' &&
        lowerKey !== 'content-security-policy' &&
        lowerKey !== 'content-security-policy-report-only' &&
        lowerKey !== 'cross-origin-resource-policy' &&
        lowerKey !== 'cross-origin-opener-policy'
      ) {
        acc[key] = responseHeaders[key];
      }
      return acc;
    }, {});

    callback({ cancel: false, responseHeaders: filteredHeaders });
  });

  // Load Extensions
  try {
    console.log(`[Main] Scanning for extensions in: ${extensionsPath}`);
    if (!fs.existsSync(extensionsPath)) {
      fs.mkdirSync(extensionsPath, { recursive: true });
    }
    const extensionDirs = fs.readdirSync(extensionsPath);
    if (extensionDirs.length === 0) {
      console.log("[Main] No extensions found in extensions directory.");
    }
    extensionDirs.forEach(dir => {
      // Skip the problematic QuickFill extension for now
      if (dir === 'google-forms-autofill-extension-main') {
        console.warn(`[Main] Skipping problematic extension: ${dir}`);
        return;
      }
      const extPath = path.join(extensionsPath, dir);
      if (fs.lstatSync(extPath).isDirectory()) {
        const manifestPath = path.join(extPath, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          session.defaultSession.loadExtension(extPath).then(extension => {
            console.log(`Extension loaded: ${extension.name} (${extension.id}) from ${extPath}`);
          }).catch(e => console.error(`Failed to load extension from ${extPath}: ${e.message || e}`));
        } else {
          console.log(`[Main] Skipping ${dir}: No manifest.json found.`);
        }
      }
    });
  } catch (e) {
    console.error("Error during initial extension loading:", e);
  }

  // Clipboard Monitoring
  let lastClipboardText = clipboard.readText();
  clipboardCheckInterval = setInterval(() => {
    const currentText = clipboard.readText();
    if (currentText && currentText !== lastClipboardText) {
      lastClipboardText = currentText;
      console.log("[Main] Clipboard changed:", currentText.substring(0, 30));
      if (mainWindow) {
        mainWindow.webContents.send('clipboard-changed', currentText);
      }
      // Send to P2P peers if connected
      if (p2pSyncService && p2pSyncService.getStatus().connected) {
        p2pSyncService.sendMessage({ type: 'clipboard-sync', text: currentText });
      }
      // Send to Mobile devices connected via WiFi WebSocket
      if (wifiSyncService) {
        wifiSyncService.broadcast({ type: 'clipboard-sync', text: currentText });
      }
    }
  }, 3000);
}

ipcMain.handle('test-gemini-api', async (event, apiKey) => {
  try {
    const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
    const { generateText } = await import('ai');

    // Create custom instance with API key
    const google = createGoogleGenerativeAI({ apiKey });

    // Test with a simple prompt
    const result = await generateText({
      model: google('gemini-1.5-flash'),
      prompt: 'Identity check. Respond with "passed".',
    });

    if (result.text.toLowerCase().includes('passed')) {
      return { success: true };
    }
    return { success: false, error: 'Unexpected response from Gemini' };
  } catch (error) {
    console.error("Gemini API test failed:", error);
    return { success: false, error: error.message };
  }
});

const gmailService = require('./src/lib/gmailService.js');

ipcMain.handle('get-gmail-messages', async () => {
  return await gmailService.getGmailMessages();
});

ipcMain.on('save-ai-response', (event, content) => {
  dialog.showSaveDialog(mainWindow, {
    title: 'Save AI Response',
    defaultPath: 'ai-response.txt',
  }).then(result => {
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content);
    }
  });
});
// Gmail and Google Services

ipcMain.handle('gmail-authorize', async () => {
  const { authorize } = require('./src/lib/gmailService.js');
  try {
    await authorize();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});


ipcMain.handle('gmail-list-messages', async (event, query, maxResults) => {
  const { listMessages } = require('./src/lib/gmailService.js');
  try {
    const messages = await listMessages(query, maxResults);
    return { success: true, messages };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('gmail-get-message', async (event, messageId) => {
  const { getMessage } = require('./src/lib/gmailService.js');
  try {
    const message = await getMessage(messageId);
    return { success: true, message };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('gmail-send-message', async (event, to, subject, body, threadId) => {
  const { sendMessage } = require('./src/lib/gmailService.js');
  try {
    const result = await sendMessage(to, subject, body, threadId);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('gmail-add-label-to-message', async (event, messageId, labelName) => {
  const { addLabelToMessage } = require('./src/lib/gmailService.js');
  try {
    const result = await addLabelToMessage(messageId, labelName);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Helper function for recursive directory scanning
async function _scanDirectoryRecursive(currentPath, types) {
  const files = [];
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await _scanDirectoryRecursive(entryPath, types));
    } else if (entry.isFile()) {
      const stats = fs.statSync(entryPath);
      const fileType = path.extname(entry.name).toLowerCase();
      const shouldInclude = types.includes('all') || types.some(t => fileType.includes(t));

      if (shouldInclude) {
        files.push({
          id: entryPath, // Use path as ID for simplicity
          name: entry.name,
          path: entryPath,
          size: stats.size,
          type: fileType,
          hash: `${entryPath}-${stats.size}-${stats.mtimeMs}`, // Simple hash for now
          modifiedTime: stats.mtimeMs,
        });
      }
    }
  }
  return files;
}

// IPC Handlers
ipcMain.on('open-menu', () => {
  const target = getTopWindow();
  const menu = Menu.buildFromTemplate([
    { label: 'Reload', click: () => { const v = tabViews.get(activeTabId); if (v) v.webContents.reload(); } },
    { label: 'Back', click: () => { const v = tabViews.get(activeTabId); if (v && v.webContents.canGoBack()) v.webContents.goBack(); } },
    { label: 'Forward', click: () => { const v = tabViews.get(activeTabId); if (v && v.webContents.canGoForward()) v.webContents.goForward(); } },
    { type: 'separator' },
    { label: 'Save Page As...', click: () => { sendToActiveWindow('execute-shortcut', 'save-page'); } },
    { label: 'Print...', click: () => { const v = tabViews.get(activeTabId); if (v) v.webContents.print(); } },
    { type: 'separator' },
    { label: 'Settings', click: () => { sendToActiveWindow('execute-shortcut', 'open-settings'); } },
    { label: 'DevTools', click: () => { const v = tabViews.get(activeTabId); if (v) v.webContents.openDevTools({ mode: 'detach' }); } },
  ]);
  if (target) {
    menu.popup({ window: target });
  } else {
    menu.popup();
  }
});

ipcMain.handle('get-is-online', () => isOnline);

ipcMain.on('toggle-adblocker', (event, enable) => {
  if (!adBlocker) {
    console.warn('Ad blocker not yet initialized.');
    return;
  }
  try {
    if (enable) {
      adBlocker.enableBlockingInSession(session.defaultSession);
      console.log('Ad blocker enabled by user.');
    } else {
      adBlocker.disableBlockingInSession(session.defaultSession);
      console.log('Ad blocker disabled by user.');
    }
  } catch (e) {
    console.error('Failed to toggle ad blocker:', e);
  }
});


ipcMain.on('show-webview', () => showWebview());
ipcMain.on('hide-webview', () => hideWebview());

ipcMain.on('add-tab-from-main', (event, url) => {
  if (mainWindow) {
    mainWindow.webContents.send('add-new-tab', url);
  }
});

// Window Controls
ipcMain.on('minimize-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});
ipcMain.on('maximize-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});
ipcMain.on('close-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});
ipcMain.on('toggle-fullscreen', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setFullScreen(!win.isFullScreen());
    win.webContents.send('window-layout-changed', {
      isFullScreen: win.isFullScreen(),
      isMaximized: win.isMaximized(),
      bounds: win.getContentBounds(),
    });
  }
});

// Persistent Storage Handlers
const persistentDataPath = path.join(app.getPath('userData'), 'persistent_data');
if (!fs.existsSync(persistentDataPath)) {
  fs.mkdirSync(persistentDataPath, { recursive: true });
}

ipcMain.handle('save-persistent-data', async (event, { key, data }) => {
  try {
    const filePath = path.join(persistentDataPath, `${key}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('Failed to save persistent data:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-persistent-data', async (event, key) => {
  try {
    const filePath = path.join(persistentDataPath, `${key}.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return { success: true, data: JSON.parse(data) };
    }
    return { success: false, error: 'File not found' };
  } catch (error) {
    console.error('Failed to load persistent data:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-persistent-data', async (event, key) => {
  try {
    const filePath = path.join(persistentDataPath, `${key}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to delete persistent data:', error);
    return { success: false, error: error.message };
  }
});

// Secure Auth Storage (using electron-store)
ipcMain.on('save-auth-token', (event, { token, user }) => {
  store.set('auth_token', token);
  store.set('user_info', user);
  console.log('[Auth] Token and user info saved to secure storage');
});

ipcMain.handle('get-auth-token', () => {
  return store.get('auth_token');
});

ipcMain.handle('get-user-info', () => {
  return store.get('user_info');
});

ipcMain.on('clear-auth', () => {
  store.delete('auth_token');
  store.delete('user_info');
  console.log('[Auth] Auth data cleared');
});

// Password Manager Logic
ipcMain.handle('get-passwords-for-site', async (event, domain) => {
  const filePath = path.join(persistentDataPath, 'user-passwords.json');
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return data.filter(p => p.site.includes(domain));
    } catch (e) { return []; }
  }
  return [];
});

ipcMain.on('propose-password-save', (event, { domain, username, password }) => {
  // Automatically show a dialog to save password
  dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Save', 'Ignore'],
    defaultId: 0,
    title: 'Comet Vault',
    message: `Do you want to save the password for ${domain}?`,
    detail: `User: ${username}`
  }).then(result => {
    if (result.response === 0) {
      const filePath = path.join(persistentDataPath, 'user-passwords.json');
      let passwords = [];
      if (fs.existsSync(filePath)) {
        try { passwords = JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch (e) { }
      }
      // Avoid duplicates
      if (!passwords.some(p => p.site === domain && p.username === username && p.password === password)) {
        passwords.push({ id: Date.now().toString(), site: domain, username, password, created: new Date().toISOString() });
        fs.writeFileSync(filePath, JSON.stringify(passwords), 'utf-8');
        console.log(`[Vault] Saved password for ${domain}`);
      }
    }
  });
});


// Auth - Create proper OAuth window instead of opening in external browser
let authWindow = null;

ipcMain.on('open-auth-window', (event, authUrl) => {
  // Check if this is an OAuth URL (Firebase, Google, etc.)
  const isOAuthUrl = authUrl.includes('accounts.google.com') ||
    authUrl.includes('firebase') ||
    authUrl.includes('oauth') ||
    authUrl.includes('auth');

  if (isOAuthUrl) {
    // FIX: Google Sign-In "unsupported browser" / 401 error
    // For Google/Firebase OAuth, we open the EXTERNAL browser to bypass Electron limits.
    // The redirect URI (https://browser.ponsrischool.in/oauth2callback) should then
    // redirect back to comet-browser://auth using the Custom Protocol we registered.
    if (authUrl.includes('accounts.google.com')) {
      shell.openExternal(authUrl);
      console.log('[Auth] Google OAuth: Opening external browser');
      return;
    }

    // For other OAuth that doesn't block Electron, we can use BrowserWindow
    if (authWindow) {
      if (!authWindow.isDestroyed()) {
        authWindow.focus();
        authWindow.loadURL(authUrl);
        return;
      }
      authWindow = null;
    }

    const authPreloadPath = path.join(__dirname, 'auth-preload.js');
    authWindow = new BrowserWindow({
      width: 540,
      height: 780,
      frame: false,
      titleBarStyle: 'hidden',
      titleBarOverlay: false,
      transparent: true,
      backgroundColor: '#02030a',
      hasShadow: true,
      resizable: true,
      closable: true,
      minimizable: true,
      maximizable: true,
      parent: mainWindow,
      modal: true,
      show: false,
      webPreferences: {
        preload: authPreloadPath,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    authWindow.setMenuBarVisibility(false);

    // Fix "Unsecure Browser" error by setting a modern User-Agent
    authWindow.webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");

    authWindow.loadURL(authUrl);

    authWindow.once('ready-to-show', () => {
      authWindow.show();
    });

    // Listen for navigation to callback URL
    authWindow.webContents.on('will-redirect', (event, url) => {
      if (url.startsWith('comet-browser://') || url.includes('__/auth/handler')) {
        event.preventDefault();
        if (mainWindow) {
          mainWindow.webContents.send('auth-callback', url);
        }
        authWindow.close();
      } else if (url.startsWith('http://localhost') && url.includes('code=')) { // Gmail OAuth redirect
        event.preventDefault();
        const urlParams = new URLSearchParams(new URL(url).search);
        const code = urlParams.get('code');
        if (code) {
          ipcMain.emit('gmail-oauth-code', null, code); // Send code to main process, which relays to gmailService
          authWindow.close();
        }
      }
    });

    authWindow.webContents.on('did-navigate', (event, url) => {
      if (url.startsWith('comet-browser://') || url.includes('__/auth/handler')) {
        if (mainWindow) {
          mainWindow.webContents.send('auth-callback', url);
        }
        authWindow.close();
      } else if (url.startsWith('http://localhost') && url.includes('code=')) { // Gmail OAuth redirect
        const urlParams = new URLSearchParams(new URL(url).search);
        const code = urlParams.get('code');
        if (code) {
          ipcMain.emit('gmail-oauth-code', null, code); // Send code to main process, which relays to gmailService
          authWindow.close();
        }
      }
    });

    authWindow.on('closed', () => {
      authWindow = null;
    });
  } else {
    // For non-OAuth URLs, open in external browser
    shell.openExternal(authUrl);
  }
});

ipcMain.on('close-auth-window', () => {
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.close();
    if (!authWindow.isDestroyed()) {
      authWindow.destroy();
    }
  }
  authWindow = null;
});

ipcMain.on('auth-window-action', (event, action) => {
  if (!authWindow || authWindow.isDestroyed()) return;

  if (action === 'close') {
    authWindow.close();
    return;
  }

  if (action === 'minimize') {
    authWindow.minimize();
    return;
  }

  if (action === 'zoom') {
    if (authWindow.isMaximized()) {
      authWindow.unmaximize();
    } else {
      authWindow.maximize();
    }
  }
});

ipcMain.on('raycast-update-state', (event, state) => {
  if (state?.tabs) {
    raycastState.tabs = state.tabs.slice(-100);
  }
  if (state?.history) {
    raycastState.history = state.history.slice(-200);
  }
});

// Multi-WebContentsView Management
ipcMain.on('create-view', (event, { tabId, url }) => {
  if (tabViews.has(tabId)) return; // Prevent redundant creation

  const chromeUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  const newView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'view_preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });
  newView.webContents.setUserAgent(chromeUserAgent);
  newView.webContents.loadURL(url);

  // Intercept new window requests and open them as new tabs
  newView.webContents.setWindowOpenHandler(({ url }) => {
    // Allow popups for authentication (Google, etc.)
    const isAuth = url.includes('accounts.google.com') || url.includes('facebook.com') || url.includes('oauth') || url.includes('auth0');
    if (isAuth) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 600,
          height: 700,
          center: true,
          aiProvider: 'gemini-1.5-flash',
          aiProviderVersion: '1.5',
          aiSafetyMode: true,
          autoHideMenuBar: true,
          parent: mainWindow,
        }
      };
    }

    if (mainWindow) {
      mainWindow.webContents.send('add-new-tab', url);
    }
    return { action: 'deny' };
  });

  newView.webContents.on('did-start-loading', () => {
    mainWindow.webContents.send('tab-loading-status', { tabId, isLoading: true });
  });

  newView.webContents.on('did-stop-loading', () => {
    mainWindow.webContents.send('tab-loading-status', { tabId, isLoading: false });
  });

  newView.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('on-tab-loaded', { tabId, url: newView.webContents.getURL() });
  });

  // ERROR-PROOFING: Handle page load failures gracefully
  newView.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.warn(`[WebContentsView] Tab ${tabId} failed to load: ${errorCode} - ${errorDescription}`);
    // Common non-critical errors to ignore
    const nonCritical = [-3, -7, -8, -9, -105, -106]; // ABORTED, CONNECTION_FAILED, etc.
    if (nonCritical.includes(errorCode)) return;
    mainWindow.webContents.send('tab-load-error', { tabId, errorCode, errorDescription, url });
  });

  newView.webContents.on('render-process-gone', (event, details) => {
    console.error(`[WebContentsView] Tab ${tabId} render process gone: ${details.reason}`);
    mainWindow.webContents.send('tab-crashed', { tabId, reason: details.reason });
  });

  newView.webContents.on('unresponsive', () => {
    console.warn(`[WebContentsView] Tab ${tabId} became unresponsive`);
    mainWindow.webContents.send('tab-unresponsive', { tabId });
  });

  newView.webContents.on('responsive', () => {
    console.log(`[WebContentsView] Tab ${tabId} became responsive again`);
    mainWindow.webContents.send('tab-responsive', { tabId });
  });

  newView.webContents.on('did-navigate', (event, navUrl) => {
    mainWindow.webContents.send('browser-view-url-changed', { tabId, url: navUrl });
    if (navUrl.includes('/search?') || navUrl.includes('?q=')) {
      try {
        const parsedUrl = new URL(navUrl);
        const query = parsedUrl.searchParams.get('q') || parsedUrl.searchParams.get('query');
        if (query) mainWindow.webContents.send('ai-query-detected', query);
      } catch (e) { }
    }
  });

  newView.webContents.on('page-title-updated', (event, title) => {
    mainWindow.webContents.send('browser-view-title-changed', { tabId, title });
  });

  // Track audio status
  newView.webContents.on('is-currently-audible-changed', (isAudible) => {
    console.log(`[Audio] Tab ${tabId} audible: ${isAudible}`);
    if (isAudible) audibleTabs.add(tabId);
    else audibleTabs.delete(tabId);
    if (mainWindow) {
      mainWindow.webContents.send('audio-status-changed', audibleTabs.size > 0);
    }
  });

  // Handle fullscreen requests from the web view
  newView.webContents.on('enter-html-fullscreen-window', () => {
    if (mainWindow) {
      mainWindow.setFullScreen(true);
    }
  });

  newView.webContents.on('leave-html-fullscreen-window', () => {
    if (mainWindow) {
      mainWindow.setFullScreen(false);
    }
  });

  tabViews.set(tabId, newView);
});

const tabLastActive = new Map();

ipcMain.on('suspend-tab', (event, tabId) => {
  const view = tabViews.get(tabId);
  if (view) {
    view.webContents.destroy();
    tabViews.delete(tabId);
    suspendedTabs.add(tabId);
    if (mainWindow) {
      mainWindow.webContents.send('tab-suspended', tabId);
    }
  }
});

ipcMain.on('resume-tab', (event, { tabId, url }) => {
  if (suspendedTabs.has(tabId)) {
    suspendedTabs.delete(tabId);
    // The 'create-view' handler will be called by the frontend,
    // which will create a new WebContentsView for the tab.
    if (mainWindow) {
      mainWindow.webContents.send('tab-resumed', tabId);
    }
  }
});

setInterval(() => {
  const now = Date.now();
  const inactiveTimeout = 5 * 60 * 1000; // 5 minutes
  for (const [tabId, lastActive] of tabLastActive.entries()) {
    if (now - lastActive > inactiveTimeout && tabId !== activeTabId) {
      const view = tabViews.get(tabId);
      if (view) {
        // We don't want to suspend audible tabs
        if (audibleTabs.has(tabId)) continue;

        console.log(`Suspending inactive tab: ${tabId}`);
        ipcMain.emit('suspend-tab', {}, tabId);
      }
    }
  }
}, 60 * 1000); // Check every minute

ipcMain.on('activate-view', (event, { tabId, bounds }) => {
  tabLastActive.set(tabId, Date.now());

  if (suspendedTabs.has(tabId)) {
    if (mainWindow) {
      mainWindow.webContents.send('resume-tab-and-activate', tabId);
    }
    return;
  }

  if (activeTabId && tabViews.has(activeTabId)) {
    const oldView = tabViews.get(activeTabId);
    if (oldView) {
      removeChildView(oldView);
    }
  }

  const newView = tabViews.get(tabId);
  if (newView) {
    if (bounds.width === 0 || bounds.height === 0) {
      removeChildView(newView);
    } else {
      if (!hasChildView(newView)) {
        addChildView(newView);
      }
      const roundedBounds = {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
      newView.setBounds(roundedBounds);
      bringPopupViewsToFront();
    }
  }
  activeTabId = tabId;
});

ipcMain.on('destroy-view', (event, tabId) => {
  const view = tabViews.get(tabId);
  if (view) {
    if (activeTabId === tabId) {
      removeChildView(view);
      activeTabId = null;
    }
    view.webContents.destroy();
    tabViews.delete(tabId);
    audibleTabs.delete(tabId);
    if (mainWindow) {
      mainWindow.webContents.send('audio-status-changed', audibleTabs.size > 0);
    }
  }
});

ipcMain.on('set-browser-view-bounds', (event, bounds) => {
  const view = tabViews.get(activeTabId);
  if (view && mainWindow) {
    if (bounds.width === 0 || bounds.height === 0) {
      removeChildView(view);
    } else {
      if (!hasChildView(view)) {
        addChildView(view);
      }
      const roundedBounds = {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
      view.setBounds(roundedBounds);
      bringPopupViewsToFront();
    }
  }
});

ipcMain.on('navigate-browser-view', async (event, { tabId, url }) => {
  const view = tabViews.get(tabId || activeTabId);
  if (!view) return;
  
  // ERROR-PROOFING: Add retry logic for navigation
  const maxRetries = 2;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await view.webContents.loadURL(url);
      appendToMemory({ action: 'navigate', url });
      return; // Success
    } catch (err) {
      lastError = err;
      console.warn(`[WebContentsView] Navigation attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 500)); // Wait before retry
      }
    }
  }
  
  // All retries failed - try loading a fallback/error page
  console.error(`[WebContentsView] Navigation failed after ${maxRetries} attempts: ${url}`);
  try {
    const fallbackUrl = `data:text/html,<html><head><title>Navigation Error</title></head><body style="font-family:sans-serif;padding:40px;text-align:center;background:#fafafa;"><h2 style="color:#dc2626;">⚠️ Could not load this page</h2><p>The page <strong>${escapeHtml(url.substring(0, 50))}...</strong> could not be loaded.</p><p style="color:#666;">This may be due to a network issue or the site being unavailable.</p><button onclick="window.history.back()" style="padding:12px 24px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;margin-top:20px;">Go Back</button></body></html>`;
    await view.webContents.loadURL(fallbackUrl);
  } catch (fallbackErr) {
    console.error('[WebContentsView] Even fallback page failed:', fallbackErr);
  }
});

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

ipcMain.on('browser-view-go-back', () => {
  const view = tabViews.get(activeTabId);
  if (view && view.webContents.canGoBack()) view.webContents.goBack();
});

ipcMain.on('browser-view-go-forward', () => {
  const view = tabViews.get(activeTabId);
  if (view && view.webContents.canGoForward()) view.webContents.goForward();
});

ipcMain.on('browser-view-reload', () => {
  const view = tabViews.get(activeTabId);
  if (view) view.webContents.reload();
});

ipcMain.on('change-zoom', (event, deltaY) => {
  const view = tabViews.get(activeTabId);
  if (view) {
    const currentZoom = view.webContents.getZoomFactor();
    const newZoom = deltaY < 0 ? currentZoom + 0.1 : currentZoom - 0.1;
    // Clamp zoom factor between 0.5x and 3x
    if (newZoom >= 0.5 && newZoom <= 3.0) {
      view.webContents.setZoomFactor(newZoom);
    }
  }
});

ipcMain.on('reset-zoom', () => {
  const view = tabViews.get(activeTabId);
  if (view) {
    view.webContents.setZoomFactor(1.0);
  }
});

ipcMain.on('open-dev-tools', () => {
  const view = tabViews.get(activeTabId);
  if (view) view.webContents.openDevTools({ mode: 'detach' });
  else if (mainWindow) mainWindow.webContents.openDevTools();
});

ipcMain.handle('execute-javascript', async (event, code) => {
  const view = tabViews.get(activeTabId);
  if (view) {
    try {
      return await view.webContents.executeJavaScript(code);
    } catch (e) {
      console.error("Execute JS failed:", e);
      return null;
    }
  }
  return null;
});

ipcMain.handle('get-browser-view-url', () => {
  const view = tabViews.get(activeTabId);
  return view ? view.webContents.getURL() : '';
});

ipcMain.handle('capture-page-html', async () => {
  const view = tabViews.get(activeTabId);
  if (!view) return "";
  return await view.webContents.executeJavaScript('document.documentElement.outerHTML');
});

// ============================================================================
// SCREEN CAPTURE - For OCR and cross-app clicking
// ============================================================================
ipcMain.removeHandler('capture-browser-view-screenshot');
ipcMain.handle('capture-browser-view-screenshot', async () => {
  const view = tabViews.get(activeTabId);
  if (!view) {
    console.warn('[Screenshot] No active tab found');
    return null;
  }
  
  // ERROR-PROOFING: Retry logic for screenshot capture
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Wait for page to be ready and rendering to complete
      await new Promise(resolve => setTimeout(resolve, 200 * attempt));
      
      const image = await view.webContents.capturePage();
      if (!image || image.isEmpty()) {
        console.warn(`[Screenshot] Attempt ${attempt}: Image is empty, retrying...`);
        if (attempt < maxRetries) await new Promise(r => setTimeout(r, 300));
        continue;
      }
      
      // Convert NativeImage to PNG buffer then to base64 data URL
      const pngBuffer = image.toPNG();
      if (!pngBuffer || pngBuffer.length === 0) {
        console.warn(`[Screenshot] Attempt ${attempt}: PNG conversion failed, retrying...`);
        if (attempt < maxRetries) await new Promise(r => setTimeout(r, 300));
        continue;
      }
      
      const base64 = pngBuffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;
      console.log(`[Screenshot] Success on attempt ${attempt}, size: ${pngBuffer.length} bytes`);
      return dataUrl;
    } catch (e) {
      console.error(`[Screenshot] Attempt ${attempt} failed:`, e.message);
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, 300));
    }
  }
  
  console.error('[Screenshot] All capture attempts failed');
  
  // Fallback: Try to get screenshot via JPEG which is sometimes more reliable
  try {
    const image = await view.webContents.capturePage();
    if (image && !image.isEmpty()) {
      const jpegBuffer = image.toJPEG(90);
      if (jpegBuffer && jpegBuffer.length > 0) {
        return `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;
      }
    }
  } catch (e2) {
    console.error('[Screenshot] JPEG fallback also failed:', e2.message);
  }
  
  return null;
});

ipcMain.handle('capture-screen-region', async (event, bounds) => {
  console.log('[Screen] Capturing region:', bounds);
  const tempFile = path.join(os.tmpdir(), `capture_${Date.now()}.png`);
  try {
    await captureScreenRegion(bounds, tempFile);
    const imageBuffer = fs.readFileSync(tempFile);
    const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;
    return { success: true, path: tempFile, image: base64Image };
  } catch (e) {
    console.error('[Screen] Capture failed:', e);
    return { success: false, error: e.message };
  }
});



/**
 * Maps OCR result coordinates (from Tesseract) to screen coordinates.
 * When the capture region is a subset of the screen, adds the capture offset.
 * @param {Object} ocrResult - Tesseract word result with bbox: { x0, y0, x1, y1 }
 * @param {Object} captureRegion - { x, y, width, height } - screen region that was captured
 * @returns {{ x: number, y: number, width: number, height: number }} screen coordinates
 */
function mapOcrCoordsToScreenCoords(ocrResult, captureRegion) {
  const box = ocrResult.bbox || ocrResult.box || {};
  const x0 = box.x0 ?? box.x ?? 0;
  const y0 = box.y0 ?? box.y ?? 0;
  const x1 = box.x1 ?? (box.x || 0) + (box.width || 0);
  const y1 = box.y1 ?? (box.y || 0) + (box.height || 0);
  const width = x1 - x0;
  const height = y1 - y0;
  const screenX = (captureRegion?.x ?? 0) + x0;
  const screenY = (captureRegion?.y ?? 0) + y0;
  return { x: Math.round(screenX), y: Math.round(screenY), width: Math.round(width), height: Math.round(height) };
}

/**
 * find-and-click-text: Captures the primary screen, runs OCR, finds target text, and clicks it.
 * Uses Tesseract.js for OCR and robotjs for mouse simulation.
 * NOTE: On macOS, Accessibility permission is required for robotjs to control the mouse.
 * On Windows/Linux, may require running with appropriate privileges.
 */
ipcMain.handle('find-and-click-text', async (event, targetText) => {
  if (!targetText || typeof targetText !== 'string' || targetText.trim().length === 0) {
    return { success: false, error: 'Target text is required.' };
  }

  const searchText = targetText.trim().toLowerCase();

  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const scaleFactor = primaryDisplay.scaleFactor || 1;
    const thumbnailSize = {
      width: Math.min(4096, Math.round(width * scaleFactor)),
      height: Math.min(4096, Math.round(height * scaleFactor))
    };

    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize });
    const primaryDisplayId = String(primaryDisplay.id);
    const primaryScreenSource = sources.find(s => s.display_id === primaryDisplayId);

    if (!primaryScreenSource || !primaryScreenSource.thumbnail) {
      return { success: false, error: 'Could not capture primary screen.' };
    }

    const tempDir = app.getPath('temp');
    const tempPath = path.join(tempDir, `comet-ocr-${Date.now()}.png`);

    try {
      const pngBuffer = primaryScreenSource.thumbnail.toPNG();
      fs.writeFileSync(tempPath, pngBuffer);
    } catch (writeErr) {
      console.error('[Main] Failed to write temp image:', writeErr);
      return { success: false, error: 'Failed to prepare image for OCR.' };
    }

    if (!tesseractWorker) {
      console.log('[Main] Initializing Tesseract.js worker on-demand...');
      try {
        tesseractWorker = await createWorker('eng');
        console.log('[Main] Tesseract.js worker initialized.');
      } catch (e) {
        console.error('[Main] Failed to initialize Tesseract worker:', e);
        try { fs.unlinkSync(tempPath); } catch (e) { }
        tesseractWorker = null; // Ensure it's null so we retry next time
        return { success: false, error: 'OCR worker initialization failed.' };
      }
    }

    const captureRegion = { x: 0, y: 0, width: thumbnailSize.width, height: thumbnailSize.height };

    let data;
    try {
      const result = await tesseractWorker.recognize(tempPath);
      data = result.data;
    } catch (workerError) {
      console.error('[Main] Tesseract recognition failed:', workerError);
      // Force re-initialization next time
      try { await tesseractWorker.terminate(); } catch (e) { }
      tesseractWorker = null;
      try { fs.unlinkSync(tempPath); } catch (e) { }
      return { success: false, error: 'OCR failed. Please try again.' };
    }

    try { fs.unlinkSync(tempPath); } catch (e) { }

    const words = data?.words || [];
    let bestMatch = null;

    for (const word of words) {
      const text = (word.text || '').toLowerCase();
      if (text.includes(searchText) || searchText.includes(text)) {
        bestMatch = word;
        break;
      }
    }

    if (!bestMatch) {
      return { success: false, error: `Text "${targetText}" not found on screen.`, foundText: data?.text?.substring(0, 200) };
    }

    const screenCoords = mapOcrCoordsToScreenCoords(bestMatch, captureRegion);
    const centerX = Math.round(screenCoords.x + screenCoords.width / 2);
    const centerY = Math.round(screenCoords.y + screenCoords.height / 2);

    if (!robot) {
      return { success: false, error: 'Find & Click requires robotjs. Run: npm install robotjs, then electron-rebuild.' };
    }

      try {
        await performRobotClick({ x: centerX, y: centerY });
        console.log(`[Main] Find-and-click: clicked at (${centerX}, ${centerY}) for "${targetText}" with robust helper`);
        return { success: true, x: centerX, y: centerY };
      } catch (robotErr) {
        console.error('[Main] robotjs error (may need Accessibility permission on macOS):', robotErr);
        return { success: false, error: `Could not simulate click. ${process.platform === 'darwin' ? 'Ensure Accessibility permission is granted.' : robotErr.message}` };
      }
  } catch (error) {
    console.error('[Main] find-and-click-text failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-offline-page', async (event, { url, title, html }) => {
  console.log(`[Offline] Saved ${title}`);
  return true;
});

ipcMain.handle('share-device-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (!result.canceled) return { path: result.filePaths[0], success: true };
  return { success: false };
});

ipcMain.handle('trigger-download', async (event, url, suggestedFilename) => {
  if (mainWindow && url) {
    mainWindow.webContents.downloadURL(url, { filename: suggestedFilename });
    return { success: true };
  }
  return { success: false, error: 'Download failed: invalid URL or mainWindow not available.' };
});

ipcMain.handle('get-ai-memory', async () => readMemory());
ipcMain.on('add-ai-memory', (event, entry) => appendToMemory(entry));

const vectorStorePath = path.join(app.getPath('userData'), 'vector_store.json');
ipcMain.handle('save-vector-store', async (event, data) => {
  try {
    fs.writeFileSync(vectorStorePath, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("Failed to save vector store:", e);
    return false;
  }
});

ipcMain.handle('load-vector-store', async () => {
  try {
    if (fs.existsSync(vectorStorePath)) {
      return JSON.parse(fs.readFileSync(vectorStorePath, 'utf-8'));
    }
  } catch (e) {
    console.error("Failed to load vector store:", e);
  }
  return [];
});

const llmProviders = [
  { id: 'google', name: 'Google Gemini (3.1/2.0)' },
  { id: 'google-flash', name: 'Google Gemini 3.0 Flash (Fast)' },
  { id: 'openai', name: 'OpenAI (o1/o3/GPT-4o)' },
  { id: 'anthropic', name: 'Anthropic Claude (3.7/3.5)' },
  { id: 'xai', name: 'xAI Grok (4/3)' },
  { id: 'groq', name: 'Groq (LPU Speed)' },
  { id: 'ollama', name: 'Ollama (Local AI)' }
];
let activeLlmProvider = store.get('active_llm_provider') || 'ollama';
const llmConfigs = {
  ollama: {
    baseUrl: store.get('ollama_base_url') || 'http://127.0.0.1:11434',
    model: store.get('ollama_model') || 'deepseek-r1:1.5b',
    localLlmMode: store.get('local_llm_mode') || 'normal'
  },
  google: {
    apiKey: store.get('gemini_api_key') || '',
    model: store.get('gemini_model') || 'gemini-2.0-pro-exp-02-05'
  },
  'google-flash': {
    apiKey: store.get('gemini_api_key') || '',
    model: store.get('gemini_model') || 'gemini-2.0-flash'
  },
  openai: {
    apiKey: store.get('openai_api_key') || '',
    model: store.get('openai_model') || 'gpt-4o'
  },
  anthropic: {
    apiKey: store.get('anthropic_api_key') || '',
    model: store.get('anthropic_model') || 'claude-3-5-sonnet-latest'
  },
  xai: {
    apiKey: store.get('xai_api_key') || '',
    model: store.get('xai_model') || 'grok-2-latest'
  },
  groq: {
    apiKey: store.get('groq_api_key') || '',
    model: store.get('groq_model') || 'llama-3.3-70b-versatile'
  }
};

ipcMain.handle('llm-get-available-providers', () => llmProviders);
ipcMain.handle('llm-set-active-provider', (event, providerId) => {
  activeLlmProvider = providerId;
  store.set('active_llm_provider', providerId);
  return true;
});
ipcMain.handle('llm-configure-provider', (event, providerId, options) => {
  llmConfigs[providerId] = { ...llmConfigs[providerId], ...options };

  // Persist to store for survivors
  if (providerId === 'google' || providerId === 'google-flash') {
    if (options.apiKey) store.set('gemini_api_key', options.apiKey);
    if (options.model) store.set('gemini_model', options.model);
  }
  if (providerId === 'openai') {
    if (options.apiKey) store.set('openai_api_key', options.apiKey);
    if (options.model) store.set('openai_model', options.model);
  }
  if (providerId === 'anthropic') {
    if (options.apiKey) store.set('anthropic_api_key', options.apiKey);
    if (options.model) store.set('anthropic_model', options.model);
  }
  if (providerId === 'xai') {
    if (options.apiKey) store.set('xai_api_key', options.apiKey);
    if (options.model) store.set('xai_model', options.model);
  }
  if (providerId === 'groq') {
    if (options.apiKey) store.set('groq_api_key', options.apiKey);
    if (options.model) store.set('groq_model', options.model);
  }
  if (providerId === 'ollama') {
    if (options.baseUrl) store.set('ollama_base_url', options.baseUrl);
    if (options.model) store.set('ollama_model', options.model);
    if (options.localLlmMode !== undefined) store.set('local_llm_mode', options.localLlmMode);
  }

  return true;
});

// IPC handler to get stored API keys for frontend initialization
ipcMain.handle('get-stored-api-keys', () => {
  return {
    openai_api_key: store.get('openai_api_key') || '',
    gemini_api_key: store.get('gemini_api_key') || '',
    anthropic_api_key: store.get('anthropic_api_key') || '',
    groq_api_key: store.get('groq_api_key') || '',
    xai_api_key: store.get('xai_api_key') || '',
    ollama_base_url: store.get('ollama_base_url') || 'http://127.0.0.1:11434',
    ollama_model: store.get('ollama_model') || 'deepseek-r1:1.5b',
    ollama_enabled: store.get('ollama_enabled') !== false,
    active_llm_provider: store.get('active_llm_provider') || 'ollama',
  };
});

// Redundant search-applications handler removed (see line 3387)


// IPC handler to set MCP server port dynamically
ipcMain.on('set-mcp-server-port', (event, port) => {
  mcpServerPort = port;
  console.log(`MCP Server port updated to: ${mcpServerPort}`);
});

ipcMain.handle('extract-page-content', async () => {
  const view = tabViews.get(activeTabId);
  if (!view) return { error: 'No active view' };
  try {
    const content = await view.webContents.executeJavaScript(`
      (() => {
        try {
          const clone = document.body.cloneNode(true);
          const elementsToRemove = clone.querySelectorAll('script, style, nav, footer, header, noscript, svg');
          elementsToRemove.forEach(e => e.remove());
          
          return clone.innerText
            .replace(/\\s+/g, ' ')
            .replace(/[\\r\\n]+/g, '\\n')
            .trim() || document.body.innerText;
        } catch(e) {
          return document.body ? document.body.innerText : "";
        }
      })()
    `);
    return { content };
  } catch (e) {
    return { error: e.message };
  }
});

// Secure DOM Extraction with filtering and injection detection
ipcMain.handle('extract-secure-dom', async () => {
  const view = tabViews.get(activeTabId);
  if (!view) return { error: 'No active view', content: '', elements: [], metadata: {} };

  try {
    const result = await view.webContents.executeJavaScript(`
      (() => {
        const BLOCKED_TAGS = ['script', 'style', 'noscript', 'iframe', 'object', 'embed', 'applet', 'form', 'input', 'button', 'select', 'textarea'];
        const BLOCKED_CLASSES = [/nav/i, /footer/i, /header/i, /sidebar/i, /menu/i, /popup/i, /modal/i, /overlay/i, /cookie/i, /banner/i, /advertisement/i];
        const PII_PATTERNS = [
          /\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b/g,
          /\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b/g,
          /Bearer\\s+[A-Za-z0-9\\-_]+\\.[A-Za-z0-9\\-_]+\\.[A-Za-z0-9\\-_]+/gi,
          /session[_-]?id["\\s:=]+["']?[A-Za-z0-9\\-_]+["']?/gi,
        ];
        
        function shouldBlock(el) {
          if (BLOCKED_TAGS.includes(el.tagName.toLowerCase())) return true;
          for (const p of BLOCKED_CLASSES) {
            if (p.test(el.className) || p.test(el.id)) return true;
          }
          return false;
        }
        
        function sanitizeText(text) {
          let result = text;
          for (const p of PII_PATTERNS) {
            result = result.replace(p, '[REDACTED]');
          }
          return result.replace(/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]/g, '').replace(/\\s+/g, ' ').trim();
        }
        
        function extractElements(el, path = '') {
          if (shouldBlock(el)) return [];
          const tag = el.tagName.toLowerCase();
          const xpath = path ? path + '/' + tag : '//' + tag;
          
          let text = '';
          const children = [];
          
          for (const node of el.childNodes) {
            if (node.nodeType === 3) text += node.textContent || '';
            else if (node.nodeType === 1) {
              const childResults = extractElements(node, xpath);
              children.push(...childResults);
            }
          }
          
          const sanitized = sanitizeText(text);
          if (!sanitized.trim() && children.length === 0) return [];
          
        const attributes = {};
        if (el.attributes) {
          for (const attr of el.attributes) {
            attributes[attr.name] = attr.value;
          }
        }

        return [{
          tag,
          text: sanitized,
          xpath,
          attributes,
          children: children.map(c => ({
            tag: c.tag,
            text: c.text,
            xpath: c.xpath,
            attributes: c.attributes,
            children: c.children
          }))
        }];
      }
        
        const main = document.querySelector('main, article, [role="main"], #content, #main, .content') || document.body;
        const elements = [];
        for (const child of main.children) {
          elements.push(...extractElements(child));
        }
        
        const content = elements.map(e => e.text).filter(Boolean).join('\\n');
        const fullText = document.body.innerText || content;
        
        return {
          content: sanitizeText(fullText),
          elements,
          url: window.location.href,
          title: document.title,
          scriptsRemoved: document.querySelectorAll('script').length,
          stylesRemoved: document.querySelectorAll('style').length,
          navRemoved: document.querySelectorAll('nav').length
        };
      })()
    `);

    return {
      content: result.content || '',
      elements: result.elements || [],
      metadata: {
        url: result.url || '',
        title: result.title || '',
        timestamp: Date.now(),
        injectionDetected: false,
        filterStats: {
          piiRemoved: (result.content || '').match(/\[REDACTED\]/g)?.length || 0,
          scriptsRemoved: result.scriptsRemoved || 0,
          stylesRemoved: result.stylesRemoved || 0,
          navRemoved: result.navRemoved || 0,
          adsRemoved: 0
        }
      }
    };
  } catch (e) {
    console.error('[SecureDOM] Extraction failed:', e);
    return { error: e.message, content: '', elements: [], metadata: {} };
  }
});

// DOM Search within current page
ipcMain.handle('search-dom', async (event, query) => {
  const view = tabViews.get(activeTabId);
  if (!view) return { error: 'No active view', results: [] };

  if (!query || typeof query !== 'string') {
    return { error: 'Invalid query', results: [] };
  }

  try {
    const results = await view.webContents.executeJavaScript(`
      (() => {
        const query = ${JSON.stringify(query)};
        const searchLower = query.toLowerCase();
        const results = [];
        
        function walk(el, path = '') {
          if (['script', 'style', 'noscript', 'iframe', 'nav', 'footer', 'header'].includes(el.tagName.toLowerCase())) return;
          
          const tag = el.tagName.toLowerCase();
          const xpath = path ? path + '/' + tag : '//' + tag;
          
          let text = '';
          for (const node of el.childNodes) {
            if (node.nodeType === 3) text += node.textContent || '';
            else if (node.nodeType === 1) walk(node, xpath);
          }
          
          const textLower = text.toLowerCase();
          const idx = textLower.indexOf(searchLower);
          
          if (idx !== -1) {
            const start = Math.max(0, idx - 40);
            const end = Math.min(text.length, idx + query.length + 40);
            const context = text.slice(start, end);
            
            let score = 10;
            if (textLower.startsWith(searchLower)) score += 20;
            if (textLower.includes(' ' + searchLower)) score += 10;
            if (text.length < 200) score += 15;
            
            results.push({
              text: text.slice(Math.max(0, idx - 20), idx) + '[[' + text.slice(idx, idx + query.length) + ']]' + text.slice(idx + query.length, idx + query.length + 20),
              context: context,
              xpath: xpath,
              score: score,
              tag: tag
            });
          }
        }
        
        walk(document.body);
        
        return results.sort((a, b) => b.score - a.score).slice(0, 15);
      })()
    `, query);

    return { results: results || [], query };
  } catch (e) {
    console.error('[SecureDOM] Search failed:', e);
    return { error: e.message, results: [] };
  }
});

ipcMain.handle('get-selected-text', async () => {
  const view = tabViews.get(activeTabId);
  if (!view) return '';
  try {
    const selectedText = await view.webContents.executeJavaScript(`window.getSelection().toString();`);
    return selectedText;
  } catch (e) {
    console.error("Failed to get selected text from BrowserView:", e);
    return '';
  }
});

ipcMain.on('send-to-ai-chat-input', (event, text) => {
  if (mainWindow) {
    mainWindow.webContents.send('ai-chat-input-text', text);
  }
});

ipcMain.on('save-google-config', (event, { clientId, clientSecret, redirectUri }) => {
  if (clientId) store.set('google_client_id', clientId);
  if (clientSecret) store.set('google_client_secret', clientSecret);
  if (redirectUri) store.set('google_redirect_uri', redirectUri);
});

ipcMain.handle('get-google-config', () => {
  return {
    clientId: store.get('google_client_id'),
    clientSecret: store.get('google_client_secret'),
    redirectUri: store.get('google_redirect_uri')
  };
});

ipcMain.on('send-ai-overview-to-sidebar', (event, data) => {
  latestAiOverviewData = data;
  broadcastAiOverviewData();
});

ipcMain.handle('get-ai-overview-data', () => latestAiOverviewData);

ipcMain.on('send-download-panel-data', (event, data) => {
  latestDownloadPanelData = data || [];
  broadcastDownloadPanelData();
});

ipcMain.handle('get-download-panel-data', () => latestDownloadPanelData);

ipcMain.on('close-ai-overview', () => {
  latestAiOverviewData = null;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ai-overview-closed');
  }

  const popup = popupWindows.get('ai-overview');
  if (popup && !popup.isDestroyed()) {
    popup.close();
  }

  if (popupViews.has('ai-overview')) {
    destroyPopupView('ai-overview');
  }
});

ipcMain.handle('llm-generate-chat-content', async (event, messages, options = {}) => {
  return await AiGateway.generate(messages, options);
});

ipcMain.on('llm-stream-chat-content', (event, messages, options = {}) => {
  AiGateway.stream(event, messages, options);
});

// Ollama Integration:
// For ollama to work, the Ollama application must be installed on the user's system
// and its executable (`ollama`) must be available in the system's PATH.
// This allows `child_process.spawn('ollama', ...)` to find and execute the Ollama CLI.
// Users should install the latest stable version of Ollama for their respective OS (Windows, macOS, Linux).
// For Windows, it's expected that the official installer is used which adds ollama to PATH.
ipcMain.on('ollama-pull-model', (event, modelName) => {
  const ollama = spawn('ollama', ['pull', modelName]);

  ollama.stdout.on('data', (data) => {
    event.sender.send('ollama-pull-progress', { model: modelName, output: data.toString(), done: false });
  });

  ollama.stderr.on('data', (data) => {
    event.sender.send('ollama-pull-progress', { model: modelName, output: data.toString(), done: false });
  });

  ollama.on('close', (code) => {
    event.sender.send('ollama-pull-progress', { model: modelName, output: '', done: true, success: code === 0 });
  });
});

ipcMain.handle('ollama-import-model', async (event, { modelName, filePath }) => {
  try {
    if (!fs.existsSync(filePath)) return { success: false, error: 'File not found' };

    const modelfileContent = `FROM "${filePath.replace(/\\/g, '/')}"`;
    const modelfilePath = path.join(app.getPath('userData'), `Modelfile_${modelName}`);
    fs.writeFileSync(modelfilePath, modelfileContent);

    return new Promise((resolve) => {
      const ollama = spawn('ollama', ['create', modelName, '-f', modelfilePath]);
      let errorLog = '';

      ollama.stderr.on('data', (data) => {
        errorLog += data.toString();
      });

      ollama.on('close', (code) => {
        // Cleanup
        try { fs.unlinkSync(modelfilePath); } catch (e) { }

        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: errorLog || 'Ollama create failed' });
        }
      });
    });
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('select-local-file', async (event, options = {}) => {
  const defaultOptions = {
    properties: ['openFile'],
    filters: [{ name: 'All Files', extensions: ['*'] }]
  };

  const dialogOptions = { ...defaultOptions, ...options };

  const result = await dialog.showOpenDialog(mainWindow, dialogOptions);
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Safe commands whitelist - these only need permission once, then permanently allowed
const SAFE_COMMANDS = new Set([
  'ls', 'ls -la', 'ls -l', 'ls -a', 'ls -R', 'ls -lh', 'ls -1', 'ls -la --color',
  'cat', 'cat -n', 'head', 'head -n', 'tail', 'tail -n', 'less', 'more',
  'cp', 'cp -r', 'cp -i', 'cp -v', 'mv', 'mv -i', 'mv -v',
  'mkdir', 'mkdir -p', 'rmdir', 'touch', 'ln', 'ln -s',
  'pwd', 'cd', 'echo', 'printf', 'date', 'whoami', 'hostname',
  'find', 'grep', 'grep -r', 'which', 'whereis', 'type',
  'chmod', 'chown', 'chgrp', 'du', 'df', 'free', 'top',
  'tar', 'tar -xvf', 'tar -cvf', 'tar -czvf', 'tar -xzvf',
  'unzip', 'zip', 'gunzip', 'gzip',
  'git', 'git status', 'git log', 'git diff', 'git pull', 'git push',
  'npm', 'npm install', 'npm run', 'npm start', 'npm test',
  'yarn', 'yarn install', 'yarn start',
  'python', 'python3', 'pip', 'pip3',
  'node', 'node -v', 'npx',
  'curl', 'wget',
  'open', 'xdg-open',
  'man', 'info', 'help',
]);

// AI-generated command explanations
function explainCommand(command) {
  const cmd = command.trim().split(/\s+/)[0].toLowerCase();
  const explanations = {
    ls: "Lists directory contents - shows files and folders",
    cat: "Displays file contents - reads and shows text files",
    head: "Shows first lines of a file",
    tail: "Shows last lines of a file",
    less: "Allows scrolling through file contents",
    more: "Displays file contents page by page",
    cp: "Copies files or directories",
    mv: "Moves or renames files or directories",
    mkdir: "Creates new directories/folders",
    rmdir: "Removes empty directories",
    touch: "Creates empty files or updates timestamps",
    rm: "Removes/deletes files or directories",
    pwd: "Prints current working directory",
    cd: "Changes current directory",
    echo: "Outputs text to terminal",
    find: "Searches for files in a directory tree",
    grep: "Searches for patterns in files",
    chmod: "Changes file permissions",
    chown: "Changes file ownership",
    du: "Shows disk usage of files/directories",
    df: "Shows disk space usage",
    tar: "Archives multiple files into one",
    zip: "Compresses files into ZIP archive",
    unzip: "Extracts ZIP archives",
    git: "Git version control - manages code history",
    npm: "Node package manager - installs JS packages",
    node: "Runs JavaScript code",
    python: "Runs Python scripts",
    pip: "Python package installer",
    curl: "Downloads files from URLs",
    wget: "Downloads files from URLs",
    open: "Opens files/folders with default application",
  };
  return explanations[cmd] || "Unknown command - purpose unclear";
}

function analyzeCommandRisk(command) {
  const cmdLower = command.toLowerCase();
  const risks = [];
  let harmLevel = 'safe';

  if (cmdLower.includes('rm -rf') || cmdLower.includes('rm -r /') || cmdLower.includes('del /f /s /q')) {
    risks.push("⚠️ CRITICAL: Recursive delete - can wipe entire filesystem!");
    harmLevel = 'critical';
  } else if (cmdLower.includes('rm ') || cmdLower.includes('del ') || cmdLower.includes('rmdir ')) {
    risks.push("• DELETE: May permanently remove files");
    harmLevel = 'high';
  }
  if (cmdLower.includes('format ') || cmdLower.includes('mkfs') || cmdLower.includes('fdisk')) {
    risks.push("⚠️ CRITICAL: Disk formatting - can destroy all data!");
    harmLevel = 'critical';
  }
  if (cmdLower.includes('curl ') || cmdLower.includes('wget ') || cmdLower.includes('ssh ')) {
    risks.push("• NETWORK: Accesses internet/remote servers");
    harmLevel = 'medium';
  }
  if (cmdLower.includes('sudo ') || cmdLower.includes('su ')) {
    risks.push("⚠️ ROOT: Grants admin/root privileges");
    harmLevel = 'high';
  }
  if (cmdLower.includes('shutdown') || cmdLower.includes('reboot') || cmdLower.includes('poweroff')) {
    risks.push("⚠️ POWER: Can shut down or restart the system");
    harmLevel = 'high';
  }
  if (cmdLower.includes('kill ') || cmdLower.includes('taskkill') || cmdLower.includes('pkill')) {
    risks.push("• TERMINATE: Can stop running processes");
    harmLevel = 'medium';
  }
  if (cmdLower.includes('dd ')) {
    risks.push("⚠️ CRITICAL: Low-level disk operations - very dangerous!");
    harmLevel = 'critical';
  }
  if (cmdLower.includes('chmod 777') || cmdLower.includes('chmod -r')) {
    risks.push("• PERMISSIONS: Changes file access rights");
    harmLevel = 'medium';
  }
  if (cmdLower.includes('> /dev/') || cmdLower.includes('2>&1')) {
    risks.push("• REDIRECT: Redirects output - may overwrite files");
    harmLevel = 'low';
  }

  const isSafeCmd = SAFE_COMMANDS.has(cmdLower) || Array.from(SAFE_COMMANDS).some(s => cmdLower.startsWith(s + ' '));
  if (isSafeCmd && harmLevel === 'safe') {
    return { description: explainCommand(command), risks: ["✓ Safe read/write operation"], harmLevel: 'safe', isWhitelisted: true };
  }

  return { description: explainCommand(command), risks, harmLevel, isWhitelisted: isSafeCmd };
}

async function generateShellApprovalQR(command) {
  const deviceId = os.hostname();
  const token = Math.random().toString(36).substring(2, 10);
  const pin = Math.floor(100000 + Math.random() * 900000).toString();
  const deepLinkUrl = `comet-ai://shell-approve?id=${token}&deviceId=${encodeURIComponent(deviceId)}&pin=${pin}&cmd=${encodeURIComponent(command)}`;
  try {
    const qrImage = await QRCode.toDataURL(deepLinkUrl);
    return { qrImage, pin, token };
  } catch (err) {
    console.error('[Main] Failed to generate Shell Approval QR:', err);
    return { qrImage: null, pin, token };
  }
}

async function requestShellApproval(command, riskLevel, reason) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const requestId = `shell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const qrPayload = await generateShellApprovalQR(command);
  const payload = {
    requestId,
    command,
    risk: riskLevel || 'medium',
    reason: reason || 'A scheduled automation needs your approval.',
    highRiskQr: JSON.stringify(qrPayload),
  };
  try {
    mainWindow.webContents.send('automation-shell-approval', payload);
  } catch (error) {
    console.error('[Main] Failed to send shell approval request:', error);
    return false;
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (shellApprovalResolvers.has(requestId)) {
        shellApprovalResolvers.delete(requestId);
        resolve(false);
      }
    }, 120000);

    shellApprovalResolvers.set(requestId, (allowed) => {
      clearTimeout(timeout);
      resolve(allowed);
    });
  });
}

async function checkShellPermission(command) {
  if (!mainWindow) return false;

  const cmdName = command.trim().split(' ')[0];
  const permKeyCmd = `SHELL_COMMAND:${cmdName}`;
  const permKeyFull = `SHELL_COMMAND:${command}`;

  // Check if command type is allowed (e.g., all mv commands)
  if (permissionStore.isGranted(permKeyCmd)) {
    return true;
  }
  // Check if exact command is allowed
  if (permissionStore.isGranted(permKeyFull)) {
    return true;
  }

  const analysis = analyzeCommandRisk(command);

  // Use auto-approve settings from permission store
  if (permissionStore.canAutoExecute(command, analysis.harmLevel)) {
    console.log(`[Shell] Auto-approved (${analysis.harmLevel}): ${command}`);
    return true;
  }

  console.log(`[Shell] Requesting approval (${analysis.harmLevel}): ${command}`);
  return await requestShellApproval(command, analysis.harmLevel, 'Automation requested this shell action.');
}

/**
 * Command Validation Layer
 * Blocks dangerous shell commands and sanitizes inputs.
 */
function validateCommand(command) {
  if (!command || typeof command !== 'string') {
    throw new Error('Invalid command format');
  }

  // Dangerous command patterns
  const forbidden = [
    'rm ', 'sudo ', 'shutdown ', 'mkfs ', 'format ', 'dd ',
    'char ', '> /', ':(){ :|:& };:', 'mv /', 'poweroff', 'reboot'
  ];

  const isDangerous = forbidden.some(f => command.toLowerCase().includes(f));
  if (isDangerous) {
    console.warn(`[Security] Blocked dangerous command execution attempt: ${command}`);
    throw new Error(`Security Exception: Blocked dangerous command: ${command}`);
  }

  // Sanitize input (basic)
  return command.trim().slice(0, 1000); // Limit size
}

ipcMain.handle('execute-shell-command', async (event, { rawCommand, preApproved }) => {
  // Check if already granted permission (skip the blocking dialog - let user configure in Settings)
  // Permission dialog removed - user can configure in Settings panel

  let command;
  try {
    command = validateCommand(rawCommand);
  } catch (e) {
    return { success: false, error: e.message };
  }

  if (!preApproved) {
    const authorized = await checkShellPermission(command);
    if (!authorized) {
      return { success: false, error: 'User blocked the command.' };
    }
  }

  return new Promise((resolve) => {
    const execOptions = { timeout: 30000 };
    
    exec(command, execOptions, (error, stdout, stderr) => {
      if (process.platform === 'darwin' && !error) {
        const macosPermKey = 'MACOS_TERMINAL_PERMISSION';
        if (!permissionStore.isGranted(macosPermKey)) {
          permissionStore.grant(macosPermKey, 'execute', 'macOS Shell access', false);
        }
      }
      
      if (error) {
        if (error.message.includes('Operation not permitted')) {
          resolve({ success: false, error: 'Permission denied! Please go to Settings > Permissions in Comet-AI to configure macOS system permissions.', output: stderr });
        } else {
          resolve({ success: false, error: error.message, output: stderr });
        }
      } else {
        resolve({ success: true, output: stdout.trim(), error: stderr });
      }
    });
  });
});

// OS-Specific System Controls — dedicated IPC handlers (bypass security dialog)

ipcMain.handle('set-volume', async (event, level) => {
  // level: 0-100
  if (process.platform === 'win32') {
    // Use PowerShell with Windows Audio API (no nircmd needed)
    const clamped = Math.max(0, Math.min(100, parseInt(level, 10) || 0));
    const script = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
  int j();
  int GetMasterVolumeLevelScalar(out float pfLevel);
  int k(); int l(); int m(); int n();
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext);
  int GetMute(out bool pbMute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref Guid id, int clsCtx, IntPtr activationParams, out IAudioEndpointVolume aev); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
public class Audio {
  static Guid IID_IAudioEndpointVolume = typeof(IAudioEndpointVolume).GUID;
  public static void SetVolume(double level) {
    var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
    IMMDevice dev; enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
    IAudioEndpointVolume epv;
    dev.Activate(ref IID_IAudioEndpointVolume, 23, IntPtr.Zero, out epv);
    epv.SetMasterVolumeLevelScalar((float)(level / 100.0), Guid.Empty);
  }
}
'@
[Audio]::SetVolume(${clamped})
Write-Output "Volume set to ${clamped}"
`;
    return new Promise((resolve) => {
      // Escape script for cmd/powershell
      const escapedScript = script.replace(/\n/g, ' ').replace(/"/g, '\\"');
      exec(`powershell -NoProfile -ExecutionPolicy Bypass -NonInteractive -Command "${escapedScript}"`,
        { timeout: 8000 },
        (err, stdout, stderr) => {
          if (err) {
            console.error('[Main] Windows Volume Error:', stderr);
            // Fallback: try nircmd if available
            exec(`nircmd.exe setsysvolume ${Math.round((clamped / 100) * 65535)}`, (err2) => {
              if (err2) resolve({ success: false, error: `Volume control failed: ${stderr || err.message}` });
              else resolve({ success: true, output: `Volume set to ${clamped}% via nircmd` });
            });
          } else {
            resolve({ success: true, output: stdout.trim() || `Volume set to ${clamped}%` });
          }
        }
      );
    });
  } else if (process.platform === 'darwin') {
    const clamped = Math.max(0, Math.min(100, parseInt(level, 10) || 0));
    return new Promise((resolve) => {
      exec(`osascript -e "set volume output volume ${clamped}"`, (err) => {
        if (err) resolve({ success: false, error: err.message });
        else resolve({ success: true, output: `Volume set to ${clamped}%` });
      });
    });
  } else {
    // Linux
    const clamped = Math.max(0, Math.min(100, parseInt(level, 10) || 0));
    return new Promise((resolve) => {
      exec(`amixer set 'Master' ${clamped}%`, (err, stdout) => {
        if (err) resolve({ success: false, error: err.message });
        else resolve({ success: true, output: stdout.trim() });
      });
    });
  }
});

ipcMain.handle('set-brightness', async (event, level) => {
  const clamped = Math.max(0, Math.min(100, parseInt(level, 10) || 50));

  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      // Try CIM first (modern), then WMI (legacy)
      const cmd = `powershell -NoProfile -NonInteractive -Command "$b = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods; if($b) { $b.WmiSetBrightness(1,${clamped}) } else { (Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,${clamped}) }"`;
      exec(cmd, { timeout: 8000 }, (err, stdout, stderr) => {
        if (err) resolve({ success: false, error: `Windows Brightness Error: ${stderr || err.message}` });
        else resolve({ success: true, output: `Brightness set to ${clamped}%` });
      });
    });
  } else if (process.platform === 'darwin') {
    return new Promise((resolve) => {
      // Try 'brightness' CLI first, then fallback to AppleScript Key Codes (Universal)
      exec(`brightness ${clamped / 100}`, (err) => {
        if (err) {
          // Fallback: Simulate Brightness-Down (145) and Brightness-Up (144) keys
          const steps = Math.round((clamped / 100) * 16);
          const osascript = `osascript -e 'tell application "System Events"' -e 'repeat 16 times' -e 'key code 145' -e 'end repeat' -e 'repeat ${steps} times' -e 'key code 144' -e 'end repeat' -e 'end tell'`;
          exec(osascript, (err2, stdout2, stderr2) => {
            if (err2) resolve({ success: false, error: `macOS Brightness Error: ${stderr2 || err2.message}` });
            else resolve({ success: true, output: `Brightness set to ${clamped}% via key codes` });
          });
        }
        else resolve({ success: true, output: `Brightness set to ${clamped}%` });
      });
    });
  } else {
    return new Promise((resolve) => {
      exec(`brightnessctl set ${clamped}%`, (err, stdout) => {
        if (err) resolve({ success: false, error: err.message });
        else resolve({ success: true, output: stdout.trim() });
      });
    });
  }
});



// Open External Application
// Well-known app name → Windows launch command mapping
const WINDOWS_APP_MAP = {
  'chrome': 'chrome',
  'google chrome': 'chrome',
  'firefox': 'firefox',
  'mozilla firefox': 'firefox',
  'edge': 'msedge',
  'microsoft edge': 'msedge',
  'notepad': 'notepad',
  'calculator': 'calc',
  'calc': 'calc',
  'whatsapp': 'explorer.exe shell:AppsFolder\\5319275A.WhatsApp_cv1g1gvanyjgm!App',
  'whats app': 'explorer.exe shell:AppsFolder\\5319275A.WhatsApp_cv1g1gvanyjgm!App',
  'spotify': 'explorer.exe shell:AppsFolder\\SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify',
  'telegram': 'explorer.exe shell:AppsFolder\\TelegramMessengerLLP.TelegramDesktop_t4vj0kkmcyv6r!TelegramDesktop',
  'vlc': 'vlc',
  'paint': 'mspaint',
  'word': 'winword',
  'excel': 'excel',
  'powerpoint': 'powerpnt',
  'outlook': 'outlook',
  'teams': 'explorer.exe shell:AppsFolder\\MicrosoftTeams_8wekyb3d8bbwe!MicrosoftTeams',
  'microsoft teams': 'explorer.exe shell:AppsFolder\\MicrosoftTeams_8wekyb3d8bbwe!MicrosoftTeams',
  'discord': 'discord',
  'zoom': 'zoom',
  'vscode': 'code',
  'vs code': 'code',
  'visual studio code': 'code',
  'terminal': 'wt',
  'cmd': 'cmd',
  'powershell': 'powershell',
  'task manager': 'taskmgr',
  'file explorer': 'explorer',
  'explorer': 'explorer',
  'settings': 'ms-settings:',
  'control panel': 'control',
};

ipcMain.handle('open-external-app', async (event, app_name_or_path) => {
  if (!app_name_or_path || typeof app_name_or_path !== 'string') {
    return { success: false, error: 'Invalid app path' };
  }

  // Basic sanitization
  app_name_or_path = app_name_or_path.trim().slice(0, 500);

  try {
    console.log('[Main] Opening external app:', app_name_or_path);

    // First try as a direct absolute path
    if (path.isAbsolute(app_name_or_path) && fs.existsSync(app_name_or_path)) {
      const result = await shell.openPath(app_name_or_path);
      if (!result) return { success: true };
    }

    const lowerName = (app_name_or_path || '').toLowerCase().trim();

    if (process.platform === 'win32') {
      // Look up well-known app name (handles UWP shell: paths and simple exe names)
      const winCmd = WINDOWS_APP_MAP[lowerName];

      return new Promise((resolve) => {
        let cmdToRun;

        if (winCmd) {
          // Known app — use mapped command directly
          if (winCmd.startsWith('explorer.exe shell:') || winCmd.startsWith('ms-settings:')) {
            // UWP / settings URI — pass to cmd start without extra quotes
            cmdToRun = `start "" ${winCmd}`;
          } else {
            // Plain executable — no surrounding quotes needed for short names
            cmdToRun = `start "" /b ${winCmd}`;
          }
        } else if (app_name_or_path.includes('.exe') || app_name_or_path.includes('\\') || app_name_or_path.includes('/')) {
          // Looks like a path or .exe — wrap in quotes
          cmdToRun = `start "" "${app_name_or_path}"`;
        } else {
          // Unknown friendly name — try without quotes first (works for PATH executables)
          cmdToRun = `start "" /b ${app_name_or_path}`;
        }

        console.log('[Main] Running cmd:', cmdToRun);
        exec(cmdToRun, { shell: 'cmd.exe' }, (error) => {
          if (error) {
            console.warn(`[Main] Primary attempt failed, retrying with quotes:`, error.message);
            // Fallback: try with quotes
            exec(`start "" "${app_name_or_path}"`, { shell: 'cmd.exe' }, (err2) => {
              if (err2) {
                // Last resort: shell.openExternal
                shell.openExternal(app_name_or_path).then(() => resolve({ success: true })).catch((e) => {
                  console.error('[Main] All open strategies failed:', e.message);
                  resolve({ success: false, error: `Could not open "${app_name_or_path}". Make sure it is installed. Error: ${err2.message}` });
                });
              } else {
                resolve({ success: true });
              }
            });
          } else {
            resolve({ success: true });
          }
        });
      });
    } else if (process.platform === 'darwin') {
      return new Promise((resolve) => {
        exec(`open -a "${app_name_or_path}"`, (error) => {
          if (error) {
            // Fallback to general open
            shell.openPath(app_name_or_path).then(res => resolve({ success: !res, error: res }));
          } else {
            resolve({ success: true });
          }
        });
      });
    } else {
      // Linux: try xdg-open, then direct launch
      return new Promise((resolve) => {
        exec(`${app_name_or_path} &`, (error) => {
          if (error) {
            shell.openPath(app_name_or_path).then(res => resolve({ success: !res, error: res }));
          } else {
            resolve({ success: true });
          }
        });
      });
    }
  } catch (error) {
    console.error('[Main] Failed to open external app:', error);
    return { success: false, error: error.message };
  }
});

// Handle opening system settings URLs (macOS)
ipcMain.handle('open-system-settings', async (event, url) => {
  if (!url || typeof url !== 'string') {
    return { success: false, error: 'Invalid URL' };
  }
  try {
    shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('[Main] Failed to open system settings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ollama-list-models', async () => {
  try {
    const baseUrl = store.get('ollama_base_url') || 'http://127.0.0.1:11434';
    console.log(`[Ollama] Fetching models from ${baseUrl}/api/tags`);

    const response = await fetch(`${baseUrl}/api/tags`).catch(err => {
      throw new Error(`Failed to connect to Ollama at ${baseUrl}. Is it running?`);
    });

    if (!response.ok) {
      throw new Error(`Ollama server returned error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const models = (data.models || []).map(m => ({
      name: m.name,
      id: m.digest || 'N/A',
      size: m.size ? `${(m.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'N/A',
      modified_at: m.modified_at || 'N/A'
    }));

    return { models };
  } catch (error) {
    console.error(`[Ollama] List error:`, error);

    // Fallback to CLI
    return new Promise((resolve) => {
      exec('ollama list', (err, stdout) => {
        if (err) {
          return resolve({ error: error.message });
        }
        const lines = stdout.trim().split('\n').slice(1);
        const models = lines.map(line => {
          const parts = line.trim().split(/\s{2,}/);
          return {
            name: parts[0],
            id: parts[1] || 'N/A',
            size: parts[2] || 'N/A',
            modified_at: parts[parts.length - 1] || 'N/A'
          };
        }).filter(m => m.name);
        resolve({ models });
      });
    });
  }
});


// Removed duplicate application search logic (Real implementation is at line 2576)


// Deep Linking and persist handling on startup (merged into single instance lock above)
function handleDeepLink(url) {
  if (!mainWindow) return;
  try {
    console.log('[Main] Handling Deep Link:', url);
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol === `${PROTOCOL}:`) {
      mainWindow.webContents.send('auth-callback', url);

      const token = parsedUrl.searchParams.get('token') || parsedUrl.searchParams.get('id_token') || parsedUrl.searchParams.get('auth_token');
      if (token) {
        store.set('auth_token', token);
        console.log('[Main] Auth token saved to secure storage.');
      }
    }
  } catch (e) {
    console.error('Failed to parse deep link:', e);
  }
}

app.whenReady().then(async () => {
  registerAppFileProtocol();
  buildApplicationMenu();
  protocol.handle('comet', (request) => {
    const url = new URL(request.url);
    const resourcePath = url.hostname; // e.g., 'extensions', 'vault'

    // Depending on the resourcePath, serve different content
    if (resourcePath === 'extensions') {
      return new Response('<h1>Comet Extensions</h1><p>This is the extensions page.</p>', { headers: { 'content-type': 'text/html' } });
    } else if (resourcePath === 'vault') {
      return new Response('<h1>Comet Vault</h1><p>This is the vault page.</p>', { headers: { 'content-type': 'text/html' } });
    }
    // Fallback for unknown comet URLs
    return new Response('<h1>404 Not Found</h1><p>Unknown Comet resource.</p>', { headers: { 'content-type': 'text/html' } });
  });

  protocol.handle('media', (request) => {
    const filePath = decodeURIComponent(request.url.replace('media://', ''));
    // Ensure the path is properly formatted for the OS
    const normalizedPath = path.normalize(filePath);
    return net.fetch(`file://${normalizedPath}`);
  });

  // Consolidate IPC registrations for Exports
  console.log('[Main] Registering session export handlers...');

  ipcMain.removeHandler('export-chat-txt');
  ipcMain.handle('export-chat-txt', async (event, content) => {
    console.log('[Export] TXT export requested. Content length:', content?.length || 0);
    const downloadsPath = app.getPath('downloads');
    const filename = `comet-chat-session-${Date.now()}.txt`;
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Chat History',
      defaultPath: path.join(downloadsPath, filename),
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (!canceled && filePath) {
      try {
        fs.writeFileSync(filePath, content);
        console.log('[Export] TXT saved to:', filePath);
        
        // Notify frontend so it shows in the downloads panel
        const finalName = path.basename(filePath);
        mainWindow.webContents.send('download-started', { name: finalName, path: filePath });
        setTimeout(() => {
          mainWindow.webContents.send('download-progress', { name: finalName, progress: 100 });
          mainWindow.webContents.send('download-complete', { name: finalName, path: filePath });
        }, 500);

        return { success: true };
      } catch (err) {
        console.error('[Export] TXT save failed:', err);
        return { success: false, error: err.message };
      }
    }
    console.log('[Export] TXT export canceled.');
    return { success: false, error: 'Canceled' };
  });

  // Export Chat as Branded PDF Handler
  ipcMain.removeHandler('export-chat-pdf');
  ipcMain.handle('export-chat-pdf', async (event, messages) => {
    console.log('[Export-PDF] PDF export requested. Messages:', messages?.length || 0);
    
    const logMain = (msg) => console.log(`[Export-PDF] ${msg}`);
    const logErr = (msg, err) => console.error(`[Export-PDF] ❌ ${msg}`, err);

    try {
      // Build chat content from messages
      let chatContent = '';
      let chatTitle = 'Chat Session Export';
      
      if (Array.isArray(messages)) {
        for (const msg of messages) {
          const role = msg.role === 'user' ? 'You' : (msg.role === 'assistant' ? 'Comet AI' : msg.role);
          const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
          chatContent += `**${role}:** ${content}\n\n`;
        }
        if (messages.length > 0) {
          chatTitle = `Chat Export - ${new Date().toLocaleDateString()}`;
        }
      } else if (typeof messages === 'string') {
        chatContent = messages;
      }

      // Add metadata
      const metadata = {
        author: 'Comet AI',
        category: 'Chat Session',
        tags: ['chat', 'export', 'comet-ai'],
        watermark: 'CONFIDENTIAL'
      };

      // Generate branded PDF HTML
      const pdfHtml = generateCometPDFTemplate(chatTitle, chatContent, '', 'professional', metadata);

      // Save dialog
      const downloadsPath = app.getPath('downloads');
      const filename = `comet-chat-${Date.now()}.pdf`;
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Chat as PDF',
        defaultPath: path.join(downloadsPath, filename),
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });

      if (!canceled && filePath) {
        // Use PDF generation logic
        let workerWindow = null;
        let tempHtmlPath = '';
        
        try {
          const tempDir = os.tmpdir();
          tempHtmlPath = path.join(tempDir, `comet_export_${Date.now()}.html`);
          
          // Write HTML file
          fs.writeFileSync(tempHtmlPath, pdfHtml, 'utf8');
          logMain(`Temp HTML written: ${tempHtmlPath}`);

          // Create hidden window for PDF printing
          workerWindow = new BrowserWindow({
            width: 900,
            height: 1200,
            show: false,
            webPreferences: {
              offscreen: true,
              partition: 'persist:pdf'
            }
          });

          // Wait for content to load
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('PDF load timeout')), 30000);
            workerWindow.webContents.once('did-finish-load', () => {
              clearTimeout(timeout);
              resolve();
            });
            workerWindow.webContents.once('did-fail-load', (e, err) => {
              clearTimeout(timeout);
              reject(new Error(`Failed to load: ${err}`));
            });
            workerWindow.loadFile(tempHtmlPath).catch(reject);
          });

          logMain('Generating PDF...');

          // Generate PDF
          const pdfData = await workerWindow.webContents.printToPDF({
            printBackground: true,
            pageSize: 'A4',
            margins: {
              marginType: 'custom',
              top: 0,
              bottom: 0,
              left: 0,
              right: 0
            }
          });

          // Save PDF
          fs.writeFileSync(filePath, pdfData);
          logMain(`PDF saved: ${filePath}`);

          // Notify frontend
          const finalName = path.basename(filePath);
          mainWindow.webContents.send('download-started', { name: finalName, path: filePath });
          setTimeout(() => {
            mainWindow.webContents.send('download-progress', { name: finalName, progress: 100 });
            mainWindow.webContents.send('download-complete', { name: finalName, path: filePath });
          }, 500);

          return { success: true, path: filePath };
        } catch (pdfErr) {
          logErr('PDF generation failed', pdfErr);
          return { success: false, error: pdfErr.message };
        } finally {
          if (workerWindow && !workerWindow.isDestroyed()) {
            workerWindow.destroy();
          }
          if (tempHtmlPath && fs.existsSync(tempHtmlPath)) {
            try { fs.unlinkSync(tempHtmlPath); } catch (e) {}
          }
        }
      }

      logMain('PDF export canceled.');
      return { success: false, error: 'Canceled' };
    } catch (err) {
      logErr('PDF export failed', err);
      return { success: false, error: err.message };
    }
  });

// Recreated PDF Generation Protocol (Branded & Robust)
ipcMain.removeHandler('generate-pdf');

  ipcMain.handle('generate-pdf', async (event, title, content) => {
    const logMain = (msg) => {
      console.log(`[PDF-CORE] ${new Date().toLocaleTimeString()} - ${msg}`);
    };
    const logErr = (msg, err) => {
      console.error(`[PDF-CORE] ❌ ${new Date().toLocaleTimeString()} - ${msg}`, err);
    };
    const notifyAI = (msg) => { 
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pdf-generation-log', msg); 
      }
    };
    const updateProgress = (progress, stage) => { 
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pdf-generation-progress', progress); 
        if (stage) mainWindow.webContents.send('pdf-generation-stage', stage);
      }
    };

    console.log('\n==================================================');
    logMain(`📥 PDF GENERATION REQUESTED: "${title || 'Untitled'}"`);
    logMain(`📝 Content Size: ${content?.length || 0} characters`);
    console.log('==================================================\n');

    notifyAI(`🔄 Initializing branded worker for PDF: ${title}...`);
    updateProgress(5, 'parsing');

    // 0. Load Branding Icon — try multiple paths
    let iconBase64 = '';
    let iconMimeType = 'image/png';
    try {
      const iconCandidates = [
        { p: path.join(__dirname, 'assets', 'icon.png'), mime: 'image/png' },
        { p: path.join(__dirname, 'icon.png'),           mime: 'image/png' },
        { p: path.join(__dirname, 'assets', 'icon.ico'), mime: 'image/x-icon' },
        { p: path.join(__dirname, 'icon.ico'),           mime: 'image/x-icon' },
      ];
      for (const candidate of iconCandidates) {
        if (fs.existsSync(candidate.p)) {
          iconBase64 = fs.readFileSync(candidate.p).toString('base64');
          iconMimeType = candidate.mime;
          logMain(`Loaded branding icon from: ${candidate.p}`);
          break;
        }
      }
      if (!iconBase64) logMain('No branding icon found — using text fallback.');
    } catch (e) {
      logErr('Failed to load branding icon', e);
    }

    let workerWindow = null;
    let tempHtmlPath = ''; // Define outside try for cleanup in catch/finally
    try {
      // Initialize temp file path
      const tempDir = os.tmpdir();
      tempHtmlPath = path.join(tempDir, `comet_pdf_${Date.now()}.html`);

      // 0. Pre-process content for Images (Convert URLs to Base64 + markdown → HTML)
      logMain('Scanning for remote images to embed...');
      let processedContent = content;
      
      // Collect all remote image URLs from both <img src> and markdown ![alt](url)
      const imageUrlRegex = /<img[^>]+src="([^">]+)"/g;
      const markdownImageRegex = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
      
      const remoteImages = [];
      let match;
      while ((match = imageUrlRegex.exec(content)) !== null) {
        if (match[1].startsWith('http')) remoteImages.push({ url: match[1], alt: '' });
      }
      while ((match = markdownImageRegex.exec(content)) !== null) {
        if (!remoteImages.find(r => r.url === match[2])) {
          remoteImages.push({ url: match[2], alt: match[1] });
        }
      }

      if (remoteImages.length > 0) {
        logMain(`Found ${remoteImages.length} remote images. Pre-fetching...`);
        notifyAI(`🖼️ Pre-fetching ${remoteImages.length} images for document...`);
        for (let i = 0; i < remoteImages.length; i++) {
          const { url, alt } = remoteImages[i];
          try {
            const response = await net.fetch(url);
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            const mimeType = response.headers.get('content-type') || 'image/png';
            const dataUrl = `data:${mimeType};base64,${base64}`;
            // Replace both <img src="url"> and markdown ![alt](url) → proper <img> HTML tag
            processedContent = processedContent.replace(
              new RegExp(`!\\[([^\\]]*)\\]\\(${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g'),
              `<figure style="text-align:center;margin:24px 0"><img src="${dataUrl}" alt="$1" style="max-width:100%;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,0.12)"/><figcaption style="font-size:0.8rem;color:#64748b;margin-top:8px">$1</figcaption></figure>`
            );
            // Also replace raw URL in existing <img> tags
            processedContent = processedContent.split(url).join(dataUrl);
            logMain(`Fetched image ${i+1}/${remoteImages.length}: ${url}`);
          } catch (err) {
            logErr(`Failed to fetch image: ${url}`, err);
            // Convert failed markdown images to a broken-image placeholder
            processedContent = processedContent.replace(
              new RegExp(`!\\[([^\\]]*)\\]\\(${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g'),
              `<p style="color:#dc2626;font-size:0.85rem;">[Image could not be loaded: ${url}]</p>`
            );
          }
          updateProgress(10 + Math.floor(((i + 1) / remoteImages.length) * 20), 'preparing');
        }
      }
      
      // Convert any remaining markdown image syntax (local paths / data URIs) → <img> HTML tags
      processedContent = processedContent.replace(
        /!\[([^\]]*)\]\(([^)]+)\)/g,
        (_, alt, src) => `<figure style="text-align:center;margin:24px 0"><img src="${src}" alt="${alt}" style="max-width:100%;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,0.12)"/>${alt ? `<figcaption style="font-size:0.8rem;color:#64748b;margin-top:8px">${alt}</figcaption>` : ''}</figure>`
      );
      
      updateProgress(30, 'preparing');

      // 1. Setup Worker Environment
      logMain('Creating hidden worker window...');
      workerWindow = new BrowserWindow({
        show: false,
        webPreferences: { 
          offscreen: true,
          contextIsolation: true,
          nodeIntegration: false,
          enableRemoteModule: false
        }
      });
      logMain('Worker window created.');
      updateProgress(35, 'preparing');

      // 3. Generate HTML
      logMain('Assembling Branded PDF template...');
      const html = generateCometPDFTemplate(title, processedContent, iconBase64);
      logMain(`HTML template ready (${html.length} chars).`);
      updateProgress(45, 'rendering');

      // 4. Load & Wait (Robust Sequence)
      logMain('Loading content into renderer...');
      const loadTask = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          logErr('Rendering timeout reached.');
          reject(new Error('Rendering Timeout: Check content structure or complexity.'));
        }, 45000);
        
        workerWindow.webContents.on('did-finish-load', () => {
          clearTimeout(timeout);
          logMain('Renderer confirmed: Page loaded successfully.');
          resolve();
        });

        workerWindow.webContents.on('did-fail-load', (e, code, desc) => {
          clearTimeout(timeout);
          logErr(`Renderer failed to load: ${desc} (Code: ${code})`);
          reject(new Error(`Renderer failed: ${desc} (Code: ${code})`));
        });
      });

      notifyAI('⏳ Rendering branded content to print buffer...');
      
      // For large content, use temp file instead of data URL (data URLs have ~2MB limit in Electron)
      if (html.length > 500000) {
        logMain(`Content too large for data URL (${html.length} chars). Using temp file...`);
        notifyAI(`📄 Large content detected. Using optimized rendering...`);
        fs.writeFileSync(tempHtmlPath, html, 'utf8');
        await workerWindow.loadFile(tempHtmlPath);
      } else {
        await workerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      }
      
      updateProgress(60, 'rendering');
      await loadTask;
      updateProgress(80, 'generating');

      // 5. Transform to PDF
      logMain('Executing printToPDF...');
      notifyAI('📄 Converting to Branded PDF format...');
      const pdfBuffer = await workerWindow.webContents.printToPDF({
        printBackground: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        pageSize: 'A4'
      });
      logMain(`PDF Buffer generated: ${pdfBuffer.length} bytes.`);
      updateProgress(90, 'saving');

      // 6. Persist to Disk
      logMain('Saving file to Downloads folder...');
      const downloads = path.join(os.homedir(), 'Downloads');
      const safeTitle = (title || 'comet_research').replace(/[^a-z0-9]/gi, '_');
      const filename = `${safeTitle}_${Math.floor(Date.now() / 1000)}.pdf`;
      const fullPath = path.join(downloads, filename);

      fs.writeFileSync(fullPath, pdfBuffer);
      logMain(`PDF saved successfully: ${fullPath}`);
      
      // 7. Cleanup & Notify UI
      if (mainWindow && !mainWindow.isDestroyed()) {
        logMain('Notifying frontend of new download...');
        mainWindow.webContents.send('download-started', { name: filename, path: fullPath });
        setTimeout(() => {
          mainWindow.webContents.send('download-progress', { name: filename, progress: 100 });
          mainWindow.webContents.send('download-complete', { name: filename, path: fullPath });
        }, 500);
      }
      logMain(`✅ SUCCESS: File saved at ${fullPath}`);
      notifyAI(`✅ COMPLETE: Saved to ${fullPath}`);
      updateProgress(100, 'complete');

      if (mainWindow && !mainWindow.isDestroyed()) {
        logMain('Notifying frontend of new download...');
        // Start simulated progress for the system downloads panel
        mainWindow.webContents.send('download-started', { name: filename, path: fullPath });
        
        let p = 0;
        const interval = setInterval(() => {
            p += 10;
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('download-progress', { name: filename, progress: p });
            }
            if (p >= 100) {
                clearInterval(interval);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('download-complete', { name: filename, path: fullPath });
                    logMain('Download lifecycle complete.');
                }
            }
        }, 100);
      }

      return { 
        success: true, 
        fileName: filename, 
        filePath: fullPath, 
        log: `Verified PDF export completed. Location: ${fullPath}`
      };

    } catch (err) {
      logErr('PDF generation aborted', err);
      const aiMessage = `❌ CRITICAL ERROR: ${err.message}`;
      notifyAI(aiMessage);
      
      // Cleanup temp file on error
      try { if (tempHtmlPath && fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath); } catch(e) {}
      
      return { 
        success: false, 
        error: err.message, 
        context: 'Generation failed in the Electron main process. Please check logs for memory or rendering issues.' 
      };
    } finally {
      if (workerWindow && !workerWindow.isDestroyed()) {
        workerWindow.destroy();
        logMain('Worker environment cleanup complete.');
      }
      // Cleanup temp file
      try { if (tempHtmlPath && fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath); } catch(e) {}
    }
  });

  ipcMain.handle('open-pdf', async (event, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }
    try {
      shell.openPath(filePath);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('open-file', async (event, fileNameOrPath) => {
    try {
      let filePath = fileNameOrPath;
      // If only filename provided, look in downloads folder
      if (!path.isAbsolute(filePath)) {
        const downloadsPath = app.getPath('downloads');
        filePath = path.join(downloadsPath, fileNameOrPath);
      }
      if (!fs.existsSync(filePath)) {
        // Try with Downloads path
        const downloadsPath = app.getPath('downloads');
        filePath = path.join(downloadsPath, fileNameOrPath);
      }
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File not found: ' + fileNameOrPath };
      }
      const result = await shell.openPath(filePath);
      if (result) {
        return { success: false, error: result };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  createWindow();

  app.on('activate', () => {
    if (openWindows.size === 0) {
      createWindow();
    } else {
      const win = getTopWindow();
      if (win) win.show();
    }
  });




  // ──────────────────────────────────────────────────────────────────────────
  // STARTUP SAFETY RULES (Microsoft Store 10.1.2.10 + internal policy):
  //   ✅ Render UI and wait for user interaction ONLY
  //   ❌ NO external processes at startup
  //   ❌ NO provider health checks at startup
  //   ❌ NO network calls at startup
  //   ❌ NO Ollama/model scans at startup
  // Ollama is LAZY — it only connects when the user selects it in Settings.
  // ──────────────────────────────────────────────────────────────────────────
  // Initialize Desktop Automation Services (LOCAL ONLY — no network calls)
  (async () => {
    try {
      await permissionStore.load();
      console.log('[Main] PermissionStore loaded.');

      cometAiEngine = new CometAiEngine();
      cometAiEngine.configure({
        GEMINI_API_KEY: store.get('gemini_api_key') || process.env.GEMINI_API_KEY || '',
        GROQ_API_KEY: store.get('groq_api_key') || process.env.GROQ_API_KEY || '',
        OPENAI_API_KEY: store.get('openai_api_key') || process.env.OPENAI_API_KEY || '',
        ANTHROPIC_API_KEY: store.get('anthropic_api_key') || process.env.ANTHROPIC_API_KEY || '',
        OLLAMA_BASE_URL: store.get('ollama_base_url') || 'http://127.0.0.1:11434',
      });
      console.log('[Main] CometAiEngine initialized with Ollama:', store.get('ollama_base_url') || 'http://127.0.0.1:11434');

      robotService = new RobotService(permissionStore);
      console.log(`[Main] RobotService initialized (available: ${robotService.isAvailable}).`);

      tesseractOcrService = new TesseractOcrService();
      console.log('[Main] TesseractOcrService ready (lazy init on first use).');

      screenVisionService = new ScreenVisionService(cometAiEngine);
      console.log('[Main] ScreenVisionService initialized.');

      flutterBridge = new FlutterBridgeServer(cometAiEngine, tesseractOcrService);
      flutterBridge.start(9876);
      console.log('[Main] FlutterBridgeServer started on port 9876.');

      fileSystemMcp = new FileSystemMcpServer(permissionStore);
      nativeAppMcp = new NativeAppMcpServer(permissionStore);
      console.log('[Main] MCP Desktop servers (FileSystem + NativeApp) initialized.');

      ragService = new RagService();
      await ragService.init();
      console.log('[Main] RagService initialized.');

      voiceService = new VoiceService();
      voiceService.configure({
        OPENAI_API_KEY: store.get('openai_api_key') || process.env.OPENAI_API_KEY || '',
      });
      console.log('[Main] VoiceService initialized.');

      workflowRecorder = new WorkflowRecorder();
      console.log('[Main] WorkflowRecorder initialized.');

      popSearch = popSearchService;
      popSearch.initialize(mainWindow);
      console.log('[Main] PopSearch service initialized.');
    } catch (e) {
      console.error('[Main] Desktop automation services init error:', e.message);
    }
  })();

  // Handle deep link if launched with one
  const launchUrl = process.argv.find(arg => arg.startsWith(`${PROTOCOL}://`));
  if (launchUrl) {
    mainWindow.webContents.once('did-finish-load', () => {
      handleDeepLink(launchUrl);
    });
  }

  // Load persistent auth token on startup from secure storage
  mainWindow.webContents.once('did-finish-load', () => {
    const savedToken = store.get('auth_token');
    const savedUser = store.get('user_info');
    if (savedToken) {
      mainWindow.webContents.send('load-auth-token', savedToken);
      if (savedUser) mainWindow.webContents.send('load-user-info', savedUser);
      console.log('[Main] Loaded and sent persistent auth data to renderer.');
    }
  });

  // Handle successful authentication from external sources (e.g. landing page)
  ipcMain.on('set-auth-token', (event, token) => {
    console.log('[Main] Setting auth token');
    store.set('auth_token', token);
    if (mainWindow) {
      mainWindow.webContents.send('load-auth-token', token);
    }
  });

  // MCP Server Setup
  const mcpApp = express();
  mcpApp.use(bodyParser.json());

  mcpApp.post('/llm/generate', async (req, res) => {
    const { messages, options } = req.body;
    const result = await llmGenerateHandler(messages, options);
    res.json(result);
  });

  mcpServer = mcpApp.listen(mcpServerPort, () => {
    console.log(`MCP Server running on port ${mcpServerPort}`);
  });

  const raycastApp = express();
  raycastApp.use(bodyParser.json());

  raycastApp.get('/raycast/tabs', (req, res) => {
    res.json({ tabs: raycastState.tabs });
  });

  raycastApp.get('/raycast/history', (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const history = raycastState.history.slice(-limit).reverse();
    res.json({ history, limit });
  });

  raycastApp.post('/raycast/new-tab', (req, res) => {
    const url = req.body?.url;
    if (url && mainWindow) {
      mainWindow.webContents.send('add-new-tab', url);
      mainWindow.show();
      mainWindow.focus();
    }
    res.json({ success: !!url, url });
  });

  raycastApp.post('/raycast/action', (req, res) => {
    const { action, payload } = req.body || {};
    if (action === 'open-url' && payload?.url && mainWindow) {
      mainWindow.webContents.send('add-new-tab', payload.url);
      mainWindow.show();
      mainWindow.focus();
    }
    res.json({ success: true, action, payload });
  });

  raycastApp.get('/raycast/automations', async (req, res) => {
    if (!storageManager) {
      await initializeAutomationService();
    }
    if (!storageManager || !storageManager.getAllTasks) {
      return res.json({ tasks: [] });
    }
    const tasks = await storageManager.getAllTasks();
    res.json({ tasks });
  });

  raycastApp.post('/raycast/automation/delete', async (req, res) => {
    const { taskId } = req.body || {};
    if (!taskId) {
      return res.status(400).json({ success: false, error: 'Missing taskId' });
    }
    if (!taskScheduler) {
      await initializeAutomationService();
    }
    try {
      await taskScheduler.unscheduleTask(taskId);
      await storageManager.deleteTask(taskId);
      res.json({ success: true });
    } catch (error) {
      console.error('[Raycast] Failed to delete automation:', error);
      res.json({ success: false, error: error.message });
    }
  });

  raycastServer = raycastApp.listen(RAYCAST_PORT, RAYCAST_HOST, () => {
    console.log(`[Raycast] API listening at http://${RAYCAST_HOST}:${RAYCAST_PORT}`);
  });

  // Load or generate local device ID for P2P sync
  const p2pDeviceIdPath = path.join(app.getPath('userData'), 'p2p_device_id.txt');
  let localP2PDeviceId;
  try {
    if (fs.existsSync(p2pDeviceIdPath)) {
      localP2PDeviceId = fs.readFileSync(p2pDeviceIdPath, 'utf8').trim();
    } else {
      localP2PDeviceId = `desktop-${Math.random().toString(36).substring(2, 10)}`;
      fs.writeFileSync(p2pDeviceIdPath, localP2PDeviceId);
    }
  } catch (e) {
    localP2PDeviceId = 'main-process-device';
  }

  p2pSyncService = getP2PSync(localP2PDeviceId);

  // Forward P2P service events to the renderer
  p2pSyncService.on('connected', () => {
    if (mainWindow) mainWindow.webContents.send('p2p-connected');
  });
  p2pSyncService.on('disconnected', () => {
    if (mainWindow) mainWindow.webContents.send('p2p-disconnected');
  });
  p2pSyncService.on('firebase-ready', (userId) => {
    if (mainWindow) {
      mainWindow.webContents.send('p2p-firebase-ready', userId);
      mainWindow.webContents.send('p2p-local-device-id', p2pSyncService.getStatus().deviceId);
    }
  });
  p2pSyncService.on('offer-created', ({ offer, remoteDeviceId }) => {
    if (mainWindow) mainWindow.webContents.send('p2p-offer-created', { offer, remoteDeviceId });
  });
  p2pSyncService.on('answer-created', ({ answer, remoteDeviceId }) => {
    if (mainWindow) mainWindow.webContents.send('p2p-answer-created', { answer, remoteDeviceId });
  });
  p2pSyncService.on('ice-candidate', ({ candidate, remoteDeviceId }) => {
    if (mainWindow) mainWindow.webContents.send('p2p-ice-candidate', { candidate, remoteDeviceId });
  });

  // Listen for sync messages from peers
  p2pSyncService.on('message', (message) => {
    console.log(`[P2P] Received message of type: ${message.type}`);
    if (mainWindow) {
      mainWindow.webContents.send('p2p-message', message);
    }
    if (message.type === 'clipboard-sync') {
      clipboard.writeText(message.text);
      if (mainWindow) {
        mainWindow.webContents.send('clipboard-changed', message.text);
        mainWindow.webContents.send('notification', { title: 'Sync', body: 'Clipboard synced from remote device' });
      }
    } else if (message.type === 'history-sync') {
      appendToMemory({ action: 'remote-history', ...message.data });
      if (mainWindow) {
        mainWindow.webContents.send('notification', { title: 'Sync', body: 'Browsing history synced' });
      }
    }
  });

  // WiFi Sync Service (Mobile to Desktop)
  try {
    const { getWiFiSync } = require('./src/lib/WiFiSyncService.js');
    wifiSyncService = getWiFiSync(3004);
    wifiSyncService.start();

    wifiSyncService.on('command', async ({ commandId, command, args, sendResponse }) => {
      console.log(`[WiFi-Sync] Mobile requested command: ${command}`);

      if (command === 'approve-high-risk') {
        const pin = args.pin;
        const configId = args.id;
        console.log(`[WiFi-Sync] Mobile approved high risk action with PIN: ${pin}`);
        if (mainWindow) {
          mainWindow.webContents.send('mobile-approve-high-risk', { pin, id: configId });
        }
        sendResponse({ success: true, message: 'Approval forwarded to desktop' });
      } else if (command === 'ai-prompt') {
        const prompt = args.prompt;
        const modelOverride = args.model;

        console.log(`[WiFi-Sync] AI Prompt from mobile: "${prompt.substring(0, 50)}..." Target Model: ${modelOverride || 'default'}`);

        if (mainWindow) {
          mainWindow.webContents.send('remote-ai-prompt', { prompt, commandId });
        }

        try {
          const targetModel = modelOverride || store.get('ollama_model') || 'deepseek-r1:8b';
          const provider = (targetModel.includes('gemini') || targetModel.includes('google')) ? 'google-flash' : 'ollama';

          console.log(`[WiFi-Sync] Dispatching AI task: ${targetModel} (${provider})`);

          const result = await llmGenerateHandler([{ role: 'user', content: prompt }], {
            model: targetModel,
            provider: provider
          });

          if (result.error) {
            console.error(`[WiFi-Sync] AI Error from Handler: ${result.error}`);
            sendResponse({ success: false, error: result.error });
          } else if (!result.text) {
            console.error(`[WiFi-Sync] AI Error: Received empty text from handler`);
            sendResponse({ success: false, error: "AI generated an empty response" });
          } else {
            console.log(`[WiFi-Sync] AI Success! Sending ${result.text.length} chars back.`);
            sendResponse({ success: true, output: result.text, thought: result.thought });
          }
        } catch (err) {
          console.error(`[WiFi-Sync] CRITICAL AI FAILURE:`, err);
          sendResponse({ success: false, error: `Internal Engine Error: ${err.message}` });
        }
      } else if (command === 'media-next' || command === 'media-prev' || command === 'media-play-pause') {
        if (robot) {
          const key = command === 'media-next' ? 'audio_next' : (command === 'media-prev' ? 'audio_prev' : 'audio_pause');
          robot.keyTap(key);
          sendResponse({ success: true, output: `Media key ${key} pressed` });
        } else {
          sendResponse({ success: false, error: 'robotjs not available' });
        }
      } else if (command === 'click') {
        const { x, y } = args;
        try {
          await performRobotClick({ x, y });
          sendResponse({ success: true, output: `Clicked at (${x}, ${y})` });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      } else if (command === 'find-and-click') {
        const targetText = args.text;
        // Reuse the find-and-click-text logic
        ipcMain.emit('find-and-click-text', { sender: { send: () => { } } }, targetText).then(result => {
          sendResponse(result);
        }).catch(err => {
          sendResponse({ success: false, error: err.message });
        });
      } else if (command === 'open-tab') {
        if (mainWindow) {
          mainWindow.webContents.send('add-new-tab', args.url);
          sendResponse({ success: true, output: `Opening tab: ${args.url}` });
        } else {
          sendResponse({ success: false, error: 'Desktop window not available' });
        }
      } else if (command === 'get-tabs') {
        ipcMain.handleOnce('get-open-tabs-internal', async () => {
          const tabs = [];
          for (const [tabId, view] of tabViews.entries()) {
            if (view && view.webContents) {
              tabs.push({
                tabId,
                url: view.webContents.getURL(),
                title: view.webContents.getTitle(),
                isActive: (tabId === activeTabId)
              });
            }
          }
          return tabs;
        });
        const tabs = [];
        for (const [tabId, view] of tabViews.entries()) {
          if (view && view.webContents) {
            tabs.push({
              tabId,
              url: view.webContents.getURL(),
              title: view.webContents.getTitle(),
              isActive: (tabId === activeTabId)
            });
          }
        }
        sendResponse({ success: true, tabs });
      } else if (command === 'type-text') {
        if (robot) {
          robot.typeString(args.text);
          sendResponse({ success: true, output: `Typed: ${args.text}` });
        } else {
          sendResponse({ success: false, error: 'robotjs not available' });
        }
      } else if (command === 'key-tap') {
        if (robot) {
          robot.keyTap(args.key, args.modifier);
          sendResponse({ success: true, output: `Key ${args.key} tapped` });
        } else {
          sendResponse({ success: false, error: 'robotjs not available' });
        }
      } else if (command === 'move-mouse') {
        if (robot) {
          robot.moveMouse(args.x, args.y);
          sendResponse({ success: true, output: `Mouse moved to (${args.x}, ${args.y})` });
        } else {
          sendResponse({ success: false, error: 'robotjs not available' });
        }
      } else if (command === 'switch-tab') {
        if (mainWindow) {
          mainWindow.webContents.send('switch-to-tab', args.tabId);
          sendResponse({ success: true, output: `Switching to tab: ${args.tabId}` });
        } else {
          sendResponse({ success: false, error: 'Desktop window not available' });
        }
      } else if (command === 'navigate') {
        if (mainWindow) {
          const url = args.url;
          mainWindow.webContents.send('navigate-to-url', url);
          sendResponse({ success: true, output: `Navigating to: ${url}` });
        } else {
          sendResponse({ success: false, error: 'Desktop window not available' });
        }
      } else if (command === 'desktop-control') {
        // Handle desktop-control commands from mobile
        const action = args.action || msg.action;
        const prompt = args.prompt || msg.prompt;
        const promptId = args.promptId || msg.promptId || commandId;
        
        console.log(`[WiFi-Sync] Desktop Control: action=${action}, promptId=${promptId}`);
        
        if (action === 'send-prompt') {
          if (mainWindow) {
            mainWindow.webContents.send('remote-ai-prompt', { 
              prompt, 
              commandId: promptId,
              streamToMobile: true 
            });
          }

          const targetModel = args.model || store.get('ollama_model') || 'deepseek-r1:8b';
          const provider = (targetModel.includes('gemini') || targetModel.includes('google')) ? 'google-flash' : 'ollama';

          try {
            await streamPromptToMobile(promptId, prompt, targetModel, provider);
            sendResponse({ success: true, promptId });
          } catch (err) {
            const errMsg = err?.message || String(err);
            wifiSyncService.sendAIResponse(promptId, `Error: ${errMsg}`, false);
            sendResponse({ success: false, error: errMsg });
          }
        } else if (action === 'get-status') {
          const { screen } = require('electron');
          sendResponse({ 
            success: true, 
            screenOn: !screen.isScreenCaptured?.() ?? true,
            activeApp: 'Comet-AI',
            desktopName: os.hostname(),
            platform: os.platform(),
          });
        } else if (action === 'screenshot') {
          if (mainWindow) {
            mainWindow.webContents.send('request-screenshot', { promptId });
            sendResponse({ success: true, output: 'Screenshot requested' });
          } else {
            sendResponse({ success: false, error: 'Desktop window not available' });
          }
        } else if (action === 'shell-command') {
          const shellCmd = args.command;
          const requireApproval = args.requireApproval ?? true;
          
          // Check if this is a high-risk command that needs QR approval on Mac
          if (os.platform() === 'darwin' && requireApproval) {
            const dangerous = /sudo|rm\s+-rf|shutdown|reboot|kill\s+-9|diskutil|dd\s+if/i.test(shellCmd);
            if (dangerous) {
              // Generate QR code for mobile approval
              const { qrImage, pin, token } = await generateShellApprovalQR(shellCmd);
              wifiSyncService.sendToMobile({
                action: 'shell-approval-qr',
                commandId: token,
                pin: pin,
                command: shellCmd,
                qrData: qrImage,
              });
              sendResponse({ 
                success: true, 
                requiresApproval: true,
                approvalQRShown: true,
              });
              return;
            }
          }
          
          // Execute shell command
          const { exec } = require('child_process');
          exec(shellCmd, { timeout: 30000 }, (err, stdout, stderr) => {
            if (err) {
              sendResponse({ success: false, error: err.message });
            } else {
              sendResponse({ success: true, output: stdout || stderr });
            }
          });
        } else if (action === 'show-shell-qr') {
          const shellCmd = args.command;
          const { qrImage, pin, token } = await generateShellApprovalQR(shellCmd);
          wifiSyncService.sendToMobile({
            action: 'shell-approval-qr',
            commandId: args.commandId,
            pin: pin,
            command: shellCmd,
            qrData: qrImage,
          });
          sendResponse({ success: true, qrShown: true });
        } else if (action === 'get-clipboard') {
          const { clipboard } = require('electron');
          sendResponse({ success: true, clipboard: clipboard.readText() });
        } else if (action === 'open-url') {
          if (mainWindow) {
            mainWindow.webContents.send('navigate-to-url', args.url);
            sendResponse({ success: true, output: `Opening: ${args.url}` });
          } else {
            sendResponse({ success: false, error: 'Desktop window not available' });
          }
        } else if (action === 'click') {
        try {
          await performRobotClick({ x: args.x, y: args.y });
          sendResponse({ success: true, output: `Clicked at (${args.x}, ${args.y})` });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
        } else {
          sendResponse({ success: false, error: `Unknown action: ${action}` });
        }
      } else {
        sendResponse({ success: false, error: `Command ${command} not implemented` });
      }
    });

    wifiSyncService.on('client-connected', () => {
      if (mainWindow) mainWindow.webContents.send('wifi-sync-status', { connected: true });
    });

    wifiSyncService.on('client-disconnected', () => {
      if (mainWindow) mainWindow.webContents.send('wifi-sync-status', { connected: false });
    });
  } catch (e) {
    console.error('[Main] Failed to initialize WiFi Sync Service:', e);
  }
  ipcMain.handle('get-wifi-sync-uri', () => {
    return wifiSyncService ? wifiSyncService.getConnectUri() : null;
  });

  ipcMain.handle('wifi-sync-broadcast', async (event, message) => {
    if (!wifiSyncService) return { success: false, error: 'WiFi Sync not initialized' };
    wifiSyncService.broadcast(message);
    return { success: true };
  });

  ipcMain.handle('get-wifi-sync-qr', async () => {
    if (!wifiSyncService) return null;
    const uri = wifiSyncService.getConnectUri();
    try {
      return await QRCode.toDataURL(uri);
    } catch (err) {
      console.error('[Main] Failed to generate QR code:', err);
      return null;
    }
  });

  ipcMain.handle('generate-high-risk-qr', async (event, actionId) => {
    // Generate a secure deep link that opens flutter_browser_app
    // Format: comet-ai://approve?id=TOKEN&deviceId=DEVICE_ID&pin=123456
    const deviceId = os.hostname();
    const token = actionId || Math.random().toString(36).substring(2, 10);
    // Generate a random 6-digit PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const deepLinkUrl = `comet-ai://approve?id=${token}&deviceId=${encodeURIComponent(deviceId)}&pin=${pin}`;
    try {
      const qrImage = await QRCode.toDataURL(deepLinkUrl);
      // We must return both the image and the pin so the web UI can display the pin
      return JSON.stringify({ qrImage, pin, token });
    } catch (err) {
      console.error('[Main] Failed to generate High-Risk QR:', err);
      return null;
    }
  });

  async function generateShellApprovalQR(command) {
    const deviceId = os.hostname();
    const token = Math.random().toString(36).substring(2, 10);
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const deepLinkUrl = `comet-ai://shell-approve?id=${token}&deviceId=${encodeURIComponent(deviceId)}&pin=${pin}&cmd=${encodeURIComponent(command)}`;
    
    try {
      const qrImage = await QRCode.toDataURL(deepLinkUrl);
      return { qrImage, pin, token };
    } catch (err) {
      console.error('[Main] Failed to generate Shell Approval QR:', err);
      return { qrImage: null, pin, token };
    }
  }

  async function streamPromptToMobile(promptId, prompt, model, provider) {
    const messages = [{ role: 'user', content: prompt }];
    const streamEvent = {
      sender: {
        isDestroyed: () => false,
        send: (_channel, data) => {
          if (data?.type === 'text-delta') {
            wifiSyncService.sendAIResponse(promptId, data.textDelta || '', true);
          } else if (data?.type === 'finish') {
            wifiSyncService.sendAIResponse(promptId, '', false);
          } else if (data?.type === 'error') {
            wifiSyncService.sendAIResponse(promptId, `Error: ${data.error || 'Stream failed'}`, false);
          }
        }
      }
    };

    await llmStreamHandler(streamEvent, messages, {
      model,
      provider,
      baseUrl: store.get('ollama_base_url') || undefined,
    });
  }

  ipcMain.handle('get-wifi-sync-info', () => {
    if (!wifiSyncService) return null;
    return {
      deviceName: os.hostname(),
      pairingCode: wifiSyncService.getPairingCode(),
      ip: wifiSyncService.getLocalIp(),
      port: 3004
    };
  });

  // Handle file downloads
  session.defaultSession.on('will-download', (event, item, webContents) => {
    const fileName = item.getFilename();
    const downloadsPath = app.getPath('downloads');
    const saveDataPath = path.join(downloadsPath, fileName);

    console.log(`[Main] Starting download: ${fileName} to ${saveDataPath}`);

    item.setSavePath(saveDataPath);
    item.resume();

    if (mainWindow) {
      mainWindow.webContents.send('download-started', { name: fileName, path: saveDataPath });
    }

    item.on('updated', (event, state) => {
      if (state === 'interrupted') {
        console.log('Download is interrupted but can be resumed');
      } else if (state === 'progressing') {
        if (!item.isPaused()) {
          // progress updates could be sent here
        }
      }
    });

    item.on('done', (event, state) => {
      if (state === 'completed') {
        console.log('Download successfully');
        if (mainWindow) {
          mainWindow.webContents.send('download-complete', { name: item.getFilename(), path: item.getSavePath() });
        }

        // Auto-install logic for Chrome Extensions (.crx)
        if (fileName.endsWith('.crx')) {
          console.log(`[Main] Detected extension download: ${fileName}. Installing...`);
          installExtensionLocally(saveDataPath);
        }
      } else {
        console.log(`Download failed: ${state}`);
        if (mainWindow) {
          mainWindow.webContents.send('download-failed', { name: item.getFilename(), path: item.getSavePath() });
        }
      }
    });

    item.resume();

  });

  ipcMain.handle('get-open-tabs', async () => {
    const tabs = [];
    for (const [tabId, view] of tabViews.entries()) {
      if (view && view.webContents) {
        try {
          const url = view.webContents.getURL();
          const title = view.webContents.getTitle();
          const isActive = (tabId === activeTabId);
          tabs.push({ tabId, url, title, isActive });
        } catch (e) {
          console.error(`Error getting info for tabId ${tabId}:`, e);
          tabs.push({ tabId, url: 'Error', title: 'Error', isActive: (tabId === activeTabId) });
        }
      }
    }
    return tabs;
  });

  ipcMain.on('hide-all-views', () => {
    if (activeTabId && tabViews.has(activeTabId)) {
      const view = tabViews.get(activeTabId);
      if (view && mainWindow) {
        removeChildView(view);
      }
    }
  });

  ipcMain.on('show-all-views', () => {
    if (activeTabId && tabViews.has(activeTabId)) {
      const view = tabViews.get(activeTabId);
      if (view && mainWindow) {
        addChildView(view);
        bringPopupViewsToFront();
      }
    }
  });

  ipcMain.on('set-user-id', (event, userId) => {
    // TODO: Implement what to do with the user ID
    console.log('User ID set:', userId);
  });

  ipcMain.handle('get-extensions', async () => {
    const extensions = session.defaultSession.getAllExtensions();
    return extensions.map(ext => ({
      id: ext.id,
      name: ext.name,
      version: ext.version,
      description: ext.description,
      path: ext.path
    }));
  });

  ipcMain.handle('toggle-extension', async (event, id) => {
    // Disabling usually requires session restart in Electron, 
    // but we can acknowledge the request.
    console.log(`Toggle request for extension ${id}`);
    return true;
  });

  ipcMain.handle('uninstall-extension', async (event, id) => {
    try {
      const ext = session.defaultSession.getExtension(id);
      if (ext) {
        const extPath = ext.path;
        session.defaultSession.removeExtension(id);
        // Optional: Delete from folder? 
        // User said: "Drop your extension folder inside. Restart Comet"
        // So if they uninstall, we should probably delete the folder too.
        if (extPath.startsWith(extensionsPath)) {
          fs.rmSync(extPath, { recursive: true, force: true });
        }
        return true;
      }
    } catch (e) {
      console.error(`Failed to uninstall extension ${id}:`, e);
    }
    return false;
  });

  ipcMain.handle('get-extension-path', async () => {
    return extensionsPath;
  });

  // Helper to install extension from a file path (e.g. download .crx)
  async function installExtensionLocally(crxPath) {
    try {
      const fileName = path.basename(crxPath);
      const extensionId = fileName.replace('.crx', '').split('_')[0] || `ext_${Date.now()}`;
      const targetDir = path.join(extensionsPath, extensionId);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      console.log(`[Main] Extracting extension to ${targetDir}...`);

      // For Windows, use tar to extract. CRX files are basically ZIPs with header.
      // We try to extract directly. If it fails due to header, we might need to strip it.
      // However, tar often handles ZIP-like structures okay.
      // Better yet, we use a simple command to strip the first 512 bytes if header exists, 
      // but many CRXv3 can be opened by unzip tools directly.

      exec(`tar -xf "${crxPath}" -C "${targetDir}"`, async (err) => {
        if (err) {
          console.error(`[Main] Extraction failed: ${err.message}. Trying alternative...`);
          // Fallback or manual strip could go here
        }

        // Verify manifest
        const manifestPath = path.join(targetDir, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          console.log(`[Main] Extension ${manifest.name} extracted successfully.`);

          // Check if it's a theme
          if (manifest.theme) {
            console.log(`[Main] Detected theme: ${manifest.name}. Applying colors...`);
            if (mainWindow) mainWindow.webContents.send('apply-theme', manifest.theme);
          }

          // Load the extension into the session
          try {
            await session.defaultSession.loadExtension(targetDir);
            if (mainWindow) mainWindow.webContents.send('extension-installed', { name: manifest.name, id: extensionId });
          } catch (loadErr) {
            console.error(`[Main] Failed to load extension: ${loadErr.message}`);
          }
        }
      });
    } catch (e) {
      console.error(`[Main] installExtensionLocally error:`, e);
    }
  }

  ipcMain.handle('get-icon-path', async () => {
    return path.join(__dirname, 'icon.ico');
  });

  ipcMain.handle('get-app-icon-base64', async () => {
    try {
      const iconPath = path.join(__dirname, 'assets', 'icon.png'); // PNG is better for PDF embedding
      const fallbackPath = path.join(__dirname, 'assets', 'icon.ico');
      const targetPath = fs.existsSync(iconPath) ? iconPath : (fs.existsSync(fallbackPath) ? fallbackPath : null);

      if (targetPath) {
        const mime = targetPath.endsWith('.png') ? 'image/png' : 'image/x-icon';
        const base64 = fs.readFileSync(targetPath).toString('base64');
        return `data:${mime};base64,${base64}`;
      }
      return null;
    } catch (e) {
      console.error('[Main] Failed to read app icon:', e);
      return null;
    }
  });

  ipcMain.on('open-extension-dir', () => {
    shell.openPath(extensionsPath);
  });

  ipcMain.handle('connect-to-remote-device', async (event, remoteDeviceId) => {
    if (!p2pSyncService) {
      console.error('[Main] P2P Sync Service not initialized.');
      return false;
    }
    return await p2pSyncService.connectToRemoteDevice(remoteDeviceId);
  });

  ipcMain.handle('p2p-sync-history', async (event, data) => {
    if (p2pSyncService && p2pSyncService.getStatus().connected) {
      p2pSyncService.sendMessage({ type: 'history-sync', data });
      return { success: true };
    }
    return { success: false, error: 'Not connected to peer' };
  });

  ipcMain.handle('p2p-get-device-id', async () => {
    return p2pSyncService ? p2pSyncService.getStatus().deviceId : null;
  });

  ipcMain.on('send-p2p-signal', (event, { signal, remoteDeviceId }) => {
    if (!p2pSyncService) {
      console.error('[Main] P2P Sync Service not initialized.');
      return;
    }
    p2pSyncService.sendSignal(signal, remoteDeviceId);
  });

  ipcMain.handle('scan-folder', async (event, folderPath, types) => {
    return await _scanDirectoryRecursive(folderPath, types);
  });

  ipcMain.handle('read-file-buffer', async (event, filePath) => {
    try {
      const buffer = await fs.promises.readFile(filePath);
      return buffer.buffer; // Return as ArrayBuffer
    } catch (error) {
      console.error(`[Main] Error reading file buffer for ${filePath}:`, error);
      return new ArrayBuffer(0);
    }
  });

  const crypto = require('crypto');

  // Function to derive key from passphrase
  async function deriveKey(passphrase, salt) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(passphrase, salt, 100000, 32, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        resolve(derivedKey);
      });
    });
  }

  // IPC handler for encryption
  ipcMain.handle('encrypt-data', async (event, { data, key }) => {
    try {
      const salt = crypto.randomBytes(16);
      const derivedKey = await deriveKey(key, salt);
      const iv = crypto.randomBytes(16); // Initialization vector
      const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);

      const encrypted = Buffer.concat([cipher.update(Buffer.from(data)), cipher.final()]);
      const authTag = cipher.getAuthTag();

      return {
        encryptedData: encrypted.buffer,
        iv: iv.buffer,
        authTag: authTag.buffer,
        salt: salt.buffer
      };
    } catch (error) {
      console.error('[Main] Encryption failed:', error);
      return { error: error.message };
    }
  });

  // IPC handler for decryption
  // Web Search RAG Helper with Caching
  ipcMain.handle('web-search-rag', async (event, query) => {
    try {
      const normalizedQuery = query.trim().toLowerCase();
      const cached = searchCache.get(normalizedQuery);
      const CACHE_TTL = 30 * 60 * 1000; // 30 minutes in ms

      if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        console.log(`[RAG] Using cached results for: ${query}`);
        return cached.results;
      }

      console.log(`[RAG] Performing web search for: ${query}`);

      // Use web scraper for search results
      const searchEngines = [
        {
          name: 'Google',
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en`,
          selectors: [
              /<div[^>]+class="VwiC3b[^>]*>([\s\S]*?)<\/div>/g,
              /<div[^>]+class="BNeawe s3v9rd AP7Wnd"[^>]*>([\s\S]*?)<\/div>/g,
              /<span[^>]+class="hgKElc"[^>]*>([\s\S]*?)<\/span>/g,
              /<div[^>]+class="yY967"[^>]*>([\s\S]*?)<\/div>/g,
              /<div[^>]+class="MUFw9c[^>]*>([\s\S]*?)<\/div>/g
            ]
          },
          {
            name: 'DuckDuckGo',
            url: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
            selectors: [
              /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g,
              /<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>/g
            ]
          }
        ];

        let searchResults = [];

        for (const engine of searchEngines) {
          try {
            console.log(`[RAG] Attempting search with ${engine.name}...`);
            const response = await fetch(engine.url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
              }
            });

            if (!response.ok) continue;

            const html = await response.text();
            const snippets = [];

            for (const regex of engine.selectors) {
              let match;
              regex.lastIndex = 0;
              while ((match = regex.exec(html)) !== null && snippets.length < 5) {
                let cleanSnippet = match[1]
                  .replace(/<[^>]*>/g, '') // Remove HTML tags
                  .replace(/&amp;/g, '&')
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'")
                  .replace(/\s+/g, ' ')
                  .trim();

                if (cleanSnippet && cleanSnippet.length > 20 && !snippets.includes(cleanSnippet)) {
                  snippets.push(cleanSnippet);
                }
              }
              if (snippets.length >= 3) break;
            }

            if (snippets.length > 0) {
              console.log(`[RAG] ${engine.name} search retrieved ${snippets.length} snippets`);
              searchResults = snippets;
              break;
            }
          } catch (e) {
            console.warn(`[RAG] ${engine.name} search failed:`, e.message);
          }
        }

      if (searchResults.length > 0) {
        searchCache.set(normalizedQuery, {
          results: searchResults,
          timestamp: Date.now()
        });
      }

      return searchResults;
    } catch (error) {
      console.error('[RAG] Web search failed completely:', error);
      return [];
    }
  });

  // Website Translation IPC
  ipcMain.handle('translate-website', async (event, { targetLanguage, method }) => {
    const view = tabViews.get(activeTabId);
    if (!view) return { error: 'No active view' };

    // Default to 'google' method if not specified
    const translationMethod = method || 'google';

    if (translationMethod === 'chrome-ai') {
      // Chrome Built-in AI Translation (Modern - requires Chrome 144+)
      try {
        const code = `
        (async () => {
          try {
            // Check if translation API is available
            if (!window.translation) {
              return { error: 'Translation API not available. Use Chrome 144+ or enable --enable-features=TranslationAPI' };
            }
            
            const canTranslate = await window.translation.canTranslate({
              sourceLanguage: 'auto',
              targetLanguage: '${targetLanguage}'
            });
            
            if (canTranslate === 'no') {
              return { error: 'Cannot translate to ' + '${targetLanguage}' + '. Language pack may not be downloaded.' };
            }
            
            // Create translator (may download language pack)
            const translator = await window.translation.createTranslator({
              sourceLanguage: 'auto',
              targetLanguage: '${targetLanguage}'
            });
            
            // For page translation, we need to translate all text nodes
            // This is a simplified version - full implementation would traverse DOM
            const bodyText = document.body.innerText;
            const translated = await translator.translate(bodyText);
            
            return { success: true, method: 'chrome-ai', note: 'AI translation successful. For full page translation, language packs are downloaded automatically.' };
          } catch (e) {
            return { error: e.message };
          }
        })()
        `;
        const result = await view.webContents.executeJavaScript(code);
        return result;
      } catch (e) {
        console.error("[Translation] Chrome AI translation failed:", e);
        return { error: e.message };
      }
    } else {
      // Google Translate Element (Legacy Injection)
      try {
        // Improved Google Translate Injection with Cookie Support for faster activation
        const code = `
      (function() {
        // Set the Google Translate cookie for the target language
        // Format: /auto/[target_lang]
        const lang = '${targetLanguage}';
        document.cookie = 'googtrans=/auto/' + lang + '; path=/; domain=' + window.location.hostname;
        document.cookie = 'googtrans=/auto/' + lang + '; path=/;';
        
        if (!document.getElementById('google_translate_element')) {
          const div = document.createElement('div');
          div.id = 'google_translate_element';
          div.style.display = 'none';
          document.body.appendChild(div);
          
          window.googleTranslateElementInit = function() {
            new google.translate.TranslateElement({
              pageLanguage: 'auto',
              layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
              autoDisplay: true
            }, 'google_translate_element');
          };

          const script = document.createElement('script');
          script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
          document.body.appendChild(script);
        } else {
          // If already exists, just trigger the change
          const combo = document.querySelector('.goog-te-combo');
          if (combo) {
            combo.value = lang;
            combo.dispatchEvent(new Event('change'));
          }
        }
        
        // Polling for the combo box as a backup
        let attempts = 0;
        const check = setInterval(function() {
          const combo = document.querySelector('.goog-te-combo');
          if (combo) {
            if (combo.value !== lang) {
              combo.value = lang;
              combo.dispatchEvent(new Event('change'));
            }
            clearInterval(check);
          }
            if (attempts++ > 20) clearInterval(check);
        }, 500);
      })()
    `;
        await view.webContents.executeJavaScript(code);
        return { success: true, method: 'google' };
      } catch (e) {
        console.error("[Translation] Website translation failed:", e);
        return { error: e.message };
      }
    }
  });

  // Integrated Translation IPC (Google Translate + Neural Fallback)
  ipcMain.handle('translate-text', async (event, { text, from, to }) => {
    if (!text) return { success: false, error: 'No text provided' };

    // Support both 'to' and 'targetLanguage' (some frontend parts might use different keys)
    const targetLang = to || 'en';
    const sourceLang = from || 'auto';

    try {
      console.log(`[Translation] Attempting Google Translate for: "${text.substring(0, 30)}..." to ${targetLang}`);
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data && data[0]) {
        const translated = data[0].map(x => x[0]).join('');
        return {
          success: true,
          translated,
          method: 'google'
        };
      }
    } catch (e) {
      console.warn("[Translation] Google Translate API failed, falling back to Neural Engine:", e.message);
    }

    // Neural Fallback
    try {
      console.log(`[Neural Translation] Translating to ${targetLang} using ${activeLlmProvider}`);
      const prompt = [
        { role: 'system', content: `You are a high-performance neural translation engine. Translate the following text into ${targetLang}. Return ONLY the translated string.` },
        { role: 'user', content: text }
      ];

      const result = await llmGenerateHandler(prompt, { temperature: 0.3 });
      if (result.error) throw new Error(result.error);

      return {
        success: true,
        translated: result.text,
        method: 'neural',
        provider: activeLlmProvider
      };
    } catch (error) {
      console.error("[Translation] All translation methods failed:", error);
      return { success: false, error: error.message };
    }
  });

  /*
  // Export Chat as TXT
  ipcMain.removeHandler('export-chat-txt');
  ipcMain.handle('export-chat-txt', async (event, content) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Chat History',
      defaultPath: path.join(app.getPath('downloads'), `comet-chat-session-${Date.now()}.txt`),
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (!canceled && filePath) {
      try {
        fs.writeFileSync(filePath, content);
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: 'Canceled' };
  });
  */


  // Redundant generate-pdf handler removed


  // Setup Context Menu
  contextMenu({
    showSaveImageAs: true,
    showInspectElement: true,
    showCopyImageAddress: true,
    showSearchWithGoogle: true,
    prepend: (defaultActions, parameters, browserWindow) => [
      {
        label: '🚀 Analyze with Comet AI',
        visible: parameters.selectionText.trim().length > 0,
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.send('ai-query-detected', parameters.selectionText);
          }
        }
      },
      {
        label: '📄 Summarize Page',
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.send('ai-query-detected', 'Summarize this page');
          }
        }
      },
      {
        label: '🌐 Translate this Site',
        click: () => {
          // This will trigger the translation IPC
          if (mainWindow) {
            mainWindow.webContents.send('trigger-translation-dialog');
          }
        }
      }
    ]
  });

  ipcMain.handle('decrypt-data', async (event, { encryptedData, key, iv, authTag, salt }) => {
    try {
      const derivedKey = await deriveKey(key, Buffer.from(salt));
      const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, Buffer.from(iv));
      decipher.setAuthTag(Buffer.from(authTag));

      const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedData)), decipher.final()]);
      return { decryptedData: decrypted.buffer };
    } catch (error) {
      console.error('[Main] Decryption failed:', error);
      return { error: error.message };
    }
  });

  ipcMain.handle('create-desktop-shortcut', async (event, { url, title }) => {
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const shortcutPath = path.join(desktopPath, `${title.replace(/[^a-z0-9]/gi, '_').substring(0, 30)}.url`);

    const content = `[InternetShortcut]\nURL = ${url} \n`;

    try {
      fs.writeFileSync(shortcutPath, content);
      return { success: true, path: shortcutPath };
    } catch (error) {
      console.error('[Main] Failed to create shortcut:', error);
      return { error: error.message };
    }
  });

  ipcMain.handle('set-alarm', async (event, { time, message }) => {
    const platform = process.platform;
    let command = '';

    const alarmTime = new Date(time);
    if (isNaN(alarmTime.getTime())) {
      return { success: false, error: 'Invalid alarm time format.' };
    }

    // Format time for various OS commands
    const hour = alarmTime.getHours();
    const minute = alarmTime.getMinutes();
    const year = alarmTime.getFullYear();
    const month = alarmTime.getMonth() + 1; // Month is 0-indexed
    const day = alarmTime.getDate();

    const formattedTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} `;
    const formattedDate = `${month} /${day}/${year} `;

    if (platform === 'win32') {
      // Windows: Use PowerShell to create a scheduled task
      // Note: Creating scheduled tasks requires Administrator privileges.
      // This command will create a basic task that displays a message.
      command = `powershell.exe - Command "$Action = New-ScheduledTaskAction -Execute 'msg.exe' -Argument '* ${message}'; $Trigger = New-ScheduledTaskTrigger -Once -At '${formattedTime}'; Register-ScheduledTask -TaskName 'CometAlarm_${Date.now()}' -Action $Action -Trigger $Trigger -Description '${message}'"`;
    } else if (platform === 'darwin') {
      // macOS: Use osascript to create a Calendar event or a reminder
      // Creating a reminder is more straightforward for a simple alarm.
      command = `osascript - e 'tell application "Reminders" to make new reminder with properties {name:"${message}", remind me date:"${alarmTime.toISOString()}"}'`;
      // Alternatively, for a notification at a specific time:
      // command = `osascript - e 'display notification "${message}" with title "Comet Alarm" subtitle "Time to Wake Up!"' - e 'delay $(((${alarmTime.getTime()} - $(date +%s%3N)) / 1000))' - e 'display dialog "${message}" buttons {"OK"} default button 1 with title "Comet Alarm"'`;
    } else if (platform === 'linux') {
      // Linux: Use 'at' command (requires 'at' daemon to be running)
      // Example: echo "DISPLAY=:0 notify-send 'Comet Alarm' '${message}'" | at ${formattedTime} ${formattedDate}
      // `at` command format: `at[-m] TIME[DATE]`, e.g., `at 10:00 tomorrow`
      command = `echo "DISPLAY=:0 notify-send 'Comet Alarm' '${message}'" | at ${formattedTime} ${formattedDate} `;
    } else {
      return { success: false, error: `Unsupported platform for alarms: ${platform} ` };
    }

    return new Promise((resolve) => {
      exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
          console.error(`Set alarm error on ${platform}: `, error);
          resolve({ success: false, error: stderr || error.message });
        } else {
          resolve({ success: true, message: `Alarm set for ${alarmTime.toLocaleString()}` });
        }
      });
    });
  });

  // ============================================================================
  // AUTOMATION & TASK SCHEDULING
  // ============================================================================
  let ipcService = null;
  let taskScheduler = null;
  let taskQueue = null;
  let storageManager = null;
  let mobileNotifier = null;

  async function initializeAutomationService() {
    try {
      // Check if modules exist
      const path = require('path');
      const fs = require('fs');
      
      // Only initialize if service files exist
      const servicePath = path.join(__dirname, 'src', 'service');
      if (!fs.existsSync(servicePath)) {
        console.log('[Main] Service path does not exist, skipping automation init');
        return;
      }

       const IPCService = require('./src/service/ipc-service.js');
       const Scheduler = require('./src/service/scheduler.js');
       const TaskQueue = require('./src/service/task-queue.js');
       const Storage = require('./src/service/storage.js');
       const MobileNotifier = require('./src/service/mobile-notifier.js');

       const StorageManagerClass = Storage.StorageManager;
       const documentsPath = app.getPath('documents') || path.join(os.homedir(), 'Documents');
       const automationStoragePath = path.join(documentsPath, 'Comet-AI');
       storageManager = new StorageManagerClass(automationStoragePath);
       await storageManager.initialize();

       taskQueue = new TaskQueue(storageManager);
       taskScheduler = new Scheduler(taskQueue, storageManager);

      mobileNotifier = new MobileNotifier();
      await mobileNotifier.initialize();

      ipcService = new IPCService(taskScheduler, taskQueue, storageManager, mobileNotifier);
      ipcService.initialize();

      console.log('[Main] Automation service initialized');
    } catch (error) {
      console.error('[Main] Failed to initialize automation service:', error);
    }
  }

  ipcMain.handle('automation:create-task', async (event, taskData) => {
    if (!ipcService) {
      await initializeAutomationService();
    }
    const task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...taskData,
      enabled: true,
      runCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await storageManager.saveTask(task);
      await taskScheduler.scheduleTask(task);
      console.log('[Main] Task scheduled:', task.name);
      return { success: true, task };
    } catch (error) {
      console.error('[Main] Failed to create task:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('automation:get-tasks', async () => {
    try {
      if (!storageManager) {
        console.log('[Main] Storage not initialized, initializing now...');
        await initializeAutomationService();
      }
      if (!storageManager || !storageManager.getAllTasks) {
        console.log('[Main] Storage not available, returning empty array');
        return [];
      }
      return await storageManager.getAllTasks();
    } catch (error) {
      console.error('[Main] Error getting tasks:', error);
      return [];
    }
  });

  ipcMain.handle('automation:get-task', async (event, taskId) => {
    if (!storageManager) {
      await initializeAutomationService();
    }
    return await storageManager.getTask(taskId);
  });

  ipcMain.handle('automation:update-task', async (event, taskId, updates) => {
    if (!storageManager) {
      await initializeAutomationService();
    }
    const task = await storageManager.getTask(taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    const updatedTask = { ...task, ...updates, updatedAt: new Date().toISOString() };
    await storageManager.saveTask(updatedTask);

    if (updates.trigger || updates.enabled !== undefined) {
      if (updatedTask.enabled) {
        await taskScheduler.scheduleTask(updatedTask);
      } else {
        await taskScheduler.unscheduleTask(taskId);
      }
    }

    return { success: true, task: updatedTask };
  });

  ipcMain.handle('automation:delete-task', async (event, taskId) => {
    if (!taskScheduler) {
      await initializeAutomationService();
    }
    try {
      await taskScheduler.unscheduleTask(taskId);
      await storageManager.deleteTask(taskId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('automation:toggle-task', async (event, taskId) => {
    if (!taskScheduler || !storageManager) {
      await initializeAutomationService();
    }
    const task = await storageManager.getTask(taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    task.enabled = !task.enabled;
    task.updatedAt = new Date().toISOString();
    await storageManager.saveTask(task);

    if (task.enabled) {
      await taskScheduler.scheduleTask(task);
    } else {
      await taskScheduler.unscheduleTask(taskId);
    }

    return { success: true, task };
  });

  ipcMain.handle('automation:run-task', async (event, taskId) => {
    if (!taskScheduler || !storageManager) {
      await initializeAutomationService();
    }
    const task = await storageManager.getTask(taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    try {
      await taskScheduler.executeTask(task, { force: true });
      return { success: true, taskId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('automation:get-logs', async (event, date) => {
    if (!storageManager) {
      await initializeAutomationService();
    }
    return await storageManager.getLogs(date);
  });

  ipcMain.handle('automation:get-results', async (event, taskId) => {
    if (!storageManager) {
      await initializeAutomationService();
    }
    return await storageManager.getResults(taskId);
  });

  initializeAutomationService();

  // ============================================================================
  // POPUP WINDOW SYSTEM - Fix for panels appearing behind browser view
  // ============================================================================
  /**
   * Creates a popup window that appears on top of the browser view
   * This solves the z-index issue where panels appear behind the webview
   */
  function getPopupUrl(type) {
    const baseUrl = isDev
      ? 'http://localhost:3003'
      : `file://${path.join(__dirname, 'out', 'index.html')}`;

    let route = '';
    switch (type) {
      case 'settings':
        route = isDev ? '/?panel=settings' : '/settings';
        break;
      case 'extensions':
      case 'plugins':
        route = isDev ? '/?panel=extensions' : '/extensions';
        break;
      case 'profile':
        route = isDev ? '/?panel=profile' : '/profile';
        break;
      case 'downloads':
        route = isDev ? '/?panel=downloads' : '/downloads';
        break;
      case 'clipboard':
        route = isDev ? '/?panel=clipboard' : '/clipboard';
        break;
      case 'cart':
      case 'unified-cart':
        route = isDev ? '/?panel=cart' : '/cart';
        break;
      case 'search':
      case 'search-apps':
        route = isDev ? '/?panel=apps' : '/apps';
        break;
      case 'translate':
        route = isDev ? '/?panel=translate' : '/translate';
        break;
      case 'ai-overview':
        route = isDev ? '/?panel=ai-overview' : '/ai-overview';
        break;
      case 'context-menu':
      case 'rightclick':
        route = isDev ? '/?panel=context-menu' : '/context-menu';
        break;
      default:
        route = `/${type}`;
    }

    if (isDev) {
      return `${baseUrl}${route}`;
    }

    const routePathIndex = route === '/' ? '/index.html' : `${route}/index.html`;
    const routePathHtml = route === '/' ? '/index.html' : `${route}.html`;
    const fullPathIndex = path.join(__dirname, 'out', routePathIndex);
    const fullPathHtml = path.join(__dirname, 'out', routePathHtml);

    if (fs.existsSync(fullPathIndex)) {
      return `file://${fullPathIndex}`;
    }
    if (fs.existsSync(fullPathHtml)) {
      return `file://${fullPathHtml}`;
    }
    return `file://${path.join(__dirname, 'out', 'index.html')}#${route}`;
  }

  function normalizeAttachedPopupBounds(options = {}) {
    const mainBounds = mainWindow.getBounds();
    const width = Math.round(options.width || 500);
    const height = Math.round(options.height || 500);
    const rawX = typeof options.x === 'number' ? options.x - mainBounds.x : mainBounds.width - width - 24;
    const rawY = typeof options.y === 'number' ? options.y - mainBounds.y : 80;

    return {
      x: Math.max(0, Math.min(Math.round(rawX), Math.max(0, mainBounds.width - width))),
      y: Math.max(0, Math.min(Math.round(rawY), Math.max(0, mainBounds.height - height))),
      width,
      height,
    };
  }

  function createAttachedPopupView(type, options = {}) {
    const { closeOnBlur = false } = options;
    const bounds = normalizeAttachedPopupBounds(options);

    if (popupViews.has(type)) {
      const existing = popupViews.get(type);
      if (existing && !existing.webContents.isDestroyed()) {
        existing.setBounds(bounds);
        addChildView(existing);
        existing.webContents.focus();
        return existing;
      }
      popupViews.delete(type);
    }

    const popupView = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    popupView.setBackgroundColor('#00000000');
    popupView.setBounds(bounds);
    addChildView(popupView);
    popupViews.set(type, popupView);
    popupView.webContents.loadURL(getPopupUrl(type));
    popupView.webContents.focus();

    if (closeOnBlur) {
      popupView.webContents.on('blur', () => {
        if (popupViews.get(type) === popupView) {
          destroyPopupView(type);
        }
      });
    }

    popupView.webContents.on('destroyed', () => {
      if (popupViews.get(type) === popupView) {
        popupViews.delete(type);
        sendPopupClosed(type);
      }
    });

    return popupView;
  }

  function createPopupWindow(type, options = {}) {
    if (embeddedPopupTypes.has(type)) {
      return createAttachedPopupView(type, options);
    }

    const { closeOnBlur = false, ...windowOptions } = options;
    if (popupWindows.has(type)) {
      const existing = popupWindows.get(type);
      if (existing && !existing.isDestroyed()) {
        existing.setAlwaysOnTop(true, 'screen-saturation');
        existing.show();
        existing.focus();
        existing.moveTop();
        return existing;
      }
      popupWindows.delete(type);
    }

    const defaultOptions = {
      width: 1000,
      height: 700,
      frame: false,
      transparent: true,
      roundedCorners: true,
      backgroundColor: '#00000000',
      hasShadow: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
      parent: mainWindow,
      modal: false,
      alwaysOnTop: true, // Critical: ensures popup appears above browser view
      skipTaskbar: true,
      resizable: true,
      minimizable: false,
      maximizable: false,
      show: false,
    };

    const popup = new BrowserWindow({ ...defaultOptions, ...windowOptions });

    // Ensure popup appears above BrowserView by removing parent and using alwaysOnTop
    popup.setAlwaysOnTop(true, 'screen-saturation');

    const url = getPopupUrl(type);
    console.log(`[Main] Loading popup URL: ${url}`);
    popup.loadURL(url);

    popup.once('ready-to-show', () => {
      popup.show();
      popup.focus();
      // Ensure popup is always on top of BrowserView
      popup.moveTop();
    });

    if (closeOnBlur) {
      popup.on('blur', () => {
        if (!popup.isDestroyed()) {
          popup.close();
        }
      });
    }

    popup.on('closed', () => {
      popupWindows.delete(type);
      sendPopupClosed(type);
    });

    popupWindows.set(type, popup);
    return popup;
  }

  // IPC Handlers for popup windows
  ipcMain.on('open-popup-window', (event, { type, options }) => {
    createPopupWindow(type, options);
  });

  ipcMain.on('close-popup-window', (event, type) => {
    if (popupViews.has(type)) {
      destroyPopupView(type);
      return;
    }

    if (popupWindows.has(type)) {
      const popup = popupWindows.get(type);
      if (popup && !popup.isDestroyed()) {
        popup.close();
      }
      popupWindows.delete(type);
    }
  });

  ipcMain.on('close-all-popups', () => {
    Array.from(popupViews.keys()).forEach((type) => destroyPopupView(type));
    popupWindows.forEach((popup, type) => {
      if (popup && !popup.isDestroyed()) {
        popup.close();
      }
    });
    popupWindows.clear();
  });

  // Specific popup handlers
  ipcMain.on('open-settings-popup', (event, section = 'profile') => {
    createPopupWindow('settings', {
      width: 1200,
      height: 800,
    });
    // Send the section to open after window is ready
    setTimeout(() => {
      const popup = popupWindows.get('settings');
      if (popup && !popup.isDestroyed()) {
        popup.webContents.send('set-settings-section', section);
      }
    }, 500);
  });

  ipcMain.on('open-profile-popup', () => {
    createPopupWindow('profile', {
      width: 600,
      height: 700,
    });
  });

  ipcMain.on('open-plugins-popup', () => {
    createPopupWindow('plugins', {
      width: 900,
      height: 700,
    });
  });

  ipcMain.on('open-downloads-popup', () => {
    createPopupWindow('downloads', {
      width: 400,
      height: 600,
      closeOnBlur: true,
    });
  });

  ipcMain.on('open-clipboard-popup', () => {
    createPopupWindow('clipboard', {
      width: 450,
      height: 650,
      closeOnBlur: true,
    });
  });

  ipcMain.on('open-cart-popup', () => {
    createPopupWindow('cart', {
      width: 500,
      height: 700,
      closeOnBlur: true,
    });
  });

  ipcMain.on('open-search-popup', (event, options = {}) => {
    createPopupWindow('search', {
      width: 600,
      height: 500,
      closeOnBlur: true,
      ...options
    });
  });

  ipcMain.on('open-translate-popup', (event, options = {}) => {
    createPopupWindow('translate', {
      width: 400,
      height: 500,
      ...options
    });
  });

  ipcMain.on('open-context-menu-popup', (event, options = {}) => {
    createPopupWindow('context-menu', {
      width: 250,
      height: 400,
      ...options
    });
  });

  // Google login removed. Authentication redirected to ponsrischool web-auth.

  // ============================================================================
  // SHELL COMMAND EXECUTION - For AI control of system features
  // ============================================================================


  // Remove existing handler if present to prevent "second handler" error
  ipcMain.removeHandler('click-element');
  ipcMain.handle('click-element', async (event, selector) => {
    const view = tabViews.get(activeTabId);
    if (!view) return { success: false, error: 'No active view' };
    try {
      const result = await view.webContents.executeJavaScript(`
      (() => {
        const rawTarget = ${JSON.stringify(selector || '')}.trim();

        const normalize = (value) => (value || '').replace(/\\s+/g, ' ').trim().toLowerCase();
        const isVisible = (el) => {
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        };
        const clickElement = (el, matchedBy) => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
          const rect = el.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;

          if (typeof el.focus === 'function') {
            el.focus({ preventScroll: true });
          }

          ['pointerover', 'mouseover', 'mousemove', 'pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach((type) => {
            el.dispatchEvent(new MouseEvent(type, {
              bubbles: true,
              cancelable: true,
              composed: true,
              clientX: centerX,
              clientY: centerY,
              view: window
            }));
          });

          el.click();
          return {
            success: true,
            matchedBy,
            tagName: el.tagName.toLowerCase(),
            text: (el.innerText || el.textContent || el.value || '').trim().slice(0, 160),
            rect: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            }
          };
        };

        let element = null;
        if (rawTarget) {
          try {
            element = document.querySelector(rawTarget);
          } catch (e) {
            element = null;
          }
        }

        if (element && isVisible(element)) {
          return clickElement(element, 'selector');
        }

        const normalizedTarget = normalize(rawTarget);
        if (!normalizedTarget) {
          return { success: false, error: 'Missing selector or button text' };
        }

        const candidates = Array.from(document.querySelectorAll(
          'button, a, [role="button"], input[type="button"], input[type="submit"], input[type="reset"], summary, label'
        )).filter(isVisible);

        let bestMatch = null;
        let bestScore = -1;

        for (const candidate of candidates) {
          const textCandidates = [
            candidate.innerText,
            candidate.textContent,
            candidate.getAttribute('aria-label'),
            candidate.getAttribute('title'),
            candidate.getAttribute('name'),
            candidate.getAttribute('value'),
            candidate.getAttribute('placeholder')
          ].filter(Boolean);

          const haystack = normalize(textCandidates.join(' '));
          if (!haystack) continue;

          let score = 0;
          if (haystack === normalizedTarget) score += 200;
          if (haystack.startsWith(normalizedTarget)) score += 120;
          if (haystack.includes(normalizedTarget)) score += 80;
          if (normalizedTarget.includes(haystack)) score += 40;
          if (candidate.tagName.toLowerCase() === 'button') score += 10;

          if (score > bestScore) {
            bestScore = score;
            bestMatch = candidate;
          }
        }

        if (bestMatch) {
          return clickElement(bestMatch, 'text');
        }
        return { success: false, error: 'Element not found: ' + rawTarget };
      })()
    `);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('type-text', async (event, { selector, text }) => {
    const view = tabViews.get(activeTabId);
    if (!view) return { success: false, error: 'No active view' };
    try {
      await view.webContents.executeJavaScript(`
      (() => {
        const el = document.querySelector('${selector}');
        if (el) {
          el.focus();
          el.value = '${text.replace(/'/g, "\\'")}';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
      })()
    `);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fill-form', async (event, formData) => {
    const view = tabViews.get(activeTabId);
    if (!view) return { success: false, error: 'No active view' };
    try {
      await view.webContents.executeJavaScript(`
      (() => {
        const data = ${JSON.stringify(formData)};
        let successCount = 0;
        for (const [selector, value] of Object.entries(data)) {
           const el = document.querySelector(selector);
           if (el) {
             el.focus();
             el.value = value;
             el.dispatchEvent(new Event('input', { bubbles: true }));
             el.dispatchEvent(new Event('change', { bubbles: true }));
             successCount++;
           }
        }
        return successCount;
      })()
    `);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Duplicate select-local-file removed


  // Duplicate execute-shell-command removed


  // ============================================================================
  // SCREEN CAPTURE - For OCR and cross-app clicking
  // ============================================================================


  // ============================================================================
  // APPLICATION SEARCH - Search for installed applications
  // ============================================================================
  ipcMain.handle('search-applications', async (event, query) => {
    console.log('[AppSearch] Searching for:', query);

    const platform = process.platform;
    const results = [];

    try {
      if (platform === 'win32') {
        // Windows: Search only in Start Menu for performance. Program Files is too slow for recursive readdir.
        const searchPaths = [
          path.join(process.env.ProgramData, 'Microsoft/Windows/Start Menu/Programs'),
          path.join(process.env.APPDATA, 'Microsoft/Windows/Start Menu/Programs'),
          'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs',
          path.join(process.env.USERPROFILE, 'AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs')
        ];

        for (const searchPath of searchPaths) {
          if (fs.existsSync(searchPath)) {
            // Limited depth search (max 3 levels)
            const getFiles = (dir, depth = 0) => {
              if (depth > 3) return [];
              try {
                let results = [];
                const list = fs.readdirSync(dir, { withFileTypes: true });
                for (const file of list) {
                  const res = path.resolve(dir, file.name);
                  if (file.isDirectory()) {
                    results = results.concat(getFiles(res, depth + 1));
                  } else {
                    if (file.name.toLowerCase().includes(query.toLowerCase()) &&
                      (file.name.endsWith('.lnk') || file.name.endsWith('.exe'))) {
                      results.push({
                        name: path.basename(file.name, path.extname(file.name)),
                        path: res
                      });
                    }
                  }
                }
                return results;
              } catch (e) { return []; }
            };

            results.push(...getFiles(searchPath));
          }
        }
      } else if (platform === 'darwin') {
        // macOS: Search in Applications folder
        const appsPath = '/Applications';
        if (fs.existsSync(appsPath)) {
          const apps = fs.readdirSync(appsPath);
          apps.forEach(app => {
            if (app.toLowerCase().includes(query.toLowerCase()) && app.endsWith('.app')) {
              results.push({
                name: path.basename(app, '.app'),
                path: path.join(appsPath, app)
              });
            }
          });
        }
      } else {
        // Linux: Search in common application directories
        const searchPaths = ['/usr/share/applications', '/usr/local/share/applications'];

        for (const searchPath of searchPaths) {
          if (fs.existsSync(searchPath)) {
            const files = fs.readdirSync(searchPath);
            files.forEach(file => {
              if (file.toLowerCase().includes(query.toLowerCase()) && file.endsWith('.desktop')) {
                results.push({
                  name: path.basename(file, '.desktop'),
                  path: path.join(searchPath, file)
                });
              }
            });
          }
        }
      }

      return {
        success: true,
        results: results.slice(0, 20) // Limit to 20 results
      };
    } catch (error) {
      console.error('[AppSearch] Error:', error);
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  });

  // ============================================================================
  // OPEN EXTERNAL APP - Launch applications
  // ============================================================================
  // Duplicate open-external-app command removed


  // ============================================================================
  // AUTOMATION & OCR - Integrated handlers
  // ============================================================================

  // Helper: Capture Screen Region
  async function captureScreenRegion(bounds, outputPath) {
    try {
      if (robot && bounds) {
        // Use robotjs for specific region if available (fastest)
        const bmp = robot.screen.capture(bounds.x, bounds.y, bounds.width, bounds.height);

        // Create new Jimp image (v0.x API)
        const jimpImage = new Jimp(bmp.width, bmp.height);

        let pos = 0;
        // Convert raw BGRA to RGBA for Jimp
        jimpImage.scan(0, 0, jimpImage.bitmap.width, jimpImage.bitmap.height, (x, y, idx) => {
          jimpImage.bitmap.data[idx + 2] = bmp.image.readUInt8(pos++); // B -> R
          jimpImage.bitmap.data[idx + 1] = bmp.image.readUInt8(pos++); // G
          jimpImage.bitmap.data[idx + 0] = bmp.image.readUInt8(pos++); // R -> B
          jimpImage.bitmap.data[idx + 3] = bmp.image.readUInt8(pos++); // A
        });

        await jimpImage.writeAsync(outputPath);
        return outputPath;
      } else {
        // Fallback to screenshot-desktop (full screen)
        const imgBuffer = await screenshot({ format: 'png' });
        const jimpImage = await Jimp.read(imgBuffer);

        if (bounds) {
          jimpImage.crop(bounds.x, bounds.y, bounds.width, bounds.height);
        }

        await jimpImage.writeAsync(outputPath);
        return outputPath;
      }
    } catch (error) {
      console.error('Capture failed:', error);
      throw error;
    }
  }

  // Handler: Perform OCR
  ipcMain.handle('perform-ocr', async (event, options) => {
    const { useNative = true, bounds, language = 'eng', imagePath } = options || {};
    let tempFile = imagePath;
    let shouldDelete = false;

    if (!tempFile) {
      tempFile = path.join(os.tmpdir(), `ocr_${Date.now()}.png`);
      shouldDelete = true;
    }

    try {
      if (shouldDelete) {
        await captureScreenRegion(bounds, tempFile);
      }

      if (useNative) {
        try {
          if (process.platform === 'darwin') {
            const script = `
      use framework "Vision"
      use framework "AppKit"
      use scripting additions
      
      set imagePath to "${tempFile}"
      set imageURL to current application's NSURL's fileURLWithPath:imagePath
      set requestHandler to current application's VNImageRequestHandler's alloc()'s initWithURL:imageURL options:(missing value)
      
      set textRequest to current application's VNRecognizeTextRequest's alloc()'s init()
      textRequest's setRecognitionLevel:(current application's VNRequestTextRecognitionLevelAccurate)
      
      requestHandler's performRequests:{textRequest} |error|:(missing value)
      
      set observations to textRequest's results()
      set resultText to ""
      repeat with observation in observations
          set resultText to resultText & (observation's text() as text) & linefeed
      end repeat
      
      return resultText
          `;
            const { stdout } = await execPromise(`osascript -l JavaScript -e '${script.replace(/'/g, "\\'")}'`);
            return { text: stdout.trim(), confidence: 0.95 };
          } else if (process.platform === 'win32') {
            const psScript = `
      Add-Type -AssemblyName System.Runtime.WindowsRuntime
      [Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime] | Out-Null
      [Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
      [Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics,ContentType=WindowsRuntime] | Out-Null
      
      $file = [Windows.Storage.StorageFile]::GetFileFromPathAsync("${tempFile}").GetAwaiter().GetResult()
      $stream = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read).GetAwaiter().GetResult()
      $decoder = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream).GetAwaiter().GetResult()
      $bitmap = $decoder.GetSoftwareBitmapAsync().GetAwaiter().GetResult()
      
      $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
      $result = $engine.RecognizeAsync($bitmap).GetAwaiter().GetResult()
      
      $result.Text
          `;
            const { stdout } = await execPromise(`powershell -Command "${psScript.replace(/"/g, '\\"')}"`);
            return { text: stdout.trim(), confidence: 0.90 };
          }
        } catch (nativeErr) {
          console.warn('Native OCR failed (fallback to Tesseract):', nativeErr.message);
        }
      }

      // Fallback to Tesseract
      if (!tesseractWorker) {
        tesseractWorker = await createWorker(language);
      }
      const { data } = await tesseractWorker.recognize(tempFile);
      return {
        text: data.text,
        confidence: data.confidence / 100,
        words: data.words.map(w => ({ text: w.text, bbox: w.bbox, confidence: w.confidence / 100 }))
      };

    } catch (error) {
      console.error('OCR Error:', error);
      return { error: error.message };
    } finally {
      if (shouldDelete) {
        try { fs.unlinkSync(tempFile); } catch (e) { }
      }
    }
  });

  // Handler: Perform Click (Comprehensive)
  const performClickHandler = async (event, args) => {
    const { x, y, button = 'left', doubleClick = false } = args;

    try {
      await performRobotClick({ x, y, button, doubleClick });
      return { success: true };
    } catch (error) {
      console.error('Click Error:', error);
      return { success: false, error: error.message };
    }
  };

  ipcMain.handle('perform-click', performClickHandler);
  ipcMain.handle('perform-cross-app-click', performClickHandler); // Alias for backward compatibility

  // Handler: Get Window Info
  ipcMain.handle('get-window-info', async () => {
    try {
      if (process.platform === 'darwin') {
        const script = `
        tell application "System Events"
          set frontApp to name of first application process whose frontmost is true
          set frontWindow to name of front window of application process frontApp
          return {frontApp, frontWindow}
        end tell
      `;
        const { stdout } = await execPromise(`osascript -e '${script}'`);
        return { window: stdout.trim() }; // Simplified parsing
      } else if (process.platform === 'win32') {
        const script = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          using System.Text;
          public class Win32 {
              [DllImport("user32.dll")]
              public static extern IntPtr GetForegroundWindow();
              [DllImport("user32.dll")]
              public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
          }
"@
        $handle = [Win32]::GetForegroundWindow()
        $title = New-Object System.Text.StringBuilder 256
        [void][Win32]::GetWindowText($handle, $title, 256)
        $title.ToString()
      `;
        const { stdout } = await execPromise(`powershell -Command "${script}"`);
        return { window: stdout.trim() };
      }
      return null;
    } catch (error) {
      console.error('Get Window Info Error:', error);
      return { error: error.message };
    }
  });

  // Duplicate capture-screen-region removed - now consolidated in main handlers section

  // ============================================================================
  // DESKTOP AUTOMATION v2 — Permission, Robot, OCR, Vision IPC Handlers
  // ============================================================================

  // --- Permission Store ---
  ipcMain.handle('perm-grant', async (event, { key, level, description, sessionOnly }) => {
    try {
      permissionStore.grant(key, level, description, sessionOnly !== false);
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('perm-revoke', async (event, key) => {
    permissionStore.revoke(key);
    return { success: true };
  });

  ipcMain.handle('perm-revoke-all', async () => {
    permissionStore.revokeAll();
    return { success: true };
  });

  ipcMain.removeHandler('perm-check');
  ipcMain.handle('perm-check', async (event, key) => {
    return { granted: permissionStore.isGranted(key) };
  });

  ipcMain.handle('perm-list', async () => {
    return permissionStore.getAll();
  });

  ipcMain.handle('perm-audit-log', async (event, limit) => {
    return permissionStore.getAuditLog(limit || 100);
  });

  // Security Settings
  ipcMain.handle('security-settings-get', async () => {
    return permissionStore.getSettings();
  });

  ipcMain.handle('security-settings-update', async (event, settings) => {
    permissionStore.updateSettings(settings);
    return { success: true, settings: permissionStore.getSettings() };
  });

  ipcMain.handle('permission-auto-command', async (event, { command, enabled }) => {
    permissionStore.setAutoCommand(command, enabled);
    return { success: true, commands: permissionStore.getAutoApprovedCommands() };
  });

  ipcMain.handle('permission-auto-commands', async () => {
    return { commands: permissionStore.getAutoApprovedCommands() };
  });

  ipcMain.on('automation-shell-approval-response', (_event, { requestId, allowed }) => {
    const resolver = shellApprovalResolvers.get(requestId);
    if (resolver) {
      shellApprovalResolvers.delete(requestId);
      resolver(!!allowed);
    }
  });

  // --- Robot Service ---
  ipcMain.handle('robot-execute', async (event, action) => {
    if (!robotService) return { success: false, error: 'RobotService not initialized' };
    try {
      return await robotService.execute(action);
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('robot-execute-sequence', async (event, { actions, options }) => {
    if (!robotService) return { success: false, error: 'RobotService not initialized' };
    try {
      return await robotService.executeSequence(actions, options);
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('robot-kill', async () => {
    if (robotService) robotService.kill();
    return { success: true };
  });

  ipcMain.handle('robot-reset-kill', async () => {
    if (robotService) robotService.resetKill();
    return { success: true };
  });

  ipcMain.handle('robot-status', async () => {
    return {
      available: robotService?.isAvailable || false,
      permitted: permissionStore.isGranted('robot'),
      killActive: robotService?.killFlag || false,
    };
  });

  // --- Tesseract OCR v2 ---
  ipcMain.handle('ocr-capture-words', async (event, displayId) => {
    if (!tesseractOcrService) return { success: false, error: 'OCR service not initialized' };
    try {
      const words = await tesseractOcrService.captureAndOcr(displayId);
      return { success: true, words };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('ocr-click', async (event, { target, useAi }) => {
    if (!tesseractOcrService || !robotService) {
      return { success: false, error: 'OCR or Robot service not initialized' };
    }
    try {
      const ai = useAi !== false ? cometAiEngine : null;
      return await tesseractOcrService.ocrClick(target, ai, robotService, permissionStore);
    } catch (e) { return { success: false, error: e.message }; }
  });

  // --- DOM Click Handler (for in-app element clicks) ---
  ipcMain.handle('dom-click-element', async (event, { tabId, selector, text, index, waitFor }) => {
    const targetTabId = tabId || activeTabId;
    const view = tabViews.get(targetTabId);
    
    if (!view || !view.webContents) {
      return { success: false, error: 'Browser view not found' };
    }

    try {
      const clickCode = `
        (async () => {
          const MAX_RETRIES = 3;
          const RETRY_DELAY = 100;
          
          async function waitForElement(selector, timeout = 5000) {
            const startTime = Date.now();
            while (Date.now() - startTime < timeout) {
              const el = document.querySelector(selector);
              if (el) return el;
              await new Promise(r => setTimeout(r, 50));
            }
            return null;
          }
          
          async function clickElement(selector, waitForSelector, retryCount = 0) {
            if (waitForSelector) {
              const el = await waitForElement(waitForSelector);
              if (!el) {
                return { success: false, error: 'Element not found after waiting: ' + waitForSelector };
              }
            }
            
            let element;
            ${selector ? 'element = document.querySelector(selector);' : ''}
            
            if (!element && ${text ? 'true' : 'false'}) {
              const searchText = ${JSON.stringify(text || '')}.toLowerCase();
              const elements = document.querySelectorAll('*');
              for (const el of elements) {
                if (el.children.length === 0) {
                  const elText = (el.textContent || '').toLowerCase().trim();
                  if (elText.includes(searchText) || searchText.includes(elText)) {
                    element = el;
                    break;
                  }
                }
              }
              if (!element && ${index !== undefined ? 'true' : 'false'}) {
                const matches = [];
                for (const el of elements) {
                  if (el.children.length === 0) {
                    const elText = (el.textContent || '').toLowerCase().trim();
                    if (elText.includes(searchText)) {
                      matches.push(el);
                    }
                  }
                }
                element = matches[${index || 0}];
              }
            }
            
            if (!element) {
              return { success: false, error: 'Element not found: ' + (${JSON.stringify(selector || text || '')}) };
            }
            
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
              const parent = element.closest('button, a, [role="button"], input, select, textarea');
              if (parent) {
                element = parent;
              } else {
                return { success: false, error: 'Element has zero dimensions' };
              }
            }
            
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(r => setTimeout(r, 100));
            
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
            element.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, view: window, clientX: centerX, clientY: centerY }));
            element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
            element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
            element.click();
            
            return { 
              success: true, 
              element: selector || 'text:' + ${JSON.stringify(text || '')},
              rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
            };
          }
          
          return await clickElement(${JSON.stringify(selector)}, ${JSON.stringify(waitFor)}, 0);
        })()
      `;
      
      const result = await view.webContents.executeJavaScript(clickCode);
      return result;
    } catch (e) {
      console.error('[Main] DOM click failed:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('dom-find-element', async (event, { tabId, selector, text }) => {
    const targetTabId = tabId || activeTabId;
    const view = tabViews.get(targetTabId);
    
    if (!view || !view.webContents) {
      return { success: false, error: 'Browser view not found' };
    }

    try {
      const findCode = `
        (() => {
          let elements = [];
          
          if (${JSON.stringify(selector)}) {
            elements = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
          } else if (${JSON.stringify(text)}) {
            const searchText = ${JSON.stringify(text)}.toLowerCase();
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
              if (el.children.length === 0) {
                const elText = (el.textContent || '').toLowerCase().trim();
                if (elText.includes(searchText)) {
                  elements.push(el);
                }
              }
            }
          }
          
          return elements.slice(0, 20).map((el, i) => {
            const rect = el.getBoundingClientRect();
            return {
              index: i,
              tagName: el.tagName.toLowerCase(),
              className: el.className,
              id: el.id,
              text: (el.textContent || '').substring(0, 100),
              rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
              href: el.href || null,
              type: el.type || null,
              visible: rect.width > 0 && rect.height > 0
            };
          });
        })()
      `;
      
      const elements = await view.webContents.executeJavaScript(findCode);
      return { success: true, elements };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('dom-get-page-info', async (event, { tabId }) => {
    const targetTabId = tabId || activeTabId;
    const view = tabViews.get(targetTabId);
    
    if (!view || !view.webContents) {
      return { success: false, error: 'Browser view not found' };
    }

    try {
      const pageInfo = await view.webContents.executeJavaScript(`
        (() => {
          const escapeSelectorValue = (value) => String(value || '').replace(/"/g, '\\"');
          const isVisible = (el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
          };
          const buildSelector = (el) => {
            if (!el || !el.tagName) return '';
            const tag = el.tagName.toLowerCase();
            if (el.id) return '#' + CSS.escape(el.id);
            const dataTestId = el.getAttribute('data-testid');
            if (dataTestId) return tag + '[data-testid="' + escapeSelectorValue(dataTestId) + '"]';
            const name = el.getAttribute('name');
            if (name) return tag + '[name="' + escapeSelectorValue(name) + '"]';
            const ariaLabel = el.getAttribute('aria-label');
            if (ariaLabel) return tag + '[aria-label="' + escapeSelectorValue(ariaLabel) + '"]';
            const classNames = Array.from(el.classList || []).slice(0, 2).map((cls) => '.' + CSS.escape(cls)).join('');
            if (classNames) return tag + classNames;
            if (el.parentElement) {
              const siblings = Array.from(el.parentElement.children).filter((child) => child.tagName === el.tagName);
              if (siblings.length > 1) {
                return tag + ':nth-of-type(' + (siblings.indexOf(el) + 1) + ')';
              }
            }
            return tag;
          };

          return {
            url: window.location.href,
            title: document.title,
            bodyText: document.body.innerText.substring(0, 5000),
            links: Array.from(document.querySelectorAll('a')).slice(0, 50).map(a => ({
              href: a.href,
              text: a.textContent.trim().substring(0, 50)
            })),
            forms: Array.from(document.querySelectorAll('form')).map(f => ({
              action: f.action,
              method: f.method,
              inputs: Array.from(f.querySelectorAll('input')).slice(0, 10).map(i => ({
                name: i.name,
                type: i.type,
                placeholder: i.placeholder
              }))
            })),
            clickableElements: Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"], input[type="reset"], summary'))
              .filter(isVisible)
              .slice(0, 40)
              .map((el, i) => ({
                index: i,
                tagName: el.tagName.toLowerCase(),
                text: (el.textContent || el.value || '').trim().substring(0, 120),
                selector: buildSelector(el),
                href: el.href || null,
                ariaLabel: el.getAttribute('aria-label') || null,
                title: el.getAttribute('title') || null,
                rect: el.getBoundingClientRect()
              }))
          };
        })()
      `);
      return { success: true, ...pageInfo };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('ocr-screen-text', async (event, displayId) => {
    if (!tesseractOcrService) return { success: false, error: 'OCR service not initialized' };
    try {
      const text = await tesseractOcrService.getScreenText(displayId);
      return { success: true, text };
    } catch (e) { return { success: false, error: e.message }; }
  });

  // --- Screen Vision AI ---
  ipcMain.removeHandler('vision-describe');
  ipcMain.handle('vision-describe', async (event, question) => {
    if (!screenVisionService) return { success: false, error: 'Vision service not initialized' };
    try {
      const description = await screenVisionService.describe(question);
      return { success: true, description };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('vision-analyze', async (event, question) => {
    if (!screenVisionService || !tesseractOcrService) {
      return { success: false, error: 'Vision or OCR service not initialized' };
    }
    try {
      const result = await screenVisionService.analyzeAndAct(
        question, tesseractOcrService, robotService, permissionStore
      );
      return { success: true, ...result };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('vision-capture-base64', async () => {
    if (!screenVisionService) return { success: false, error: 'Vision service not initialized' };
    try {
      const image = await screenVisionService.captureBase64();
      return { success: true, image };
    } catch (e) { return { success: false, error: e.message }; }
  });

  // --- AI Engine (direct chat for automation tasks) ---
  ipcMain.handle('ai-engine-chat', async (event, { message, model, systemPrompt, history }) => {
    if (!cometAiEngine) return { success: false, error: 'AI engine not initialized' };
    try {
      const response = await cometAiEngine.chat({ message, model, systemPrompt, history });
      return { success: true, response };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('ai-engine-configure', async (event, keys) => {
    if (!cometAiEngine) return { success: false, error: 'AI engine not initialized' };
    cometAiEngine.configure(keys);
    if (keys.GEMINI_API_KEY) store.set('gemini_api_key', keys.GEMINI_API_KEY);
    if (keys.GROQ_API_KEY) store.set('groq_api_key', keys.GROQ_API_KEY);
    if (keys.OPENAI_API_KEY) store.set('openai_api_key', keys.OPENAI_API_KEY);
    if (keys.ANTHROPIC_API_KEY) store.set('anthropic_api_key', keys.ANTHROPIC_API_KEY);
    return { success: true };
  });

  // ============================================================================
  // FLUTTER BRIDGE — IPC Handlers
  // ============================================================================

  ipcMain.handle('bridge-get-pairing-code', async () => {
    if (!flutterBridge) return { success: false, error: 'Bridge not initialized' };
    return { success: true, code: flutterBridge.getPairingCode() };
  });

  ipcMain.handle('bridge-get-status', async () => {
    return {
      running: !!flutterBridge?.server,
      connectedDevices: flutterBridge?.getConnectedCount() || 0,
    };
  });

  ipcMain.handle('bridge-rotate-secret', async () => {
    if (!flutterBridge) return { success: false, error: 'Bridge not initialized' };
    flutterBridge.rotateSecret();
    return { success: true, code: flutterBridge.getPairingCode() };
  });

  ipcMain.handle('bridge-broadcast', async (event, message) => {
    if (!flutterBridge) return { success: false, error: 'Bridge not initialized' };
    flutterBridge.broadcast(message);
    return { success: true };
  });

  // ============================================================================
  // MCP DESKTOP SERVERS — FileSystem + NativeApp IPC Handlers
  // ============================================================================

  ipcMain.handle('mcp-fs-read', async (event, filePath) => {
    if (!fileSystemMcp) return { success: false, error: 'FileSystem MCP not initialized' };
    try {
      const content = await fileSystemMcp.readFile(filePath);
      return { success: true, content };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('mcp-fs-write', async (event, { path: p, content }) => {
    if (!fileSystemMcp) return { success: false, error: 'FileSystem MCP not initialized' };
    try {
      const result = await fileSystemMcp.writeFile(p, content);
      return { success: true, result };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('mcp-fs-list', async (event, dirPath) => {
    if (!fileSystemMcp) return { success: false, error: 'FileSystem MCP not initialized' };
    try {
      const entries = await fileSystemMcp.listDir(dirPath);
      return { success: true, entries };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('mcp-fs-approved-dirs', async () => {
    if (!fileSystemMcp) return { success: false, error: 'FileSystem MCP not initialized' };
    return { success: true, dirs: fileSystemMcp.getApprovedDirs() };
  });

  ipcMain.handle('mcp-native-applescript', async (event, script) => {
    if (!nativeAppMcp) return { success: false, error: 'NativeApp MCP not initialized' };
    try {
      validateCommand(script);
      const result = await nativeAppMcp.runAppleScript(script);
      return { success: true, result };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('mcp-native-powershell', async (event, script) => {
    if (!nativeAppMcp) return { success: false, error: 'NativeApp MCP not initialized' };
    try {
      validateCommand(script);
      const result = await nativeAppMcp.runPowerShell(script);
      return { success: true, result };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('mcp-native-active-window', async () => {
    if (!nativeAppMcp) return { success: false, error: 'NativeApp MCP not initialized' };
    try {
      const info = await nativeAppMcp.getActiveWindow();
      return { success: true, ...info };
    } catch (e) { return { success: false, error: e.message }; }
  });

  // ============================================================================
  // MCP CORE — Official MCP Server Connections
  // ============================================================================

  ipcMain.handle('mcp-connect-server', async (event, config) => {
    console.log(`[Main] Connecting to MCP server: ${config.name} (${config.url})`);
    const id = config.id || `mcp-${Date.now()}`;
    const success = await mcpManager.connect(id, config);
    if (success) {
      const servers = store.get('mcp_servers') || [];
      if (!servers.find(s => s.id === id)) {
        servers.push({ ...config, id });
        store.set('mcp_servers', servers);
      }
    }
    return { success, id };
  });

  ipcMain.handle('mcp-disconnect-server', async (event, id) => {
    console.log(`[Main] Disconnecting MCP server: ${id}`);
    await mcpManager.disconnect(id);
    const servers = store.get('mcp_servers') || [];
    const filtered = servers.filter(s => s.id !== id);
    if (filtered.length !== servers.length) {
      store.set('mcp_servers', filtered);
    }
    return { success: true };
  });

  ipcMain.handle('mcp-list-servers', async () => {
    return { success: true, servers: mcpManager.getAllServers() };
  });

  ipcMain.handle('mcp-get-tools', async () => {
    const tools = await mcpManager.getTools();
    return { success: true, tools };
  });

  ipcMain.handle('mcp-command', async (event, { command, data }) => {
    // Compatibility with existing frontend calls if any
    if (command === 'connect') return await mcpManager.connect(data.id, data);
    if (command === 'list') return mcpManager.getAllServers();
    return { error: 'Unknown MCP core command' };
  });

  // ============================================================================
  // WEB SEARCH v2 — Multi-provider (Brave / Tavily / SerpAPI)
  // ============================================================================

  // ============================================================================
  // RAG — Vector Store (Local Embeddings + Gemini)
  // ============================================================================

  ipcMain.handle('rag-ingest', async (event, { text, source }) => {
    if (!ragService) return { success: false, error: 'RAG not initialized' };
    try {
      const apiKey = store.get('gemini_api_key') || process.env.GEMINI_API_KEY;
      const count = await ragService.ingest(text, source, apiKey);
      return { success: true, chunksAdded: count };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('rag-retrieve', async (event, { query, k }) => {
    if (!ragService) return { success: false, error: 'RAG not initialized' };
    try {
      const apiKey = store.get('gemini_api_key') || process.env.GEMINI_API_KEY;
      const results = await ragService.retrieve(query, k, apiKey);
      return { success: true, results };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('rag-context', async (event, { query, k }) => {
    if (!ragService) return { success: false, error: 'RAG not initialized' };
    try {
      const apiKey = store.get('gemini_api_key') || process.env.GEMINI_API_KEY;
      const context = await ragService.retrieveContext(query, k, apiKey);
      return { success: true, context };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('rag-stats', async () => {
    if (!ragService) return { success: false, error: 'RAG not initialized' };
    return { success: true, ...ragService.getStats() };
  });

  ipcMain.handle('rag-delete-source', async (event, source) => {
    if (!ragService) return { success: false, error: 'RAG not initialized' };
    try {
      const deleted = await ragService.deleteSource(source);
      return { success: true, deleted };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('rag-clear', async () => {
    if (!ragService) return { success: false, error: 'RAG not initialized' };
    await ragService.clear();
    return { success: true };
  });

  // ============================================================================
  // VOICE CONTROL — Whisper Transcription
  // ============================================================================

  ipcMain.handle('voice-transcribe', async (event, { audioBase64, format }) => {
    if (!voiceService) return { success: false, error: 'Voice service not initialized' };
    try {
      const text = await voiceService.transcribeBase64(audioBase64, format || 'wav');
      return { success: true, text };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('voice-mic-permission', async () => {
    if (!voiceService) return { success: false, error: 'Voice service not initialized' };
    try {
      const granted = await voiceService.requestMicPermission();
      return { success: true, granted };
    } catch (e) { return { success: false, error: e.message }; }
  });

  // ============================================================================
  // WORKFLOW RECORDER — Record / Replay Action Sequences
  // ============================================================================

  ipcMain.handle('workflow-start', async () => {
    if (!workflowRecorder) return { success: false, error: 'Workflow recorder not initialized' };
    return { success: true, ...workflowRecorder.start() };
  });

  ipcMain.handle('workflow-record', async (event, { type, action }) => {
    if (!workflowRecorder) return { success: false, error: 'Workflow recorder not initialized' };
    const recorded = workflowRecorder.record(type, action);
    return { success: recorded };
  });

  ipcMain.handle('workflow-stop', async () => {
    if (!workflowRecorder) return { success: false, error: 'Workflow recorder not initialized' };
    return { success: true, ...workflowRecorder.stop() };
  });

  ipcMain.handle('workflow-save', async (event, { name, description }) => {
    if (!workflowRecorder) return { success: false, error: 'Workflow recorder not initialized' };
    try {
      const result = await workflowRecorder.save(name, description);
      return { success: true, ...result };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('workflow-list', async () => {
    if (!workflowRecorder) return { success: false, error: 'Workflow recorder not initialized' };
    try {
      const workflows = await workflowRecorder.list();
      return { success: true, workflows };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('workflow-replay', async (event, name) => {
    if (!workflowRecorder || !robotService) {
      return { success: false, error: 'Workflow recorder or robot service not initialized' };
    }
    try {
      const results = await workflowRecorder.replay(name, async (step) => {
        if (step.type === 'robot' && robotService) {
          return await robotService.execute(step.action, { skipConfirm: false });
        } else if (step.type === 'ocr' && tesseractOcrService) {
          return await tesseractOcrService.ocrClick(step.action.target, cometAiEngine, robotService, permissionStore);
        } else if (step.type === 'ai' && cometAiEngine) {
          return await cometAiEngine.chat(step.action);
        }
        return { skipped: true, type: step.type };
      });
      return { success: true, results };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('workflow-delete', async (event, name) => {
    if (!workflowRecorder) return { success: false, error: 'Workflow recorder not initialized' };
    try {
      const deleted = await workflowRecorder.deleteWorkflow(name);
      return { success: true, deleted };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('workflow-status', async () => {
    if (!workflowRecorder) return { success: false, error: 'Workflow recorder not initialized' };
    return { success: true, ...workflowRecorder.getStatus() };
  });

  // ============================================================================
  // PopSearch - Instant Search Popup
  // ============================================================================
  ipcMain.handle('pop-search-show', async (event, { text, x, y }) => {
    if (!popSearch) return { success: false, error: 'PopSearch not initialized' };
    try {
      popSearch.showPopupAtPosition(x, y, text || '');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('pop-search-show-at-cursor', async (event, text) => {
    if (!popSearch) return { success: false, error: 'PopSearch not initialized' };
    try {
      popSearch.showPopupWithText(text || '');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('pop-search-get-config', async () => {
    if (!popSearch) return { success: false, error: 'PopSearch not initialized' };
    return { success: true, config: popSearch.getConfig() };
  });

  ipcMain.handle('pop-search-update-config', async (event, config) => {
    if (!popSearch) return { success: false, error: 'PopSearch not initialized' };
    try {
      popSearch.updateConfig(config);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('pop-search-save-config', async (event, data) => {
    const { filePath } = await dialog.showSaveDialog({
      title: 'Export PopSearch Config',
      defaultPath: 'popsearch-config.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (filePath) {
      try {
        fs.writeFileSync(filePath, data, 'utf-8');
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, canceled: true };
  });

  ipcMain.handle('pop-search-load-config', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import PopSearch Config',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (!canceled && filePaths.length > 0) {
      return fs.readFileSync(filePaths[0], 'utf-8');
    }
    return null;
  });

  // Bring window to top to fix BrowserView z-index issues
  ipcMain.handle('bring-window-to-top', async () => {
    if (mainWindow) {
      mainWindow.moveTop();
      return { success: true };
    }
    return { success: false, error: 'No main window' };
  });

  // ============================================================================
  // GLOBAL HOTKEY - Register global shortcuts
  // ============================================================================
  function registerGlobalShortcuts(shortcuts) {
    // Default shortcuts if none provided
    const spotlightShortcut = process.platform === 'darwin' ? 'Option+Space' : 'Alt+Space';
    const defaultShortcuts = [
      { accelerator: spotlightShortcut, action: 'spotlight-search' },
      { accelerator: 'CommandOrControl+Shift+S', action: 'pop-search' },
      { accelerator: 'CommandOrControl+P', action: 'print' },
      { accelerator: process.platform === 'darwin' ? 'Command+Shift+Escape' : 'Control+Shift+Escape', action: 'kill-switch' }
    ];

    const shortcutsToRegister = (shortcuts && shortcuts.length > 0) ? shortcuts : defaultShortcuts;
    const normalizedShortcuts = shortcutsToRegister
      .filter((s) => s?.accelerator && !/[^\x00-\x7F]/.test(s.accelerator))
      .map((s) => ({ accelerator: s.accelerator, action: s.action }));
    const signature = JSON.stringify(normalizedShortcuts);

    if (signature === lastRegisteredShortcutsSignature) {
      return;
    }

    lastRegisteredShortcutsSignature = signature;
    globalShortcut.unregisterAll();

    shortcutsToRegister.forEach(s => {
      try {
        if (!s.accelerator) return;
        if (/[^\x00-\x7F]/.test(s.accelerator)) {
          console.warn(`[Hotkey] Skipping invalid shortcut signature: ${s.accelerator}`);
          return;
        }

        globalShortcut.register(s.accelerator, () => {
          console.log(`[Hotkey] Triggered: ${s.action} (${s.accelerator})`);

          if (s.action === 'spotlight-search' || s.action === 'global-search') {
            if (mainWindow) {
              if (mainWindow.isMinimized()) mainWindow.restore();
              if (!mainWindow.isVisible()) mainWindow.show();
              mainWindow.focus();
              mainWindow.webContents.send('open-unified-search');
            } else {
              createWindow();
            }
          } else if (s.action === 'pop-search') {
            if (popSearch) {
              popSearch.showPopupWithText('');
            }
          } else if (s.action === 'kill-switch' || s.action === 'emergency-kill') {
            console.log('[Hotkey] EMERGENCY KILL SWITCH activated');
            if (robotService) robotService.kill();
            if (mainWindow) {
              mainWindow.webContents.send('robot-killed');
              dialog.showMessageBox(mainWindow, {
                type: 'warning',
                title: 'Comet-AI Kill Switch',
                message: 'All robot actions have been stopped and permissions revoked.',
                detail: 'You can re-enable robot permissions in Settings > Permissions.',
              });
            }
          } else if (s.action === 'print') {
            const view = tabViews.get(activeTabId);
            if (view) view.webContents.print();
            else if (mainWindow) mainWindow.webContents.print();
          } else if (s.action === 'zoom-in') {
            const view = tabViews.get(activeTabId);
            if (view) {
              view.webContents.setZoomFactor(Math.min(3.0, view.webContents.getZoomFactor() + 0.1));
            }
          } else if (s.action === 'zoom-out') {
            const view = tabViews.get(activeTabId);
            if (view) {
              view.webContents.setZoomFactor(Math.max(0.5, view.webContents.getZoomFactor() - 0.1));
            }
          } else if (s.action === 'zoom-reset') {
            const view = tabViews.get(activeTabId);
            if (view) {
              view.webContents.setZoomFactor(1.0);
            }
          } else if (mainWindow) {
            mainWindow.webContents.send('execute-shortcut', s.action);
          }
        });
      } catch (e) {
        console.warn(`[Hotkey] Failed to register shortcut ${s.accelerator} for ${s.action}:`, e.message);
      }
    });

    console.log(`[Hotkeys] Registered ${globalShortcut.isRegistered('Alt+Space') ? 'Alt+Space' : 'global shortcuts'}`);
  }

  // Initial registration from store
  const savedShortcuts = store.get('shortcuts') || [];
  registerGlobalShortcuts(savedShortcuts);

  // Reconnect MCP Servers
  const mcpServers = store.get('mcp_servers');
  if (mcpServers && mcpServers.length > 0) {
    // Filter out servers with known issues
    const validServers = mcpServers.filter(s => 
      !s.url?.includes('google') && !s.name?.toLowerCase().includes('google')
    );
    if (validServers.length > 0) {
      console.log(`[Main] Reconnecting ${validServers.length} MCP servers...`);
      validServers.forEach(server => {
        mcpManager.connect(server.id, server).catch(err => {
          // Suppress connection errors - they'll show in UI
          console.log(`[MCP] ${server.name} unavailable: ${err.message || 'connection failed'}`);
        });
      });
    }
  } else {
    // Default MCP servers - users can add their own via settings
    // Note: Google MCP removed due to rate limiting issues (429)
    const defaultServers = [
      { id: 'github-mcp', name: 'GitHub MCP', url: 'https://api.github.com/mcp', type: 'sse', status: 'offline' },
      { id: 'filesystem-mcp', name: 'Filesystem MCP (Local)', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '.'], type: 'stdio', status: 'offline' }
    ];
    console.log('[Main] No MCP servers found, loading defaults.');
    store.set('mcp_servers', defaultServers);
  }


  ipcMain.on('update-shortcuts', (event, shortcuts) => {
    console.log('[Main] Updating global shortcuts');
    store.set('shortcuts', shortcuts);
    registerGlobalShortcuts(shortcuts);
  });

  app.on('will-quit', () => {
    // Clear persistent intervals
    if (networkCheckInterval) clearInterval(networkCheckInterval);
    if (clipboardCheckInterval) clearInterval(clipboardCheckInterval);

    // Stop MCP server
    if (mcpServer) {
      mcpServer.close();
      console.log('[Main] MCP Server stopped.');
    }

    // Disconnect P2P service
    if (p2pSyncService) {
      p2pSyncService.disconnect();
      console.log('[Main] P2P Sync Service disconnected.');
    }

    // Stop WiFi Sync service
    if (wifiSyncService) {
      wifiSyncService.stop();
      console.log('[Main] WiFi Sync Service stopped.');
    }

    // Cleanup desktop automation services
    if (tesseractOcrService) {
      tesseractOcrService.terminate().catch(() => { });
      console.log('[Main] TesseractOcrService terminated.');
    }

    if (flutterBridge) {
      flutterBridge.stop();
      console.log('[Main] FlutterBridgeServer stopped.');
    }

    // Unregister all shortcuts
    lastRegisteredShortcutsSignature = '';
    globalShortcut.unregisterAll();
  });

  app.on('before-quit', () => {
    if (macSidebarWindow && !macSidebarWindow.isDestroyed()) {
      macSidebarWindow.destroy();
    }
    if (raycastServer) {
      raycastServer.close();
    }
  });

  app.on('window-all-closed', async () => {
    if (macSidebarWindow && !macSidebarWindow.isDestroyed()) {
      macSidebarWindow.destroy();
    }
    // Terminate the Tesseract worker when the app quits
    if (tesseractWorker) {
      console.log('[Main] Terminating Tesseract.js worker...');
      await tesseractWorker.terminate();
      console.log('[Main] Tesseract.js worker terminated.');
    }
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // Final fallback to ensure process exits
  app.on('quit', async () => {
    process.exit(0);
  });
});
