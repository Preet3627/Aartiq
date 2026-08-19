"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, Trash2, FolderOpen, RefreshCw, Plus, Upload, 
  ToggleRight, ToggleLeft, ShieldCheck, Search, BugPlay, 
  ExternalLink, Settings, ChevronDown, ChevronUp, Globe, 
  AlertTriangle, Puzzle, Code
} from 'lucide-react';

interface ExtensionMetadata {
    id: string;
    name: string;
    version: string;
    description: string;
    path: string;
    enabled: boolean;
    permissions?: string[];
    host_permissions?: string[];
    manifest_version?: number;
    icons?: { size: number; url: string }[];
    manifest?: Record<string, any>;
}

const PERMISSION_LABELS: Record<string, string> = {
  storage: 'Local data storage',
  tabs: 'Access to browser tabs',
  activeTab: 'Access to the active tab',
  cookies: 'Access to cookies',
  webRequest: 'Monitor network requests',
  downloads: 'Manage downloads',
  clipboardRead: 'Read clipboard',
  clipboardWrite: 'Write to clipboard',
  notifications: 'Display notifications',
  geolocation: 'Access location',
  history: 'Access browsing history',
  bookmarks: 'Access bookmarks',
  management: 'Manage extensions',
  nativeMessaging: 'Communicate with native apps',
  alarms: 'Schedule tasks',
  idle: 'Detect system idle state',
  contextMenus: 'Add items to context menu',
  background: 'Run in the background',
};

