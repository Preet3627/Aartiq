// ULTRA EARLY: GPU flags must be before ANY electron import
const electron = require('electron');
const { app, BrowserWindow, ipcMain, BrowserView, session, shell, clipboard, dialog, globalShortcut, Menu, protocol, desktopCapturer, screen, nativeImage, net, safeStorage, nativeTheme } = electron;

// Enable GPU immediately
if (app.isPackaged) {
  app.commandLine.appendSwitch('--enable-gpu');
  app.commandLine.appendSwitch('--enable-accelerated-2d-canvas');
  app.commandLine.appendSwitch('--use-gl', 'metal');
  app.commandLine.appendSwitch('--ignore-gpu-blacklist');
}
const { mcpManager } = require('./src/lib/mcp-server-registry.js');
const QRCode = require('qrcode');
const contextMenuRaw = require('electron-context-menu');
const contextMenu = contextMenuRaw.default || contextMenuRaw;
const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const PptxGenJS = require('pptxgenjs');
const {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ImageRun,
  PageNumber,
  Header,
  Footer,
  BorderStyle,
  VerticalAlign,
  AlignmentType,
  PageOrientation,
} = require('docx');
const path = require('path');
const os = require('os');
const { spawn, exec, spawnSync } = require('child_process');
const { randomBytes } = require('crypto');
const Store = require('electron-store');
const store = new Store();
const { createWorker } = require('tesseract.js');
const screenshot = require('screenshot-desktop');
const Jimp = require('jimp');
const util = require('util');
const execPromise = util.promisify(exec);
const AUTH_SESSION_KEY = 'secure_auth_session_v1';
const LEGACY_AUTH_TOKEN_KEY = 'auth_token';
const LEGACY_USER_INFO_KEY = 'user_info';

const getAuthStorageBackend = () => {
  if (process.platform !== 'linux') {
    return process.platform;
  }

  try {
    return safeStorage.getSelectedStorageBackend();
  } catch {
    return 'unknown';
  }
};

const canEncryptAuthSession = () => {
  if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
    return false;
  }

  const backend = getAuthStorageBackend();
  return backend !== 'basic_text' && backend !== 'unknown';
};

const saveSecureAuthSession = (sessionPayload = {}) => {
  if (!sessionPayload || typeof sessionPayload !== 'object') {
    return false;
  }

  if (!canEncryptAuthSession()) {
    console.warn('[Auth] Secure storage unavailable; auth session was not persisted.');
    return false;
  }

  const encrypted = safeStorage.encryptString(JSON.stringify(sessionPayload));
  store.set(AUTH_SESSION_KEY, {
    version: 1,
    encrypted: true,
    updatedAt: Date.now(),
    backend: getAuthStorageBackend(),
    payload: encrypted.toString('base64'),
  });

  return true;
};

const getSecureAuthSession = () => {
  const saved = store.get(AUTH_SESSION_KEY);
  if (!saved || typeof saved !== 'object') {
    return null;
  }

  try {
    if (!saved.encrypted || !saved.payload || !canEncryptAuthSession()) {
      return null;
    }

    const decrypted = safeStorage.decryptString(Buffer.from(saved.payload, 'base64'));
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('[Auth] Failed to decrypt secure auth session:', error);
    return null;
  }
};

const clearSecureAuthSession = () => {
  store.delete(AUTH_SESSION_KEY);
};

const migrateLegacyAuthSession = () => {
  const existingSession = getSecureAuthSession();
  if (existingSession) {
    if (store.has(LEGACY_AUTH_TOKEN_KEY)) store.delete(LEGACY_AUTH_TOKEN_KEY);
    if (store.has(LEGACY_USER_INFO_KEY)) store.delete(LEGACY_USER_INFO_KEY);
    return;
  }

  const legacyToken = store.get(LEGACY_AUTH_TOKEN_KEY);
  const legacyUser = store.get(LEGACY_USER_INFO_KEY);

  if (!legacyToken && !legacyUser) {
    return;
  }

  if (saveSecureAuthSession({
    token: legacyToken || null,
    user: legacyUser || null,
    migratedFromLegacyStore: true,
    savedAt: Date.now(),
  })) {
    store.delete(LEGACY_AUTH_TOKEN_KEY);
    store.delete(LEGACY_USER_INFO_KEY);
    console.log('[Auth] Migrated legacy auth data into secure session storage.');
  }
};

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
let cloudSyncService = null; // Declare cloudSyncService here

// Desktop Automation Services (Comet-AI Guide v2)
const { PermissionStore } = require('./src/lib/permission-store.js');
const { hasNativeDeviceUnlockSupport, verifyNativeDeviceAccess, verifyNativeCommandApproval } = require('./src/lib/native-os-verifier.js');
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
const { WebSearchProvider } = require('./src/lib/web-search-service.js');
const { MacNativePanelManager } = require('./src/lib/macos-native-panels.js');
const { PluginManager, pluginManager } = require('./src/lib/plugin-manager.js');
const {
  generateAppleIntelligenceImage,
  generateGenmoji,
  getAppleIntelligenceStatus,
  summarizeWithAppleIntelligence,
} = require('./src/lib/apple-intelligence.js');
const {
  CATALOG_TTL_MS,
  fetchProviderModelCatalog,
  getProviderApiKeyStoreKey,
  getProviderFallbackModel,
  getProviderLabel,
  getProviderModelStoreKey,
} = require('./src/lib/provider-model-discovery.js');
const webSearchProvider = new WebSearchProvider();

// Core modules - Architecture refactoring (extracted from main.js)
const { NetworkSecurityManager } = require('./src/core/network-security.js');
const { WindowManager, windowManager } = require('./src/core/window-manager.js');
const { CommandExecutor } = require('./src/core/command-executor.js');

// ✅ NEW: Relocate essential system IPC handlers to the top to prevent "no handler registered" errors
ipcMain.handle('get-app-version', () => {
  return app.getVersion() || '1.0.0';
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});

ipcMain.handle('apple-intelligence-status', async () => {
  return getAppleIntelligenceStatus();
});

ipcMain.handle('apple-intelligence-summary', async (event, text) => {
  return summarizeWithAppleIntelligence(text);
});

// --- CLI TOKEN PERSISTENCE ---
const nativeMacUiToken = randomBytes(24).toString('hex');
const tokenPath = path.join(os.homedir(), '.comet-ai-token');
try {
  fs.writeFileSync(tokenPath, nativeMacUiToken, { mode: 0o600 });
} catch (e) {
  console.error('[Main] Failed to write CLI token:', e.message);
}

ipcMain.handle('apple-intelligence-generate-image', async (event, { prompt, outputPath, style } = {}) => {
  return generateAppleIntelligenceImage(prompt, outputPath, style);
});

ipcMain.handle('apple-intelligence-genmoji', async (event, { prompt } = {}) => {
  return generateGenmoji(prompt);
});

// ============================================================================
// SIRI & SHORTCUTS INTEGRATION
// ============================================================================
const { setupSiriShortcutsHandlers, registerURLScheme, handleURLSchemeEvent, executeShortcutAction, speakWithSiri } = require('./src/lib/SiriShortcutsIntegration.js');
const { setupVoiceInputHandler, speakText: voiceSpeak, listenForVoiceInput: voiceListen, getVoiceList: voiceGetVoices, parseVoiceCommand: voiceParseCommand } = require('./src/lib/voice-input-handler.js');
const { executeAppleScriptCommand: runAppleScript, speakText: scriptSpeak, listenForSpeech: scriptListen, getAvailableVoices: scriptGetVoices } = require('./src/lib/apple-script-bridge.js');

const COMET_URL_SCHEME = 'comet-ai';

setupSiriShortcutsHandlers();
setupVoiceInputHandler();

registerURLScheme();
console.log('[Main] Registered comet-ai:// URL scheme for Shortcuts');

ipcMain.handle('siri:execute-action', async (event, action, params) => {
  return await executeShortcutAction(action, params);
});

ipcMain.handle('siri:speak', async (event, text) => {
  return await speakWithSiri(text);
});

ipcMain.handle('automation:enable-cli', async () => {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  const cliPath = path.join(__dirname, 'scripts', 'comet-cli.js');
  const destPath = '/usr/local/bin/comet';
  
  try {
    // Try to symlink. If it fails due to permissions, use osascript to ask for sudo
    if (process.platform === 'darwin') {
      const command = `ln -sf "${cliPath}" "${destPath}"`;
      try {
        await execAsync(command);
        return { success: true, message: 'CLI enabled successfully at /usr/local/bin/comet' };
      } catch (e) {
        // Prompt for sudo using osascript
        const sudoCommand = `osascript -e 'do shell script "ln -sf \\"${cliPath}\\" \\"${destPath}\\"" with administrator privileges'`;
        await execAsync(sudoCommand);
        return { success: true, message: 'CLI enabled with administrator privileges' };
      }
    } else if (process.platform === 'win32') {
      // Windows implementation (mklink)
      const winDest = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'comet.cmd');
      const winCmd = `@node "${cliPath}" %*`;
      fs.writeFileSync(winDest, winCmd); // Might still fail without admin
      return { success: true, message: 'CLI enabled for Windows' };
    }
    return { success: false, error: 'Platform not supported for auto-CLI' };
  } catch (error) {
    console.error('[CLI] Activation failed:', error);
    return { success: false, error: error.message };
  }
});

// --- BACKGROUND SERVICE MANAGEMENT ---
ipcMain.handle('automation:get-service-status', async () => {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    // 1. Check if process is running
    let isRunning = false;
    if (process.platform === 'darwin' || process.platform === 'linux') {
      try {
        const { stdout } = await execAsync('pgrep -f "comet-service"');
        isRunning = stdout.trim().length > 0;
      } catch (e) {
        isRunning = false;
      }
    } else if (process.platform === 'win32') {
      try {
        const { stdout } = await execAsync('tasklist /fi "IMAGENAME eq Comet-AI.exe" /fo CSV /v');
        isRunning = stdout.includes('Comet-AI-Service');
      } catch (e) {
        isRunning = false;
      }
    }
    
    // 2. Check health endpoint (if running)
    let health = null;
    if (isRunning) {
      try {
        const response = await fetch('http://localhost:3999/health', { timeout: 1000 });
        if (response.ok) {
          health = await response.json();
        }
      } catch (e) {
        // Service might be starting or on different port
      }
    }
    
    return {
      running: isRunning,
      health: health,
      platform: process.platform
    };
  } catch (error) {
    return { running: false, error: error.message };
  }
});

