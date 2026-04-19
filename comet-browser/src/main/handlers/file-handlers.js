const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

module.exports = function registerFileHandlers(ipcMain, handlers) {
  const { mainWindow, store } = handlers;

  ipcMain.handle('read-file-buffer', async (event, filePath) => {
    try {
      const buffer = await fs.promises.readFile(filePath);
      return buffer.buffer;
    } catch (error) { return new ArrayBuffer(0); }
  });

  ipcMain.handle('select-local-file', async (event, options = {}) => {
    const { dialog } = require('electron');
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: options.directory ? ['openDirectory'] : ['openFile'],
      filters: options.filters || [{ name: 'All Files', extensions: ['*'] }]
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  });

  ipcMain.handle('open-file', async (event, filePath) => {
    const { shell } = require('electron');
    try { await shell.openPath(filePath); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('scan-folder', async (event, folderPath, types) => {
    const { scanDirectoryRecursive } = require('./utils.js');
    return await scanDirectoryRecursive(folderPath, types);
  });

  ipcMain.handle('save-persistent-data', async (event, { key, data }) => {
    store.set(`persistent_${key}`, data);
    return { success: true };
  });

  ipcMain.handle('load-persistent-data', async (event, key) => {
    return store.get(`persistent_${key}`);
  });

  ipcMain.handle('delete-persistent-data', async (event, key) => {
    store.delete(`persistent_${key}`);
    return { success: true };
  });

  ipcMain.handle('get-onboarding-state', () => ({
    completed: store.get('onboarding_completed') || false,
    step: store.get('onboarding_step') || 0,
  }));

  ipcMain.handle('set-onboarding-state', (event, partial = {}) => {
    if (partial.completed !== undefined) store.set('onboarding_completed', partial.completed);
    if (partial.step !== undefined) store.set('onboarding_step', partial.step);
    return { success: true };
  });

  ipcMain.handle('load-skill', async (event, format) => {
    const { skillLoader } = require('../../lib/SkillLoader.ts');
    try { const skill = await skillLoader.load(format); return { success: true, skill }; }
    catch (e) { return { success: false, error: e.message }; }
  });

  const { getAppIconBase64 } = require('./utils.js');
  const { generateCometPDFTemplate } = require('./pdf-utils.js');

  ipcMain.handle('generate-pdf', async (event, options) => {
    // try {
    //   const { generateDocument } = require('../../lib/AdvancedDocumentEngine.ts');
    //   return await generateDocument('pdf', options);
    // } catch (e) {
    // Fallback to legacy template if engine fails or not available
    const title = options.title || 'Comet-AI Document';
    const content = options.content || '';
    const icon = await getAppIconBase64();
    const html = generateCometPDFTemplate(title, content, icon);
    return { success: true, html };
    // }
  });

  ipcMain.handle('generate-xlsx', async (event, options) => {
    return { error: 'Excel generation requires advanced engine' };
  });

  ipcMain.handle('generate-docx', async (event, options) => {
    return { error: 'Word generation requires advanced engine' };
  });

  ipcMain.handle('generate-pptx', async (event, options) => {
    return { error: 'PowerPoint generation requires advanced engine' };
  });

  ipcMain.handle('export-chat-txt', async (event, content) => {
    const { app, dialog } = require('electron');
    const downloadsPath = app.getPath('downloads');
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Chat History',
      defaultPath: path.join(downloadsPath, `comet-chat-${Date.now()}.txt`),
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });
    if (!canceled && filePath) {
      fs.writeFileSync(filePath, content);
      mainWindow.webContents.send('download-started', { name: path.basename(filePath), path: filePath });
      return { success: true };
    }
    return { success: false, error: 'Canceled' };
  });

  ipcMain.handle('export-chat-pdf', async (event, messages) => {
    const { BrowserWindow, dialog, app } = require('electron');
    const os = require('os');

    try {
      // Build chat content from messages
      let chatContent = '';
      let chatTitle = 'Chat Session Export';

      if (Array.isArray(messages)) {
        for (const msg of messages) {
          const role = msg.role === 'user' ? 'You' : (msg.role === 'assistant' ? 'Comet AI' : msg.role);
          const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
          chatContent += `**${role}:** ${content}\n\n`;
        }
        if (messages.length > 0) {
          chatTitle = `Chat Export - ${new Date().toLocaleDateString()}`;
        }
      } else if (typeof messages === 'string') {
        chatContent = messages;
      }

      const iconBase64 = await getAppIconBase64();
      const pdfHtml = generateCometPDFTemplate(chatTitle, chatContent, iconBase64, 'professional', {
        author: 'Comet AI',
        category: 'Chat Session',
        tags: ['chat', 'export', 'comet-ai'],
        watermark: 'CONFIDENTIAL'
      });

      const downloadsPath = app.getPath('downloads');
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Chat as PDF',
        defaultPath: path.join(downloadsPath, `comet-chat-${Date.now()}.pdf`),
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });

      if (!canceled && filePath) {
        let workerWindow = null;
        let tempHtmlPath = '';
        try {
          const tempDir = os.tmpdir();
          tempHtmlPath = path.join(tempDir, `comet_export_${Date.now()}.html`);
          fs.writeFileSync(tempHtmlPath, pdfHtml, 'utf8');

          workerWindow = new BrowserWindow({
            width: 900, height: 1200, show: false,
            webPreferences: { offscreen: true, partition: 'persist:pdf' }
          });

          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('PDF load timeout')), 30000);
            workerWindow.webContents.once('did-finish-load', () => {
              clearTimeout(timeout);
              resolve();
            });
            workerWindow.webContents.once('did-fail-load', (e, err) => {
              clearTimeout(timeout);
              reject(new Error(`Failed to load: ${err}`));
            });
            workerWindow.loadFile(tempHtmlPath).catch(reject);
          });

          const pdfData = await workerWindow.webContents.printToPDF({
            printBackground: true, pageSize: 'A4',
            margins: { top: 0, bottom: 0, left: 0, right: 0 }
          });

          fs.writeFileSync(filePath, pdfData);
          const finalName = path.basename(filePath);
          mainWindow.webContents.send('download-started', { name: finalName, path: filePath });
          setTimeout(() => {
            mainWindow.webContents.send('download-progress', { name: finalName, progress: 100 });
            mainWindow.webContents.send('download-complete', { name: finalName, path: filePath });
          }, 500);

          return { success: true, path: filePath };
        } finally {
          if (workerWindow && !workerWindow.isDestroyed()) workerWindow.destroy();
          if (tempHtmlPath && fs.existsSync(tempHtmlPath)) try { fs.unlinkSync(tempHtmlPath); } catch (e) { }
        }
      }
      return { success: false, error: 'Canceled' };
    } catch (err) {
      console.error('[Export-PDF] Failed:', err);
      return { success: false, error: err.message };
    }
  });

  const { protocol, net } = require('electron');
  try {
    protocol.handle('media', (request) => {
      const filePath = decodeURIComponent(request.url.replace('media://', ''));
      return net.fetch(`file://${path.normalize(filePath)}`);
    });
  } catch (e) {
    console.warn('[Handlers] media protocol already registered or failed');
  }

  console.log('[Handlers] File handlers registered');
};