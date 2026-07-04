const { ipcMain } = require('electron');
const { exec } = require('child_process');

module.exports = function registerAutomationHandlers(ipcMain, handlers) {
  const { robotService, tesseractOcrService, screenVisionService, permissionStore, cometAiEngine } = handlers;

  ipcMain.handle('robot-execute', async (event, action) => {
    if (!robotService) return { success: false, error: 'RobotService not initialized' };
    try { return await robotService.execute(action); }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('robot-execute-sequence', async (event, { actions, options }) => {
    if (!robotService) return { success: false, error: 'RobotService not initialized' };
    try { return await robotService.executeSequence(actions, options); }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('robot-kill', async () => {
    if (robotService) robotService.kill();
    return { success: true };
  });

  ipcMain.handle('robot-reset-kill', async () => {
    if (robotService) robotService.resetKill();
    return { success: true };
  });

  ipcMain.handle('robot-status', async () => ({
    available: robotService?.isAvailable || false,
    permitted: permissionStore?.isGranted('robot') || false,
    killActive: robotService?.killFlag || false,
  }));

  ipcMain.handle('perform-ocr', async (event, options) => {
    if (!tesseractOcrService) return { error: 'OCR service not initialized' };
    return await tesseractOcrService.captureAndOcr(options);
  });

  ipcMain.handle('ocr-capture-words', async (event, displayId) => {
    if (!tesseractOcrService) return { success: false, error: 'OCR service not initialized' };
    try { return { success: true, ...await tesseractOcrService.captureAndOcr(displayId) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('ocr-click', async (event, { target, useAi }) => {
    if (!tesseractOcrService || !robotService) return { success: false, error: 'Services not initialized' };
    try { return await tesseractOcrService.ocrClick(target, useAi !== false ? cometAiEngine : null, robotService, permissionStore); }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('ocr-screen-text', async (event, displayId) => {
    if (!tesseractOcrService) return { success: false, error: 'OCR service not initialized' };
    try { return { success: true, text: await tesseractOcrService.getScreenText(displayId) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('vision-describe', async (event, question) => {
    if (!screenVisionService) return { success: false, error: 'Vision service not initialized' };
    try { return { success: true, description: await screenVisionService.describe(question) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('vision-analyze', async (event, question) => {
    if (!screenVisionService || !tesseractOcrService) return { success: false, error: 'Services not initialized' };
    try { return { success: true, ...await screenVisionService.analyzeAndAct(question, tesseractOcrService, robotService, permissionStore) }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('vision-capture-base64', async () => {
    if (!screenVisionService) return { success: false, error: 'Vision service not initialized' };
    try { return { success: true, image: await screenVisionService.captureBase64() }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('classify-tabs-ai', async (event, { tabs }) => {
    if (!cometAiEngine) return { success: false, error: 'AI engine not initialized' };
    try {
      const tabData = tabs.map(t => `- [${t.id}] ${t.title} (${t.url})`).join('\n');
      const prompt = `Classify the following browser tabs into logical groups. Respond ONLY with a JSON object where keys are tab IDs and values are group names.\n\nTabs:\n${tabData}`;
      const response = await cometAiEngine.chat({ message: prompt, systemPrompt: 'Respond only with valid JSON.' });
      const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
      return { success: true, classifications: JSON.parse(cleanJson) };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('click-element', async (event, selector) => {
    const { tabViews, activeTabId, checkAiActionPermission } = handlers;
    const view = tabViews?.get(activeTabId);
    if (!view) return { success: false, error: 'No active view' };
    const permission = checkAiActionPermission ? checkAiActionPermission('CLICK_ELEMENT', selector, 'medium') : { allowed: true };
    if (!permission.allowed) return { success: false, error: permission.error };
    try {
      await view.webContents.executeJavaScript(`
        (() => {
          const el = document.querySelector("${selector}");
          if (el) { el.click(); return true; }
          return false;
        })()
      `);
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('capture-browser-view-screenshot', async () => {
    const { tabViews, activeTabId } = handlers;
    const view = tabViews?.get(activeTabId);
    if (!view) return null;
    try {
      const image = await view.webContents.capturePage();
      if (!image || image.isEmpty()) return null;
      return `data:image/png;base64,${image.toPNG().toString('base64')}`;
    } catch (e) { return null; }
  });

  console.log('[Handlers] Automation handlers registered');
};