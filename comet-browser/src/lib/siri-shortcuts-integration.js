const { app, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const COMET_URL_SCHEME = 'comet-ai';
const SHORTCUTS_FOLDER = path.join(app.getPath('userData'), 'Shortcuts');

const SiriShortcutState = {
  lastQuery: null,
  lastResponse: null,
  pendingActions: [],
  speechRecognitionActive: false,
};

async function ensureShortcutsFolder() {
  if (!fs.existsSync(SHORTCUTS_FOLDER)) {
    fs.mkdirSync(SHORTCUTS_FOLDER, { recursive: true });
  }
}

function registerCometURLScheme() {
  if (process.defaultAgent) {
    if (!defaultAgent.setAsDefaultProtocolClient(COMET_URL_SCHEME)) {
      console.log('[SiriShortcuts] Failed to register URL scheme');
    } else {
      console.log('[SiriShortcuts] Registered comet-ai:// URL scheme');
    }
  }
}

function generateShortcutURL(action, params = {}) {
  const paramString = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return `${COMET_URL_SCHEME}://${action}${paramString ? '?' + paramString : ''}`;
}

function parseShortcutURL(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== `${COMET_URL_SCHEME}:`) {
      return null;
    }
    const action = parsed.hostname;
    const params = {};
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return { action, params };
  } catch {
    return null;
  }
}

async function executeShortcutAction(action, params) {
  console.log(`[SiriShortcuts] Executing action: ${action}`, params);
  
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
    mainWindow.webContents.send('siri-chat-input', message);
    return { success: true, message: 'Message sent to AI' };
  }
  return { error: 'Comet not running' };
}

async function handleNavigateAction(params) {
  const { url } = params;
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('siri-navigate', url);
    return { success: true };
  }
  return { error: 'Comet not running' };
}

async function handleSearchAction(params) {
  const { query } = params;
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('siri-search', query);
    return { success: true };
  }
  return { error: 'Comet not running' };
}

async function handleCreatePDFAction(params) {
  const { content, title, template } = params;
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('siri-create-pdf', { content, title, template });
    return { success: true };
  }
  return { error: 'Comet not running' };
}

async function handleShellCommandAction(params) {
  const { command, confirm } = params;
  if (confirm !== 'true') {
    return { error: 'Confirmation required for shell commands' };
  }
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('siri-shell-command', command);
    return { success: true };
  }
  return { error: 'Comet not running' };
}

async function handleOpenAppAction(params) {
  const { appName, appPath } = params;
  try {
    if (appPath) {
      await shell.openPath(appPath);
    } else if (appName) {
      await execPromise(`open -a "${appName}"`);
    }
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

async function handleScreenshotAction(params) {
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('siri-screenshot');
    return { success: true };
  }
  return { error: 'Comet not running' };
}

async function handleVolumeAction(params) {
  const { level } = params;
  const volumeLevel = Math.max(0, Math.min(100, parseInt(level) || 50));
  try {
    await execPromise(`osascript -e "set volume output volume ${volumeLevel}"`);
    return { success: true, volume: volumeLevel };
  } catch (error) {
    return { error: error.message };
  }
}

async function handleScheduleAction(params) {
  const { task, cron, model } = params;
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('siri-schedule', { task, cron, model });
    return { success: true };
  }
  return { error: 'Comet not running' };
}

async function handleAskAIAction(params) {
  const { prompt, model, speak } = params;
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('siri-ask-ai', { prompt, model, speak: speak === 'true' });
    return { success: true };
  }
  return { error: 'Comet not running' };
}

function getMainWindow() {
  const { getAllWindows } = require('electron');
  const windows = getAllWindows();
  return windows.find(w => !w.isDestroyed()) || null;
}

