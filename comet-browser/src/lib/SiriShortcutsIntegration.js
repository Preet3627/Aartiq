const { app, ipcMain, shell, clipboard, nativeTheme, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

exports.COMET_URL_SCHEME = 'comet-ai';
exports.COMET_APP_NAME = 'Comet AI';

const APP_SHORTCUTS = [
  {
    name: 'Ask AI',
    description: 'Ask a question to Comet AI',
    parameters: ['query'],
    url: 'comet-ai://chat?message={query}',
  },
  {
    name: 'Smart Search',
    description: 'Search the web using AI',
    parameters: ['query'],
    url: 'comet-ai://search?query={query}',
  },
  {
    name: 'Create PDF',
    description: 'Generate a PDF document',
    parameters: ['content', 'title'],
    url: 'comet-ai://create-pdf?content={content}&title={title}',
  },
  {
    name: 'Navigate',
    description: 'Open a website',
    parameters: ['url'],
    url: 'comet-ai://navigate?url={url}',
  },
  {
    name: 'Run Command',
    description: 'Execute a terminal command',
    parameters: ['command'],
    url: 'comet-ai://run-command?command={command}&confirm=true',
  },
  {
    name: 'Schedule Task',
    description: 'Schedule an AI task',
    parameters: ['task', 'schedule'],
    url: 'comet-ai://schedule?task={task}&cron={schedule}',
  },
  {
    name: 'Set Volume',
    description: 'Control system volume',
    parameters: ['level'],
    url: 'comet-ai://volume?level={level}',
  },
  {
    name: 'Open App',
    description: 'Open an application',
    parameters: ['appName'],
    url: 'comet-ai://open-app?appName={appName}',
  },
  {
    name: 'Take Screenshot',
    description: 'Capture screen',
    parameters: [],
    url: 'comet-ai://screenshot',
  },
  {
    name: 'Voice Chat',
    description: 'Chat with AI using voice',
    parameters: [],
    url: 'comet-ai://voice-chat',
  },
  {
    name: 'Ask + Speak',
    description: 'Ask AI and hear response',
    parameters: ['prompt'],
    url: 'comet-ai://ask-ai?prompt={prompt}&speak=true',
  },
];

function generateShortcutURL(action, params = {}) {
  const paramString = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return `comet-ai://${action}${paramString ? '?' + paramString : ''}`;
}

function parseCometURL(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'comet-ai:') {
      return null;
    }
    const action = parsed.hostname;
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
  console.log(`[SiriShortcuts] Executing: ${action}`, params);

  const mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());

  const actionMaps = {
    'chat': 'ai:chat-message',
    'navigate': 'browser:navigate',
    'search': 'ai:search',
    'create-pdf': 'ai:create-pdf',
    'run-command': 'shell:execute',
    'open-app': 'system:open-app',
    'screenshot': 'system:screenshot',
    'volume': 'system:set-volume',
    'schedule': 'ai:schedule',
    'ask-ai': 'ai:ask-speaking',
    'voice-chat': 'ai:voice-chat',
  };

  const ipcChannel = actionMaps[action];
  
  if (mainWindow && ipcChannel) {
    mainWindow.webContents.send(ipcChannel, params);
    return { success: true };
  }

  if (action === 'volume') {
    const level = Math.max(0, Math.min(100, parseInt(params.level) || 50));
    try {
      await execPromise(`osascript -e "set volume output volume ${level}"`);
      return { success: true, message: `Volume set to ${level}%` };
    } catch (error) {
      return { success: false, message: String(error) };
    }
  }

  if (action === 'open-app') {
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

  return { success: false, message: `Unknown action: ${action}` };
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
          const clip = (await execPromise('pbpaste')).trim();
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
    return exports.COMET_URL_SCHEME;
  });

  ipcMain.handle('siri:parse-url', (_event, url) => {
    return parseCometURL(url);
  });
}

function registerURLScheme() {
  if (process.defaultAgent) {
    return process.defaultAgent.setAsDefaultProtocolClient(exports.COMET_URL_SCHEME);
  }
  return false;
}

function handleURLSchemeEvent(url) {
  const parsed = parseCometURL(url);
  if (parsed) {
    executeShortcutAction(parsed.action, parsed.params);
  }
}

exports.generateShortcutURL = generateShortcutURL;
exports.parseCometURL = parseCometURL;
exports.executeShortcutAction = executeShortcutAction;
exports.speakWithSiri = speakWithSiri;
exports.listenWithDictation = listenWithDictation;
exports.setupSiriShortcutsHandlers = setupSiriShortcutsHandlers;
exports.registerURLScheme = registerURLScheme;
exports.handleURLSchemeEvent = handleURLSchemeEvent;
exports.APP_SHORTCUTS = APP_SHORTCUTS;

module.exports = {
  COMET_URL_SCHEME: exports.COMET_URL_SCHEME,
  APP_SHORTCUTS,
  generateShortcutURL,
  parseCometURL,
  executeShortcutAction,
  speakWithSiri,
  listenWithDictation,
  setupSiriShortcutsHandlers,
  registerURLScheme,
  handleURLSchemeEvent,
};