const { ipcMain, BrowserView } = require('electron');
const path = require('path');

module.exports = function registerBrowserHandlers(ipcMain, handlers) {
  const { mainWindow, tabViews, activeTabId, store } = handlers;

  ipcMain.on('create-view', (event, { tabId, url }) => {
    const view = new BrowserView({
      webPreferences: {
        preload: path.join(__dirname, '../../preload.js'),
        contextIsolation: true,
        partition: `persist:tab-${tabId}`
      }
    });
    tabViews.set(tabId, view);
    if (mainWindow) {
      mainWindow.addBrowserView(view);
      view.webContents.loadURL(url || 'https://google.com');
    }
  });

  ipcMain.on('suspend-tab', (event, tabId) => {
    const view = tabViews.get(tabId);
    if (view && mainWindow) {
      mainWindow.removeBrowserView(view);
    }
  });

  ipcMain.on('resume-tab', (event, { tabId, url }) => {
    let view = tabViews.get(tabId);
    if (!view) {
      view = new BrowserView({
        webPreferences: {
          preload: path.join(__dirname, '../../preload.js'),
          contextIsolation: true,
          partition: `persist:tab-${tabId}`
        }
      });
      tabViews.set(tabId, view);
    }
    if (mainWindow) {
      mainWindow.addBrowserView(view);
      view.webContents.loadURL(url);
    }
  });

  ipcMain.on('activate-view', (event, { tabId, bounds }) => {
    const view = tabViews.get(tabId);
    if (view && mainWindow) {
      if (handlers.activeTabId && handlers.activeTabId !== tabId) {
        const prevView = tabViews.get(handlers.activeTabId);
        if (prevView) mainWindow.removeBrowserView(prevView);
      }
      mainWindow.addBrowserView(view);
      if (bounds) mainWindow.setBrowserViewBounds(view, bounds);
      handlers.activeTabId = tabId;
    }
  });

  ipcMain.on('destroy-view', (event, tabId) => {
    const view = tabViews.get(tabId);
    if (view) {
      if (mainWindow) mainWindow.removeBrowserView(view);
      view.webContents.destroy();
      tabViews.delete(tabId);
    }
  });

  ipcMain.on('set-browser-view-bounds', (event, bounds) => {
    if (handlers.activeTabId) {
      const view = tabViews.get(handlers.activeTabId);
      if (view && mainWindow) mainWindow.setBrowserViewBounds(view, bounds);
    }
  });

  ipcMain.on('navigate-browser-view', async (event, { tabId, url }) => {
    const view = tabViews.get(tabId);
    if (view) view.webContents.loadURL(url);
  });

  ipcMain.on('browser-view-go-back', () => {
    const view = tabViews.get(handlers.activeTabId);
    if (view) view.webContents.goBack();
  });

  ipcMain.on('browser-view-go-forward', () => {
    const view = tabViews.get(handlers.activeTabId);
    if (view) view.webContents.goForward();
  });

  ipcMain.on('browser-view-reload', () => {
    const view = tabViews.get(handlers.activeTabId);
    if (view) view.webContents.reload();
  });

  ipcMain.on('change-zoom', (event, deltaY) => {
    const view = tabViews.get(handlers.activeTabId);
    if (view) {
      const current = view.webContents.getZoomFactor();
      view.webContents.setZoomFactor(deltaY > 0 ? current - 0.1 : current + 0.1);
    }
  });

  ipcMain.on('open-dev-tools', () => {
    const view = tabViews.get(handlers.activeTabId);
    if (view) view.webContents.openDevTools();
  });

  ipcMain.handle('execute-javascript', async (event, code) => {
    const view = tabViews.get(handlers.activeTabId);
    if (!view) return { error: 'No active view' };
    try {
      return await view.webContents.executeJavaScript(code);
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('get-browser-view-url', () => {
    const view = tabViews.get(handlers.activeTabId);
    return view ? view.webContents.getURL() : '';
  });

  ipcMain.handle('capture-page-html', async () => {
    const view = tabViews.get(handlers.activeTabId);
    if (!view) return '';
    return await view.webContents.executeJavaScript('document.documentElement.outerHTML');
  });

  ipcMain.handle('capture-browser-view-screenshot', async () => {
    const view = tabViews.get(handlers.activeTabId);
    if (!view) return null;
    const image = await view.webContents.capturePage();
    return image.toDataURL();
  });

  ipcMain.handle('get-open-tabs', async () => {
    const tabs = [];
    for (const [tabId, view] of tabViews) {
      if (view && view.webContents) {
        try {
          tabs.push({
            tabId,
            url: view.webContents.getURL(),
            title: view.webContents.getTitle(),
            isActive: tabId === handlers.activeTabId
          });
        } catch (e) {}
      }
    }
    return tabs;
  });

  console.log('[Handlers] Browser handlers registered');
};