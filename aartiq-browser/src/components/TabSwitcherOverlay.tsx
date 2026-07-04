"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import { Globe } from 'lucide-react';

export const TabSwitcherOverlay = ({ visible }: { visible: boolean }) => {
    const store = useAppStore();
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
        if (visible) {
            const activeIdx = store.tabs.findIndex(t => t.id === store.activeTabId);
            setSelectedIndex(activeIdx >= 0 ? activeIdx : 0);
        }
    }, [visible, store.tabs, store.activeTabId]);

    useEffect(() => {
        if (!visible) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Tab' && e.altKey) {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % store.tabs.length);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Alt') {
                const selectedTab = store.tabs[selectedIndex];
                if (selectedTab && selectedTab.id !== store.activeTabId) {
                    store.setActiveTabId(selectedTab.id);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [visible, store.tabs, selectedIndex, store.activeTabId]);

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-md">
            <div className="flex gap-4 p-8 overflow-x-auto no-scrollbar max-w-[90vw]">
                {store.tabs.map((tab, idx) => (
                    <motion.div
                        key={tab.id}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{
                            scale: selectedIndex === idx ? 1.1 : 0.9,
                            opacity: selectedIndex === idx ? 1 : 0.5,
                            borderColor: selectedIndex === idx ? "rgba(0, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.1)"
                        }}
                        className={`flex flex-col items-center gap-4 p-6 rounded-3xl bg-black/60 border-2 transition-all min-w-[160px]`}
                    >
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${selectedIndex === idx ? 'bg-deep-space-accent-neon text-deep-space-bg shadow-[0_0_30px_rgba(0,255,255,0.3)]' : 'bg-white/5 text-white/20'}`}>
                            <Globe size={32} />
                        </div>
                        <div className="text-center">
                            <span className="text-xs font-black uppercase tracking-widest text-white truncate max-w-[120px] block">
                                {tab.title || 'New Tab'}
                            </span>
                            <span className="text-[10px] text-white/30 truncate max-w-[120px] block mt-1">
                                {tab.url}
                            </span>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
