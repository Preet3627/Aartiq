const fs = require('fs');
const path = require('path');

function createIPCHandlers(ipcMain, app, mainWindow, tabViews, activeTabId, store) {
  
  ipcMain.handle('get-app-version', () => app.getVersion());
  
  ipcMain.handle('get-platform', () => process.platform);
  
  ipcMain.handle('get-app-icon', async (event, appPath) => {
    try {
      const icon = await app.getIcon(appPath);
      return { success: true, icon: icon.toPNG().toString('base64') };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  
  ipcMain.handle('get-is-online', () => {
    return require('dns').lookup('google.com', (err) => !err || err.code === 'ENOTFOUND');
  });
  
  ipcMain.handle('extract-search-results', async (event, tabId) => {
    const view = tabViews.get(tabId);
    if (!view) return { error: 'No active view for extraction' };
    try {
      const results = await view.webContents.executeJavaScript(`
        (() => {
          const organicResults = Array.from(document.querySelectorAll('div.g, li.g, div.rc'));
          const extracted = [];
          for (let i = 0; i < Math.min(3, organicResults.length); i++) {
            const result = organicResults[i];
            const titleElement = result.querySelector('h3');
            const linkElement = result.querySelector('a');
            const snippetElement = result.querySelector('span.st, div.s > div > span');
            if (titleElement && linkElement) {
              extracted.push({ title: titleElement.innerText, url: linkElement.href, snippet: snippetElement ? snippetElement.innerText : '' });
            }
          }
          return extracted;
        })();
      `);
      return { success: true, results };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  
  ipcMain.handle('get-suggestions', async (event, query) => {
    const suggestions = [];
    if (query.length > 0) {
      suggestions.push({ type: 'search', text: `Search Google for "${query}"`, url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
      suggestions.push({ type: 'history', text: `History: ${query} past visit`, url: `https://example.com/history/${query}` });
      suggestions.push({ type: 'bookmark', text: `Bookmark: ${query} docs`, url: `https://docs.example.com/${query}` });
    }
    return suggestions;
  });
  
  ipcMain.handle('save-persistent-data', async (event, { key, data }) => {
    try {
      store.set(key, data);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  
  ipcMain.handle('load-persistent-data', async (event, key) => {
    return store.get(key);
  });
  
  ipcMain.handle('delete-persistent-data', async (event, key) => {
    try {
      store.delete(key);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  
  ipcMain.handle('get-onboarding-state', () => ({
    completed: store.get('onboarding_completed', false),
    step: store.get('onboarding_step', 0)
  }));
  
  ipcMain.handle('set-onboarding-state', (event, partial = {}) => {
    if (partial.completed !== undefined) store.set('onboarding_completed', partial.completed);
    if (partial.step !== undefined) store.set('onboarding_step', partial.step);
    return { success: true };
  });
  
  ipcMain.handle('extract-page-content', async () => {
    const view = tabViews.get(activeTabId);
    if (!view) return { error: 'No active tab' };
    try {
      const content = await view.webContents.executeJavaScript(`
        (() => {
          const body = document.body || document.documentElement;
          return body ? body.innerText.substring(0, 50000) : '';
        })();
      `);
      return { content };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  ipcMain.handle('extract-secure-dom', async () => {
    const view = tabViews.get(activeTabId);
    if (!view) return { error: 'No active tab' };
    try {
      const content = await view.webContents.executeJavaScript(`
        (() => {
          const clean = (el) => {
            if (!el) return '';
            const clone = el.cloneNode(true);
            const scripts = clone.querySelectorAll('script, style, iframe, object, embed');
            scripts.forEach(s => s.remove());
            return clone.innerText || clone.textContent || '';
          };
          return clean(document.body);
        })();
      `);
      return { content };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  ipcMain.handle('search-dom', async (event, query) => {
    const view = tabViews.get(activeTabId);
    if (!view) return { error: 'No active tab' };
    try {
      const results = await view.webContents.executeJavaScript(`
        (() => {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
          const matches = [];
          let node;
          while (node = walker.nextNode()) {
            const text = node.textContent.toLowerCase();
            if (text.includes('${query}')) {
              const parent = node.parentElement;
              if (parent) {
                matches.push({ text: node.textContent.trim().substring(0, 200), tag: parent.tagName });
              }
            }
          }
          return matches.slice(0, 20);
        })();
      `);
      return { results };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  ipcMain.handle('get-selected-text', async () => {
    const view = tabViews.get(activeTabId);
    if (!view) return '';
    try {
      return await view.webContents.executeJavaScript('window.getSelection().toString()');
    } catch {
      return '';
    }
  });
  
  ipcMain.handle('get-google-config', () => ({
    clientId: store.get('google_client_id'),
    apiKey: store.get('google_api_key')
  }));
  
  return { success: true };
}

module.exports = { createIPCHandlers };