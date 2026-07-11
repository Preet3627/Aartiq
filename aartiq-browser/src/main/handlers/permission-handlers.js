const { ipcMain } = require('electron');

module.exports = function registerPermissionHandlers(ipcMain, handlers) {
  const { permissionStore, networkSecurityManager } = handlers;

  ipcMain.handle('perm-grant', async (event, { key, level, description, sessionOnly }) => {
    try { permissionStore.grant(key, level, description, sessionOnly !== false); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('perm-revoke', async (event, key) => {
    permissionStore.revoke(key);
    return { success: true };
  });

  ipcMain.handle('perm-revoke-all', async () => {
    permissionStore.revokeAll();
    return { success: true };
  });

  ipcMain.handle('perm-check', async (event, key) => ({
    granted: permissionStore.isGranted(key)
  }));

  ipcMain.handle('perm-list', async () => permissionStore.getAll());

  ipcMain.handle('perm-audit-log', async (event, limit) => {
    return permissionStore.getAuditLog(limit || 100);
  });

  ipcMain.handle('permission-auto-command', async (event, { command, enabled }) => {
    permissionStore.setAutoCommand(command, enabled);
    return { success: true, commands: permissionStore.getAutoApprovedCommands() };
  });

  ipcMain.handle('permission-auto-action', async (event, { actionType, enabled }) => {
    permissionStore.setAutoAction(actionType, enabled);
    return { success: true, actions: permissionStore.getAutoApprovedActions() };
  });

  ipcMain.handle('permission-auto-commands', async () => ({
    commands: permissionStore.getAutoApprovedCommands()
  }));

  ipcMain.handle('permission-auto-actions', async () => ({
    actions: permissionStore.getAutoApprovedActions()
  }));

  ipcMain.handle('set-proxy', async (event, config) => {
    const updates = config
      ? {
          proxyMode: config.mode || 'fixed_servers',
          proxyRules: config.proxyRules || config.rules || config.proxyServer || '',
          proxyBypassRules: config.proxyBypassRules || networkSecurityManager?.getConfig().proxyBypassRules,
        }
      : { proxyMode: 'direct', proxyRules: '' };
    if (networkSecurityManager) await networkSecurityManager.applyConfig(updates);
    return true;
  });

  ipcMain.handle('network-security-get', async () => {
    const config = networkSecurityManager?.getConfig() || {};
    return {
      success: true,
      config,
      restartRequiredFor: config.enableSecureDns || config.preventWebRtcLeaks ? ['secureDns', 'webRtcLeaks'] : [],
    };
  });

  ipcMain.handle('network-security-update', async (event, config) => {
    if (networkSecurityManager) {
      await networkSecurityManager.applyConfig(config);
      const updated = networkSecurityManager.getConfig();
      const restartRequiredFor = [];
      if (config.enableSecureDns !== undefined || config.preventWebRtcLeaks !== undefined) {
        if (config.enableSecureDns || config.preventWebRtcLeaks) restartRequiredFor.push('secureDns', 'webRtcLeaks');
      }
      return { success: true, config: updated, restartRequiredFor };
    }
    return { success: false, config: {}, restartRequiredFor: [], error: 'Network security manager not available' };
  });

  ipcMain.handle('security-settings-get', async () => {
    const storeSettings = permissionStore?.getSettings?.() || {};
    return {
      autoApproveLowRisk: !!storeSettings.autoApproveLowRisk,
      autoApproveMidRisk: !!storeSettings.autoApproveMidRisk,
      requireDeviceUnlockForManualApproval: storeSettings.requireDeviceUnlockForManualApproval !== false,
      requireDeviceUnlockForVaultAccess: storeSettings.requireDeviceUnlockForVaultAccess !== false,
      requireBiometricPerSession: storeSettings.requireBiometricPerSession !== false,
      requireBiometricEveryTime: !!storeSettings.requireBiometricEveryTime,
      autoApprovedCommands: Array.isArray(storeSettings.autoApprovedCommands) ? storeSettings.autoApprovedCommands : [],
      autoApprovedActions: Array.isArray(storeSettings.autoApprovedActions) ? storeSettings.autoApprovedActions : [],
    };
  });

  ipcMain.handle('security-settings-update', async (event, settings) => {
    const updates = {};
    if (settings.autoApproveLowRisk !== undefined) {
      updates.autoApproveLowRisk = !!settings.autoApproveLowRisk;
    }
    if (settings.autoApproveMidRisk !== undefined) {
      updates.autoApproveMidRisk = !!settings.autoApproveMidRisk;
    }
    if (settings.requireDeviceUnlockForManualApproval !== undefined) {
      updates.requireDeviceUnlockForManualApproval = !!settings.requireDeviceUnlockForManualApproval;
    }
    if (settings.requireDeviceUnlockForVaultAccess !== undefined) {
      updates.requireDeviceUnlockForVaultAccess = !!settings.requireDeviceUnlockForVaultAccess;
    }
    if (settings.requireBiometricPerSession !== undefined) {
      updates.requireBiometricPerSession = !!settings.requireBiometricPerSession;
    }
    if (settings.requireBiometricEveryTime !== undefined) {
      updates.requireBiometricEveryTime = !!settings.requireBiometricEveryTime;
    }
    if (Object.keys(updates).length > 0) {
      permissionStore.updateSettings(updates);
    }
    return { success: true };
  });

  console.log('[Handlers] Permission handlers registered');
};