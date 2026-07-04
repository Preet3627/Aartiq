"use client";

import React, { useState, useEffect } from 'react';
import { 
    Lock, Eye, EyeOff, Search, Plus, Trash2, Key, Globe, User, 
    ShieldCheck, Copy, Check, FileText, Database, Shield, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

type VaultEntry = {
    id: string;
    site: string;
    username: string;
    created?: string | null;
    hasPassword: boolean;
    passwordMasked: string;
    type?: 'login' | 'form' | 'note';
    title?: string;
    formData?: Array<{ label: string, value: string, name: string }>;
};

export default function NeuralVaultManager() {
    const [entries, setEntries] = useState<VaultEntry[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showPlain, setShowPlain] = useState<Record<string, boolean>>({});
    const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [addType, setAddType] = useState<'login' | 'form' | 'note'>('login');
    const [vaultStatus, setVaultStatus] = useState<string | null>(null);
    const [expandedForm, setExpandedForm] = useState<string | null>(null);
    const store = useAppStore();

    // New Entry States
    const [newLogin, setNewLogin] = useState({ site: '', username: '', password: '' });
    const [newNote, setNewNote] = useState({ title: '', content: '' });

    useEffect(() => {
        const loadVaultEntries = async () => {
            if (!window.electronAPI?.vaultListEntries) return;
            const result = await window.electronAPI.vaultListEntries();
            if (result.success && result.entries) {
                setEntries(result.entries);
            }
        };
        loadVaultEntries();
    }, []);

    const pushVaultStatus = (message: string | null) => {
        setVaultStatus(message);
        if (message) {
            window.setTimeout(() => setVaultStatus(null), 4000);
        }
    };

    const handleAdd = async () => {
        if (!window.electronAPI?.vaultSaveEntry) return;

        let result;
        if (addType === 'login') {
            if (!newLogin.site || !newLogin.password) return;
            result = await window.electronAPI.vaultSaveEntry({
                site: newLogin.site,
                username: newLogin.username,
                password: newLogin.password,
                type: 'login'
            });
        } else if (addType === 'note') {
            if (!newNote.title || !newNote.content) return;
            result = await window.electronAPI.vaultSaveEntry({
                site: 'Local Note',
                title: newNote.title,
                password: newNote.content, // Store note content in password field for encryption
                type: 'note'
            });
        }

        if (!result || !result.success || !result.entries) {
            pushVaultStatus(result?.error || 'Failed to save vault entry.');
            return;
        }

        setEntries(result.entries);
        setIsAdding(false);
        setNewLogin({ site: '', username: '', password: '' });
        setNewNote({ title: '', content: '' });
        pushVaultStatus(`${addType.charAt(0).toUpperCase() + addType.slice(1)} secured in Neural Vault.`);
    };

    const handleDelete = async (id: string) => {
        if (!window.electronAPI?.vaultDeleteEntry) return;
        const result = await window.electronAPI.vaultDeleteEntry(id);
        if (!result.success || !result.entries) {
            pushVaultStatus(result.error || 'Failed to delete entry.');
            return;
        }
        setEntries(result.entries);
        pushVaultStatus('Entry permanently removed from vault.');
    };

    const toggleReveal = async (id: string) => {
        if (showPlain[id]) {
            setShowPlain(prev => ({ ...prev, [id]: false }));
            return;
        }
        if (!window.electronAPI?.vaultReadSecret) return;
        const result = await window.electronAPI.vaultReadSecret(id);
        if (!result.success || !result.password) {
            pushVaultStatus(result.error || 'Unlock denied.');
            return;
        }
        setRevealedSecrets(prev => ({ ...prev, [id]: result.password || '' }));
        setShowPlain(prev => ({ ...prev, [id]: true }));
    };

    const handleCopy = async (id: string) => {
        if (!window.electronAPI?.vaultCopySecret) return;
        const result = await window.electronAPI.vaultCopySecret(id);
        if (!result.success) return;
        setCopiedId(id);
        pushVaultStatus('Copied to clipboard.');
        setTimeout(() => setCopiedId(null), 2000);
    };

    const filtered = entries.filter(e =>
        (e.site || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.title || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getEntryIcon = (type?: string) => {
        switch (type) {
            case 'form': return <FileText size={18} className="text-amber-400" />;
            case 'note': return <Shield size={18} className="text-emerald-400" />;
            default: return <Globe size={18} className="text-violet-400" />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--primary-bg)] text-[var(--primary-text)] p-6 gap-6 relative overflow-hidden font-sans">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />

            <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-violet-500/10 rounded-2xl border border-violet-500/20 shadow-[0_0_15px_rgba(139,92,246,0.1)]">
                        <Database className="text-violet-400" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-widest italic flex items-center gap-2">
                            Neural Vault
                            <span className="text-[10px] bg-violet-500/20 border border-violet-500/30 px-2 py-0.5 rounded-full not-italic tracking-normal text-violet-400">v2.5</span>
                        </h2>
                        <p className="text-[10px] text-[var(--secondary-text)]/50 font-bold tracking-tighter flex items-center gap-2">
                            <ShieldCheck size={12} className="text-emerald-400" />
                            END-TO-END QUANTUM ENCRYPTION ACTIVE
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--secondary-text)]/40" size={14} />
                        <input
                            type="text"
                            placeholder="Search vault (logins, forms, notes)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-[var(--primary-bg)]/5 border border-[var(--border-color)] rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500/50 w-72 text-[var(--primary-text)] transition-all"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsAdding(!isAdding)}
                        className={`p-2 rounded-xl transition-all shadow-lg ${isAdding ? 'bg-red-500/20 text-red-500' : 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-500/20'}`}
                    >
                        <Plus size={20} className={isAdding ? 'rotate-45 transition-transform' : 'transition-transform'} />
                    </button>
                </div>
            </div>

            {isAdding && (
                <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-6 flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 z-10 shadow-2xl backdrop-blur-xl">
                    <div className="flex gap-2 p-1 bg-[var(--primary-bg)]/20 rounded-xl w-fit">
                        {(['login', 'note'] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setAddType(t)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${addType === t ? 'bg-violet-600 text-white' : 'text-[var(--secondary-text)] hover:bg-white/5'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    {addType === 'login' && (
                        <div className="grid grid-cols-3 gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase text-[var(--secondary-text)]/50 ml-1">Domain</label>
                                <input
                                    value={newLogin.site}
                                    onChange={(e) => setNewLogin({ ...newLogin, site: e.target.value })}
                                    className="bg-[var(--primary-bg)]/20 border border-[var(--border-color)] rounded-xl p-3 text-sm focus:border-violet-500/50 outline-none transition-colors"
                                    placeholder="google.com"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase text-[var(--secondary-text)]/50 ml-1">User / Email</label>
                                <input
                                    value={newLogin.username}
                                    onChange={(e) => setNewLogin({ ...newLogin, username: e.target.value })}
                                    className="bg-[var(--primary-bg)]/20 border border-[var(--border-color)] rounded-xl p-3 text-sm focus:border-violet-500/50 outline-none transition-colors"
                                    placeholder="user@mail.com"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase text-[var(--secondary-text)]/50 ml-1">Password</label>
                                <input
                                    value={newLogin.password}
                                    onChange={(e) => setNewLogin({ ...newLogin, password: e.target.value })}
                                    type="password"
                                    className="bg-[var(--primary-bg)]/20 border border-[var(--border-color)] rounded-xl p-3 text-sm focus:border-violet-500/50 outline-none transition-colors"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                    )}

                    {addType === 'note' && (
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase text-[var(--secondary-text)]/50 ml-1">Title</label>
                                <input
                                    value={newNote.title}
                                    onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                                    className="bg-[var(--primary-bg)]/20 border border-[var(--border-color)] rounded-xl p-3 text-sm focus:border-violet-500/50 outline-none transition-colors"
                                    placeholder="Personal WiFi Key"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase text-[var(--secondary-text)]/50 ml-1">Note Content (Encrypted)</label>
                                <textarea
                                    value={newNote.content}
                                    onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                                    className="bg-[var(--primary-bg)]/20 border border-[var(--border-color)] rounded-xl p-3 text-sm focus:border-violet-500/50 outline-none transition-colors min-h-[100px] resize-none"
                                    placeholder="Enter sensitive info here..."
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-2 text-xs font-black uppercase text-[var(--secondary-text)] hover:text-white transition-colors">Cancel</button>
                        <button type="button" onClick={handleAdd} className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl px-8 py-2 font-black uppercase text-xs shadow-lg shadow-violet-500/20 transition-all">Secure Entry</button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-auto custom-scrollbar z-10 pr-2">
                <div className="flex flex-col gap-3">
                    {filtered.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-4 text-gray-500/20">
                            <Shield size={80} strokeWidth={1} />
                            <p className="text-sm font-black uppercase tracking-[0.2em] italic">Vault Secure & Empty</p>
                        </div>
                    ) : (
                        filtered.map((item) => (
                            <div key={item.id} className="group flex flex-col bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-2xl transition-all overflow-hidden">
                                <div className="p-4 flex items-center justify-between w-full">
                                    <div className="flex items-center">
                                        <div className="p-3 bg-[var(--primary-bg)]/20 rounded-xl mr-4 group-hover:scale-110 transition-transform">
                                            {getEntryIcon(item.type)}
                                        </div>

                                        <div className="flex flex-col">
                                            <h3 className="font-bold text-sm text-[var(--primary-text)] flex items-center gap-2">
                                                {item.type === 'form' ? (item.title || item.site) : (item.site || item.title)}
                                                {item.type === 'form' && <span className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase">Form Collection</span>}
                                                {item.type === 'note' && <span className="text-[8px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase">Secure Note</span>}
                                            </h3>
                                            <div className="flex items-center gap-3 mt-1">
                                                <div className="flex items-center gap-1.5 text-[var(--secondary-text)]/50">
                                                    <User size={10} />
                                                    <span className="text-[10px] font-medium">{item.username || 'Encrypted Entry'}</span>
                                                </div>
                                                {item.type === 'form' && (
                                                    <div className="flex items-center gap-1.5 text-amber-500/50">
                                                        <FileText size={10} />
                                                        <span className="text-[10px] font-medium">{item.formData?.length || 0} fields</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {item.type !== 'form' && (
                                            <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                                                <span className="text-[10px] font-mono tracking-widest text-[var(--primary-text)]/80 min-w-[80px] text-right">
                                                    {showPlain[item.id] ? (revealedSecrets[item.id] || item.passwordMasked) : item.passwordMasked}
                                                </span>
                                                <button
                                                    onClick={() => toggleReveal(item.id)}
                                                    className="text-[var(--secondary-text)]/30 hover:text-violet-400 p-1 transition-colors"
                                                >
                                                    {showPlain[item.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            {item.type === 'form' ? (
                                                <button
                                                    onClick={() => setExpandedForm(expandedForm === item.id ? null : item.id)}
                                                    className="p-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 rounded-lg transition-all"
                                                >
                                                    {expandedForm === item.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleCopy(item.id)}
                                                    className={`p-2 rounded-lg transition-all ${copiedId === item.id ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 hover:bg-white/10 text-white/40 hover:text-white'}`}
                                                >
                                                    {copiedId === item.id ? <Check size={16} /> : <Copy size={16} />}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2 bg-red-500/10 text-red-500/50 hover:text-red-500 hover:bg-red-500/20 rounded-lg transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {expandedForm === item.id && item.formData && (
                                    <div className="px-6 pb-6 pt-2 animate-in slide-in-from-top-2">
                                        <div className="bg-black/20 rounded-2xl border border-white/5 divide-y divide-white/5">
                                            {item.formData.map((field, i) => (
                                                <div key={i} className="flex items-center justify-between p-3">
                                                    <span className="text-[10px] font-black uppercase text-white/30">{field.label}</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs font-medium text-white/70">{field.value}</span>
                                                        <button 
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(field.value);
                                                                pushVaultStatus(`Copied ${field.label}`);
                                                            }}
                                                            className="text-white/10 hover:text-white p-1 transition-colors"
                                                        >
                                                            <Copy size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-4 z-10">
                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                    <ShieldCheck size={20} />
                </div>
                <div className="flex-1">
                    <p className="text-[10px] font-black uppercase text-emerald-400/80">Active Protection Module</p>
                    <p className="text-[10px] text-emerald-400/50 font-medium leading-tight">
                        {vaultStatus || 'Neural Vault protection active. All secrets are stored with AES-256 local-only encryption. Syncing is end-to-end encrypted.'}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 ml-4">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Live</span>
                </div>
            </div>
        </div>
    );
}
