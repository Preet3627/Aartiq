const { app, ipcMain, shell, clipboard, nativeTheme, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

exports.AARTIQ_URL_SCHEME = 'aartiq';
exports.AARTIQ_APP_NAME = 'Aartiq';

const APP_SHORTCUTS = [
  {
    name: 'Ask AI',
    description: 'Ask a question to Aartiq',
    parameters: ['query'],
    url: 'aartiq://chat?message={query}',
  },
  {
    name: 'Smart Search',
    description: 'Search the web using AI',
    parameters: ['query'],
    url: 'aartiq://search?query={query}',
  },
  {
    name: 'Create PDF',
    description: 'Generate a PDF document',
    parameters: ['content', 'title'],
    url: 'aartiq://create-pdf?content={content}&title={title}',
  },
  {
    name: 'Navigate',
    description: 'Open a website',
    parameters: ['url'],
    url: 'aartiq://navigate?url={url}',
  },
  {
    name: 'Run Command',
    description: 'Execute a terminal command',
    parameters: ['command'],
    url: 'aartiq://run-command?command={command}&confirm=true',
  },
  {
    name: 'Schedule Task',
    description: 'Schedule an AI task',
    parameters: ['task', 'schedule'],
    url: 'aartiq://schedule?task={task}&cron={schedule}',
  },
  {
    name: 'Set Volume',
    description: 'Control system volume',
    parameters: ['level'],
    url: 'aartiq://volume?level={level}',
  },
  {
    name: 'Open App',
    description: 'Open an application',
    parameters: ['appName'],
    url: 'aartiq://open-app?appName={appName}',
  },
  {
    name: 'Take Screenshot',
    description: 'Capture screen',
    parameters: [],
    url: 'aartiq://screenshot',
  },
  {
    name: 'Voice Chat',
    description: 'Chat with AI using voice',
    parameters: [],
    url: 'aartiq://voice-chat',
  },
  {
    name: 'Ask + Speak',
    description: 'Ask AI and hear response',
    parameters: ['prompt'],
    url: 'aartiq://ask-ai?prompt={prompt}&speak=true',
  },
];

function generateShortcutURL(action, params = {}) {
  const paramString = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return `aartiq://${action}${paramString ? '?' + paramString : ''}`;
}

function normalizeShortcutAction(action = '') {
  return `${action || ''}`.trim().replace(/^\/+/, '') || 'index';
}

function normalizeNavigationTarget(raw = '') {
  const value = `${raw || ''}`.trim();
  if (!value) return '';
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)) {
    return value;
  }
  return `https://${value}`;
}

function getMainWindow() {
  const windows = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed());
  return windows[0] || null;
}

function focusMainWindow(win) {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function parseAartiqURL(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'aartiq:') {
      return null;
    }
    const action = normalizeShortcutAction(parsed.hostname || parsed.pathname);
    const params = {};
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return { action, params, speak: params.speak === 'true' };
  } catch {
    return null;
  }
}

