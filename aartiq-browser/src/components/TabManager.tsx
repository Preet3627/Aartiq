"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Volume2, VolumeX, Star, Settings as SettingsIcon, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getTabManager } from '@/lib/AdvancedTabManager';

interface TabManagerProps {
    isOpen: boolean;
    onClose: () => void;
}

const TabManager: React.FC<TabManagerProps> = ({ isOpen, onClose }) => {
    const store = useAppStore();
    const tabManager = getTabManager();
    const [tabs, setTabs] = useState(tabManager.getAllTabs());
    const [selectedTab, setSelectedTab] = useState<string | null>(null);

    const refreshTabs = () => {
        setTabs(tabManager.getAllTabs());
    };

    const handleCreateTab = () => {
        const id = tabManager.createTab('https://www.google.com');
        tabManager.switchToTab(id);
        refreshTabs();
    };

    const handleSwitchTab = (tabId: string) => {
        tabManager.switchToTab(tabId);
        refreshTabs();
        onClose();
    };

    const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        tabManager.closeTab(tabId);
        refreshTabs();
    };

    const handleToggleKeepAlive = (tabId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const tab = tabs.find(t => t.id === tabId);
        if (tab) {
            tabManager.setKeepAlive(tabId, !tab.keepAliveInBackground);
            refreshTabs();
        }
    };

    const handleToggleSound = (tabId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const tab = tabs.find(t => t.id === tabId);
        if (tab) {
            tabManager.setTabSound(tabId, '/notification.mp3', 1.0, false);
            refreshTabs();
        }
    };

    const handleSetPriority = (tabId: string, priority: 'high' | 'normal' | 'low') => {
        tabManager.setTabPriority(tabId, priority);
        refreshTabs();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="w-[90vw] max-w-5xl h-[80vh] bg-deep-space-bg border border-white/10 rounded-3xl overflow-hidden shadow-[0_20px_100px_rgba(0,0,0,0.9)]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10">
                            <div>
                                <h2 className="text-2xl font-black text-white">Tab Manager</h2>
                                <p className="text-sm text-white/40 mt-1">
                                    {tabs.length} / 50 tabs • {tabs.filter(t => t.active).length} active
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleCreateTab}
                                    className="flex items-center gap-2 px-4 py-2 bg-deep-space-accent-neon text-black rounded-xl font-bold text-sm hover:scale-105 transition-all"
                                >
                                    <Plus size={16} />
                                    New Tab
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-white/5 rounded-xl transition-all"
                                >
                                    <X size={24} className="text-white/60" />
                                </button>
                            </div>
                        </div>

                        {/* Tabs Grid */}
                        <div className="p-6 overflow-y-auto h-[calc(100%-88px)] custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {tabs.map((tab) => (
                                    <motion.div
                                        key={tab.id}
                                        layout
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className={`relative p-4 rounded-2xl border transition-all cursor-pointer group ${tab.active
                                                ? 'bg-deep-space-accent-neon/10 border-deep-space-accent-neon'
                                                : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.05] hover:border-white/20'
                                            }`}
                                        onClick={() => handleSwitchTab(tab.id)}
                                    >
                                        {/* Tab Content */}
                                        <div className="mb-3">
                                            <h3 className="text-white font-bold text-sm mb-1 truncate">
                                                {tab.title}
                                            </h3>
                                            <p className="text-white/40 text-xs truncate">
                                                {tab.url}
                                            </p>
                                        </div>

                                        {/* Badges */}
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {tab.keepAliveInBackground && (
                                                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-[10px] font-bold rounded-lg">
                                                    BACKGROUND
                                                </span>
                                            )}
                                            {tab.customSound?.enabled && (
                                                <span className="px-2 py-1 bg-deep-space-accent-neon/20 text-deep-space-accent-neon text-[10px] font-bold rounded-lg flex items-center gap-1">
                                                    <Volume2 size={10} />
                                                    SOUND
                                                </span>
                                            )}
                                            {tab.priority === 'high' && (
                                                <span className="px-2 py-1 bg-red-500/20 text-red-400 text-[10px] font-bold rounded-lg flex items-center gap-1">
                                                    <Star size={10} />
                                                    HIGH
                                                </span>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => handleToggleKeepAlive(tab.id, e)}
                                                className={`p-2 rounded-lg transition-all ${tab.keepAliveInBackground
                                                        ? 'bg-green-500/20 text-green-400'
                                                        : 'bg-white/5 text-white/40 hover:bg-white/10'
                                                    }`}
                                                title="Keep alive in background"
                                            >
                                                <Star size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => handleToggleSound(tab.id, e)}
                                                className={`p-2 rounded-lg transition-all ${tab.customSound?.enabled
                                                        ? 'bg-deep-space-accent-neon/20 text-deep-space-accent-neon'
                                                        : 'bg-white/5 text-white/40 hover:bg-white/10'
                                                    }`}
                                                title="Custom sound"
                                            >
                                                {tab.customSound?.enabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedTab(tab.id);
                                                }}
                                                className="p-2 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 transition-all"
                                                title="Settings"
                                            >
                                                <SettingsIcon size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => handleCloseTab(tab.id, e)}
                                                className="p-2 rounded-lg bg-white/5 text-red-400 hover:bg-red-500/20 transition-all ml-auto"
                                                title="Close tab"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>

                                        {/* Active Indicator */}
                                        {tab.active && (
                                            <div className="absolute top-2 right-2 w-2 h-2 bg-deep-space-accent-neon rounded-full animate-pulse" />
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* Tab Settings Modal */}
                    {selectedTab && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute inset-0 flex items-center justify-center z-10"
                            onClick={() => setSelectedTab(null)}
                        >
                            <div
                                className="w-[500px] bg-deep-space-bg border border-white/10 rounded-2xl p-6"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <h3 className="text-xl font-black text-white mb-4">Tab Settings</h3>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm text-white/60 mb-2 block">Priority</label>
                                        <div className="flex gap-2">
                                            {(['low', 'normal', 'high'] as const).map((priority) => (
                                                <button
                                                    key={priority}
                                                    onClick={() => handleSetPriority(selectedTab, priority)}
                                                    className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${tabs.find(t => t.id === selectedTab)?.priority === priority
                                                            ? 'bg-deep-space-accent-neon text-black'
                                                            : 'bg-white/5 text-white/60 hover:bg-white/10'
                                                        }`}
                                                >
                                                    {priority.toUpperCase()}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setSelectedTab(null)}
                                        className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-white transition-all"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default TabManager;