ipcMain.handle('automation:install-background-service', async (event, { userMode = false } = {}) => {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    if (process.platform === 'darwin') {
      const scriptPath = path.join(__dirname, 'scripts', 'install-service.sh');
      const modeFlag = userMode ? '--user' : '--system';
      const command = `bash "${scriptPath}" install ${modeFlag}`;
      
      try {
        await execAsync(command);
        return { success: true, message: 'Background service installed successfully' };
      } catch (e) {
        // Use osascript for sudo if system-wide
        if (!userMode) {
          const sudoCommand = `osascript -e 'do shell script "bash \\"${scriptPath}\\" install --system" with administrator privileges'`;
          await execAsync(sudoCommand);
          return { success: true, message: 'Background service installed with admin privileges' };
        }
        throw e;
      }
    } else if (process.platform === 'win32') {
      const scriptPath = path.join(__dirname, 'scripts', 'install-service.js');
      const modeFlag = userMode ? '--user' : '';
      const command = `node "${scriptPath}" install ${modeFlag}`;
      await execAsync(command);
      return { success: true, message: 'Background service installed for Windows' };
    }
    return { success: false, error: 'Platform not supported' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('automation:uninstall-background-service', async (event, { userMode = false } = {}) => {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    if (process.platform === 'darwin') {
      const scriptPath = path.join(__dirname, 'scripts', 'install-service.sh');
      const modeFlag = userMode ? '--user' : '--system';
      const command = `bash "${scriptPath}" uninstall ${modeFlag}`;
      
      try {
        await execAsync(command);
        return { success: true, message: 'Background service uninstalled' };
      } catch (e) {
        if (!userMode) {
          const sudoCommand = `osascript -e 'do shell script "bash \\"${scriptPath}\\" uninstall --system" with administrator privileges'`;
          await execAsync(sudoCommand);
          return { success: true, message: 'Background service uninstalled with admin privileges' };
        }
        throw e;
      }
    } else if (process.platform === 'win32') {
      const scriptPath = path.join(__dirname, 'scripts', 'install-service.js');
      const modeFlag = userMode ? '--user' : '';
      const command = `node "${scriptPath}" uninstall ${modeFlag}`;
      await execAsync(command);
      return { success: true, message: 'Background service uninstalled for Windows' };
    }
    return { success: false, error: 'Platform not supported' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('siri:listen', async (event, timeout = 10000) => {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  await execAsync('osascript -e \'tell application "System Events" to keystroke "d" using {command down}\'');
  return new Promise((resolve) => {
    let clipboard = '';
    const check = setInterval(async () => {
      try {
        clipboard = (await execAsync('pbpaste')).trim();
        if (clipboard.length > 0) {
          clearInterval(check);
          resolve(clipboard);
        }
      } catch {}
    }, 500);
    setTimeout(() => { clearInterval(check); resolve(clipboard); }, timeout);
  });
});

ipcMain.handle('siri:get-voices', async () => {
  return await scriptGetVoices();
});

ipcMain.handle('applescript:run', async (event, command, params) => {
  return await runAppleScript(command, params);
});

ipcMain.handle('siri:get-shortcuts-list', async () => {
  return [
    { id: 'chat', name: 'Chat with AI', description: 'Send message to Comet AI' },
    { id: 'smart-search', name: 'Smart Search', description: 'Search web with AI' },
    { id: 'create-pdf', name: 'Create PDF', description: 'Generate PDF document' },
    { id: 'voice-chat', name: 'Voice Chat', description: 'Dictate and send to AI' },
    { id: 'ask-and-speak', name: 'Ask + Speak', description: 'Ask AI and hear response' },
    { id: 'run-command', name: 'Run Command', description: 'Execute terminal command' },
    { id: 'schedule', name: 'Schedule Task', description: 'Schedule AI tasks' },
    { id: 'open-app', name: 'Open App', description: 'Launch applications' },
    { id: 'set-volume', name: 'Set Volume', description: 'Control system volume' },
    { id: 'screenshot', name: 'Take Screenshot', description: 'Capture screen' },
    { id: 'navigate', name: 'Navigate', description: 'Open websites' },
  ];
});

// ============================================================================
// WINDOWS INTEGRATION
// ============================================================================
const { setupWindowsIPCHandlers, registerWindowsProtocol, handleWindowsShortcutAction, handleURLSchemeEvent: handleWindowsURLScheme, startVoiceRecognition, speakText: winSpeak, getWindowsVoices, createWindowsShortcut, generateShortcutURL: generateWinURL } = require('./src/lib/windows-integration.js');

if (process.platform === 'win32') {
  setupWindowsIPCHandlers();
  registerWindowsProtocol();
  console.log('[Main] Registered Windows integration');
}

ipcMain.handle('windows:execute-action', async (event, action, params) => {
  if (process.platform !== 'win32') return { error: 'Not Windows' };
  return await handleWindowsShortcutAction(action, params);
});

ipcMain.handle('windows:voice:listen', async (event, params) => {
  if (process.platform !== 'win32') return { error: 'Not Windows' };
  return await startVoiceRecognition(params);
});

ipcMain.handle('windows:voice:speak', async (event, text, params) => {
  if (process.platform !== 'win32') return { error: 'Not Windows' };
  return await winSpeak(text, params);
});

ipcMain.handle('windows:voice:get-voices', async () => {
  if (process.platform !== 'win32') return ['Microsoft David', 'Microsoft Zira'];
  return await getWindowsVoices();
});

ipcMain.handle('windows:copilot:open', async () => {
  if (process.platform !== 'win32') return { error: 'Not Windows' };
  const { shell } = require('electron');
  try {
    await shell.openPath('com.microsoft.copilot:');
    return { success: true };
  } catch {
    await shell.openExternal('https://copilot.microsoft.com');
    return { success: true, message: 'Opened web Copilot' };
  }
});

ipcMain.handle('windows:create-shortcut', async (event, name, action, params) => {
  if (process.platform !== 'win32') return { error: 'Not Windows' };
  return await createWindowsShortcut(name, action, params);
});

ipcMain.handle('windows:generate-url', async (event, action, params) => {
  return generateWinURL(action, params);
});

ipcMain.handle('windows:register-protocol', async () => {
  if (process.platform !== 'win32') return { error: 'Not Windows' };
  return await registerWindowsProtocol();
});

// ============================================================================
// LINUX INTEGRATION
// ============================================================================
const { setupLinuxIPCHandlers, registerLinuxProtocol: registerLinuxProto, handleLinuxShortcutAction, handleLinuxURLScheme, generateShortcutURL: generateLinuxURL, createLinuxShortcut, installGNOMEShortcut, createDesktopLauncher, speakText: linuxSpeak, getLinuxVoices, startVoiceRecognition: linuxVoiceListen, showDesktopNotification, detectDesktop, getLinuxIntegration } = require('./src/lib/linux-integration.js');

if (process.platform === 'linux') {
  setupLinuxIPCHandlers();
  registerLinuxProto();
  console.log('[Main] Registered Linux integration');
}

ipcMain.handle('linux:execute-action', async (event, action, params) => {
  if (process.platform !== 'linux') return { error: 'Not Linux' };
  return await handleLinuxShortcutAction(action, params);
});

ipcMain.handle('linux:voice:listen', async (event, params) => {
  if (process.platform !== 'linux') return { error: 'Not Linux' };
  return await linuxVoiceListen(params);
});

ipcMain.handle('linux:voice:speak', async (event, text, params) => {
  if (process.platform !== 'linux') return { error: 'Not Linux' };
  return await linuxSpeak(text, params);
});

ipcMain.handle('linux:voice:get-voices', async () => {
  if (process.platform !== 'linux') return [];
  return await getLinuxVoices();
});

ipcMain.handle('linux:desktop:get', async () => {
  return await detectDesktop();
});

ipcMain.handle('linux:notify', async (event, title, body, options) => {
  if (process.platform !== 'linux') return { error: 'Not Linux' };
  return await showDesktopNotification(title, body, options);
});

ipcMain.handle('linux:create-shortcut', async (event, name, action, params) => {
  if (process.platform !== 'linux') return { error: 'Not Linux' };
  return await createLinuxShortcut(name, action, params);
});

ipcMain.handle('linux:install-gnome-shortcut', async (event, name, action, params) => {
  if (process.platform !== 'linux') return { error: 'Not Linux' };
  return await installGNOMEShortcut(name, action, params);
});

ipcMain.handle('linux:create-launcher', async () => {
  if (process.platform !== 'linux') return { error: 'Not Linux' };
  return await createDesktopLauncher();
});

ipcMain.handle('linux:generate-url', async (event, action, params) => {
  return generateLinuxURL(action, params);
});

ipcMain.handle('linux:register-protocol', async () => {
  if (process.platform !== 'linux') return { error: 'Not Linux' };
  return await registerLinuxProto();
});

ipcMain.handle('get-app-icon', async (event, appPath) => {
  try {
    const icon = await app.getFileIcon(appPath, { size: 'normal' });
    return icon.toDataURL();
  } catch (e) {
    return null;
  }
});


const permissionStore = new PermissionStore();
let cometAiEngine = null;
let robotService = null;
const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Initialize core modules - Architecture refactoring
const networkSecurityManager = new NetworkSecurityManager(store);
const commandExecutor = new CommandExecutor({
  permissionStore,
  store,
});

// Network Security - Now managed by NetworkSecurityManager (src/core/network-security.js)
// Keeping backwards compatibility aliases for existing code references
const networkSecurityConfig = networkSecurityManager.getConfig();

function matchesBlockedHost(hostname, patterns = []) {
  const host = `${hostname || ''}`.toLowerCase();
  return patterns.some((pattern) => host === pattern || host.endsWith(`.${pattern}`));
}

function getCustomBlockedDomains() {
  return networkSecurityManager.getConfig().customBlockedDomains
    .split(/[\n,\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

async function applyNetworkSecurityConfig(nextConfig = {}) {
  const config = networkSecurityManager.updateConfig(nextConfig);

  if (!app.isReady()) {
    return config;
  }

  const uniqueSessions = new Set([session.defaultSession]);
  for (const view of tabViews.values()) {
    if (view?.webContents?.session) {
      uniqueSessions.add(view.webContents.session);
    }
  }

  await Promise.all([...uniqueSessions].map((targetSession) =>
    networkSecurityManager.applyToSession(targetSession)
  ));
  return config;
}

function applyProxyConfigToSession(targetSession) {
  const config = networkSecurityManager.getConfig();
  if (config) {
    networkSecurityManager.applyToSession(targetSession);
  }
}

networkSecurityManager.applyStartupSettings(app);

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
const tabViews = new Map(); // Map of tabId -> BrowserView
const audibleTabs = new Set(); // Track tabs currently playing audio
const suspendedTabs = new Set(); // Track suspended tabs
let adBlocker = null;

const extensionsPath = path.join(app.getPath('userData'), 'extensions');
const memoryPath = path.join(app.getPath('userData'), 'ai_memory.jsonl');

const searchCache = new Map();
const shellApprovalResolvers = new Map();
const pendingPowerActions = new Map(); // Store power actions awaiting QR approval: token -> { action, resolver }

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
let nativeMacUiServer = null;
const MAC_NATIVE_UI_PREFS_KEY = 'mac_native_ui_preferences_v1';
const DEFAULT_MAC_NATIVE_UI_PREFERENCES = {
  sidebarMode: 'electron',
  actionChainMode: 'electron',
  utilityMode: 'electron',
  permissionMode: 'electron',
  sidebarAutoMinimize: false,
  sidebarGradientPreset: 'graphite',
  sidebarShowQuickActions: true,
  sidebarShowSessions: true,
  sidebarShowSearchTags: true,
  sidebarShowCommandCenterButton: true,
  sidebarShowActionChainButton: true,
};
// Token is declared above in the CLI PERSISTENCE section
const nativeMacUiPort = parseInt(process.env.COMET_NATIVE_MAC_UI_PORT || '46203', 10);
const nativeMacUiState = {
  mode: 'sidebar',
  updatedAt: Date.now(),
  inputDraft: '',
  isLoading: false,
  error: null,
  themeAppearance: 'dark',
  messages: [],
  actionChain: [],
  currentCommandIndex: 0,
  activityTags: [],
  conversations: [],
  activeConversationId: null,
  downloads: [],
  clipboardItems: [],
  pendingApproval: null,
};
const nativeMacPanelManager = new MacNativePanelManager({
  bridgeUrlProvider: () => `http://127.0.0.1:${nativeMacUiPort}`,
  tokenProvider: () => nativeMacUiToken,
  iconPathProvider: () => resolveCometIcon(),
  appName: app.name || 'Comet-AI',
});

// Detect python availability once (used to choose optional pipelines; never mandatory for .dmg)
const pythonAvailable = (() => {
  try {
    const res = spawnSync('python3', ['--version'], { encoding: 'utf8' });
    return res.status === 0;
  } catch {
    return false;
  }
})();

const getTopWindow = () => {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  for (const win of openWindows) {
    if (!win.isDestroyed()) return win;
  }
  return null;
};

const sendToActiveWindow = (channel, ...args) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
    return mainWindow;
  }
  for (const win of openWindows) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, ...args);
      return win;
    }
  }
  return null;
};

const deliverNativeMacUiEvent = async (channel, payload = {}) => {
  // Use main.js's window tracking directly
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
    return { delivered: true, createdWindow: false };
  }

  // Fallback - convert Set to array
  const wins = openWindows instanceof Set ? Array.from(openWindows) : openWindows;
  for (const win of wins) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
      return { delivered: true, createdWindow: false };
    }
  }

  console.log('[deliverNativeMacUiEvent] No window found, mainWindow:', mainWindow ? 'exists' : 'null', 'openWindows:', openWindows.size);
  return { delivered: false, error: 'No window available' };
};

const getMacNativeUiPreferences = () => {
  const saved = store.get(MAC_NATIVE_UI_PREFS_KEY);
  return {
    ...DEFAULT_MAC_NATIVE_UI_PREFERENCES,
    ...(saved && typeof saved === 'object' ? saved : {}),
  };
};

const broadcastMacNativeUiPreferences = () => {
  const preferences = getMacNativeUiPreferences();
  for (const win of openWindows) {
    if (!win.isDestroyed()) {
      win.webContents.send('mac-native-ui-preferences-changed', preferences);
    }
  }
};

const setMacNativeUiPreferences = (updates = {}) => {
  const nextPreferences = {
    ...getMacNativeUiPreferences(),
    ...(updates && typeof updates === 'object' ? updates : {}),
  };
  store.set(MAC_NATIVE_UI_PREFS_KEY, nextPreferences);

  if (isMac) {
    if (updates.sidebarMode) {
      if (nextPreferences.sidebarMode === 'swiftui') {
        nativeMacPanelManager.show('sidebar', { relaunchIfRunning: true }).catch((error) => {
          console.error('[MacNativeUI] Failed to open SwiftUI sidebar:', error);
        });
      } else {
        nativeMacPanelManager.close('sidebar');
      }
    }

    if (updates.actionChainMode) {
      if (nextPreferences.actionChainMode === 'electron') {
        nativeMacPanelManager.close('action-chain');
      }
    }

    if (updates.utilityMode && nextPreferences.utilityMode === 'electron') {
      ['menu', 'settings', 'downloads', 'clipboard'].forEach((mode) => nativeMacPanelManager.close(mode));
    }

    if (updates.permissionMode && nextPreferences.permissionMode === 'electron') {
      nativeMacPanelManager.close('permissions');
    }
  }

  broadcastMacNativeUiPreferences();
  buildApplicationMenu();
  return nextPreferences;
};

const createNativeMacUiSnapshot = () => {
  const recentMessages = Array.isArray(nativeMacUiState.messages) ? nativeMacUiState.messages : [];
  const lastMsg = recentMessages[recentMessages.length - 1];
  const actionLogs = lastMsg?.actionLogs || [];

  return {
    ...nativeMacUiState,
    themeAppearance: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
    messages: recentMessages,
    actionChain: Array.isArray(nativeMacUiState.actionChain) ? nativeMacUiState.actionChain : [],
    activityTags: Array.isArray(nativeMacUiState.activityTags) ? nativeMacUiState.activityTags : [],
    conversations: Array.isArray(nativeMacUiState.conversations) ? nativeMacUiState.conversations : [],
    downloads: Array.isArray(nativeMacUiState.downloads) ? nativeMacUiState.downloads : [],
    clipboardItems: Array.isArray(nativeMacUiState.clipboardItems) ? nativeMacUiState.clipboardItems : [],
    actionLogs: actionLogs.slice(-20),
    terminalLogs: actionLogs.map(l => ({ command: l.type, output: l.output, success: l.success })),
    preferences: getMacNativeUiPreferences(),
  };
};

const appendNativeMacUiMessage = (message = {}) => {
  const existing = Array.isArray(nativeMacUiState.messages) ? nativeMacUiState.messages : [];
  nativeMacUiState.messages = [
    ...existing,
    {
      id: message.id || `native-message-${Date.now()}`,
      role: message.role || 'model',
      content: `${message.content || ''}`.slice(0, 16000),
      timestamp: message.timestamp || Date.now(),
      thinkText: message.thinkText ? `${message.thinkText}`.slice(0, 8000) : null,
      isOcr: !!message.isOcr,
      ocrLabel: message.ocrLabel ? `${message.ocrLabel}`.slice(0, 120) : null,
      ocrText: message.ocrText ? `${message.ocrText}`.slice(0, 12000) : null,
      actionLogs: Array.isArray(message.actionLogs) ? message.actionLogs.slice(0, 24) : [],
      mediaItems: Array.isArray(message.mediaItems) ? message.mediaItems.slice(0, 12) : [],
    },
  ].slice(-24);
  nativeMacUiState.updatedAt = Date.now();
  nativeMacUiState.error = null;
};

const normalizeMacNativePanelMode = (mode = 'sidebar') => {
  const allowedModes = new Set(['sidebar', 'action-chain', 'menu', 'settings', 'downloads', 'clipboard', 'permissions']);
  return allowedModes.has(mode) ? mode : 'sidebar';
};

const normalizeSettingsSection = (section = 'profile') => {
  switch (`${section || 'profile'}`) {
    case 'openai':
    case 'anthropic':
    case 'gemini':
    case 'ollama':
    case 'api-keys':
      return 'api-keys';
    case 'layout':
    case 'appearance':
      return 'appearance';
    case 'performance':
      return 'performance';
    case 'automation':
      return 'automation';
    case 'privacy':
      return 'privacy';
    case 'permissions':
      return 'permissions';
    case 'sync':
    case 'mobile':
      return 'sync';
    case 'vault':
      return 'vault';
    case 'extensions':
      return 'extensions';
    case 'plugins':
      return 'plugins';
    case 'integrations':
      return 'integrations';
    case 'tabs':
      return 'tabs';
    case 'mcp':
      return 'mcp';
    case 'ambient-music':
      return 'ambient-music';
    case 'languages':
      return 'languages';
    case 'about':
      return 'about';
    case 'search':
    case 'shortcuts':
    case 'system':
    case 'admin':
    case 'updates':
    case 'history':
    case 'profile':
      return `${section}`;
    case 'downloads':
      return 'downloads';
    case 'clipboard':
      return 'clipboard';
    case 'all':
    default:
      return 'profile';
  }
};

// Quick helpers for native menu items
const openSettingsSection = (section, options = {}) => {
  const normalizedSection = normalizeSettingsSection(section);
  const preferElectron = options.preferElectron === true;

  if (isMac && !preferElectron) {
    const nativePrefs = getMacNativeUiPreferences();
    if (normalizedSection === 'permissions' && nativePrefs.permissionMode === 'swiftui') {
      nativeMacPanelManager.show('permissions', { relaunchIfRunning: true }).catch((error) => {
        console.error('[MacNativeUI] Failed to open native permissions panel:', error);
      });
      return;
    }

    const canUseNativeUtilityPanel = normalizedSection === 'profile' || normalizedSection === 'downloads' || normalizedSection === 'clipboard';
    if (nativePrefs.utilityMode === 'swiftui' && canUseNativeUtilityPanel) {
      const panelMode = normalizedSection === 'downloads'
        ? 'downloads'
        : normalizedSection === 'clipboard'
          ? 'clipboard'
          : 'settings';
      nativeMacPanelManager.show(panelMode, { relaunchIfRunning: true }).catch((error) => {
        console.error('[MacNativeUI] Failed to open native utility panel:', error);
      });
      return;
    }
  }

  const target = getTopWindow();
  if (target && !target.isDestroyed()) {
    if (!target.isVisible()) {
      target.show();
    }
    target.focus();
    target.webContents.send('set-settings-section', normalizedSection);
  } else {
    // If no window open, create one and then send
    createWindow().then(win => {
      win.webContents.once('did-finish-load', () => {
        win.webContents.send('set-settings-section', normalizedSection);
      });
    });
  }
};

const triggerShortcut = (action) => {
  // Get any available window
  let targetWindow = mainWindow;

  if (!targetWindow || targetWindow.isDestroyed()) {
    targetWindow = BrowserWindow.getAllWindows()[0];
  }

  if (targetWindow && !targetWindow.isDestroyed()) {
    targetWindow.webContents.send('execute-shortcut', action);
    return;
  }

  // Browser window doesn't exist - app not running or crashed
  console.log('[triggerShortcut] Browser not available for:', action, '- attempting recovery');

  // For critical menu items, try to restart the main window
  if (isQuitting || app.isReady()) {
    createMainWindow();
  }

  // Don't crash - just log
  console.log('[triggerShortcut] No window available for:', action);
};

const getShortcutMap = () => {
  const shortcuts = store.get('shortcuts') || [];
  return new Map(
    shortcuts
      .filter((shortcut) => shortcut && shortcut.action && typeof shortcut.accelerator === 'string')
      .map((shortcut) => [shortcut.action, shortcut.accelerator])
  );
};

const menuAccelerator = (action, fallback) => {
  const shortcut = getShortcutMap().get(action);
  return shortcut && shortcut.trim() ? shortcut : fallback;
};

const openGuide = () => {
  const candidates = [
    path.join(process.resourcesPath || __dirname, 'Guide.html'),
    path.join(app.getAppPath(), 'Guide.html'),
    path.join(__dirname, 'Guide.html'),
    path.join(__dirname, '..', 'Guide.html'),
  ];

  const localGuide = candidates.find((p) => fs.existsSync(p));
  if (localGuide) {
    sendToActiveWindow('add-new-tab', `file://${localGuide}`);
  } else {
    sendToActiveWindow('add-new-tab', 'https://www.comet.ai/guide');
  }
};

const openDocumentationPage = (slug = '') => {
  const baseUrl = 'https://browser.ponsrischool.in';
  const url = slug ? `${baseUrl}${slug}` : baseUrl;
  sendToActiveWindow('add-new-tab', url);
};

const registerWindow = (win) => {
  openWindows.add(win);
  mainWindow = win;
  windowManager.setMainWindow(win);
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

const toggleMacSidebarWindow = () => {
  if (!isMac) return;

  const nativePrefs = getMacNativeUiPreferences();
  if (nativePrefs.sidebarMode === 'swiftui') {
    nativeMacPanelManager.toggle('sidebar').catch((error) => {
      console.error('[MacNativeUI] Failed to toggle SwiftUI sidebar:', error);
    });
    return;
  }

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
    frame: true,
    transparent: true,
    vibrancy: 'ultra-dark',
    visualEffectState: 'active',
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    resizable: false,
    title: 'Comet AI Sidebar',
    titleBarStyle: 'hiddenInset',
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
  const nativePrefs = getMacNativeUiPreferences();
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Check for Updates...', click: () => openSettingsSection('updates') },
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
        { label: 'New Tab', accelerator: menuAccelerator('new-tab', 'CmdOrCtrl+T'), click: () => triggerShortcut('new-tab') },
        { label: 'New Incognito Tab', accelerator: menuAccelerator('new-incognito-tab', 'CmdOrCtrl+Shift+N'), click: () => triggerShortcut('new-incognito-tab') },
        { type: 'separator' },
        { label: 'Save Page As...', accelerator: 'CmdOrCtrl+S', click: () => sendToActiveWindow('save-page-offline') },
        { label: 'Print...', accelerator: 'CmdOrCtrl+P', click: () => sendToActiveWindow('print-page') },
        { type: 'separator' },
        { label: 'Close Tab', accelerator: menuAccelerator('close-tab', 'CmdOrCtrl+W'), click: () => triggerShortcut('close-tab') },
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
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Speech',
          submenu: [
            { role: 'startSpeaking' },
            { role: 'stopSpeaking' }
          ]
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => triggerShortcut('reload-tab') },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Actual Size', role: 'resetZoom' },
        { label: 'Zoom In', role: 'zoomIn' },
        { label: 'Zoom Out', role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Toggle Comet Sidebar', accelerator: menuAccelerator('toggle-sidebar', 'CmdOrCtrl+Shift+S'), click: () => triggerShortcut('toggle-sidebar') },
        {
          label: 'Cycle Theme',
          accelerator: menuAccelerator('cycle-theme', 'CmdOrCtrl+Shift+T'),
          click: () => triggerShortcut('cycle-theme')
        }
      ]
    },
    {
      label: 'History',
      submenu: [
        { label: 'Show Full History', accelerator: menuAccelerator('open-history', 'CmdOrCtrl+Y'), click: () => openSettingsSection('history', { preferElectron: true }) },
        { type: 'separator' },
        { label: 'Recently Closed', role: 'recentDocuments' },
        { type: 'separator' },
        { label: 'Delete All History', click: () => triggerShortcut('clear-history') }
      ]
    },
    {
      label: 'AI',
      submenu: [
        { label: 'AI Chat Sidebar', accelerator: menuAccelerator('open-ai-chat', 'CmdOrCtrl+Option+C'), click: () => triggerShortcut('open-ai-chat') },
        { label: 'Toggle AI Assistant', accelerator: menuAccelerator('toggle-ai-assist', 'CmdOrCtrl+Option+A'), click: () => triggerShortcut('toggle-ai-assist') },
        { label: 'Show AI Overview', accelerator: menuAccelerator('toggle-ai-overview', 'CmdOrCtrl+Option+O'), click: () => triggerShortcut('toggle-ai-overview') },
        ...(isMac ? [
          { type: 'separator' },
          { label: 'Apple Intelligence Panel', accelerator: 'Cmd+Option+1', click: () => triggerShortcut('open-apple-ai') }
        ] : []),
        { type: 'separator' },
        ...(isMac ? [
          {
            label: 'Use SwiftUI AI Sidebar',
            type: 'checkbox',
            checked: nativePrefs.sidebarMode === 'swiftui',
            click: (menuItem) => setMacNativeUiPreferences({ sidebarMode: menuItem.checked ? 'swiftui' : 'electron' }),
          },
          {
            label: 'Use SwiftUI Action Chain',
            type: 'checkbox',
            checked: nativePrefs.actionChainMode === 'swiftui',
            click: (menuItem) => setMacNativeUiPreferences({ actionChainMode: menuItem.checked ? 'swiftui' : 'electron' }),
          },
          {
            label: 'Use SwiftUI Utility Panels',
            type: 'checkbox',
            checked: nativePrefs.utilityMode === 'swiftui',
            click: (menuItem) => setMacNativeUiPreferences({ utilityMode: menuItem.checked ? 'swiftui' : 'electron' }),
          },
          {
            label: 'Use Native SwiftUI Approval Prompts',
            type: 'checkbox',
            checked: nativePrefs.permissionMode === 'swiftui',
            click: (menuItem) => setMacNativeUiPreferences({ permissionMode: menuItem.checked ? 'swiftui' : 'electron' }),
          },
          {
            label: 'Toggle Detached SwiftUI Sidebar',
            accelerator: 'CmdOrCtrl+Option+D',
            click: () => nativeMacPanelManager.toggle('sidebar').catch((error) => {
              console.error('[MacNativeUI] Failed to toggle SwiftUI sidebar from menu:', error);
            }),
          },
          {
            label: 'Open SwiftUI Action Chain',
            click: () => nativeMacPanelManager.show('action-chain').catch((error) => {
              console.error('[MacNativeUI] Failed to open SwiftUI Action Chain from menu:', error);
            }),
          },
          {
            label: 'Open SwiftUI Command Center',
            click: () => nativeMacPanelManager.show('menu').catch((error) => {
              console.error('[MacNativeUI] Failed to open SwiftUI command center from menu:', error);
            }),
          },
          { type: 'separator' },
        ] : []),
        { label: 'Spotlight Search', accelerator: menuAccelerator('toggle-spotlight', 'CmdOrCtrl+Shift+Space'), click: () => triggerShortcut('toggle-spotlight') },
        { label: 'Global Search', accelerator: menuAccelerator('spotlight-search', 'Alt+Space'), click: () => triggerShortcut('spotlight-search') },
        { label: 'Pop Search', accelerator: menuAccelerator('pop-search', 'CmdOrCtrl+Alt+S'), click: () => triggerShortcut('pop-search') },
        { label: 'Agent Task Input', accelerator: 'CmdOrCtrl+Option+Space', click: () => sendToActiveWindow('focus-ai-input') },
        { type: 'separator' },
        { label: 'Scheduling Center', click: () => openSettingsSection('automation', { preferElectron: true }) },
        { label: 'Model Intelligence', click: () => openSettingsSection('performance', { preferElectron: true }) },
        { label: 'Provider Settings', click: () => openSettingsSection('api-keys', { preferElectron: true }) }
      ]
    },
    {
      label: 'Panels',
      submenu: [
        { label: 'Workspace Dashboard', accelerator: menuAccelerator('open-workspace', 'CmdOrCtrl+Option+W'), click: () => triggerShortcut('open-workspace') },
        { label: 'Media Studio', accelerator: menuAccelerator('open-media-studio', 'CmdOrCtrl+Option+M'), click: () => triggerShortcut('open-media-studio') },
        { label: 'PDF Workspace', accelerator: menuAccelerator('open-pdf-workspace', 'CmdOrCtrl+Option+P'), click: () => triggerShortcut('open-pdf-workspace') },
        { label: 'Presenton', accelerator: menuAccelerator('open-presenton', 'CmdOrCtrl+Option+L'), click: () => triggerShortcut('open-presenton') },
        { type: 'separator' },
        { label: 'Downloads', accelerator: menuAccelerator('open-downloads', 'CmdOrCtrl+Shift+J'), click: () => triggerShortcut('open-downloads') },
        { label: 'Clipboard Manager', accelerator: menuAccelerator('open-clipboard', 'CmdOrCtrl+Option+V'), click: () => triggerShortcut('open-clipboard') },
        { label: 'Unified Cart', accelerator: menuAccelerator('open-cart', 'CmdOrCtrl+Option+U'), click: () => triggerShortcut('open-cart') },
        { label: 'Camera Studio', accelerator: menuAccelerator('open-camera', 'CmdOrCtrl+Option+I'), click: () => triggerShortcut('open-camera') },
        { type: 'separator' },
        { label: 'Password Manager', accelerator: menuAccelerator('open-password-manager', 'CmdOrCtrl+Option+K'), click: () => triggerShortcut('open-password-manager') },
        { label: 'Vault & Autofill', accelerator: menuAccelerator('open-bookmarks', 'CmdOrCtrl+Option+B'), click: () => triggerShortcut('open-bookmarks') },
        { label: 'Extensions Manager', accelerator: menuAccelerator('open-extensions', 'CmdOrCtrl+Option+E'), click: () => triggerShortcut('open-extensions') },
        { label: 'Web Store', click: () => triggerShortcut('open-webstore') },
        { type: 'separator' },
        { label: 'P2P File Sync', click: () => triggerShortcut('open-p2p-sync') },
        { label: 'Proxy Firewall', click: () => triggerShortcut('open-proxy-firewall') },
        { label: 'Coding Dashboard', click: () => triggerShortcut('open-coding-dashboard') }
      ]
    },
    {
      label: 'Settings',
      submenu: [
        { label: 'General Preferences', accelerator: menuAccelerator('open-settings', 'CmdOrCtrl+,'), click: () => openSettingsSection('profile') },
        { label: 'Appearance & Themes', click: () => openSettingsSection('appearance', { preferElectron: true }) },
        { label: 'Performance', click: () => openSettingsSection('performance', { preferElectron: true }) },
        { label: 'Search Engine', click: () => openSettingsSection('search', { preferElectron: true }) },
        { label: 'API Keys & Providers', click: () => openSettingsSection('api-keys', { preferElectron: true }) },
        { type: 'separator' },
        { label: 'Privacy & Security', click: () => openSettingsSection('privacy', { preferElectron: true }) },
        { label: 'macOS Permissions', click: () => openSettingsSection('permissions') },
        { label: 'Keyboard Shortcuts', click: () => openSettingsSection('shortcuts', { preferElectron: true }) },
        { label: 'History', click: () => openSettingsSection('history', { preferElectron: true }) },
        { type: 'separator' },
        { label: 'Automation', click: () => openSettingsSection('automation', { preferElectron: true }) },
        { label: 'Sync & Cloud', click: () => openSettingsSection('sync', { preferElectron: true }) },
        { label: 'Extensions', click: () => openSettingsSection('extensions', { preferElectron: true }) },
        { label: 'Plugins', click: () => openSettingsSection('plugins', { preferElectron: true }) },
        { label: 'MCP Servers', click: () => openSettingsSection('mcp', { preferElectron: true }) },
        { label: 'System Configuration', click: () => openSettingsSection('system', { preferElectron: true }) },
        { label: 'Advanced Logs', click: () => openSettingsSection('admin', { preferElectron: true }) },
        { type: 'separator' },
        { label: 'About Comet', click: () => openSettingsSection('about', { preferElectron: true }) },
        { label: 'Updates', click: () => openSettingsSection('updates', { preferElectron: true }) }
      ]
    },
    {
      label: 'Window',
      role: 'window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { label: 'Cycle Next Tab', accelerator: menuAccelerator('next-tab', 'CmdOrCtrl+]'), click: () => triggerShortcut('next-tab') },
        { label: 'Cycle Previous Tab', accelerator: menuAccelerator('prev-tab', 'CmdOrCtrl+['), click: () => triggerShortcut('prev-tab') },
        { type: 'separator' },
        { role: 'front' }
      ]
    },
    {
      label: 'Help',
      role: 'help',
      submenu: [
        { label: 'Documentation Home', accelerator: menuAccelerator('open-documentation', 'CmdOrCtrl+Shift+/'), click: () => openDocumentationPage() },
        { label: 'AI Commands', click: () => openDocumentationPage('/docs/ai-commands') },
        { label: 'Automation Guide', click: () => openDocumentationPage('/docs/automation') },
        { label: 'Native API Reference', click: () => openDocumentationPage('/docs/native-api') },
        { label: 'Plugins & SDK', click: () => openDocumentationPage('/docs/plugins') },
        { label: 'Component Docs', click: () => openDocumentationPage('/docs/components') },
        { type: 'separator' },
        { label: 'Interactive Guide', click: () => openGuide() },
        { label: 'Shortcut & Menu Guide', click: () => openSettingsSection('shortcuts', { preferElectron: true }) },
        { label: 'Welcome & Setup', click: () => openSettingsSection('about', { preferElectron: true }) },
        { type: 'separator' },
        { label: 'Report Issue...', click: () => sendToActiveWindow('add-new-tab', 'https://github.com/Preet3627/Comet-AI/issues') },
        { label: 'Check for Updates', click: () => openSettingsSection('updates', { preferElectron: true }) }
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
const iconMimeType = 'image/png';

// Environment-aware icon path resolver with multiple fallbacks
// Handles both dev (.js files next to assets/) and packaged (.app/Contents/Resources/)
const resolveCometIcon = () => {
  const iconName = 'icon.png';
  const isDev = !app.isPackaged;
  const resourcesPath = app.isPackaged
    ? (process.resourcesPath || path.join(app.getAppPath(), '..', '..', 'Resources'))
    : path.join(__dirname, 'assets');
  const appPath = app.getAppPath();

  const candidates = isDev ? [
    // Development paths (relative to main.js location)
    path.join(__dirname, 'assets', iconName),
    path.join(__dirname, iconName),
    path.join(appPath, 'assets', iconName),
    path.join(appPath, iconName),
    // Fallback to public folder
    path.join(appPath, 'public', iconName),
    path.join(process.cwd(), 'public', iconName),
  ] : [
    // Packaged paths (.app/Contents/Resources/)
    path.join(resourcesPath, 'app.asar.unpacked', 'assets', iconName),
    path.join(resourcesPath, 'app.asar.unpacked', iconName),
    path.join(resourcesPath, 'assets', iconName),
    path.join(resourcesPath, iconName),
    path.join(resourcesPath, 'app', 'assets', iconName),
    path.join(resourcesPath, 'app', iconName),
    path.join(resourcesPath, 'app.asar', 'assets', iconName),
    path.join(resourcesPath, 'app.asar', iconName),
    path.join(__dirname, 'assets', iconName), // Add this as fallback even in packaged mode
    path.join(__dirname, iconName),
  ];

  // Add extra emergency fallbacks
  const emergencyPaths = [
    path.join(os.homedir(), 'Documents', 'Comet-AI', 'icon.png'),
    path.join(os.homedir(), '.comet', 'icon.png'),
    '/Applications/Comet-AI.app/Contents/Resources/assets/icon.png',
  ];

  const allCandidates = [...candidates, ...emergencyPaths];

  for (const p of allCandidates) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        const stat = fs.statSync(p);
        if (stat.size > 100 && stat.size < 10 * 1024 * 1024) {
          return p;
        }
      }
    } catch {
      // continue to next
    }
  }
  return null;
};

const loadBrandIcon = () => {
  let iconBase64 = '';
  let iconMime = iconMimeType;
  try {
    const iconPath = resolveCometIcon();
    if (iconPath && fs.existsSync(iconPath)) {
      iconBase64 = fs.readFileSync(iconPath).toString('base64');
      iconMime = 'image/png';
    } else {
      console.warn('[BrandIcon] Could not find icon.png, trying bundled fallbacks...');
      // Try common paths directly as fallback
      const fallbacks = [
        path.join(__dirname, 'assets', 'icon.png'),
        path.join(app.getAppPath(), 'assets', 'icon.png'),
      ];
      for (const fb of fallbacks) {
        try {
          if (fs.existsSync(fb)) {
            iconBase64 = fs.readFileSync(fb).toString('base64');
            iconMime = 'image/png';
            break;
          }
        } catch { /* ignore */ }
      }
    }
  } catch (e) {
    console.error('[BrandIcon] Load failed', e);
  }
  return { iconBase64, iconMime };
};

const dataUrlToBuffer = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) return null;
  return { buffer: Buffer.from(match[2], 'base64'), mime: match[1] };
};

const normalizePages = (payload) => {
  if (payload?.pages && Array.isArray(payload.pages) && payload.pages.length) return payload.pages;
  if (payload?.content) {
    return [{
      title: payload.title || 'Document',
      sections: [{ title: payload.subtitle || 'Content', content: payload.content }]
    }];
  }
  return [{
    title: payload?.title || 'Document',
    sections: [{ title: 'Content', content: ' ' }]
  }];
};

// Basic text styling parser for bold/strike/italic; returns array of text runs (for pptx/docx)
const toStyledRuns = (text, opts = {}) => {
  if (!text || typeof text !== 'string') return [];
  if (text.trim() === '') return [];
  const runs = [];
  const regex = /(\*\*([^*]+)\*\*|~~([^~]+)~~|\*([^*]+)\*|__([^_]+)__)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) runs.push({ text: text.slice(lastIndex, match.index), ...opts });
    if (match[2]) runs.push({ text: match[2], bold: true, ...opts });
    else if (match[3]) runs.push({ text: match[3], strike: true, ...opts });
    else if (match[4]) runs.push({ text: match[4], italic: true, ...opts });
    else if (match[5]) runs.push({ text: match[5], bold: true, ...opts });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) runs.push({ text: text.slice(lastIndex), ...opts });
  return runs.length > 0 ? runs : [{ text, ...opts }];
};

