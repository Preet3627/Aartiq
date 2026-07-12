const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const http = require('http');
const { getAppIconBase64, searchApplications, execShellCommand, validateCommand } = require('../main/handlers/utils.js');
const { WebSearchProvider } = require('./web-search-service.js');
const { generateAartiqPDFTemplate } = require('../main/handlers/pdf-utils.js');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { BrowserWindow, app } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

class BrowserMcpServer {
  constructor(tabViews, store) {
    this.tabViews = tabViews;
    this.store = store;
    this.httpServer = null;
    this.server = null;
    this.transport = null;
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
        description: 'Search the web for information. Supports Google, Brave, Tavily, SerpAPI, DuckDuckGo, and YouTube.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            provider: { type: 'string', description: 'Search provider (google, brave, tavily, serp, duckduckgo, youtube, googlescrape)', enum: ['google', 'brave', 'tavily', 'serp', 'duckduckgo', 'youtube', 'googlescrape'] },
            count: { type: 'number', description: 'Number of results (default 8)', default: 8 },
          },
          required: ['query'],
        },
        execute: async (args) => {
          try {
            const provider = new WebSearchProvider();
            const keys = ['GOOGLE_API_KEY', 'GOOGLE_SEARCH_ENGINE_ID', 'BRAVE_API_KEY', 'TAVILY_API_KEY', 'SERP_API_KEY'];
            const config = {};
            for (const key of keys) {
              const val = process.env[key];
              if (val) config[key] = val;
            }
            provider.configure(config);
            const results = await provider.search(args.query, args.provider, args.count || 8);
            return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
          } catch (e) {
            return { content: [{ type: 'text', text: `Search error: ${e.message}` }], isError: true };
          }
        },
      },
    ];
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
