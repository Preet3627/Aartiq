const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

module.exports = function registerAuthHandlers(ipcMain, handlers) {
  const { mainWindow, store } = handlers;

  ipcMain.on('save-auth-token', (event, { token, user, ...rest }) => {
    store.set('auth_token', token);
    store.set('auth_user', user);
    if (rest.rememberMe) {
      store.set('auth_remember', true);
    }
  });

  ipcMain.on('save-auth-session', (event, sessionPayload) => {
    store.set('auth_session', sessionPayload);
  });

  ipcMain.handle('get-auth-token', () => store.get('auth_token'));
  ipcMain.handle('get-user-info', () => store.get('auth_user'));
  ipcMain.handle('get-auth-session', () => store.get('auth_session'));

  ipcMain.on('clear-auth', () => {
    store.delete('auth_token');
    store.delete('auth_user');
    store.delete('auth_session');
  });

  ipcMain.handle('get-passwords-for-site', async (event, domain) => {
    const { KeychainManager } = require('./keychain.js');
    if (!KeychainManager) return [];
    try {
      return await KeychainManager.getPasswordsForSite(domain);
    } catch (e) {
      return [];
    }
  });

  ipcMain.handle('vault-list-entries', async () => {
    return store.get('vault_entries') || [];
  });

  ipcMain.handle('vault-save-entry', async (event, payload = {}) => {
    const entries = store.get('vault_entries') || [];
    const entry = { id: Date.now().toString(), ...payload, createdAt: Date.now() };
    entries.push(entry);
    store.set('vault_entries', entries);
    return { success: true, entry };
  });

  ipcMain.handle('vault-delete-entry', async (event, entryId) => {
    const entries = store.get('vault_entries') || [];
    const filtered = entries.filter(e => e.id !== entryId);
    store.set('vault_entries', filtered);
    return { success: true };
  });

  ipcMain.handle('vault-read-secret', async (event, entryId) => {
    const entries = store.get('vault_entries') || [];
    const entry = entries.find(e => e.id === entryId);
    return entry || null;
  });

  ipcMain.handle('vault-copy-secret', async (event, entryId) => {
    const entries = store.get('vault_entries') || [];
    const entry = entries.find(e => e.id === entryId);
    if (entry && entry.password) {
      const { clipboard } = require('electron');
      clipboard.writeText(entry.password);
      return { success: true };
    }
    return { success: false };
  });

  ipcMain.on('propose-password-save', (event, { domain, username, password, type }) => {
    if (mainWindow) {
      mainWindow.webContents.send('show-password-save-dialog', { domain, username, password, type });
    }
  });

  ipcMain.on('propose-form-collection-save', (event, { domain, title, data, type }) => {
    if (mainWindow) {
      mainWindow.webContents.send('show-form-save-dialog', { domain, title, data, type });
    }
  });

  // Auth - Create proper OAuth window instead of opening in external browser
  let authWindow = null;

  ipcMain.on('open-auth-window', (event, authUrl) => {
    const isOAuthUrl = authUrl.includes('accounts.google.com') ||
      authUrl.includes('firebase') ||
      authUrl.includes('oauth') ||
      authUrl.includes('auth');

    if (isOAuthUrl) {
      const { shell, BrowserWindow } = require('electron');
      if (authUrl.includes('accounts.google.com')) {
        if (authWindow && !authWindow.isDestroyed()) { authWindow.destroy(); authWindow = null; }
        shell.openExternal(authUrl);
        return;
      }

      if (authWindow && !authWindow.isDestroyed()) {
        authWindow.focus();
        authWindow.loadURL(authUrl);
        return;
      }

      const isMacPlatform = process.platform === 'darwin';
      const isWinPlatform = process.platform === 'win32';
      authWindow = new BrowserWindow({
        width: 540, height: 780,
        frame: isMacPlatform,
        backgroundColor: '#02030a',
        parent: mainWindow,
        show: false,
        titleBarStyle: 'hidden',
        webPreferences: {
          preload: path.join(__dirname, '..', '..', 'auth-preload.js'),
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      if (!isMacPlatform) authWindow.setMenuBarVisibility(false);
      authWindow.webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
      
      authWindow.webContents.setWindowOpenHandler(({ url }) => ({ action: 'allow' }));

      const closeAuthWindowSafely = () => {
        if (authWindow && !authWindow.isDestroyed()) { authWindow.destroy(); authWindow = null; }
      };

      const dispatchAuthCallback = (deepLinkUrl) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('auth-callback', deepLinkUrl);
          mainWindow.focus();
        }
        setTimeout(closeAuthWindowSafely, 300);
      };

      authWindow.webContents.on('will-navigate', (event, url) => {
        if (url.startsWith('comet-browser://')) { event.preventDefault(); dispatchAuthCallback(url); }
      });

      authWindow.webContents.on('will-redirect', (event, url) => {
        if (url.startsWith('comet-browser://')) { event.preventDefault(); dispatchAuthCallback(url); }
      });

      authWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        if (validatedURL?.startsWith('comet-browser://')) dispatchAuthCallback(validatedURL);
      });

      authWindow.loadURL(authUrl);
      authWindow.once('ready-to-show', () => authWindow.show());
      authWindow.on('closed', () => { authWindow = null; });
    } else {
      require('electron').shell.openExternal(authUrl);
    }
  });

  ipcMain.on('close-auth-window', () => {
    if (authWindow && !authWindow.isDestroyed()) authWindow.close();
    authWindow = null;
  });

  console.log('[Handlers] Auth handlers registered');
};