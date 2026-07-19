const http = require('http');

const DEFAULT_PORT = 46203;
const DEFAULT_HOST = '127.0.0.1';
const TIMEOUT_MS = 30000;
const AI_POLL_TIMEOUT_MS = 120000;
const AI_POLL_INTERVAL_MS = 800;

class BridgeClient {
  constructor(port = DEFAULT_PORT, host = DEFAULT_HOST) {
    this.port = port;
    this.host = host;
    this.baseUrl = `http://${host}:${port}`;
  }

  async _request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const options = {
        hostname: this.host,
        port: this.port,
        path: url.pathname + url.search,
        method,
        headers: { 'Content-Type': 'application/json' },
        timeout: body && body._timeout ? body._timeout : TIMEOUT_MS,
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ raw: data });
          }
        });
      });

      req.on('error', (err) => {
        if (err.code === 'ECONNREFUSED') {
          reject(new Error('Aartiq is not running. Please start the Aartiq browser and try again.'));
        } else {
          reject(new Error(`Bridge request failed: ${err.message}`));
        }
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Bridge request timed out'));
      });

      if (body && method !== 'GET') {
        const { _timeout, ...payload } = body;
        req.write(JSON.stringify(payload));
      }
      req.end();
    });
  }

  async healthCheck() {
    try {
      const result = await this._request('GET', '/native-mac-ui/state');
      return { connected: true, state: result.state || result };
    } catch (err) {
      return { connected: false, error: err.message };
    }
  }

  async getState() {
    const result = await this._request('GET', '/native-mac-ui/state');
    return result.state || result;
  }

  async sendPrompt(prompt, source = 'mcp') {
    return this._request('POST', '/native-mac-ui/prompt', { prompt, source });
  }

  async getPreferences() {
    const state = await this.getState();
    return state.preferences || {};
  }

  async updateConfig(updates) {
    return this._request('POST', '/native-mac-ui/config', updates);
  }

  async openPanel(mode) {
    return this._request('POST', '/native-mac-ui/panels/open', { mode });
  }

  async openSettings(target) {
    return this._request('POST', '/native-mac-ui/settings/open', { target });
  }

  async focusElectron() {
    return this._request('POST', '/native-mac-ui/focus-electron');
  }

  async clipboardCopy(text) {
    return this._request('POST', '/native-mac-ui/clipboard/copy', { text });
  }

  async clipboardClear() {
    return this._request('POST', '/native-mac-ui/clipboard/clear');
  }

  async openDownload(path) {
    return this._request('POST', '/native-mac-ui/downloads/open', { path });
  }

  async revealDownload(path) {
    return this._request('POST', '/native-mac-ui/downloads/reveal', { path });
  }

  async conversationAction(action, id) {
    return this._request('POST', '/native-mac-ui/conversations/action', { action, id });
  }

  async exportChat(format) {
    return this._request('POST', '/native-mac-ui/export', { format });
  }

  async cliAsk(prompt, model) {
    return this._request('POST', '/native-mac-ui/cli/ask', { prompt, model });
  }

  async cliSearch(query) {
    return this._request('POST', '/native-mac-ui/cli/search', { query });
  }

  async openSidebar() {
    return this._request('POST', '/native-mac-ui/sidebar/open');
  }

  async closeSidebar() {
    return this._request('POST', '/native-mac-ui/sidebar/close');
  }

  async toggleSidebar() {
    return this._request('POST', '/native-mac-ui/sidebar/toggle');
  }

  async getBookmarks() {
    return this._request('GET', '/native-mac-ui/bookmarks');
  }

  async addBookmark(url, title) {
    return this._request('POST', '/native-mac-ui/bookmarks/add', { url, title });
  }

  async removeBookmark(url) {
    return this._request('DELETE', '/native-mac-ui/bookmarks/remove', { url });
  }

  async getHistory(limit) {
    return this._request('GET', `/native-mac-ui/history${limit ? `?limit=${limit}` : ''}`);
  }

  async clearHistory() {
    return this._request('DELETE', '/native-mac-ui/history/clear');
  }

  async getSettings() {
    return this._request('GET', '/native-mac-ui/settings');
  }

  async updateSettings(settings) {
    return this._request('POST', '/native-mac-ui/settings/update', settings);
  }

  async getPermissions() {
    return this._request('GET', '/native-mac-ui/permissions');
  }

  async grantPermission(key, level, description) {
    return this._request('POST', '/native-mac-ui/permissions/grant', { key, level, description });
  }

  async revokePermission(key) {
    return this._request('POST', '/native-mac-ui/permissions/revoke', { key });
  }

  async createAutomationTask(task) {
    return this._request('POST', '/native-mac-ui/automation/create', task);
  }

  async getAutomationTasks() {
    return this._request('GET', '/native-mac-ui/automation/tasks');
  }

  async toggleAutomationTask(taskId, enabled) {
    return this._request('POST', '/native-mac-ui/automation/toggle', { taskId, enabled });
  }

  async deleteAutomationTask(taskId) {
    return this._request('DELETE', '/native-mac-ui/automation/delete', { taskId });
  }

  async runAutomationTask(taskId) {
    return this._request('POST', '/native-mac-ui/automation/run', { taskId });
  }

  async getAppInfo() {
    return this._request('GET', '/native-mac-ui/app-info');
  }

  async executeShortcut(action) {
    return this._request('POST', '/native-mac-ui/execute-shortcut', { action });
  }

  async navigateBack() {
    return this._request('POST', '/native-mac-ui/navigate/back');
  }

  async navigateForward() {
    return this._request('POST', '/native-mac-ui/navigate/forward');
  }

  async reloadPage() {
    return this._request('POST', '/native-mac-ui/navigate/reload');
  }

  async switchTab(tabId) {
    return this._request('POST', '/native-mac-ui/tabs/switch', { tabId });
  }

  async closeTab(tabId) {
    return this._request('POST', '/native-mac-ui/tabs/close', { tabId });
  }

  async sendAiPromptAndWait(prompt, source = 'mcp', pollTimeout = AI_POLL_TIMEOUT_MS) {
    const preState = await this.getState();
    const preMsgCount = Array.isArray(preState.messages) ? preState.messages.length : 0;
    const preUpdatedAt = preState.updatedAt || 0;

    await this.sendPrompt(prompt, source);

    const startTime = Date.now();
    let lastState = preState;

    while (Date.now() - startTime < pollTimeout) {
      await new Promise(r => setTimeout(r, AI_POLL_INTERVAL_MS));
      const currentState = await this.getState();

      if (
        currentState.isLoading === false &&
        (currentState.updatedAt || 0) > preUpdatedAt
      ) {
        const messages = Array.isArray(currentState.messages) ? currentState.messages : [];
        const newMessages = messages.slice(preMsgCount);
        const lastModelMsg = [...messages].reverse().find(m => m.role === 'model');

        return {
          response: lastModelMsg ? lastModelMsg.content : '',
          actionLogs: lastModelMsg ? (lastModelMsg.actionLogs || []) : [],
          allNewMessages: newMessages,
          state: currentState,
        };
      }

      if (currentState.error && (currentState.updatedAt || 0) > preUpdatedAt) {
        return {
          response: null,
          error: currentState.error,
          state: currentState,
        };
      }

      lastState = currentState;
    }

    return {
      response: null,
      error: 'AI response timed out',
      state: lastState,
    };
  }
}

module.exports = { BridgeClient };