const templatePalette = (name = 'professional') => {
  const map = {
    professional: { bg: '#0b1224', text: '#0f172a', accent: '#38bdf8' },
    dark: { bg: '#0d1117', text: '#e5e7eb', accent: '#22d3ee' },
    executive: { bg: '#f8fafc', text: '#0f172a', accent: '#1e3a8a' },
    minimalist: { bg: '#ffffff', text: '#111827', accent: '#0ea5e9' }
  };
  return map[name] || map.professional;
};
const PDF_TEMPLATES = {
  professional: (title, content, iconBase64, metadata = {}) => {
    const { author = '', category = '', tags = [], watermark = '', bgColor = '#ffffff' } = metadata;
    // Watermark CSS - using tfoot approach for repeating on each page
    const watermarkCSS = watermark ? `
      <style>
        .watermark-page { display: none; }
        @media print { 
          .watermark-page { display: block; position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 9999; }
          .watermark-text { position: absolute; top: 50%; left: 50%; width: 200%; height: 200%; text-align: center; vertical-align: middle; line-height: 200px; transform: translate(-50%, -50%) rotate(-35deg); font-size: 80px; color: rgba(0,0,0,0.035); font-weight: 900; white-space: nowrap; font-family: 'Outfit', sans-serif; }
        }
      </style>
      <div class="watermark-page"><div class="watermark-text">${watermark}</div></div>
    ` : '';
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&family=Inter:wght@400;500;700&family=JetBrains+Mono:wght@400;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; line-height: 1.8; color: #111827; background: #f8fafc; padding: 32px 42px; min-height: 100vh; overflow-x: hidden; }
    .cover { position: relative; background: linear-gradient(160deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%); color: #e5f3ff; padding: 60px 50px; box-shadow: 0 20px 60px rgba(0,0,0,0.35); overflow: hidden; min-height: 88vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-after: always; }
    .cover::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.25) 0%, transparent 60%); pointer-events: none; }
    .cover::after { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 80% 85%, rgba(129,140,248,0.15), transparent 40%); pointer-events: none; }
    .cover-center { display: flex; flex-direction: column; align-items: center; gap: 16px; z-index: 1; margin-bottom: 40px; }
    .brand-icon { margin-bottom: 8px; }
    .brand-name { font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 2.2rem; color: #ffffff; letter-spacing: -0.02em; }
    .brand-name span { color: #38bdf8; }
    .brand-tagline { font-size: 0.85rem; letter-spacing: 0.3em; text-transform: uppercase; color: #94a3b8; font-weight: 600; }
    .cover-title-section { z-index: 1; margin-bottom: 40px; }
    h1 { font-family: 'Outfit', sans-serif; color: #ffffff; font-size: 2.6rem; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; margin: 0 0 12px; word-wrap: break-word; }
    .subtitle { color: #94a3b8; font-size: 1.1rem; font-weight: 500; }
    .cover-meta { display: flex; gap: 30px; justify-content: center; z-index: 1; flex-wrap: wrap; }
    .meta-pill { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; padding: 12px 20px; color: #e0f2fe; font-size: 0.85rem; display: flex; flex-direction: column; gap: 4px; align-items: center; }
    .meta-label { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.18em; color: #38bdf8; font-weight: 700; }
    .page-content { background: #ffffff; padding: 30px 32px; margin-top: 0; position: relative; z-index: 1; }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; justify-content: center; }
    .tag { background: rgba(56, 189, 248, 0.14); color: #0ea5e9; padding: 5px 12px; border-radius: 18px; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
    .content { font-size: 1rem; line-height: 1.82; width: 100%; color: #111827; }
    .content h2 { margin: 32px 0 18px; color: #0f172a; font-family: 'Outfit', sans-serif; font-size: 1.55rem; font-weight: 800; border-left: 6px solid #38bdf8; padding-left: 14px; word-wrap: break-word; }
    .content h3 { margin: 26px 0 14px; color: #1f2937; font-family: 'Outfit', sans-serif; font-size: 1.18rem; font-weight: 700; }
    .content p { margin-bottom: 22px; text-align: left; word-wrap: break-word; font-size: 1.05rem; }
    .content ul, .content ol { margin: 12px 0 22px 28px; }
    .content li { margin-bottom: 12px; }
    .table-wrapper { width: 100%; overflow: hidden; margin: 26px 0; border-radius: 14px; box-shadow: 0 6px 22px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; }
    table { width: 100%; border-collapse: collapse; background: white; table-layout: auto; }
    thead { display: table-header-group; background: #0f172a; }
    tbody { display: table-row-group; }
    tr { display: table-row; }
    th { color: white; padding: 18px 20px; text-align: left; font-weight: 700; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #334155; }
    td { padding: 16px 20px; border-bottom: 1px solid #e5e7eb; font-size: 0.95rem; word-break: break-word; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #fcfdfe; }
    hr { border: none; height: 3px; background: linear-gradient(to right, #38bdf8, transparent); margin: 40px 0; border-radius: 4px; }
    pre { background: #0f172a; color: #e2e8f0; padding: 24px; border-radius: 14px; font-family: 'JetBrains Mono', monospace; overflow-x: auto; margin: 24px 0; font-size: 0.95rem; line-height: 1.7; border: 1px solid #1e293b; word-wrap: break-word; white-space: pre-wrap; page-break-inside: avoid; }
    code { background: #f1f5f9; padding: 2px 8px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 0.88em; color: #0ea5e9; word-break: break-all; }
    pre code { background: none; padding: 0; color: inherit; }
    blockquote { border-left: 8px solid #38bdf8; padding: 22px 28px; background: linear-gradient(135deg, #f0f9ff 0%, #e1effe 100%); border-radius: 0 16px 16px 0; color: #1e293b; margin: 26px 0; font-style: italic; font-size: 1.05rem; }
    figure, img { max-width: 100%; border-radius: 16px; margin: 26px 0; box-shadow: 0 12px 36px rgba(0,0,0,0.15); page-break-inside: avoid; display: block; margin-left: auto; margin-right: auto; }
    .footer { margin-top: 46px; padding-top: 22px; border-top: 2px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .footer-left { font-size: 0.78rem; color: #6b7280; }
    .footer-center { text-align: center; }
    .footer-right { text-align: right; font-size: 0.82rem; color: #0ea5e9; font-weight: 700; }
    @page { margin: 14mm 14mm 16mm 14mm; size: A4; }
    @page first { margin: 0 0 0 0; }
    .cover { page-break-after: always; page-rule-first: always; }
  </style>
</head>
<body>
  ${watermarkCSS}
  <section class="cover">
    <div class="cover-center">
      <div class="brand-icon">
        ${iconBase64 ? `<img src="data:${iconMimeType};base64,${iconBase64}" alt="Comet" style="width:100px;height:100px;object-fit:contain;border-radius:20px;box-shadow:0 12px 40px rgba(56,189,248,0.4);"/>` : '<span style="font-size:4rem">🌠</span>'}
      </div>
      <div class="brand-name">Comet<span>AI</span></div>
      <div class="brand-tagline">Premium AI Browser</div>
    </div>
    <div class="cover-title-section">
      <h1>${title || 'Research Document'}</h1>
      <p class="subtitle">${category || 'Intelligence Report'}</p>
    </div>
    <div class="cover-meta">
      <div class="meta-pill"><span class="meta-label">Generated</span><span>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
      <div class="meta-pill"><span class="meta-label">Document ID</span><span>CMT-${Math.random().toString(36).slice(2, 8).toUpperCase()}</span></div>
    </div>
  </section>

  <div class="page-content" style="page-break-before: always;">
    ${tags && tags.length ? `<div class="tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
    <div class="content">${content}</div>
  </div>
  
  <div class="footer">
    <div class="footer-left">&copy; ${new Date().getFullYear()} Comet AI Browser</div>
    <div class="footer-center">${iconBase64 ? `<img src="data:${iconMimeType};base64,${iconBase64}" alt="" style="width:24px;height:24px;object-fit:contain;border-radius:4px;"/>` : '🌠'}</div>
    <div class="footer-right">AI Generated</div>
  </div>
</body>
</html>`;
  },

  executive: (title, content, iconBase64, metadata = {}) => {
    const { author = '', department = '', priority = 'normal', watermark = '' } = metadata;
    const priorityColors = { high: '#ef4444', medium: '#f59e0b', normal: '#22c55e' };
    const priorityColor = priorityColors[priority] || priorityColors.normal;
    // Watermark CSS - using tfoot approach for repeating on each page
    const watermarkCSS = watermark ? `
      <style>
        @media print { 
          .watermark-page { display: block; position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 9999; }
          .watermark-text { position: absolute; top: 50%; left: 50%; width: 200%; height: 200%; text-align: center; vertical-align: middle; line-height: 200px; transform: translate(-50%, -50%) rotate(-45deg); font-size: 70px; color: rgba(0,0,0,0.02); font-weight: 900; white-space: nowrap; font-family: 'Playfair Display', serif; }
        }
      </style>
      <div class="watermark-page" style="display:none;"><div class="watermark-text">${watermark}</div></div>
    ` : '';
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; line-height: 1.7; color: #1a1a2e; background: #ffffff; padding: 50px 60px; }
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
    .content p { margin-bottom: 22px; word-wrap: break-word; font-size: 1.05rem; }
    .table-wrapper { width: 100%; overflow: hidden; margin: 30px 0; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    table { width: 100%; border-collapse: collapse; background: white; table-layout: auto; }
    thead { display: table-header-group; background: #4f46e5; }
    th { color: white; padding: 16px 20px; text-align: left; font-weight: 600; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 14px 20px; border-bottom: 1px solid #e5e7eb; font-size: 0.95rem; word-break: break-word; }
    tr:nth-child(even) td { background: #fcfdfe; }
    blockquote { border-left: 6px solid #4f46e5; padding: 22px 28px; background: #f9fafb; margin: 26px 0; font-style: italic; border-radius: 0 12px 12px 0; }
    .footer { margin-top: 60px; padding-top: 25px; border-top: 2px solid #1a1a2e; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; }
    .footer-text { font-size: 0.75rem; color: #6b7280; }
    .confidential { font-size: 0.8rem; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.1em; }
    @page { margin: 12mm; size: A4; }
  </style>
</head>
<body>
  ${watermark ? `<div class="watermark-container"><div class="watermark">${watermark}</div></div>` : ''}
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
    /* Watermark that works with Electron printToPDF */
    .watermark-container { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; overflow: hidden; z-index: 9999; }
    .watermark { position: absolute; top: 50%; left: 50%; width: 200%; height: 200%; text-align: center; vertical-align: middle; line-height: 200px; transform: translate(-50%, -50%) rotate(-45deg); font-size: 60px; color: rgba(0,0,0,0.015); font-weight: 900; white-space: nowrap; font-family: 'Merriweather', serif; pointer-events: none; }
    @media print { .watermark-container { position: fixed; } }
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
    .content p { margin-bottom: 22px; word-wrap: break-word; font-size: 1.05rem; }
    .content ol, .content ul { margin: 15px 0 22px 32px; }
    .content li { margin-bottom: 10px; }
    .table-wrapper { width: 100%; overflow: hidden; margin: 25px 0; border: 1.5px solid #333; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; }
    thead { display: table-header-group; background: #333; }
    th { color: white; padding: 14px 18px; text-align: left; font-weight: 600; font-size: 0.85rem; border: 1px solid #333; }
    td { padding: 12px 18px; border: 1px solid #ddd; font-size: 0.92rem; word-break: break-word; }
    tr:nth-child(even) td { background: #fcfcfc; }
    .references { margin-top: 50px; padding-top: 25px; border-top: 2px solid #333; }
    .references h2 { border: none; margin-bottom: 25px; }
    .ref-item { margin-bottom: 12px; font-size: 0.9rem; text-indent: -30px; padding-left: 30px; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 0.8rem; color: #666; }
    @page { margin: 15mm; size: A4; }
  </style>
</head>
<body>
  ${watermark ? `<div class="watermark-container"><div class="watermark">${watermark}</div></div>` : ''}
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
    /* Watermark that works with Electron printToPDF */
    .watermark-container { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; overflow: hidden; z-index: 9999; }
    .watermark { position: absolute; top: 50%; left: 50%; width: 200%; height: 200%; text-align: center; vertical-align: middle; line-height: 200px; transform: translate(-50%, -50%) rotate(-45deg); font-size: 70px; color: rgba(0,0,0,0.01); font-weight: 700; white-space: nowrap; font-family: 'Space Grotesk', sans-serif; pointer-events: none; }
    @media print { .watermark-container { position: fixed; } }
    .header { margin-bottom: 50px; }
    .brand { margin-bottom: 30px; opacity: 0.3; }
    h1 { font-size: 2.5rem; font-weight: 700; line-height: 1.1; margin-bottom: 15px; letter-spacing: -0.03em; word-wrap: break-word; }
    .meta { font-size: 0.85rem; opacity: 0.6; }
    .content { font-size: 1rem; width: 100%; }
    .content h2 { font-size: 1.4rem; font-weight: 700; margin: 40px 0 20px; }
    .content h3 { font-size: 1.2rem; font-weight: 700; margin: 30px 0 15px; }
    .content p { margin-bottom: 22px; word-wrap: break-word; font-size: 1.05rem; }
    .content ul, .content ol { margin: 15px 0 22px 28px; }
    .content li { margin-bottom: 12px; }
    .table-wrapper { width: 100%; overflow: hidden; margin: 25px 0; border: 1px solid #eee; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; }
    thead { display: table-header-group; background: #111; }
    th { color: white; padding: 14px 18px; text-align: left; font-weight: 600; font-size: 0.85rem; }
    td { padding: 12px 18px; border-bottom: 1px solid #eee; font-size: 0.92rem; }
    blockquote { border-left: 3px solid #111; padding-left: 20px; margin: 25px 0; font-style: italic; opacity: 0.8; }
    .footer { margin-top: 60px; padding-top: 25px; border-top: 1px solid #eee; font-size: 0.75rem; opacity: 0.5; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
    @page { margin: 15mm; size: A4; }
  </style>
</head>
<body>
  ${watermark ? `<div class="watermark-container"><div class="watermark">${watermark}</div></div>` : ''}
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
    /* Watermark that works with Electron printToPDF - uses opacity for dark mode */
    .watermark-container { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; overflow: hidden; z-index: 9999; }
    .watermark { position: absolute; top: 50%; left: 50%; width: 200%; height: 200%; text-align: center; vertical-align: middle; line-height: 200px; transform: translate(-50%, -50%) rotate(-45deg); font-size: 80px; color: rgba(255,255,255,0.015); font-weight: 700; white-space: nowrap; font-family: 'Oxanium', sans-serif; pointer-events: none; }
    @media print { .watermark-container { position: fixed; } }
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
    .content p { margin-bottom: 24px; word-wrap: break-word; font-size: 1.05rem; }
    .content ul, .content ol { margin: 15px 0 24px 28px; }
    .content li { margin-bottom: 14px; }
    .table-wrapper { width: 100%; overflow: hidden; margin: 30px 0; border-radius: 12px; border: 1px solid #333; background: #161616; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; }
    thead { display: table-header-group; background: #22d3ee; }
    th { color: #000; padding: 16px 20px; text-align: left; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.1em; }
    td { padding: 14px 20px; border-bottom: 1px solid #333; font-size: 0.95rem; word-break: break-word; }
    tr:nth-child(even) td { background: #1e1e1e; }
    blockquote { border-left: 4px solid #22d3ee; padding: 18px 25px; background: #1a1a1a; margin: 25px 0; color: #22d3ee; }
    .accent { background: linear-gradient(135deg, #22d3ee20 0%, #6366f120 100%); padding: 20px; border-radius: 12px; border: 1px solid #22d3ee30; margin: 25px 0; }
    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #333; display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #666; flex-wrap: wrap; gap: 15px; }
    .cyber-badge { color: #22d3ee; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
    @page { margin: 15mm; size: A4; }
  </style>
</head>
<body>
  ${watermark ? `<div class="watermark-container"><div class="watermark">${watermark}</div></div>` : ''}
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

// Dedicated context menu handler for BrowserViews and Main Window
const setupContextMenu = () => {
  contextMenu({
    showSaveImageAs: true,
    showDragLink: true,
    showInspectElement: true,
    showLookUpSelection: true,
    showSearchWithGoogle: true,
    showCopyImageAddress: true,
    prepend: (defaultActions, params, browserWindow) => [
      {
        label: '🚀 Analyze selection with Comet AI',
        visible: params.selectionText.trim().length > 0,
        click: () => {
          if (mainWindow) mainWindow.webContents.send('ai-query-detected', params.selectionText);
        }
      },
      {
        label: '📄 Summarize Page',
        visible: params.selectionText.trim().length === 0 && !params.linkURL && !params.mediaType,
        click: () => {
          if (mainWindow) mainWindow.webContents.send('ai-query-detected', 'Summarize this page');
        }
      },
      {
        label: '🍎 Apple Intelligence: Summarize Page',
        visible: isMac && params.selectionText.trim().length === 0 && !params.linkURL && !params.mediaType,
        click: async () => {
          if (mainWindow) {
            mainWindow.webContents.send('ai-query-detected', 'Summarize this page using Apple Intelligence');
          }
        }
      },
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
      },
      {
        label: '🔍 Search in Popup',
        visible: params.selectionText.trim().length > 0,
        click: () => {
          if (popSearchService) popSearchService.showPopupWithText(params.selectionText);
        }
      },
      {
        label: '🍏 Apple Intelligence: Summarize Selection',
        visible: isMac && params.selectionText.trim().length > 0,
        click: async () => {
          if (mainWindow) {
            mainWindow.webContents.send('ai-query-detected', `Summarize this using Apple Intelligence: ${params.selectionText}`);
          }
        }
      },
      {
        label: '🌐 Translate this Site',
        visible: params.selectionText.trim().length === 0 && !params.linkURL && !params.mediaType,
        click: () => {
          if (mainWindow) mainWindow.webContents.send('trigger-translation-dialog');
        }
      }
    ]
  });
};

setupContextMenu();

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
const RAYCAST_PROTOCOL = 'comet-ai';

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    app.setAsDefaultProtocolClient(RAYCAST_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
  app.setAsDefaultProtocolClient(RAYCAST_PROTOCOL);
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

  console.log('[Main] open-url received:', url);

  // Handle Raycast commands
  const parsed = new URL(url);
  const pathname = parsed.pathname.replace(/^\/+/, '');
  const params = Object.fromEntries(parsed.searchParams);

  // Comet Browser protocol
  if (url.startsWith(`${PROTOCOL}://`)) {
    target.webContents.send('auth-callback', url);
  }
  // HTTP/HTTPS URLs
  else if (url.startsWith('http://') || url.startsWith('https://')) {
    target.webContents.send('add-new-tab', url);
  }
  // Raycast commands via comet-ai:// scheme (registered separately)
  else if (url.startsWith('comet-ai://') || url.startsWith('comet://')) {
    const command = parsed.hostname || pathname || params.command || 'index';
    console.log('[Main] URL scheme command:', command, params);

    // Map commands to IPC events
    const commandMap = {
      'chat': 'open-ai-chat',
      'search': 'ai:search',
      'navigate': 'navigate-to-url',
      'create-pdf': 'ai:create-pdf',
      'create-doc': 'ai:create-pdf',
      'run-command': 'shell:execute',
      'open-app': 'system:open-app',
      'screenshot': 'system:screenshot',
      'volume': 'system:set-volume',
      'schedule': 'ai:schedule',
      'ask-ai': 'ai:ask-speaking',
      'voice-chat': 'ai:voice-chat',
      'set-model': 'ai:set-model',
      'browse': 'open-quick-browse',
      'ocr': 'trigger-screen-ocr',
      'pdf': 'open-pdf-creator',
      'automation': 'open-automation-panel',
      'settings': 'open-settings',
      'index': 'open-main',
    };

    // Handle Siri/Shortcuts actions with dedicated handlers
    const siriActions = ['chat', 'search', 'navigate', 'create-pdf', 'create-doc', 'run-command', 'open-app', 'screenshot', 'volume', 'schedule', 'ask-ai', 'voice-chat', 'set-model'];
    if (siriActions.includes(command)) {
      executeShortcutAction(command, params).catch(err => console.error('[Main] Siri action error:', err));
      if (params.speak === 'true') {
        target.webContents.once('did-finish-load', () => {
          target.webContents.send('ai:request-speak-response', params);
        });
      }
    }

    const ipcCommand = commandMap[command] || command;
    target.webContents.send(ipcCommand, params);
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

    const modelName = options.model || config.model || store.get('gemini_model') || getConfiguredProviderModel(providerId);

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
    modelInstance = openai(options.model || config.model || store.get('openai_model') || getConfiguredProviderModel('openai'));
  }
  else if (providerId === 'azure-openai') {
    const { createOpenAI } = await import('@ai-sdk/openai');
    const apiKey = config.apiKey || store.get('azure_openai_api_key');
    const baseURL = options.baseUrl || config.baseUrl || store.get('azure_openai_endpoint');
    if (!apiKey) throw new Error('Azure OpenAI API Key is missing.');
    if (!baseURL) throw new Error('Azure OpenAI base URL is missing.');
    const azureOpenAI = createOpenAI({ apiKey, baseURL });
    modelInstance = azureOpenAI(options.model || config.model || store.get('azure_openai_model') || 'gpt-4.1-mini');
  }
  else if (providerId === 'anthropic') {
    const { createAnthropic } = await import('@ai-sdk/anthropic');
    const apiKey = config.apiKey || store.get('anthropic_api_key');
    if (!apiKey) throw new Error('Anthropic API Key is missing.');
    const anthropic = createAnthropic({ apiKey });
    modelInstance = anthropic(options.model || config.model || store.get('anthropic_model') || getConfiguredProviderModel('anthropic'));
  }
  else if (providerId === 'xai') {
    const { createXai } = await import('@ai-sdk/xai');
    const apiKey = config.apiKey || store.get('xai_api_key');
    if (!apiKey) throw new Error('xAI API Key is missing.');
    const xai = createXai({ apiKey });
    modelInstance = xai(options.model || config.model || store.get('xai_model') || getConfiguredProviderModel('xai'));
  }
  else if (providerId === 'groq') {
    const { createGroq } = await import('@ai-sdk/groq');
    const apiKey = config.apiKey || store.get('groq_api_key');
    if (!apiKey) throw new Error('Groq API Key is missing.');
    const groq = createGroq({ apiKey });
    modelInstance = groq(options.model || config.model || store.get('groq_model') || getConfiguredProviderModel('groq'));
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
          case 'google-flash': model = getConfiguredProviderModel(providerId === 'gemini' ? 'google' : providerId); break;
          case 'openai': model = getConfiguredProviderModel('openai'); break;
          case 'azure-openai': model = store.get('azure_openai_model') || 'gpt-4.1-mini'; break;
          case 'anthropic': model = getConfiguredProviderModel('anthropic'); break;
          case 'groq': model = getConfiguredProviderModel('groq'); break;
          case 'xai': model = getConfiguredProviderModel('xai'); break;
          default: model = getConfiguredProviderModel('google'); // safe default
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
      if (providerId === 'azure-openai') {
        engineKeys.AZURE_OPENAI_API_KEY = store.get('azure_openai_api_key') || '';
        engineKeys.AZURE_OPENAI_BASE_URL = options.baseUrl || store.get('azure_openai_endpoint') || '';
      }
      if (providerId === 'anthropic') engineKeys.ANTHROPIC_API_KEY = store.get('anthropic_api_key') || '';
      if (providerId === 'groq') engineKeys.GROQ_API_KEY = store.get('groq_api_key') || '';
      if (providerId === 'xai') engineKeys.XAI_API_KEY = store.get('xai_api_key') || '';
      if (providerId === 'ollama') engineKeys.OLLAMA_BASE_URL = options.baseUrl || store.get('ollama_base_url') || 'http://127.0.0.1:11434';
      if (Object.keys(engineKeys).length > 0) cometAiEngine.configure(engineKeys);

      const chatResult = await cometAiEngine.chat({
        message, model, systemPrompt, history, provider: providerId,
        onChunk: (chunk) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send('llm-chat-stream-part', { type: 'text-delta', textDelta: chunk });
          }
        }
      });

      if (!event.sender.isDestroyed()) {
        const finishReason = chatResult?.finishReason || 'stop';
        event.sender.send('llm-chat-stream-part', { type: 'finish', finishReason });
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

    let lastFinishReason = 'stop';
    for await (const part of result.fullStream) {
      if (event.sender.isDestroyed()) break;
      if (part.type === 'finish') {
        lastFinishReason = part.finishReason || 'stop';
      }
      event.sender.send('llm-chat-stream-part', part);
    }
    
    if (!event.sender.isDestroyed()) {
      event.sender.send('llm-chat-stream-part', { type: 'finish', finishReason: lastFinishReason });
    }
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
  const view = tabViews.get(tabId);
  if (!view) return { error: 'No active view for extraction' };

  try {
    const results = await view.webContents.executeJavaScript(`
      (() => {
        const organicResults = Array.from(document.querySelectorAll('div.g, li.g, div.rc')); // Common Google search result selectors
        const extracted = [];
        for (let i = 0; i < Math.min(3, organicResults.length); i++) {
          const result = organicResults[i];
          const titleElement = result.querySelector('h3');
          const linkElement = result.querySelector('a');
          const snippetElement = result.querySelector('span.st, div.s > div > span'); // Common snippet selectors

          if (titleElement && linkElement) {
            extracted.push({
              title: titleElement.innerText,
              url: linkElement.href,
              snippet: snippetElement ? snippetElement.innerText : ''
            });
          }
        }
        return extracted;
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
  
  // GPU offload and acceleration enhancements
  app.commandLine.appendSwitch('--enable-accelerated-2d-canvas');
  app.commandLine.appendSwitch('--enable-accelerated-video-decode');
  app.commandLine.appendSwitch('--enable-gpu-scheduling');
  app.commandLine.appendSwitch('--enable-video-codecs', 'video/webm;video/mp4;video/avc;video/hevc;video/vp9');
  app.commandLine.appendSwitch('--enable-vp9-temporal-layers');
  app.commandLine.appendSwitch('--use-gl', process.platform === 'darwin' ? 'metal' : 'egl');
  app.commandLine.appendSwitch('--enable-features', 'UseSkiaRenderer,VaapiVideoDecoder,UseMultiPlaneFormatForAndroid');
  
  // Memory management and optimization
  app.commandLine.appendSwitch('--js-flags', '--max-old-space-size=4096');
  app.commandLine.appendSwitch('--disable-background-networking');
  app.commandLine.appendSwitch('--disable-default-apps');
  app.commandLine.appendSwitch('--disable-extensions');
  app.commandLine.appendSwitch('--disable-sync');
  app.commandLine.appendSwitch('--disable-translate');
  app.commandLine.appendSwitch('--metrics-recording-only');
  app.commandLine.appendSwitch('--no-first-run');
  app.commandLine.appendSwitch('--safebrowsing-disable-auto-update');
  app.commandLine.appendSwitch('--memory-pressure-off');
  app.commandLine.appendSwitch('--enable-features', 'IncognitoPasswordSuggestions,OfflinePagesPrefetching');
  app.commandLine.appendSwitch('--disable-features', 'ClangCoverage,OppiaEngagement,Survey,NativeNotifications');
  
  // Optimize renderer process
  app.commandLine.appendSwitch('--renderer-process-limit', '8');
  app.commandLine.appendSwitch('--disable-low-res-tiling');
  app.commandLine.appendSwitch('--log-missing-plugins');
  app.commandLine.appendSwitch('--disable-plugin-power-saver');
  
  // Aggressive garbage collection
  app.commandLine.appendSwitch('--js-flags', '--expose-gc,--max-old-space-size=4096,--optimize-for-size,--memory-reducer,--gc-interval=100');

  if (isDev) {
    // Clear cache and service workers in development to avoid 404s on stale chunks
    session.defaultSession.clearStorageData({
      storages: ['serviceworkers', 'cachestorage']
    }).then(() => {
      console.log('[Main] Dev storage (Service Workers & Cache) cleared');
    });
  }

// Disable state restoration (if supported)
if (app.setShouldRestoreStateOnLaunch) {
  app.setShouldRestoreStateOnLaunch(false);
}

const isMacPlatform = process.platform === 'darwin';

// ULTRA AGGRESSIVE FIX: Force new window to show without waiting
const forceShowWindow = (window) => {
  if (window) {
    window.show();
    window.focus();
    // Additional force-show attempts
    setTimeout(() => { window.show(); window.focus(); }, 100);
    setTimeout(() => { window.show(); window.focus(); }, 500);
    setTimeout(() => { window.show(); window.focus(); }, 1000);
    setTimeout(() => { window.show(); window.focus(); }, 2000);
  }
};

mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, 'out', 'icon.ico'),
    frame: isMacPlatform,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      offscreen: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      enableRemoteModule: false,
      contextIsolation: true,
      additionalArguments: ['--enable-features=VizDisplayCompositor']
    },
    titleBarStyle: isMacPlatform ? 'hiddenInset' : 'hidden',
    backgroundColor: '#0D0E1C',
    show: true,
    paintWhenInitiallyHidden: true
  });

  console.log('[Main] Window created with show=true');

  // ULTRA AGGRESSIVE: Force show window repeatedly
  forceShowWindow(mainWindow);

  registerWindow(mainWindow);

  // Fullscreen event listeners - notify renderer to recalculate BrowserView bounds
  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send('window-fullscreen-changed', true);
  });
  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('window-fullscreen-changed', false);
  });

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

  // CRASH RECOVERY: Detect if renderer process crashes or gets stuck
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[Main] Renderer process crashed:', details.reason);
    if (details.reason !== 'clean-exit') {
      console.log('[Main] Attempting to recover window...');
      // Force show the window anyway - at least user can see error
      mainWindow.show();
      mainWindow.focus();
      windowShown = true;
    }
  });

  // Also handle 'did-fail-to-load' more aggressively
  mainWindow.webContents.on('did-fail-to-load', (event, errorCode, errorDescription) => {
    console.error(`[Main] Failed to load: ${errorCode} - ${errorDescription}`);
    // Force show window so user sees error page
    if (!windowShown && mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      windowShown = true;
    }
  });

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

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('mac-native-ui-preferences-changed', getMacNativeUiPreferences());
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

  session.defaultSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    try {
      const parsed = new URL(details.url);
      const hostname = parsed.hostname.toLowerCase();

      if (networkSecurityManager.isHostBlocked(hostname)) {
        return callback({ cancel: true });
      }

      const config = networkSecurityManager.getConfig();
      if (config.upgradeInsecureRequests && parsed.protocol === 'http:') {
        const { isPrivateHostname } = require('./src/core/network-security.js');
        if (!isPrivateHostname(parsed.hostname)) {
          parsed.protocol = 'https:';
          return callback({ redirectURL: parsed.toString() });
        }
      }
    } catch {
      // ignore malformed URLs
    }

    callback({ cancel: false });
  });

  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
    const requestHeaders = { ...(details.requestHeaders || {}) };
    if (networkSecurityManager.getConfig().sendDoNotTrack) {
      requestHeaders.DNT = '1';
      requestHeaders['Sec-GPC'] = '1';
    }

    callback({ requestHeaders });
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
        lowerKey !== 'content-security-policy-report-only'
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
  if (win) win.setFullScreen(!win.isFullScreen());
});

// Persistent Storage Handlers
const persistentDataPath = path.join(app.getPath('userData'), 'persistent_data');
if (!fs.existsSync(persistentDataPath)) {
  fs.mkdirSync(persistentDataPath, { recursive: true });
}

const VAULT_FILE_NAME = 'user-passwords.json';
const VAULT_UNLOCK_TTL_MS = 5 * 60 * 1000;
let vaultUnlockExpiresAt = 0;

function getVaultFilePath() {
  return path.join(persistentDataPath, VAULT_FILE_NAME);
}

function normalizeVaultSite(site = '') {
  return `${site || ''}`
    .trim()
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .toLowerCase();
}

function readVaultEntries() {
  const filePath = getVaultFilePath();
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(raw) ? raw : [];
  } catch (error) {
    console.warn('[Vault] Failed to read entries:', error.message);
    return [];
  }
}

function writeVaultEntries(entries) {
  fs.writeFileSync(getVaultFilePath(), JSON.stringify(entries, null, 2), 'utf-8');
}

function maskVaultEntry(entry = {}) {
  return {
    id: entry.id,
    site: entry.site || '',
    username: entry.username || '',
    created: entry.created || null,
    hasPassword: !!entry.password,
    passwordMasked: entry.password ? '••••••••••••' : '',
    type: entry.type || 'login',
    title: entry.title || '',
    formData: entry.formData || undefined,
  };
}

function getVaultEntryLabel(entry = {}) {
  return [entry.site, entry.username].filter(Boolean).join(' • ') || 'saved credential';
}

function isVaultUnlockStillValid() {
  return vaultUnlockExpiresAt > Date.now();
}

function rememberVaultUnlock() {
  vaultUnlockExpiresAt = Date.now() + VAULT_UNLOCK_TTL_MS;
}

function clearVaultUnlock() {
  vaultUnlockExpiresAt = 0;
}

function selectorLooksSensitive(selector = '') {
  return /(password|passwd|pwd|passcode|pin|otp|username|user(name)?|email|login|sign[\s-_]?in|credential|secret)/i.test(`${selector || ''}`);
}

function valueMatchesVaultCredential(value) {
  const normalized = `${value ?? ''}`.trim();
  if (!normalized) {
    return false;
  }

  return readVaultEntries().some((entry) =>
    entry.password === normalized || `${entry.username || ''}`.trim() === normalized
  );
}

function formNeedsVaultApproval(formData = {}) {
  return Object.entries(formData).some(([selector, value]) =>
    selectorLooksSensitive(selector) || valueMatchesVaultCredential(value)
  );
}

async function verifyVaultAccess({ reason, actionText }) {
  const settings = permissionStore.getSettings();
  if (settings.requireDeviceUnlockForVaultAccess === false) {
    return { success: true, mode: 'vault-device-unlock-disabled' };
  }

  if (isVaultUnlockStillValid()) {
    return { success: true, mode: 'vault-device-unlock-cached' };
  }

  if (!hasNativeDeviceUnlockSupport()) {
    return {
      success: false,
      error: 'Native device unlock is required for Neural Vault access on this build.',
    };
  }

  const nativeVerification = await verifyNativeDeviceAccess({
    reason: reason || 'Unlock Neural Vault to use saved credentials in Comet-AI.',
    actionText: actionText || 'Neural Vault credential access',
    riskLevel: 'high',
  });

  if (!nativeVerification.supported) {
    return {
      success: false,
      error: nativeVerification.error || 'Native device unlock is unavailable for Neural Vault access.',
    };
  }

  if (!nativeVerification.approved) {
    return {
      success: false,
      error: nativeVerification.error || 'Neural Vault access was denied.',
    };
  }

  rememberVaultUnlock();
  permissionStore.logAudit(`vault.unlock: ${actionText || 'credential access'} (${nativeVerification.mode})`);
  return { success: true, mode: nativeVerification.mode };
}

async function ensureVaultApprovalForFormFill(formData = {}) {
  if (!formNeedsVaultApproval(formData)) {
    return { success: true, protected: false };
  }

  const fieldList = Object.keys(formData).slice(0, 3).join(', ');
  const verification = await verifyVaultAccess({
    reason: 'Unlock Neural Vault to fill saved login or form credentials.',
    actionText: `Credential autofill for ${fieldList || 'secure fields'}`,
  });

  if (!verification.success) {
    return { success: false, error: verification.error };
  }

  return { success: true, protected: true, mode: verification.mode };
}

ipcMain.handle('save-persistent-data', async (event, { key, data }) => {
  try {
    if (key === 'user-passwords') {
      return { success: false, error: 'Neural Vault entries must be saved through secure vault APIs.' };
    }
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
    if (key === 'user-passwords') {
      return { success: false, error: 'Neural Vault entries are no longer exposed through generic storage APIs.' };
    }
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
    if (key === 'user-passwords') {
      return { success: false, error: 'Neural Vault entries must be deleted through secure vault APIs.' };
    }
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

ipcMain.handle('get-mac-native-ui-preferences', async () => {
  return {
    success: true,
    preferences: getMacNativeUiPreferences(),
    available: isMac && nativeMacPanelManager.getAvailability(),
  };
});

ipcMain.handle('set-mac-native-ui-preferences', async (event, updates = {}) => {
  if (!isMac) {
    return { success: false, error: 'Native SwiftUI panels are only available on macOS.' };
  }

  return {
    success: true,
    preferences: setMacNativeUiPreferences(updates),
    available: nativeMacPanelManager.getAvailability(),
  };
});

ipcMain.handle('show-mac-native-panel', async (event, mode = 'sidebar') => {
  if (!isMac) {
    return { success: false, error: 'Native SwiftUI panels are only available on macOS.' };
  }

  try {
    const panelMode = normalizeMacNativePanelMode(`${mode || 'sidebar'}`);
    const result = await nativeMacPanelManager.show(panelMode, { relaunchIfRunning: true });
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('toggle-mac-native-panel', async (event, mode = 'sidebar') => {
  if (!isMac) {
    return { success: false, error: 'Native SwiftUI panels are only available on macOS.' };
  }

  try {
    const panelMode = normalizeMacNativePanelMode(`${mode || 'sidebar'}`);
    const result = await nativeMacPanelManager.toggle(panelMode);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.on('update-native-mac-ui-state', (event, nextState = {}) => {
  if (!isMac || !nextState || typeof nextState !== 'object') {
    return;
  }

  const safeMessages = Array.isArray(nextState.messages) ? nextState.messages.slice(-24) : [];
  const safeActionChain = Array.isArray(nextState.actionChain) ? nextState.actionChain.slice(0, 30) : [];
  const safeActivityTags = Array.isArray(nextState.activityTags) ? nextState.activityTags.slice(0, 10) : [];
  const safeConversations = Array.isArray(nextState.conversations) ? nextState.conversations.slice(0, 24) : [];

  nativeMacUiState.updatedAt = Date.now();
  nativeMacUiState.inputDraft = `${nextState.inputDraft || ''}`;
  nativeMacUiState.isLoading = !!nextState.isLoading;
  nativeMacUiState.error = nextState.error ? `${nextState.error}` : null;
  if (nextState.themeAppearance === 'light' || nextState.themeAppearance === 'dark') {
    nativeMacUiState.themeAppearance = nextState.themeAppearance;
  }
  nativeMacUiState.messages = safeMessages.map((message, index) => ({
    id: message.id || `message-${index}-${Date.now()}`,
    role: message.role || 'model',
    content: `${message.content || ''}`.slice(0, 8000),
    timestamp: message.timestamp || Date.now(),
    thinkText: message.thinkText ? `${message.thinkText}`.slice(0, 8000) : null,
    isOcr: !!message.isOcr,
    ocrLabel: message.ocrLabel ? `${message.ocrLabel}`.slice(0, 120) : null,
    ocrText: message.ocrText ? `${message.ocrText}`.slice(0, 12000) : null,
    actionLogs: Array.isArray(message.actionLogs)
      ? message.actionLogs.slice(0, 24).map((log) => ({
        type: `${log?.type || ''}`.slice(0, 120),
        output: `${log?.output || ''}`.slice(0, 4000),
        success: !!log?.success,
      }))
      : [],
    mediaItems: Array.isArray(message.mediaItems)
      ? message.mediaItems.slice(0, 12).map((item, mediaIndex) => ({
        id: item?.id ? `${item.id}` : `media-${index}-${mediaIndex}`,
        type: `${item?.type || 'unknown'}`.slice(0, 80),
        url: item?.url ? `${item.url}`.slice(0, 12000) : null,
        caption: item?.caption ? `${item.caption}`.slice(0, 4000) : null,
        videoUrl: item?.videoUrl ? `${item.videoUrl}`.slice(0, 12000) : null,
        title: item?.title ? `${item.title}`.slice(0, 400) : null,
        description: item?.description ? `${item.description}`.slice(0, 4000) : null,
        thumbnailUrl: item?.thumbnailUrl ? `${item.thumbnailUrl}`.slice(0, 12000) : null,
        source: item?.source ? `${item.source}`.slice(0, 80) : null,
        videoId: item?.videoId ? `${item.videoId}`.slice(0, 120) : null,
        diagramId: item?.diagramId ? `${item.diagramId}`.slice(0, 120) : null,
        code: item?.code ? `${item.code}`.slice(0, 12000) : null,
        chartId: item?.chartId ? `${item.chartId}`.slice(0, 120) : null,
        chartDataJSON: item?.chartDataJSON ? `${item.chartDataJSON}`.slice(0, 12000) : null,
        chartOptionsJSON: item?.chartOptionsJSON ? `${item.chartOptionsJSON}`.slice(0, 8000) : null,
      }))
      : [],
  }));
  nativeMacUiState.actionChain = safeActionChain.map((command, index) => ({
    id: command.id || `command-${index}-${Date.now()}`,
    type: command.type || 'STEP',
    value: `${command.value || ''}`.slice(0, 1200),
    status: command.status || 'pending',
    category: command.category || null,
    riskLevel: command.riskLevel || null,
  }));
  nativeMacUiState.activityTags = safeActivityTags
    .map((tag) => `${tag || ''}`.trim())
    .filter(Boolean)
    .slice(0, 10);
  nativeMacUiState.conversations = safeConversations.map((conversation, index) => ({
    id: conversation.id || `conversation-${index}-${Date.now()}`,
    title: `${conversation.title || 'Untitled chat'}`.slice(0, 120),
    updatedAt: Number.isFinite(conversation.updatedAt) ? conversation.updatedAt : Date.now(),
  }));
  nativeMacUiState.activeConversationId = nextState.activeConversationId
    ? `${nextState.activeConversationId}`
    : null;
  if (Array.isArray(nextState.downloads)) {
    nativeMacUiState.downloads = nextState.downloads.slice(0, 30).map((download) => ({
      name: `${download.name || 'Download'}`,
      status: `${download.status || 'pending'}`,
      progress: Number.isFinite(download.progress) ? download.progress : 0,
      path: download.path ? `${download.path}` : '',
    }));
  }
  if (Array.isArray(nextState.clipboardItems)) {
    nativeMacUiState.clipboardItems = nextState.clipboardItems.slice(0, 40).map((item) => `${item}`.slice(0, 4000));
  }
  nativeMacUiState.currentCommandIndex = Number.isFinite(nextState.currentCommandIndex)
    ? nextState.currentCommandIndex
    : 0;

  const shouldAutoManageActionChain = getMacNativeUiPreferences().actionChainMode === 'swiftui';
  const hasActiveActionChainStep = nativeMacUiState.actionChain.some((command) => (
    command.status === 'pending' || command.status === 'executing' || command.status === 'awaiting_permission'
  ));

  if (shouldAutoManageActionChain) {
    if (hasActiveActionChainStep) {
      nativeMacPanelManager.show('action-chain').catch((error) => {
        console.error('[MacNativeUI] Failed to auto-open SwiftUI Action Chain:', error);
      });
    } else {
      nativeMacPanelManager.close('action-chain');
    }
  }
});

// Secure Auth Storage
ipcMain.on('save-auth-token', (event, { token, user, ...rest }) => {
  const currentSession = getSecureAuthSession() || {};
  const saved = saveSecureAuthSession({
    ...currentSession,
    ...rest,
    token: token || currentSession.token || null,
    user: user || currentSession.user || null,
    savedAt: Date.now(),
  });

  if (saved) {
    console.log('[Auth] Auth token and user info saved to secure storage.');
  }
});

ipcMain.on('save-auth-session', (event, sessionPayload) => {
  const currentSession = getSecureAuthSession() || {};
  const saved = saveSecureAuthSession({
    ...currentSession,
    ...(sessionPayload || {}),
    savedAt: Date.now(),
  });

  event.reply('auth-session-saved', {
    success: saved,
    backend: getAuthStorageBackend(),
  });
});

ipcMain.handle('get-auth-token', () => {
  return getSecureAuthSession()?.token || null;
});

ipcMain.handle('get-user-info', () => {
  return getSecureAuthSession()?.user || null;
});

ipcMain.handle('get-auth-session', () => {
  const session = getSecureAuthSession();
  if (!session) {
    return null;
  }

  return {
    ...session,
    storageBackend: getAuthStorageBackend(),
  };
});

ipcMain.on('clear-auth', () => {
  clearSecureAuthSession();
  store.delete(LEGACY_AUTH_TOKEN_KEY);
  store.delete(LEGACY_USER_INFO_KEY);
  console.log('[Auth] Auth data cleared');
});

// Password Manager Logic
ipcMain.handle('get-passwords-for-site', async (event, domain) => {
  const normalizedDomain = normalizeVaultSite(domain);
  const entries = readVaultEntries().filter((entry) =>
    normalizedDomain ? `${entry.site || ''}`.includes(normalizedDomain) : true
  );

  if (entries.length === 0) {
    return [];
  }

  const verification = await verifyVaultAccess({
    reason: 'Unlock Neural Vault to retrieve saved credentials for this site.',
    actionText: `Site credential access for ${normalizedDomain || domain || 'current site'}`,
  });

  if (!verification.success) {
    return [];
  }

  return entries;
});

ipcMain.handle('vault-list-entries', async () => {
  return {
    success: true,
    entries: readVaultEntries().map(maskVaultEntry),
  };
});

ipcMain.handle('vault-save-entry', async (event, payload = {}) => {
  // REQUIRE native lock for SAVING to vault too, for maximum security as requested
  const verification = await verifyVaultAccess({
    reason: 'Unlock Neural Vault to save a new credential.',
    actionText: `Save credential for ${payload.site || 'new site'}`,
  });

  if (!verification.success) {
    return { success: false, error: verification.error };
  }

  const entries = readVaultEntries();
  const site = normalizeVaultSite(payload.site);
  const username = `${payload.username || ''}`.trim();
  const password = `${payload.password || ''}`;

  if (!site || !password) {
    return { success: false, error: 'Site and password are required.' };
  }

  const incomingId = `${payload.id || ''}`.trim();
  const nextEntry = {
    id: incomingId || Date.now().toString(),
    site,
    username,
    password,
    created: payload.created || new Date().toISOString(),
  };

  const existingIndex = entries.findIndex((entry) => entry.id === nextEntry.id);
  if (existingIndex >= 0) {
    entries[existingIndex] = { ...entries[existingIndex], ...nextEntry };
  } else if (!entries.some((entry) => entry.site === site && entry.username === username && entry.password === password)) {
    entries.push(nextEntry);
  }

  writeVaultEntries(entries);
  clearVaultUnlock();

  return {
    success: true,
    entries: entries.map(maskVaultEntry),
  };
});

ipcMain.handle('vault-delete-entry', async (event, entryId) => {
  const entries = readVaultEntries();
  const remainingEntries = entries.filter((entry) => entry.id !== entryId);
  writeVaultEntries(remainingEntries);
  clearVaultUnlock();
  return {
    success: true,
    entries: remainingEntries.map(maskVaultEntry),
  };
});

ipcMain.handle('vault-read-secret', async (event, entryId) => {
  const entry = readVaultEntries().find((item) => item.id === entryId);
  if (!entry) {
    return { success: false, error: 'Vault entry not found.' };
  }

  const verification = await verifyVaultAccess({
    reason: 'Unlock Neural Vault to reveal a saved password.',
    actionText: `Reveal password for ${getVaultEntryLabel(entry)}`,
  });

  if (!verification.success) {
    return { success: false, error: verification.error };
  }

  return {
    success: true,
    password: entry.password,
  };
});

ipcMain.handle('vault-copy-secret', async (event, entryId) => {
  const entry = readVaultEntries().find((item) => item.id === entryId);
  if (!entry) {
    return { success: false, error: 'Vault entry not found.' };
  }

  const verification = await verifyVaultAccess({
    reason: 'Unlock Neural Vault to copy a saved password.',
    actionText: `Copy password for ${getVaultEntryLabel(entry)}`,
  });

  if (!verification.success) {
    return { success: false, error: verification.error };
  }

  clipboard.writeText(entry.password || '');
  return { success: true };
});

ipcMain.on('propose-password-save', (event, { domain, username, password, type }) => {
  const passwords = readVaultEntries();
  const normalizedDomain = normalizeVaultSite(domain);

  // PRE-CHECK: Avoid opening dialog if identical entry exists
  const isDuplicate = passwords.some(p =>
    p.site === normalizedDomain &&
    p.username === username &&
    p.password === password &&
    (p.type === type || (!p.type && type === 'login'))
  );

  if (isDuplicate) {
    console.log(`[Vault] Suppression: Credential for ${normalizedDomain} already exists.`);
    return;
  }

  // Automatically show a dialog to save password
  dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Save', 'Ignore'],
    defaultId: 0,
    title: 'Comet Vault',
    message: `Do you want to save the password for ${domain}?`,
    detail: `User: ${username}`
  }).then(async (result) => {
    if (result.response === 0) {
      // Require native unlock before saving auto-captured password
      const verification = await verifyVaultAccess({
        reason: 'Unlock Neural Vault to save this captured password.',
        actionText: `Save captured password for ${domain}`,
      });

      if (!verification.success) {
        console.warn('[Vault] Auto-save denied by user during native unlock.');
        return;
      }

      const passwords = readVaultEntries();
      const normalizedDomain = normalizeVaultSite(domain);

      passwords.push({
        id: Date.now().toString(),
        site: normalizedDomain,
        username,
        password,
        type: type || 'login',
        created: new Date().toISOString()
      });
      writeVaultEntries(passwords);
      clearVaultUnlock();
      console.log(`[Vault] Saved password for ${normalizedDomain}`);
    }
  });
});

ipcMain.on('propose-form-collection-save', (event, { domain, title, data, type }) => {
  const entries = readVaultEntries();
  const normalizedDomain = normalizeVaultSite(domain);

  // PRE-CHECK: If we already have this exact form-data for this site, skip.
  const isDuplicate = entries.some(e =>
    e.site === normalizedDomain &&
    e.type === 'form' &&
    JSON.stringify(e.formData) === JSON.stringify(data)
  );

  if (isDuplicate) return;

  dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Save Collection', 'Ignore'],
    defaultId: 0,
    title: 'Neural Vault — Collect Data',
    message: `Securely save this form collection from ${domain}?`,
    detail: `Captured ${data.length} fields from: ${title}`
  }).then(async (result) => {
    if (result.response === 0) {
      const verification = await verifyVaultAccess({
        reason: 'Unlock Neural Vault to save this form collection.',
        actionText: `Save form collection for ${domain}`,
      });

      if (!verification.success) return;

      const entries = readVaultEntries();
      entries.push({
        id: Date.now().toString(),
        site: normalizeVaultSite(domain),
        title,
        formData: data,
        type: 'form',
        created: new Date().toISOString()
      });
      writeVaultEntries(entries);
      console.log(`[Vault] Saved form collection for ${domain}`);
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
    // Direct Google OAuth URLs should still use the system browser.
    // Our hosted /auth page should stay inside Comet so Firebase popup can open as a child window.
    if (authUrl.includes('accounts.google.com')) {
      if (authWindow && !authWindow.isDestroyed()) {
        authWindow.destroy();
        authWindow = null;
      }
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
    const isMacPlatform = process.platform === 'darwin';
    const isWinPlatform = process.platform === 'win32';

    authWindow = new BrowserWindow({
      width: 540,
      height: 780,
      frame: isMacPlatform ? true : false, // frame must be true on Mac for titleBarStyle: 'hidden' to show traffic lights
      transparent: false,
      backgroundColor: '#02030a',
      hasShadow: true,
      resizable: true,
      parent: mainWindow,
      modal: isMacPlatform ? false : true, // On Mac, modal: true makes it a sheet which hides traffic lights
      show: false,
      titleBarStyle: 'hidden',
      trafficLightPosition: isMacPlatform ? { x: 18, y: 18 } : undefined,
      titleBarOverlay: isWinPlatform ? {
        color: '#02030a',
        symbolColor: '#ffffff',
        height: 32
      } : false,
      webPreferences: {
        preload: authPreloadPath, // Always use auth-preload to handle drag and custom close if needed
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    if (!isMacPlatform) {
      authWindow.setMenuBarVisibility(false);
    }

    // Fix "Unsecure Browser" error by setting a modern User-Agent
    authWindow.webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");

    authWindow.webContents.setWindowOpenHandler(({ url }) => {
      const isPopupAuthUrl = url.includes('accounts.google.com') ||
        url.includes('googleusercontent.com') ||
        url.includes('firebaseapp.com') ||
        url.includes('/__/auth/') ||
        url.includes('oauth');

      if (isPopupAuthUrl) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 520,
            height: 720,
            center: true,
            autoHideMenuBar: true,
            modal: false,
            parent: authWindow || mainWindow,
            backgroundColor: '#02030a',
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
              sandbox: false,
            },
          }
        };
      }

      return { action: 'allow' };
    });

    authWindow.loadURL(authUrl);

    authWindow.once('ready-to-show', () => {
      authWindow.show();
    });

    let authPoller = null;

    const closeAuthWindowSafely = () => {
      if (authPoller) { clearInterval(authPoller); authPoller = null; }
      if (authWindow && !authWindow.isDestroyed()) {
        console.log('[Auth] Closing auth window');
        authWindow.destroy();
        authWindow = null;
      }
    };

    const dispatchAuthCallback = (deepLinkUrl) => {
      console.log('[Auth] Dispatching callback to main window:', deepLinkUrl.substring(0, 80) + '...');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('auth-callback', deepLinkUrl);
        mainWindow.focus();
      }
      setTimeout(closeAuthWindowSafely, 300);
    };

    // ─── PRIMARY: will-navigate fires when window.location.href is set ─────────
    // When the landing page does `window.location.href = 'comet-browser://auth?...'`
    // Electron intercepts this here before attempting to navigate
    authWindow.webContents.on('will-navigate', (event, url) => {
      if (url.startsWith('comet-browser://')) {
        event.preventDefault();
        console.log('[Auth] will-navigate intercepted comet-browser:// URL');
        dispatchAuthCallback(url);
      }
    });

    // ─── SECONDARY: will-redirect for server-side HTTP 302 redirects ───────────
    authWindow.webContents.on('will-redirect', (event, url) => {
      if (url.startsWith('comet-browser://')) {
        event.preventDefault();
        console.log('[Auth] will-redirect intercepted comet-browser:// URL');
        dispatchAuthCallback(url);
      } else if (url.startsWith('http://localhost') && url.includes('code=')) {
        event.preventDefault();
        const code = new URLSearchParams(new URL(url).search).get('code');
        if (code) { ipcMain.emit('gmail-oauth-code', null, code); closeAuthWindowSafely(); }
      }
    });

    // ─── KEY FIX: did-fail-load catches failed comet-browser:// navigation ──────
    // When the web engine cannot resolve `comet-browser://` (it's not a web scheme),
    // Electron fires did-fail-load with errorCode -300 (ERR_FAILED).
    // The `validatedURL` param still contains the full comet-browser:// URL with all params.
    authWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      if (validatedURL && validatedURL.startsWith('comet-browser://')) {
        console.log('[Auth] did-fail-load caught comet-browser:// navigation:', validatedURL.substring(0, 80));
        dispatchAuthCallback(validatedURL);
      }
    });

    // ─── BACKUP: Landing page console.log signal ───────────────────────────────
    authWindow.webContents.on('console-message', (event) => {
      const message = event.message || '';
      try {
        if (message.includes('comet-auth-success')) {
          const data = JSON.parse(message);
          if (data.type === 'comet-auth-success' && data.data) {
            const d = data.data;
            const params = new URLSearchParams({ auth_status: 'success', uid: d.uid || '', email: d.email || '' });
            if (d.name) params.set('name', d.name);
            if (d.photo) params.set('photo', d.photo);
            if (d.idToken) params.set('id_token', d.idToken);
            if (d.id_token) params.set('id_token', d.id_token);
            if (d.firebaseConfig) params.set('firebase_config', btoa(JSON.stringify(d.firebaseConfig)));
            console.log('[Auth] console-message auth signal received, dispatching...');
            dispatchAuthCallback(`comet-browser://auth?${params.toString()}`);
          }
        }
      } catch (e) { }
    });

    authWindow.on('closed', () => {
      if (authPoller) { clearInterval(authPoller); authPoller = null; }
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
  }
  authWindow = null;
});

ipcMain.on('raycast-update-state', (event, state) => {
  if (state?.tabs) {
    raycastState.tabs = state.tabs.slice(-100);
  }
  if (state?.history) {
    raycastState.history = state.history.slice(-200);
  }
});

// Multi-BrowserView Management
ipcMain.on('create-view', (event, { tabId, url }) => {
  if (tabViews.has(tabId)) return; // Prevent redundant creation

  const chromeUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  const newView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'view_preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });
  newView.webContents.setUserAgent(chromeUserAgent);
  applyProxyConfigToSession(newView.webContents.session);
  
  // Add BrowserView to mainWindow immediately
  if (mainWindow) {
    mainWindow.addBrowserView(newView);
    console.log(`[BrowserView] Added view for tab ${tabId} to mainWindow`);
  }
  
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
    syncGoogleSearchThemeForContents(newView.webContents);
    mainWindow.webContents.send('on-tab-loaded', { tabId, url: newView.webContents.getURL() });
  });

  // ERROR-PROOFING: Handle page load failures gracefully
  newView.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.warn(`[BrowserView] Tab ${tabId} failed to load: ${errorCode} - ${errorDescription}`);
    // Common non-critical errors to ignore
    const nonCritical = [-3, -7, -8, -9, -105, -106]; // ABORTED, CONNECTION_FAILED, etc.
    if (nonCritical.includes(errorCode)) return;
    mainWindow.webContents.send('tab-load-error', { tabId, errorCode, errorDescription, url });
  });

  newView.webContents.on('render-process-gone', (event, details) => {
    console.error(`[BrowserView] Tab ${tabId} render process gone: ${details.reason}`);
    mainWindow.webContents.send('tab-crashed', { tabId, reason: details.reason });
  });

  newView.webContents.on('unresponsive', () => {
    console.warn(`[BrowserView] Tab ${tabId} became unresponsive`);
    mainWindow.webContents.send('tab-unresponsive', { tabId });
  });

  newView.webContents.on('responsive', () => {
    console.log(`[BrowserView] Tab ${tabId} became responsive again`);
    mainWindow.webContents.send('tab-responsive', { tabId });
  });

  newView.webContents.on('did-navigate', (event, navUrl) => {
    syncGoogleSearchThemeForContents(newView.webContents);
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

  // Handle fullscreen requests from the BrowserView
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
    if (view.webContents && !view.webContents.isDestroyed()) {
      view.webContents.destroy();
    }
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
    // which will create a new BrowserView for the tab.
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
      mainWindow.removeBrowserView(oldView);
    }
  }

  const newView = tabViews.get(tabId);
  if (newView) {
    if (bounds.width === 0 || bounds.height === 0) {
      mainWindow.removeBrowserView(newView);
    } else {
      if (!mainWindow.getBrowserViews().includes(newView)) {
        mainWindow.addBrowserView(newView);
      }
      const roundedBounds = {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
      newView.setBounds(roundedBounds);
    }
  }
  activeTabId = tabId;
});

ipcMain.on('destroy-view', (event, tabId) => {
  const view = tabViews.get(tabId);
  if (view) {
    if (activeTabId === tabId) {
      mainWindow.removeBrowserView(view);
      activeTabId = null;
    }
    if (view.webContents && !view.webContents.isDestroyed()) {
      view.webContents.destroy();
    }
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
      mainWindow.removeBrowserView(view);
    } else {
      if (!mainWindow.getBrowserViews().includes(view)) {
        mainWindow.addBrowserView(view);
      }
      const roundedBounds = {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
      view.setBounds(roundedBounds);
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
      console.warn(`[BrowserView] Navigation attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 500)); // Wait before retry
      }
    }
  }

  // All retries failed - try loading a fallback/error page
  console.error(`[BrowserView] Navigation failed after ${maxRetries} attempts: ${url}`);
  try {
    const fallbackUrl = `data:text/html,<html><head><title>Navigation Error</title></head><body style="font-family:sans-serif;padding:40px;text-align:center;background:#fafafa;"><h2 style="color:#dc2626;">⚠️ Could not load this page</h2><p>The page <strong>${escapeHtml(url.substring(0, 50))}...</strong> could not be loaded.</p><p style="color:#666;">This may be due to a network issue or the site being unavailable.</p><button onclick="window.history.back()" style="padding:12px 24px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;margin-top:20px;">Go Back</button></body></html>`;
    await view.webContents.loadURL(fallbackUrl);
  } catch (fallbackErr) {
    console.error('[BrowserView] Even fallback page failed:', fallbackErr);
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
 * find-and-click-text: resolves a visible cross-app target and clicks it.
 * Uses the shared OCR service, which now prefers native OS providers first
 * and falls back to Tesseract only when native extraction is unavailable.
 */
ipcMain.handle('find-and-click-text', async (event, targetText) => {
  if (!targetText || typeof targetText !== 'string' || targetText.trim().length === 0) {
    return { success: false, error: 'Target text is required.' };
  }

  const permission = checkAiActionPermission('FIND_AND_CLICK', targetText.trim(), 'medium');
  if (!permission.allowed) {
    return { success: false, error: permission.error };
  }

  try {
    if (!tesseractOcrService) {
      return { success: false, error: 'OCR service not initialized.' };
    }

    const result = await tesseractOcrService.ocrClick(
      targetText.trim(),
      cometAiEngine,
      robotService,
      permissionStore
    );

    if (!result.success) {
      return result;
    }

    console.log(`[Main] Find-and-click resolved "${targetText}" via ${result.method || 'ocr'}`);
    return result;
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
  { id: 'google', name: 'Google Gemini (Auto Latest)' },
  { id: 'google-flash', name: 'Google Gemini Flash (Auto Latest)' },
  { id: 'openai', name: 'OpenAI (Auto Latest)' },
  { id: 'azure-openai', name: 'Microsoft Azure OpenAI' },
  { id: 'anthropic', name: 'Anthropic Claude (Auto Latest)' },
  { id: 'xai', name: 'xAI Grok (Auto Latest)' },
  { id: 'groq', name: 'Groq (Auto Latest)' },
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
    model: store.get('gemini_model') || getProviderFallbackModel('google')
  },
  'google-flash': {
    apiKey: store.get('gemini_api_key') || '',
    model: store.get('gemini_flash_model') || getProviderFallbackModel('google-flash')
  },
  openai: {
    apiKey: store.get('openai_api_key') || '',
    model: store.get('openai_model') || getProviderFallbackModel('openai')
  },
  'azure-openai': {
    apiKey: store.get('azure_openai_api_key') || '',
    baseUrl: store.get('azure_openai_endpoint') || '',
    model: store.get('azure_openai_model') || 'gpt-4.1-mini'
  },
  anthropic: {
    apiKey: store.get('anthropic_api_key') || '',
    model: store.get('anthropic_model') || getProviderFallbackModel('anthropic')
  },
  xai: {
    apiKey: store.get('xai_api_key') || '',
    model: store.get('xai_model') || getProviderFallbackModel('xai')
  },
  groq: {
    apiKey: store.get('groq_api_key') || '',
    model: store.get('groq_model') || getProviderFallbackModel('groq')
  }
};

const LLM_MODEL_CATALOG_STORE_KEY = 'llm_model_catalogs_v1';

function getCachedProviderCatalogs() {
  const cached = store.get(LLM_MODEL_CATALOG_STORE_KEY);
  return cached && typeof cached === 'object' ? cached : {};
}

function saveCachedProviderCatalog(providerId, catalog) {
  const cachedCatalogs = getCachedProviderCatalogs();
  cachedCatalogs[providerId] = catalog;
  store.set(LLM_MODEL_CATALOG_STORE_KEY, cachedCatalogs);
}

function getConfiguredProviderApiKey(providerId) {
  const storeKey = getProviderApiKeyStoreKey(providerId);
  return (storeKey && store.get(storeKey)) || llmConfigs[providerId]?.apiKey || '';
}

function getRecommendedProviderModel(providerId) {
  const cachedCatalogs = getCachedProviderCatalogs();
  return cachedCatalogs[providerId]?.recommendedModel || getProviderFallbackModel(providerId);
}

function getConfiguredProviderModel(providerId) {
  if (providerId === 'ollama') {
    return store.get('ollama_model') || llmConfigs.ollama.model || 'deepseek-r1:1.5b';
  }

  if (providerId === 'azure-openai') {
    return store.get('azure_openai_model') || llmConfigs['azure-openai'].model || 'gpt-4.1-mini';
  }

  const storeKey = getProviderModelStoreKey(providerId);
  const configuredModel = (storeKey && store.get(storeKey)) || llmConfigs[providerId]?.model;
  return configuredModel || getRecommendedProviderModel(providerId);
}

async function getProviderModelCatalog(providerId, options = {}) {
  const forceRefresh = options.forceRefresh === true;
  const cachedCatalogs = getCachedProviderCatalogs();
  const cachedCatalog = cachedCatalogs[providerId];

  if (
    !forceRefresh &&
    cachedCatalog &&
    cachedCatalog.fetchedAt &&
    Date.now() - cachedCatalog.fetchedAt < CATALOG_TTL_MS
  ) {
    return cachedCatalog;
  }

  if (!llmConfigs[providerId]) {
    return {
      success: false,
      providerId,
      providerName: getProviderLabel(providerId),
      models: [],
      recommendedModel: getProviderFallbackModel(providerId),
      error: `Provider ${providerId} is not configured.`,
    };
  }

  try {
    const catalog = await fetchProviderModelCatalog(providerId, {
      apiKey: getConfiguredProviderApiKey(providerId),
    });

    if (catalog.success) {
      saveCachedProviderCatalog(providerId, catalog);
      return catalog;
    }

    if (cachedCatalog && !forceRefresh) {
      return cachedCatalog;
    }

    return catalog;
  } catch (error) {
    if (cachedCatalog && !forceRefresh) {
      return {
        ...cachedCatalog,
        warning: error.message,
      };
    }

    return {
      success: false,
      providerId,
      providerName: getProviderLabel(providerId),
      models: [],
      recommendedModel: getProviderFallbackModel(providerId),
      error: error.message,
    };
  }
}

ipcMain.handle('llm-get-available-providers', () => llmProviders);
ipcMain.handle('llm-get-provider-models', async (event, providerId, options = {}) => {
  return getProviderModelCatalog(providerId, options);
});
ipcMain.handle('llm-set-active-provider', (event, providerId) => {
  activeLlmProvider = providerId;
  store.set('active_llm_provider', providerId);
  return true;
});
ipcMain.handle('llm-configure-provider', (event, providerId, options) => {
  llmConfigs[providerId] = { ...llmConfigs[providerId], ...options };

  // Persist to store for survivors
  if (providerId === 'google') {
    if (options.apiKey) store.set('gemini_api_key', options.apiKey);
    if (options.model) store.set('gemini_model', options.model);
  }
  if (providerId === 'google-flash') {
    if (options.apiKey) store.set('gemini_api_key', options.apiKey);
    if (options.model) store.set('gemini_flash_model', options.model);
  }
  if (providerId === 'openai') {
    if (options.apiKey) store.set('openai_api_key', options.apiKey);
    if (options.model) store.set('openai_model', options.model);
  }
  if (providerId === 'azure-openai') {
    if (options.apiKey) store.set('azure_openai_api_key', options.apiKey);
    if (options.baseUrl) store.set('azure_openai_endpoint', options.baseUrl);
    if (options.model) store.set('azure_openai_model', options.model);
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
    openai_model: getConfiguredProviderModel('openai'),
    azure_openai_api_key: store.get('azure_openai_api_key') || '',
    azure_openai_endpoint: store.get('azure_openai_endpoint') || '',
    azure_openai_model: store.get('azure_openai_model') || 'gpt-4.1-mini',
    gemini_api_key: store.get('gemini_api_key') || '',
    gemini_model: getConfiguredProviderModel('google'),
    gemini_flash_model: getConfiguredProviderModel('google-flash'),
    anthropic_api_key: store.get('anthropic_api_key') || '',
    anthropic_model: getConfiguredProviderModel('anthropic'),
    groq_api_key: store.get('groq_api_key') || '',
    groq_model: getConfiguredProviderModel('groq'),
    xai_api_key: store.get('xai_api_key') || '',
    xai_model: getConfiguredProviderModel('xai'),
    ollama_base_url: store.get('ollama_base_url') || 'http://127.0.0.1:11434',
    ollama_model: store.get('ollama_model') || 'deepseek-r1:1.5b',
    ollama_enabled: store.get('ollama_enabled') !== false,
    active_llm_provider: store.get('active_llm_provider') || 'ollama',
  };
});

// Onboarding / first-run flags — persisted in electron-store so .dmg/.exe builds
// keep state even when renderer localStorage partition or origin differs from dev.
ipcMain.handle('get-onboarding-state', () => ({
  hasSeenWelcomePage: !!store.get('onboarding_has_seen_welcome'),
  hasCompletedStartupSetup: !!store.get('onboarding_completed_startup'),
  hasSeenNeuralSetup: !!store.get('onboarding_seen_neural_setup'),
}));

ipcMain.handle('set-onboarding-state', (event, partial = {}) => {
  console.log('[IPC] set-onboarding-state handler called with:', partial);
  if (typeof partial.hasSeenWelcomePage === 'boolean') {
    store.set('onboarding_has_seen_welcome', partial.hasSeenWelcomePage);
  }
  if (typeof partial.hasCompletedStartupSetup === 'boolean') {
    store.set('onboarding_completed_startup', partial.hasCompletedStartupSetup);
  }
  if (typeof partial.hasSeenNeuralSetup === 'boolean') {
    store.set('onboarding_seen_neural_setup', partial.hasSeenNeuralSetup);
  }
  return true;
});

// Redundant search-applications handler removed (see line 3387)


// IPC handler to set MCP server port dynamically
ipcMain.on('set-mcp-server-port', (event, port) => {
  mcpServerPort = port;
  console.log(`MCP Server port updated to: ${mcpServerPort}`);
});

ipcMain.handle('extract-page-content', async () => {
  const view = tabViews.get(activeTabId);
  if (!view || !view.webContents || view.webContents.isDestroyed()) {
    return { error: 'No active view' };
  }

  // Small delay to let page settle before reading
  await new Promise(resolve => setTimeout(resolve, 500));

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
        
// Extract all links with their titles for web search and navigation
        const links = [];
        for (const a of document.querySelectorAll('a[href]')) {
          const href = a.href;
          const title = a.textContent?.trim() || a.title || '';
          const visibleText = a.innerText?.trim() || '';
          if (href && (title || visibleText) && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {
            links.push({ href, title: title || visibleText, text: visibleText });
          }
        }
        
        const main = document.querySelector('main, article, [role="main"], #content, #main, .content') || document.body;
        const elements = [];
        for (const child of main.children) {
          elements.push(...extractElements(child));
        }
        
        const content = elements.map(e => e.text).filter(Boolean).join('\n');
        const fullText = document.body.innerText || content;
        
        return {
          content: sanitizeText(fullText),
          elements,
          links,
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
      links: result.links || [],
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
  if (mainWindow) {
    mainWindow.webContents.send('ai-overview-data', data);
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

async function requestShellApproval(command, riskLevel, reason, options = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { allowed: false, deviceUnlockValidated: false };
  }
  const requestId = `shell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const qrPayload = await generateShellApprovalQR(command);
  const payload = {
    requestId,
    command,
    risk: riskLevel || 'medium',
    reason: reason || 'A scheduled automation needs your approval.',
    highRiskQr: JSON.stringify(qrPayload),
    requiresDeviceUnlock: !!options.requiresDeviceUnlock,
  };
  const useNativePermissionPanel =
    isMac &&
    getMacNativeUiPreferences().permissionMode === 'swiftui';

  nativeMacUiState.pendingApproval = {
    ...payload,
    mobileApproved: false,
    expectedPin: qrPayload?.pin || '',
    approvalToken: qrPayload?.token || '',
  };
  nativeMacUiState.updatedAt = Date.now();

  try {
    if (useNativePermissionPanel) {
      await nativeMacPanelManager.show('permissions', { relaunchIfRunning: true });
    } else {
      mainWindow.webContents.send('automation-shell-approval', payload);
    }
  } catch (error) {
    console.error('[Main] Failed to send shell approval request:', error);
    nativeMacUiState.pendingApproval = null;
    return { allowed: false, deviceUnlockValidated: false };
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (shellApprovalResolvers.has(requestId)) {
        shellApprovalResolvers.delete(requestId);
        nativeMacUiState.pendingApproval = null;
        resolve({ allowed: false, deviceUnlockValidated: false });
      }
    }, 120000);

    shellApprovalResolvers.set(requestId, (result = {}) => {
      clearTimeout(timeout);
      nativeMacUiState.pendingApproval = null;
      if (typeof result === 'boolean') {
        resolve({ allowed: result, deviceUnlockValidated: false });
        return;
      }
      resolve({
        allowed: !!result.allowed,
        deviceUnlockValidated: !!result.deviceUnlockValidated,
      });
    });
  });
}

async function checkShellPermission(command, reason, riskLevel) {
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
  const autoApprovalRiskLevel = analysis.harmLevel === 'safe'
    ? (analysis.isWhitelisted ? 'low' : null)
    : analysis.harmLevel;
  const approvalRiskLevel = autoApprovalRiskLevel === 'critical'
    ? 'high'
    : (autoApprovalRiskLevel || 'medium');
  const settings = permissionStore.getSettings();
  const requiresDeviceUnlock =
    settings.requireDeviceUnlockForManualApproval !== false &&
    hasNativeDeviceUnlockSupport();

  // Use auto-approve settings from permission store
  if (autoApprovalRiskLevel && permissionStore.canAutoExecute(command, autoApprovalRiskLevel)) {
    console.log(`[Shell] Auto-approved (${autoApprovalRiskLevel}): ${command}`);
    return true;
  }

  console.log(`[Shell] Requesting approval (${approvalRiskLevel}): ${command}`);
  const approvalResult = await requestShellApproval(
    command,
    approvalRiskLevel,
    reason || 'Automation requested this shell action.',
    { requiresDeviceUnlock }
  );

  if (!approvalResult.allowed) {
    return false;
  }

  if (!requiresDeviceUnlock) {
    return true;
  }

  if (approvalResult.deviceUnlockValidated) {
    return true;
  }

  const nativeVerification = await verifyNativeCommandApproval({
    command,
    riskLevel: approvalRiskLevel,
  });

  if (!nativeVerification.supported) {
    console.warn('[Shell] Native device unlock requested but unavailable:', nativeVerification.error);
    return true;
  }

  if (!nativeVerification.approved) {
    console.warn('[Shell] Native device unlock verification denied:', nativeVerification.error || 'User denied verification');
    return false;
  }

  console.log(`[Shell] Native device unlock approved via ${nativeVerification.mode}`);
  return true;
}

function checkAiActionPermission(actionType, target, riskLevel = 'medium') {
  const normalizedRisk = `${riskLevel || 'medium'}`.trim().toLowerCase() === 'critical'
    ? 'high'
    : `${riskLevel || 'medium'}`.trim().toLowerCase();
  const normalizedActionType = `${actionType || ''}`.trim().toUpperCase();
  const permissionTarget = `${target || normalizedActionType}`.trim();
  const permissionKey = `${normalizedActionType}:${permissionTarget}`;

  if (permissionStore.isGranted(permissionKey)) {
    return { allowed: true, permissionKey };
  }

  if (permissionStore.canAutoExecuteAction(normalizedActionType, normalizedRisk)) {
    return { allowed: true, permissionKey };
  }

  return {
    allowed: false,
    permissionKey,
    error: `${normalizedActionType} requires approval in Comet Settings or the AI action prompt.`,
  };
}

/**
 * Command Validation Layer
 * Blocks dangerous shell commands and sanitizes inputs.
 */
function validateCommand(command) {
  if (!command || typeof command !== 'string') {
    throw new Error('Invalid command format');
  }

  // Support home directory expansion
  let trimmed = command.trim();
  if (trimmed.startsWith('~/')) {
    trimmed = trimmed.replace('~/', os.homedir() + '/');
  } else if (trimmed === '~') {
    trimmed = os.homedir();
  }

  if (!trimmed) {
    throw new Error('Command cannot be empty');
  }

  const exploitPatterns = [
    /\u0000/,
    /:\(\)\s*\{\s*:\|:&\s*\};:/,
  ];

  if (exploitPatterns.some((pattern) => pattern.test(trimmed))) {
    console.warn(`[Security] Blocked exploit-style command execution attempt: ${trimmed}`);
    throw new Error('Security Exception: blocked malformed shell payload.');
  }

  return trimmed.slice(0, 1000);
}

ipcMain.handle('execute-shell-command', async (event, { rawCommand, preApproved, reason, riskLevel }) => {
  // Check if already granted permission (skip the blocking dialog - let user configure in Settings)
  // Permission dialog removed - user can configure in Settings panel

  let command;
  try {
    command = validateCommand(rawCommand);
  } catch (e) {
    return { success: false, error: e.message };
  }

  if (!preApproved) {
    const authorized = await checkShellPermission(command, reason, riskLevel);
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
    } else if (parsedUrl.protocol === `${RAYCAST_PROTOCOL}:` || parsedUrl.protocol === 'comet:') {
      handleURLSchemeEvent(url);
    }
  } catch (e) {
    console.error('Failed to parse deep link:', e);
  }
}

function getEffectiveThemeSource() {
  if (nativeTheme.themeSource === 'light' || nativeTheme.themeSource === 'dark') {
    return nativeTheme.themeSource;
  }

  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
}

function isGoogleSearchUrl(rawUrl = '') {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.startsWith('www.google.') && parsed.pathname === '/search';
  } catch {
    return false;
  }
}

async function syncGoogleSearchThemeForContents(contents, options = {}) {
  if (!contents || contents.isDestroyed()) {
    return;
  }

  const currentUrl = contents.getURL();
  if (!isGoogleSearchUrl(currentUrl)) {
    return;
  }

  const themeSource = getEffectiveThemeSource();

  try {
    await contents.executeJavaScript(`
      (() => {
        const isDark = ${themeSource === 'dark'};
        // Force the color-scheme preference
        document.documentElement.style.setProperty('color-scheme', isDark ? 'dark' : 'light');
        if (document.body) {
          document.body.classList.toggle('dark-theme', isDark);
          document.body.style.backgroundColor = isDark ? '#202124' : '#fff';
          document.body.style.color = isDark ? '#bdc1c6' : '#202124';
        }
        return true;
      })();
    `, true);

    if (options.reload === true) {
      contents.reload();
    }
  } catch (error) {
    console.warn('[Theme] Failed to sync Google Search theme:', error.message);
  }
}

async function updateGoogleSearchTheme(options = {}) {
  const views = [...tabViews.values()];
  await Promise.all(views.map((view) => syncGoogleSearchThemeForContents(view?.webContents, options)));
}

// Security Settings (Registered before app is ready to avoid missing handler)
ipcMain.handle('security-settings-get', async () => {
  return permissionStore.getSettings();
});

ipcMain.handle('security-settings-update', async (event, settings) => {
  permissionStore.updateSettings(settings);
  return { success: true, settings: permissionStore.getSettings() };
});

ipcMain.handle('set-native-theme-source', async (_event, source) => {
  const nextSource = ['system', 'light', 'dark'].includes(source) ? source : 'system';
  nativeTheme.themeSource = nextSource;
  // We register this as an async handler, but the theme sync will wait for views
  updateGoogleSearchTheme({ reload: true }).catch(err => console.warn('[Theme] Early sync failed:', err));
  return { success: true, themeSource: nativeTheme.themeSource };
});

ipcMain.handle('network-security-get', async () => {
  return {
    success: true,
    config: networkSecurityConfig,
    restartRequiredFor: ['enableSecureDns', 'dnsProvider', 'customDnsTemplate', 'preventWebRtcLeaks'],
  };
});

ipcMain.handle('network-security-update', async (_event, updates) => {
  try {
    const config = await applyNetworkSecurityConfig(updates || {});
    return {
      success: true,
      config,
      restartRequiredFor: ['enableSecureDns', 'dnsProvider', 'customDnsTemplate', 'preventWebRtcLeaks'],
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ============================================================
// Plugin System IPC Handlers
// ============================================================
ipcMain.handle('plugins:list', async () => {
  try {
    return pluginManager.getPlugins();
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('plugins:get', async (event, pluginId) => {
  try {
    const plugin = pluginManager.getPlugin(pluginId);
    if (!plugin) {
      return { success: false, error: 'Plugin not found' };
    }
    return { success: true, plugin };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('plugins:install', async (event, { source, pluginId, path: filePath }) => {
  try {
    const result = await pluginManager.installPlugin(source, { pluginId, filePath });
    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('plugins:uninstall', async (event, pluginId) => {
  try {
    const result = await pluginManager.uninstallPlugin(pluginId);
    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('plugins:update', async (event, pluginId) => {
  try {
    const result = await pluginManager.updatePlugin(pluginId);
    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('plugins:enable', async (event, pluginId) => {
  try {
    const result = await pluginManager.enablePlugin(pluginId);
    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('plugins:disable', async (event, pluginId) => {
  try {
    const result = await pluginManager.disablePlugin(pluginId);
    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('plugins:get-commands', async () => {
  try {
    return pluginManager.getCommands();
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('plugins:execute-command', async (event, commandId, params) => {
  try {
    const result = await pluginManager.executeCommand(commandId, params);
    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('plugins:update-config', async (event, pluginId, config) => {
  try {
    const result = pluginManager.updatePluginConfig(pluginId, config);
    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('plugins:get-dir', async () => {
  return pluginManager.getPluginsDirPath();
});

ipcMain.handle('plugins:scan', async (event, directory) => {
  try {
    const results = await pluginManager.scanDirectory(directory);
    return { success: true, plugins: results };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Plugin internal API handlers
ipcMain.handle('plugin-api:read-file', async (event, filePath) => {
  const fs = require('fs');
  const path = require('path');
  const pluginsDir = pluginManager.getPluginsDirPath();
  const resolvedPath = path.resolve(pluginsDir, '..', filePath);
  if (!resolvedPath.startsWith(pluginsDir)) {
    throw new Error('Access denied: Path outside plugins directory');
  }
  return fs.readFileSync(resolvedPath, 'utf-8');
});

ipcMain.handle('plugin-api:write-file', async (event, filePath, content) => {
  const fs = require('fs');
  const path = require('path');
  const pluginsDir = pluginManager.getPluginsDirPath();
  const resolvedPath = path.resolve(pluginsDir, '..', filePath);
  if (!resolvedPath.startsWith(pluginsDir)) {
    throw new Error('Access denied: Path outside plugins directory');
  }
  fs.writeFileSync(resolvedPath, content);
  return { success: true };
});

ipcMain.handle('plugin-api:log', async (event, { pluginId, message, level }) => {
  const levels = ['info', 'warn', 'error', 'debug'];
  const logFn = levels.includes(level) ? console[level] : console.log;
  logFn(`[Plugin:${pluginId}]`, message);
  return { success: true };
});

// Listen for plugin events and emit to renderer
pluginManager.on('plugin:installed', (manifest) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('plugin:installed', manifest);
  }
});

pluginManager.on('plugin:uninstalled', ({ pluginId }) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('plugin:uninstalled', { pluginId });
  }
});

pluginManager.on('plugin:config-updated', ({ pluginId, config }) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('plugin:config-updated', { pluginId, config });
  }
});

app.whenReady().then(async () => {
  // Memory management handlers
  ipcMain.handle('memory:collect', async () => {
    if (global.gc) {
      global.gc();
      return { success: true, message: 'Garbage collection triggered' };
    }
    return { success: false, message: 'GC not available' };
  });

  ipcMain.handle('memory:stats', async () => {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
      rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
      external: Math.round(memUsage.external / 1024 / 1024) + ' MB'
    };
  });

  ipcMain.handle('memory:flush', async () => {
    // Clear caches
    if (session.defaultSession) {
      await session.defaultSession.clearCache();
      await session.defaultSession.clearStorageData({ storages: ['cachestorage'] });
    }
    return { success: true, message: 'Caches cleared' };
  });

  nativeTheme.on('updated', () => {
    updateGoogleSearchTheme();
  });
  registerAppFileProtocol();
  buildApplicationMenu();
  await applyNetworkSecurityConfig(networkSecurityConfig);
  
  // Create window early to ensure UI is visible even if secondary services are initializing
  // Set dock icon for Mac during development
  if (process.platform === 'darwin' && !app.isPackaged) {
    try {
      const iconPath = path.join(__dirname, 'public', 'icon.png');
      if (fs.existsSync(iconPath)) {
        app.dock.setIcon(iconPath);
      }
    } catch (e) {
      console.warn('[Main] Failed to set dock icon:', e);
    }
  }

  createWindow();

  // Auto-update setup (only in production)
  if (app.isPackaged) {
    const { autoUpdater } = require('electron-updater');

    // Check for updates at startup
    autoUpdater.checkForUpdatesAndNotify();

    // Auto check for updates every hour
    setInterval(() => {
      autoUpdater.checkForUpdates();
    }, 1000 * 60 * 60); // 1 hour

    // Handle auto updater events
    autoUpdater.on('checking-for-update', () => {
      logMain('Checking for update...');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-status', { checking: true });
      }
    });

    autoUpdater.on('update-available', (info) => {
      logMain('Update available:', info);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-available', info);
      }
    });

    autoUpdater.on('update-not-available', (info) => {
      logMain('Update not available:', info);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-not-available', info);
      }
    });

    autoUpdater.on('error', (err) => {
      logErr('Error in auto-updater:', err);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-error', err.toString());
      }
    });

    autoUpdater.on('download-progress', (progressObj) => {
      logMain(`Download progress: ${progressObj.percent}%`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-progress', progressObj);
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      logMain('Update downloaded:', info);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-downloaded', info);
      }
    });
  }
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
            margins: { top: 0, bottom: 0, left: 0, right: 0 }
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
            try { fs.unlinkSync(tempHtmlPath); } catch (e) { }
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

  function autoSyncFileToMobile(filename, buffer, fileType) {
    try {
      const publicDir = path.join(app.getPath('documents'), 'Comet-AI', 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      const publicPath = path.join(publicDir, filename);
      fs.writeFileSync(publicPath, buffer);
      console.log(`[Auto-Sync] Saved to public directory: ${publicPath}`);

      if (typeof wifiSyncService !== 'undefined' && wifiSyncService) {
        const fileUrl = `http://${wifiSyncService.getLocalIp()}:3999/${encodeURIComponent(filename)}`;
        wifiSyncService.sendToMobile({
          action: 'file-generated',
          name: filename,
          url: fileUrl,
          type: fileType
        });
        console.log(`[Auto-Sync] Sent notification to mobile: ${fileUrl}`);
      }
    } catch (err) {
      console.error(`[Auto-Sync] Failed to sync ${filename} to mobile:`, err);
    }
  }

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

    // 0. Load Branding Icon — shared helper
    const { iconBase64, iconMime } = loadBrandIcon();
    if (iconBase64) {
      logMain('Branding icon loaded for PDF.');
    } else {
      logMain('No branding icon found — using text fallback.');
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
            logMain(`Fetched image ${i + 1}/${remoteImages.length}: ${url}`);
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
      logMain('Executing printToPDF with Native Orchestration...');
      notifyAI('📄 Finalizing Branded neural document...');
      const pdfBuffer = await workerWindow.webContents.printToPDF({
        printBackground: true,
        displayHeaderFooter: false,
        margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
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

      // Auto-sync to mobile
      autoSyncFileToMobile(filename, pdfBuffer, 'pdf');

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
      try { if (tempHtmlPath && fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath); } catch (e) { }

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
      try { if (tempHtmlPath && fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath); } catch (e) { }
    }
  });

  // Python availability check (for optional flows; generation does not require it)
  ipcMain.handle('check-python-available', async () => pythonAvailable);


  // --- END OF PDF ENGINE ---

  // PPTX generation (JS-only, .dmg safe)
  ipcMain.handle('generate-pptx', async (event, payload = {}) => {
    const log = (msg) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pptx-generation-log', `[PPTX] ${msg}`);
      }
    };
    try {
      log('Initializing PPTX engine...');
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('pptx-generation-progress', 10);
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';
      pptx.title = payload.title || 'Presentation';
      pptx.author = payload.author || 'Comet-AI';
      pptx.subject = payload.subtitle || '';
      const { iconBase64 } = loadBrandIcon();
      const title = payload.title || 'Slides';
      const subtitle = payload.subtitle || '';
      log(`Applying template palette: ${payload.template || 'professional'}`);
      const palette = templatePalette(payload.template || 'professional');

      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('pptx-generation-progress', 20);
      // GOD-TIER COVER SLIDE
      log('Creating Cover Slide...');
      cover.background = { color: palette.bg };

      // Top accent bar
      cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.15, fill: { color: palette.accent } });

      // Large branded logo
      if (iconBase64) {
        cover.addImage({ data: `data:image/png;base64,${iconBase64}`, x: 4.25, y: 1.0, w: 1.5, h: 1.5 });
      }

      // Title with gradient-like effect (large white text)
      cover.addText(title, {
        x: 0.5, y: 2.8, w: 9, h: 1.2,
        fontSize: 44, bold: true, color: 'FFFFFF',
        align: 'center', fontFace: 'Arial'
      });

      // Subtitle
      if (subtitle) {
        cover.addText(subtitle, {
          x: 0.5, y: 3.9, w: 9, h: 0.6,
          fontSize: 22, color: palette.accent, align: 'center', fontFace: 'Arial'
        });
      }

      // Author and date
      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      if (payload.author) {
        cover.addText(`by ${payload.author}`, {
          x: 0.5, y: 4.6, w: 9, h: 0.4,
          fontSize: 16, color: 'AAAAAA', align: 'center'
        });
      }
      cover.addText(dateStr, {
        x: 0.5, y: 5.0, w: 9, h: 0.4,
        fontSize: 14, color: '888888', align: 'center'
      });

      // Bottom accent bar
      cover.addShape(pptx.ShapeType.rect, { x: 0, y: 5.5, w: 10, h: 0.1, fill: { color: palette.accent } });

      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('pptx-generation-progress', 40);
      log('Adding content slides...');
      cover.addShape(pptx.ShapeType.rect, { x: 0, y: 5.475, w: 10, h: 0.15, fill: { color: palette.accent } });

      // Two-column content slides with enhanced layout
      const pages = normalizePages(payload);
      pages.forEach((page, pageIndex) => {
        const slide = pptx.addSlide();
        slide.background = { color: 'FFFFFF' };

        // Header bar with accent color
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.9, fill: { color: palette.accent } });

        // Slide title in header
        slide.addText(page.title || `Section ${pageIndex + 1}`, {
          x: 0.5, y: 0.15, w: 8, h: 0.6,
          fontSize: 26, bold: true, color: 'FFFFFF', fontFace: 'Arial', margin: 0
        });

        // Small logo in header
        if (iconBase64) {
          slide.addImage({ data: `data:image/png;base64,${iconBase64}`, x: 9.0, y: 0.15, w: 0.6, h: 0.6 });
        }

        // Determine layout based on content
        const hasImage = Array.isArray(page.images) && page.images.length > 0;
        const hasTable = (page.sections || []).some(s => Array.isArray(s.table) && s.table.length);

        let bodyY = 1.2;

        if (hasTable) {
          // Table-focused layout
          (page.sections || []).forEach((section, idx) => {
            if (section.title) {
              slide.addText(section.title, {
                x: 0.5, y: bodyY, w: 9, h: 0.5,
                fontSize: 18, bold: true, color: palette.accent
              });
              bodyY += 0.5;
            }

            if (Array.isArray(section.table) && section.table.length) {
              const tableData = section.table.map((r) =>
                (Array.isArray(r) ? r : []).map((c) => ({
                  text: c?.toString?.() || '',
                  options: { fill: { color: idx % 2 === 0 ? 'F8F9FA' : 'FFFFFF' } }
                }))
              );
              slide.addTable(tableData, {
                x: 0.5, y: bodyY, w: 9, h: 2.5,
                colW: [3, 3, 3],
                border: { pt: 0.5, color: 'DDDDDD' },
                fontFace: 'Arial',
                fontSize: 12,
              });
              bodyY += 2.8;
            }

            // Content below table
            if (section.content) {
              slide.addText(section.content, {
                x: 0.5, y: bodyY, w: 9, h: 1.5,
                fontSize: 14, color: '333333', valign: 'top'
              });
              bodyY += 1.8;
            }
          });
        } else if (hasImage) {
          // Two-column layout: text left, image right
          const first = page.images[0];
          const parsed = dataUrlToBuffer(first.src || '');
          if (parsed) {
            slide.addImage({
              data: `data:${parsed.mime};base64,${parsed.buffer.toString('base64')}`,
              x: 5.2, y: 1.1, w: 4.3, h: 3.2,
              shadow: { type: 'outer', blur: 3, offset: 2, angle: 45, opacity: 0.2 }
            });
          }

          // Content on left side
          const sectionBlocks = (page.sections || []).map((section) => {
            if (section.title) return `• ${section.title}\n  ${section.content || ''}`;
            return section.content || '';
          }).filter(Boolean);

          if (sectionBlocks.length) {
            slide.addText(sectionBlocks.join('\n\n'), {
              x: 0.5, y: 1.1, w: 4.5, h: 3.5,
              fontSize: 15, color: '333333', valign: 'top', lineSpacingMultiple: 1.3
            });
          }
        } else {
          // Full-width text layout
          (page.sections || []).forEach((section) => {
            if (section.title) {
              slide.addText(section.title, {
                x: 0.5, y: bodyY, w: 9, h: 0.5,
                fontSize: 20, bold: true, color: palette.accent
              });
              bodyY += 0.6;
            }

            const blocks = (section.content || '').split(/\n{2,}/).filter(Boolean);
            blocks.forEach((block) => {
              slide.addText(block.replace(/\n/g, ' '), {
                x: 0.5, y: bodyY, w: 9, h: 0.8,
                fontSize: 14, color: '444444', valign: 'top'
              });
              bodyY += 0.9;
            });
          });
        }

        // Watermark
        if (payload.watermark) {
          slide.addText(payload.watermark, {
            x: 0.8, y: 3.2, w: 8.5, h: 1,
            fontSize: 42, bold: true, color: 'EEEEEE', rotate: -22, align: 'center'
          });
        }

        // Footer with page number
        slide.addText(`${pageIndex + 2} / ${pages.length + 1}`, {
          x: 9, y: 5.2, w: 0.8, h: 0.3,
          fontSize: 10, color: 'AAAAAA', align: 'right'
        });
      });

      // ENHANCED IMAGES SLIDE
      if (Array.isArray(payload.images) && payload.images.length) {
        const imgSlide = pptx.addSlide();
        imgSlide.background = { color: 'FFFFFF' };

        // Header
        imgSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.9, fill: { color: palette.accent } });
        imgSlide.addText('Gallery', {
          x: 0.5, y: 0.15, w: 8, h: 0.6,
          fontSize: 26, bold: true, color: 'FFFFFF', margin: 0
        });

        // Grid of images (2x2)
        let x = 0.5, y = 1.2;
        payload.images.slice(0, 4).forEach((img, idx) => {
          if (!img?.src) return;
          const parsed = dataUrlToBuffer(img.src);
          if (!parsed) return;
          imgSlide.addImage({
            data: `data:${parsed.mime};base64,${parsed.buffer.toString('base64')}`,
            x, y, w: 4.3, h: 2.8,
            shadow: { type: 'outer', blur: 2, offset: 1, angle: 45, opacity: 0.15 }
          });
          x += 4.7;
          if ((idx + 1) % 2 === 0) { x = 0.5; y += 3.1; }
        });
      }

      // THANK YOU SLIDE
      const thankYou = pptx.addSlide();
      thankYou.background = { color: palette.bg };
      thankYou.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.15, fill: { color: palette.accent } });

      if (iconBase64) {
        thankYou.addImage({ data: `data:image/png;base64,${iconBase64}`, x: 4.25, y: 1.5, w: 1.5, h: 1.5 });
      }
      thankYou.addText('Thank You', {
        x: 0.5, y: 3.2, w: 9, h: 1,
        fontSize: 48, bold: true, color: 'FFFFFF', align: 'center'
      });
      thankYou.addText('Questions & Discussion', {
        x: 0.5, y: 4.2, w: 9, h: 0.5,
        fontSize: 20, color: palette.accent, align: 'center'
      });
      thankYou.addShape(pptx.ShapeType.rect, { x: 0, y: 5.475, w: 10, h: 0.15, fill: { color: palette.accent } });

      const buffer = await pptx.write('nodebuffer');
      const downloads = path.join(os.homedir(), 'Downloads');
      const safeTitle = (title || 'slides').replace(/[^a-z0-9]/gi, '_');
      const filename = `${safeTitle}_${Math.floor(Date.now() / 1000)}.pptx`;
      const fullPath = path.join(downloads, filename);
      fs.writeFileSync(fullPath, buffer);

      // Auto-sync to mobile
      autoSyncFileToMobile(filename, buffer, 'pptx');

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-started', { name: filename, path: fullPath });
        mainWindow.webContents.send('download-complete', { name: filename, path: fullPath });
      }

      return { success: true, filePath: fullPath, pythonAvailable };
    } catch (err) {
      console.error('[PPTX] Generation failed:', err);
      return { success: false, error: err.message };
    }
  });

  // DOCX generation (JS-only)
  ipcMain.handle('generate-docx', async (event, payload = {}) => {
    try {
      const { iconBase64 } = loadBrandIcon();
      const iconBuffer = iconBase64 ? Buffer.from(iconBase64, 'base64') : null;

      const children = [];
      const title = payload.title || 'Report';
      const subtitle = payload.subtitle || '';
      const palette = templatePalette(payload.template || 'professional');
      const bodyColor = palette.text.replace('#', '');

      children.push(new Paragraph({ text: title, heading: HeadingLevel.TITLE }));
      if (subtitle) children.push(new Paragraph({ text: subtitle, heading: HeadingLevel.HEADING_2 }));
      if (payload.author) children.push(new Paragraph({ text: `Author: ${payload.author}` }));

      const pages = normalizePages(payload);
      pages.forEach((page) => {
        children.push(new Paragraph({ text: page.title || 'Section', heading: HeadingLevel.HEADING_1 }));
        (page.sections || []).forEach((section) => {
          if (section.title) children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_2 }));
          // Body text with basic styling
          const blocks = (section.content || '').split(/\n{2,}/).filter(Boolean);
          if (blocks.length === 0) {
            children.push(new Paragraph({ children: toStyledRuns(section.content || '', { color: bodyColor }) }));
          } else {
            blocks.forEach((block) => {
              const lines = block.split('\n').filter(Boolean);
              lines.forEach((line) => {
                children.push(new Paragraph({ children: toStyledRuns(line, { color: bodyColor }), spacing: { after: 120 } }));
              });
            });
          }

          // Tables
          if (Array.isArray(section.table) && section.table.length) {
            const tableRows = section.table.map((row) =>
              new TableRow({
                children: (Array.isArray(row) ? row : []).map((cell) =>
                  new TableCell({
                    width: { size: 9000 / Math.max(1, row.length), type: WidthType.DXA },
                    children: [new Paragraph({ children: toStyledRuns(cell?.toString?.() || '', { color: bodyColor }) })],
                  })
                ),
              })
            );
            children.push(new Table({
              width: { size: 9360, type: WidthType.DXA },
              rows: tableRows,
            }));
          }
        });
      });

      if (Array.isArray(payload.images)) {
        payload.images.slice(0, 5).forEach((img) => {
          const parsed = dataUrlToBuffer(img?.src);
          if (!parsed) return;
          children.push(new Paragraph({ children: [new TextRun(img?.caption || 'Image')] }));
          children.push(new Paragraph({
            children: [
              new ImageRun({
                data: parsed.buffer,
                transformation: { width: 450, height: 300 },
                type: (parsed.mime?.split('/')[1] || 'png'),
              })
            ],
          }));
        });
      }

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              size: {
                width: 12240,
                height: 15840,
              },
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
              orientation: PageOrientation.PORTRAIT,
            },
          },
          headers: {
            default: new Header({
              children: [
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 12, color: palette.accent.replace('#', '') },
                    bottom: { style: BorderStyle.SINGLE, size: 12, color: palette.accent.replace('#', '') },
                    left: { style: BorderStyle.NONE, size: 0 },
                    right: { style: BorderStyle.NONE, size: 0 },
                    insideHorizontal: { style: BorderStyle.NONE, size: 0 },
                    insideVertical: { style: BorderStyle.NONE, size: 0 },
                  },
                  rows: [
                    new TableRow({
                      children: [
                        new TableCell({
                          width: { size: 20, type: WidthType.PERCENTAGE },
                          verticalAlign: VerticalAlign.CENTER,
                          borders: {
                            top: { style: BorderStyle.NONE, size: 0 },
                            bottom: { style: BorderStyle.NONE, size: 0 },
                            left: { style: BorderStyle.NONE, size: 0 },
                            right: { style: BorderStyle.NONE, size: 0 },
                          },
                          children: [
                            new Paragraph({
                              children: iconBuffer ? [
                                new ImageRun({
                                  data: iconBuffer,
                                  transformation: { width: 32, height: 32 },
                                  type: 'png',
                                }),
                              ] : [],
                            }),
                          ],
                        }),
                        new TableCell({
                          width: { size: 50, type: WidthType.PERCENTAGE },
                          verticalAlign: VerticalAlign.CENTER,
                          borders: {
                            top: { style: BorderStyle.NONE, size: 0 },
                            bottom: { style: BorderStyle.NONE, size: 0 },
                            left: { style: BorderStyle.NONE, size: 0 },
                            right: { style: BorderStyle.NONE, size: 0 },
                          },
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({ text: 'Comet-AI', bold: true, size: 28, color: palette.accent.replace('#', '') }),
                              ],
                            }),
                            new Paragraph({
                              children: [
                                new TextRun({ text: 'Intelligent Automation Platform', size: 18, color: '666666', italics: true }),
                              ],
                            }),
                          ],
                        }),
                        new TableCell({
                          width: { size: 30, type: WidthType.PERCENTAGE },
                          verticalAlign: VerticalAlign.CENTER,
                          horizontalAlign: AlignmentType.RIGHT,
                          borders: {
                            top: { style: BorderStyle.NONE, size: 0 },
                            bottom: { style: BorderStyle.NONE, size: 0 },
                            left: { style: BorderStyle.NONE, size: 0 },
                            right: { style: BorderStyle.NONE, size: 0 },
                          },
                          children: [
                            new Paragraph({
                              alignment: AlignmentType.RIGHT,
                              children: [
                                new TextRun({ text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), size: 18, color: '888888' }),
                              ],
                            }),
                            new Paragraph({
                              alignment: AlignmentType.RIGHT,
                              children: [
                                new TextRun({ text: payload.author ? `By: ${payload.author}` : '', size: 16, color: '999999' }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
                new Paragraph({ spacing: { before: 100, after: 100 } }),
              ],
            })
          },
          footers: {
            default: new Footer({
              children: [
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 6, color: palette.accent.replace('#', '') },
                    bottom: { style: BorderStyle.NONE, size: 0 },
                    left: { style: BorderStyle.NONE, size: 0 },
                    right: { style: BorderStyle.NONE, size: 0 },
                    insideHorizontal: { style: BorderStyle.NONE, size: 0 },
                    insideVertical: { style: BorderStyle.NONE, size: 0 },
                  },
                  rows: [
                    new TableRow({
                      children: [
                        new TableCell({
                          width: { size: 33, type: WidthType.PERCENTAGE },
                          verticalAlign: VerticalAlign.CENTER,
                          borders: {
                            top: { style: BorderStyle.NONE, size: 0 },
                            bottom: { style: BorderStyle.NONE, size: 0 },
                            left: { style: BorderStyle.NONE, size: 0 },
                            right: { style: BorderStyle.NONE, size: 0 },
                          },
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({ text: 'Comet-AI', size: 16, bold: true, color: palette.accent.replace('#', '') }),
                                new TextRun({ text: ' | Confidential', size: 16, color: '999999' }),
                              ],
                            }),
                          ],
                        }),
                        new TableCell({
                          width: { size: 34, type: WidthType.PERCENTAGE },
                          verticalAlign: VerticalAlign.CENTER,
                          horizontalAlign: AlignmentType.CENTER,
                          borders: {
                            top: { style: BorderStyle.NONE, size: 0 },
                            bottom: { style: BorderStyle.NONE, size: 0 },
                            left: { style: BorderStyle.NONE, size: 0 },
                            right: { style: BorderStyle.NONE, size: 0 },
                          },
                          children: [
                            new Paragraph({
                              alignment: AlignmentType.CENTER,
                              children: [
                                new TextRun({ text: 'Page ', size: 18, color: '666666' }),
                                new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '666666' }),
                                new TextRun({ text: ' of ', size: 18, color: '666666' }),
                                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '666666' }),
                              ],
                            }),
                          ],
                        }),
                        new TableCell({
                          width: { size: 33, type: WidthType.PERCENTAGE },
                          verticalAlign: VerticalAlign.CENTER,
                          horizontalAlign: AlignmentType.RIGHT,
                          borders: {
                            top: { style: BorderStyle.NONE, size: 0 },
                            bottom: { style: BorderStyle.NONE, size: 0 },
                            left: { style: BorderStyle.NONE, size: 0 },
                            right: { style: BorderStyle.NONE, size: 0 },
                          },
                          children: [
                            new Paragraph({
                              alignment: AlignmentType.RIGHT,
                              children: [
                                new TextRun({ text: title || 'Document', size: 16, color: '888888', italics: true }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            })
          },
          children,
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      const downloads = path.join(os.homedir(), 'Downloads');
      const safeTitle = (title || 'report').replace(/[^a-z0-9]/gi, '_');
      const filename = `${safeTitle}_${Math.floor(Date.now() / 1000)}.docx`;
      const fullPath = path.join(downloads, filename);
      fs.writeFileSync(fullPath, buffer);

      // Auto-sync to mobile
      autoSyncFileToMobile(filename, buffer, 'docx');

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-started', { name: filename, path: fullPath });
        mainWindow.webContents.send('download-complete', { name: filename, path: fullPath });
      }

      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('docx-generation-progress', 100);
      log(`✅ DOCX Generated: ${filename}`);
      return { success: true, filePath: fullPath, pythonAvailable };
    } catch (err) {
      console.error('[DOCX] Generation failed:', err);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('docx-generation-log', `❌ Error: ${err.message}`);
      }
      return { success: false, error: err.message };
    }
  });

  // XLSX generation (using xlsx library - NO external dependencies)
  ipcMain.handle('generate-xlsx', async (event, payload = {}) => {
    const log = (msg) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('xlsx-generation-log', `[XLSX] ${msg}`);
      }
    };
    try {
      log('Initializing Professional Excel Engine...');
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('xlsx-generation-progress', 10);
      
      const XLSX = require('xlsx');
      const title = payload.title || 'Spreadsheet Report';
      const pages = normalizePages(payload);
      const downloads = path.join(os.homedir(), 'Downloads');
      const safeTitle = title.replace(/[^a-z0-9]/gi, '_');
      const filename = `${safeTitle}_${Math.floor(Date.now() / 1000)}.xlsx`;
      const fullPath = path.join(downloads, filename);

      log(`Processing ${pages.length} pages...`);
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('xlsx-generation-progress', 30);

      const workbook = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([[]]);
      XLSX.utils.book_append_sheet(workbook, ws, (title || 'Report').substring(0, 31));

      const styles = {
        header: { font: { bold: true, color: { rgb: 'FFFFFF' }, size: 18 }, fill: { fgColor: { rgb: '0F172A' }, bgColor: { rgb: '0F172A' } }, alignment: { horizontal: 'center' } },
        section: { font: { bold: true, color: { rgb: '334155' }, size: 12 }, fill: { fgColor: { rgb: 'F1F5F9' }, bgColor: { rgb: 'F1F5F9' } }, border: [{ bottom: { style: 'medium', color: { rgb: '94A3B8' } } }] },
        tableHeader: { font: { bold: true, color: { rgb: 'FFFFFF' }, size: 10 }, fill: { fgColor: { rgb: '475569' }, bgColor: { rgb: '475569' } }, alignment: { horizontal: 'center' } },
        rowAlt: { font: { size: 10 }, fill: { fgColor: { rgb: 'F8FAFC' }, bgColor: { rgb: 'F8FAFC' } } },
        normal: { font: { size: 10 } }
      };

      let row = 1;
      const setCell = (r, c, val, style = 'normal') => {
        const cell = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
        ws[cell] = { v: val };
        if (styles[style]) ws[cell].s = styles[style];
      };
      const mergeCells = (startR, startC, endR, endC) => {
        ws[`!merges`] = ws[`!merges`] || [];
        ws[`!merges`].push(XLSX.utils.encode_range({ s: { r: startR - 1, c: startC - 1 }, e: { r: endR - 1, c: endC - 1 } }));
      };
      const colWidths = {};

      row = 1;
      const maxCol = 10;
      mergeCells(row, 1, row, maxCol);
      setCell(row, 1, title, 'header');
      row += 2;

      for (const page of pages) {
        if (page.title) {
          mergeCells(row, 1, row, maxCol);
          setCell(row, 1, page.title, 'section');
          row += 2;
        }
        for (const section of page.sections || []) {
          if (section.title) {
            setCell(row, 1, section.title);
            ws[XLSX.utils.encode_cell({ r: row - 1, c: 0 })].s = { font: { bold: true, size: 11 } };
            if (!section.content) row++;
          }
          if (section.content) {
            const content = section.content;
            if (content.includes('|') && content.includes('--')) {
              const lines = content.split('\n').filter(l => l.trim());
              const tableRows = [];
              for (const line of lines) {
                if (line.includes('|') && !line.match(/^[\s|:-]+$/)) {
                  const parts = line.split('|').filter(p => p.trim());
                  if (parts.length) tableRows.push(parts);
                }
              }
              if (tableRows.length) {
                for (let ri = 0; ri < tableRows.length; ri++) {
                  for (let ci = 0; ci < tableRows[ri].length; ci++) {
                    const val = tableRows[ri][ci];
                    colWidths[ci + 1] = Math.max(colWidths[ci + 1] || 10, val.length + 4);
                    setCell(row, ci + 1, val, ri === 0 ? 'tableHeader' : (ri % 2 === 0 ? 'rowAlt' : 'normal'));
                  }
                  row++;
                }
                row++;
              }
            } else {
              const txtLines = content.split('\n');
              for (const tl of txtLines) {
                if (tl.trim()) {
                  setCell(row, 1, tl);
                  row++;
                }
              }
              row++;
            }
          }
        }
      }

      for (const colIdx in colWidths) {
        ws['!cols'] = ws['!cols'] || [];
        ws['!cols'].push({ wch: Math.min(colWidths[colIdx], 60) });
      }

      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('xlsx-generation-progress', 70);
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      fs.writeFileSync(fullPath, buffer);

      log('✅ Excel Engine complete.');
      if (mainWindow && !mainWindow.isDestroyed()) {
        autoSyncFileToMobile(filename, buffer, 'xlsx');
        mainWindow.webContents.send('download-started', { name: filename, path: fullPath });
        mainWindow.webContents.send('download-complete', { name: filename, path: fullPath });
        mainWindow.webContents.send('xlsx-generation-progress', 100);
      }

      log(`✅ Done: ${filename}`);
      return { success: true, filePath: fullPath };
    } catch (err) {
      console.error('[XLSX] Failure:', err);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('xlsx-generation-log', `❌ Critical Error: ${err.message}`);
      }
      return { success: false, error: err.message };
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

  // createWindow was moved earlier for faster startup feedback

  // Load all plugins on startup
  (async () => {
    try {
      await pluginManager.loadAllPlugins();
      console.log(`[PluginManager] Loaded ${pluginManager.getPlugins().length} plugins.`);
    } catch (err) {
      console.error('[PluginManager] Failed to load plugins:', err);
    }
  })();

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
  
  // Load immediately
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
      console.log('[Main] CometAiEngine initialized.');

      robotService = new RobotService(permissionStore);
      console.log(`[Main] RobotService initialized (available: ${robotService.isAvailable}).`);

      commandExecutor.setRobotService(robotService);
      commandExecutor.setCometAiEngine(cometAiEngine);
      commandExecutor.setNetworkManager(networkSecurityManager);
      commandExecutor.registerHandlers();
      console.log('[Main] CommandExecutor IPC handlers registered.');

      // Tesseract is LAZY - only loads when OCR is needed
      tesseractOcrService = new TesseractOcrService();
      console.log('[Main] TesseractOcrService ready (lazy init on first use).');

      // ScreenVision is LAZY - only loads when find-and-click is needed
      screenVisionService = new ScreenVisionService(cometAiEngine);
      console.log('[Main] ScreenVisionService ready (lazy init).');

      // RAG is LAZY - only loads when context retrieval is needed
      // Removed: await ragService.init() - now lazy
      ragService = new RagService();
      console.log('[Main] RagService ready (lazy init on first query).');

      // Voice is LAZY - only loads when voice features are used
      voiceService = new VoiceService();
      console.log('[Main] VoiceService ready (lazy init on voice request).');

      // Flutter Bridge - LAZY - only starts on demand
      flutterBridge = new FlutterBridgeServer(cometAiEngine, tesseractOcrService);
      // flutterBridge.start(9876) - now lazy

      // MCP Servers - LAZY - only start on demand  
      fileSystemMcp = new FileSystemMcpServer(permissionStore);
      nativeAppMcp = new NativeAppMcpServer(permissionStore);
      console.log('[Main] MCP Desktop servers ready (lazy start).');

      workflowRecorder = new WorkflowRecorder();
      console.log('[Main] WorkflowRecorder ready (lazy init).');

      popSearch = popSearchService;
      // popSearch.initialize(mainWindow) - now lazy
    } catch (e) {
      console.error('[Main] Desktop automation services init error:', e.message);
    }
  })();

  // Handle deep link if launched with one
  const launchUrl = process.argv.find(arg =>
    arg.startsWith(`${PROTOCOL}://`) ||
    arg.startsWith(`${RAYCAST_PROTOCOL}://`) ||
    arg.startsWith('comet://')
  );
  if (launchUrl && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.once('did-finish-load', () => {
      handleDeepLink(launchUrl);
    });
  }

  migrateLegacyAuthSession();

  // Load persistent auth token on startup from secure storage
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.once('did-finish-load', () => {
      const savedSession = getSecureAuthSession();
      if (savedSession) {
        if (savedSession.token) {
          mainWindow.webContents.send('load-auth-token', savedSession.token);
        }
        if (savedSession.user) {
          mainWindow.webContents.send('load-user-info', savedSession.user);
        }
        mainWindow.webContents.send('load-auth-session', {
          ...savedSession,
          storageBackend: getAuthStorageBackend(),
        });
        console.log('[Main] Loaded and sent persistent auth session to renderer.');
      }
    });
  }

  // Handle successful authentication from external sources (e.g. landing page)
  ipcMain.on('set-auth-token', (event, token) => {
    console.log('[Main] Setting auth token');
    const currentSession = getSecureAuthSession() || {};
    saveSecureAuthSession({
      ...currentSession,
      token,
      savedAt: Date.now(),
    });
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

  if (isMac) {
    const nativeMacUiApp = express();
    nativeMacUiApp.use(bodyParser.json({ limit: '1mb' }));

    nativeMacUiApp.use((req, res, next) => {
      const headerToken = req.get('X-Comet-Native-Token');
      const queryToken = req.query?.token;
      if (headerToken === nativeMacUiToken || queryToken === nativeMacUiToken) {
        next();
        return;
      }
      res.status(401).json({ success: false, error: 'Unauthorized native panel request.' });
    });

    nativeMacUiApp.get('/native-mac-ui/state', (req, res) => {
      const mode = normalizeMacNativePanelMode(`${req.query?.mode || 'sidebar'}`);
      res.json({
        success: true,
        state: {
          ...createNativeMacUiSnapshot(),
          mode,
        },
      });
    });

    nativeMacUiApp.post('/native-mac-ui/preferences', (req, res) => {
      try {
        const preferences = setMacNativeUiPreferences(req.body || {});
        res.json({ success: true, preferences });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    nativeMacUiApp.post('/native-mac-ui/settings/open', (req, res) => {
      try {
        const target = normalizeSettingsSection(`${req.body?.target || 'profile'}`);
        openSettingsSection(target, { preferElectron: true });
        res.json({ success: true, target });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    nativeMacUiApp.post('/native-mac-ui/prompt', async (req, res) => {
      const prompt = `${req.body?.prompt || ''}`.trim();
      if (!prompt) {
        res.status(400).json({ success: false, error: 'Missing prompt.' });
        return;
      }

      const payload = {
        prompt,
        source: req.body?.source || 'swiftui',
      };

      try {
        await deliverNativeMacUiEvent('native-mac-ui-submit-prompt', payload);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
        return;
      }

      res.json({ success: true });
    });

    // --- CLI TERMINAL CONTROL ENDPOINTS ---
    nativeMacUiApp.post('/native-mac-ui/cli/ask', async (req, res) => {
      const prompt = `${req.body?.prompt || ''}`.trim();
      if (!prompt) {
        res.status(400).json({ success: false, error: 'Missing prompt.' });
        return;
      }

      // Set headers for streaming text
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');

      try {
        const requestId = `cli-${Date.now()}`;
        
        // Relay to AIChatSidebar via IPC
        const target = getTopWindow();
        if (!target) {
          res.write(JSON.stringify({ error: 'Browser window not available.' }));
          res.end();
          return;
        }

        const onStreamPart = (event, part) => {
          if (part.type === 'text-delta' && part.textDelta) {
            res.write(JSON.stringify({ textDelta: part.textDelta }) + '\n');
          } else if (part.type === 'error') {
            res.write(JSON.stringify({ error: part.error }) + '\n');
          } else if (part.type === 'finish') {
            ipcMain.removeListener('llm-chat-stream-part', onStreamPart);
            res.end();
          }
        };

        ipcMain.on('llm-chat-stream-part', onStreamPart);
        
        // Trigger the prompt in the sidebar
        target.webContents.send('native-mac-ui-submit-prompt', {
          prompt,
          source: 'terminal',
          requestId
        });

        req.on('close', () => {
          ipcMain.removeListener('llm-chat-stream-part', onStreamPart);
        });

      } catch (error) {
        res.write(JSON.stringify({ error: error.message }));
        res.end();
      }
    });

    nativeMacUiApp.post('/native-mac-ui/cli/search', async (req, res) => {
      const query = `${req.body?.prompt || ''}`.trim();
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      
      try {
        const searchResults = await cometAiEngine.search(query);
        res.write(JSON.stringify({ textDelta: `🔍 Search Results for: ${query}\n\n` }));
        res.write(JSON.stringify({ textDelta: searchResults }) + '\n');
        res.end();
      } catch (error) {
        res.write(JSON.stringify({ error: error.message }));
        res.end();
      }
    });

    nativeMacUiApp.post('/native-mac-ui/screenshot', async (req, res) => {
      try {
        if (!mainWindow || mainWindow.isDestroyed()) {
          res.status(400).json({ success: false, error: 'Browser not running' });
          return;
        }

        const screenshot = await mainWindow.webContents.capturePage();
        const fileName = `Comet-Screenshot-${Date.now()}.png`;
        const filePath = path.join(app.getPath('downloads'), fileName);
        fs.writeFileSync(filePath, screenshot.toPNG());

        res.json({ success: true, path: filePath });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    nativeMacUiApp.all('/native-mac-ui/summarize-page', async (req, res) => {
      try {
        if (!mainWindow || mainWindow.isDestroyed()) {
          res.status(400).json({ success: false, error: 'Browser not running' });
          return;
        }

        const view = tabViews.get(activeTabId);
        if (!view) {
          res.status(400).json({ success: false, error: 'No active tab' });
          return;
        }

        const domContent = await view.webContents.executeJavaScript(`
          (() => {
            const clone = document.body.cloneNode(true);
            clone.querySelectorAll('script, style, nav, footer, header, noscript, svg, .ads, .advertisement, .sidebar, .menu, .nav').forEach(e => e.remove());
            return clone.innerText.replace(/\\s+/g, ' ').substring(0, 5000);
          })()
        `);

        res.json({ success: true, content: domContent });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    nativeMacUiApp.post('/native-mac-ui/conversations/action', async (req, res) => {
      const action = `${req.body?.action || ''}`.trim();
      const id = req.body?.id ? `${req.body.id}` : null;
      if (!['new', 'load', 'delete'].includes(action)) {
        res.status(400).json({ success: false, error: 'Unsupported conversation action.' });
        return;
      }
      if ((action === 'load' || action === 'delete') && !id) {
        res.status(400).json({ success: false, error: 'Missing conversation id.' });
        return;
      }

      try {
        await deliverNativeMacUiEvent('native-mac-ui-conversation-action', { action, id });
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    nativeMacUiApp.post('/native-mac-ui/export', async (req, res) => {
      const format = `${req.body?.format || ''}`.trim().toLowerCase();
      if (!['text', 'pdf'].includes(format)) {
        res.status(400).json({ success: false, error: 'Unsupported export format.' });
        return;
      }

      try {
        await deliverNativeMacUiEvent('native-mac-ui-export', { format });
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    nativeMacUiApp.post('/native-mac-ui/panels/open', async (req, res) => {
      const mode = normalizeMacNativePanelMode(`${req.body?.mode || 'sidebar'}`);
      try {
        const result = await nativeMacPanelManager.show(mode, {
          relaunchIfRunning: !!req.body?.relaunchIfRunning,
        });
        res.json({ success: true, ...result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    nativeMacUiApp.post('/native-mac-ui/panels/close', (req, res) => {
      const mode = normalizeMacNativePanelMode(`${req.body?.mode || 'sidebar'}`);
      const result = nativeMacPanelManager.close(mode);
      res.json(result);
    });

    nativeMacUiApp.post('/native-mac-ui/clipboard/copy', (req, res) => {
      const text = `${req.body?.text || ''}`;
      clipboard.writeText(text);
      res.json({ success: true });
    });

    nativeMacUiApp.post('/native-mac-ui/clipboard/clear', (req, res) => {
      nativeMacUiState.clipboardItems = [];
      sendToActiveWindow('native-mac-ui-clear-clipboard');
      res.json({ success: true });
    });

    nativeMacUiApp.post('/native-mac-ui/downloads/open', async (req, res) => {
      const filePath = `${req.body?.path || ''}`;
      if (!filePath) {
        res.status(400).json({ success: false, error: 'Missing download path.' });
        return;
      }
      try {
        await shell.openPath(filePath);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    nativeMacUiApp.post('/native-mac-ui/downloads/reveal', async (req, res) => {
      const filePath = `${req.body?.path || ''}`;
      if (!filePath) {
        res.status(400).json({ success: false, error: 'Missing download path.' });
        return;
      }
      try {
        shell.showItemInFolder(filePath);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    nativeMacUiApp.post('/native-mac-ui/approval/respond', (req, res) => {
      const requestId = `${req.body?.requestId || ''}`;
      const allowed = !!req.body?.allowed;
      const deviceUnlockValidated = !!req.body?.deviceUnlockValidated;
      if (!requestId) {
        res.status(400).json({ success: false, error: 'Missing requestId.' });
        return;
      }
      const resolver = shellApprovalResolvers.get(requestId);
      if (!resolver) {
        res.status(404).json({ success: false, error: 'Approval request expired.' });
        return;
      }
      nativeMacUiState.pendingApproval = null;
      shellApprovalResolvers.delete(requestId);
      resolver({ allowed, deviceUnlockValidated });
      res.json({ success: true });
    });

    nativeMacUiApp.post('/native-mac-ui/focus-electron', (req, res) => {
      const target = getTopWindow();
      if (target && !target.isDestroyed()) {
        target.show();
        target.focus();
        res.json({ success: true });
        return;
      }

      res.json({ success: false, error: 'No active Comet window found.' });
    });

    nativeMacUiServer = nativeMacUiApp.listen(nativeMacUiPort, '127.0.0.1', () => {
      console.log(`[MacNativeUI] Bridge listening at http://127.0.0.1:${nativeMacUiPort}`);
    });
  }

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

        // Check if there's a pending power action
        if (pendingPowerActions.has(configId)) {
          const pendingAction = pendingPowerActions.get(configId);
          pendingAction.resolve({ success: true, approved: true });
          pendingPowerActions.delete(configId);
        }

        if (
          nativeMacUiState.pendingApproval &&
          nativeMacUiState.pendingApproval.approvalToken === configId
        ) {
          nativeMacUiState.pendingApproval = {
            ...nativeMacUiState.pendingApproval,
            mobileApproved: true,
            approvedPin: pin,
          };
          nativeMacUiState.updatedAt = Date.now();
        }
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
        const action = args.action;
        const prompt = args.prompt;
        const promptId = args.promptId || commandId;

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
        } else if (action === 'get-settings') {
          // Send all app settings to mobile
          const currentSettings = {
            llm_provider: store.get('ai_provider') || 'google',
            llm_model: store.get('gemini_model') || 'gemini-2.0-flash',
            ollama_url: store.get('ollama_base_url') || 'http://localhost:11434',
            temperature: store.get('llm_temperature') || 0.7,
            theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
            auto_approve_low: store.get('auto_approve_low_risk') || true,
            auto_approve_mid: store.get('auto_approve_mid_risk') || false,
            run_in_background: store.get('run_in_background_automation') || true,
            notifications_enabled: store.get('desktop_notifications') || true,
            sync_mode: 'local_cloud',
          };
          sendResponse({ success: true, settings: currentSettings });
        } else if (action === 'update-setting') {
          const { key, value } = args;
          console.log(`[WiFi-Sync] Updating setting: ${key} = ${value}`);

          if (key === 'theme') {
            nativeTheme.themeSource = value;
          } else {
            // Map mobile setting keys to desktop store keys
            const keyMap = {
              'llm_provider': 'ai_provider',
              'llm_model': 'gemini_model', // Dynamic pick later
              'temperature': 'llm_temperature',
              'auto_approve_low': 'auto_approve_low_risk',
              'auto_approve_mid': 'auto_approve_mid_risk',
            };
            const storeKey = keyMap[key] || key;
            store.set(storeKey, value);
          }
          sendResponse({ success: true });
        } else if (action === 'sync-tasks') {
          try {
            const automationManager = require('./src/lib/automation-manager.js');
            const tasks = automationManager.getAllTasks();
            sendResponse({ success: true, tasks: tasks || [] });
          } catch (err) {
            sendResponse({ success: false, error: 'Automation manager unavailable' });
          }
        } else if (action === 'toggle-task') {
          const { taskId } = args;
          ipcMain.emit('automation:toggle-task', { sender: { send: () => { } } }, taskId);
          sendResponse({ success: true });
        } else if (action === 'run-task') {
          const { taskId } = args;
          ipcMain.emit('automation:run-task', { sender: { send: () => { } } }, taskId);
          sendResponse({ success: true });
        } else if (action === 'delete-task') {
          const { taskId } = args;
          ipcMain.emit('automation:delete-task', { sender: { send: () => { } } }, taskId);
          sendResponse({ success: true });
        } else if (action === 'shutdown' || action === 'restart' || action === 'sleep' || action === 'lock') {
          // ALWAYS require QR verification for power/restart actions - even from mobile
          const powerAction = action;
          console.log(`[WiFi-Sync] Power action requested: ${powerAction} - requiring QR approval`);

          const actionDescriptions = {
            shutdown: 'Shutdown Desktop',
            restart: 'Restart Desktop',
            sleep: 'Sleep Desktop',
            lock: 'Lock Screen'
          };

          const { qrImage, pin, token } = await generateShellApprovalQR(actionDescriptions[powerAction] || powerAction);
          wifiSyncService.sendToMobile({
            action: 'power-approval-qr',
            commandId: token,
            pin: pin,
            powerAction: powerAction,
            qrData: qrImage,
          });

          // Wait for mobile approval, then execute the power action
          const actionResult = await new Promise(async (resolve) => {
            const timeout = setTimeout(() => {
              pendingPowerActions.delete(token);
              resolve({ success: false, error: 'Power action approval timeout (2 minutes)' });
            }, 120000);

            pendingPowerActions.set(token, {
              action: powerAction,
              resolve: (result) => {
                clearTimeout(timeout);
                pendingPowerActions.delete(token);
                resolve(result);
              }
            });
          });

          // Execute the power action after approval
          if (actionResult.success) {
            try {
              const { exec } = require('child_process');
              const actionCommands = {
                shutdown: 'osascript -e \'tell app "System Events" to shut down\'',
                restart: 'osascript -e \'tell app "System Events" to restart\'',
                sleep: 'pmset sleepnow',
                lock: '/System/Library/CoreServices/Menu\ Extras/User.menu/Contents/Resources/CGSession -suspend'
              };

              exec(actionCommands[powerAction], (err, stdout, stderr) => {
                if (err) {
                  sendResponse({ success: false, error: err.message });
                } else {
                  sendResponse({ success: true, output: `Power action ${powerAction} executed` });
                }
              });
            } catch (err) {
              sendResponse({ success: false, error: err.message });
            }
          } else {
            sendResponse({ success: false, error: actionResult.error || 'Power action not approved' });
          }
        } else {
          sendResponse({ success: false, error: `Unknown action: ${action}` });
        }
      } else {
        sendResponse({ success: false, error: `Command ${command} not implemented` });
      }
    });

    wifiSyncService.on('client-connected', (payload = {}) => {
      if (mainWindow) {
        mainWindow.webContents.send('wifi-sync-status', {
          connected: wifiSyncService.getConnectedClients().length > 0,
        });
        mainWindow.webContents.send('wifi-sync-devices-updated', payload.devices || wifiSyncService.getKnownDevices());
      }
    });

    wifiSyncService.on('client-disconnected', (payload = {}) => {
      if (mainWindow) {
        mainWindow.webContents.send('wifi-sync-status', {
          connected: wifiSyncService.getConnectedClients().length > 0,
        });
        mainWindow.webContents.send('wifi-sync-devices-updated', payload.devices || wifiSyncService.getKnownDevices());
      }
    });

    wifiSyncService.on('devices-updated', (devices = []) => {
      if (mainWindow) {
        mainWindow.webContents.send('wifi-sync-devices-updated', devices);
      }
    });
  } catch (e) {
    console.error('[Main] Failed to initialize WiFi Sync Service:', e);
  }

  // Cloud Sync Service (Remote device connections via Firebase)
  try {
    const { CloudSyncService } = require('./src/lib/CloudSyncService.js');
    cloudSyncService = CloudSyncService.getInstance();
    cloudSyncService.initialize();
    cloudSyncService.setDeviceInfo(
      `desktop-${os.hostname().substring(0, 8)}`,
      os.hostname(),
      'desktop'
    );

    // Listen for prompts from mobile via cloud
    cloudSyncService.on('cloud-prompt', async ({ prompt, promptId, fromDeviceId }) => {
      console.log(`[CloudSync] Received prompt from mobile: "${prompt.substring(0, 50)}..."`);

      if (mainWindow) {
        mainWindow.webContents.send('remote-ai-prompt', { prompt, promptId, fromDeviceId });
      }

      // Execute on desktop AI and stream response back
      try {
        const targetModel = store.get('ollama_model') || 'deepseek-r1:8b';
        const provider = (targetModel.includes('gemini') || targetModel.includes('google')) ? 'google-flash' : 'ollama';

        const streamEvent = {
          sender: {
            isDestroyed: () => false,
            send: (_channel, data) => {
              if (data?.type === 'text-delta') {
                cloudSyncService.sendAIResponse(fromDeviceId, promptId, data.textDelta || '', true);
              } else if (data?.type === 'finish') {
                cloudSyncService.sendAIResponse(fromDeviceId, promptId, '', false);
              } else if (data?.type === 'error') {
                cloudSyncService.sendAIResponse(fromDeviceId, promptId, `Error: ${data.error || 'Stream failed'}`, false);
              }
            }
          }
        };

        await llmGenerateHandler([{ role: 'user', content: prompt }], {
          model: targetModel,
          provider: provider,
          baseUrl: store.get('ollama_base_url') || undefined,
        }, streamEvent);
      } catch (err) {
        console.error('[CloudSync] AI execution failed:', err);
        cloudSyncService.sendAIResponse(fromDeviceId, promptId, `Error: ${err.message}`, false);
      }
    });

    // Listen for file sync requests
    cloudSyncService.on('cloud-file-sync', async ({ files, fromDeviceId }) => {
      console.log(`[CloudSync] Receiving files from mobile: ${files.length} files`);

      if (mainWindow) {
        mainWindow.webContents.send('cloud-files-received', { files, fromDeviceId });
      }
    });

    console.log('[Main] Cloud Sync Service initialized');
  } catch (e) {
    console.error('[Main] Failed to initialize Cloud Sync Service:', e);
  }

  ipcMain.handle('get-wifi-sync-uri', () => {
    return wifiSyncService ? wifiSyncService.getConnectUri() : null;
  });

  ipcMain.handle('wifi-sync-broadcast', async (event, message) => {
    if (!wifiSyncService) return { success: false, error: 'WiFi Sync not initialized' };
    wifiSyncService.broadcast(message);
    return { success: true };
  });

  ipcMain.handle('get-wifi-sync-qr', async (event, cloudMode = false) => {
    if (!wifiSyncService) return null;
    let uri;
    if (cloudMode && cloudSyncService && cloudSyncService.isConnected()) {
      uri = wifiSyncService.getCloudConnectUri(cloudSyncService.getDeviceId() || 'unknown');
    } else {
      uri = wifiSyncService.getConnectUri();
    }
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

  ipcMain.handle('get-wifi-sync-devices', () => {
    if (!wifiSyncService) return [];
    return wifiSyncService.getKnownDevices();
  });

  ipcMain.handle('set-wifi-sync-device-trust', async (event, { deviceId, trustLevel, autoConnect } = {}) => {
    if (!wifiSyncService || !deviceId || !trustLevel) {
      return { success: false, error: 'Missing WiFi sync device or trust payload' };
    }

    const device = wifiSyncService.setDeviceTrust(deviceId, trustLevel, autoConnect);
    if (!device) {
      return { success: false, error: 'Device not found' };
    }

    return { success: true, device };
  });

  ipcMain.handle('remove-wifi-sync-device', async (event, deviceId) => {
    if (!wifiSyncService || !deviceId) {
      return { success: false, error: 'Missing WiFi sync device id' };
    }

    return { success: wifiSyncService.removeKnownDevice(deviceId) };
  });

  // Cloud Sync IPC Handlers
  ipcMain.handle('login-to-cloud', async (event, email, password) => {
    if (!cloudSyncService) return { success: false, error: 'Cloud sync not initialized' };
    try {
      await cloudSyncService.login(email, password);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('logout-from-cloud', async () => {
    if (!cloudSyncService) return;
    await cloudSyncService.logout();
  });

  ipcMain.handle('save-cloud-config', async (event, provider, config) => {
    if (!cloudSyncService) return { success: false };
    try {
      await cloudSyncService.configure({ provider, ...config });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-cloud-devices', async () => {
    if (!cloudSyncService) return [];
    return cloudSyncService.getDevices();
  });

  ipcMain.handle('connect-to-cloud-device', async (event, deviceId) => {
    if (!cloudSyncService) return { success: false };
    try {
      const success = await cloudSyncService.connectToDevice(deviceId);
      return { success };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('disconnect-from-cloud-device', async (event, deviceId) => {
    if (!cloudSyncService) return;
    cloudSyncService.disconnectFromDevice(deviceId);
  });

  ipcMain.handle('sync-clipboard', async (event, text) => {
    if (!cloudSyncService) return;
    await cloudSyncService.syncClipboard(text);
  });

  ipcMain.handle('sync-history', async (event, history) => {
    if (!cloudSyncService) return;
    await cloudSyncService.syncHistory(history);
  });

  ipcMain.handle('send-desktop-control', async (event, targetDeviceId, action, args) => {
    if (!cloudSyncService) return { error: 'Cloud sync not initialized' };
    return await cloudSyncService.sendDesktopControl(targetDeviceId, action, args);
  });

  // Cloud status listeners
  if (cloudSyncService) {
    cloudSyncService.on('connected', (userId) => {
      if (mainWindow) {
        mainWindow.webContents.send('cloud-sync-status', { connected: true, userId });
      }
    });
    cloudSyncService.on('disconnected', () => {
      if (mainWindow) {
        mainWindow.webContents.send('cloud-sync-status', { connected: false });
      }
    });
    cloudSyncService.on('device-connected', (deviceId) => {
      if (mainWindow) {
        mainWindow.webContents.send('cloud-device-connected', { deviceId });
      }
    });
    cloudSyncService.on('device-disconnected', (deviceId) => {
      if (mainWindow) {
        mainWindow.webContents.send('cloud-device-disconnected', { deviceId });
      }
    });
  }

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
        mainWindow.removeBrowserView(view);
      }
    }
  });

  ipcMain.on('show-all-views', () => {
    if (activeTabId && tabViews.has(activeTabId)) {
      const view = tabViews.get(activeTabId);
      if (view && mainWindow) {
        mainWindow.addBrowserView(view);
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
      const appPath = app.getAppPath();
      const isPackaged = app.isPackaged;
      const candidates = isPackaged ? [
        path.join(appPath, 'assets', 'icon.png'),
        path.join(process.resourcesPath, 'app', 'assets', 'icon.png'),
      ] : [
        path.join(__dirname, 'assets', 'icon.png'),
        path.join(appPath, 'assets', 'icon.png'),
      ];

      for (const iconPath of candidates) {
        try {
          if (fs.existsSync(iconPath)) {
            const mime = iconPath.endsWith('.png') ? 'image/png' : 'image/x-icon';
            const base64 = fs.readFileSync(iconPath).toString('base64');
            return `data:${mime};base64,${base64}`;
          }
        } catch (e) { /* skip */ }
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

  // IPC handler to update global shortcuts
  ipcMain.on('update-shortcuts', (event, shortcuts) => {
    // Unregister all existing shortcuts to prevent conflicts
    globalShortcut.unregisterAll();
    store.set('shortcuts', shortcuts);
    buildApplicationMenu();

    // Only register these actions as GLOBAL shortcuts (intercepting in other apps)
    const GLOBAL_SAFE_ACTIONS = [
      'spotlight-search',
      'pop-search',
      'global-search',
      'kill-switch',
      'emergency-kill',
      'toggle-spotlight'
    ];

    shortcuts.forEach(s => {
      try {
        if (s.accelerator) {
          // Skip accelerators with non-ASCII characters (e.g. Alt+Ø) to prevent Electron crashes
          if (/[^\x00-\x7F]/.test(s.accelerator)) {
            console.warn(`[Hotkey] Skipping invalid shortcut signature: ${s.accelerator}`);
            return;
          }

          // ONLY register globally if it's a "global-safe" action
          if (!GLOBAL_SAFE_ACTIONS.includes(s.action)) {
            // Standard shortcuts (like Cmd+W, Cmd+T) should NOT be registered as globalShortcut
            // because they intercept keys when OTHER apps are active.
            // We'll let the Menu handle them locally.
            return;
          }

          globalShortcut.register(s.accelerator, () => {
            console.log(`[Hotkey] GLOBAL Triggered: ${s.action} (${s.accelerator})`);
            if (mainWindow) {
              if (mainWindow.isMinimized()) mainWindow.restore();
              if (!mainWindow.isVisible()) mainWindow.show();
              mainWindow.focus();

              // Handle specific actions
              if (s.action === 'spotlight-search' || s.action === 'global-search' || s.action === 'toggle-spotlight') {
                mainWindow.webContents.send('open-unified-search');
              } else if (s.action === 'pop-search') {
                if (popSearch) popSearch.showPopupWithText('');
              } else if (s.action === 'kill-switch' || s.action === 'emergency-kill') {
                if (robotService) robotService.kill();
                mainWindow.webContents.send('robot-killed');
              } else if (s.action === 'zoom-in' || s.action === 'zoom-in-plus') {
                const view = tabViews.get(activeTabId);
                if (view) view.webContents.setZoomFactor(view.webContents.getZoomFactor() + 0.1);
              } else if (s.action === 'zoom-out') {
                const view = tabViews.get(activeTabId);
                if (view) view.webContents.setZoomFactor(view.webContents.getZoomFactor() - 0.1);
              } else if (s.action === 'zoom-reset') {
                const view = tabViews.get(activeTabId);
                if (view) view.webContents.setZoomFactor(1.0);
              } else {
                mainWindow.webContents.send('execute-shortcut', s.action);
              }
            }
          });
        }
      } catch (e) {
        console.error(`Failed to register shortcut ${s.accelerator}:`, e);
      }
    });
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

      let searchResults = [];
      try {
        const results = await webSearchProvider.search(query, 'duckduckgo', 6);
        searchResults = results.map((r, index) => [
          `[Result ${index + 1}]`,
          `Title: ${r.title || 'Untitled result'}`,
          `URL: ${r.url || ''}`,
          `Snippet: ${r.snippet || ''}`,
        ].join('\n'));
      } catch (e) {
        console.warn(`[RAG] Deep search failed for ${query}`);
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


  // Setup Context Menu (Merged with global setup at top)

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

  let isAutomationInitializing = false;
  async function initializeAutomationService() {
    if (ipcService || isAutomationInitializing) {
      console.log('[Main] Automation service already initialized or initializing');
      return;
    }

    isAutomationInitializing = true;
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

      const { IPCHandler } = require('./src/service/ipc-service.js');
      const { TaskScheduler } = require('./src/service/scheduler.js');
      const { TaskQueue } = require('./src/service/task-queue.js');
      const Storage = require('./src/service/storage.js');
      const { MobileNotifier } = require('./src/service/mobile-notifier.js');

      const StorageManagerClass = Storage.StorageManager;
      const automationDataPath = path.join(app.getPath('userData'), 'automation');
      if (!fs.existsSync(automationDataPath)) {
        fs.mkdirSync(automationDataPath, { recursive: true });
      }
      storageManager = new StorageManagerClass(automationDataPath);
      await storageManager.initialize();

      taskQueue = new TaskQueue(storageManager);
      taskScheduler = new TaskScheduler(taskQueue, storageManager);

      mobileNotifier = new MobileNotifier();
      await mobileNotifier.initialize();

      ipcService = new IPCHandler(taskScheduler, taskQueue, storageManager, mobileNotifier);
      ipcService.initialize();

      console.log('[Main] Automation service initialized');
    } catch (error) {
      console.error('[Main] Failed to initialize automation service:', error);
    } finally {
      isAutomationInitializing = false;
    }
  }

  // Biometric Authentication Handlers
  try {
    const { BiometricAuthManager, CrossPlatformBiometricAuth } = require('./src/service/biometric-auth.js');

    const biometricAuth = new BiometricAuthManager();
    const crossPlatformAuth = new CrossPlatformBiometricAuth();

    // Check biometric availability
    ipcMain.handle('biometric-check', async () => {
      return await biometricAuth.quickCheck();
    });

    // Authenticate via biometrics
    ipcMain.handle('biometric-authenticate', async (event, reason) => {
      return await biometricAuth.authenticate(reason || 'Authenticate to proceed');
    });

    // Execute chained actions with biometric protection
    ipcMain.handle('biometric-execute', async (event, actions, reason) => {
      return await crossPlatformAuth.executeWithAuth(actions, reason || 'Execute critical action');
    });

    console.log('[Main] Biometric authentication initialized');
  } catch (error) {
    console.error('[Main] Failed to initialize biometric auth:', error);
  }

  initializeAutomationService();

  // ============================================================================
  // POPUP WINDOW SYSTEM - Fix for panels appearing behind browser view
  // ============================================================================
  let popupWindows = new Map(); // Track all popup windows

  /**
   * Creates a popup window that appears on top of the browser view
   * This solves the z-index issue where panels appear behind the webview
   */
  function createPopupWindow(type, options = {}) {
    // Close existing popup of the same type
    if (popupWindows.has(type)) {
      const existing = popupWindows.get(type);
      if (existing && !existing.isDestroyed()) {
        existing.close();
      }
      popupWindows.delete(type);
    }

    const isMacPlatform = process.platform === 'darwin';

    const defaultOptions = {
      width: 1000,
      height: 700,
      frame: isMacPlatform,
      transparent: !isMacPlatform,
      backgroundColor: isMacPlatform ? '#00000000' : '#00000000',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
      parent: mainWindow,
      modal: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: true,
      minimizable: false,
      maximizable: false,
      show: false,
      titleBarStyle: isMacPlatform ? 'hiddenInset' : 'hidden',
    };

    const popup = new BrowserWindow({ ...defaultOptions, ...options });

    // Ensure popup appears above BrowserView by removing parent and using alwaysOnTop
    popup.setAlwaysOnTop(true, 'screen-saturation');

    // Load the appropriate content
    const baseUrl = isDev
      ? 'http://localhost:3003'
      : `file://${path.join(__dirname, 'out', 'index.html')}`;

    let route = '';
    switch (type) {
      case 'settings':
        route = isDev ? '/?panel=settings' : '/settings';
        break;
      case 'extensions':
      case 'plugins': // Handle 'plugins' as an alias for 'extensions'
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
        route = '/cart';
        break;
      case 'search':
      case 'search-apps':
        route = isDev ? '/?panel=apps' : '/apps';
        break;
      case 'translate':
        route = isDev ? '/?panel=translate' : '/translate';
        break;
      case 'context-menu':
      case 'rightclick':
        route = isDev ? '/?panel=context-menu' : '/context-menu';
        break;
      default:
        route = `/${type}`;
    }

    let url;
    if (isDev) {
      url = `${baseUrl}${route}`;
    } else {
      // Check for both folder/index.html and folder.html (Next.js export behavior)
      const routePathIndex = route === '/' ? '/index.html' : `${route}/index.html`;
      const routePathHtml = route === '/' ? '/index.html' : `${route}.html`;

      const fullPathIndex = path.join(__dirname, 'out', routePathIndex);
      const fullPathHtml = path.join(__dirname, 'out', routePathHtml);

      if (fs.existsSync(fullPathIndex)) {
        url = `file://${fullPathIndex}`;
      } else if (fs.existsSync(fullPathHtml)) {
        url = `file://${fullPathHtml}`;
      } else {
        // Fallback to hash routing if file doesn't exist
        url = `file://${path.join(__dirname, 'out', 'index.html')}#${route}`;
      }
    }

    console.log(`[Main] Loading popup URL: ${url}`);
    popup.loadURL(url);

    popup.once('ready-to-show', () => {
      popup.show();
      popup.focus();
      // Ensure popup is always on top of BrowserView
      popup.moveTop();
    });

    popup.on('closed', () => {
      popupWindows.delete(type);
    });

    popupWindows.set(type, popup);
    return popup;
  }

  // IPC Handlers for popup windows
  ipcMain.on('open-popup-window', (event, { type, options }) => {
    createPopupWindow(type, options);
  });

  ipcMain.on('close-popup-window', (event, type) => {
    if (popupWindows.has(type)) {
      const popup = popupWindows.get(type);
      if (popup && !popup.isDestroyed()) {
        popup.close();
      }
      popupWindows.delete(type);
    }
  });

  ipcMain.on('close-all-popups', () => {
    popupWindows.forEach((popup, type) => {
      if (popup && !popup.isDestroyed()) {
        popup.close();
      }
    });
    popupWindows.clear();
  });

  // Specific popup handlers
  ipcMain.on('open-settings-popup', (event, section = 'profile') => {
    if (isMac && getMacNativeUiPreferences().utilityMode === 'swiftui') {
      nativeMacPanelManager.show(section === 'downloads' ? 'downloads' : section === 'clipboard' ? 'clipboard' : 'settings').catch((error) => {
        console.error('[MacNativeUI] Failed to open native settings panel:', error);
      });
      return;
    }
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
    if (isMac && getMacNativeUiPreferences().utilityMode === 'swiftui') {
      nativeMacPanelManager.show('downloads').catch((error) => {
        console.error('[MacNativeUI] Failed to open native downloads panel:', error);
      });
      return;
    }
    createPopupWindow('downloads', {
      width: 400,
      height: 600,
    });
  });

  ipcMain.on('open-clipboard-popup', () => {
    if (isMac && getMacNativeUiPreferences().utilityMode === 'swiftui') {
      nativeMacPanelManager.show('clipboard').catch((error) => {
        console.error('[MacNativeUI] Failed to open native clipboard panel:', error);
      });
      return;
    }
    createPopupWindow('clipboard', {
      width: 450,
      height: 650,
    });
  });

  ipcMain.on('open-cart-popup', () => {
    createPopupWindow('cart', {
      width: 500,
      height: 700,
    });
  });

  ipcMain.on('open-search-popup', (event, options = {}) => {
    createPopupWindow('search', {
      width: 600,
      height: 500,
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
    const permission = checkAiActionPermission('CLICK_ELEMENT', selector, 'medium');
    if (!permission.allowed) {
      return { success: false, error: permission.error };
    }
    try {
      const result = await view.webContents.executeJavaScript(`
      (() => {
        const el = document.querySelector('${selector}');
        if (el) {
          el.click();
          return true;
        }
        return false;
      })()
    `);
      return { success: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('type-text', async (event, { selector, text }) => {
    const view = tabViews.get(activeTabId);
    if (!view) return { success: false, error: 'No active view' };
    const permission = checkAiActionPermission('FILL_FORM', selector, 'medium');
    if (!permission.allowed) {
      return { success: false, error: permission.error };
    }
    try {
      const vaultApproval = await ensureVaultApprovalForFormFill({ [selector]: text });
      if (!vaultApproval.success) {
        return { success: false, error: vaultApproval.error };
      }

      await view.webContents.executeJavaScript(`
      (() => {
        const selector = ${JSON.stringify(selector)};
        const value = ${JSON.stringify(text ?? '')};
        const el = document.querySelector(selector);
        if (el) {
          el.focus();
          el.value = value;
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

  // ============================================================================
  // CROSS-APP AUTOMATION - For controlling external applications
  // ============================================================================

  const { CrossPlatformAutomation } = require('./src/lib/cross-platform-automation.js');
  const crossPlatformAutomation = new CrossPlatformAutomation();

  ipcMain.handle('click-app-element', async (event, { appName, elementText, reason }) => {
    console.log(`[Main] click-app-element: ${appName}, "${elementText}"`);
    try {
      return await crossPlatformAutomation.clickAppElement(appName, elementText, reason);
    } catch (error) {
      console.error('[Main] click-app-element error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('type-text-app', async (event, text) => {
    console.log(`[Main] type-text-app: ${text.substring(0, 30)}...`);
    try {
      return await crossPlatformAutomation.typeText(text);
    } catch (error) {
      console.error('[Main] type-text-app error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fill-form', async (event, formData) => {
    const view = tabViews.get(activeTabId);
    if (!view) return { success: false, error: 'No active view' };
    const permissionTarget = formData && typeof formData === 'object'
      ? Object.keys(formData).slice(0, 5).join(',') || 'form'
      : 'form';
    const permission = checkAiActionPermission('FILL_FORM', permissionTarget, 'medium');
    if (!permission.allowed) {
      return { success: false, error: permission.error };
    }
    try {
      const vaultApproval = await ensureVaultApprovalForFormFill(formData);
      if (!vaultApproval.success) {
        return { success: false, error: vaultApproval.error };
      }

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
      if (!bounds && tesseractOcrService) {
        try {
          const recognition = await tesseractOcrService.captureAndOcr(undefined, { preferNative: useNative });
          return {
            success: true,
            provider: recognition.provider,
            strategy: recognition.strategy,
            text: (recognition.lines?.length ? recognition.lines : recognition.words || [])
              .map((item) => item.text)
              .join('\n'),
            words: recognition.words || [],
            lines: recognition.lines || [],
          };
        } catch (serviceError) {
          console.warn('[Main] Shared OCR service failed, falling back to legacy handler:', serviceError.message);
        }
      }

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
    const permission = checkAiActionPermission('CLICK_AT', `${x},${y}`, 'medium');
    if (!permission.allowed) {
      return { success: false, error: permission.error };
    }

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



  ipcMain.handle('set-proxy', async (_event, config) => {
    const updates = config
      ? {
        proxyMode: config.mode || 'fixed_servers',
        proxyRules: config.proxyRules || config.rules || config.proxyServer || '',
        proxyBypassRules: config.proxyBypassRules || networkSecurityManager.getConfig().proxyBypassRules,
      }
      : {
        proxyMode: 'direct',
        proxyRules: '',
      };

    await applyNetworkSecurityConfig(updates);
    return true;
  });

  ipcMain.handle('permission-auto-command', async (event, { command, enabled }) => {
    permissionStore.setAutoCommand(command, enabled);
    return { success: true, commands: permissionStore.getAutoApprovedCommands() };
  });

  ipcMain.handle('permission-auto-action', async (event, { actionType, enabled }) => {
    permissionStore.setAutoAction(actionType, enabled);
    return { success: true, actions: permissionStore.getAutoApprovedActions() };
  });

  // Skill Loader - loads document generation skills (pdf/docx/pptx)
  ipcMain.handle('load-skill', async (event, format) => {
    const { skillLoader } = require('./src/lib/SkillLoader.ts');
    try {
      const skill = await skillLoader.load(format);
      return { success: true, skill };
    } catch (e) {
      console.error('[Main] Error loading skill:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('permission-auto-commands', async () => {
    return { commands: permissionStore.getAutoApprovedCommands() };
  });

  ipcMain.handle('permission-auto-actions', async () => {
    return { actions: permissionStore.getAutoApprovedActions() };
  });

  ipcMain.on('automation-shell-approval-response', (_event, { requestId, allowed, deviceUnlockValidated }) => {
    const resolver = shellApprovalResolvers.get(requestId);
    if (resolver) {
      shellApprovalResolvers.delete(requestId);
      resolver({ allowed: !!allowed, deviceUnlockValidated: !!deviceUnlockValidated });
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
      const result = await tesseractOcrService.captureAndOcr(displayId);
      return { success: true, ...result };
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
            clickableElements: Array.from(document.querySelectorAll('button, a, [role="button"]')).slice(0, 30).map((el, i) => ({
              index: i,
              tagName: el.tagName.toLowerCase(),
              text: (el.textContent || '').trim().substring(0, 100),
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
  ipcMain.handle('ai-engine-chat', async (event, { message, model, provider, systemPrompt, history }) => {
    if (!cometAiEngine) return { success: false, error: 'AI engine not initialized' };
    try {
      const response = await cometAiEngine.chat({ message, model, provider, systemPrompt, history });
      return { success: true, response };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('ai-engine-configure', async (event, keys) => {
    if (!cometAiEngine) return { success: false, error: 'AI engine not initialized' };
    cometAiEngine.configure(keys);
    if (keys.GEMINI_API_KEY) store.set('gemini_api_key', keys.GEMINI_API_KEY);
    if (keys.GROQ_API_KEY) store.set('groq_api_key', keys.GROQ_API_KEY);
    if (keys.OPENAI_API_KEY) store.set('openai_api_key', keys.OPENAI_API_KEY);
    if (keys.AZURE_OPENAI_API_KEY) store.set('azure_openai_api_key', keys.AZURE_OPENAI_API_KEY);
    if (keys.AZURE_OPENAI_BASE_URL) store.set('azure_openai_endpoint', keys.AZURE_OPENAI_BASE_URL);
    if (keys.ANTHROPIC_API_KEY) store.set('anthropic_api_key', keys.ANTHROPIC_API_KEY);
    return { success: true };
  });

  ipcMain.handle('classify-tabs-ai', async (event, { tabs }) => {
    if (!cometAiEngine) return { success: false, error: 'AI engine not initialized' };
    try {
      const tabData = tabs.map(t => `- [${t.id}] ${t.title} (${t.url})`).join('\n');
      const prompt = `Classify the following browser tabs into logical groups.
Each group should have a clear, concise name (2-3 words max, e.g., "Research", "Development", "Social Media", "Shopping").
Respond ONLY with a JSON object where keys are tab IDs and values are group names.

Example:
{
  "tab-1": "Research",
  "tab-2": "Social Media"
}

Tabs to classify:
${tabData}`;

      const response = await cometAiEngine.chat({
        message: prompt,
        systemPrompt: "You are an expert browser organizer. Respond only with valid JSON."
      });

      // Cleanup response (sometimes LLMs wrap JSON in ```json blocks)
      const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const classifications = JSON.parse(cleanJson);
      return { success: true, classifications };
    } catch (e) {
      console.error('[AI Tab Organizer] Error:', e);
      return { success: false, error: e.message };
    }
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
    const serverInfo = config.url || (config.command ? `${config.command} ${config.args?.join(' ') || ''}` : 'unknown');
    console.log(`[Main] Connecting to MCP server: ${config.name} (${serverInfo})`);
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

  // LAZY INITIALIZATION - Services start on-demand, not at startup
  // This makes app launch instant

  const initServiceOnDemand = async (service, initFn, name) => {
    if (service && typeof service.init === 'function') return service;
    try {
      console.log(`[LazyInit] Starting ${name}...`);
      await initFn();
      console.log(`[LazyInit] ${name} ready`);
      return service;
    } catch (e) {
      console.error(`[LazyInit] Failed to start ${name}:`, e.message);
      return service;
    }
  };

  // RAG Handler - lazy init
  ipcMain.handle('rag-ingest', async (event, { text, source }) => {
    await initServiceOnDemand(ragService, async () => {
      if (!ragService) return;
      await ragService.init();
    }, 'RAG');
    if (!ragService) return { success: false, error: 'RAG not initialized' };
    try {
      const apiKey = store.get('gemini_api_key') || process.env.GEMINI_API_KEY;
      const count = await ragService.ingest(text, source, apiKey);
      return { success: true, chunksAdded: count };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('rag-retrieve', async (event, { query, k }) => {
    await initServiceOnDemand(ragService, async () => {
      if (!ragService) return;
      await ragService.init();
    }, 'RAG');
    if (!ragService) return { success: false, error: 'RAG not initialized' };
    try {
      const apiKey = store.get('gemini_api_key') || process.env.GEMINI_API_KEY;
      const results = await ragService.retrieve(query, k, apiKey);
      return { success: true, results };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('rag-context', async (event, { query, k }) => {
    await initServiceOnDemand(ragService, async () => {
      if (!ragService) return;
      await ragService.init();
    }, 'RAG');
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
    globalShortcut.unregisterAll();

    // Default shortcuts if none provided
    const spotlightShortcut = process.platform === 'darwin' ? 'Option+Space' : 'Alt+Space';
    const defaultShortcuts = [
      { accelerator: spotlightShortcut, action: 'spotlight-search' },
      { accelerator: 'CommandOrControl+Shift+S', action: 'pop-search' },
      { accelerator: 'CommandOrControl+P', action: 'print' },
      { accelerator: process.platform === 'darwin' ? 'Command+Shift+Escape' : 'Control+Shift+Escape', action: 'kill-switch' },
      { accelerator: 'CommandOrControl+Option+S', action: 'apple-intel-summary' },
      { accelerator: 'CommandOrControl+Option+I', action: 'apple-intel-image' },
      { accelerator: 'CommandOrControl+Option+A', action: 'apple-intel-panel' }
    ];

    const shortcutsToRegister = (shortcuts && shortcuts.length > 0) ? shortcuts : defaultShortcuts;

    shortcutsToRegister.forEach(s => {
      try {
        if (!s.accelerator) return;

        // Same check for startup registration
        const GLOBAL_SAFE_ACTIONS = [
          'spotlight-search',
          'pop-search',
          'global-search',
          'kill-switch',
          'emergency-kill',
          'toggle-spotlight',
          'apple-intel-summary',
          'apple-intel-image',
          'apple-intel-panel'
        ];

        if (!GLOBAL_SAFE_ACTIONS.includes(s.action)) return;

        globalShortcut.register(s.accelerator, () => {
          console.log(`[Hotkey] GLOBAL Triggered: ${s.action} (${s.accelerator})`);

          if (s.action === 'spotlight-search' || s.action === 'global-search' || s.action === 'toggle-spotlight') {
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
        mcpManager.connect(server.id, server).catch(() => {
          // Connection errors handled by mcp-server-registry.js
        });
      });
    }
  } else {
    // Default MCP servers - users can add their own via settings
    // Note: Removed github-mcp and brave-search due to connection issues
    const defaultServers = [
      { id: 'filesystem-mcp', name: 'Filesystem MCP (Local)', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '.'], type: 'stdio', status: 'offline' }
    ];
    console.log('[Main] No MCP servers found, loading defaults.');
    store.set('mcp_servers', defaultServers);
  }


  ipcMain.on('update-shortcuts', (event, shortcuts) => {
    console.log('[Main] Updating global shortcuts');
    store.set('shortcuts', shortcuts);
    registerGlobalShortcuts(shortcuts);
    buildApplicationMenu();
  });

  // Auto-update IPC handlers
  ipcMain.handle('check-for-updates', () => {
    if (app.isPackaged) {
      const { autoUpdater } = require('electron-updater');
      return autoUpdater.checkForUpdatesAndNotify();
    }
    return Promise.resolve({ updateAvailable: false });
  });

  ipcMain.handle('quit-and-install', () => {
    if (app.isPackaged) {
      const { autoUpdater } = require('electron-updater');
      autoUpdater.quitAndInstall();
    }
  });




  ipcMain.handle('open-external-url', async (event, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error('[Main] Failed to open external URL:', error);
      return { success: false, error: error.message };
    }
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
    globalShortcut.unregisterAll();
  });

  app.on('before-quit', () => {
    if (macSidebarWindow && !macSidebarWindow.isDestroyed()) {
      macSidebarWindow.destroy();
    }
    if (raycastServer) {
      raycastServer.close();
    }
    if (nativeMacUiServer) {
      nativeMacUiServer.close();
    }
    if (isMac) {
      nativeMacPanelManager.closeAll();
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
}).catch(err => {
  console.error('[Main] Fatal error during app startup:', err);
  // Emergency fallback to at least show the window
  if (openWindows.size === 0) {
    createWindow();
  }
});
