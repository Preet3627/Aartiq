const { ipcMain } = require('electron');

module.exports = function registerAutofillHandlers(ipcMain, handlers) {
  const { autofillProfileService, mainWindow } = handlers;

  if (!autofillProfileService) {
    console.log('[Handlers] Autofill profile service not available, skipping autofill handlers');
    return;
  }

  ipcMain.handle('autofill:list', async () => {
    return autofillProfileService.listProfiles();
  });

  ipcMain.handle('autofill:get', async (event, id) => {
    return autofillProfileService.getProfile(id);
  });

  ipcMain.handle('autofill:add', async (event, profile) => {
    try {
      const result = autofillProfileService.addProfile(profile);
      return { success: true, profile: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('autofill:update', async (event, id, updates) => {
    try {
      const result = autofillProfileService.updateProfile(id, updates);
      return { success: true, profile: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('autofill:delete', async (event, id) => {
    const success = autofillProfileService.deleteProfile(id);
    return { success };
  });

  ipcMain.handle('autofill:detect', async () => {
    const { tabViews } = handlers;
    const view = tabViews?.get(handlers.activeTabId);
    if (!view || !view.webContents) return { success: false, error: 'No active view' };
    try {
      const { extractPageElementsCode } = require('../lib/autofill/injector');
      const result = await view.webContents.executeJavaScript(extractPageElementsCode());
      const elements = JSON.parse(result);
      return { success: true, elements };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('autofill:fill', async (event, profileId) => {
    const { tabViews } = handlers;
    const view = tabViews?.get(handlers.activeTabId);
    if (!view || !view.webContents) return { success: false, error: 'No active view' };
    try {
      const profile = autofillProfileService.getProfile(profileId);
      if (!profile) return { success: false, error: 'Profile not found' };
      const { extractPageElementsCode, fillFormCode } = require('../lib/autofill/injector');
      const { matchFields } = require('../lib/autofill/FormFieldMatcher');
      const raw = await view.webContents.executeJavaScript(extractPageElementsCode());
      const elements = JSON.parse(raw);
      const matches = matchFields(elements, profile);
      if (matches.length === 0) return { success: true, filled: 0, skipped: 0, details: [] };
      const fillResult = await view.webContents.executeJavaScript(fillFormCode(matches));
      const result = JSON.parse(fillResult);
      return { success: true, ...result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  console.log('[Handlers] Autofill handlers registered');
};
