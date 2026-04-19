const { ipcMain } = require('electron');

module.exports = function registerMcpHandlers(ipcMain, handlers) {
  const { store, mcpManager, fileSystemMcp, nativeAppMcp } = handlers;

  ipcMain.handle('mcp-connect-server', async (event, config) => {
    if (!mcpManager) return { success: false, error: 'MCP not initialized' };
    const serverInfo = config.url || (config.command ? `${config.command} ${config.args?.join(' ') || ''}` : 'unknown');
    console.log(`[Main] Connecting to MCP server: ${config.name} (${serverInfo})`);
    const id = config.id || `mcp-${Date.now()}`;
    const success = await mcpManager.connect(id, config);
    if (success) {
      const servers = store.get('mcp_servers') || [];
      if (!servers.find(s => s.id === id)) {
        servers.push({ ...config, id });
        store.set('mcp_servers', servers);
      }
    }
    return { success, id };
  });

  ipcMain.handle('mcp-disconnect-server', async (event, id) => {
    if (!mcpManager) return { success: false };
    await mcpManager.disconnect(id);
    const servers = store.get('mcp_servers') || [];
    const filtered = servers.filter(s => s.id !== id);
    store.set('mcp_servers', filtered);
    return { success: true };
  });

  ipcMain.handle('mcp-list-servers', async () => ({
    success: true,
    servers: mcpManager?.getAllServers() || []
  }));

  ipcMain.handle('mcp-get-tools', async () => {
    if (!mcpManager) return { success: true, tools: [] };
    return { success: true, tools: await mcpManager.getTools() };
  });

  ipcMain.handle('mcp-command', async (event, { command, data }) => {
    if (command === 'connect') return await mcpManager?.connect(data.id, data);
    if (command === 'list') return mcpManager?.getAllServers();
    return { error: 'Unknown MCP command' };
  });

  ipcMain.handle('mcp-fs-read', async (event, filePath) => {
    if (!fileSystemMcp) return { success: false, error: 'FileSystem MCP not initialized' };
    try { const content = await fileSystemMcp.readFile(filePath); return { success: true, content }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('mcp-fs-write', async (event, { path: p, content }) => {
    if (!fileSystemMcp) return { success: false, error: 'FileSystem MCP not initialized' };
    try { const result = await fileSystemMcp.writeFile(p, content); return { success: true, result }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('mcp-fs-list', async (event, dirPath) => {
    if (!fileSystemMcp) return { success: false, error: 'FileSystem MCP not initialized' };
    try { const entries = await fileSystemMcp.listDir(dirPath); return { success: true, entries }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('mcp-fs-approved-dirs', async () => ({
    success: true,
    dirs: fileSystemMcp?.getApprovedDirs() || []
  }));

  ipcMain.handle('mcp-native-applescript', async (event, script) => {
    if (!nativeAppMcp) return { success: false, error: 'NativeApp MCP not initialized' };
    try {
      const { validateCommand } = require('./utils.js');
      validateCommand(script);
      const result = await nativeAppMcp.runAppleScript(script);
      return { success: true, result };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('mcp-native-powershell', async (event, script) => {
    if (!nativeAppMcp) return { success: false, error: 'NativeApp MCP not initialized' };
    try {
      const { validateCommand } = require('./utils.js');
      validateCommand(script);
      const result = await nativeAppMcp.runPowerShell(script);
      return { success: true, result };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('mcp-native-active-window', async () => {
    if (!nativeAppMcp) return { success: false, error: 'NativeApp MCP not initialized' };
    try { const info = await nativeAppMcp.getActiveWindow(); return { success: true, ...info }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('mcp-get-server-status', async (event, id) => {
    return { success: true, status: mcpManager?.getServerStatus(id) };
  });

  ipcMain.handle('mcp-list-tools', async (event, id) => {
    try {
      const tools = await mcpManager.listTools(id);
      return { success: true, tools };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('mcp-call-tool', async (event, { id, toolName, arguments: args }) => {
    try {
      const result = await mcpManager.callTool(id, toolName, args);
      return { success: true, result };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('mcp-remove-server', async (event, id) => {
    if (!mcpManager) return { success: false };
    await mcpManager.disconnect(id);
    const servers = store.get('mcp_servers') || [];
    const updated = servers.filter(s => s.id !== id);
    store.set('mcp_servers', updated);
    return { success: true };
  });

  console.log('[Handlers] MCP handlers registered');
};