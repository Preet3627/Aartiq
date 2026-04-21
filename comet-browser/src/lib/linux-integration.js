/**
 * Linux Integration Module
 * Supports GNOME/KDE Shortcuts, Voice Control, and desktop integration
 */

const { app, ipcMain, shell, exec } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec: execAsync } = require('child_process');
const util = require('util');
const execPromise = util.promisify(execAsync);

const COMET_URL_SCHEME = 'comet-ai';

const LinuxIntegration = {
  platform: process.platform,
  isLinux: process.platform === 'linux',
  desktop: null,
};

async function detectDesktop() {
  if (process.platform !== 'linux') return null;
  
  const desktop = process.env.XDG_CURRENT_DESKTOP || 
                 process.env.DESKTOP_SESSION || 
                 'unknown';
  
  LinuxIntegration.desktop = desktop.toLowerCase();
  return LinuxIntegration.desktop;
}

detectDesktop();

async function executeCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    exec(command, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

async function executeDBus(method, interface, object, params = []) {
  const desktop = await detectDesktop();
  if (desktop !== 'gnome' && desktop !== 'kde') {
    return { success: false, message: 'D-Bus not available' };
  }

  try {
    const paramStr = params.map(p => `"${p}"`).join(' ');
    const cmd = `gdbus call --session --dest ${interface} --object-path ${object} --method ${interface}.${method} ${paramStr}`;
    const result = await executeCommand(cmd);
    return { success: true, result };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function registerLinuxProtocol() {
  if (!LinuxIntegration.isLinux) {
    return { success: false, message: 'Not Linux' };
  }

  try {
    const desktop = await detectDesktop();
    
    if (desktop === 'gnome' || desktop === 'ubuntu') {
      await executeCommand('gsettings', ['set', 'org.gnome.desktop.default-applications.url-scheme-commet-ai', 'exec', 'comet-ai']);
    }
    
    app.setAsDefaultProtocolClient(COMET_URL_SCHEME);
    return { success: true, message: `Protocol registered on ${desktop}` };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function handleLinuxShortcutAction(action, params = {}) {
  console.log(`[Linux] Action: ${action}`, params);

  const actionHandlers = {
    'chat': handleChatAction,
    'navigate': handleNavigateAction,
    'search': handleSearchAction,
    'create-pdf': handleCreatePDFAction,
    'run-command': handleShellCommandAction,
    'open-app': handleOpenAppAction,
    'screenshot': handleScreenshotAction,
    'volume': handleVolumeAction,
    'schedule': handleScheduleAction,
    'ask-ai': handleAskAIAction,
    'voice': handleVoiceAction,
    'notify': handleNotifyAction,
  };

  const handler = actionHandlers[action];
  if (handler) {
    return await handler(params);
  }
  return { error: `Unknown action: ${action}` };
}

async function handleChatAction(params) {
  const { message } = params;
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('ai:chat-message', message);
    return { success: true, message: 'Message sent to AI' };
  }
  return { error: 'Comet not running' };
}

async function handleNavigateAction(params) {
  const { url } = params;
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('browser:navigate', url);
    return { success: true };
  }
  return { error: 'Comet not running' };
}

async function handleSearchAction(params) {
  const { query } = params;
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('ai:search', query);
    return { success: true };
  }
  return { error: 'Comet not running' };
}

async function handleCreatePDFAction(params) {
  const { content, title } = params;
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('ai:create-pdf', { content, title });
    return { success: true };
  }
  return { error: 'Comet not running' };
}

async function handleShellCommandAction(params) {
  const { command } = params;
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('ai:run-command', command);
    return { success: true, message: 'Command queued' };
  }
  return { error: 'Comet not running' };
}

async function handleOpenAppAction(params) {
  const { appName } = params;
  try {
    const desktop = await detectDesktop();
    let cmd;
    
    if (desktop === 'gnome' || desktop === 'kde') {
      cmd = `gtk-launch ${appName} 2>/dev/null || kioclient exec ${appName}`;
    } else {
      cmd = `xdg-open ${appName}`;
    }
    
    await executeCommand(cmd);
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

async function handleScreenshotAction(params) {
  const { mode = 'fullscreen', path: savePath } = params;
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('ai:screenshot', { mode, path: savePath });
    return { success: true };
  }
  return { error: 'Comet not running' };
}

async function handleVolumeAction(params) {
  const { level } = params;
  const desktop = await detectDesktop();
  
  if (desktop === 'gnome') {
    await executeCommand('pactl', ['set-sink-volume', '@DEFAULT_SINK@', `${Math.round(level * 655.36 / 100)}`]);
  } else if (desktop === 'kde') {
    await executeCommand('qdbus', ['org.kde.KMix', '/Mixer/0/Volume', 'setVolume', level.toString()]);
  } else {
    return { error: 'Volume control not supported on this desktop' };
  }
  return { success: true };
}

async function handleScheduleAction(params) {
  const { task, cron } = params;
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('ai:schedule', { task, cron });
    return { success: true };
  }
  return { error: 'Comet not running' };
}

