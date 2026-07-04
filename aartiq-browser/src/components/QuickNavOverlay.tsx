"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import { Globe, Bookmark, History, X, Command } from 'lucide-react';

export const QuickNavOverlay: React.FC = () => {
    const store = useAppStore();
    const [overlayType, setOverlayType] = useState<'none' | 'tabs' | 'launcher'>('none');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);
    const [isShiftPressed, setIsShiftPressed] = useState(false);
    const [isAltPressed, setIsAltPressed] = useState(false);

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const tabs = store.tabs;
    const pinned = store.bookmarks.slice(0, 10);
    const mostUsed = Array.from(new Set(store.history)).slice(0, 10);

    const launcherItems = [
        ...pinned.map(b => ({ type: 'pinned' as const, ...b })),
        ...mostUsed.map((item, i) => ({ type: 'history' as const, id: `hist-${i}`, url: item.url, title: item.title || item.url.split('/')[2] || item.url }))
    ];

    const handleAction = useCallback(() => {
        if (overlayType === 'tabs') {
            const selectedTab = tabs[selectedIndex];
            if (selectedTab) {
                store.setActiveTab(selectedTab.id);
            }
        } else if (overlayType === 'launcher') {
            const selectedItem = launcherItems[selectedIndex];
            if (selectedItem) {
                store.setCurrentUrl(selectedItem.url);
                store.setActiveView('browser');
                // Simulate handleGo logic if needed, but setActiveTab usually handles it
                // Actually, history items might need a new tab or update active tab
                store.updateTab(store.activeTabId, { url: selectedItem.url, title: selectedItem.title });
            }
        }
        setOverlayType('none');
        setSelectedIndex(0);
    }, [overlayType, selectedIndex, tabs, launcherItems, store]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Control') setIsCtrlPressed(true);
            if (e.key === 'Shift') setIsShiftPressed(true);
            if (e.key === 'Alt') setIsAltPressed(true);
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control') {
                setIsCtrlPressed(false);
                if (overlayType !== 'none') handleAction();
            } else if (e.key === 'Shift') {
                setIsShiftPressed(false);
                if (overlayType !== 'none') handleAction();
            } else if (e.key === 'Alt') {
                setIsAltPressed(false);
                if (overlayType === 'launcher') handleAction();
            }
        };

        const handleWheel = (e: WheelEvent) => {
            const ctrl = e.ctrlKey || isCtrlPressed;
            const shift = e.shiftKey || isShiftPressed;
            const alt = e.altKey || isAltPressed;

            if (ctrl && shift && alt) {
                e.preventDefault();
                if (overlayType !== 'launcher') {
                    setOverlayType('launcher');
                    setSelectedIndex(0);
                }
                const direction = e.deltaY > 0 ? 1 : -1;
                setSelectedIndex(prev => {
                    const next = prev + direction;
                    if (next < 0) return launcherItems.length - 1;
                    if (next >= launcherItems.length) return 0;
                    return next;
                });
            } else if (ctrl && shift) {
                e.preventDefault();
                if (overlayType !== 'tabs') {
                    setOverlayType('tabs');
                    const currentIndex = tabs.findIndex(t => t.id === store.activeTabId);
                    setSelectedIndex(currentIndex >= 0 ? currentIndex : 0);
                }
                const direction = e.deltaY > 0 ? 1 : -1;
                setSelectedIndex(prev => {
                    const next = prev + direction;
                    if (next < 0) return tabs.length - 1;
                    if (next >= tabs.length) return 0;
                    return next;
                });
            }
        };

        const resetTimeout = () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                // Optional: auto-commit after inactivity? 
                // The prompt says "when he stops", which could mean scroll stop or key release.
                // Releasing keys is more standard for switcher behavior.
            }, 1500);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('wheel', handleWheel);
        };
    }, [isCtrlPressed, isShiftPressed, isAltPressed, overlayType, tabs, launcherItems, store.activeTabId, handleAction]);

    if (overlayType === 'none') return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="glass-vibrant border border-white/10 rounded-[2rem] p-6 shadow-[0_0_100px_rgba(0,0,0,0.8)] min-w-[400px] max-w-[600px] bg-black/40 backdrop-blur-3xl pointer-events-auto"
            >
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-deep-space-accent-neon flex items-center justify-center text-deep-space-bg shadow-[0_0_20px_rgba(0,255,255,0.4)]">
                            {overlayType === 'tabs' ? <Command size={20} /> : <Globe size={20} />}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white uppercase tracking-tighter">
                                {overlayType === 'tabs' ? 'Tab Swapper' : 'Quick Launcher'}
                            </h2>
                            <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-black">
                                {overlayType === 'tabs' ? `Cycling ${tabs.length} open tabs` : 'Pinned & Frequent sites'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-hidden">
                    {overlayType === 'tabs' ? (
                        tabs.slice(Math.max(0, selectedIndex - 2), selectedIndex + 3).map((tab, idx) => {
                            const actualIndex = tabs.indexOf(tab);
                            const isSelected = actualIndex === selectedIndex;
                            return (
                                <motion.div
                                    key={tab.id}
                                    layout
                                    className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${isSelected ? 'bg-white/10 border border-white/20' : 'opacity-40'}`}
                                >
                                    <div className={`p-2 rounded-xl ${isSelected ? 'bg-deep-space-accent-neon/20 text-deep-space-accent-neon' : 'bg-white/5 text-white/20'}`}>
                                        <Globe size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-white truncate">{tab.title}</h3>
                                        <p className="text-[10px] text-white/30 truncate">{tab.url}</p>
                                    </div>
                                    {isSelected && (
                                        <motion.div layoutId="selector" className="w-1.5 h-6 bg-deep-space-accent-neon rounded-full" />
                                    )}
                                </motion.div>
                            );
                        })
                    ) : (
                        launcherItems.slice(Math.max(0, selectedIndex - 2), selectedIndex + 3).map((item, idx) => {
                            const actualIndex = launcherItems.indexOf(item);
                            const isSelected = actualIndex === selectedIndex;
                            return (
                                <motion.div
                                    key={item.id}
                                    layout
                                    className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${isSelected ? 'bg-white/10 border border-white/20' : 'opacity-40'}`}
                                >
                                    <div className={`p-2 rounded-xl ${isSelected ? 'bg-deep-space-accent-neon/20 text-deep-space-accent-neon' : 'bg-white/5 text-white/20'}`}>
                                        {item.type === 'pinned' ? <Bookmark size={18} /> : <History size={18} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-white truncate">{item.title}</h3>
                                        <p className="text-[10px] text-white/30 truncate">{item.url}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${item.type === 'pinned' ? 'border-yellow-500/30 text-yellow-500/60' : 'border-blue-500/30 text-blue-500/60'}`}>
                                            {item.type}
                                        </span>
                                        {isSelected && (
                                            <motion.div layoutId="selector-launcher" className="w-1.5 h-6 bg-deep-space-accent-neon rounded-full" />
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>

                <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between">
                    <div className="flex gap-2">
                        <span className="text-[9px] bg-white/5 px-2 py-1 rounded-md text-white/40 border border-white/5 uppercase tracking-widest font-bold">Scroll to navigate</span>
                        <span className="text-[9px] bg-white/5 px-2 py-1 rounded-md text-white/40 border border-white/5 uppercase tracking-widest font-bold">Release keys to select</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
