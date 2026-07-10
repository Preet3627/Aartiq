"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import { IntegrationService, MailItem, DriveFile } from '@/lib/IntegrationService';
import { firebaseConfigStorage } from '@/lib/firebaseConfigStorage';
import { Mail, FileText, RefreshCw, Folder, Search, Filter, Sparkles, LogIn, ExternalLink } from 'lucide-react';

const WorkspaceDashboard = () => {
    const store = useAppStore();
    const [mails, setMails] = useState<MailItem[]>([]);
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'mail' | 'drive'>('mail');
    const [searchQuery, setSearchQuery] = useState('');

    const isConnected = !!store.authToken;

    useEffect(() => {
        if (isConnected) {
            fetchData();
        }
    }, [isConnected]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const fetchedMails = await IntegrationService.fetchMails(store.authToken || '');
            const fetchedFiles = await IntegrationService.fetchFiles(store.authToken || '');

            // Run "AI" organization
            const organizedMails = IntegrationService.runAIOrganization(fetchedMails);

            setMails(organizedMails);
            setFiles(fetchedFiles);
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = () => {
        if (window.electronAPI) {
            const authUrl = `https://aartiq-three.vercel.app/auth?client_id=desktop-app&redirect_uri=aartiq-browser%3A%2F%2Fauth&firebase_config=${btoa(JSON.stringify(firebaseConfigStorage.load() || {}))}`;
            window.electronAPI.openAuthWindow(authUrl);
        } else {
            const url = `https://aartiq-three.vercel.app/auth?client_id=web-app&redirect_uri=${encodeURIComponent(window.location.origin + '/auth')}`;
            window.open(url, "_blank");
        }
    };

    const filteredMails = mails.filter(m => m.subject.toLowerCase().includes(searchQuery.toLowerCase()) || m.snippet.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-[var(--primary-bg)]">
                <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6 text-secondary-text/20">
                    <Mail size={40} />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight text-primary-text mb-2">Connect Workspace</h2>
                <p className="text-secondary-text max-w-md mb-8">Access your Gmail & Drive directly within Aartiq. Our local AI organizes your workflow automatically.</p>
                <button
                    onClick={handleConnect}
                    className="flex items-center gap-2 px-8 py-4 bg-accent text-[var(--primary-bg)] rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
                >
                    <LogIn size={18} /> Connect Google Account
                </button>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full bg-[var(--primary-bg)] gap-4 p-4">
            {/* Sidebar */}
            <div className="w-64 rounded-3xl border border-border-color/30 flex flex-col p-4 gap-2 backdrop-blur-xl" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
                <button onClick={() => setActiveTab('mail')} className={`flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === 'mail' ? 'bg-accent/10 text-accent border border-accent/20 shadow-[0_4px_15px_rgba(0,0,0,0.1)]' : 'text-secondary-text hover:bg-black/5 border border-transparent'}`}>
                    <Mail size={18} />
                    <span className="text-xs font-bold uppercase tracking-widest">Inbox</span>
                    {mails.filter(m => m.isUnread).length > 0 && <span className="ml-auto bg-accent text-white text-[10px] font-black px-2 py-0.5 rounded-full">{mails.filter(m => m.isUnread).length}</span>}
                </button>
                <button onClick={() => setActiveTab('drive')} className={`flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === 'drive' ? 'bg-accent/10 text-accent border border-accent/20 shadow-[0_4px_15px_rgba(0,0,0,0.1)]' : 'text-secondary-text hover:bg-black/5 border border-transparent'}`}>
                    <Folder size={18} />
                    <span className="text-xs font-bold uppercase tracking-widest">Drive Files</span>
                </button>
                <div className="mt-auto p-4 bg-black/5 rounded-2xl">
                    <div className="flex items-center gap-2 text-accent mb-2">
                        <Sparkles size={14} className="animate-pulse" />
                        <span className="text-[10px] font-black uppercase">AI Active</span>
                    </div>
                    <p className="text-[10px] text-secondary-text leading-relaxed">
                        Mails are automatically tagged and prioritized by BrowserAI based on context.
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 rounded-3xl border border-border-color flex flex-col overflow-hidden backdrop-blur-xl" style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)' }}>
                <header className="p-6 border-b border-border-color/50 flex items-center justify-between">
                    <h2 className="text-xl font-black uppercase tracking-tight text-primary-text">{activeTab === 'mail' ? 'Priority Inbox' : 'Workspace Files'}</h2>
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-text/30 group-focus-within:text-accent transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search with AI..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-black/5 border border-border-color rounded-xl pl-10 pr-4 py-2 text-xs text-primary-text placeholder-secondary-text/30 focus:outline-none focus:border-accent/50 w-64 transition-all"
                            />
                        </div>
                        <button onClick={fetchData} className={`p-2 rounded-xl bg-black/5 text-secondary-text hover:text-primary-text transition-all ${loading ? 'animate-spin' : ''}`}>
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-2">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-secondary-text/20 text-xs uppercase font-bold tracking-widest animate-pulse">Syncing Workspace...</div>
                    ) : (
                        activeTab === 'mail' ? (
                            filteredMails.map(mail => (
                                <motion.div key={mail.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl bg-black/5 border border-transparent hover:border-border-color transition-all group cursor-pointer flex gap-4">
                                    <div className={`w-1 h-12 rounded-full ${mail.isUnread ? 'bg-accent' : 'bg-transparent'}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <h4 className={`text-sm truncate pr-4 ${mail.isUnread ? 'font-bold text-primary-text' : 'font-medium text-secondary-text'}`}>{mail.subject}</h4>
                                            {mail.tag && <span className="text-[10px] font-black uppercase bg-black/10 px-2 py-0.5 rounded text-secondary-text">{mail.tag}</span>}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-secondary-text/60 truncate pr-8">{mail.snippet}</p>
                                            <span className="text-[10px] text-secondary-text/40 whitespace-nowrap font-mono">{mail.date}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="grid grid-cols-4 gap-4">
                                {filteredFiles.map(file => (
                                    <div key={file.id} className="p-4 rounded-2xl bg-black/5 border border-transparent hover:border-border-color transition-all cursor-pointer aspect-square flex flex-col items-center justify-center text-center gap-3">
                                        <FileText size={32} className="text-secondary-text/20" />
                                        <div>
                                            <p className="text-xs font-bold text-primary-text truncate w-24 mx-auto">{file.name}</p>
                                            <p className="text-[10px] text-secondary-text uppercase mt-1">{file.type}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default WorkspaceDashboard;