async function handleAskAIAction(params) {
  const { prompt, speak = false } = params;
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('ai:ask-ai', { prompt, speak });
    return { success: true };
  }
  return { error: 'Comet not running' };
}

async function handleVoiceAction(params) {
  const { text, speak = true } = params;
  if (speak) {
    await speakText(text);
    return { success: true };
  }
  return { success: true };
}

async function handleNotifyAction(params) {
  const { title, message, icon } = params;
  const desktop = await detectDesktop();
  
  try {
    if (desktop === 'gnome') {
      const cmd = `notify-send "${title}" "${message}" ${icon ? `-i ${icon}` : ''}`;
      await executeCommand(cmd);
    } else if (desktop === 'kde') {
      await executeCommand('kdialog', ['--passivepopup', message, '2', '--title', title]);
    } else {
      await executeCommand('notify-send', ['-u', 'normal', '-t', '5000', title, message]);
    }
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

function getMainWindow() {
  const { BrowserWindow } = require('electron');
  const windows = BrowserWindow.getAllWindows();
  return windows.length > 0 ? windows[0] : null;
}

async function speakText(text, options = {}) {
  const { voice = 'en', rate = 1.0 } = options;
  const desktop = await detectDesktop();
  
  try {
    if (desktop === 'gnome') {
      await executeCommand('espeak', ['-v', voice, '-s', Math.round(rate * 175), text]);
    } else {
      await executeCommand('espeak', ['-v', voice, '-s', Math.round(rate * 175), text]);
    }
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

async function getLinuxVoices() {
  try {
    const output = await executeCommand('espeak', ['--voices']);
    const voices = output.split('\n').slice(1).map(line => {
      const parts = line.trim().split(/\s+/);
      return { name: parts[3], language: parts[1] };
    }).filter(v => v.name && v.language);
    return voices;
  } catch (error) {
    return [{ name: 'default', language: 'en' }];
  }
}

async function startVoiceRecognition(options = {}) {
  const { language = 'en', timeout = 5000 } = options;
  
  const desktop = await detectDesktop();
  
  try {
    if (desktop === 'gnome') {
      const output = await executeCommand('timeout', ['-s', 'SIGKILL', timeout / 1000, 'arecord', '-f', 'S16_LE', '-r', '16000', '-c', '1', '-t', 'raw', '/tmp/comet_voice.raw']);
      return { success: false, message: 'Voice recording not available - use web-based STT' };
    }
    return { success: false, message: 'Voice recognition requires web service on Linux' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

function generateShortcutURL(action, params = {}) {
  const baseURL = `comet-ai://${action}`;
  const queryString = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return queryString ? `${baseURL}?${queryString}` : baseURL;
}

async function createLinuxShortcut(name, action, params = {}) {
  const desktop = await detectDesktop();
  const userDir = app.getPath('userData');
  const shortcutsDir = path.join(userDir, 'shortcuts');
  
  if (!fs.existsSync(shortcutsDir)) {
    fs.mkdirSync(shortcutsDir, { recursive: true });
  }
  
  const url = generateShortcutURL(action, params);
  const shortcutPath = path.join(shortcutsDir, `${name}.desktop`);
  
  let desktopEntry = `[Desktop Entry]
Type=Application
Name=${name}
Exec=${url}
Comment=Comet AI ${action}
Icon=comet-ai
Terminal=false
Categories=Network;Utility;
`;
  
  if (desktop === 'gnome') {
    desktopEntry += 'X-GNOME-UsesNotifications=true\n';
  }
  
  fs.writeFileSync(shortcutPath, desktopEntry);
  
  try {
    await executeCommand('chmod', ['+x', shortcutPath]);
  } catch (e) {}
  
  return { success: true, path: shortcutPath };
}

async function installGNOMEShortcut(name, action, params = {}) {
  const desktop = await detectDesktop();
  if (desktop !== 'gnome' && desktop !== 'ubuntu') {
    return { success: false, message: 'Not GNOME desktop' };
  }
  
  const userDirs = process.env.XDG_DATA_DIRS?.split(':') || [];
  const desktopDir = path.join(process.env.HOME || '', '.local', 'share', 'applications');
  
  if (!fs.existsSync(desktopDir)) {
    fs.mkdirSync(desktopDir, { recursive: true });
  }
  
  const url = generateShortcutURL(action, params);
  const shortcutPath = path.join(desktopDir, `comet-ai-${name}.desktop`);
  
  const desktopEntry = `[Desktop Entry]
Type=Application
Name=Comet AI - ${name}
Comment=Comet AI ${action}
Exec=comet-ai "${url}"
Icon=comet-browser
Terminal=false
Categories=Network;Assistant;
Keywords=ai;assistant;chat;
`;
  
  fs.writeFileSync(shortcutPath, desktopEntry);
  
  try {
    await executeCommand('update-desktop-database', [desktopDir]);
  } catch (e) {}
  
  return { success: true, path: shortcutPath };
}

async function showDesktopNotification(title, body, options = {}) {
  return handleNotifyAction({ title, message: body, ...options });
}

async function createDesktopLauncher() {
  const exePath = process.execPath;
  const userDir = app.getPath('userData');
  const launcherPath = path.join(userDir, 'comet-ai.desktop');
  
  const desktopEntry = `[Desktop Entry]
Version=1.0
Type=Application
Name=Comet AI
Comment=AI-Powered Browser
Exec=${exePath}
Icon=comet-browser
Terminal=false
Categories=Network;Browser;Utility;
StartupNotify=true
MimeType=x-scheme-handler/comet-ai;
`;
  
  fs.writeFileSync(launcherPath, desktopEntry);
  
  const desktop = await detectDesktop();
  if (desktop === 'gnome' || desktop === 'kde') {
    await executeCommand('chmod', ['+x', launcherPath]);
  }
  
  return { success: true, path: launcherPath };
}

function setupLinuxIPCHandlers() {
  ipcMain.handle('linux:get-desktop', async () => {
    return await detectDesktop();
  });
  
  ipcMain.handle('linux:register-protocol', async () => {
    return await registerLinuxProtocol();
  });
  
  ipcMain.handle('linux:shortcut-action', async (event, action, params) => {
    return await handleLinuxShortcutAction(action, params);
  });
  
  ipcMain.handle('linux:speak', async (event, text, options) => {
    return await speakText(text, options);
  });
  
  ipcMain.handle('linux:get-voices', async () => {
    return await getLinuxVoices();
  });
  
  ipcMain.handle('linux:start-voice', async (event, options) => {
    return await startVoiceRecognition(options);
  });
  
  ipcMain.handle('linux:create-shortcut', async (event, name, action, params) => {
    return await createLinuxShortcut(name, action, params);
  });
  
  ipcMain.handle('linux:install-gnome-shortcut', async (event, name, action, params) => {
    return await installGNOMEShortcut(name, action, params);
  });
  
  ipcMain.handle('linux:create-launcher', async () => {
    return await createDesktopLauncher();
  });
  
  ipcMain.handle('linux:notify', async (event, title, body, options) => {
    return await showDesktopNotification(title, body, options);
  });
  
  console.log('[Linux] IPC handlers registered');
}

function handleLinuxURLScheme(url) {
  try {
    const parsed = new URL(url);
    const action = parsed.hostname || parsed.pathname.replace(/^\/+/, '');
    const params = Object.fromEntries(parsed.searchParams);
    
    console.log('[Linux] URL Scheme:', action, params);
    return handleLinuxShortcutAction(action, params);
  } catch (error) {
    console.error('[Linux] URL Scheme error:', error);
    return { error: error.message };
  }
}

function getLinuxIntegration() {
  return LinuxIntegration;
}

module.exports = {
  setupLinuxIPCHandlers,
  registerLinuxProtocol,
  handleLinuxShortcutAction,
  handleLinuxURLScheme,
  generateShortcutURL,
  createLinuxShortcut,
  installGNOMEShortcut,
  createDesktopLauncher,
  speakText,
  getLinuxVoices,
  startVoiceRecognition,
  showDesktopNotification,
  detectDesktop,
  getLinuxIntegration,
};