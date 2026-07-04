const { ipcMain, session } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

module.exports = function registerSystemHandlers(ipcMain, handlers) {
  const { mainWindow, store, extensionsPath } = handlers;

  ipcMain.handle('execute-shell-command', async (event, { rawCommand, preApproved, reason, riskLevel }) => {
    const { execShellCommand } = require('./utils.js');
    return await execShellCommand(rawCommand, preApproved, reason, riskLevel);
  });

  ipcMain.handle('get-extensions', async () => {
    const extensions = session.defaultSession.getAllExtensions();
    return extensions.map(ext => ({
      id: ext.id,
      name: ext.name,
      version: ext.version,
      description: ext.description,
      path: ext.path
    }));
  });

  ipcMain.handle('toggle-extension', async (event, id) => ({ success: true }));

  ipcMain.handle('uninstall-extension', async (event, id) => {
    try {
      const ext = session.defaultSession.getExtension(id);
      if (ext) {
        const extPath = ext.path;
        session.defaultSession.removeExtension(id);
        if (extPath.startsWith(extensionsPath)) {
          fs.rmSync(extPath, { recursive: true, force: true });
        }
        return true;
      }
    } catch (e) { console.error(`Failed to uninstall extension ${id}:`, e); }
    return false;
  });

  ipcMain.handle('get-extension-path', () => extensionsPath);

  ipcMain.on('open-extension-dir', () => {
    const { shell } = require('electron');
    shell.openPath(extensionsPath);
  });

  ipcMain.handle('search-applications', async (event, query) => {
    const { searchApplications } = require('./utils.js');
    return await searchApplications(query);
  });

  ipcMain.handle('open-external-app', async (event, appPath) => {
    const { shell } = require('electron');
    try { await shell.openPath(appPath); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('set-volume', async (event, level) => {
    if (process.platform === 'darwin') {
      exec(`osascript -e 'set volume output volume ${Math.min(100, Math.max(0, level))}'`);
    }
    return { success: true };
  });

  ipcMain.handle('set-brightness', async (event, level) => {
    if (process.platform === 'darwin') {
      exec(`brightness ${level}`);
    }
    return { success: true };
  });

  ipcMain.handle('set-alarm', async (event, { time, message }) => {
    const alarmTime = new Date(time);
    if (process.platform === 'darwin') {
      exec(`osascript -e 'tell application "Reminders" to make new reminder with properties {name:"${message}", remind me date:"${alarmTime.toISOString()}"}'`);
    }
    return { success: true };
  });

  ipcMain.handle('encrypt-data', async (event, { data, key }) => {
    try {
      const salt = crypto.randomBytes(16);
      const { deriveKey } = require('./utils.js');
      const derivedKey = await deriveKey(key, salt);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
      const encrypted = Buffer.concat([cipher.update(Buffer.from(data)), cipher.final()]);
      const authTag = cipher.getAuthTag();
      return { encryptedData: encrypted.buffer, iv: iv.buffer, authTag: authTag.buffer, salt: salt.buffer };
    } catch (error) { return { error: error.message }; }
  });

  ipcMain.handle('decrypt-data', async (event, { encryptedData, key, iv, authTag, salt }) => {
    try {
      const { deriveKey } = require('./utils.js');
      const derivedKey = await deriveKey(key, Buffer.from(salt));
      const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, Buffer.from(iv));
      decipher.setAuthTag(Buffer.from(authTag));
      const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedData)), decipher.final()]);
      return { decryptedData: decrypted.buffer };
    } catch (error) { return { error: error.message }; }
  });

  ipcMain.handle('create-desktop-shortcut', async (event, { url, title }) => {
    const desktopPath = path.join(require('os').homedir(), 'Desktop');
    const shortcutPath = path.join(desktopPath, `${title.replace(/[^a-z0-9]/gi, '_').substring(0, 30)}.url`);
    const content = `[InternetShortcut]\nURL = ${url}\n`;
    try { fs.writeFileSync(shortcutPath, content); return { success: true, path: shortcutPath }; }
    catch (error) { return { error: error.message }; }
  });

  // ============================================================================
  // BIOMETRIC AUTHENTICATION
  // ============================================================================
  try {
    const { BiometricAuthManager, CrossPlatformBiometricAuth } = require('../../service/biometric-auth.js');
    const biometricAuth = new BiometricAuthManager();
    const crossPlatformAuth = new CrossPlatformBiometricAuth();

    ipcMain.handle('biometric-check', async () => await biometricAuth.quickCheck());
    ipcMain.handle('biometric-authenticate', async (event, reason) => await biometricAuth.authenticate(reason || 'Authenticate to proceed'));
    ipcMain.handle('biometric-execute', async (event, actions, reason) => await crossPlatformAuth.executeWithAuth(actions, reason || 'Execute critical action'));
    console.log('[Handlers] Biometric authentication registered');
  } catch (error) {
    console.warn('[Handlers] Biometric auth unavailable:', error.message);
  }

  ipcMain.on('raycast-update-state', (event, state) => {
    const { raycastState } = handlers;
    if (raycastState) {
      if (state?.tabs) raycastState.tabs = state.tabs.slice(-100);
      if (state?.history) raycastState.history = state.history.slice(-200);
    }
  });

  console.log('[Handlers] System handlers registered');
};