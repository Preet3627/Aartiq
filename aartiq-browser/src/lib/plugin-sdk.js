const EventEmitter = require('events');

class PluginContext {
  constructor(pluginId, pluginManager) {
    this.pluginId = pluginId;
    this.manager = pluginManager;
  }

  log(message, level = 'info') {
    const prefix = `[Plugin:${this.pluginId}]`;
    if (level === 'error') console.error(prefix, message);
    else if (level === 'warn') console.warn(prefix, message);
    else console.log(prefix, message);
  }

  async readFile(filePath) {
    const fs = require('fs');
    return fs.readFileSync(filePath, 'utf8');
  }

  async writeFile(filePath, content) {
    const fs = require('fs');
    fs.writeFileSync(filePath, content);
    return true;
  }

  async fetch(url, options = {}) {
    const http = url.startsWith('https') ? require('https') : require('http');
    return new Promise((resolve, reject) => {
      const req = http.get(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { resolve(data); }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  store(key, value) {
    if (value === undefined) {
      const all = this.manager.pluginConfigs[this.pluginId] || {};
      return all[key];
    }
    this.manager.updatePluginConfig(this.pluginId, { [key]: value });
    return value;
  }

  async executeCommand(commandId, params = {}) {
    return this.manager.executeCommand(commandId, params);
  }

  async emitHook(event, data) {
    return this.manager.emitHook(event, data);
  }
}

class Plugin {
  constructor(manifest) {
    this.id = manifest.id;
    this.name = manifest.name || manifest.id;
    this.version = manifest.version || '1.0.0';
    this.description = manifest.description || '';
    this.type = manifest.type || 'command';
    this.permissions = manifest.permissions || [];
    this.manifest = manifest;
    this.enabled = false;
    this.config = {};
    this.context = null;
    this.manager = null;
    this._commands = {};
    this._hooks = {};
  }

  async onLoad() {}
  async onUnload() {}
  async onEnable() {}
  async onDisable() {}
  async onConfigChange(config) {}

  registerCommand(spec) {
    if (!spec.id || !spec.handler) {
      throw new Error(`Plugin "${this.id}": command must have "id" and "handler"`);
    }
    this._commands[spec.id] = spec;
  }

  registerHook(event, handler) {
    if (!event || typeof handler !== 'function') {
      throw new Error(`Plugin "${this.id}": hook must have an event name and handler function`);
    }
    if (!this._hooks[event]) this._hooks[event] = [];
    this._hooks[event].push(handler);
  }

  getCommands() {
    const entries = {};
    for (const [id, spec] of Object.entries(this._commands)) {
      entries[id] = async (params) => {
        return spec.handler.call(this, params);
      };
    }
    return entries;
  }

  getHooks() {
    const entries = {};
    for (const [event, handlers] of Object.entries(this._hooks)) {
      entries[event] = async (data) => {
        const results = [];
        for (const handler of handlers) {
          results.push(await handler.call(this, data));
        }
        return results;
      };
    }
    return entries;
  }
}

module.exports = { Plugin, PluginContext };