async function executeShortcutAction(action, params = {}) {
  const normalizedAction = normalizeShortcutAction(action);
  console.log(`[SiriShortcuts] Executing: ${normalizedAction}`, params);

  const mainWindow = getMainWindow();
  if (mainWindow) {
    focusMainWindow(mainWindow);
  }

  if (normalizedAction === 'chat' || normalizedAction === 'ask-ai') {
    const prompt = params.message || params.prompt || params.query || '';
    if (mainWindow && prompt) {
      mainWindow.webContents.send('execute-shortcut', 'open-ai-chat');
      mainWindow.webContents.send('ai-chat-input-text', prompt);
      return { success: true, message: 'Prompt sent to Aartiq' };
    }
  }

  if (normalizedAction === 'voice-chat') {
    if (mainWindow) {
      mainWindow.webContents.send('execute-shortcut', 'open-ai-chat');
      return { success: true, message: 'Opened Aartiq chat' };
    }
  }

  if (normalizedAction === 'navigate') {
    const target = normalizeNavigationTarget(params.url);
    if (mainWindow && target) {
      mainWindow.webContents.send('navigate-to-url', target);
      return { success: true, message: `Opening ${target}` };
    }
  }

  if (normalizedAction === 'search') {
    const query = `${params.query || params.prompt || ''}`.trim();
    if (mainWindow && query) {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      mainWindow.webContents.send('add-new-tab', searchUrl);
      return { success: true, message: `Searching for ${query}` };
    }
  }

  if (normalizedAction === 'create-pdf') {
    const title = `${params.title || 'Document'}`.trim();
    const content = `${params.content || ''}`.trim();
    if (mainWindow && content) {
      mainWindow.webContents.send('execute-shortcut', 'open-ai-chat');
      mainWindow.webContents.send('ai-chat-input-text', `Create a PDF titled "${title}" with this content:\n\n${content}`);
      return { success: true, message: `Prepared PDF request for ${title}` };
    }
  }

  if (normalizedAction === 'run-command') {
    const command = `${params.command || ''}`.trim();
    if (mainWindow && command) {
      mainWindow.webContents.send('execute-shortcut', 'open-ai-chat');
      mainWindow.webContents.send('ai-chat-input-text', `Run this shell command: ${command}`);
      return { success: true, message: 'Prepared shell command request' };
    }
  }

  if (normalizedAction === 'schedule') {
    const task = `${params.task || ''}`.trim();
    const schedule = `${params.cron || params.schedule || ''}`.trim();
    if (mainWindow && task) {
      const scheduleText = schedule ? ` Run it at: ${schedule}.` : '';
      mainWindow.webContents.send('execute-shortcut', 'open-ai-chat');
      mainWindow.webContents.send('ai-chat-input-text', `Schedule this task: ${task}.${scheduleText}`);
      return { success: true, message: 'Prepared scheduling request' };
    }
  }

  if (normalizedAction === 'volume') {
    const level = Math.max(0, Math.min(100, parseInt(params.level) || 50));
    try {
      await execPromise(`osascript -e "set volume output volume ${level}"`);
      return { success: true, message: `Volume set to ${level}%` };
    } catch (error) {
      return { success: false, message: String(error) };
    }
  }

  if (normalizedAction === 'open-app') {
    const { appName } = params;
    try {
      if (appName) {
        await execPromise(`open -a "${appName}"`);
        return { success: true, message: `Opened ${appName}` };
      }
    } catch (error) {
      return { success: false, message: String(error) };
    }
  }

  return { success: false, message: `Unknown or unsupported action: ${normalizedAction}` };
}

async function speakWithSiri(text) {
  const safeText = text.replace(/"/g, '\\"').replace(/\n/g, ' ');
  try {
    await execPromise(`osascript -e 'say "${safeText}"'`);
    return true;
  } catch {
    return false;
  }
}

async function listenWithDictation(timeout = 10000) {
  return new Promise(async (resolve, reject) => {
    try {
      exec(`osascript -e 'tell application "System Events" to keystroke "d" using {command down}'`);
      
      const startTime = Date.now();
      let lastClip = '';
      
      const checkInterval = setInterval(async () => {
        try {
          const clip = (await execPromise('pbpaste')).stdout.trim();
          if (clip && clip !== lastClip) {
            lastClip = clip;
            clearInterval(checkInterval);
            resolve(clip);
          }
        } catch {}
        
        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve(lastClip);
        }
      }, 500);
      
    } catch (error) {
      reject(error);
    }
  });
}

function setupSiriShortcutsHandlers() {
  ipcMain.handle('siri:get-app-shortcuts', () => {
    return APP_SHORTCUTS;
  });

  ipcMain.handle('siri:generate-url', (_event, action, params) => {
    return generateShortcutURL(action, params);
  });

  ipcMain.handle('siri:execute', (_event, action, params) => {
    return executeShortcutAction(action, params);
  });

  ipcMain.handle('siri:speak-text', (_event, text) => {
    return speakWithSiri(text);
  });

  ipcMain.handle('siri:listen-voice', (_event, timeout) => {
    return listenWithDictation(timeout);
  });

  ipcMain.handle('siri:get-url-scheme', () => {
    return exports.AARTIQ_URL_SCHEME;
  });

  ipcMain.handle('siri:parse-url', (_event, url) => {
    return parseAartiqURL(url);
  });
}

