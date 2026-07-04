"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Puzzle, Plus, Trash2, Power, Settings, AlertCircle, CheckCircle, 
  XCircle, Download, FolderOpen, ChevronDown, ChevronUp, RefreshCw,
  ExternalLink, Shield, Zap, Code, Palette, Link2, Calendar
} from 'lucide-react';

interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  type: 'ai-model' | 'command' | 'integration' | 'theme' | 'automation';
  permissions: string[];
  enabled: boolean;
  hasConfig: boolean;
  icon?: string;
  dependencies?: string[];
}

interface Plugin extends PluginManifest {
  path: string;
  status: 'loaded' | 'error' | 'disabled';
  error?: string;
  commands?: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

const typeIcons: Record<string, React.ReactNode> = {
  'ai-model': <Zap size={14} className="text-amber-400" />,
  'command': <Code size={14} className="text-blue-400" />,
  'integration': <Link2 size={14} className="text-green-400" />,
  'theme': <Palette size={14} className="text-pink-400" />,
  'automation': <Calendar size={14} className="text-purple-400" />,
};

const typeLabels: Record<string, string> = {
  'ai-model': 'AI Model',
  'command': 'Command',
  'integration': 'Integration',
  'theme': 'Theme',
  'automation': 'Automation',
};

export default function PluginSettings() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlugin, setExpandedPlugin] = useState<string | null>(null);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [installSource, setInstallSource] = useState('');
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    loadPlugins();
    setupListeners();
  }, []);

  const loadPlugins = async () => {
    try {
      setLoading(true);
      setError(null);
      if (window.electronAPI?.plugins) {
        const list = await window.electronAPI.plugins.list();
        const mappedPlugins: Plugin[] = (list || []).map(p => ({
          id: p.id,
          name: p.name,
          version: p.version,
          description: p.description || '',
          author: p.author || 'Unknown',
          type: 'command' as const,
          permissions: [],
          enabled: p.enabled,
          hasConfig: false,
          path: '',
          status: p.enabled ? 'loaded' as const : 'disabled' as const
        }));
        setPlugins(mappedPlugins);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plugins');
    } finally {
      setLoading(false);
    }
  };

  const setupListeners = () => {
    if (window.electronAPI?.plugins) {
      window.electronAPI.plugins.onInstalled((_manifest: { id: string; name: string; version: string }) => {
        loadPlugins();
      });
      window.electronAPI.plugins.onUninstalled((_pluginId: string) => {
        loadPlugins();
      });
      window.electronAPI.plugins.onConfigUpdated(({ pluginId: _pluginId, config: _config }: { pluginId: string; config: unknown }) => {
        loadPlugins();
      });
    }
  };

  const handleEnable = async (pluginId: string) => {
    try {
      await window.electronAPI?.plugins?.enable(pluginId);
      await loadPlugins();
    } catch (err) {
      console.error('Failed to enable plugin:', err);
    }
  };

  const handleDisable = async (pluginId: string) => {
    try {
      await window.electronAPI?.plugins?.disable(pluginId);
      await loadPlugins();
    } catch (err) {
      console.error('Failed to disable plugin:', err);
    }
  };

  const handleUninstall = async (pluginId: string) => {
    if (!confirm('Are you sure you want to uninstall this plugin?')) return;
    try {
      await window.electronAPI?.plugins?.uninstall(pluginId);
      await loadPlugins();
    } catch (err) {
      console.error('Failed to uninstall plugin:', err);
    }
  };

  const handleInstall = async () => {
    if (!installSource.trim()) return;
    try {
      setInstalling(true);
      let source: string;
      let options: Record<string, unknown> = {};

      if (installSource.startsWith('http://') || installSource.startsWith('https://')) {
        source = 'marketplace';
        options = { marketplaceUrl: installSource };
      } else if (installSource.endsWith('.zip') || installSource.includes('/')) {
        source = 'file';
        options = { filePath: installSource };
      } else {
        source = 'marketplace';
        options = { pluginId: installSource };
      }

      await window.electronAPI?.plugins?.install(source, options);
      setInstallModalOpen(false);
      setInstallSource('');
      await loadPlugins();
    } catch (err) {
      console.error('Failed to install plugin:', err);
    } finally {
      setInstalling(false);
    }
  };

  const handleOpenPluginsDir = async () => {
    try {
      const dir = await window.electronAPI?.plugins?.getDir();
      if (dir) {
        window.electronAPI?.openFile(dir);
      }
    } catch (err) {
      console.error('Failed to open plugins directory:', err);
    }
  };

  const pluginsByType = plugins.reduce((acc, plugin) => {
    const type = plugin.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(plugin);
    return acc;
  }, {} as Record<string, Plugin[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin text-deep-space-accent-neon" />
        <span className="ml-3 text-white/50">Loading plugins...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">Plugin Manager</h3>
          <p className="text-sm text-white/40">Extend Comet with AI models, commands, and integrations</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleOpenPluginsDir}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all text-xs font-bold uppercase tracking-widest"
          >
            <FolderOpen size={14} />
            Open Folder
          </button>
          <button
            onClick={() => setInstallModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-deep-space-accent-neon/10 border border-deep-space-accent-neon/30 text-deep-space-accent-neon hover:bg-deep-space-accent-neon/20 transition-all text-xs font-bold uppercase tracking-widest"
          >
            <Plus size={14} />
            Install Plugin
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
          <AlertCircle size={18} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {plugins.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-2xl bg-white/[0.02] border border-white/5">
          <Puzzle size={48} className="text-white/10 mb-4" />
          <h4 className="text-lg font-bold text-white/50 mb-2">No Plugins Installed</h4>
          <p className="text-sm text-white/30 mb-4">Get started by installing a plugin from the marketplace or a local file</p>
          <button
            onClick={() => setInstallModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-deep-space-accent-neon/10 border border-deep-space-accent-neon/30 text-deep-space-accent-neon hover:bg-deep-space-accent-neon/20 transition-all text-xs font-bold uppercase tracking-widest"
          >
            <Plus size={14} />
            Install Your First Plugin
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(pluginsByType).map(([type, typePlugins]) => (
            <div key={type} className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/30">
                {typeIcons[type]}
                <span>{typeLabels[type] || type}</span>
                <span className="ml-1 px-2 py-0.5 rounded-full bg-white/5">{typePlugins.length}</span>
              </div>
              <div className="grid gap-3">
                {typePlugins.map((plugin) => (
                  <motion.div
                    key={plugin.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          plugin.status === 'error' ? 'bg-red-500/10' :
                          plugin.enabled ? 'bg-deep-space-accent-neon/10' : 'bg-white/5'
                        }`}>
                          {plugin.status === 'error' ? (
                            <XCircle size={18} className="text-red-400" />
                          ) : plugin.enabled ? (
                            <CheckCircle size={18} className="text-deep-space-accent-neon" />
                          ) : (
                            <Power size={18} className="text-white/30" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-white">{plugin.name}</h4>
                            <span className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] font-bold text-white/40">
                              v{plugin.version}
                            </span>
                            {plugin.enabled && (
                              <span className="px-2 py-0.5 rounded-full bg-deep-space-accent-neon/10 text-[10px] font-bold text-deep-space-accent-neon">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-white/40 mb-2">{plugin.description}</p>
                          <div className="flex items-center gap-3 text-[10px] text-white/30">
                            <span>by {plugin.author}</span>
                            {plugin.permissions.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Shield size={10} />
                                {plugin.permissions.length} permissions
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {plugin.hasConfig && (
                          <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
                            <Settings size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => plugin.enabled ? handleDisable(plugin.id) : handleEnable(plugin.id)}
                          className={`p-2 rounded-lg transition-all ${
                            plugin.enabled 
                              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400' 
                              : 'bg-green-500/10 hover:bg-green-500/20 text-green-400'
                          }`}
                          title={plugin.enabled ? 'Disable' : 'Enable'}
                        >
                          <Power size={14} />
                        </button>
                        <button
                          onClick={() => handleUninstall(plugin.id)}
                          className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                          title="Uninstall"
                        >
                          <Trash2 size={14} />
                        </button>
                        {plugin.commands && plugin.commands.length > 0 && (
                          <button
                            onClick={() => setExpandedPlugin(expandedPlugin === plugin.id ? null : plugin.id)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                          >
                            {expandedPlugin === plugin.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}
                      </div>
                    </div>

                    <AnimatePresence>
                      {expandedPlugin === plugin.id && plugin.commands && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-4 pt-4 border-t border-white/5"
                        >
                          <h5 className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">Commands</h5>
                          <div className="space-y-2">
                            {plugin.commands.map((cmd) => (
                              <div key={cmd.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02]">
                                <div>
                                  <span className="font-mono text-sm text-deep-space-accent-neon">{cmd.id}</span>
                                  <p className="text-xs text-white/40">{cmd.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {plugin.status === 'error' && plugin.error && (
                      <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                        <strong>Error:</strong> {plugin.error}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {installModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1600] flex items-center justify-center bg-black/60 backdrop-blur-xl"
            onClick={() => setInstallModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg p-8 rounded-3xl bg-deep-space-bg border border-white/10 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-2">Install Plugin</h3>
              <p className="text-sm text-white/40 mb-6">Enter a marketplace URL, plugin ID, or file path</p>
              
              <input
                type="text"
                value={installSource}
                onChange={(e) => setInstallSource(e.target.value)}
                placeholder="https://marketplace.com/plugin.zip or /path/to/plugin"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:border-deep-space-accent-neon/50 focus:outline-none transition-all"
              />
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setInstallModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all text-xs font-bold uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInstall}
                  disabled={!installSource.trim() || installing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-deep-space-accent-neon/10 border border-deep-space-accent-neon/30 text-deep-space-accent-neon hover:bg-deep-space-accent-neon/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs font-bold uppercase tracking-widest"
                >
                  {installing ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      Install
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
