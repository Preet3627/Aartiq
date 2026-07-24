const { ipcMain, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');

module.exports = function registerExtensionHandlers(ipcMain, handlers) {
  const { extensionManager, store, mainWindow } = handlers;

  ipcMain.handle('get-extensions', async () => {
    if (extensionManager) {
      return extensionManager.getInstalledExtensions();
    }
    const extensions = session.defaultSession.getAllExtensions();
    return extensions.map(ext => ({
      id: ext.id,
      name: ext.name,
      version: ext.version,
      description: ext.description,
      path: ext.path,
      enabled: true,
    }));
  });

  ipcMain.handle('toggle-extension', async (event, id) => {
    if (!extensionManager) {
      return { success: false, error: 'Extension manager not available' };
    }
    try {
      const ext = extensionManager.getExtensionById(id);
      if (ext) {
        if (ext.enabled) {
          await extensionManager.disable(id);
          return { success: true, enabled: false };
        }
        await extensionManager.enable(id);
        return { success: true, enabled: true };
      }
      return { success: false, error: 'Extension not found' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('uninstall-extension', async (event, id) => {
    if (!extensionManager) {
      return false;
    }
    try {
      return await extensionManager.uninstall(id);
    } catch (e) {
      console.error('[Extensions] Uninstall failed:', e);
      return false;
    }
  });

  ipcMain.handle('get-extension-path', () => {
    return extensionManager ? extensionManager.extensionsDir : path.join(require('electron').app.getPath('userData'), 'extensions');
  });

  ipcMain.on('open-extension-dir', () => {
    const dir = extensionManager ? extensionManager.extensionsDir : path.join(require('electron').app.getPath('userData'), 'extensions');
    shell.openPath(dir);
  });

  ipcMain.handle('install-extension-folder', async (event, folderPath) => {
    if (!extensionManager) {
      return { success: false, error: 'Extension manager not available' };
    }
    try {
      const result = await extensionManager.installFromFolder(folderPath);
      return { success: true, extension: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('install-extension-crx', async (event, crxPath) => {
    if (!extensionManager) {
      return { success: false, error: 'Extension manager not available' };
    }
    try {
      const result = await extensionManager.installFromCRX(crxPath);
      return { success: true, extension: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('enable-extension', async (event, id) => {
    if (!extensionManager) return { success: false, error: 'Extension manager not available' };
    try {
      await extensionManager.enable(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('disable-extension', async (event, id) => {
    if (!extensionManager) return { success: false, error: 'Extension manager not available' };
    try {
      await extensionManager.disable(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('select-and-install-extension', async () => {
    if (!extensionManager) return { success: false, error: 'Extension manager not available' };
    try {
      const { canceled, filePaths } = await require('electron').dialog.showOpenDialog({
        properties: ['openDirectory', 'openFile'],
        filters: [{ name: 'Chrome Extension', extensions: ['crx', ''] }],
      });
      if (canceled || filePaths.length === 0) {
        return { success: false, error: 'Cancelled' };
      }
      const selectedPath = filePaths[0];
      if (fs.statSync(selectedPath).isDirectory()) {
        const result = await extensionManager.installFromFolder(selectedPath);
        return { success: true, extension: result, source: 'folder' };
      }
      const result = await extensionManager.installFromCRX(selectedPath);
      return { success: true, extension: result, source: 'crx' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('get-extension-actions', async () => {
    const extInfos = extensionManager ? extensionManager.getInstalledExtensions() : [];
    const actions = [];
    for (const info of extInfos) {
      if (!info.enabled) continue;
      try {
        const ext = session.defaultSession.getExtension(info.id);
        if (!ext) continue;
        const action = ext.action || ext.browserAction;
        if (!action) continue;
        const popup = await new Promise(resolve => action.getPopup(result => resolve(result || '')));
        const title = await new Promise(resolve => action.getTitle(result => resolve(result || info.name)));
        const badgeText = await new Promise(resolve => action.getBadgeText(result => resolve(result || '')));
        const badgeBg = await new Promise(resolve => {
          try { action.getBadgeBackgroundColor(c => resolve(c || [0, 0, 0, 0])); } catch { resolve([0, 0, 0, 0]); }
        });
        actions.push({
          id: info.id,
          name: info.name,
          title,
          popup,
          badgeText,
          badgeBg: Array.isArray(badgeBg) ? badgeBg : [0, 0, 0, 0],
          icons: info.icons,
          enabled: info.enabled,
        });
      } catch (e) {
        console.error('[Extensions] Failed to get action for', info.id, e);
      }
    }
    return actions;
  });

  ipcMain.handle('open-extension-popup', async (event, extensionId) => {
    if (!mainWindow || mainWindow.isDestroyed()) return { success: false, error: 'No main window' };
    try {
      const ext = session.defaultSession.getExtension(extensionId);
      if (!ext) return { success: false, error: 'Extension not found in session' };
      const action = ext.action || ext.browserAction;
      if (!action) return { success: false, error: 'Extension has no action' };
      const popupUrl = await new Promise(resolve => action.getPopup(result => resolve(result || '')));
      if (!popupUrl) {
        action.clicked ? action.clicked() : ext.webContents?.focus();
        return { success: true, action: 'clicked' };
      }
      const { BrowserWindow } = require('electron');
      const popupWin = new BrowserWindow({
        width: 400,
        height: 600,
        resizable: false,
        frame: false,
        show: false,
        parent: mainWindow,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          session: mainWindow.webContents.session,
        },
      });
      popupWin.loadURL(popupUrl);
      popupWin.once('ready-to-show', () => popupWin.show());
      popupWin.on('blur', () => popupWin.close());
      return { success: true, action: 'popup-opened' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.on('close-extension-popup', () => {
    const { BrowserWindow } = require('electron');
    const wins = BrowserWindow.getAllWindows();
    for (const win of wins) {
      if (win !== mainWindow && !win.isDestroyed() && win.getParentWindow() === mainWindow) {
        win.close();
      }
    }
  });

  // Track extension action updates via polling (Extension API doesn't have events)
  let actionPollInterval = null;
  if (extensionManager && mainWindow) {
    actionPollInterval = setInterval(() => {
      try {
        const extensions = session.defaultSession.getAllExtensions();
        for (const ext of extensions) {
          const action = ext.action || ext.browserAction;
          if (!action) continue;
          action.getBadgeText(badge => {
            action.getTitle(title => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('extension-action-updated', {
                  id: ext.id,
                  badgeText: badge || '',
                  title: title || '',
                });
              }
            });
          });
        }
      } catch (e) { /* poll error */ }
    }, 2000);
  }

  if (extensionManager) {
    extensionManager.on('extension-installed', (info) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('extension-installed', info);
      }
    });
    extensionManager.on('extension-removed', (id) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('extension-removed', { id });
      }
    });
    extensionManager.on('extension-updated', ({ id, enabled }) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('extension-updated', { id, enabled });
      }
    });
  }

  console.log('[Handlers] Extension handlers registered');
};
