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

export function parseCometURL(url: string): ShortcutAction | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'comet-ai:') {
      return null;
    }
    const action = parsed.hostname;
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
  console.log(`[SiriShortcuts] Executing: ${action}`, params);

  const mainWindow = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());

  const actionMaps: Record<string, string> = {
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

export async function speakWithSiri(text: string): Promise<boolean> {
  const safeText = text.replace(/"/g, '\\"').replace(/\n/g, ' ');
  try {
    await execPromise(`osascript -e 'say "${safeText}"`);
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
  if (process.defaultAgent) {
    return process.defaultAgent.setAsDefaultProtocolClient(COMET_URL_SCHEME);
  }
  return false;
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