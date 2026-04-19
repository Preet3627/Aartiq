const { ipcMain, session } = require('electron');
const QRCode = require('qrcode');

module.exports = function registerExtensionHandlers(ipcMain, handlers) {
  const { store, permissionStore, popupWindows, createPopupWindow } = handlers;

  ipcMain.handle('plugins:list', async () => {
    const { pluginManager } = handlers;
    return pluginManager?.getPlugins() || [];
  });

  ipcMain.handle('plugins:get', async (event, pluginId) => {
    const { pluginManager } = handlers;
    return pluginManager?.getPlugin(pluginId) || null;
  });

  ipcMain.handle('plugins:install', async (event, source, options) => {
    const { pluginManager } = handlers;
    if (!pluginManager) return { success: false, error: 'Plugin manager not initialized' };
    return await pluginManager.install(source, options);
  });

  ipcMain.handle('plugins:uninstall', async (event, pluginId) => {
    const { pluginManager } = handlers;
    if (!pluginManager) return { success: false };
    return await pluginManager.uninstall(pluginId);
  });

  ipcMain.handle('plugins:update', async (event, pluginId) => {
    const { pluginManager } = handlers;
    if (!pluginManager) return { success: false };
    return await pluginManager.update(pluginId);
  });

  ipcMain.handle('plugins:enable', async (event, pluginId) => {
    const { pluginManager } = handlers;
    if (!pluginManager) return { success: false };
    return await pluginManager.enable(pluginId);
  });

  ipcMain.handle('plugins:disable', async (event, pluginId) => {
    const { pluginManager } = handlers;
    if (!pluginManager) return { success: false };
    return await pluginManager.disable(pluginId);
  });

  ipcMain.handle('plugins:get-commands', async () => {
    const { pluginManager } = handlers;
    return pluginManager?.getCommands() || [];
  });

  ipcMain.handle('plugins:execute-command', async (event, commandId, params) => {
    const { pluginManager } = handlers;
    if (!pluginManager) return { success: false, error: 'Plugin manager not initialized' };
    return await pluginManager.executeCommand(commandId, params);
  });

  ipcMain.handle('plugins:get-dir', () => {
    const { pluginManager } = handlers;
    return pluginManager?.getPluginsDir() || '';
  });

  ipcMain.handle('plugins:scan', async (event, directory) => {
    const { pluginManager } = handlers;
    if (!pluginManager) return [];
    return await pluginManager.scan(directory);
  });

  ipcMain.handle('plugins:update-config', async (event, pluginId, config) => {
    const { pluginManager } = handlers;
    if (!pluginManager) return { success: false };
    return await pluginManager.updateConfig(pluginId, config);
  });

  ipcMain.handle('plugin-api:log', async (event, { level, message }) => {
    console.log(`[Plugin:${level}] ${message}`);
    return { success: true };
  });

  ipcMain.handle('plugin-api:read-file', async (event, filePath) => {
    const fs = require('fs');
    try { return fs.readFileSync(filePath, 'utf8'); }
    catch (e) { return null; }
  });

  ipcMain.handle('plugin-api:write-file', async (event, { path: filePath, content }) => {
    const fs = require('fs');
    try { fs.writeFileSync(filePath, content); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  // Plugin Events
  if (pluginManager) {
    pluginManager.on('plugin:installed', (manifest) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('plugin:installed', manifest);
    });
    pluginManager.on('plugin:uninstalled', ({ pluginId }) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('plugin:uninstalled', { pluginId });
    });
    pluginManager.on('plugin:config-updated', ({ pluginId, config }) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('plugin:config-updated', { pluginId, config });
    });
  }

  console.log('[Handlers] Plugin handlers registered');
};