async function generateShortcutTemplate(action, name) {
  const templates = {
    chat: {
      name: `Ask ${name} - Chat with AI`,
      description: 'Send a message to Comet AI',
      steps: [
        { type: 'AskForText', name: 'Message', prompt: 'What do you want to ask AI?' },
        { type: 'OpenURL', name: 'Open Comet', url: `comet-ai://chat?message={{Message}}` },
      ],
    },
    'smart-search': {
      name: `${name} - Smart Search`,
      description: 'Search the web using Comet AI',
      steps: [
        { type: 'AskForText', name: 'Search Query', prompt: 'What do you want to search for?' },
        { type: 'OpenURL', name: 'Search', url: `comet-ai://search?query={{Search%20Query}}` },
      ],
    },
    'create-pdf': {
      name: `${name} - Create PDF`,
      description: 'Create a PDF document from content',
      steps: [
        { type: 'AskForText', name: 'Content', prompt: 'What content for the PDF?' },
        { type: 'AskForText', name: 'Title', prompt: 'PDF title?' },
        { type: 'OpenURL', name: 'Create PDF', url: `comet-ai://create-pdf?content={{Content}}&title={{Title}}` },
      ],
    },
    'open-app': {
      name: `${name} - Open Application`,
      description: 'Open an application using Comet',
      steps: [
        { type: 'AskForText', name: 'App Name', prompt: 'Which app to open?' },
        { type: 'OpenURL', name: 'Open App', url: `comet-ai://open-app?appName={{App%20Name}}` },
      ],
    },
    'volume': {
      name: `${name} - Set Volume`,
      description: 'Set system volume',
      steps: [
        { type: 'AskForNumber', name: 'Level', prompt: 'Volume level (0-100)', default: 50 },
        { type: 'OpenURL', name: 'Set Volume', url: `comet-ai://volume?level={{Level}}` },
      ],
    },
    'screenshot': {
      name: `${name} - Take Screenshot`,
      description: 'Capture a screenshot',
      steps: [
        { type: 'OpenURL', name: 'Screenshot', url: 'comet-ai://screenshot' },
      ],
    },
    'run-command': {
      name: `${name} - Run Terminal Command`,
      description: 'Execute a terminal command (requires confirmation)',
      steps: [
        { type: 'AskForText', name: 'Command', prompt: 'Enter command to run' },
        { type: 'Confirm', name: 'Confirm', prompt: 'Run this command?' },
        { type: 'OpenURL', name: 'Run Command', url: `comet-ai://run-command?command={{Command}}&confirm=true` },
      ],
    },
    'schedule': {
      name: `${name} - Schedule Task`,
      description: 'Schedule an AI task',
      steps: [
        { type: 'AskForText', name: 'Task', prompt: 'What task to schedule?' },
        { type: 'AskForText', name: 'Schedule', prompt: 'When (e.g., daily at 8am)?' },
        { type: 'OpenURL', name: 'Schedule Task', url: `comet-ai://schedule?task={{Task}}&cron={{Schedule}}` },
      ],
    },
    'ask-ai': {
      name: `${name} - Ask AI with Speech`,
      description: 'Ask AI and hear the response',
      steps: [
        { type: 'AskForText', name: 'Question', prompt: 'Ask AI anything' },
        { type: 'OpenURL', name: 'Ask AI', url: `comet-ai://ask-ai?prompt={{Question}}&speak=true` },
      ],
    },
    'voice-chat': {
      name: `${name} - Voice Chat`,
      description: 'Chat with AI using voice',
      steps: [
        { type: 'DictateText', name: 'Voice Input', prompt: 'What do you want to ask AI?' },
        { type: 'OpenURL', name: 'Send to AI', url: `comet-ai://chat?message={{Voice%20Input}}` },
      ],
    },
  };

  return templates[action] || null;
}

async function exportShortcutsTemplates() {
  await ensureShortcutsFolder();
  
  const shortcuts = [
    'chat', 'smart-search', 'create-pdf', 'open-app', 
    'volume', 'screenshot', 'run-command', 'schedule', 'ask-ai', 'voice-chat'
  ];

  const exported = [];
  
  for (const action of shortcuts) {
    const template = generateShortcutTemplate(action, 'Comet AI');
    if (template) {
      const filename = `${action}.shortcut`;
      const filepath = path.join(SHORTCUTS_FOLDER, filename);
      
      const shortcutContent = {
        name: template.name,
        description: template.description,
        actions: template.steps.map(step => ({
          type: step.type,
          parameters: step,
        })),
      };
      
      fs.writeFileSync(filepath, JSON.stringify(shortcutContent, null, 2));
      exported.push({ action, filename, name: template.name });
    }
  }

  return exported;
}

function setupSiriIPCHandlers() {
  ipcMain.handle('siri:execute-action', async (event, action, params) => {
    return await executeShortcutAction(action, params);
  });

  ipcMain.handle('siri:get-url-scheme', async () => {
    return COMET_URL_SCHEME;
  });

  ipcMain.handle('siri:generate-url', async (event, action, params) => {
    return generateShortcutURL(action, params);
  });

  ipcMain.handle('siri:export-templates', async () => {
    return await exportShortcutsTemplates();
  });

  ipcMain.handle('siri:get-templates-list', async () => {
    return [
      { id: 'chat', name: 'Chat with AI', description: 'Send a message to Comet AI' },
      { id: 'smart-search', name: 'Smart Search', description: 'Search the web using AI' },
      { id: 'create-pdf', name: 'Create PDF', description: 'Generate a PDF document' },
      { id: 'open-app', name: 'Open Application', description: 'Launch any application' },
      { id: 'volume', name: 'Set Volume', description: 'Control system volume' },
      { id: 'screenshot', name: 'Take Screenshot', description: 'Capture screen' },
      { id: 'run-command', name: 'Run Command', description: 'Execute terminal command' },
      { id: 'schedule', name: 'Schedule Task', description: 'Schedule AI tasks' },
      { id: 'ask-ai', name: 'Ask AI + Speak', description: 'Ask AI with voice response' },
      { id: 'voice-chat', name: 'Voice Chat', description: 'Dictate and send to AI' },
    ];
  });
}

function handleURLSchemeEvent(url) {
  console.log('[SiriShortcuts] URL scheme event:', url);
  const parsed = parseShortcutURL(url);
  if (parsed) {
    executeShortcutAction(parsed.action, parsed.params);
  }
}

module.exports = {
  registerCometURLScheme,
  generateShortcutURL,
  parseShortcutURL,
  executeShortcutAction,
  exportShortcutsTemplates,
  setupSiriIPCHandlers,
  handleURLSchemeEvent,
  COMET_URL_SCHEME,
  SHORTCUTS_FOLDER,
};