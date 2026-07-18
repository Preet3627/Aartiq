"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X, Calculator, Globe, Command, ArrowRight, Settings, Download, Palette, Shield, FileText, Clipboard, Zap } from 'lucide-react';
import { BrowserAI } from '@/lib/BrowserAI';
import { safeEval } from '@/lib/safe-eval';
import { useAppStore } from '@/store/useAppStore';
import { searchEngines } from './SearchEngineSettings';

interface SpotlightSearchOverlayProps {
    show: boolean;
    onClose: () => void;
}

interface CommandItem {
    id: string;
    label: string;
    category: string;
    icon: React.ReactNode;
    action: () => void;
}

function useCommandPalette(): CommandItem[] {
    const store = useAppStore();
    return React.useMemo(() => [
        { id: 'settings', label: 'Open Settings', category: 'Settings', icon: <Settings size={18} />, action: () => { window.dispatchEvent(new CustomEvent('aartiq:open-settings')); } },
        { id: 'permissions', label: 'Permission Settings', category: 'Settings', icon: <Shield size={18} />, action: () => { window.dispatchEvent(new CustomEvent('aartiq:open-settings')); } },
        { id: 'downloads', label: 'Open Downloads', category: 'Panels', icon: <Download size={18} />, action: () => { window.dispatchEvent(new CustomEvent('aartiq:open-settings')); } },
        { id: 'clipboard', label: 'Open Clipboard', category: 'Panels', icon: <Clipboard size={18} />, action: () => { window.dispatchEvent(new CustomEvent('aartiq:open-settings')); } },
        { id: 'pdf', label: 'Generate PDF', category: 'Actions', icon: <FileText size={18} />, action: () => { document.querySelector<HTMLTextAreaElement>('[data-ai-input]')?.focus(); } },
        { id: 'theme', label: 'Cycle Theme', category: 'Appearance', icon: <Palette size={18} />, action: () => { window.electronAPI?.invoke?.('popup-action', { action: 'cycle-theme' }); } },
        { id: 'toggle-ai', label: 'Toggle AI Assist', category: 'AI', icon: <Zap size={18} />, action: () => { store.setEnableAIAssist(!store.enableAIAssist); } },
        { id: 'autonomous', label: 'Toggle Autonomous Mode', category: 'AI', icon: <Zap size={18} />, action: () => { window.dispatchEvent(new CustomEvent('aartiq:toggle-autonomous')); } },
        { id: 'sidebar', label: 'Toggle Sidebar', category: 'View', icon: <Command size={18} />, action: () => { store.toggleSidebar(); } },
    ], [store]);
}

