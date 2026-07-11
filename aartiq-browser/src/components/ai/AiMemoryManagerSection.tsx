"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Database, Trash2, Pencil, X, Check, RefreshCw } from 'lucide-react';
import { BrowserAI } from '@/lib/BrowserAI';

interface UserPreference {
    value: string;
    updatedAt?: number;
}

export default function AiMemoryManagerSection() {
    const [preferences, setPreferences] = useState<Record<string, UserPreference>>({});
    const [memoryCount, setMemoryCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            if (window.electronAPI?.loadUserPreferences) {
                const prefs = await window.electronAPI.loadUserPreferences();
                setPreferences(prefs || {});
            }
            const stats = BrowserAI.getVectorMemoryStats();
            setMemoryCount(stats.count);
        } catch (e) {
            console.error('Failed to load AI memory data:', e);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleDeletePreference = async (key: string) => {
        if (window.electronAPI?.deleteUserPreference) {
            await window.electronAPI.deleteUserPreference(key);
            setPreferences(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    };

    const handleEditStart = (key: string, value: string) => {
        setEditingKey(key);
        setEditValue(value);
    };

    const handleEditSave = async (key: string) => {
        if (window.electronAPI?.saveUserPreference && editValue.trim()) {
            await window.electronAPI.saveUserPreference(key, editValue.trim());
            setPreferences(prev => ({
                ...prev,
                [key]: { value: editValue.trim(), updatedAt: Date.now() }
            }));
        }
        setEditingKey(null);
        setEditValue('');
    };

    const handleEditCancel = () => {
        setEditingKey(null);
        setEditValue('');
    };

    const handleClearPreferences = async () => {
        if (!preferences || Object.keys(preferences).length === 0) return;
        const keys = Object.keys(preferences);
        for (const key of keys) {
            if (window.electronAPI?.deleteUserPreference) {
                await window.electronAPI.deleteUserPreference(key);
            }
        }
        setPreferences({});
    };

    const handleClearMemory = async () => {
        await BrowserAI.clearVectorMemory();
        setMemoryCount(0);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8 text-white/40 text-xs">
                <RefreshCw size={14} className="animate-spin mr-2" />
                Loading memory data...
            </div>
        );
    }

    const prefCount = preferences ? Object.keys(preferences).length : 0;

    return (
        <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <BookOpen size={18} className="text-deep-space-accent-neon" />
                        <div>
                            <p className="text-sm font-bold text-white">Stored Preferences ({prefCount})</p>
                            <p className="text-xs text-white/40">AI-learned preferences from your conversations.</p>
                        </div>
                    </div>
                    {prefCount > 0 && (
                        <button
                            onClick={handleClearPreferences}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            <Trash2 size={12} />
                            Clear All
                        </button>
                    )}
                </div>

                {prefCount === 0 ? (
                    <p className="text-xs text-white/30 py-4 text-center">No preferences saved yet.</p>
                ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {Object.entries(preferences).map(([key, pref]) => (
                            <div
                                key={key}
                                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-black/20 border border-white/5 group"
                            >
                                {editingKey === key ? (
                                    <div className="flex-1 flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40 w-24 shrink-0">{key}</span>
                                        <input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleEditSave(key);
                                                if (e.key === 'Escape') handleEditCancel();
                                            }}
                                            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-deep-space-accent-neon/40"
                                            autoFocus
                                        />
                                        <button
                                            onClick={() => handleEditSave(key)}
                                            className="p-1 rounded-lg bg-deep-space-accent-neon/10 text-deep-space-accent-neon hover:bg-deep-space-accent-neon/20 transition-all"
                                        >
                                            <Check size={12} />
                                        </button>
                                        <button
                                            onClick={handleEditCancel}
                                            className="p-1 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 transition-all"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{key}</span>
                                            <p className="text-xs text-white truncate">{pref.value}</p>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleEditStart(key, pref.value)}
                                                className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
                                                title="Edit"
                                            >
                                                <Pencil size={12} />
                                            </button>
                                            <button
                                                onClick={() => handleDeletePreference(key)}
                                                className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                                                title="Delete"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Database size={18} className="text-deep-space-accent-neon" />
                        <div>
                            <p className="text-sm font-bold text-white">Vector Memory ({memoryCount})</p>
                            <p className="text-xs text-white/40">Cross-session RAG memories from past conversations.</p>
                        </div>
                    </div>
                    {memoryCount > 0 && (
                        <button
                            onClick={handleClearMemory}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            <Trash2 size={12} />
                            Clear All
                        </button>
                    )}
                </div>
                {memoryCount === 0 ? (
                    <p className="text-xs text-white/30 py-4 text-center">No memories stored yet.</p>
                ) : (
                    <p className="text-xs text-white/40">Memories are used for semantic retrieval across chat sessions. Clearing them will free up storage and reset the AI&apos;s cross-session context.</p>
                )}
            </div>
        </div>
    );
}