function getPermissionLabel(perm: string): string {
  return PERMISSION_LABELS[perm] || perm.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

function getColorForExtension(id: string): string {
  const colors = [
    'from-cyan-500/30 to-blue-600/30 border-cyan-500/30',
    'from-purple-500/30 to-pink-600/30 border-purple-500/30',
    'from-emerald-500/30 to-teal-600/30 border-emerald-500/30',
    'from-amber-500/30 to-orange-600/30 border-amber-500/30',
    'from-rose-500/30 to-red-600/30 border-rose-500/30',
    'from-indigo-500/30 to-violet-600/30 border-indigo-500/30',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
  return colors[Math.abs(hash) % colors.length];
}

function ExtensionDetailView({ ext, onClose }: { ext: ExtensionMetadata; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-[2.5rem] bg-[#0a0a0f] border border-white/10 p-8 shadow-2xl space-y-6"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-5">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getColorForExtension(ext.id)} flex items-center justify-center text-white font-black text-xl border`}>
              {ext.icons?.[0]?.url ? (
                <img src={ext.icons[0].url} alt="" className="w-10 h-10" />
              ) : (
                getInitials(ext.name)
              )}
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">{ext.name}</h2>
              <p className="text-sm text-white/40 mt-1">{ext.description || 'No description'}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[10px] font-black bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-white/40 uppercase">v{ext.version}</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${ext.enabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-white/30 border border-white/10'}`}>
                  {ext.enabled ? 'Enabled' : 'Disabled'}
                </span>
                {ext.manifest_version && (
                  <span className="text-[10px] font-black bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-white/30 uppercase">
                    Manifest V{ext.manifest_version}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-all text-white/30 hover:text-white">
            <ChevronDown size={20} />
          </button>
        </div>

        <div className="h-px bg-white/5" />

        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30 mb-3 flex items-center gap-2">
            <ShieldCheck size={14} /> Permissions
          </h3>
          {ext.permissions && ext.permissions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {ext.permissions.map(perm => (
                <span key={perm} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold text-white/50" title={getPermissionLabel(perm)}>
                  {getPermissionLabel(perm)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/20">No special permissions required.</p>
          )}
        </div>

        {ext.host_permissions && ext.host_permissions.length > 0 && (
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30 mb-3 flex items-center gap-2">
              <Globe size={14} /> Site Access
            </h3>
            <div className="flex flex-wrap gap-2">
              {ext.host_permissions.map(hp => (
                <span key={hp} className="px-3 py-1.5 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[10px] font-bold text-amber-400/70">
                  {hp}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30 mb-3 flex items-center gap-2">
            <Code size={14} /> Extension Info
          </h3>
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div className="p-3 rounded-xl bg-white/5">
              <span className="text-white/20 block mb-1">ID</span>
              <span className="text-white/60 font-mono text-[10px] break-all">{ext.id}</span>
            </div>
            <div className="p-3 rounded-xl bg-white/5">
              <span className="text-white/20 block mb-1">Path</span>
              <span className="text-white/60 font-mono text-[10px] break-all">{ext.path}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

const ExtensionSettings = () => {
    const [extensions, setExtensions] = useState<ExtensionMetadata[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [installStatus, setInstallStatus] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [devMode, setDevMode] = useState(false);
    const [detailExt, setDetailExt] = useState<ExtensionMetadata | null>(null);
    const [showPermissions, setShowPermissions] = useState<Set<string>>(new Set());

    const fetchExtensions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            if (window.electronAPI) {
                const exts = await window.electronAPI.getExtensions();
                setExtensions(exts);
            }
        } catch (err) {
            setError("Failed to load extensions.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchExtensions();
    }, [fetchExtensions]);

    useEffect(() => {
        if (!window.electronAPI) return;
        const unsubInstall = window.electronAPI.onExtensionInstalled?.(() => fetchExtensions());
        const unsubRemove = window.electronAPI.onExtensionRemoved?.(() => fetchExtensions());
        const unsubUpdate = window.electronAPI.onExtensionUpdated?.(() => fetchExtensions());
        return () => {
            unsubInstall?.();
            unsubRemove?.();
            unsubUpdate?.();
        };
    }, [fetchExtensions]);

    const handleToggle = async (id: string) => {
        const result = await window.electronAPI?.toggleExtension(id);
        if (result?.success) {
            setExtensions(prev => prev.map(ext =>
                ext.id === id ? { ...ext, enabled: result.enabled ?? ext.enabled } : ext
            ));
        }
    };

    const handleUninstall = async (id: string) => {
        if (!confirm("Uninstall this extension? Its folder will be deleted.")) return;
        const success = await window.electronAPI?.uninstallExtension(id);
        if (success) setExtensions(extensions.filter(ext => ext.id !== id));
    };

    const handleOpenDir = () => window.electronAPI?.openExtensionDir();

    const handleInstallFromFolder = async () => {
        setInstallStatus(null);
        const result = await window.electronAPI?.selectAndInstallExtension();
        if (result?.success) {
            setInstallStatus(`Installed: ${result.extension?.name ?? 'extension'}`);
            fetchExtensions();
        } else if (result?.error !== 'Cancelled') {
            setInstallStatus(`Failed: ${result?.error || 'Unknown error'}`);
        }
    };

    const filtered = extensions.filter(ext =>
        ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ext.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {detailExt && (
                <ExtensionDetailView ext={detailExt} onClose={() => setDetailExt(null)} />
            )}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h3 className="text-lg font-black text-white tracking-tight">Extensions</h3>
                    <p className="text-xs text-white/30 mt-1">Manage your browser extensions</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setDevMode(!devMode)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                            devMode
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                : 'bg-white/5 border-white/5 text-white/40 hover:text-white/60'
                        }`}
                    >
                        <BugPlay size={12} />
                        Developer Mode
                    </button>
                    <button
                        onClick={handleOpenDir}
                        className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white/70 transition-all"
                    >
                        <FolderOpen size={12} /> Folder
                    </button>
                    <button
                        onClick={fetchExtensions}
                        className={`p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-white/50 transition-all ${loading ? 'animate-spin pointer-events-none' : ''}`}
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* Install Status */}
            <AnimatePresence>
                {installStatus && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-3 rounded-2xl bg-deep-space-accent-neon/10 border border-deep-space-accent-neon/20 text-deep-space-accent-neon text-xs font-bold flex items-center gap-2"
                    >
                        <Puzzle size={14} /> {installStatus}
                        <button onClick={() => setInstallStatus(null)} className="ml-auto opacity-50 hover:opacity-100">&times;</button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Search + Install Actions */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search extensions..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-[12px] text-white/70 focus:outline-none focus:border-deep-space-accent-neon/40 placeholder:text-white/20"
                    />
                </div>
                <button
                    onClick={handleInstallFromFolder}
                    className="flex items-center gap-2 px-4 py-2 bg-deep-space-accent-neon/10 hover:bg-deep-space-accent-neon/20 border border-deep-space-accent-neon/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-deep-space-accent-neon transition-all"
                >
                    <Upload size={12} /> Load Unpacked
                </button>
                <button
                    onClick={() => window.open('https://chromewebstore.google.com/', '_blank')}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white/70 transition-all"
                >
                    <ExternalLink size={12} /> Chrome Web Store
                </button>
            </div>

            {/* Extension List */}
            <div className="space-y-2">
                {loading && extensions.length === 0 ? (
                    <div className="py-24 text-center">
                        <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center animate-pulse">
                            <Package size={24} className="text-white/20" />
                        </div>
                        <p className="text-xs text-white/20 font-bold uppercase tracking-widest animate-pulse">Loading extensions...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-24 text-center bg-white/[0.01] border border-dashed border-white/5 rounded-3xl">
                        <Puzzle size={48} className="mx-auto mb-4 text-white/10" />
                        <p className="text-sm text-white/20 font-bold">{searchQuery ? 'No matching extensions' : 'No extensions installed'}</p>
                        <p className="text-xs text-white/10 mt-2">Load an unpacked extension or install from the Chrome Web Store</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {filtered.map((ext) => (
                            <motion.div
                                key={ext.id}
                                layout
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className={`p-5 rounded-[2rem] border transition-all relative overflow-hidden group ${
                                    ext.enabled
                                        ? 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                                        : 'bg-white/[0.01] border-white/[0.03] hover:bg-white/[0.02] opacity-60'
                                }`}
                            >
                                <div className={`absolute inset-0 bg-gradient-to-br ${getColorForExtension(ext.id)} opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`} />
                                <div className="flex items-start gap-4 relative z-10">
                                    {/* Icon */}
                                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getColorForExtension(ext.id)} flex items-center justify-center text-white font-black text-base flex-shrink-0 border ${ext.enabled ? 'opacity-100' : 'opacity-50'}`}>
                                        {ext.icons?.[0]?.url ? (
                                            <img src={ext.icons[0].url} alt="" className="w-9 h-9" />
                                        ) : (
                                            getInitials(ext.name)
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className={`font-black tracking-tight ${ext.enabled ? 'text-white' : 'text-white/50'}`}>
                                                {ext.name}
                                            </h4>
                                            <span className="text-[9px] font-black bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-white/30">
                                                v{ext.version}
                                            </span>
                                            {!ext.enabled && (
                                                <span className="text-[9px] font-black bg-white/5 px-1.5 py-0.5 rounded text-white/20 uppercase">Disabled</span>
                                            )}
                                        </div>
                                        <p className={`text-xs mt-1 line-clamp-1 ${ext.enabled ? 'text-white/40' : 'text-white/20'}`}>
                                            {ext.description || 'No description'}
                                        </p>

                                        {/* Permissions hint */}
                                        {ext.permissions && ext.permissions.length > 0 && (
                                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                                <ShieldCheck size={10} className="text-white/20" />
                                                {ext.permissions.slice(0, 3).map(p => (
                                                    <span key={p} className="text-[8px] font-bold text-white/20 bg-white/5 px-1.5 py-0.5 rounded-full">
                                                        {getPermissionLabel(p)}
                                                    </span>
                                                ))}
                                                {ext.permissions.length > 3 && (
                                                    <span className="text-[8px] text-white/15">+{ext.permissions.length - 3} more</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Dev mode details */}
                                        {devMode && (
                                            <div className="mt-2 flex items-center gap-3 text-[9px] font-mono text-white/20">
                                                <span>ID: {ext.id.substring(0, 16)}...</span>
                                                <span>Path: {ext.path.substring(0, 30)}...</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <button
                                            onClick={() => setDetailExt(ext)}
                                            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white/30 hover:text-white/60 transition-all"
                                            title="Details"
                                        >
                                            <Settings size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleToggle(ext.id)}
                                            className={`p-2.5 rounded-xl border transition-all ${
                                                ext.enabled
                                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                                                    : 'bg-white/5 border-white/5 text-white/30 hover:text-white/60'
                                            }`}
                                            title={ext.enabled ? 'Disable' : 'Enable'}
                                        >
                                            {ext.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                        </button>
                                        <button
                                            onClick={() => handleUninstall(ext.id)}
                                            className="p-2.5 rounded-xl bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 text-red-400/50 hover:text-red-400 transition-all"
                                            title="Remove"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>

            {/* Error banner */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3"
                    >
                        <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
                        <span className="text-xs text-red-300">{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto text-red-400/50 hover:text-red-400">&times;</button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Developer Mode Panel */}
            <AnimatePresence>
                {devMode && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400/70 flex items-center gap-2">
                                <BugPlay size={12} /> Developer Mode
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                                <div className="p-3 rounded-xl bg-black/30">
                                    <span className="text-white/20 block mb-1">Extensions</span>
                                    <span className="text-white font-bold">{extensions.length}</span>
                                </div>
                                <div className="p-3 rounded-xl bg-black/30">
                                    <span className="text-white/20 block mb-1">Enabled</span>
                                    <span className="text-emerald-400 font-bold">{extensions.filter(e => e.enabled).length}</span>
                                </div>
                                <div className="p-3 rounded-xl bg-black/30">
                                    <span className="text-white/20 block mb-1">Disabled</span>
                                    <span className="text-white/50 font-bold">{extensions.filter(e => !e.enabled).length}</span>
                                </div>
                                <div className="p-3 rounded-xl bg-black/30">
                                    <span className="text-white/20 block mb-1">Extensions Dir</span>
                                    <span className="text-white/40 font-mono truncate block">{(window as any).electronAPI?.getExtensionPath?.() || ''}</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ExtensionSettings;
