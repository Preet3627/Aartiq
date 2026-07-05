const { ipcMain, BrowserView } = require('electron');
const path = require('path');

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

module.exports = function registerBrowserHandlers(ipcMain, handlers) {
  const { mainWindow, tabViews, activeTabId, store } = handlers;
  const audibleTabs = new Set();

  const applyProxyConfigToSession = (ses) => {
    try {
      const proxyConfig = store.get('proxyConfig');
      if (proxyConfig && proxyConfig.mode !== 'direct') {
        ses.setProxy(proxyConfig).catch(() => {});
      }
    } catch (e) {}
  };

  const getPartition = (tabId) => {
    if (tabId?.startsWith('incognito')) {
      return `incognito-${tabId}`;
    }
    return 'persist:browserview';
  };

  ipcMain.on('create-view', (event, { tabId, url }) => {
    if (tabViews.has(tabId)) return;
    const view = new BrowserView({
      webPreferences: {
        preload: path.join(__dirname, '../../../view_preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        partition: getPartition(tabId)
      }
    });
    view.webContents.setUserAgent(CHROME_UA);
    applyProxyConfigToSession(view.webContents.session);

    tabViews.set(tabId, view);

    if (mainWindow) {
      mainWindow.addBrowserView(view);
      view.webContents.loadURL(url || 'https://google.com');
    }

    view.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
      const isAuth = targetUrl.includes('accounts.google.com') || targetUrl.includes('facebook.com') || targetUrl.includes('oauth') || targetUrl.includes('auth0');
      if (isAuth) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 600, height: 700, center: true,
            autoHideMenuBar: true, parent: mainWindow,
          }
        };
      }
      if (mainWindow) mainWindow.webContents.send('add-new-tab', targetUrl);
      return { action: 'deny' };
    });

    view.webContents.on('did-start-loading', () => {
      mainWindow?.webContents.send('tab-loading-status', { tabId, isLoading: true });
    });
    view.webContents.on('did-stop-loading', () => {
      mainWindow?.webContents.send('tab-loading-status', { tabId, isLoading: false });
    });
    view.webContents.on('did-finish-load', () => {
      mainWindow?.webContents.send('on-tab-loaded', { tabId, url: view.webContents.getURL() });
    });
    view.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      const nonCritical = [-3, -7, -8, -9, -105, -106];
      if (nonCritical.includes(errorCode)) return;
      mainWindow?.webContents.send('tab-load-error', { tabId, errorCode, errorDescription, url });
    });
    view.webContents.on('render-process-gone', (_event, details) => {
      mainWindow?.webContents.send('tab-crashed', { tabId, reason: details.reason });
    });
    view.webContents.on('unresponsive', () => {
      mainWindow?.webContents.send('tab-unresponsive', { tabId });
    });
    view.webContents.on('responsive', () => {
      mainWindow?.webContents.send('tab-responsive', { tabId });
    });
    view.webContents.on('did-navigate', (_event, navUrl) => {
      mainWindow?.webContents.send('browser-view-url-changed', { tabId, url: navUrl });
      if (navUrl.includes('/search?') || navUrl.includes('?q=')) {
        try {
          const parsed = new URL(navUrl);
          const query = parsed.searchParams.get('q') || parsed.searchParams.get('query');
          if (query) mainWindow?.webContents.send('ai-query-detected', query);
        } catch (e) {}
      }
    });
    view.webContents.on('page-title-updated', (_event, title) => {
      mainWindow?.webContents.send('browser-view-title-changed', { tabId, title });
    });
    view.webContents.on('is-currently-audible-changed', (isAudible) => {
      if (isAudible) audibleTabs.add(tabId);
      else audibleTabs.delete(tabId);
      mainWindow?.webContents.send('audio-status-changed', audibleTabs.size > 0);
    });
    view.webContents.on('enter-html-fullscreen-window', () => mainWindow?.setFullScreen(true));
    view.webContents.on('leave-html-fullscreen-window', () => mainWindow?.setFullScreen(false));
  });

  ipcMain.on('suspend-tab', (event, tabId) => {
    const view = tabViews.get(tabId);
    if (view) {
      if (mainWindow) mainWindow.removeBrowserView(view);
      if (view.webContents && !view.webContents.isDestroyed()) {
        view.webContents.destroy();
      }
      tabViews.delete(tabId);
    }
  });

  ipcMain.on('resume-tab', (event, { tabId, url }) => {
    if (tabViews.has(tabId)) return;
    const view = new BrowserView({
      webPreferences: {
        preload: path.join(__dirname, '../../../view_preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        partition: getPartition(tabId)
      }
    });
    view.webContents.setUserAgent(CHROME_UA);
    applyProxyConfigToSession(view.webContents.session);
    tabViews.set(tabId, view);
    if (mainWindow) {
      mainWindow.addBrowserView(view);
      view.webContents.loadURL(url || 'https://www.google.com');
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
      if (bounds) view.setBounds(bounds);
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
      if (view) view.setBounds(bounds);
    }
  });

  ipcMain.on('navigate-browser-view', async (event, { tabId, url }) => {
    const targetId = tabId || handlers.activeTabId;
    const view = tabViews.get(targetId);
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