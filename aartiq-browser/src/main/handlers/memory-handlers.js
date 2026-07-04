const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

module.exports = function registerMemoryHandlers(ipcMain, handlers) {
  const { store } = handlers;

  const memoryFile = path.join(require('electron').app.getPath('userData'), 'memory.json');
  
  function readMemory() {
    try { return JSON.parse(fs.readFileSync(memoryFile, 'utf8') || '[]'); }
    catch { return []; }
  }
  
  function appendToMemory(entry) {
    const memory = readMemory();
    memory.push({ ...entry, timestamp: Date.now() });
    fs.writeFileSync(memoryFile, JSON.stringify(memory.slice(-1000)));
  }

  ipcMain.handle('get-ai-memory', async () => readMemory());
  
  ipcMain.on('add-ai-memory', (event, entry) => appendToMemory(entry));

  ipcMain.handle('save-vector-store', async (event, data) => {
    const vsPath = path.join(require('electron').app.getPath('userData'), 'vector-store.json');
    fs.writeFileSync(vsPath, JSON.stringify(data));
    return { success: true };
  });

  ipcMain.handle('load-vector-store', async () => {
    const vsPath = path.join(require('electron').app.getPath('userData'), 'vector-store.json');
    try { return JSON.parse(fs.readFileSync(vsPath, 'utf8')); }
    catch { return null; }
  });

  ipcMain.handle('memory:collect', async () => {
    const { ragService } = handlers;
    if (ragService?.collect) await ragService.collect();
    return { success: true };
  });

  ipcMain.handle('memory:flush', async () => {
    const { ragService } = handlers;
    if (ragService?.clear) await ragService.clear();
    return { success: true };
  });

  ipcMain.handle('memory:stats', async () => {
    const { ragService } = handlers;
    return ragService?.getStats ? ragService.getStats() : {};
  });

  console.log('[Handlers] Memory handlers registered');
};