const { ipcMain } = require('electron');
const path = require('path');

module.exports = function registerVoiceWorkflowHandlers(ipcMain, handlers) {
  const { voiceService, workflowRecorder, popSearch, robotService, tesseractOcrService, cometAiEngine, permissionStore } = handlers;

  ipcMain.handle('voice-transcribe', async (event, { audioBase64, format }) => {
    if (!voiceService) return { success: false, error: 'Voice service not initialized' };
    try { const text = await voiceService.transcribeBase64(audioBase64, format || 'wav'); return { success: true, text }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('voice-mic-permission', async () => {
    if (!voiceService) return { success: false, error: 'Voice service not initialized' };
    try { const granted = await voiceService.requestMicPermission(); return { success: true, granted }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('workflow-start', async () => {
    if (!workflowRecorder) return { success: false, error: 'Workflow recorder not initialized' };
    return { success: true, ...workflowRecorder.start() };
  });

  ipcMain.handle('workflow-record', async (event, { type, action }) => {
    if (!workflowRecorder) return { success: false, error: 'Workflow recorder not initialized' };
    const recorded = workflowRecorder.record(type, action);
    return { success: recorded };
  });

  ipcMain.handle('workflow-stop', async () => {
    if (!workflowRecorder) return { success: false, error: 'Workflow recorder not initialized' };
    return { success: true, ...workflowRecorder.stop() };
  });

  ipcMain.handle('workflow-save', async (event, { name, description }) => {
    if (!workflowRecorder) return { success: false, error: 'Workflow recorder not initialized' };
    try { const result = await workflowRecorder.save(name, description); return { success: true, ...result }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('workflow-list', async () => {
    if (!workflowRecorder) return { success: false, error: 'Workflow recorder not initialized' };
    try { const workflows = await workflowRecorder.list(); return { success: true, workflows }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('workflow-replay', async (event, name) => {
    if (!workflowRecorder || !robotService) return { success: false, error: 'Services not initialized' };
    try {
      const results = await workflowRecorder.replay(name, async (step) => {
        if (step.type === 'robot' && robotService) return await robotService.execute(step.action, { skipConfirm: false });
        else if (step.type === 'ocr' && tesseractOcrService) return await tesseractOcrService.ocrClick(step.action.target, cometAiEngine, robotService, permissionStore);
        else if (step.type === 'ai' && cometAiEngine) return await cometAiEngine.chat(step.action);
        return { skipped: true, type: step.type };
      });
      return { success: true, results };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('workflow-delete', async (event, name) => {
    if (!workflowRecorder) return { success: false, error: 'Workflow recorder not initialized' };
    try { const deleted = await workflowRecorder.deleteWorkflow(name); return { success: true, deleted }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('workflow-status', async () => {
    if (!workflowRecorder) return { success: false, error: 'Workflow recorder not initialized' };
    return { success: true, ...workflowRecorder.getStatus() };
  });

  ipcMain.handle('pop-search-show', async (event, { text, x, y }) => {
    if (!popSearch) return { success: false, error: 'PopSearch not initialized' };
    try { popSearch.showPopupAtPosition(x, y, text || ''); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('pop-search-show-at-cursor', async (event, text) => {
    if (!popSearch) return { success: false, error: 'PopSearch not initialized' };
    try { popSearch.showPopupWithText(text || ''); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('pop-search-get-config', async () => {
    if (!popSearch) return { success: false, error: 'PopSearch not initialized' };
    return { success: true, config: popSearch.getConfig() };
  });

  ipcMain.handle('pop-search-update-config', async (event, config) => {
    if (!popSearch) return { success: false, error: 'PopSearch not initialized' };
    try { popSearch.updateConfig(config); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('pop-search-save-config', async (event, data) => {
    const { dialog } = require('electron');
    const { filePath } = await dialog.showSaveDialog({ title: 'Export Config', defaultPath: 'popsearch-config.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (filePath) { require('fs').writeFileSync(filePath, data, 'utf-8'); return { success: true }; }
    return { success: false, canceled: true };
  });

  ipcMain.handle('pop-search-load-config', async () => {
    const { dialog } = require('electron');
    const { canceled, filePaths } = await dialog.showOpenDialog({ title: 'Import Config', filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] });
    if (!canceled && filePaths.length > 0) return require('fs').readFileSync(filePaths[0], 'utf-8');
    return null;
  });

  console.log('[Handlers] Voice & Workflow handlers registered');
};