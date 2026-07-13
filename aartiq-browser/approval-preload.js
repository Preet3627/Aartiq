const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  mcpApprovalResponse: (requestId, allowed) => {
    ipcRenderer.send('mcp-approval-response', { requestId, allowed });
  },
});
