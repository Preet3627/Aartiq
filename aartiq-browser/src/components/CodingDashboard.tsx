"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Code2, Play, Save, Layout, Terminal, Maximize2, RotateCcw, Image as ImageIcon, Search, GitBranch, GitFork, UploadCloud, Github, ExternalLink, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { IntegrationService } from '@/lib/IntegrationService';

const CodingDashboard = () => {
    const store = useAppStore();
    const [code, setCode] = useState(`<!DOCTYPE html>
<html>
<head>
    <style>
        :root {
            --bg: #ffffff;
            --text: #050510;
            --accent: #00ffff;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #050510;
                --text: #00ffff;
            }
        }
        body { 
            background: var(--bg); 
            color: var(--text); 
            font-family: 'Space Grotesk', sans-serif; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            height: 100vh; 
            margin: 0; 
            transition: all 0.3s ease;
        }
        .card { 
            border: 1px solid var(--accent); 
            padding: 3rem; 
            border-radius: 2rem; 
            background: rgba(255,255,255,0.05); 
            backdrop-filter: blur(10px); 
            text-align: center; 
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        h1 { margin: 0; font-size: 2.5rem; letter-spacing: 0.15em; font-weight: 900; }
        p { opacity: 0.6; font-size: 0.9rem; margin-top: 1rem; }
    </style>
</head>
<body>
    <div class="card">
        <h1>AARTIQ LIVE</h1>
        <p>Edit the code to see real-time updates.</p>
    </div>
</body>
</html>`);

    const [deployStatus, setDeployStatus] = useState<'idle' | 'deploying' | 'success' | 'error'>('idle');
    const [deployUrl, setDeployUrl] = useState<string | null>(null);
    const [isPushing, setIsPushing] = useState(false);

    const handleConnectGithub = () => {
        const token = prompt("Enter simulated GitHub Token (or OK for demo):", "ghp_mock_token_123");
        if (token) store.setGithubToken(token);
    };

    const handleDeploy = async () => {
        setDeployStatus('deploying');
        try {
            const result = await IntegrationService.deployRepo(store.githubToken || "guest", code);
            if (result.success) {
                setDeployStatus('success');
                setDeployUrl(result.url || null);
            } else {
                setDeployStatus('error');
            }
        } catch (e) {
            setDeployStatus('error');
        }
    };

    const handleFork = async () => {
        if (!store.githubToken) return handleConnectGithub();
        if (confirm("Fork this simulated repository 'comet-demo-project' to your account?")) {
            await IntegrationService.forkRepo(store.githubToken, "comet-org/comet-demo-project");
            alert("Forked successfully!");
        }
    };

    const handlePush = async () => {
        if (!store.githubToken) return handleConnectGithub();
        setIsPushing(true);
        try {
            await IntegrationService.pushChanges(store.githubToken, code, "Update index.html via Comet Dashboard");
            alert("Changes pushed to main branch.");
        } finally {
            setIsPushing(false);
        }
    };

    return (
        <div className="flex h-full w-full bg-[var(--primary-bg)] gap-4 p-4 text-[var(--primary-text)] relative z-50">
            {/* Editor Side */}
            <div className="flex-1 flex flex-col adaptive-theme-surface rounded-3xl border border-[var(--border-color)] overflow-hidden">
                <header className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between bg-accent/5">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-deep-space-accent-neon/10 flex items-center justify-center text-deep-space-accent-neon">
                            <Code2 size={18} />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--secondary-text)]/60">Live Source</span>
                        {!store.githubToken && (
                            <button onClick={handleConnectGithub} className="ml-4 px-3 py-1.5 rounded-lg bg-[var(--primary-bg)]/5 hover:bg-[var(--primary-bg)]/10 flex items-center gap-2 transition-all">
                                <Github size={12} className="text-[var(--primary-text)]" />
                                <span className="text-[10px] font-bold uppercase text-[var(--secondary-text)]/60">Connect GitHub</span>
                            </button>
                        )}
                        {store.githubToken && (
                            <span className="ml-2 text-[10px] font-bold uppercase text-green-400 flex items-center gap-1"><GitBranch size={10} /> main</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-[var(--primary-bg)]/10 rounded-xl text-[var(--secondary-text)]/40 transition-all"><Save size={16} /></button>
                        <button className="p-2 hover:bg-[var(--primary-bg)]/10 rounded-xl text-[var(--secondary-text)]/40 transition-all"><RotateCcw size={16} /></button>
                    </div>
                </header>

                <div className="flex-1 relative">
                    <textarea
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="absolute inset-0 w-full h-full bg-transparent p-6 text-sm font-mono text-[var(--primary-text)] focus:outline-none resize-none custom-scrollbar leading-relaxed"
                    />
                </div>

                <footer className="p-4 bg-accent/5 border-t border-[var(--border-color)] flex items-center justify-between">
                    <div className="flex gap-2">
                        <button
                            onClick={handleDeploy}
                            disabled={deployStatus === 'deploying'}
                            className="px-4 py-2 rounded-xl bg-deep-space-accent-neon text-deep-space-bg font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                        >
                            {deployStatus === 'deploying' ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                            {deployStatus === 'deploying' ? 'Deploying...' : 'Deploy Live'}
                        </button>

                        <button onClick={handlePush} disabled={isPushing} className="px-4 py-2 rounded-xl bg-[var(--primary-bg)]/5 text-[var(--secondary-text)]/40 font-bold text-[10px] uppercase tracking-widest hover:bg-[var(--primary-bg)]/10 transition-all flex items-center gap-2">
                            {isPushing ? <Loader2 size={12} className="animate-spin" /> : <GitBranch size={12} />}
                            Push
                        </button>

                        <button onClick={handleFork} className="px-4 py-2 rounded-xl bg-[var(--primary-bg)]/5 text-[var(--secondary-text)]/40 font-bold text-[10px] uppercase tracking-widest hover:bg-[var(--primary-bg)]/10 transition-all flex items-center gap-2">
                            <GitFork size={12} />
                            Fork
                        </button>
                    </div>
                    {deployStatus === 'success' && deployUrl && (
                        <div className="flex items-center gap-2 text-green-400">
                            <span className="text-[10px] uppercase font-bold tracking-widest">Live at:</span>
                            <a href={deployUrl} target="_blank" className="text-xs hover:underline flex items-center gap-1">
                                {deployUrl} <ExternalLink size={10} />
                            </a>
                        </div>
                    )}
                </footer>
            </div>

            {/* Preview Side */}
            <div className="flex-1 flex flex-col gap-4">
                <div className="flex-1 adaptive-theme-surface rounded-3xl border border-[var(--border-color)] overflow-hidden flex flex-col">
                    <header className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Layout size={16} className="text-deep-space-accent-neon" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--secondary-text)]">Real-time Preview</span>
                        </div>
                        <button className="p-2 hover:bg-white/10 rounded-xl text-white/40 transition-all"><Maximize2 size={16} /></button>
                    </header>
                    <div className="flex-1 bg-[var(--primary-bg)]">
                        <iframe
                            title="preview"
                            srcDoc={code}
                            className="w-full h-full border-0"
                        />
                    </div>
                </div>

                <div className="h-48 bg-[var(--card-bg)]/40 backdrop-blur-xl rounded-3xl border border-[var(--border-color)] overflow-hidden flex flex-col">
                    <header className="px-6 py-3 border-b border-[var(--border-color)] flex items-center gap-2 bg-[var(--primary-bg)]/5">
                        <Terminal size={14} className="text-[var(--secondary-text)]/40" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--secondary-text)]/40">Console</span>
                    </header>
                    <div className="flex-1 p-4 font-mono text-[11px] text-green-400/60 overflow-y-auto custom-scrollbar">
                        <div>{'>'} Initializing render engine...</div>
                        <div>{'>'} Bridge connected to Electron main...</div>
                        <div>{'>'} Live reload enabled.</div>
                        {deployStatus === 'success' && <div>{'>'} Project deployed successfully to {deployUrl}</div>}
                        <div className="text-white/20 mt-1 cursor-text">_</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CodingDashboard;
