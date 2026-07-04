const { app, ipcMain, BrowserWindow, dialog, shell, nativeTheme, screen } = require('electron');
const path = require('path');
const os = require('os');

module.exports = function registerAppHandlers(ipcMain, handlers) {
  const { mainWindow, store, getTopWindow, isDev } = handlers;

  ipcMain.handle('get-app-version', () => ({
    version: app.getVersion(),
    name: app.getName(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  }));

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

  // ============================================================================
  // POPUP WINDOW SYSTEM
  // ============================================================================
  const popupWindows = new Map();

  function createPopupWindow(type, options = {}) {
    if (popupWindows.has(type)) {
      const existing = popupWindows.get(type);
      if (existing && !existing.isDestroyed()) existing.close();
      popupWindows.delete(type);
    }

    const isMacPlatform = process.platform === 'darwin';
    const defaultOptions = {
      width: 1000,
      height: 700,
      frame: isMacPlatform,
      transparent: !isMacPlatform,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: path.join(__dirname, '..', '..', 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
      parent: mainWindow,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: true,
      show: false,
      titleBarStyle: isMacPlatform ? 'hiddenInset' : 'hidden',
    };

    const popup = new BrowserWindow({ ...defaultOptions, ...options });
    popup.setAlwaysOnTop(true, 'screen-saturation');

    const baseUrl = isDev
      ? 'http://localhost:3003'
      : `file://${path.join(__dirname, '..', '..', 'out', 'index.html')}`;

    let route = '';
    switch (type) {
      case 'settings': route = isDev ? '/?panel=settings' : '/settings'; break;
      case 'extensions':
      case 'plugins': route = isDev ? '/?panel=extensions' : '/extensions'; break;
      case 'profile': route = isDev ? '/?panel=profile' : '/profile'; break;
      case 'downloads': route = isDev ? '/?panel=downloads' : '/downloads'; break;
      case 'clipboard': route = isDev ? '/?panel=clipboard' : '/clipboard'; break;
      case 'cart':
      case 'unified-cart': route = '/cart'; break;
      case 'search':
      case 'search-apps': route = isDev ? '/?panel=apps' : '/apps'; break;
      case 'translate': route = isDev ? '/?panel=translate' : '/translate'; break;
      case 'context-menu':
      case 'rightclick': route = isDev ? '/?panel=context-menu' : '/context-menu'; break;
      default: route = `/${type}`;
    }

    let url;
    if (isDev) {
      url = `${baseUrl}${route}`;
    } else {
      const fs = require('fs');
      const routePathIndex = route === '/' ? '/index.html' : `${route}/index.html`;
      const routePathHtml = route === '/' ? '/index.html' : `${route}.html`;
      const fullPathIndex = path.join(__dirname, '..', '..', 'out', routePathIndex);
      const fullPathHtml = path.join(__dirname, '..', '..', 'out', routePathHtml);

      if (fs.existsSync(fullPathIndex)) url = `file://${fullPathIndex}`;
      else if (fs.existsSync(fullPathHtml)) url = `file://${fullPathHtml}`;
      else url = `file://${path.join(__dirname, '..', '..', 'out', 'index.html')}#${route}`;
    }

    popup.loadURL(url);
    popup.once('ready-to-show', () => {
      popup.show();
      popup.focus();
      popup.moveTop();
    });
    popup.on('closed', () => popupWindows.delete(type));
    popupWindows.set(type, popup);
    return popup;
  }

  ipcMain.on('open-popup-window', (event, { type, options }) => {
    createPopupWindow(type, options);
  });

  ipcMain.on('close-popup-window', (event, type) => {
    const popup = popupWindows.get(type);
    if (popup && !popup.isDestroyed()) popup.close();
    popupWindows.delete(type);
  });

  ipcMain.on('close-all-popups', () => {
    popupWindows.forEach((popup) => { if (popup && !popup.isDestroyed()) popup.close(); });
    popupWindows.clear();
  });

  ipcMain.on('open-settings-popup', (event, section = 'profile') => {
    const popup = createPopupWindow('settings', { width: 1200, height: 800 });
    setTimeout(() => { if (popup && !popup.isDestroyed()) popup.webContents.send('set-settings-section', section); }, 500);
  });

  ipcMain.on('open-profile-popup', () => createPopupWindow('profile', { width: 600, height: 700 }));
  ipcMain.on('open-plugins-popup', () => createPopupWindow('plugins', { width: 900, height: 700 }));
  ipcMain.on('open-downloads-popup', () => createPopupWindow('downloads', { width: 400, height: 600 }));
  ipcMain.on('open-clipboard-popup', () => createPopupWindow('clipboard', { width: 450, height: 650 }));
  ipcMain.on('open-cart-popup', () => createPopupWindow('cart', { width: 500, height: 700 }));
  ipcMain.on('open-search-popup', (event, options = {}) => createPopupWindow('search', { width: 600, height: 500, ...options }));
  ipcMain.on('open-translate-popup', (event, options = {}) => createPopupWindow('translate', { width: 400, height: 500, ...options }));
  ipcMain.on('open-context-menu-popup', (event, options = {}) => createPopupWindow('context-menu', { width: 250, height: 400, ...options }));

  // ============================================================================
  // PROTOCOL HANDLING
  // ============================================================================
  const { protocol } = require('electron');
  
  protocol.handle('comet', (request) => {
    const url = new URL(request.url);
    const resourcePath = url.hostname;
    if (resourcePath === 'extensions') {
      return new Response('<h1>Comet Extensions</h1><p>Extensions management</p>', { headers: { 'content-type': 'text/html' } });
    } else if (resourcePath === 'vault') {
      return new Response('<h1>Comet Vault</h1><p>Secure vault storage</p>', { headers: { 'content-type': 'text/html' } });
    }
    return new Response('<h1>Comet Protocol</h1><p>Not found</p>', { status: 404, headers: { 'content-type': 'text/html' } });
  });

  console.log('[Handlers] App handlers registered');
};