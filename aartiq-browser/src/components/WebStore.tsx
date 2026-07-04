"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import extensionManager, { Extension } from '@/lib/extensions/ExtensionManager';
import { ShoppingBag, Star, Download, ShieldCheck, Zap, X } from 'lucide-react';

const WebStore = ({ onClose }: { onClose: () => void }) => {
    const [extensions, setExtensions] = useState<any[]>([]);

    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.getExtensions().then(setExtensions);
        }
    }, []);

    const handleToggle = async (id: string) => {
        if (window.electronAPI) {
            await window.electronAPI.toggleExtension(id);
            const updated = await window.electronAPI.getExtensions();
            setExtensions(updated);
        }
    };

    return (
        <div className="relative w-full h-full flex items-center justify-center p-8 bg-[var(--primary-bg)] backdrop-blur-xl animate-in fade-in duration-300">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-5xl h-[80vh] bg-[var(--card-bg)] border border-[var(--border-color)] rounded-[2.5rem] overflow-hidden flex shadow-[0_8px_32px_var(--shadow-color)] relative"
            >
                {/* Sidebar */}
                <div className="w-64 border-r border-[var(--border-color)] p-8 flex flex-col gap-8 bg-[var(--primary-bg)]/40 backdrop-blur-2xl">
                    <div className="flex items-center gap-3 text-[var(--primary-text)] font-black text-2xl tracking-tighter">
                        <ShoppingBag size={28} className="text-sky-400" />
                        <span>NEBULA</span>
                    </div>
                    <nav className="space-y-3">
                        <button className="w-full text-left px-5 py-3 rounded-2xl bg-[var(--primary-bg)]/10 text-[var(--primary-text)] text-sm font-bold border border-[var(--border-color)]">All Modules</button>
                        <button className="w-full text-left px-5 py-3 rounded-2xl text-[var(--secondary-text)] hover:bg-[var(--primary-bg)]/5 hover:text-[var(--primary-text)] transition-all text-sm font-bold">Themes</button>
                        <button className="w-full text-left px-5 py-3 rounded-2xl text-[var(--secondary-text)] hover:bg-[var(--primary-bg)]/5 hover:text-[var(--primary-text)] transition-all text-sm font-bold">Intelligence</button>
                    </nav>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col p-10 overflow-y-auto custom-scrollbar bg-nebula relative">
                    <header className="flex items-center justify-between mb-12">
                        <div>
                            <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-2">Workspace <span className="text-sky-400">Store</span></h2>
                            <p className="text-slate-400 text-sm font-medium">Augment your Comet environment with neural modules.</p>
                        </div>
                        <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-white border border-white/5">
                            <X size={20} />
                        </button>
                    </header>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {extensions.map((ext) => (
                            <motion.div
                                whileHover={{ y: -5, borderColor: 'rgba(56, 189, 248, 0.3)' }}
                                key={ext.id}
                                className="p-8 rounded-[2rem] bg-white/[0.02] border border-white/5 flex gap-6 transition-all group"
                            >
                                <div className="w-20 h-20 rounded-2xl bg-black/40 flex items-center justify-center text-4xl shadow-xl border border-white/10 group-hover:scale-110 transition-transform">
                                    {ext.icon}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-bold text-xl text-white tracking-tight">{ext.name}</h3>
                                        <div className="flex items-center text-xs text-yellow-500 gap-1 font-bold">
                                            <Star size={12} fill="currentColor" />
                                            <span>4.9</span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-400 mb-6 leading-relaxed line-clamp-2">{ext.description}</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">CORE v{ext.version}</span>
                                        <button
                                            onClick={() => handleToggle(ext.id)}
                                            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${ext.enabled
                                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                : 'bg-white text-black hover:bg-sky-400 hover:text-white shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                                                }`}
                                        >
                                            {ext.enabled ? 'Eject' : 'Integrate'}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="mt-12 p-8 rounded-3xl bg-gradient-to-br from-deep-space-primary/20 to-deep-space-secondary/20 border border-white/5">
                        <div className="flex items-center gap-3 mb-4">
                            <Zap className="text-deep-space-accent-neon" size={24} />
                            <h3 className="text-xl font-bold text-white">Create your own extension</h3>
                        </div>
                        <p className="text-sm text-white/60 mb-6 max-w-xl">Our extension API is built on modern React and Electron standards. You can build plugins that interact with the AI sidebar or the page content directly.</p>
                        <button className="px-6 py-2.5 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-all text-sm">Developer Documentation</button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default WebStore;