const SpotlightSearchOverlay: React.FC<SpotlightSearchOverlayProps> = ({ show, onClose }) => {
    const store = useAppStore();
    const commands = useCommandPalette();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [calculationResult, setCalculationResult] = useState<string | null>(null);
    const [appSearchResults, setAppSearchResults] = useState<any[]>([]);
    const [alarmMessage, setAlarmMessage] = useState<string | null>(null);
    const [urlPrediction, setUrlPrediction] = useState<string | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    
    const inputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);

    // Categories of items in the list
    const getFlattenedResults = () => {
        const results: any[] = [];
        const trimmed = searchTerm.trim().toLowerCase();
        
        if (calculationResult) {
            results.push({ type: 'calc', value: calculationResult });
        }

        // Command palette results
        if (trimmed.length > 0) {
            const matched = commands.filter(cmd =>
                cmd.label.toLowerCase().includes(trimmed) ||
                cmd.category.toLowerCase().includes(trimmed)
            );
            matched.forEach(cmd => results.push({ type: 'command', ...cmd }));
        }
        
        appSearchResults.forEach(app => {
            results.push({ type: 'app', ...app });
        });
        
        if (searchTerm.trim().length > 0) {
            results.push({ type: 'web', query: searchTerm.trim() });
        }
        
        return results;
    };

    const flattenedResults = getFlattenedResults();

    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        } else {
            setSearchTerm('');
            setSelectedIndex(0);
            setAppSearchResults([]);
            setCalculationResult(null);
            setAlarmMessage(null);
        }
    }, [show]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % flattenedResults.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + flattenedResults.length) % flattenedResults.length);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, flattenedResults.length]);

    // Automatic search as you type
    useEffect(() => {
        const timer = setTimeout(async () => {
            const trimmed = searchTerm.trim();
            if (!trimmed) {
                setAppSearchResults([]);
                setCalculationResult(null);
                setAlarmMessage(null);
                return;
            }

            // Calculation
            if (/^[\d\s+\-*/().]+$/.test(trimmed)) {
                try {
                    const result = safeEval(trimmed);
                    setCalculationResult(`${trimmed} = ${result}`);
                } catch {
                    setCalculationResult(null);
                }
            } else {
                setCalculationResult(null);
            }

            // App Search
            if (trimmed.length > 0 && window.electronAPI) {
                setIsSearching(true);
                const res = await window.electronAPI.searchApplications(trimmed);
                if (res.success) {
                    // Fetch icons for the apps
                    const appsWithIcons = await Promise.all(res.results.slice(0, 5).map(async (app: any) => {
                        const icon = await window.electronAPI.getAppIcon(app.path);
                        return { ...app, icon };
                    }));
                    setAppSearchResults(appsWithIcons);
                }
                setIsSearching(false);
            }

            // URL Prediction
            if (trimmed.length > 2) {
                const preds = await BrowserAI.predictUrl(trimmed, store.history.map(h => h.url));
                setUrlPrediction(preds[0] || null);
            } else {
                setUrlPrediction(null);
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [searchTerm, store.history]);

    const handleAction = async (item: any) => {
        if (!item) return;

        if (item.type === 'calc') {
            onClose();
        } else if (item.type === 'command') {
            item.action();
            onClose();
        } else if (item.type === 'app') {
            if (window.electronAPI && item.path) {
                await window.electronAPI.openExternalApp(item.path);
                onClose();
            }
        } else if (item.type === 'web') {
            const engineKey = store.selectedEngine as keyof typeof searchEngines;
            const engine = searchEngines[engineKey] || searchEngines.google;
            const searchUrl = `${engine.url}${encodeURIComponent(item.query)}`;
            window.electronAPI.addNewTab(searchUrl);
            onClose();
        }
    };

    if (!show) return null;

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-[#020205]/80 backdrop-blur-2xl z-[9999] flex items-start justify-center p-4 md:p-20"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ y: -20, scale: 0.95, opacity: 0 }}
                        animate={{ y: 0, scale: 1, opacity: 1 }}
                        exit={{ y: -20, scale: 0.95, opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="w-full max-w-2xl bg-[#0a0a0f]/90 border border-white/10 rounded-3xl shadow-[0_32px_64px_rgba(0,0,0,0.5)] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Search Bar */}
                        <div className="relative flex items-center p-6 border-b border-white/5">
                            <Search size={22} className="text-white/20 mr-4" />
                            <div className="relative flex-1">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            if (urlPrediction && !flattenedResults[selectedIndex]) {
                                                window.electronAPI.addNewTab(urlPrediction);
                                                onClose();
                                            } else {
                                                handleAction(flattenedResults[selectedIndex]);
                                            }
                                        }
                                    }}
                                    placeholder="Search apps, history, and the web..."
                                    className="w-full bg-transparent text-xl font-medium text-white placeholder:text-white/10 focus:outline-none"
                                />
                                {urlPrediction && searchTerm.length > 0 && (
                                    <div className="absolute inset-0 flex items-center pointer-events-none text-xl font-medium text-white/10">
                                        <span>{searchTerm}</span>
                                        <span>{urlPrediction.substring(searchTerm.length)}</span>
                                    </div>
                                )}
                            </div>
                            {isSearching && (
                                <motion.div 
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                    className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full ml-4"
                                />
                            )}
                        </div>

                        {/* Results list */}
                        <div ref={resultsRef} className="max-h-[min(500px,60vh)] overflow-y-auto py-2 custom-scrollbar">
                            {flattenedResults.length === 0 ? (
                                <div className="px-6 py-12 flex flex-col items-center justify-center text-center">
                                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                                        <Command size={24} className="text-white/20" />
                                    </div>
                                    <p className="text-white/40 text-sm font-medium">Type to search for apps, history, and more</p>
                                    <div className="mt-6 flex gap-2">
                                        <span className="px-2 py-1 rounded bg-white/5 text-[10px] text-white/30 font-bold uppercase tracking-widest border border-white/5">Esc to close</span>
                                        <span className="px-2 py-1 rounded bg-white/5 text-[10px] text-white/30 font-bold uppercase tracking-widest border border-white/5">↵ to execute</span>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {flattenedResults.map((item, index) => {
                                        const isSelected = index === selectedIndex;
                                        
                                        return (
                                            <div
                                                key={item.type === 'app' ? item.path : index}
                                                className={`mx-3 px-4 py-3 rounded-2xl flex items-center gap-4 cursor-pointer transition-all ${
                                                    isSelected ? 'bg-sky-500/20 shadow-[inset_0_0_20px_rgba(56,189,248,0.1)] border border-sky-500/20' : 'hover:bg-white/[0.03] border border-transparent'
                                                }`}
                                                onMouseEnter={() => setSelectedIndex(index)}
                                                onClick={() => handleAction(item)}
                                            >
                                                {/* Icon Container */}
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                                    isSelected ? 'bg-sky-500 text-white' : 'bg-white/5 text-white/60'
                                                }`}>
                                                    {item.type === 'calc' && <Calculator size={20} />}
                                                    {item.type === 'command' && item.icon}
                                                    {item.type === 'app' && (
                                                        item.icon ? (
                                                            <img src={item.icon} alt={item.name} className="w-6 h-6 object-contain" />
                                                        ) : (
                                                            <Command size={20} />
                                                        )
                                                    )}
                                                    {item.type === 'web' && <Globe size={20} />}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-bold text-sm truncate ${isSelected ? 'text-white' : 'text-white/70'}`}>
                                                            {item.type === 'calc' ? item.value : item.type === 'command' ? item.label : (item.type === 'web' ? `Search for "${item.query}"` : item.name)}
                                                        </span>
                                                        {item.type === 'command' && (
                                                            <span className="px-1.5 py-0.5 rounded-md bg-sky-500/20 text-[9px] font-black uppercase tracking-wider text-sky-400">{item.category}</span>
                                                        )}
                                                        {item.type === 'app' && (
                                                            <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-[9px] font-black uppercase tracking-wider text-white/20">Application</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[11px] text-white/30 truncate font-medium">
                                                        {item.type === 'web' && <span>Search with your default engine</span>}
                                                        {item.type === 'app' && <span>{item.path}</span>}
                                                        {item.type === 'calc' && <span>Mathematical result</span>}
                                                    </div>
                                                </div>

                                                {isSelected && (
                                                    <motion.div
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        className="text-sky-400 flex items-center gap-2"
                                                    >
                                                        <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Enter to launch</span>
                                                        <ArrowRight size={14} />
                                                    </motion.div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>

                        {/* Footer visibility/hint */}
                        <div className="px-6 py-4 bg-white/[0.02] border-t border-white/5 flex items-center justify-between text-[10px] font-bold text-white/10 uppercase tracking-[0.2em]">
                            <div className="flex gap-4">
                                <span>Navigate <span className="text-white/20 px-1 font-sans">↑↓</span></span>
                                <span>Select <span className="text-white/20 px-1 font-sans">↵</span></span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-sky-500/40">Aartiq Brain</span>
                                <span className="text-white/5">v0.3.0</span>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SpotlightSearchOverlay;
