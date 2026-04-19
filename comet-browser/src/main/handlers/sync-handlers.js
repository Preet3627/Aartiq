const { ipcMain } = require('electron');
const QRCode = require('qrcode');
const os = require('os');

module.exports = function registerSyncHandlers(ipcMain, handlers) {
  const { store, wifiSyncService, cloudSyncService, p2pSyncService } = handlers;

  ipcMain.handle('get-wifi-sync-uri', () => {
    return wifiSyncService ? wifiSyncService.getConnectUri() : null;
  });

  ipcMain.handle('wifi-sync-broadcast', async (event, message) => {
    if (!wifiSyncService) return { success: false, error: 'WiFi Sync not initialized' };
    wifiSyncService.broadcast(message);
    return { success: true };
  });

  ipcMain.handle('get-wifi-sync-qr', async (event, cloudMode = false) => {
    if (!wifiSyncService) return null;
    let uri;
    if (cloudMode && cloudSyncService && cloudSyncService.isConnected()) {
      uri = wifiSyncService.getCloudConnectUri(cloudSyncService.getDeviceId() || 'unknown');
    } else {
      uri = wifiSyncService.getConnectUri();
    }
    try { return await QRCode.toDataURL(uri); }
    catch (err) { return null; }
  });

  ipcMain.handle('get-wifi-sync-info', () => {
    if (!wifiSyncService) return null;
    return {
      deviceName: os.hostname(),
      pairingCode: wifiSyncService.getPairingCode(),
      ip: wifiSyncService.getLocalIp(),
      port: 3004
    };
  });

  ipcMain.handle('generate-high-risk-qr', async (event, actionId) => {
    const deviceId = os.hostname();
    const token = actionId || Math.random().toString(36).substring(2, 10);
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const deepLinkUrl = `comet-ai://approve?id=${token}&deviceId=${encodeURIComponent(deviceId)}&pin=${pin}`;
    try { return JSON.stringify({ qrImage: await QRCode.toDataURL(deepLinkUrl), pin, token }); }
    catch (err) { return null; }
  });

  ipcMain.handle('login-to-cloud', async (event, email, password) => {
    if (!cloudSyncService) return { success: false, error: 'Cloud sync not initialized' };
    try { await cloudSyncService.login(email, password); return { success: true }; }
    catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('logout-from-cloud', async () => {
    if (!cloudSyncService) return;
    await cloudSyncService.logout();
  });

  ipcMain.handle('save-cloud-config', async (event, provider, config) => {
    if (!cloudSyncService) return { success: false };
    try { await cloudSyncService.configure({ provider, ...config }); return { success: true }; }
    catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('get-cloud-devices', async () => {
    if (!cloudSyncService) return [];
    return cloudSyncService.getDevices();
  });

  ipcMain.handle('connect-to-cloud-device', async (event, deviceId) => {
    if (!cloudSyncService) return { success: false };
    try { const success = await cloudSyncService.connectToDevice(deviceId); return { success }; }
    catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('disconnect-from-cloud-device', async (event, deviceId) => {
    if (!cloudSyncService) return;
    cloudSyncService.disconnectFromDevice(deviceId);
  });

  ipcMain.handle('sync-clipboard', async (event, text) => {
    if (!cloudSyncService) return;
    await cloudSyncService.syncClipboard(text);
  });

  ipcMain.handle('sync-history', async (event, history) => {
    if (!cloudSyncService) return;
    await cloudSyncService.syncHistory(history);
  });

  ipcMain.handle('send-desktop-control', async (event, targetDeviceId, action, args) => {
    if (!cloudSyncService) return { error: 'Cloud sync not initialized' };
    return await cloudSyncService.sendDesktopControl(targetDeviceId, action, args);
  });

  ipcMain.handle('connect-to-remote-device', async (event, remoteDeviceId) => {
    if (!p2pSyncService) return false;
    return await p2pSyncService.connectToRemoteDevice(remoteDeviceId);
  });

  ipcMain.handle('p2p-sync-history', async (event, data) => {
    if (p2pSyncService && p2pSyncService.getStatus().connected) {
      p2pSyncService.sendMessage({ type: 'history-sync', data });
      return { success: true };
    }
    return { success: false, error: 'Not connected to peer' };
  });

  ipcMain.handle('p2p-get-device-id', async () => {
    return p2pSyncService ? p2pSyncService.getStatus().deviceId : null;
  });

  ipcMain.on('send-p2p-signal', (event, { signal, remoteDeviceId }) => {
    if (!p2pSyncService) return;
    p2pSyncService.sendSignal(signal, remoteDeviceId);
  });

  ipcMain.on('wifi-sync-set-last-clipboard', (event, text) => {
    if (wifiSyncService) wifiSyncService._lastReceivedClipboard = text;
  });

  ipcMain.handle('get-active-sync-devices', () => {
    return wifiSyncService ? wifiSyncService.getConnectedDevices() : [];
  });

  ipcMain.handle('sync-remove-device', (event, deviceId) => {
    if (wifiSyncService) wifiSyncService.disconnectDevice(deviceId);
    return { success: true };
  });

  // Flutter Bridge Handlers
  ipcMain.handle('bridge-get-pairing-code', async () => {
    if (!handlers.flutterBridge) return { success: false, error: 'Bridge not initialized' };
    return { success: true, code: handlers.flutterBridge.getPairingCode() };
  });

  ipcMain.handle('bridge-get-status', async () => {
    return {
      running: !!handlers.flutterBridge?.server,
      connectedDevices: handlers.flutterBridge?.getConnectedCount() || 0,
    };
  });

  ipcMain.handle('bridge-rotate-secret', async () => {
    if (!handlers.flutterBridge) return { success: false, error: 'Bridge not initialized' };
    handlers.flutterBridge.rotateSecret();
    return { success: true, code: handlers.flutterBridge.getPairingCode() };
  });

  ipcMain.handle('bridge-broadcast', async (event, message) => {
    if (!handlers.flutterBridge) return { success: false, error: 'Bridge not initialized' };
    handlers.flutterBridge.broadcast(message);
    return { success: true };
  });

  // WiFi Sync Event Listeners
  if (wifiSyncService) {
    wifiSyncService.on('desktop-control', async (data, sendResponse) => {
      const { action, prompt, promptId, args = {} } = data;
      const { streamPromptToMobile, generateShellApprovalQR } = handlers;
      
      if (action === 'send-prompt') {
        if (mainWindow) mainWindow.webContents.send('remote-ai-prompt', { prompt, commandId: promptId, streamToMobile: true });
        const targetModel = args.model || store.get('ollama_model') || 'deepseek-r1:8b';
        const provider = (targetModel.includes('gemini') || targetModel.includes('google')) ? 'google-flash' : 'ollama';
        try {
          if (streamPromptToMobile) await streamPromptToMobile(promptId, prompt, targetModel, provider);
          sendResponse({ success: true, promptId });
        } catch (err) {
          const errMsg = err?.message || String(err);
          wifiSyncService.sendAIResponse(promptId, `Error: ${errMsg}`, false);
          sendResponse({ success: false, error: errMsg });
        }
      } else if (action === 'get-status') {
        const { screen } = require('electron');
        sendResponse({ success: true, desktopName: os.hostname(), platform: os.platform() });
      } else if (action === 'shell-command') {
        const { exec } = require('child_process');
        exec(args.command, { timeout: 30000 }, (err, stdout, stderr) => {
          sendResponse(err ? { success: false, error: err.message } : { success: true, output: stdout || stderr });
        });
      } else if (action === 'get-clipboard') {
        const { clipboard } = require('electron');
        sendResponse({ success: true, clipboard: clipboard.readText() });
      } else if (action === 'update-setting') {
        const { key, value } = args;
        if (key === 'theme') { require('electron').nativeTheme.themeSource = value; }
        else { const keyMap = { 'llm_provider': 'ai_provider', 'llm_model': 'gemini_model' }; store.set(keyMap[key] || key, value); }
        sendResponse({ success: true });
      } else if (action === 'shutdown' || action === 'restart' || action === 'sleep' || action === 'lock') {
        const powerAction = action;
        const descriptions = { shutdown: 'Shutdown', restart: 'Restart', sleep: 'Sleep', lock: 'Lock' };
        const { qrImage, pin, token } = await generateShellApprovalQR(descriptions[powerAction] || powerAction);
        wifiSyncService.sendToMobile({ action: 'power-approval-qr', commandId: token, pin, powerAction, qrData: qrImage });
        sendResponse({ success: true, awaiting_approval: true });
      } else {
        sendResponse({ success: false, error: `Unknown action: ${action}` });
      }
    });

    wifiSyncService.on('client-connected', () => { if (mainWindow) mainWindow.webContents.send('wifi-sync-status', { connected: true }); });
    wifiSyncService.on('client-disconnected', () => { if (mainWindow) mainWindow.webContents.send('wifi-sync-status', { connected: false }); });
  }

  // Cloud Sync Event Listeners
  if (cloudSyncService) {
    cloudSyncService.on('cloud-prompt', async ({ prompt, promptId, fromDeviceId }) => {
      if (mainWindow) mainWindow.webContents.send('remote-ai-prompt', { prompt, promptId, fromDeviceId });
      const { llmGenerateHandler } = handlers;
      if (llmGenerateHandler) {
        try {
          const targetModel = store.get('ollama_model') || 'deepseek-r1:8b';
          const provider = (targetModel.includes('gemini') || targetModel.includes('google')) ? 'google-flash' : 'ollama';
          const streamEvent = {
            sender: {
              isDestroyed: () => false,
              send: (_channel, data) => {
                if (data?.type === 'text-delta') cloudSyncService.sendAIResponse(fromDeviceId, promptId, data.textDelta || '', true);
                else if (data?.type === 'finish') cloudSyncService.sendAIResponse(fromDeviceId, promptId, '', false);
              }
            }
          };
          await llmGenerateHandler([{ role: 'user', content: prompt }], { model: targetModel, provider }, streamEvent);
        } catch (err) { cloudSyncService.sendAIResponse(fromDeviceId, promptId, `Error: ${err.message}`, false); }
      }
    });

    cloudSyncService.on('cloud-file-sync', ({ files, fromDeviceId }) => {
      if (mainWindow) mainWindow.webContents.send('cloud-files-received', { files, fromDeviceId });
    });
  }

  console.log('[Handlers] Sync handlers registered');
};