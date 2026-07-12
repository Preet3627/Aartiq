const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const http = require('http');
const { getAppIconBase64, searchApplications, execShellCommand, validateCommand } = require('../main/handlers/utils.js');
const { generateAartiqPDFTemplate } = require('../main/handlers/pdf-utils.js');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { BrowserWindow, app } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const TOOL_RISK_MAP = {
  list_tabs: 'low',
  switch_tab: 'low',
  close_tab: 'low',
  navigate: 'low',
  get_active_tab_url: 'low',
  read_page: 'low',
  go_back: 'low',
  go_forward: 'low',
  reload: 'low',
  search_applications: 'low',
  web_search: 'low',
  generate_web_search_command: 'low',
  search_and_summarize: 'low',
  click_element: 'medium',
  fill_form: 'medium',
  open_external_app: 'medium',
  set_volume: 'low',
  set_brightness: 'low',
  set_alarm: 'low',
  get_active_window: 'low',
  generate_pdf: 'low',
  execute_shell_command: 'high',
  run_applescript: 'high',
  run_powershell: 'high',
};

class BrowserMcpServer {
  constructor(tabViews, store) {
    this.tabViews = tabViews;
    this.store = store;
    this.httpServer = null;
    this.server = null;
    this.transport = null;
    this._approvalResolvers = new Map();
    this._pendingBiometricCall = null;
  }

