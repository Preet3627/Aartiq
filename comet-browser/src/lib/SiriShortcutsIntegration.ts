import { app, ipcMain, shell, clipboard, nativeTheme, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export const COMET_URL_SCHEME = 'comet-ai';
export const COMET_APP_NAME = 'Comet AI';

export interface ShortcutAction {
  action: string;
  params?: Record<string, string>;
  speak?: boolean;
}

export interface SiriIntent {
  name: string;
  description: string;
  parameters: string[];
  url: string;
}

export const APP_SHORTCUTS: SiriIntent[] = [
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

export function generateShortcutURL(action: string, params: Record<string, string> = {}): string {
  const paramString = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return `comet-ai://${action}${paramString ? '?' + paramString : ''}`;
}

function normalizeShortcutAction(action: string = ''): string {
  return `${action || ''}`.trim().replace(/^\/+/, '') || 'index';
}

function normalizeNavigationTarget(raw: string = ''): string {
  const value = `${raw || ''}`.trim();
  if (!value) return '';
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)) {
    return value;
  }
  return `https://${value}`;
}

function getMainWindow(): BrowserWindow | null {
  return BrowserWindow.getAllWindows().find(w => !w.isDestroyed()) ?? null;
}

function focusMainWindow(win: BrowserWindow | null): void {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

export function parseCometURL(url: string): ShortcutAction | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'comet-ai:') {
      return null;
    }
    const action = normalizeShortcutAction(parsed.hostname || parsed.pathname);
    const params: Record<string, string> = {};
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return { action, params, speak: params.speak === 'true' };
  } catch {
    return null;
  }
}

export async function executeShortcutAction(
  action: string,
  params: Record<string, string> = {}
): Promise<{ success: boolean; message?: string }> {
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
      return { success: true, message: 'Prompt sent to Comet AI' };
    }
  }

  if (normalizedAction === 'voice-chat') {
    if (mainWindow) {
      mainWindow.webContents.send('execute-shortcut', 'open-ai-chat');
      return { success: true, message: 'Opened Comet AI chat' };
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

export async function speakWithSiri(text: string): Promise<boolean> {
  const safeText = text.replace(/"/g, '\\"').replace(/\n/g, ' ');
  try {
    await execPromise(`osascript -e 'say "${safeText}"'`);
    return true;
  } catch {
    return false;
  }
}

export async function listenWithDictation(timeout: number = 10000): Promise<string> {
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

export function setupSiriShortcutsHandlers(): void {
  ipcMain.handle('siri:get-app-shortcuts', () => {
    return APP_SHORTCUTS;
  });

  ipcMain.handle('siri:generate-url', (_event, action: string, params: Record<string, string>) => {
    return generateShortcutURL(action, params);
  });

  ipcMain.handle('siri:execute', (_event, action: string, params: Record<string, string>) => {
    return executeShortcutAction(action, params);
  });

  ipcMain.handle('siri:speak', (_event, text: string) => {
    return speakWithSiri(text);
  });

  ipcMain.handle('siri:listen', (_event, timeout: number) => {
    return listenWithDictation(timeout);
  });

  ipcMain.handle('siri:get-url-scheme', () => {
    return COMET_URL_SCHEME;
  });

  ipcMain.handle('siri:parse-url', (_event, url: string) => {
    return parseCometURL(url);
  });
}

export function registerURLScheme(): boolean {
  if (process.defaultApp && process.argv.length >= 2) {
    return app.setAsDefaultProtocolClient(COMET_URL_SCHEME, process.execPath, [path.resolve(process.argv[1])]);
  }
  return app.setAsDefaultProtocolClient(COMET_URL_SCHEME);
}

export function handleURLSchemeEvent(url: string): void {
  const parsed = parseCometURL(url);
  if (parsed) {
    executeShortcutAction(parsed.action, parsed.params);
  }
}

export default {
  COMET_URL_SCHEME,
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
