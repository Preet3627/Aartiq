const registerAppHandlers = require('./app-handlers.js');
const registerAiHandlers = require('./ai-handlers.js');
const registerAuthHandlers = require('./auth-handlers.js');
const registerBrowserHandlers = require('./browser-handlers.js');
const registerAutomationHandlers = require('./automation-handlers.js');
const registerSyncHandlers = require('./sync-handlers.js');
const registerFileHandlers = require('./file-handlers.js');
const registerPermissionHandlers = require('./permission-handlers.js');
const registerMcpHandlers = require('./mcp-handlers.js');
const registerSystemHandlers = require('./system-handlers.js');
const registerPluginHandlers = require('./plugin-handlers.js');
const registerMemoryHandlers = require('./memory-handlers.js');
const registerRagHandlers = require('./rag-handlers.js');
const registerVoiceWorkflowHandlers = require('./voice-workflow-handlers.js');
const utils = require('./utils.js');

function registerAllHandlers(ipcMain, handlers) {
  console.log('[Handlers] Registering all IPC handlers...');
  
  // Merge utils into handlers for convenience
  const enrichedHandlers = { ...handlers, ...utils };
  
  registerAppHandlers(ipcMain, enrichedHandlers);
  registerAiHandlers(ipcMain, enrichedHandlers);
  registerAuthHandlers(ipcMain, enrichedHandlers);
  registerBrowserHandlers(ipcMain, enrichedHandlers);
  registerAutomationHandlers(ipcMain, enrichedHandlers);
  registerSyncHandlers(ipcMain, enrichedHandlers);
  registerFileHandlers(ipcMain, enrichedHandlers);
  registerPermissionHandlers(ipcMain, enrichedHandlers);
  registerMcpHandlers(ipcMain, enrichedHandlers);
  registerSystemHandlers(ipcMain, enrichedHandlers);
  registerPluginHandlers(ipcMain, enrichedHandlers);
  registerMemoryHandlers(ipcMain, enrichedHandlers);
  registerRagHandlers(ipcMain, enrichedHandlers);
  registerVoiceWorkflowHandlers(ipcMain, enrichedHandlers);
  
  console.log('[Handlers] All IPC handlers registered');
}

module.exports = { registerAllHandlers };