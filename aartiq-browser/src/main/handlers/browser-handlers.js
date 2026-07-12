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
    return ''; // default session — shares cookies with popups/OAuth
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
      if (tabViews._activeTabId !== undefined) tabViews._activeTabId = tabId;
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
      const wc = view.webContents;
      if (!wc || wc.isDestroyed()) return { error: 'No active view' };
      return await wc.executeJavaScript(code);
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('get-browser-view-url', () => {
    const view = tabViews.get(handlers.activeTabId);
    if (!view) return '';
    const wc = view.webContents;
    return wc && !wc.isDestroyed() ? wc.getURL() : '';
  });

  ipcMain.handle('capture-page-html', async () => {
    const view = tabViews.get(handlers.activeTabId);
    if (!view) return '';
    const wc = view.webContents;
    if (!wc || wc.isDestroyed()) return '';
    return await wc.executeJavaScript('document.documentElement.outerHTML');
  });

  ipcMain.handle('capture-browser-view-screenshot', async () => {
    const view = tabViews.get(handlers.activeTabId);
    if (!view) return null;
    const wc = view.webContents;
    if (!wc || wc.isDestroyed()) return null;
    const image = await wc.capturePage();
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

  ipcMain.handle('search-dom', async (event, query) => {
    const view = tabViews.get(handlers.activeTabId);
    if (!view) return { error: 'No active view', results: [] };

    if (!query || typeof query !== 'string') {
      return { error: 'Invalid query', results: [] };
    }

    try {
      const wc = view.webContents;
      if (!wc || wc.isDestroyed()) return { error: 'No active view', results: [] };

      const results = await wc.executeJavaScript(`
        (() => {
          const query = ${JSON.stringify(query)};
          const searchLower = query.toLowerCase();
          const results = [];
          
          function walk(el, path = '') {
            if (['script', 'style', 'noscript', 'iframe', 'nav', 'footer', 'header'].includes(el.tagName.toLowerCase())) return;
            
            const tag = el.tagName.toLowerCase();
            const xpath = path ? path + '/' + tag : '//' + tag;
            
            let text = '';
            for (const node of el.childNodes) {
              if (node.nodeType === 3) text += node.textContent || '';
              else if (node.nodeType === 1) walk(node, xpath);
            }
            
            const textLower = text.toLowerCase();
            const idx = textLower.indexOf(searchLower);
            
            if (idx !== -1) {
              const start = Math.max(0, idx - 40);
              const end = Math.min(text.length, idx + query.length + 40);
              const context = text.slice(start, end);
              
              let score = 10;
              if (textLower.startsWith(searchLower)) score += 20;
              if (textLower.includes(' ' + searchLower)) score += 10;
              if (text.length < 200) score += 15;
              
              results.push({
                text: text.slice(Math.max(0, idx - 20), idx) + '[[' + text.slice(idx, idx + query.length) + ']]' + text.slice(idx + query.length, idx + query.length + 20),
                context: context,
                xpath: xpath,
                score: score,
                tag: tag
              });
            }
          }
          
          walk(document.body);
          
          return results.sort((a, b) => b.score - a.score).slice(0, 15);
        })()
      `);

      return { results: results || [], query };
    } catch (e) {
      console.error('[SecureDOM] Search failed:', e);
      return { error: e.message, results: [] };
    }
  });

  ipcMain.handle('dom-fill-form', async (event, opts) => {
    const { selector, value, retry = 2, verify = false, clearFirst = true } = opts || {};
    const view = tabViews.get(handlers.activeTabId);
    if (!view || !view.webContents) {
      return { success: false, error: 'Browser view not found' };
    }

    const fillCode = `
      (async () => {
        const MAX_RETRIES = ${JSON.stringify(retry)};
        const TARGET_VALUE = ${JSON.stringify(value || '')};

        function findElement() {
          ${selector ? `const el = document.querySelector(${JSON.stringify(selector)});
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return el;` : ''}

          ${selector ? (() => {
            const nameMatch = selector.match(/\[name=["']([^"']+)["']\]/);
            if (nameMatch) {
              return `{
              const byName = document.querySelector('input[name="${nameMatch[1]}"], textarea[name="${nameMatch[1]}"]');
              if (byName) return byName;
            }`;
            }
            return '';
          })() : ''}

          const allInputs = document.querySelectorAll('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
          for (const inp of allInputs) {
            const ph = (inp.placeholder || inp.title || '').toLowerCase();
            if (ph && TARGET_VALUE.toLowerCase().includes(ph) && inp.offsetParent !== null) return inp;
          }
          for (const inp of allInputs) {
            const r = inp.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && inp.offsetParent !== null) return inp;
          }
          return null;
        }

        function reactSetValue(el, val) {
          const tag = el.tagName;
          if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
            el.textContent = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return;
          }
          const previousValue = el.value;
          const proto = el.constructor.prototype;
          const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (nativeSetter) nativeSetter.call(el, val);
          else el.value = val;
          const tracker = el._valueTracker;
          if (tracker) tracker.setValue(previousValue);
          try {
            el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: val }));
          } catch (_) {
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }

        for (let retry = 0; retry < MAX_RETRIES; retry++) {
          const element = findElement();
          if (!element) {
            if (retry < MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 200));
            continue;
          }
          try {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(r => setTimeout(r, 100));
            element.focus();
            ${clearFirst ? `
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
              const proto = element.constructor.prototype;
              const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
              if (nativeSetter) nativeSetter.call(element, '');
              else element.value = '';
              const tracker = element._valueTracker;
              if (tracker) tracker.setValue(element.value);
              try {
                element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContent', data: null }));
              } catch (_) {
                element.dispatchEvent(new Event('input', { bubbles: true }));
              }
            } else {
              element.innerHTML = '';
            }
            await new Promise(r => setTimeout(r, 50));
            ` : ''}
            reactSetValue(element, TARGET_VALUE);
            ${verify ? `
            await new Promise(r => setTimeout(r, 100));
            const currentVal = element.value || element.textContent || '';
            if (currentVal === TARGET_VALUE || currentVal.includes(TARGET_VALUE) || TARGET_VALUE.includes(currentVal)) {
              return { success: true, value: currentVal.substring(0, 100), verified: true };
            }
            ` : ''}
            return { success: true, value: TARGET_VALUE.substring(0, 100) };
          } catch (e) {
            if (retry < MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 200));
          }
        }
        return { success: false, error: 'Failed to fill form after ' + MAX_RETRIES + ' retries' };
      })()
    `;

    try {
      const result = await view.webContents.executeJavaScript(fillCode);
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('get-selected-text', async () => {
    const view = tabViews.get(handlers.activeTabId);
    if (!view) return '';
    try {
      const selectedText = await view.webContents.executeJavaScript(`window.getSelection().toString();`);
      return selectedText;
    } catch (e) {
      console.error('[Handlers] Failed to get selected text:', e);
      return '';
    }
  });

  ipcMain.on('hide-all-views', () => {
    if (handlers.activeTabId && tabViews.has(handlers.activeTabId)) {
      const view = tabViews.get(handlers.activeTabId);
      if (view && mainWindow) {
        mainWindow.removeBrowserView(view);
      }
    }
  });

  ipcMain.on('show-all-views', () => {
    if (handlers.activeTabId && tabViews.has(handlers.activeTabId)) {
      const view = tabViews.get(handlers.activeTabId);
      if (view && mainWindow) {
        mainWindow.addBrowserView(view);
      }
    }
  });

  ipcMain.handle('click-element', async (event, selector) => {
    const view = tabViews.get(handlers.activeTabId);
    if (!view) return { success: false, error: 'No active view' };
    const permission = handlers.checkAiActionPermission('CLICK_ELEMENT', selector, 'medium');
    if (!permission.allowed) {
      return { success: false, error: permission.error };
    }
    try {
      const result = await handlers.resolveAndClickWithAi(view.webContents, selector, handlers.cometAiEngine);
      return result?.success
        ? { ...result, success: true }
        : { success: false, error: `No clickable DOM target found for "${selector}"`, candidates: result?.candidates || [] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('type-text', async (event, { selector, text }) => {
    const view = tabViews.get(handlers.activeTabId);
    if (!view) return { success: false, error: 'No active view' };
    const permission = handlers.checkAiActionPermission('FILL_FORM', selector, 'medium');
    if (!permission.allowed) {
      return { success: false, error: permission.error };
    }
    try {
      const vaultApproval = await handlers.ensureVaultApprovalForFormFill({ [selector]: text });
      if (!vaultApproval.success) {
        return { success: false, error: vaultApproval.error };
      }

      await view.webContents.executeJavaScript(`
      (() => {
        const selector = ${JSON.stringify(selector)};
        const value = ${JSON.stringify(text ?? '')};
        const el = document.querySelector(selector);
        if (el) {
          el.focus();
          el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
      })()
    `);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fill-form', async (event, formData) => {
    const view = tabViews.get(handlers.activeTabId);
    if (!view) return { success: false, error: 'No active view' };
    const permissionTarget = formData && typeof formData === 'object'
      ? Object.keys(formData).slice(0, 5).join(',') || 'form'
      : 'form';
    const permission = handlers.checkAiActionPermission('FILL_FORM', permissionTarget, 'medium');
    if (!permission.allowed) {
      return { success: false, error: permission.error };
    }
    try {
      const vaultApproval = await handlers.ensureVaultApprovalForFormFill(formData);
      if (!vaultApproval.success) {
        return { success: false, error: vaultApproval.error };
      }

      await view.webContents.executeJavaScript(`
      (() => {
        const data = ${JSON.stringify(formData)};
        let successCount = 0;
        for (const [selector, value] of Object.entries(data)) {
           const el = document.querySelector(selector);
           if (el) {
             el.focus();
             el.value = value;
             el.dispatchEvent(new Event('input', { bubbles: true }));
             el.dispatchEvent(new Event('change', { bubbles: true }));
             successCount++;
           }
        }
        return successCount;
      })()
    `);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('find-and-click-text', async (_event, targetText) => {
    if (!targetText || typeof targetText !== 'string' || targetText.trim().length === 0) {
      return { success: false, error: 'Target text is required.' };
    }

    const permission = handlers.checkAiActionPermission('FIND_AND_CLICK', targetText.trim(), 'medium');
    if (!permission.allowed) {
      return { success: false, error: permission.error };
    }

    const automationMode = store.get('automation_mode') || 'dom';
    const preferOcr = automationMode === 'ocr';

    try {
      if (preferOcr) {
        if (!handlers.tesseractOcrService) return { success: false, error: 'OCR service not initialized.' };
        const result = await handlers.tesseractOcrService.ocrClick(targetText.trim(), handlers.cometAiEngine, handlers.robotService, handlers.permissionStore);
        if (result.success) return result;
      }

      const view = tabViews.get(handlers.activeTabId);
      if (view && !view.webContents.isDestroyed()) {
        try {
          const domResult = await handlers.resolveAndClickWithAi(view.webContents, targetText.trim(), handlers.cometAiEngine);
          if (domResult?.success) {
            return { ...domResult, provider: 'browser-dom' };
          }
        } catch (domError) {
          console.warn('[Handlers] DOM find-and-click fallback to OCR:', domError.message);
        }
      }

      if (!preferOcr) {
        if (!handlers.tesseractOcrService) return { success: false, error: 'OCR service not initialized.' };
        const result = await handlers.tesseractOcrService.ocrClick(targetText.trim(), handlers.cometAiEngine, handlers.robotService, handlers.permissionStore);
        if (result.success) return result;
      }

      return { success: false, error: 'Could not find and click the target element.' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('extract-secure-dom', async () => {
    const view = tabViews.get(handlers.activeTabId);
    if (!view) return { error: 'No active view', content: '', elements: [], metadata: {} };

    try {
      const result = await view.webContents.executeJavaScript(`
        (() => {
          const BLOCKED_TAGS = ['script', 'style', 'noscript', 'iframe', 'object', 'embed', 'applet', 'form', 'input', 'button', 'select', 'textarea'];
          const BLOCKED_CLASSES = [/nav/i, /footer/i, /header/i, /sidebar/i, /menu/i, /popup/i, /modal/i, /overlay/i, /cookie/i, /banner/i, /advertisement/i];
          const PII_PATTERNS = [
            /\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b/g,
            /\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b/g,
            /Bearer\\s+[A-Za-z0-9\\-_]+\\.[A-Za-z0-9\\-_]+\\.[A-Za-z0-9\\-_]+/gi,
            /session[_-]?id["\\s:=]+["']?[A-Za-z0-9\\-_]+["']?/gi,
          ];

          function shouldBlock(el) {
            if (BLOCKED_TAGS.includes(el.tagName.toLowerCase())) return true;
            for (const p of BLOCKED_CLASSES) {
              if (p.test(el.className) || p.test(el.id)) return true;
            }
            return false;
          }

          function sanitizeText(text) {
            let result = text;
            for (const p of PII_PATTERNS) {
              result = result.replace(p, '[REDACTED]');
            }
            return result.replace(/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]/g, '').replace(/\\s+/g, ' ').trim();
          }

          function extractElements(el, path = '') {
            if (shouldBlock(el)) return [];
            const tag = el.tagName.toLowerCase();
            const xpath = path ? path + '/' + tag : '//' + tag;

            let text = '';
            const children = [];

            for (const node of el.childNodes) {
              if (node.nodeType === 3) text += node.textContent || '';
              else if (node.nodeType === 1) {
                const childResults = extractElements(node, xpath);
                children.push(...childResults);
              }
            }

            const sanitized = sanitizeText(text);
            if (!sanitized.trim() && children.length === 0) return [];

          const attributes = {};
          if (el.attributes) {
            for (const attr of el.attributes) {
              attributes[attr.name] = attr.value;
            }
          }

          return [{
            tag,
            text: sanitized,
            xpath,
            attributes,
            children: children.map(c => ({
              tag: c.tag,
              text: c.text,
              xpath: c.xpath,
              attributes: c.attributes,
              children: c.children
            }))
          }];
        }

        const links = [];
        for (const a of document.querySelectorAll('a[href]')) {
          const href = a.href;
          const title = a.textContent?.trim() || a.title || '';
          const visibleText = a.innerText?.trim() || '';
          if (href && (title || visibleText) && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {
            links.push({ href, title: title || visibleText, text: visibleText });
          }
        }

        const main = document.querySelector('main, article, [role="main"], #content, #main, .content') || document.body;
        const elements = [];
        for (const child of main.children) {
          elements.push(...extractElements(child));
        }

        const content = elements.map(e => e.text).filter(Boolean).join('\n');
        const fullText = document.body.innerText || content;

        return {
          content: sanitizeText(fullText),
          elements,
          links,
          url: window.location.href,
          title: document.title,
          scriptsRemoved: document.querySelectorAll('script').length,
          stylesRemoved: document.querySelectorAll('style').length,
          navRemoved: document.querySelectorAll('nav').length
        };
      })()
    `);

      return {
        content: result.content || '',
        elements: result.elements || [],
        links: result.links || [],
        metadata: {
          url: result.url || '',
          title: result.title || '',
          timestamp: Date.now(),
          injectionDetected: false,
          filterStats: {
            piiRemoved: (result.content || '').match(/\[REDACTED\]/g)?.length || 0,
            scriptsRemoved: result.scriptsRemoved || 0,
            stylesRemoved: result.stylesRemoved || 0,
            navRemoved: result.navRemoved || 0,
            adsRemoved: 0
          }
        }
      };
    } catch (e) {
      return { error: e.message, content: '', elements: [], metadata: {} };
    }
  });

  ipcMain.handle('translate-website', async (event, { targetLanguage, method }) => {
    const view = tabViews.get(handlers.activeTabId);
    if (!view) return { error: 'No active view' };

    const translationMethod = method || 'google';

    if (translationMethod === 'chrome-ai') {
      try {
        const code = `
        (async () => {
          try {
            if (!window.translation) {
              return { error: 'Translation API not available. Use Chrome 144+ or enable --enable-features=TranslationAPI' };
            }
            const canTranslate = await window.translation.canTranslate({
              sourceLanguage: 'auto',
              targetLanguage: '${targetLanguage}'
            });
            if (canTranslate === 'no') {
              return { error: 'Cannot translate to ' + '${targetLanguage}' + '. Language pack may not be downloaded.' };
            }
            const translator = await window.translation.createTranslator({
              sourceLanguage: 'auto',
              targetLanguage: '${targetLanguage}'
            });
            const bodyText = document.body.innerText;
            const translated = await translator.translate(bodyText);
            return { success: true, method: 'chrome-ai', note: 'AI translation successful. For full page translation, language packs are downloaded automatically.' };
          } catch (e) {
            return { error: e.message };
          }
        })()
        `;
        const result = await view.webContents.executeJavaScript(code);
        return result;
      } catch (e) {
        return { error: e.message };
      }
    } else {
      try {
        const code = `
      (function() {
        const lang = '${targetLanguage}';
        document.cookie = 'googtrans=/auto/' + lang + '; path=/; domain=' + window.location.hostname;
        document.cookie = 'googtrans=/auto/' + lang + '; path=/;';

        if (!document.getElementById('google_translate_element')) {
          const div = document.createElement('div');
          div.id = 'google_translate_element';
          div.style.display = 'none';
          document.body.appendChild(div);

          window.googleTranslateElementInit = function() {
            new google.translate.TranslateElement({
              pageLanguage: 'auto',
              layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
              autoDisplay: true
            }, 'google_translate_element');
          };

          const script = document.createElement('script');
          script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
          document.body.appendChild(script);
        } else {
          const combo = document.querySelector('.goog-te-combo');
          if (combo) {
            combo.value = lang;
            combo.dispatchEvent(new Event('change'));
          }
        }

        let attempts = 0;
        const check = setInterval(function() {
          const combo = document.querySelector('.goog-te-combo');
          if (combo) {
            if (combo.value !== lang) {
              combo.value = lang;
              combo.dispatchEvent(new Event('change'));
            }
            clearInterval(check);
          }
            if (attempts++ > 20) clearInterval(check);
        }, 500);
      })()
    `;
        await view.webContents.executeJavaScript(code);
        return { success: true, method: 'google' };
      } catch (e) {
        return { error: e.message };
      }
    }
  });

  ipcMain.handle('dom-click-element', async (event, opts) => {
    const { selector, text, 'aria-label': ariaLabel, retry = 2, verify = false } = opts || {};
    const view = tabViews.get(handlers.activeTabId);

    if (!view || !view.webContents) {
      return { success: false, error: 'Browser view not found' };
    }

    try {
      const clickCode = `
        (async () => {
          const MAX_RETRIES = ${retry};
          const RETRY_DELAY = 200;
          const strategies = [];

          ${selector ? `strategies.push(() => document.querySelector(${JSON.stringify(selector)}));` : ''}

          ${text ? `strategies.push(() => {
            const t = ${JSON.stringify(text)}.toLowerCase();
            const clickables = document.querySelectorAll('button, a, input[type="submit"], input[type="button"], [role="button"], [role="link"], [role="option"], [role="tab"], [role="menuitem"], [onclick], .btn, .button');
            for (const el of clickables) {
              const elText = (el.textContent || el.value || '').toLowerCase().trim();
              if (elText === t || elText.includes(t)) return el;
            }
            const all = document.querySelectorAll('*');
            for (const el of all) {
              if (el.children.length === 0 || el.tagName === 'BUTTON' || el.tagName === 'A') {
                const elText = (el.textContent || '').toLowerCase().trim();
                if (elText === t || elText.includes(t)) return el;
              }
            }
            return null;
          });` : ''}

          ${ariaLabel ? `strategies.push(() => document.querySelector([aria-label="${ariaLabel.replace(/"/g, '\\"')}"]));` : ''}

          ${text ? `strategies.push(() => {
            const t = ${JSON.stringify(text)}.toLowerCase();
            return document.querySelector([placeholder*="${t}"], [title*="${t}"], [aria-label*="${t}"]);
          });` : ''}

          async function findAndClick() {
            for (let retry = 0; retry < MAX_RETRIES; retry++) {
              for (let si = 0; si < strategies.length; si++) {
                try {
                  const element = strategies[si]();
                  if (!element) continue;

                  const rect = element.getBoundingClientRect();
                  if (rect.width === 0 || rect.height === 0) {
                    const parent = element.closest('button, a, [role="button"], input, select, textarea, label, [onclick]');
                    if (parent) {
                      const pr = parent.getBoundingClientRect();
                      if (pr.width > 0 && pr.height > 0) {
                        parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        await new Promise(r => setTimeout(r, 150));
                        parent.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                        parent.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                        parent.click();
                        return { success: true, method: 'parent', tag: parent.tagName, text: (parent.textContent || '').trim().substring(0, 100) };
                      }
                    }
                    continue;
                  }

                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  await new Promise(r => setTimeout(r, 150));

                  const centerX = rect.left + rect.width / 2;
                  const centerY = rect.top + rect.height / 2;

                  element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
                  element.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, view: window, clientX: centerX, clientY: centerY }));
                  element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                  element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                  element.click();

                  return {
                    success: true,
                    method: 'strategy_' + si,
                    tag: element.tagName,
                    text: (element.textContent || element.value || '').trim().substring(0, 100),
                    rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }
                  };
                } catch (e) { continue; }
              }
              if (retry < MAX_RETRIES - 1) await new Promise(r => setTimeout(r, RETRY_DELAY));
            }
            return { success: false, error: 'Element not found after ' + MAX_RETRIES + ' retries with ' + strategies.length + ' strategies' };
          }

          return await findAndClick();
        })()
      `;

      const result = await view.webContents.executeJavaScript(clickCode);

      if (result.success && verify) {
        await new Promise(r => setTimeout(r, 500));
      }

      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('dom-find-element', async (event, { selector, text }) => {
    const view = tabViews.get(handlers.activeTabId);

    if (!view || !view.webContents) {
      return { success: false, error: 'Browser view not found' };
    }

    try {
      const findCode = `
        (() => {
          let elements = [];

          if (${JSON.stringify(selector)}) {
            elements = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
          } else if (${JSON.stringify(text)}) {
            const searchText = ${JSON.stringify(text)}.toLowerCase();
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
              if (el.children.length === 0) {
                const elText = (el.textContent || '').toLowerCase().trim();
                if (elText.includes(searchText)) {
                  elements.push(el);
                }
              }
            }
          }

          return elements.slice(0, 20).map((el, i) => {
            const rect = el.getBoundingClientRect();
            return {
              index: i,
              tagName: el.tagName.toLowerCase(),
              className: el.className,
              id: el.id,
              text: (el.textContent || '').substring(0, 100),
              rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
              href: el.href || null,
              type: el.type || null,
              visible: rect.width > 0 && rect.height > 0
            };
          });
        })()
      `;

      const elements = await view.webContents.executeJavaScript(findCode);
      return { success: true, elements };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('dom-get-page-info', async (event, { tabId } = {}) => {
    const targetTabId = tabId || handlers.activeTabId;
    const view = tabViews.get(targetTabId);

    if (!view || !view.webContents) {
      return { success: false, error: 'Browser view not found' };
    }

    try {
      const pageInfo = await view.webContents.executeJavaScript(`
        (() => {
          return {
            url: window.location.href,
            title: document.title,
            bodyText: document.body.innerText.substring(0, 5000),
            links: Array.from(document.querySelectorAll('a')).slice(0, 50).map(a => ({
              href: a.href,
              text: a.textContent.trim().substring(0, 50)
            })),
            forms: Array.from(document.querySelectorAll('form')).map(f => ({
              action: f.action,
              method: f.method,
              inputs: Array.from(f.querySelectorAll('input')).slice(0, 10).map(i => ({
                name: i.name,
                type: i.type,
                placeholder: i.placeholder
              }))
            })),
            clickableElements: Array.from(document.querySelectorAll('button, a, [role="button"]')).slice(0, 30).map((el, i) => ({
              index: i,
              tagName: el.tagName.toLowerCase(),
              text: (el.textContent || '').trim().substring(0, 100),
              rect: el.getBoundingClientRect()
            }))
          };
        })()
      `);
      return { success: true, ...pageInfo };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('extract-page-content', async (_event, tabId) => {
    const targetId = tabId || handlers.activeTabId;
    let view = targetId ? tabViews.get(targetId) : null;

    if (!view && tabId) {
      view = tabViews.get(handlers.activeTabId);
    }
    if (!view) {
      for (const [, v] of tabViews) {
        if (v && v.webContents && !v.webContents.isDestroyed()) {
          view = v;
          break;
        }
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    let content = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      let wc;
      try {
        wc = view && view.webContents;
      } catch (_) {
        wc = null;
      }
      if (!wc || wc.isDestroyed()) {
        return { error: 'No active view' };
      }

      try {
        const pendingUrl = wc.getURL();
        if (!pendingUrl || pendingUrl === 'about:blank') {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        content = await wc.executeJavaScript(`
          (() => {
            try {
              const clone = document.body.cloneNode(true);
              const elementsToRemove = clone.querySelectorAll('script, style, nav, footer, header, noscript, svg');
              elementsToRemove.forEach(e => e.remove());

              return clone.innerText
                .replace(/\\s+/g, ' ')
                .replace(/[\\r\\n]+/g, '\\n')
                .trim() || document.body.innerText;
            } catch(e) {
              return document.body ? document.body.innerText : "";
            }
          })()
        `);
        if (content && content.length > 50) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        if (attempt === 2) return { error: e.message };
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    return { content };
  });

  ipcMain.handle('extract-search-results', async (event, tabId) => {
    const view = tabId ? tabViews.get(tabId) : tabViews.get(handlers.activeTabId);
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
              extracted.push({
                title: titleElement.innerText,
                url: linkElement.href,
                snippet: snippetElement ? snippetElement.innerText : ''
              });
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
    if (query && query.length > 0) {
      suggestions.push({ type: 'search', text: `Search Google for "${query}"`, url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
      suggestions.push({ type: 'history', text: `History: ${query} past visit`, url: `https://example.com/history/${query}` });
      suggestions.push({ type: 'bookmark', text: `Bookmark: ${query} docs`, url: `https://docs.example.com/${query}` });
    }
    return suggestions;
  });

  console.log('[Handlers] Browser handlers registered');
};