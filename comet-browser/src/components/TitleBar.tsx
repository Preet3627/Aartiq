"use client";

import React, { useCallback, useState, useEffect } from 'react';
import { Minus, Square, X, Maximize2, Settings, Search, LogIn } from 'lucide-react'; // Import Settings icon and Search icon
import { VirtualizedTabBar } from './VirtualizedTabBar';
import { useAppStore } from '@/store/useAppStore';
import { useRouter } from 'next/navigation'; // Import useRouter
import { firebaseConfigStorage } from '@/lib/firebaseConfigStorage';

interface TitleBarProps {
    onToggleSpotlightSearch: () => void;
    onOpenSettings: () => void;
}

const TitleBar = ({ onToggleSpotlightSearch, onOpenSettings }: TitleBarProps) => {
    const handleMinimize = () => window.electronAPI?.minimizeWindow();
    const handleMaximize = () => window.electronAPI?.maximizeWindow();
    const handleClose = () => window.electronAPI?.closeWindow();
    const store = useAppStore();
    const router = useRouter(); // Initialize useRouter

    const [isMac, setIsMac] = useState(false);

    useEffect(() => {
        const platform = window.electronAPI?.getPlatform?.() || navigator.platform || navigator.userAgent;
        setIsMac(String(platform).toLowerCase().includes('mac') || String(platform).toLowerCase().includes('darwin'));
    }, []);

    const [isSigningIn, setIsSigningIn] = useState(false);

    const handleSignIn = useCallback(async () => {
        if (isSigningIn) return;
        setIsSigningIn(true);

        try {
            // Step 1: Always refresh config from landing page to get latest clientId/secret
            if (!store.clientId || !store.clientSecret) {
                await store.fetchAppConfig();
            }

            const clientId = store.clientId || '601898745585-8g9t0k72gq4q1a4s1o4d1t6t7e5v4c4g.apps.googleusercontent.com';
            const redirectUri = store.redirectUri || 'https://browser.ponsrischool.in/oauth2callback';

            if (!clientId) {
                console.error('[Auth] No clientId available — check landing page config');
                setIsSigningIn(false);
                return;
            }

            // Step 2: Build Google OAuth URL — request broad scopes including Gmail
            const scopes = [
                'openid',
                'email',
                'profile',
                'https://www.googleapis.com/auth/gmail.readonly',
                'https://www.googleapis.com/auth/gmail.send',
            ].join(' ');

            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${encodeURIComponent(clientId)}&` +
                `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                `response_type=code&` +
                `scope=${encodeURIComponent(scopes)}&` +
                `access_type=offline&` +
                `prompt=consent`; // Always show consent to get refresh_token

            console.log('[Auth] Opening Google Sign-In in external browser...');

            // Step 3: Open system browser with updated logic
            if (window.electronAPI) {
                const firebaseConfig = firebaseConfigStorage.load() || {};
                const authUrl = `https://browser.ponsrischool.in/auth?client_id=desktop-app&redirect_uri=comet-browser%3A%2F%2Fauth&firebase_config=${btoa(JSON.stringify(firebaseConfig))}`;
                window.electronAPI.openAuthWindow(authUrl);
            }
        } catch (err) {
            console.error('[Auth] Sign-in initiation failed:', err);
        } finally {
            // Reset after a delay — callback will handle the actual state update
            setTimeout(() => setIsSigningIn(false), 5000);
        }
    }, [store, isSigningIn]);

    const isTabSuspended = (tabId: string) => {
        const tab = store.tabs.find((t) => t.id === tabId);
        return tab?.isSuspended || false;
    };

    const showTabBar = store.activeView === 'browser';

    const handleOpenSettingsAction = () => {
        onOpenSettings();
    };

    return (
        <div className={`h-10 bg-black/60 backdrop-blur-xl flex items-center justify-between px-4 select-none drag-region fixed top-0 left-0 right-0 z-[200] ${showTabBar ? 'border-b border-white/5' : ''}`}>
            {!isMac ? (
                <div className="flex items-center gap-2 no-drag-region">
                    <button onClick={handleClose} className="h-3 w-3 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center group">
                        <X size={8} className="text-black opacity-0 group-hover:opacity-100" />
                    </button>
                    <button onClick={handleMinimize} className="h-3 w-3 rounded-full bg-yellow-500 hover:bg-yellow-600 flex items-center justify-center group">
                        <Minus size={8} className="text-black opacity-0 group-hover:opacity-100" />
                    </button>
                    <button onClick={handleMaximize} className="h-3 w-3 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center group">
                        <Maximize2 size={8} className="text-black opacity-0 group-hover:opacity-100" />
                    </button>
                </div>
            ) : (
                <div className="w-[72px] shrink-0" /> // Keep native macOS traffic-light space reserved
            )}
            {/* Comet AI Logo and Text */}
            <div className="flex items-center gap-2 px-3 drag-region">
                <img src="icon.ico" alt="Comet AI Logo" className="w-5 h-5 object-contain" />
                <span className="text-xs font-black uppercase tracking-widest text-white/80">Comet-AI</span>
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
                <button onClick={onToggleSpotlightSearch} className="p-1 text-white/60 hover:text-white transition-colors" title="Global Spotlight Search">
                    <Search size={18} />
                </button>
                {(store.user?.photoURL || store.localPhotoURL) ? (
                    <img
                        src={(store.user && store.user.photoURL) || store.localPhotoURL || ''}
                        alt="Profile"
                        className="w-6 h-6 rounded-full border border-white/10 cursor-pointer object-cover shadow-sm hover:scale-105 transition-transform"
                        onClick={() => router.push('/settings?section=profile')}
                        title={store.user?.displayName || store.user?.email || 'User Profile'}
                    />
                ) : (
                    <button
                        onClick={handleSignIn}
                        disabled={isSigningIn}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all flex items-center gap-1 ${
                            isSigningIn
                                ? 'bg-sky-500/5 text-sky-400/50 border-sky-500/20 cursor-not-allowed'
                                : 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border-sky-500/30 cursor-pointer'
                        }`}
                        title={isSigningIn ? 'Opening browser...' : 'Sign in with Google'}
                    >
                        {isSigningIn ? (
                            <span className="inline-block w-3 h-3 rounded-full border-2 border-sky-400/40 border-t-sky-400 animate-spin" />
                        ) : (
                            <LogIn size={14} />
                        )}
                        <span>{isSigningIn ? 'Opening...' : 'Sign in'}</span>
                    </button>
                )}
                <button onClick={handleOpenSettingsAction} className="ml-2 p-1 text-white/60 hover:text-white transition-colors">
                    <Settings size={18} />
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