  async _requestApproval(toolName, args, risk) {
    return new Promise((resolve) => {
      const requestId = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const timeout = setTimeout(() => {
        this._approvalResolvers.delete(requestId);
        resolve({ allowed: false, reason: 'timed out' });
      }, 120000);

      this._approvalResolvers.set(requestId, (result) => {
        clearTimeout(timeout);
        resolve(result);
      });

      const mainWindow = this.tabViews._mainWindow;
      const winObj = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3003';
      const popupUrl = `${backendUrl}/?panel=mcp-approval&requestId=${requestId}&tool=${encodeURIComponent(toolName)}&risk=${risk}&args=${encodeURIComponent(JSON.stringify(args))}`;

      if (winObj) {
        winObj.webContents.send('open-mcp-approval-popup', { requestId, tool: toolName, risk, args, url: popupUrl });
      } else {
        const { BrowserWindow, ipcMain } = require('electron');
        const isDev = !app.isPackaged;
        const preloadPath = path.join(__dirname, '..', '..', 'preload.js');

        const popup = new BrowserWindow({
          width: 520, height: 500, alwaysOnTop: true,
          skipTaskbar: true, resizable: false,
          minimizable: false, maximizable: false,
          show: false, title: 'MCP Tool Approval',
          webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
          },
        });

        popup.once('ready-to-show', () => popup.show());
        popup.on('closed', () => {
          if (this._approvalResolvers.has(requestId)) {
            this._approvalResolvers.get(requestId)({ allowed: false, reason: 'window closed' });
            this._approvalResolvers.delete(requestId);
          }
        });

        if (isDev) {
          popup.loadURL(popupUrl);
        } else {
          popup.loadURL(`https://localhost:3003/?panel=mcp-approval&requestId=${requestId}&tool=${encodeURIComponent(toolName)}&risk=${risk}&args=${encodeURIComponent(JSON.stringify(args))}`);
        }
      }
    });
  }

  async _withBiometric(reason) {
    try {
      if (!this._biometricAuth) {
        const { BiometricAuthManager } = require('../service/biometric-auth.js');
        this._biometricAuth = new BiometricAuthManager();
      }
      return await this._biometricAuth.authenticate(reason || 'Authenticate to proceed');
    } catch {
      return false;
    }
  }

  _getAutoApprovalConfig() {
    if (!this.store) return { autoApproveLowRisk: true, autoApproveMidRisk: false, requireBiometricPerSession: false };
    return {
      autoApproveLowRisk: this.store.get('security_autoApproveLowRisk', true),
      autoApproveMidRisk: this.store.get('security_autoApproveMidRisk', false),
      requireBiometricPerSession: this.store.get('security_requireBiometricPerSession', false),
      requireBiometricEveryAction: this.store.get('security_requireBiometricEveryAction', false),
      requireDeviceUnlockForManualApproval: this.store.get('security_requireDeviceUnlockForManualApproval', true),
    };
  }

  async _checkPermission(toolName, args) {
    const risk = TOOL_RISK_MAP[toolName] || 'low';
    const config = this._getAutoApprovalConfig();

    if (risk === 'low' && config.autoApproveLowRisk) {
      if (config.requireBiometricEveryAction || (config.requireBiometricPerSession && !this._biometricSessionDone)) {
        const ok = await this._withBiometric(`Approve ${toolName}`);
        if (!ok) return { allowed: false, reason: 'biometric denied' };
        this._biometricSessionDone = true;
      }
      return { allowed: true, reason: 'auto-approved (low risk)' };
    }

    if (risk === 'medium' && config.autoApproveMidRisk) {
      return { allowed: true, reason: 'auto-approved (medium risk)' };
    }

    const approval = await this._requestApproval(toolName, args, risk);
    if (!approval.allowed) {
      return { allowed: false, reason: approval.reason || 'denied' };
    }

    if (config.requireDeviceUnlockForManualApproval && risk !== 'low') {
      const ok = await this._withBiometric(`Approving ${toolName} requires device unlock`);
      if (!ok) return { allowed: false, reason: 'biometric denied' };
    }

    return { allowed: true, reason: 'approved' };
  }

  getToolDefinitions() {
    const resolveTabId = (idOrIndex) => {
      const tabs = this._getTabs();
      let tab = tabs.find(t => t.tabId === idOrIndex);
      if (!tab && /^\d+$/.test(idOrIndex)) {
        const idx = parseInt(idOrIndex, 10) - 1;
        tab = tabs[idx];
      }
      if (!tab) {
        const lower = idOrIndex.toLowerCase();
        tab = tabs.find(t =>
          t.title?.toLowerCase().includes(lower) ||
          t.url?.toLowerCase().includes(lower)
        );
      }
      return tab?.tabId || null;
    };

    return [
      {
        name: 'list_tabs',
        description: 'List all open browser tabs with their IDs, titles, and URLs',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const tabs = this._getTabs();
          return {
            content: [{ type: 'text', text: JSON.stringify(tabs, null, 2) }],
          };
        },
      },
      {
        name: 'switch_tab',
        description: 'Switch to a specific tab by ID, index (1-based), or title/URL search',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Tab ID, index number (1-based), or search term' },
          },
          required: ['id'],
        },
        execute: async (args) => {
          const targetId = resolveTabId(args.id);
          if (!targetId) {
            return {
              content: [{ type: 'text', text: `No tab found matching: ${args.id}` }],
              isError: true,
            };
          }
          const view = this.tabViews.get(targetId);
          if (!view) {
            return {
              content: [{ type: 'text', text: `Tab ${targetId} has no active view` }],
              isError: true,
            };
          }
          this._sendToRenderer('switch-tab', targetId);
          this._switchActiveTab(targetId);
          const url = view.webContents?.getURL() || '';
          const title = view.webContents?.getTitle() || '';
          return {
            content: [{ type: 'text', text: `Switched to tab: ${title} (${url})` }],
          };
        },
      },
      {
        name: 'close_tab',
        description: 'Close a specific tab by ID, index (1-based), or title/URL search',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Tab ID, index number (1-based), or search term' },
          },
          required: ['id'],
        },
        execute: async (args) => {
          const targetId = resolveTabId(args.id);
          if (!targetId) {
            return {
              content: [{ type: 'text', text: `No tab found matching: ${args.id}` }],
              isError: true,
            };
          }
          this._destroyView(targetId);
          return {
            content: [{ type: 'text', text: `Closed tab: ${targetId}` }],
          };
        },
      },
      {
        name: 'navigate',
        description: 'Navigate the active tab to a URL',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The URL to navigate to' },
            newTab: { type: 'boolean', description: 'Open in a new tab instead', default: false },
          },
          required: ['url'],
        },
        execute: async (args) => {
          const url = args.url.startsWith('http') ? args.url : `https://${args.url}`;
          if (args.newTab) {
            this._sendToRenderer('add-new-tab', url);
            return {
              content: [{ type: 'text', text: `Opened new tab: ${url}` }],
            };
          }
          const activeId = this._getActiveTabId();
          const view = activeId ? this.tabViews.get(activeId) : null;
          if (view && view.webContents && !view.webContents.isDestroyed()) {
            view.webContents.loadURL(url);
            return {
              content: [{ type: 'text', text: `Navigated to: ${url}` }],
            };
          }
          this._sendToRenderer('add-new-tab', url);
          return {
            content: [{ type: 'text', text: `Opened new tab: ${url}` }],
          };
        },
      },
      {
        name: 'get_active_tab_url',
        description: 'Get the URL of the currently active tab',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const activeId = this._getActiveTabId();
          const view = activeId ? this.tabViews.get(activeId) : null;
          const url = view?.webContents?.getURL() || '';
          const title = view?.webContents?.getTitle() || '';
          return {
            content: [{ type: 'text', text: JSON.stringify({ url, title, tabId: activeId }) }],
          };
        },
      },
      {
        name: 'read_page',
        description: 'Read the text content of the active tab page',
        inputSchema: {
          type: 'object',
          properties: {
            tabId: { type: 'string', description: 'Optional tab ID. Defaults to active tab.' },
          },
        },
        execute: async (args) => {
          const targetId = args.tabId || this._getActiveTabId();
          const view = targetId ? this.tabViews.get(targetId) : null;
          if (!view || !view.webContents || view.webContents.isDestroyed()) {
            return {
              content: [{ type: 'text', text: 'No active tab available' }],
              isError: true,
            };
          }
          try {
            const text = await view.webContents.executeJavaScript('document.body.innerText');
            const truncated = (text || '').substring(0, 32000);
            return {
              content: [{ type: 'text', text: truncated || '(empty page)' }],
            };
          } catch (e) {
            return {
              content: [{ type: 'text', text: `Failed to read page: ${e.message}` }],
              isError: true,
            };
          }
        },
      },
      {
        name: 'click_element',
        description: 'Click an element on the page by CSS selector or text content',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector for the element' },
            text: { type: 'string', description: 'Text content to find and click (alternative to selector)' },
          },
        },
        execute: async (args) => {
          const activeId = this._getActiveTabId();
          const view = activeId ? this.tabViews.get(activeId) : null;
          if (!view || !view.webContents || view.webContents.isDestroyed()) {
            return {
              content: [{ type: 'text', text: 'No active tab' }],
              isError: true,
            };
          }
          try {
            let script;
            if (args.selector) {
              script = `
                (() => {
                  const el = document.querySelector(${JSON.stringify(args.selector)});
                  if (!el) return { success: false, error: 'Selector not found: ${args.selector}' };
                  el.click();
                  return { success: true };
                })()
              `;
            } else if (args.text) {
              const searchText = JSON.stringify(args.text);
              script = `
                (() => {
                  const words = ${searchText}.toLowerCase().split(/\\s+/).filter(Boolean);
                  const candidates = document.querySelectorAll('a, button, input, [role="button"], [role="link"], span, div');
                  let best = null, bestScore = 0;
                  for (const el of candidates) {
                    const text = (el.textContent || '').toLowerCase().trim();
                    if (!text) continue;
                    const score = words.filter(w => text.includes(w)).length;
                    if (score > bestScore) { bestScore = score; best = el; }
                  }
                  if (!best || bestScore === 0) return { success: false, error: 'No element found matching text' };
                  best.click();
                  return { success: true, matched: (best.textContent || '').trim().substring(0, 100) };
                })()
              `;
            } else {
              return {
                content: [{ type: 'text', text: 'Provide either selector or text parameter' }],
                isError: true,
              };
            }
            const result = await view.webContents.executeJavaScript(script);
            if (result?.success) {
              return { content: [{ type: 'text', text: `Clicked element${result.matched ? ': ' + result.matched : ''}` }] };
            }
            return {
              content: [{ type: 'text', text: result?.error || 'Click failed' }],
              isError: true,
            };
          } catch (e) {
            return {
              content: [{ type: 'text', text: `Click error: ${e.message}` }],
              isError: true,
            };
          }
        },
      },
      {
        name: 'fill_form',
        description: 'Fill a form field on the active page by CSS selector',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector for the form field' },
            value: { type: 'string', description: 'The value to fill in' },
          },
          required: ['selector', 'value'],
        },
        execute: async (args) => {
          const activeId = this._getActiveTabId();
          const view = activeId ? this.tabViews.get(activeId) : null;
          if (!view || !view.webContents || view.webContents.isDestroyed()) {
            return {
              content: [{ type: 'text', text: 'No active tab' }],
              isError: true,
            };
          }
          try {
            const script = `
              (() => {
                const el = document.querySelector(${JSON.stringify(args.selector)});
                if (!el) return { success: false, error: 'Element not found' };
                const tag = el.tagName.toLowerCase();
                if (tag === 'input' || tag === 'textarea') {
                  el.value = ${JSON.stringify(args.value)};
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                  el.dispatchEvent(new Event('change', { bubbles: true }));
                  return { success: true };
                }
                if (el.isContentEditable) {
                  el.textContent = ${JSON.stringify(args.value)};
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                  return { success: true };
                }
                return { success: false, error: 'Element is not a form field' };
              })()
            `;
            const result = await view.webContents.executeJavaScript(script);
            if (result?.success) {
              return { content: [{ type: 'text', text: `Filled ${args.selector}` }] };
            }
            return {
              content: [{ type: 'text', text: result?.error || 'Fill failed' }],
              isError: true,
            };
          } catch (e) {
            return {
              content: [{ type: 'text', text: `Fill error: ${e.message}` }],
              isError: true,
            };
          }
        },
      },
      {
        name: 'go_back',
        description: 'Go back in the active tab history',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => {
          const activeId = this._getActiveTabId();
          const view = activeId ? this.tabViews.get(activeId) : null;
          if (view && view.webContents && !view.webContents.isDestroyed()) {
            view.webContents.goBack();
            return { content: [{ type: 'text', text: 'Navigated back' }] };
          }
          return { content: [{ type: 'text', text: 'No active tab' }], isError: true };
        },
      },
      {
        name: 'go_forward',
        description: 'Go forward in the active tab history',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => {
          const activeId = this._getActiveTabId();
          const view = activeId ? this.tabViews.get(activeId) : null;
          if (view && view.webContents && !view.webContents.isDestroyed()) {
            view.webContents.goForward();
            return { content: [{ type: 'text', text: 'Navigated forward' }] };
          }
          return { content: [{ type: 'text', text: 'No active tab' }], isError: true };
        },
      },
      {
        name: 'reload',
        description: 'Reload the active tab',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => {
          const activeId = this._getActiveTabId();
          const view = activeId ? this.tabViews.get(activeId) : null;
          if (view && view.webContents && !view.webContents.isDestroyed()) {
            view.webContents.reload();
            return { content: [{ type: 'text', text: 'Page reloaded' }] };
          }
          return { content: [{ type: 'text', text: 'No active tab' }], isError: true };
        },
      },
      {
        name: 'generate_pdf',
        description: 'Generate a professional PDF document with a title and content (supports Markdown tables, headings, bold/italic, quote, code blocks) and save it to the Downloads folder.',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'The title of the PDF document' },
            content: { type: 'string', description: 'The body content of the PDF (Markdown, plaintext, or HTML)' },
          },
          required: ['title', 'content'],
        },
        execute: async (args) => {
          const pdfTitle = args.title || 'Aartiq Document';
          const cleanContent = args.content || '';
          const icon = await getAppIconBase64();
          const html = generateAartiqPDFTemplate(pdfTitle, cleanContent, icon);

          const downloadsPath = app.getPath('downloads');
          let workerWindow = null;
          let tempHtmlPath = '';

          try {
            const tempDir = os.tmpdir();
            tempHtmlPath = path.join(tempDir, `aartiq_pdf_${Date.now()}.html`);
            fs.writeFileSync(tempHtmlPath, html, 'utf8');

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

            const safeName = pdfTitle.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
            const filePath = path.join(downloadsPath, `${safeName}_${Date.now()}.pdf`);
            fs.writeFileSync(filePath, pdfData);

            const finalName = path.basename(filePath);
            const mainWindow = this.tabViews._mainWindow;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('download-started', { name: finalName, path: filePath });
              setTimeout(() => {
                mainWindow.webContents.send('download-progress', { name: finalName, progress: 100 });
                mainWindow.webContents.send('download-complete', { name: finalName, path: filePath });
              }, 500);
            }

            return {
              content: [{ type: 'text', text: `Successfully generated PDF at: ${filePath}` }],
            };
          } catch (err) {
            console.error('[Generate-PDF] Failed:', err);
            return {
              content: [{ type: 'text', text: `Failed to generate PDF: ${err.message}` }],
              isError: true,
            };
          } finally {
            if (workerWindow && !workerWindow.isDestroyed()) workerWindow.destroy();
            if (tempHtmlPath && fs.existsSync(tempHtmlPath)) {
              try { fs.unlinkSync(tempHtmlPath); } catch (e) {}
            }
          }
        },
      },
      {
        name: 'search_applications',
        description: 'Search for installed local applications by name (macOS /Applications or Windows Start Menu)',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'App name or search term' },
          },
          required: ['query'],
        },
        execute: async (args) => {
          try {
            const results = await searchApplications(args.query);
            return {
              content: [{ type: 'text', text: JSON.stringify(results) }],
            };
          } catch (e) {
            return {
              content: [{ type: 'text', text: `Search failed: ${e.message}` }],
              isError: true,
            };
          }
        },
      },
      {
        name: 'open_external_app',
        description: 'Open a local application by its absolute path or name (e.g., /Applications/Safari.app or "Safari" on macOS, start command on Windows)',
        inputSchema: {
          type: 'object',
          properties: {
            appPath: { type: 'string', description: 'Absolute path or app name' },
          },
          required: ['appPath'],
        },
        execute: async (args) => {
          const appPath = args.appPath;
          const { shell } = require('electron');
          try {
            if (process.platform === 'darwin') {
              if (appPath.includes('/')) {
                shell.openPath(appPath);
              } else {
                await new Promise((resolve, reject) => {
                  exec(`open -a "${appPath}"`, (err) => {
                    if (err) reject(err); else resolve(true);
                  });
                });
              }
            } else if (process.platform === 'win32') {
              await new Promise((resolve, reject) => {
                exec(`start "" "${appPath}"`, { shell: true }, (err) => {
                  if (err) reject(err); else resolve(true);
                });
              });
            } else {
              exec(`xdg-open "${appPath}"`, { shell: true });
            }
            return {
              content: [{ type: 'text', text: `Opened application: ${appPath}` }],
            };
          } catch (e) {
            return {
              content: [{ type: 'text', text: `Failed to open application: ${e.message}` }],
              isError: true,
            };
          }
        },
      },
      {
        name: 'set_volume',
        description: 'Set system audio output volume level (0 to 100). macOS only.',
        inputSchema: {
          type: 'object',
          properties: {
            level: { type: 'integer', description: 'Volume level between 0 and 100' },
          },
          required: ['level'],
        },
        execute: async (args) => {
          const level = Math.min(100, Math.max(0, args.level));
          if (process.platform === 'darwin') {
            await execAsync(`osascript -e 'set volume output volume ${level}'`);
            return { content: [{ type: 'text', text: `Volume set to ${level}` }] };
          }
          return { content: [{ type: 'text', text: `Volume control not supported on platform: ${process.platform}` }], isError: true };
        },
      },
      {
        name: 'set_brightness',
        description: 'Set screen brightness level (0 to 1). macOS only.',
        inputSchema: {
          type: 'object',
          properties: {
            level: { type: 'number', description: 'Brightness level between 0.0 and 1.0' },
          },
          required: ['level'],
        },
        execute: async (args) => {
          const level = Math.min(1.0, Math.max(0.0, args.level));
          if (process.platform === 'darwin') {
            await execAsync(`brightness ${level}`);
            return { content: [{ type: 'text', text: `Brightness set to ${level}` }] };
          }
          return { content: [{ type: 'text', text: `Brightness control not supported on platform: ${process.platform}` }], isError: true };
        },
      },
      {
        name: 'set_alarm',
        description: 'Create a desktop system reminder/alarm at a specific time. macOS only.',
        inputSchema: {
          type: 'object',
          properties: {
            time: { type: 'string', description: 'ISO date/time string' },
            message: { type: 'string', description: 'Reminder message content' },
          },
          required: ['time', 'message'],
        },
        execute: async (args) => {
          const alarmTime = new Date(args.time);
          if (isNaN(alarmTime.getTime())) {
            return { content: [{ type: 'text', text: 'Invalid time format. Please provide a valid ISO date/time string.' }], isError: true };
          }
          if (process.platform === 'darwin') {
            await execAsync(`osascript -e 'tell application "Reminders" to make new reminder with properties {name:"${args.message}", remind me date:"${alarmTime.toISOString()}"}'`);
            return { content: [{ type: 'text', text: `Reminder set for ${alarmTime.toLocaleString()} with message: "${args.message}"` }] };
          }
          return { content: [{ type: 'text', text: `Alarm/Reminder not supported on platform: ${process.platform}` }], isError: true };
        },
      },
      {
        name: 'execute_shell_command',
        description: 'Execute a command in the shell/terminal. Safe operations only.',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The raw shell command to execute' },
          },
          required: ['command'],
        },
        execute: async (args) => {
          try {
            validateCommand(args.command);
            const result = await execShellCommand(args.command);
            return {
              content: [{ type: 'text', text: result.output || result.error || 'Done' }],
              isError: !result.success,
            };
          } catch (e) {
            return { content: [{ type: 'text', text: `Command blocked/failed: ${e.message}` }], isError: true };
          }
        },
      },
      {
        name: 'run_applescript',
        description: 'Run custom AppleScript command on macOS. Restricted to target allowed apps: Safari, Notes, Calendar, Mail, Finder, Terminal, Calculator.',
        inputSchema: {
          type: 'object',
          properties: {
            script: { type: 'string', description: 'The AppleScript block' },
          },
          required: ['script'],
        },
        execute: async (args) => {
          if (process.platform !== 'darwin') {
            return { content: [{ type: 'text', text: 'AppleScript only supported on macOS' }], isError: true };
          }
          const ALLOWED_APPS = ['Safari', 'Notes', 'Calendar', 'Mail', 'Finder', 'Terminal', 'Calculator'];
          const script = args.script;
          const hasAllowed = ALLOWED_APPS.some(app =>
            script.toLowerCase().includes(app.toLowerCase())
          );
          if (!hasAllowed) {
            return { content: [{ type: 'text', text: `AppleScript blocked: no allowed app target in script. Allowed: ${ALLOWED_APPS.join(', ')}` }], isError: true };
          }
          try {
            const escaped = script.replace(/'/g, "\\'");
            const { stdout } = await execAsync(`osascript -e '${escaped}'`);
            return { content: [{ type: 'text', text: stdout.trim() }] };
          } catch (e) {
            return { content: [{ type: 'text', text: `AppleScript failed: ${e.message}` }], isError: true };
          }
        },
      },
      {
        name: 'run_powershell',
        description: 'Run custom PowerShell command on Windows. Restricted to safe commands.',
        inputSchema: {
          type: 'object',
          properties: {
            script: { type: 'string', description: 'The PowerShell script command' },
          },
          required: ['script'],
        },
        execute: async (args) => {
          if (process.platform !== 'win32') {
            return { content: [{ type: 'text', text: 'PowerShell only supported on Windows' }], isError: true };
          }
          const script = args.script;
          if (script.length > 2000) {
            return { content: [{ type: 'text', text: 'PowerShell script too long (max 2000 chars)' }], isError: true };
          }
          const dangerous = ['Remove-Item', 'Format-', 'Stop-Process', 'Restart-Computer', 'rm -rf', 'del /'];
          for (const d of dangerous) {
            if (script.toLowerCase().includes(d.toLowerCase())) {
              return { content: [{ type: 'text', text: `PowerShell blocked: dangerous command detected: ${d}` }], isError: true };
            }
          }
          try {
            const escaped = script.replace(/"/g, '\\"');
            const { stdout } = await execAsync(`powershell -Command "${escaped}"`);
            return { content: [{ type: 'text', text: stdout.trim() }] };
          } catch (e) {
            return { content: [{ type: 'text', text: `PowerShell failed: ${e.message}` }], isError: true };
          }
        },
      },
      {
        name: 'get_active_window',
        description: 'Get details (process name / window title) of the frontmost/active window on the host OS.',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => {
          if (process.platform === 'darwin') {
            try {
              const { stdout } = await execAsync(
                `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`
              );
              return { content: [{ type: 'text', text: JSON.stringify({ app: stdout.trim(), platform: 'darwin' }) }] };
            } catch (e) {
              return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
            }
          } else if (process.platform === 'win32') {
            try {
              const { stdout } = await execAsync(
                `powershell -Command "(Get-Process | Where-Object {$_.MainWindowHandle -ne 0} | Sort-Object -Property CPU -Descending | Select-Object -First 1).MainWindowTitle"`
              );
              return { content: [{ type: 'text', text: JSON.stringify({ window: stdout.trim(), platform: 'win32' }) }] };
            } catch (e) {
              return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
            }
          }
          return { content: [{ type: 'text', text: `Unsupported platform: ${process.platform}` }], isError: true };
        },
      },
      {
        name: 'web_search',
        description: 'Search the web by opening a real browser, performing DuckDuckGo/Google search, navigating to top results, and reading their content. Returns structured results with titles, URLs, snippets, and full page content. No API keys required.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            engine: { type: 'string', description: 'Search engine to use: duckduckgo (default, reliable) or google', enum: ['google', 'duckduckgo'], default: 'duckduckgo' },
            count: { type: 'number', description: 'Number of top results to navigate to and read (default 3, max 5)', default: 3 },
          },
          required: ['query'],
        },
        execute: async (args) => {
          try {
            const { results, engine: usedEngine } = await this._browserSearch(
              args.query, args.engine, Math.min(args.count || 3, 5)
            );
            if (results.length === 0) {
              return { content: [{ type: 'text', text: `No search results found for "${args.query}". Do NOT invent data.` }], isError: true };
            }
            const summary = results.map(r =>
              `[Result ${r.index}] ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}\nContent: ${r.content.substring(0, 2000)}`
            ).join('\n\n---\n\n');
            return {
              content: [{ type: 'text', text: `Search Results for "${args.query}" via ${usedEngine} (${results.length} results):\n\n${summary}` }],
            };
          } catch (e) {
            return { content: [{ type: 'text', text: `Search error: ${e.message}` }], isError: true };
          }
        },
      },
      {
        name: 'generate_web_search_command',
        description: 'Generate a JSON web search command that can be used in the AI sidebar to perform a browser-based search.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            engine: { type: 'string', description: 'Search engine: duckduckgo (default) or google', enum: ['google', 'duckduckgo'], default: 'duckduckgo' },
            pages: { type: 'number', description: 'Number of pages to read (default 3)', default: 3 },
            url: { type: 'string', description: 'Specific URL or result index to navigate to (optional)' },
          },
          required: ['query'],
        },
        execute: async (args) => {
          const command = {
            type: 'WEB_SEARCH',
            query: args.query,
            engine: args.engine || 'duckduckgo',
            pages: args.pages || 3,
          };
          if (args.url) command.url = args.url;
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                command,
                usage: 'Use this JSON command in the AI sidebar to perform a browser-based web search. The command will open a real browser, search DuckDuckGo/Google, navigate to top results, and read their content.',
                example: `[WEB_SEARCH: ${args.query}]`
              }, null, 2)
            }],
          };
        },
      },
      {
        name: 'search_and_summarize',
        description: 'Search the web, navigate to top results, read their content, and provide a summarized answer. Uses real browser navigation - no API keys required.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            engine: { type: 'string', description: 'Search engine: duckduckgo (default, reliable) or google', enum: ['google', 'duckduckgo'], default: 'duckduckgo' },
            count: { type: 'number', description: 'Number of results to read (default 3, max 5)', default: 3 },
            instruction: { type: 'string', description: 'Specific instruction for summarizing the results (optional)' },
          },
          required: ['query'],
        },
        execute: async (args) => {
          try {
            const instruction = args.instruction || 'Summarize the key information';
            const { results, engine: usedEngine } = await this._browserSearch(
              args.query, args.engine, Math.min(args.count || 3, 5)
            );
            if (results.length === 0) {
              return { content: [{ type: 'text', text: `No search results found for "${args.query}". Do NOT invent data.` }], isError: true };
            }
            const contextForLLM = results.map(p =>
              `[${p.title}](${p.url})\n${p.snippet}\n\nFull Content:\n${p.content}`
            ).join('\n\n---\n\n');
            return {
              content: [{
                type: 'text',
                text: `Web Search Results for "${args.query}" via ${usedEngine} (${results.length} pages read):\n\n${contextForLLM}\n\n---\n\nInstruction: ${instruction}\n\nBased on the above search results, please provide a summary answering the original query.`
              }],
            };
          } catch (e) {
            return { content: [{ type: 'text', text: `Search error: ${e.message}` }], isError: true };
          }
        },
      },
    ];
  }

  _getSearchView() {
    const activeId = this._getActiveTabId();
    let view = activeId ? this.tabViews.get(activeId) : null;
    if (view && view.webContents && !view.webContents.isDestroyed()) {
      return { view: view.webContents, tabId: activeId, isNew: false };
    }
    const { BrowserWindow } = require('electron');
    const newTabId = `mcp-search-${Date.now()}`;
    const searchWindow = new BrowserWindow({
      width: 1280, height: 800, show: false,
      webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: true }
    });
    this.tabViews.set(newTabId, searchWindow);
    this.tabViews._activeTabId = newTabId;
    if (!this.tabViews._mainWindow) {
      this.tabViews._mainWindow = { webContents: { send: () => {} }, isDestroyed: () => false, addBrowserView: () => {}, removeBrowserView: () => {} };
    }
    return { view: searchWindow.webContents, tabId: newTabId, isNew: true };
  }

  async _parseGoogleDOM(view, count) {
    return view.executeJavaScript(`
      (() => {
        const results = [];
        const seen = new Set();
        const blocks = document.querySelectorAll('div.g, div.MjjYud');
        for (const block of blocks) {
          if (results.length >= ${count * 2}) break;
          if (block.querySelector('[data-text-ad]') || block.querySelector('.commercial-unit-desktop-rhs')) continue;
          let anchor = block.querySelector('a[href^="http"]:not([href*="google.com"]):not([href*="googleads"]):not([href*="doubleclick"])');
          if (!anchor) anchor = block.querySelector('a[href^="/url?q="]');
          if (!anchor) continue;
          const titleEl = block.querySelector('h3');
          if (!titleEl) continue;
          const title = titleEl.textContent.trim();
          let url = anchor.getAttribute('href') || '';
          if (url.startsWith('/url?q=')) {
            url = decodeURIComponent(url.replace('/url?q=', '').split('&')[0]);
          }
          if (!url.startsWith('http') || seen.has(url)) continue;
          seen.add(url);
          let snippet = '';
          for (const ss of ['div.VwiC3b', 'div[data-sncf]', 'span.st', 'div.lEBKkf']) {
            const el = block.querySelector(ss);
            if (el) { snippet = el.textContent.trim(); break; }
          }
          results.push({ title, url, snippet });
        }
        return results;
      })()
    `);
  }

  async _parseDuckDuckGoDOM(view, count) {
    return view.executeJavaScript(`
      (() => {
        const results = [];
        const seen = new Set();
        const links = document.querySelectorAll('a.result__a');
        for (const link of links) {
          if (results.length >= ${count * 2}) break;
          const container = link.closest('.result') || link.closest('.web-result') || link.parentElement?.parentElement;
          if (container) {
            if (container.querySelector('.result--ad') || container.querySelector('.result--promoted') || container.querySelector('[data-testid="ad-result"]') || container.querySelector('span.result__promoted')) continue;
          }
          const title = link.textContent.trim();
          let rawUrl = link.getAttribute('href') || '';
          let url = rawUrl;
          try {
            const urlObj = new URL(rawUrl, 'https://duckduckgo.com');
            if (urlObj.hostname === 'duckduckgo.com' && (urlObj.pathname === '/l/' || urlObj.pathname === '/m/')) {
              url = decodeURIComponent(urlObj.searchParams.get('uddg') || rawUrl);
            }
          } catch (_) {}
          if (!url.startsWith('http') || seen.has(url)) continue;
          if (url.includes('duckduckgo.com') && url.includes('ad_domain')) continue;
          seen.add(url);
          let snippet = '';
          if (container) {
            const snippetEl = container.querySelector('.result__snippet');
            if (snippetEl) snippet = snippetEl.textContent.trim();
          }
          results.push({ title, url, snippet });
        }
        return results;
      })()
    `);
  }

  async _readPageContent(view, maxChars = 6000) {
    return view.executeJavaScript(`
      (() => {
        document.querySelectorAll('script, style, nav, footer, header, noscript, svg, iframe, form, .sidebar, .menu, .footer, .header, .nav, .ad, .cookie, .popup, .modal, .overlay').forEach(el => el.remove());
        const main = document.querySelector('main, article, [role="main"], #content, #main, .content, .post, .entry, .article');
        const text = main ? main.textContent : (document.body ? document.body.textContent : '');
        return (text || '').replace(/\\s+/g, ' ').trim().substring(0, ${maxChars});
      })()
    `);
  }

  async _browserSearch(query, engine, count) {
    engine = engine || 'duckduckgo';
    count = count || 3;
    const { view } = this._getSearchView();
    let usedEngine = engine;

    const searchUrl = engine === 'google'
      ? `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en`
      : `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    await view.loadURL(searchUrl);
    await new Promise(resolve => setTimeout(resolve, 2500));

    let searchResults = engine === 'google'
      ? await this._parseGoogleDOM(view, count)
      : await this._parseDuckDuckGoDOM(view, count);

    if (engine === 'google' && searchResults.length === 0) {
      console.log(`[MCP-Browser] Google returned 0 results for "${query}", falling back to DuckDuckGo`);
      usedEngine = 'duckduckgo';
      await view.loadURL(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
      await new Promise(resolve => setTimeout(resolve, 2500));
      searchResults = await this._parseDuckDuckGoDOM(view, count);
    }

    const topResults = searchResults.slice(0, count);
    const results = [];

    for (let i = 0; i < topResults.length; i++) {
      const result = topResults[i];
      try {
        await view.loadURL(result.url);
        await new Promise(resolve => setTimeout(resolve, 1500));
        const content = await this._readPageContent(view);
        results.push({
          index: i + 1,
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          content: content || '',
        });
      } catch (navErr) {
        results.push({
          index: i + 1,
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          content: `[Failed to load: ${navErr.message}]`,
        });
      }
    }

    return { results, engine: usedEngine };
  }

  _getTabs() {
    const tabs = [];
    for (const [tabId, view] of this.tabViews) {
      if (view && view.webContents && !view.webContents.isDestroyed()) {
        try {
          tabs.push({
            tabId,
            url: view.webContents.getURL(),
            title: view.webContents.getTitle(),
            isActive: tabId === this._getActiveTabId(),
          });
        } catch (e) {}
      }
    }
    return tabs;
  }

  _getActiveTabId() {
    return this.tabViews._activeTabId || null;
  }

  _switchActiveTab(tabId) {
    const view = this.tabViews.get(tabId);
    if (view && this.tabViews._mainWindow) {
      const prevId = this._getActiveTabId();
      if (prevId && prevId !== tabId) {
        const prevView = this.tabViews.get(prevId);
        if (prevView) this.tabViews._mainWindow.removeBrowserView(prevView);
      }
      this.tabViews._mainWindow.addBrowserView(view);
      if (this.tabViews._bounds) view.setBounds(this.tabViews._bounds);
      this.tabViews._activeTabId = tabId;
    }
  }

  _destroyView(tabId) {
    const view = this.tabViews.get(tabId);
    if (view) {
      if (this.tabViews._mainWindow) this.tabViews._mainWindow.removeBrowserView(view);
      if (view.webContents && !view.webContents.isDestroyed()) {
        view.webContents.destroy();
      }
      this.tabViews.delete(tabId);
    }
  }

  _sendToRenderer(channel, ...args) {
    if (this.tabViews._mainWindow && !this.tabViews._mainWindow.isDestroyed()) {
      this.tabViews._mainWindow.webContents.send(channel, ...args);
    }
  }

  async start(port) {
    const toolDefinitions = this.getToolDefinitions();

    this.server = new Server(
      { name: 'aartiq-browser', version: '1.0.0' },
      { capabilities: { tools: {} } },
    );

    this.server.setRequestHandler(
      ListToolsRequestSchema,
      async () => ({
        tools: toolDefinitions.map(({ execute, ...def }) => ({
          ...def,
          inputSchema: def.inputSchema || { type: 'object', properties: {} },
        })),
      }),
    );

    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        const toolName = request.params.name;
        const args = request.params.arguments || {};
        const tool = toolDefinitions.find(t => t.name === toolName);
        if (!tool) {
          return {
            content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
            isError: true,
          };
        }
        try {
          const permission = await this._checkPermission(toolName, args);
          if (!permission.allowed) {
            return {
              content: [{ type: 'text', text: `Permission denied for ${toolName}: ${permission.reason || 'denied'}. Please open Aartiq to approve this request.` }],
              isError: true,
            };
          }
          return await tool.execute(args);
        } catch (e) {
          return {
            content: [{ type: 'text', text: `Error executing ${toolName}: ${e.message}` }],
            isError: true,
          };
        }
      },
    );

    this.httpServer = http.createServer(async (req, res) => {
      const pathname = req.url ? req.url.split('?')[0] : '';

      if (req.method === 'GET' && pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', tabs: this._getTabs().length }));
        return;
      }

      if (req.method === 'GET' && pathname === '/sse') {
        const oldTransport = this.transport;
        this.transport = null;
        if (oldTransport) {
          try { oldTransport.close(); } catch (_) {}
        }
        const transport = new SSEServerTransport('/messages', res);
        this.transport = transport;
        res.on('close', () => {
          if (this.transport === transport) {
            this.transport = null;
          }
        });
        try {
          await this.server.connect(transport);
        } catch (e) {
          res.destroy();
          this.transport = null;
        }
        return;
      }

      // Respond 404 to POST /sse so mcp-remote v0.1.37's http-first
      // falls back cleanly to sse-only without logging confusing errors.
      if (req.method === 'POST' && pathname === '/sse') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      if (req.method === 'POST' && pathname === '/messages') {
        if (this.transport) {
          try { await this.transport.handlePostMessage(req, res); } catch (_) {
            res.writeHead(400);
            res.end('Bad request');
          }
          return;
        }
        res.writeHead(400);
        res.end('No active SSE connection');
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    return new Promise((resolve) => {
      this.httpServer.listen(port, () => {
        console.log(`[MCP-Browser] Server running on http://localhost:${port}/sse`);
        resolve();
      });
    });
  }

  async stop() {
    if (this.transport) {
      try { await this.transport.close(); } catch (e) {}
      this.transport = null;
    }
    if (this.server) {
      try { await this.server.close(); } catch (e) {}
      this.server = null;
    }
    if (this.httpServer) {
      await new Promise((resolve) => this.httpServer.close(resolve));
      this.httpServer = null;
    }
  }
}

module.exports = { BrowserMcpServer };
