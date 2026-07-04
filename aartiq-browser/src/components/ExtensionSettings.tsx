"use client";
import React, { useState, useEffect } from 'react';
import { Package, Trash2, ExternalLink, FolderOpen, RefreshCw, Plus, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExtensionMetadata {
    id: string;
    name: string;
    version: string;
    description: string;
    path: string;
}

const ExtensionSettings = () => {
    const [extensions, setExtensions] = useState<ExtensionMetadata[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchExtensions = async () => {
        setLoading(true);
        setError(null);
        try {
            if (window.electronAPI) {
                const exts = await window.electronAPI.getExtensions();
                setExtensions(exts);
            }
        } catch (err) {
            setError("Failed to load extensions.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExtensions();
    }, []);

    const handleUninstall = async (id: string) => {
        if (!confirm("Are you sure you want to uninstall this extension? This will delete its folder.")) return;
        try {
            const success = await window.electronAPI?.uninstallExtension(id);
            if (success) {
                setExtensions(extensions.filter(ext => ext.id !== id));
            }
        } catch (err) {
            console.error("Failed to uninstall extension:", err);
        }
    };

    const handleOpenDir = () => {
        window.electronAPI?.openExtensionDir();
    };

    const handleInstallPlugin = () => {
        // Open Chrome Web Store
        window.open('https://chromewebstore.google.com/', '_blank');
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white mb-1">Extensions & Plugins</h3>
                    <p className="text-xs text-white/30">Enhance your browsing experience with local Chrome extensions.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleOpenDir}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/60 transition-all"
                    >
                        <FolderOpen size={14} /> View Extensions Dir
                    </button>
                    <button
                        onClick={fetchExtensions}
                        className={`p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-white/60 transition-all ${loading ? 'animate-spin' : ''}`}
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                    onClick={handleInstallPlugin}
                    className="p-6 rounded-3xl border-2 border-dashed border-white/5 hover:border-deep-space-accent-neon/30 hover:bg-deep-space-accent-neon/5 transition-all group flex flex-col items-center justify-center text-center gap-4"
                >
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/20 group-hover:text-deep-space-accent-neon group-hover:bg-deep-space-accent-neon/10 transition-all">
                        <Plus size={24} />
                    </div>
                    <div>
                        <p className="font-bold text-white group-hover:text-deep-space-accent-neon transition-all text-sm">Install from Web Store</p>
                        <p className="text-[10px] text-white/20 uppercase font-black mt-1">Chrome Web Store Support</p>
                    </div>
                </button>

                <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3">
                    <div className="flex items-center gap-3 text-deep-space-accent-neon">
                        <ShieldCheck size={20} />
                        <span className="text-xs font-bold uppercase tracking-tight">Direct Installation</span>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Paste Extension URL or ID"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const val = e.currentTarget.value;
                                    let id = val;
                                    if (val.includes('chromewebstore.google.com')) {
                                        const parts = val.split('/');
                                        id = parts[parts.length - 1].split('?')[0];
                                    }
                                    if (id && id.length > 20) {
                                        const downloadUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=120.0&x=id%3D${id}%26installsource%3Dondemand%26uc`;
                                        window.open(downloadUrl, '_self');
                                    }
                                }
                            }}
                            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white focus:outline-none focus:border-deep-space-accent-neon/50"
                        />
                    </div>
                    <p className="text-[9px] text-white/20 leading-relaxed">
                        Paste a Chrome Web Store URL and press Enter to auto-download and install.
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Loaded Extensions ({extensions.length})</h4>

                {loading && extensions.length === 0 ? (
                    <div className="py-20 text-center text-white/20 animate-pulse">
                        <Package size={48} className="mx-auto mb-4" />
                        <p className="text-xs uppercase font-black tracking-widest">Scanning and verifying extensions...</p>
                    </div>
                ) : extensions.length === 0 ? (
                    <div className="py-20 text-center bg-white/[0.01] border border-dashed border-white/5 rounded-3xl">
                        <Package size={48} className="mx-auto mb-4 text-white/10" />
                        <p className="text-xs text-white/20">No external extensions loaded yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        <AnimatePresence>
                            {extensions.map((ext) => (
                                <motion.div
                                    key={ext.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="p-6 rounded-[2.5rem] bg-white/[0.02] border border-white/5 flex items-start gap-6 group hover:bg-white/[0.04] transition-all relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-deep-space-accent-neon/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="w-16 h-16 rounded-2xl bg-black/40 flex items-center justify-center text-deep-space-accent-neon border border-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] relative z-10">
                                        <Package size={32} />
                                    </div>
                                    <div className="flex-1 min-w-0 relative z-10">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h5 className="font-black text-white text-base tracking-tight truncate">{ext.name}</h5>
                                            <span className="text-[9px] font-black bg-deep-space-accent-neon/10 border border-deep-space-accent-neon/20 px-2 py-0.5 rounded-full text-deep-space-accent-neon uppercase">v{ext.version}</span>
                                        </div>
                                        <p className="text-xs text-white/40 line-clamp-2 leading-relaxed font-medium mb-4">{ext.description || 'No description provided.'}</p>
                                        <div className="flex items-center gap-4">
                                            <p className="text-[9px] font-black text-white/10 uppercase tracking-widest bg-white/5 px-2 py-1 rounded">ID: {ext.id.substring(0, 12)}...</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 relative z-10 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                        <button
                                            onClick={() => handleUninstall(ext.id)}
                                            className="p-3 rounded-2xl bg-red-500/10 text-red-500/60 hover:bg-red-500 hover:text-white transition-all shadow-xl border border-red-500/20"
                                            title="Uninstall Module"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExtensionSettings;
