"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Wifi, Bluetooth, Settings, Volume2, Sun, Monitor,
    AppWindow, FolderOpen, File, Globe, Sparkles, Play, X,
    ChevronRight, Zap, Terminal, Command
} from 'lucide-react';

interface SearchResult {
    id: string;
    type: 'app' | 'file' | 'url' | 'setting' | 'wifi' | 'bluetooth' | 'action' | 'demo';
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    action: () => void;
    metadata?: any;
}

interface UnifiedSearchProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate?: (url: string) => void;
}

const UnifiedSearch: React.FC<UnifiedSearchProps> = ({ isOpen, onClose, onNavigate }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            setQuery('');
            setResults([]);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!query.trim()) {
            // Show default suggestions
            setResults(getDefaultSuggestions());
            return;
        }

        const searchTimeout = setTimeout(async () => {
            setIsSearching(true);
            const searchResults = await performUnifiedSearch(query);
            setResults(searchResults);
            setIsSearching(false);
            setSelectedIndex(0);
        }, 150);

        return () => clearTimeout(searchTimeout);
    }, [query]);

    const getDefaultSuggestions = (): SearchResult[] => {
        return [
            {
                id: 'demo-features',
                type: 'demo',
                title: 'AI Feature Demonstration',
                subtitle: 'Let AI show you how to use Aartiq',
                icon: <Sparkles size={20} className="text-purple-400" />,
                action: () => {
                    onClose();
                    window.dispatchEvent(new CustomEvent('start-ai-demo'));
                }
            },
            {
                id: 'wifi-settings',
                type: 'wifi',
                title: 'WiFi Settings',
                subtitle: 'Manage wireless connections',
                icon: <Wifi size={20} className="text-blue-400" />,
                action: () => openSystemSettings('wifi')
            },
            {
                id: 'bluetooth-settings',
                type: 'bluetooth',
                title: 'Bluetooth Settings',
                subtitle: 'Manage Bluetooth devices',
                icon: <Bluetooth size={20} className="text-blue-400" />,
                action: () => openSystemSettings('bluetooth')
            },
            {
                id: 'volume-control',
                type: 'setting',
                title: 'Volume Control',
                subtitle: 'Adjust system volume',
                icon: <Volume2 size={20} className="text-green-400" />,
                action: () => openSystemSettings('volume')
            },
            {
                id: 'brightness-control',
                type: 'setting',
                title: 'Brightness Control',
                subtitle: 'Adjust screen brightness',
                icon: <Sun size={20} className="text-yellow-400" />,
                action: () => openSystemSettings('brightness')
            },
            {
                id: 'file-manager',
                type: 'app',
                title: 'File Manager',
                subtitle: 'Browse files and folders',
                icon: <FolderOpen size={20} className="text-orange-400" />,
                action: () => openFileManager()
            }
        ];
    };

    const performUnifiedSearch = async (searchQuery: string): Promise<SearchResult[]> => {
        const results: SearchResult[] = [];
        const lowerQuery = searchQuery.toLowerCase();

        // Search for apps
        if (window.electronAPI) {
            try {
                const appResults = await window.electronAPI.searchApplications(searchQuery);
                if (appResults.success && appResults.results) {
                    appResults.results.slice(0, 5).forEach((app: any) => {
                        results.push({
                            id: `app-${app.name}`,
                            type: 'app',
                            title: app.name,
                            subtitle: app.path || 'Application',
                            icon: <AppWindow size={20} className="text-cyan-400" />,
                            action: () => {
                                if (window.electronAPI) {
                                    window.electronAPI.openExternalApp(app.path || app.name);
                                }
                                onClose();
                            },
                            metadata: app
                        });
                    });
                }
            } catch (error) {
                console.error('App search error:', error);
            }
        }

        // Search for system settings
        const settingsKeywords = [
            { keywords: ['wifi', 'wireless', 'network', 'internet'], type: 'wifi', title: 'WiFi Settings', icon: <Wifi size={20} className="text-blue-400" /> },
            { keywords: ['bluetooth', 'bt', 'wireless'], type: 'bluetooth', title: 'Bluetooth Settings', icon: <Bluetooth size={20} className="text-blue-400" /> },
            { keywords: ['volume', 'sound', 'audio', 'speaker'], type: 'setting', title: 'Volume Control', icon: <Volume2 size={20} className="text-green-400" /> },
            { keywords: ['brightness', 'screen', 'display', 'dim'], type: 'setting', title: 'Brightness Control', icon: <Sun size={20} className="text-yellow-400" /> },
            { keywords: ['settings', 'preferences', 'config'], type: 'setting', title: 'System Settings', icon: <Settings size={20} className="text-gray-400" /> },
        ];

        settingsKeywords.forEach(setting => {
            if (setting.keywords.some(kw => lowerQuery.includes(kw))) {
                results.push({
                    id: `setting-${setting.type}`,
                    type: setting.type as any,
                    title: setting.title,
                    subtitle: `Open ${setting.title.toLowerCase()}`,
                    icon: setting.icon,
                    action: () => openSystemSettings(setting.type)
                });
            }
        });

        // Search for AI demo
        if (lowerQuery.includes('demo') || lowerQuery.includes('tutorial') || lowerQuery.includes('help') || lowerQuery.includes('guide')) {
            results.unshift({
                id: 'ai-demo',
                type: 'demo',
                title: 'AI Feature Demonstration',
                subtitle: 'Interactive walkthrough of browser features',
                icon: <Sparkles size={20} className="text-purple-400" />,
                action: () => {
                    onClose();
                    window.dispatchEvent(new CustomEvent('start-ai-demo'));
                }
            });
        }

        // If looks like URL or web search
        if (lowerQuery.includes('.') || lowerQuery.startsWith('http')) {
            results.push({
                id: 'navigate-url',
                type: 'url',
                title: `Navigate to ${searchQuery}`,
                subtitle: 'Open in browser',
                icon: <Globe size={20} className="text-blue-400" />,
                action: () => {
                    if (onNavigate) {
                        onNavigate(searchQuery.startsWith('http') ? searchQuery : `https://${searchQuery}`);
                    }
                    onClose();
                }
            });
        } else if (searchQuery.trim()) {
            // Web search
            results.push({
                id: 'web-search',
                type: 'url',
                title: `Search for "${searchQuery}"`,
                subtitle: 'Search on Google',
                icon: <Search size={20} className="text-green-400" />,
                action: () => {
                    if (onNavigate) {
                        onNavigate(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`);
                    }
                    onClose();
                }
            });
        }

        return results;
    };

    const openSystemSettings = async (type: string) => {
        onClose();

        if (!window.electronAPI) return;

        const platform = navigator.platform;
        let command = '';

        switch (type) {
            case 'wifi':
                if (platform.includes('Win')) {
                    command = 'start ms-settings:network-wifi';
                } else if (platform.includes('Mac')) {
                    command = 'open /System/Library/PreferencePanes/Network.prefPane';
                } else {
                    command = 'gnome-control-center wifi';
                }
                break;

            case 'bluetooth':
                if (platform.includes('Win')) {
                    command = 'start ms-settings:bluetooth';
                } else if (platform.includes('Mac')) {
                    command = 'open /System/Library/PreferencePanes/Bluetooth.prefPane';
                } else {
                    command = 'gnome-control-center bluetooth';
                }
                break;

            case 'volume':
                if (platform.includes('Win')) {
                    command = 'start sndvol';
                } else if (platform.includes('Mac')) {
                    command = 'open /System/Library/PreferencePanes/Sound.prefPane';
                } else {
                    command = 'gnome-control-center sound';
                }
                break;

            case 'brightness':
                if (platform.includes('Win')) {
                    command = 'start ms-settings:display';
                } else if (platform.includes('Mac')) {
                    command = 'open /System/Library/PreferencePanes/Displays.prefPane';
                } else {
                    command = 'gnome-control-center display';
                }
                break;
        }

        if (command) {
            await window.electronAPI.executeShellCommand(command);
        }
    };

    const openFileManager = async () => {
        onClose();

        if (!window.electronAPI) return;

        const platform = navigator.platform;
        let command = '';

        if (platform.includes('Win')) {
            command = 'explorer';
        } else if (platform.includes('Mac')) {
            command = 'open ~';
        } else {
            command = 'nautilus ~';
        }

        await window.electronAPI.executeShellCommand(command);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % results.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        } else if (e.key === 'Enter' && results[selectedIndex]) {
            e.preventDefault();
            results[selectedIndex].action();
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex items-start justify-center pt-32 bg-black/60 backdrop-blur-xl"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, y: -20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: -20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-2xl bg-[#0a0a0f]/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
                >
                    {/* Search Input */}
                    <div className="relative p-6 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <Search size={20} className="text-white/40" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Search apps, settings, WiFi, Bluetooth, or anything..."
                                className="flex-1 bg-transparent text-white text-lg placeholder:text-white/30 focus:outline-none"
                            />
                            {query && (
                                <button
                                    onClick={() => setQuery('')}
                                    className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X size={16} className="text-white/40" />
                                </button>
                            )}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-white/30">
                            <Command size={12} />
                            <span>Press ↑↓ to navigate, Enter to select, Esc to close</span>
                        </div>
                    </div>

                    {/* Results */}
                    <div className="max-h-96 overflow-y-auto custom-scrollbar">
                        {isSearching ? (
                            <div className="p-8 text-center text-white/40">
                                <div className="animate-spin mx-auto w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full" />
                                <p className="mt-2 text-sm">Searching...</p>
                            </div>
                        ) : results.length > 0 ? (
                            results.map((result, index) => (
                                <motion.div
                                    key={result.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.03 }}
                                    onClick={result.action}
                                    className={`flex items-center gap-4 px-6 py-4 cursor-pointer transition-all ${selectedIndex === index
                                            ? 'bg-white/10 border-l-2 border-l-purple-500'
                                            : 'hover:bg-white/5'
                                        }`}
                                >
                                    <div className="flex-shrink-0">{result.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-white font-medium text-sm truncate">
                                            {result.title}
                                        </div>
                                        {result.subtitle && (
                                            <div className="text-white/40 text-xs truncate mt-0.5">
                                                {result.subtitle}
                                            </div>
                                        )}
                                    </div>
                                    <ChevronRight size={16} className="text-white/20 flex-shrink-0" />
                                </motion.div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-white/40">
                                <Search size={32} className="mx-auto mb-2 opacity-20" />
                                <p className="text-sm">No results found</p>
                                <p className="text-xs mt-1">Try searching for apps, settings, or web content</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default UnifiedSearch;
