const { ipcMain } = require('electron');

module.exports = function registerRagHandlers(ipcMain, handlers) {
  const { store, ragService } = handlers;

  const initServiceOnDemand = async (service, initFn, name) => {
    if (service && typeof service.init === 'function') return service;
    try {
      console.log(`[LazyInit] Starting ${name}...`);
      await initFn();
      console.log(`[LazyInit] ${name} ready`);
      return service;
    } catch (e) {
      console.error(`[LazyInit] Failed to start ${name}:`, e.message);
      return service;
    }
  };

  ipcMain.handle('rag-ingest', async (event, { text, source }) => {
    await initServiceOnDemand(ragService, async () => { if (!ragService) return; await ragService.init(); }, 'RAG');
    if (!ragService) return { success: false, error: 'RAG not initialized' };
    try {
      const apiKey = store.get('gemini_api_key') || process.env.GEMINI_API_KEY;
      const count = await ragService.ingest(text, source, apiKey);
      return { success: true, chunksAdded: count };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('rag-retrieve', async (event, { query, k }) => {
    await initServiceOnDemand(ragService, async () => { if (!ragService) return; await ragService.init(); }, 'RAG');
    if (!ragService) return { success: false, error: 'RAG not initialized' };
    try {
      const apiKey = store.get('gemini_api_key') || process.env.GEMINI_API_KEY;
      const results = await ragService.retrieve(query, k, apiKey);
      return { success: true, results };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('rag-context', async (event, { query, k }) => {
    await initServiceOnDemand(ragService, async () => { if (!ragService) return; await ragService.init(); }, 'RAG');
    if (!ragService) return { success: false, error: 'RAG not initialized' };
    try {
      const apiKey = store.get('gemini_api_key') || process.env.GEMINI_API_KEY;
      const context = await ragService.retrieveContext(query, k, apiKey);
      return { success: true, context };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('rag-stats', async () => {
    if (!ragService) return { success: false, error: 'RAG not initialized' };
    return { success: true, ...ragService.getStats() };
  });

  ipcMain.handle('rag-delete-source', async (event, source) => {
    if (!ragService) return { success: false, error: 'RAG not initialized' };
    try { const deleted = await ragService.deleteSource(source); return { success: true, deleted }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('rag-clear', async () => {
    if (!ragService) return { success: false, error: 'RAG not initialized' };
    await ragService.clear();
    return { success: true };
  });

  console.log('[Handlers] RAG handlers registered');
};