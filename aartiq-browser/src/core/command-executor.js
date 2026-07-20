const { ipcMain, shell, clipboard, dialog, app, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

class CommandExecutor {
  constructor(options = {}) {
    this.windowManager = options.windowManager;
    this.networkManager = options.networkManager;
    this.permissionStore = options.permissionStore;
    this.robotService = options.robotService;
    this.cometAiEngine = options.cometAiEngine;
    this.store = options.store;
    this.capabilityController = options.capabilityController || null;
    this.registerHandlers = this.registerHandlers.bind(this);
  }

  setWindowManager(wm) {
    this.windowManager = wm;
  }

  setNetworkManager(nm) {
    this.networkManager = nm;
  }

  setPermissionStore(ps) {
    this.permissionStore = ps;
  }

  setRobotService(rs) {
    this.robotService = rs;
  }

  setAartiqAiEngine(engine) {
    this.cometAiEngine = engine;
  }

  setCapabilityController(cc) {
    this.capabilityController = cc;
  }

  registerHandlers() {
    this._registerSystemHandlers();
    this._registerWindowHandlers();
    this._registerShellHandlers();
    this._registerClipboardHandlers();
    this._registerDialogHandlers();
    this._registerRobotHandlers();
    this._registerNetworkHandlers();
    this._registerStoreHandlers();
  }

  _registerSystemHandlers() {
    const registerHandler = (channel, handler) => {
      try {
        ipcMain.handle(channel, handler);
      } catch (e) {
        console.log(`[CommandExecutor] Handler '${channel}' already registered, skipping`);
      }
    };

    registerHandler('get-app-version', () => app.getVersion() || '1.0.0');
    registerHandler('get-platform', () => process.platform);
    registerHandler('get-app-icon', async (event, appPath) => {
      try {
        const icon = await app.getFileIcon(appPath, { size: 'normal' });
        return icon.toDataURL();
      } catch (e) {
        return null;
      }
    });
    registerHandler('get-displays', () => {
      return screen.getAllDisplays().map(d => ({
        id: d.id,
        bounds: d.bounds,
        workArea: d.workArea,
        scaleFactor: d.scaleFactor,
        rotation: d.rotation,
        touchSupport: d.touchSupport,
      }));
    });
    registerHandler('get-primary-display', () => {
      const display = screen.getPrimaryDisplay();
      return {
        id: display.id,
        bounds: display.bounds,
        workArea: display.workArea,
        scaleFactor: display.scaleFactor,
      };
    });
  }

  _registerWindowHandlers() {
    const registerHandler = (channel, handler) => {
      try {
        ipcMain.handle(channel, handler);
      } catch (e) {
        console.log(`[CommandExecutor] Handler '${channel}' already registered, skipping`);
      }
    };

    registerHandler('window-minimize', () => {
      const win = this.windowManager?.getTopWindow();
      if (win) win.minimize();
    });
    registerHandler('window-maximize', () => {
      const win = this.windowManager?.getTopWindow();
      if (win) {
        if (win.isMaximized()) {
          win.unmaximize();
        } else {
          win.maximize();
        }
      }
    });
    registerHandler('window-close', () => {
      const win = this.windowManager?.getTopWindow();
      if (win) win.close();
    });
    registerHandler('window-set-always-on-top', (event, flag) => {
      const win = this.windowManager?.getTopWindow();
      if (win) win.setAlwaysOnTop(flag);
    });
    registerHandler('window-set-fullscreen', (event, flag) => {
      const win = this.windowManager?.getTopWindow();
      if (win) win.setFullScreen(flag);
    });
    registerHandler('window-is-maximized', () => {
      const win = this.windowManager?.getTopWindow();
      return win ? win.isMaximized() : false;
    });
    registerHandler('window-is-fullscreen', () => {
      const win = this.windowManager?.getTopWindow();
      return win ? win.isFullScreen() : false;
    });
  }

  _registerShellHandlers() {
    const registerHandler = (channel, handler) => {
      try {
        ipcMain.handle(channel, handler);
      } catch (e) {
        console.log(`[CommandExecutor] Handler '${channel}' already registered, skipping`);
      }
    };

    registerHandler('shell-open-external', async (event, url) => {
      try {
        await shell.openExternal(url);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    registerHandler('shell-open-path', async (event, filePath) => {
      try {
        const result = await shell.openPath(filePath);
        return { success: !result, path: result, error: result || null };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    registerHandler('shell-show-item', async (event, filePath) => {
      try {
        shell.showItemInFolder(filePath);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    registerHandler('shell-move-to-trash', async (event, filePath) => {
      try {
        shell.trashItem(filePath);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    registerHandler('shell-read-file', async (event, filePath) => {
      if (this.capabilityController) {
        const result = await this.capabilityController.executeAction('shell-read-file', { filePath });
        if (!result.approved) {
          return { success: false, error: result.reason || 'File read blocked by capability controller.' };
        }
      }
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        return { success: true, content };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    registerHandler('shell-write-file', async (event, filePath, content) => {
      if (this.capabilityController) {
        const result = await this.capabilityController.executeAction('shell-write-file', { filePath });
        if (!result.approved) {
          return { success: false, error: result.reason || 'File write blocked by capability controller.' };
        }
      }
      try {
        fs.writeFileSync(filePath, content, 'utf8');
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    registerHandler('shell-execute-command', async (event, command, args = []) => {
      if (this.capabilityController) {
        const result = await this.capabilityController.executeAction('shell-execute-command', { command, args });
        if (!result.approved) {
          return { success: false, error: result.reason || 'Shell execution blocked by capability controller.' };
        }
      }
      return new Promise((resolve) => {
        try {
          // Use shell: false by default — command + args are passed directly to the
          // OS execve without shell interpretation, preventing metacharacter injection.
          // Only fall back to shell: true when the command string itself contains shell
          // features (pipes, redirects, glob) that require shell interpretation, and
          // only after capability controller approval above.
          const needsShell = /[|;&`$<>]/.test(command) || args.some(a => /[|;&`$<>]/.test(a));
          const spawnOpts = { shell: needsShell };
          if (!needsShell) {
            // When not using shell, the first "arg" may actually be flags for the
            // command (e.g. command="ls" args=["-la", "/tmp"]). Pass command as
            // the executable and args as the argument array.
            const child = spawn(command, args, spawnOpts);
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (data) => { stdout += data.toString(); });
            child.stderr.on('data', (data) => { stderr += data.toString(); });
            child.on('close', (code) => {
              resolve({ success: code === 0, code, stdout, stderr });
            });
            child.on('error', (error) => {
              resolve({ success: false, error: error.message });
            });
          } else {
            // Shell required: pass the full command as a single string to the shell.
            const fullCommand = [command, ...args].join(' ');
            const child = spawn(fullCommand, [], spawnOpts);
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (data) => { stdout += data.toString(); });
            child.stderr.on('data', (data) => { stderr += data.toString(); });
            child.on('close', (code) => {
              resolve({ success: code === 0, code, stdout, stderr });
            });
            child.on('error', (error) => {
              resolve({ success: false, error: error.message });
            });
          }
        } catch (error) {
          resolve({ success: false, error: error.message });
        }
      });
    });
  }

  _registerClipboardHandlers() {
    const registerHandler = (channel, handler) => {
      try {
        ipcMain.handle(channel, handler);
      } catch (e) {
        console.log(`[CommandExecutor] Handler '${channel}' already registered, skipping`);
      }
    };

    registerHandler('clipboard-read', () => {
      return clipboard.readText();
    });
    registerHandler('clipboard-write', (event, text) => {
      clipboard.writeText(text);
      return true;
    });
    registerHandler('clipboard-read-html', () => {
      return clipboard.readHTML();
    });
    registerHandler('clipboard-write-html', (event, html) => {
      clipboard.writeHTML(html);
      return true;
    });
    registerHandler('clipboard-read-image', () => {
      const image = clipboard.readImage();
      if (image.isEmpty()) return null;
      return image.toDataURL();
    });
    registerHandler('clipboard-write-image', (event, dataUrl) => {
      const image = nativeImage.createFromDataURL(dataUrl);
      clipboard.writeImage(image);
      return true;
    });
    registerHandler('clipboard-clear', () => {
      clipboard.clear();
      return true;
    });
  }

  _registerDialogHandlers() {
    const registerHandler = (channel, handler) => {
      try {
        ipcMain.handle(channel, handler);
      } catch (e) {
        console.log(`[CommandExecutor] Handler '${channel}' already registered, skipping`);
      }
    };

    registerHandler('dialog-show-open', async (event, options = {}) => {
      const win = this.windowManager?.getTopWindow();
      const result = await dialog.showOpenDialog(win || null, {
        properties: ['openFile'],
        ...options,
      });
      return result;
    });
    registerHandler('dialog-show-save', async (event, options = {}) => {
      const win = this.windowManager?.getTopWindow();
      const result = await dialog.showSaveDialog(win || null, options);
      return result;
    });
    registerHandler('dialog-show-message', async (event, options = {}) => {
      const win = this.windowManager?.getTopWindow();
      const result = await dialog.showMessageBox(win || null, options);
      return result;
    });
    registerHandler('dialog-show-error', (event, title, message) => {
      dialog.showErrorBox(title, message);
    });
  }

  _registerRobotHandlers() {
    const registerHandler = (channel, handler) => {
      try {
        ipcMain.handle(channel, handler);
      } catch (e) {
        console.log(`[CommandExecutor] Handler '${channel}' already registered, skipping`);
      }
    };

    registerHandler('robot-execute', async (event, action, opts = {}) => {
      if (!this.robotService) {
        return { success: false, error: 'Robot service not initialized' };
      }
      try {
        const result = await this.robotService.execute(action, opts);
        return { success: true, result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    registerHandler('robot-execute-sequence', async (event, actions, opts = {}) => {
      if (!this.robotService) {
        return { success: false, error: 'Robot service not initialized' };
      }
      try {
        const results = await this.robotService.executeSequence(actions, opts);
        return { success: true, results };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    registerHandler('robot-kill', () => {
      if (this.robotService) {
        this.robotService.kill();
        return true;
      }
      return false;
    });
    registerHandler('robot-is-available', () => {
      return this.robotService?.isAvailable || false;
    });
  }

  _registerNetworkHandlers() {
    const registerHandler = (channel, handler) => {
      try {
        ipcMain.handle(channel, handler);
      } catch (e) {
        console.log(`[CommandExecutor] Handler '${channel}' already registered, skipping`);
      }
    };

    registerHandler('network-get-config', () => {
      return this.networkManager?.getConfig() || null;
    });
    registerHandler('network-update-config', (event, updates) => {
      return this.networkManager?.updateConfig(updates) || null;
    });
    registerHandler('network-is-host-blocked', (event, hostname) => {
      return this.networkManager?.isHostBlocked(hostname) || false;
    });
  }

  _registerStoreHandlers() {
    const registerHandler = (channel, handler) => {
      try {
        ipcMain.handle(channel, handler);
      } catch (e) {
        console.log(`[CommandExecutor] Handler '${channel}' already registered, skipping`);
      }
    };

    registerHandler('store-get', (event, key, defaultValue) => {
      return this.store?.get(key, defaultValue);
    });
    registerHandler('store-set', (event, key, value) => {
      if (this.store) {
        this.store.set(key, value);
        return true;
      }
      return false;
    });
    registerHandler('store-delete', (event, key) => {
      if (this.store) {
        this.store.delete(key);
        return true;
      }
      return false;
    });
    registerHandler('store-has', (event, key) => {
      return this.store?.has(key) || false;
    });
    registerHandler('store-clear', () => {
      if (this.store) {
        this.store.clear();
        return true;
      }
      return false;
    });
  }
}

module.exports = { CommandExecutor };