function registerURLScheme() {
  if (process.defaultApp && process.argv.length >= 2) {
    return app.setAsDefaultProtocolClient(exports.AARTIQ_URL_SCHEME, process.execPath, [path.resolve(process.argv[1])]);
  }
  return app.setAsDefaultProtocolClient(exports.AARTIQ_URL_SCHEME);
}

function handleURLSchemeEvent(url) {
  const parsed = parseAartiqURL(url);
  if (parsed) {
    executeShortcutAction(parsed.action, parsed.params);
  }
}

// ── macOS `shortcuts` CLI bridge (macOS 12+) ──

const SHORTCUTS_CLI = '/usr/bin/shortcuts';

async function shortcutsList() {
  try {
    const { stdout } = await execPromise(`"${SHORTCUTS_CLI}" list`);
    return stdout.split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(name => ({ id: name, name, source: 'shortcuts-app' }));
  } catch (error) {
    console.warn('[SiriShortcuts] shortcuts list failed:', error.message);
    return [];
  }
}

async function shortcutsRun(name, input = '') {
  if (!name || typeof name !== 'string') {
    return { success: false, error: 'Shortcut name is required' };
  }
  try {
    if (input) {
      const escaped = input.replace(/"/g, '\\"');
      await execPromise(`echo "${escaped}" | "${SHORTCUTS_CLI}" run "${name}"`);
    } else {
      await execPromise(`"${SHORTCUTS_CLI}" run "${name}"`);
    }
    return { success: true, name };
  } catch (error) {
    return { success: false, error: error.message, name };
  }
}

async function shortcutsView(name) {
  if (!name || typeof name !== 'string') {
    return { success: false, error: 'Shortcut name is required' };
  }
  try {
    const { stdout } = await execPromise(`"${SHORTCUTS_CLI}" view "${name}"`);
    return { success: true, name, details: stdout.trim() || 'No details available' };
  } catch (error) {
    return { success: false, error: error.message, name };
  }
}

function setupShortcutsCLIHandlers() {
  ipcMain.handle('shortcuts:list', () => shortcutsList());
  ipcMain.handle('shortcuts:run', (_event, name, input) => shortcutsRun(name, input));
  ipcMain.handle('shortcuts:view', (_event, name) => shortcutsView(name));
}

exports.generateShortcutURL = generateShortcutURL;
exports.parseAartiqURL = parseAartiqURL;
exports.executeShortcutAction = executeShortcutAction;
exports.speakWithSiri = speakWithSiri;
exports.listenWithDictation = listenWithDictation;
exports.setupSiriShortcutsHandlers = setupSiriShortcutsHandlers;
exports.registerURLScheme = registerURLScheme;
exports.handleURLSchemeEvent = handleURLSchemeEvent;
exports.shortcutsList = shortcutsList;
exports.shortcutsRun = shortcutsRun;
exports.shortcutsView = shortcutsView;
exports.setupShortcutsCLIHandlers = setupShortcutsCLIHandlers;
exports.APP_SHORTCUTS = APP_SHORTCUTS;

module.exports = {
  AARTIQ_URL_SCHEME: exports.AARTIQ_URL_SCHEME,
  APP_SHORTCUTS,
  generateShortcutURL,
  parseAartiqURL,
  executeShortcutAction,
  speakWithSiri,
  listenWithDictation,
  setupSiriShortcutsHandlers,
  registerURLScheme,
  handleURLSchemeEvent,
  shortcutsList,
  shortcutsRun,
  shortcutsView,
  setupShortcutsCLIHandlers,
};
