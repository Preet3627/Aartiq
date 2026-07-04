const { exec, spawn } = require('child_process');
const { clipboard, shell, dialog, app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const util = require('util');
const execPromise = util.promisify(exec);

const RAYCAST_SCHEMA = 'raycast';

class RaycastIntegration {
  constructor() {
    this.commandHandlers = new Map();
    this.setupDefaultCommands();
  }

  setupDefaultCommands() {
    this.commandHandlers.set('search', this.handleSearch.bind(this));
    this.commandHandlers.set('open', this.handleOpen.bind(this));
    this.commandHandlers.set('chat', this.handleChat.bind(this));
    this.commandHandlers.set('screenshot', this.handleScreenshot.bind(this));
    this.commandHandlers.set('volume', this.handleVolume.bind(this));
    this.commandHandlers.set('clipboard', this.handleClipboard.bind(this));
    this.commandHandlers.set('create-pdf', this.handleCreatePdf.bind(this));
    this.commandHandlers.set('navigate', this.handleNavigate.bind(this));
    this.commandHandlers.set('run-command', this.handleRunCommand.bind(this));
    this.commandHandlers.set('schedule', this.handleSchedule.bind(this));
    this.commandHandlers.set('ask', this.handleAsk.bind(this));
    this.commandHandlers.set('voice', this.handleVoice.bind(this));
  }

  async handleProtocol(url) {
    try {
      const urlObj = new URL(url);
      const command = urlObj.hostname;
      const params = Object.fromEntries(urlObj.searchParams);

      const handler = this.commandHandlers.get(command);
      if (handler) {
        return await handler(params);
      }
      return { success: false, error: `Unknown command: ${command}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleSearch(params) {
    const { query } = params;
    if (!query) {
      return { success: false, error: 'Missing query parameter' };
    }

    return {
      success: true,
      action: 'search',
      query,
      result: `Searching for: ${query}`
    };
  }

  async handleOpen(params) {
    const { url, app: appName } = params;
    if (!url && !appName) {
      return { success: false, error: 'Missing url or app parameter' };
    }

    if (appName) {
      const cmd = process.platform === 'darwin' 
        ? `open -a "${appName}"` 
        : `start "" "${appName}"`;
      await execPromise(cmd).catch(() => {});
      return { success: true, action: 'open-app', app: appName };
    }

    await shell.openExternal(url);
    return { success: true, action: 'open-url', url };
  }

  async handleChat(params) {
    const { message } = params;
    if (!message) {
      return { success: false, error: 'Missing message parameter' };
    }

    return {
      success: true,
      action: 'chat',
      message,
      aiResponse: 'Message sent to AI. Check Aartiq for response.'
    };
  }

  async handleScreenshot(params) {
    const { fullscreen = 'false' } = params;
    
    try {
      const screenshot = require('screenshot-desktop');
      const timestamp = Date.now();
      const filename = `screenshot-${timestamp}.png`;
      const filepath = path.join(app.getPath('pictures'), filename);
      
      await screenshot({ format: 'png', filename: filepath });
      
      return {
        success: true,
        action: 'screenshot',
        filepath,
        filename
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleVolume(params) {
    const { level } = params;
    const volumeLevel = Math.max(0, Math.min(100, parseInt(level) || 50));
    
    try {
      if (process.platform === 'darwin') {
        const vol = Math.round(volumeLevel * 65535 / 100);
        await execPromise(`osascript -e "set volume output volume ${Math.round(volumeLevel / 100 * 7)}"`);
      } else if (process.platform === 'win32') {
        await execPromise(`nircmd.exe setvolume 0 ${volumeLevel * 65535 / 100} 0`);
      }
      return { success: true, action: 'set-volume', level: volumeLevel };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleClipboard(params) {
    const { action = 'read', content } = params;
    
    if (action === 'read') {
      const text = clipboard.readText();
      return { success: true, action: 'clipboard-read', content: text };
    } else if (action === 'write') {
      if (!content) {
        return { success: false, error: 'Missing content parameter' };
      }
      clipboard.writeText(content);
      return { success: true, action: 'clipboard-write', content };
    }
    
    return { success: false, error: 'Invalid action. Use read or write.' };
  }

  async handleCreatePdf(params) {
    const { title, content } = params;
    if (!content) {
      return { success: false, error: 'Missing content parameter' };
    }

    return {
      success: true,
      action: 'create-pdf',
      title: title || 'Document',
      message: 'PDF creation request sent to Aartiq'
    };
  }

  async handleNavigate(params) {
    const { url } = params;
    if (!url) {
      return { success: false, error: 'Missing url parameter' };
    }

    return {
      success: true,
      action: 'navigate',
      url,
      message: `Navigating to ${url}`
    };
  }

  async handleRunCommand(params) {
    const { command } = params;
    if (!command) {
      return { success: false, error: 'Missing command parameter' };
    }

    try {
      const result = await execPromise(command, { timeout: 30000 });
      return {
        success: true,
        action: 'run-command',
        command,
        output: result.stdout || result.stderr
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleSchedule(params) {
    const { task, cron } = params;
    if (!task) {
      return { success: false, error: 'Missing task parameter' };
    }

    return {
      success: true,
      action: 'schedule',
      task,
      cron: cron || '0 9 * * *',
      message: 'Task scheduled in Aartiq'
    };
  }

  async handleAsk(params) {
    const { prompt, speak = 'false' } = params;
    if (!prompt) {
      return { success: false, error: 'Missing prompt parameter' };
    }

    return {
      success: true,
      action: 'ask-ai',
      prompt,
      speak: speak === 'true',
      message: 'AI query sent to Aartiq'
    };
  }

  async handleVoice(params) {
    const { text } = params;
    
    try {
      if (process.platform === 'darwin') {
        const script = text 
          ? `say "${text}"` 
          : 'say "Listening"';
        await execPromise(script);
        return { success: true, action: 'voice', text };
      }
      return { success: false, error: 'Voice not supported on this platform' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getManifest() {
    return {
      schema: RAYCAST_SCHEMA,
      commands: Array.from(this.commandHandlers.keys()),
      version: '1.0.0',
      description: 'Aartiq Raycast Integration',
      endpoints: {
        'raycast://search?query=...': 'Search the web',
        'raycast://open?url=...': 'Open URL or app',
        'raycast://chat?message=...': 'Send message to AI',
        'raycast://screenshot': 'Take screenshot',
        'raycast://volume?level=0-100': 'Set volume',
        'raycast://clipboard?action=read|write&content=...': 'Read/write clipboard',
        'raycast://create-pdf?title=...&content=...': 'Create PDF',
        'raycast://navigate?url=...': 'Navigate to URL',
        'raycast://run-command?command=...': 'Run terminal command',
        'raycast://schedule?task=...&cron=...': 'Schedule task',
        'raycast://ask?prompt=...': 'Ask AI question',
        'raycast://voice?text=...': 'Text to speech'
      }
    };
  }
}

const raycastIntegration = new RaycastIntegration();

module.exports = {
  raycastIntegration,
  RAYCAST_SCHEMA
};