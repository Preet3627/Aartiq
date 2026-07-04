"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Palette, Shield, Key, Package, Layout, Globe, Info, ChevronDown } from 'lucide-react';

interface SettingsDropdownProps {
    onOpenSettings: (section?: string) => void;
}

const SettingsDropdown: React.FC<SettingsDropdownProps> = ({ onOpenSettings }) => {
    const [isOpen, setIsOpen] = useState(false);

    const quickActions = [
        { id: 'appearance', icon: <Palette size={16} />, label: 'Appearance' },
        { id: 'privacy', icon: <Shield size={16} />, label: 'Privacy & Security' },
        { id: 'vault', icon: <Key size={16} />, label: 'Password Vault' },
        { id: 'extensions', icon: <Package size={16} />, label: 'Extensions' },
        { id: 'tabs', icon: <Layout size={16} />, label: 'Tab Management' },
        { id: 'mcp', icon: <Globe size={16} />, label: 'MCP Servers' },
    ];

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-sm font-bold text-white/80 hover:text-white"
            >
                <Settings size={16} />
                <span className="hidden md:inline">Settings</span>
                <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-[90]"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            className="absolute right-0 top-full mt-2 w-64 bg-deep-space-bg border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden z-[100]"
                        >
                            <div className="p-2">
                                <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white/20 mb-1">
                                    Quick Access
                                </div>
                                {quickActions.map((action) => (
                                    <button
                                        key={action.id}
                                        onClick={() => {
                                            onOpenSettings(action.id);
                                            setIsOpen(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all text-left group"
                                    >
                                        <div className="text-white/40 group-hover:text-deep-space-accent-neon transition-colors">
                                            {action.icon}
                                        </div>
                                        <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">
                                            {action.label}
                                        </span>
                                    </button>
                                ))}

                                <div className="h-px bg-white/5 my-2" />

                                <button
                                    onClick={() => {
                                        onOpenSettings();
                                        setIsOpen(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-deep-space-accent-neon/10 transition-all text-left group"
                                >
                                    <Info size={16} className="text-deep-space-accent-neon" />
                                    <span className="text-sm font-bold text-deep-space-accent-neon">
                                        All Settings
                                    </span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SettingsDropdown;
