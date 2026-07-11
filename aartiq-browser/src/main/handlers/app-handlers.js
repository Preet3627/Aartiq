const { app, ipcMain, dialog, shell, nativeTheme } = require('electron');
const path = require('path');

module.exports = function registerAppHandlers(ipcMain, handlers) {
  const { mainWindow, store, getTopWindow, isDev } = handlers;

  ipcMain.handle('get-app-version', () => app.getVersion() || '1.0.0');

  ipcMain.handle('get-platform', () => ({
    platform: process.platform,
    arch: process.arch,
    mac: process.platform === 'darwin',
    windows: process.platform === 'win32',
    linux: process.platform === 'linux',
  }));

  ipcMain.handle('get-app-icon', async (event, appPath) => {
    const { getAppIcon } = require('./utils.js');
    return await getAppIcon(appPath);
  });

  ipcMain.handle('get-app-icon-base64', async () => {
    try {
      const { getAppIconBase64 } = require('./utils.js');
      return await getAppIconBase64();
    } catch (e) {
      return null;
    }
  });

  ipcMain.handle('get-icon-path', () => path.join(__dirname, 'icon.ico'));

  ipcMain.on('minimize-window', () => mainWindow?.minimize());
  ipcMain.on('maximize-window', () => {
    if (mainWindow) {
      mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    }
  });
  ipcMain.on('close-window', () => mainWindow?.close());
  ipcMain.on('toggle-fullscreen', () => {
    if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });

  ipcMain.handle('bring-window-to-top', async () => {
    if (mainWindow) {
      mainWindow.moveTop();
      return { success: true };
    }
    return { success: false, error: 'No main window' };
  });

  ipcMain.handle('check-for-updates', () => {
    if (app.isPackaged) {
      const { autoUpdater } = require('electron-updater');
      return autoUpdater.checkForUpdatesAndNotify();
    }
    return Promise.resolve({ updateAvailable: false });
  });

  ipcMain.handle('quit-and-install', () => {
    if (require('electron').app.isPackaged) {
      require('electron-updater').autoUpdater.quitAndInstall();
    }
  });

  // Auto-Updater Events
  if (require('electron').app.isPackaged) {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.on('update-available', (info) => { if (mainWindow) mainWindow.webContents.send('update-available', info); });
    autoUpdater.on('update-downloaded', (info) => { if (mainWindow) mainWindow.webContents.send('update-downloaded', info); });
    autoUpdater.on('error', (err) => { if (mainWindow) mainWindow.webContents.send('update-error', err.toString()); });
  }

  ipcMain.handle('open-external-url', async (event, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('show-save-dialog', async (event, options) => {
    return await dialog.showSaveDialog(mainWindow, options);
  });

  ipcMain.handle('show-open-dialog', async (event, options) => {
    return await dialog.showOpenDialog(mainWindow, options);
  });

  ipcMain.handle('open-system-settings', async (event, type) => {
    const settings = {
      network: 'network',
      bluetooth: 'bluetooth',
      notifications: 'notifications',
      privacy: 'privacy',
    };
    if (process.platform === 'darwin') {
      const { exec } = require('child_process');
      exec(`open x-apple.systempreferences:com.apple.${settings[type] || 'General'}Preferences`);
    }
    return { success: true };
  });

  ipcMain.handle('set-as-default-browser', async () => {
    if (process.platform === 'darwin') {
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        exec('defaults write com.apple.launchservices.knownurls -dict-add -string "http:" -string "com.apple.Safari"', (err) => {
          resolve({ success: !err });
        });
      });
    }
    return { success: false };
  });

  ipcMain.handle('set-native-theme-source', (event, source) => {
    nativeTheme.themeSource = source;
    return { success: true };
  });

  ipcMain.handle('get-is-online', () => {
    const { isOnline } = handlers;
    return isOnline;
  });

  // Forward actions from popup windows to the main window
  // Use handle/invoke pattern so the popup can await delivery before closing
  ipcMain.handle('popup-action', async (event, action) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('execute-popup-action', action);
    }
    return { success: true };
  });

  // ============================================================================
  // PROTOCOL HANDLING
  // ============================================================================
  const { protocol } = require('electron');
  
  protocol.handle('comet', (request) => {
    const url = new URL(request.url);
    const resourcePath = url.hostname;
    if (resourcePath === 'extensions') {
      return new Response('<h1>Aartiq Extensions</h1><p>Extensions management</p>', { headers: { 'content-type': 'text/html' } });
    } else if (resourcePath === 'vault') {
      return new Response('<h1>Aartiq Vault</h1><p>Secure vault storage</p>', { headers: { 'content-type': 'text/html' } });
    }
    return new Response('<h1>Aartiq Protocol</h1><p>Not found</p>', { status: 404, headers: { 'content-type': 'text/html' } });
  });

  console.log('[Handlers] App handlers registered');
};