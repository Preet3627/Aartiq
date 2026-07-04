const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const Store = require('electron-store');

const store = new Store({ name: 'plugins' });

class PluginManager extends EventEmitter {
  constructor() {
    super();
    this.plugins = new Map();
    this.manifests = new Map();
    this.commands = new Map();
    this.hooks = new Map();
    this.pluginsDir = this.getPluginsDir();
    this.enabledPlugins = store.get('enabledPlugins', []);
    this.pluginConfigs = store.get('pluginConfigs', {});
    this.ensurePluginsDirectory();
  }

  getPluginsDir() {
    const userDataPath = process.env.APPDATA || 
      (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library/Application Support') : process.env.HOME);
    return path.join(userDataPath, 'Aartiq', 'plugins');
  }

  ensurePluginsDirectory() {
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true });
    }
  }

  async loadPlugin(pluginPath) {
    try {
      const manifestPath = path.join(pluginPath, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        throw new Error('manifest.json not found');
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      const indexPath = path.join(pluginPath, manifest.main || 'index.js');

      if (!fs.existsSync(indexPath)) {
        throw new Error(`Entry point not found: ${indexPath}`);
      }

      const PluginClass = require(indexPath);
      const pluginInstance = new PluginClass();
      pluginInstance.id = manifest.id;
      pluginInstance.manifest = manifest;
      pluginInstance.config = this.pluginConfigs[manifest.id] || {};
      pluginInstance.enabled = this.enabledPlugins.includes(manifest.id);

      await pluginInstance.onLoad();

      this.plugins.set(manifest.id, pluginInstance);
      this.manifests.set(manifest.id, manifest);

      if (pluginInstance.enabled) {
        await this.registerPluginCommands(manifest.id, pluginInstance);
        await this.registerPluginHooks(manifest.id, pluginInstance);
      }

      console.log(`[PluginManager] Loaded plugin: ${manifest.name} v${manifest.version}`);
      return { success: true, plugin: manifest };

    } catch (error) {
      console.error(`[PluginManager] Failed to load plugin at ${pluginPath}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async registerPluginCommands(pluginId, pluginInstance) {
    if (typeof pluginInstance.getCommands === 'function') {
      const commands = await pluginInstance.getCommands();
      if (commands && typeof commands === 'object') {
        for (const [cmdId, handler] of Object.entries(commands)) {
          const fullCmdId = `${pluginId}:${cmdId}`;
          this.commands.set(fullCmdId, { handler, pluginId, command: cmdId });
          console.log(`[PluginManager] Registered command: ${fullCmdId}`);
        }
      }
    }
  }

  async registerPluginHooks(pluginId, pluginInstance) {
    if (typeof pluginInstance.getHooks === 'function') {
      const hooks = await pluginInstance.getHooks();
      if (hooks && typeof hooks === 'object') {
        for (const [event, handler] of Object.entries(hooks)) {
          if (!this.hooks.has(event)) {
            this.hooks.set(event, []);
          }
          this.hooks.get(event).push({ handler, pluginId });
        }
      }
    }
  }

  async unloadPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return { success: false, error: 'Plugin not found' };
    }

    if (typeof plugin.onUnload === 'function') {
      await plugin.onUnload();
    }

    for (const [cmdId, cmd] of this.commands) {
      if (cmd.pluginId === pluginId) {
        this.commands.delete(cmdId);
      }
    }

    for (const [event, handlers] of this.hooks) {
      const filtered = handlers.filter(h => h.pluginId !== pluginId);
      if (filtered.length === 0) {
        this.hooks.delete(event);
      } else {
        this.hooks.set(event, filtered);
      }
    }

    this.plugins.delete(pluginId);
    this.manifests.delete(pluginId);
    console.log(`[PluginManager] Unloaded plugin: ${pluginId}`);
    return { success: true };
  }

  async enablePlugin(pluginId) {
    if (!this.enabledPlugins.includes(pluginId)) {
      this.enabledPlugins.push(pluginId);
      store.set('enabledPlugins', this.enabledPlugins);
    }

    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.enabled = true;
      await this.registerPluginCommands(pluginId, plugin);
      await this.registerPluginHooks(pluginId, plugin);
    }

    return { success: true };
  }

  async disablePlugin(pluginId) {
    this.enabledPlugins = this.enabledPlugins.filter(id => id !== pluginId);
    store.set('enabledPlugins', this.enabledPlugins);

    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.enabled = false;
      for (const [cmdId, cmd] of this.commands) {
        if (cmd.pluginId === pluginId) {
          this.commands.delete(cmdId);
        }
      }
      for (const [event, handlers] of this.hooks) {
        const filtered = handlers.filter(h => h.pluginId !== pluginId);
        if (filtered.length === 0) {
          this.hooks.delete(event);
        } else {
          this.hooks.set(event, filtered);
        }
      }
    }

    return { success: true };
  }

  async executeCommand(commandId, params = {}) {
    const cmd = this.commands.get(commandId);
    if (!cmd) {
      throw new Error(`Command not found: ${commandId}`);
    }

    const plugin = this.plugins.get(cmd.pluginId);
    if (!plugin || !plugin.enabled) {
      throw new Error(`Plugin ${cmd.pluginId} is not enabled`);
    }

    try {
      const result = await cmd.handler.call(plugin, params);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async emitHook(event, data) {
    const handlers = this.hooks.get(event) || [];
    const results = [];

    for (const { handler, pluginId } of handlers) {
      const plugin = this.plugins.get(pluginId);
      if (plugin && plugin.enabled) {
        try {
          const result = await handler.call(plugin, data);
          results.push({ pluginId, success: true, result });
        } catch (error) {
          results.push({ pluginId, success: false, error: error.message });
        }
      }
    }

    return results;
  }

  async installPlugin(source, options = {}) {
    const tempDir = path.join(this.pluginsDir, '.temp');

    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      let pluginPath;

      if (source === 'marketplace') {
        const { pluginId } = options;
        pluginPath = await this.downloadFromMarketplace(pluginId);
      } else if (source === 'file') {
        const { filePath } = options;
        pluginPath = await this.extractFromFile(filePath, tempDir);
      }

      const manifestPath = path.join(pluginPath, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        throw new Error('Invalid plugin: manifest.json not found');
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      const targetPath = path.join(this.pluginsDir, manifest.id);

      if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true });
      }

      fs.renameSync(pluginPath, targetPath);
      fs.rmSync(tempDir, { recursive: true, force: true });

      await this.loadPlugin(targetPath);

      this.emit('plugin:installed', manifest);
      return { success: true, plugin: manifest };

    } catch (error) {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      console.error('[PluginManager] Install failed:', error);
      return { success: false, error: error.message };
    }
  }

  async downloadFromMarketplace(pluginId) {
    throw new Error('Marketplace not yet implemented');
  }

  async extractFromFile(filePath, tempDir) {
    const extractDir = path.join(tempDir, `plugin-${Date.now()}`);

    if (filePath.endsWith('.zip')) {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(filePath);
      zip.extractAllTo(extractDir, true);
    } else if (fs.statSync(filePath).isDirectory()) {
      fs.mkdirSync(extractDir, { recursive: true });
      const copyDir = (src, dest) => {
        fs.readdirSync(src).forEach(item => {
          const srcPath = path.join(src, item);
          const destPath = path.join(dest, item);
          if (fs.statSync(srcPath).isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            copyDir(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        });
      };
      copyDir(filePath, extractDir);
    }

    return extractDir;
  }

  async uninstallPlugin(pluginId) {
    await this.disablePlugin(pluginId);
    await this.unloadPlugin(pluginId);

    const pluginPath = path.join(this.pluginsDir, pluginId);
    if (fs.existsSync(pluginPath)) {
      fs.rmSync(pluginPath, { recursive: true, force: true });
    }

    delete this.pluginConfigs[pluginId];
    store.set('pluginConfigs', this.pluginConfigs);

    this.emit('plugin:uninstalled', { pluginId });
    return { success: true };
  }

  async updatePlugin(pluginId) {
    console.log(`[PluginManager] Updating plugin: ${pluginId}`);
    const manifest = this.manifests.get(pluginId);
    if (!manifest) {
      return { success: false, error: 'Plugin not found' };
    }

    await this.disablePlugin(pluginId);
    await this.unloadPlugin(pluginId);

    const pluginPath = path.join(this.pluginsDir, pluginId);
    const result = await this.loadPlugin(pluginPath);

    if (result.success) {
      await this.enablePlugin(pluginId);
    }

    return result;
  }

  updatePluginConfig(pluginId, config) {
    this.pluginConfigs[pluginId] = { ...this.pluginConfigs[pluginId], ...config };
    store.set('pluginConfigs', this.pluginConfigs);

    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.config = this.pluginConfigs[pluginId];
    }

    this.emit('plugin:config-updated', { pluginId, config });
    return { success: true, config: this.pluginConfigs[pluginId] };
  }

  getPlugins() {
    const plugins = [];
    for (const [id, manifest] of this.manifests) {
      const plugin = this.plugins.get(id);
      plugins.push({
        id,
        ...manifest,
        enabled: this.enabledPlugins.includes(id),
        config: this.pluginConfigs[id] || {},
        hasCommands: plugin && typeof plugin.getCommands === 'function',
        hasSettings: plugin && typeof plugin.getSettingsUI === 'function'
      });
    }
    return plugins;
  }

  getPlugin(pluginId) {
    const manifest = this.manifests.get(pluginId);
    if (!manifest) return null;

    return {
      id: pluginId,
      ...manifest,
      enabled: this.enabledPlugins.includes(pluginId),
      config: this.pluginConfigs[pluginId] || {}
    };
  }

  getCommands() {
    const cmds = [];
    for (const [id, cmd] of this.commands) {
      cmds.push({
        id,
        pluginId: cmd.pluginId,
        command: cmd.command
      });
    }
    return cmds;
  }

  async loadAllPlugins() {
    console.log('[PluginManager] Loading all plugins...');

    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true });
      return;
    }

    const entries = fs.readdirSync(this.pluginsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const pluginPath = path.join(this.pluginsDir, entry.name);
        const manifestPath = path.join(pluginPath, 'manifest.json');

        if (fs.existsSync(manifestPath)) {
          const result = await this.loadPlugin(pluginPath);
          if (result.success && this.enabledPlugins.includes(entry.name)) {
            await this.enablePlugin(entry.name);
          }
        }
      }
    }

    console.log(`[PluginManager] Loaded ${this.plugins.size} plugins`);
  }

  async scanDirectory(directory) {
    const results = [];

    if (!fs.existsSync(directory)) {
      return results;
    }

    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const pluginPath = path.join(directory, entry.name);
        const manifestPath = path.join(pluginPath, 'manifest.json');

        if (fs.existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            results.push({
              id: manifest.id,
              path: pluginPath,
              ...manifest
            });
          } catch (e) {
            console.warn(`[PluginManager] Invalid manifest in ${pluginPath}:`, e.message);
          }
        }
      }
    }

    return results;
  }

  getPluginsDirPath() {
    return this.pluginsDir;
  }
}

const pluginManager = new PluginManager();

module.exports = { PluginManager, pluginManager };
