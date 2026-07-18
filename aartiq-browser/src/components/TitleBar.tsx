"use client";

import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Settings, Search } from 'lucide-react'; // Import Settings icon and Search icon
import { VirtualizedTabBar } from './VirtualizedTabBar';
import { useAppStore } from '@/store/useAppStore';

interface TitleBarProps {
    onToggleSpotlightSearch: () => void;
    onOpenSettings: () => void;
}

const TitleBar = ({ onToggleSpotlightSearch, onOpenSettings }: TitleBarProps) => {
    const handleMinimize = () => window.electronAPI?.minimizeWindow();
    const handleMaximize = () => window.electronAPI?.maximizeWindow();
    const handleClose = () => window.electronAPI?.closeWindow();
    const handleToggleFullscreen = () => window.electronAPI?.toggleFullscreen();
    const store = useAppStore();

    const [isMac, setIsMac] = useState(false);
    const [isWindows, setIsWindows] = useState(false);

    useEffect(() => {
        const ua = navigator.userAgent.toLowerCase();
        setIsMac(ua.includes('mac'));
        setIsWindows(ua.includes('windows'));
    }, []);

    const isTabSuspended = (tabId: string) => {
        const tab = store.tabs.find((t) => t.id === tabId);
        return tab?.isSuspended || false;
    };

    const showTabBar = store.activeView === 'browser';

    const handleOpenSettingsAction = () => {
        onOpenSettings();
    };

    return (
        <div
            className={`h-10 backdrop-blur-xl flex items-center justify-between px-4 select-none drag-region fixed top-0 left-0 right-0 z-[200] ${showTabBar ? 'border-b' : ''}`}
            style={{
                background: store.theme === 'light' ? '#FFFFFF' : 'color-mix(in srgb, var(--navbar-bg) 92%, transparent)',
                borderColor: 'var(--border-color)',
            }}
        >
            {isMac ? (
                <div className="w-[60px]" />
            ) : !isWindows ? (
                <div className="flex items-center no-drag-region h-full">
                    <button
                        onClick={handleMinimize}
                        className="h-full w-11 flex items-center justify-center text-secondary-text hover:text-primary-text hover:bg-white/10 active:bg-white/15 transition-colors"
                        title="Minimize"
                    >
                        <Minus size={14} />
                    </button>
                    <button
                        onClick={handleMaximize}
                        className="h-full w-11 flex items-center justify-center text-secondary-text hover:text-primary-text hover:bg-white/10 active:bg-white/15 transition-colors"
                        title="Maximize"
                    >
                        <Square size={11} />
                    </button>
                    <button
                        onClick={handleClose}
                        className="h-full w-11 flex items-center justify-center text-secondary-text hover:text-white hover:bg-red-500/80 active:bg-red-500 transition-colors"
                        title="Close"
                    >
                        <X size={15} />
                    </button>
                </div>
            ) : null}
            {/* Aartiq Logo and Text */}
            <div className="flex items-center gap-2 px-3 drag-region">
                <img src="/logo-transparent.png" alt="Aartiq Logo" className="w-5 h-5 object-contain" />
                <span className="text-xs font-black uppercase tracking-widest text-primary-text">Aartiq</span>
            </div>
            {showTabBar && (
            <div className="flex-1 min-w-0 drag-region">
                    <VirtualizedTabBar
                        tabs={store.tabs}
                        activeTabId={store.activeTabId}
                        onTabClick={(tabId) => store.setActiveTabId(tabId)}
                        onTabClose={(tabId) => store.removeTab(tabId)}
                        onAddTab={() => store.addTab()}
                        isTabSuspended={isTabSuspended}
                        maxVisibleTabs={10}
                    />
                </div>
            )}

            <div className="flex items-center no-drag-region h-full">
                {isWindows && (
                    <>
                        <button
                            onClick={handleMinimize}
                            className="h-full w-11 flex items-center justify-center text-secondary-text hover:text-primary-text hover:bg-white/10 active:bg-white/15 transition-colors"
                            title="Minimize"
                        >
                            <Minus size={14} />
                        </button>
                        <button
                            onClick={handleMaximize}
                            className="h-full w-11 flex items-center justify-center text-secondary-text hover:text-primary-text hover:bg-white/10 active:bg-white/15 transition-colors"
                            title="Maximize"
                        >
                            <Square size={11} />
                        </button>
                        <button
                            onClick={handleClose}
                            className="h-full w-11 flex items-center justify-center text-secondary-text hover:text-white hover:bg-red-500/80 active:bg-red-500 transition-colors"
                            title="Close"
                        >
                            <X size={15} />
                        </button>
                    </>
                )}
                <button onClick={onToggleSpotlightSearch} className="p-1 text-secondary-text hover:text-primary-text transition-colors" title="Global Spotlight Search">
                    <Search size={18} />
                </button>
                <button onClick={handleOpenSettingsAction} className="ml-2 p-1 text-secondary-text hover:text-primary-text transition-colors">
                    <Settings size={18} />
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
