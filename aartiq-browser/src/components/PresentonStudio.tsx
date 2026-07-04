"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Presentation, ExternalLink, Play, Settings, Server,
    RefreshCw, AlertTriangle, CheckCircle2, Copy, Terminal,
    Sparkles, ArrowRight, X, Globe, Loader2
} from 'lucide-react';

const DEFAULT_PRESENTON_URL = 'http://localhost:5000';

const PresentonStudio = () => {
    const [presentonUrl, setPresentonUrl] = useState(DEFAULT_PRESENTON_URL);
    const [isLoading, setIsLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [showSetup, setShowSetup] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [iframeSrc, setIframeSrc] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Load saved URL from localStorage and handle auto-launch events
    useEffect(() => {
        const saved = localStorage.getItem('presenton_url');
        if (saved) {
            setPresentonUrl(saved);
        }

        const handleAutoLaunch = (e: any) => {
            const prompt = e.detail?.prompt;
            const targetUrl = saved || DEFAULT_PRESENTON_URL;
            const fullUrl = prompt ? `${targetUrl}?prompt=${encodeURIComponent(prompt)}` : targetUrl;

            setIframeSrc(fullUrl);
            setShowSetup(false);
            setIsConnected(true);
        };

        window.addEventListener('comet-launch-presenton', handleAutoLaunch);
        return () => window.removeEventListener('comet-launch-presenton', handleAutoLaunch);
    }, []);

    const checkConnection = async (url: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(url, {
                mode: 'no-cors',
                signal: controller.signal
            });
            clearTimeout(timeout);
            // no-cors mode means we can't read the response, but if it doesn't throw, the server is up
            setIsConnected(true);
            localStorage.setItem('presenton_url', url);
            return true;
        } catch (e: any) {
            setIsConnected(false);
            setError('Cannot reach Presenton server. Make sure Docker is running.');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const handleLaunch = async () => {
        setIsLoading(true);
        setError(null);
        // Try to connect
        const ok = await checkConnection(presentonUrl);
        if (ok) {
            setIframeSrc(presentonUrl);
            setShowSetup(false);
        }
    };

    const handleLaunchAnyway = () => {
        localStorage.setItem('presenton_url', presentonUrl);
        setIframeSrc(presentonUrl);
        setShowSetup(false);
        setIsConnected(true);
    };

    const handleCopyCommand = (cmd: string) => {
        navigator.clipboard.writeText(cmd);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getDockerCommand = () => {
        const platform = window.electronAPI?.getPlatform() || 'darwin';
        const isMac = platform === 'darwin';
        const isWin = platform === 'win32';
        
        // On Apple Silicon Macs, we often need to specify --platform linux/amd64 for many images
        const arch = isMac ? '--platform linux/amd64 ' : '';
        const pathSep = isWin ? '\\' : '/';
        const pwdVar = isWin ? '%CD%' : '${PWD}';
        
        return `docker run -d --name presenton -p 5000:80 ${arch}-v "${pwdVar}${pathSep}app_data:/app_data" ghcr.io/presenton/presenton:latest`;
    };

    const dockerCommand = getDockerCommand();

    const handleAutoRunDocker = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // First check if a container with that name already exists and try to start it
            const checkResult = await window.electronAPI.executeShellCommand('docker ps -a --filter name=presenton --format "{{.Names}}"');
            if (checkResult.success && checkResult.output?.includes('presenton')) {
                await window.electronAPI.executeShellCommand('docker start presenton');
            } else {
                await window.electronAPI.executeShellCommand(dockerCommand);
            }
            
            // Wait bit and then check connection
            setTimeout(() => {
                checkConnection(presentonUrl);
            }, 3000);
        } catch (e: any) {
            setError(`Auto-launch failed: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    if (!showSetup && iframeSrc) {
        return (
            <div className="h-full w-full flex flex-col bg-primary-bg">
                {/* Header Bar */}
                <div className="h-12 flex items-center justify-between px-4 bg-[var(--navbar-bg)]/80 backdrop-blur-xl border-b border-[var(--border-color)] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                            <Presentation size={16} className="text-white" />
                        </div>
                        <span className="text-sm font-black uppercase tracking-widest text-[var(--primary-text)]/80">Presenton Studio</span>
                        <span className="text-[9px] font-bold text-[var(--secondary-text)]/40 uppercase tracking-widest px-2 py-0.5 bg-[var(--primary-bg)]/5 rounded-full border border-[var(--border-color)]">AI Presentations</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                if (iframeSrc) {
                                    const iframe = document.getElementById('presenton-iframe') as HTMLIFrameElement;
                                    if (iframe) iframe.src = iframe.src; // reload
                                }
                            }}
                            className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all"
                            title="Reload"
                        >
                            <RefreshCw size={14} />
                        </button>
                        <button
                            onClick={() => window.open(presentonUrl, '_blank')}
                            className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all"
                            title="Open in External Browser"
                        >
                            <ExternalLink size={14} />
                        </button>
                        <button
                            onClick={() => { setShowSetup(true); setIframeSrc(null); }}
                            className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all"
                            title="Settings"
                        >
                            <Settings size={14} />
                        </button>
                    </div>
                </div>

                {/* Iframe */}
                <div className="flex-1 relative">
                    <iframe
                        id="presenton-iframe"
                        src={iframeSrc}
                        className="absolute inset-0 w-full h-full border-0"
                        allow="clipboard-read; clipboard-write; fullscreen"
                        title="Presenton AI Presentation Generator"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full overflow-y-auto custom-scrollbar bg-primary-bg">
            <div className="max-w-3xl mx-auto py-16 px-8">
                {/* Hero Section */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-16"
                >
                    <div className="relative inline-block mb-8">
                        <div className="absolute -inset-8 bg-gradient-to-r from-orange-500/20 via-amber-500/10 to-orange-500/20 blur-3xl rounded-full" />
                        <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.4)] mx-auto">
                            <Presentation size={48} className="text-white" />
                        </div>
                    </div>

                    <h1 className="text-5xl font-black uppercase tracking-tighter text-[var(--primary-text)] mb-4">
                        Presenton <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500">Studio</span>
                    </h1>
                    <p className="text-[var(--secondary-text)]/60 text-lg max-w-lg mx-auto leading-relaxed font-medium">
                        Open-source AI presentation generator. Create beautiful slides from prompts, documents, or existing PPTX files.
                    </p>

                    <div className="flex items-center justify-center gap-3 mt-6">
                        <span className="px-3 py-1 rounded-full bg-orange-500/10 border border-orange-400/20 text-orange-400 text-[10px] font-black uppercase tracking-widest">
                            <Sparkles size={10} className="inline mr-1" /> AI-Powered
                        </span>
                        <span className="px-3 py-1 rounded-full bg-[var(--primary-bg)]/5 border border-[var(--border-color)] text-[var(--secondary-text)]/40 text-[10px] font-black uppercase tracking-widest">
                            Apache 2.0
                        </span>
                        <span className="px-3 py-1 rounded-full bg-[var(--primary-bg)]/5 border border-[var(--border-color)] text-[var(--secondary-text)]/40 text-[10px] font-black uppercase tracking-widest">
                            Self-Hosted
                        </span>
                    </div>
                </motion.div>

                {/* Feature Cards */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="grid grid-cols-3 gap-4 mb-12"
                >
                    {[
                        { icon: <Sparkles size={20} />, title: 'AI Generation', desc: 'Create slides from prompts or docs', color: 'text-orange-400' },
                        { icon: <Globe size={20} />, title: 'Multiple LLMs', desc: 'OpenAI, Gemini, Claude, Ollama', color: 'text-sky-400' },
                        { icon: <Presentation size={20} />, title: 'Export Ready', desc: 'PPTX & PDF export with themes', color: 'text-purple-400' },
                    ].map((f, i) => (
                        <div key={i} className="p-6 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-accent/40 shadow-sm transition-all group">
                            <div className={`${f.color} mb-4 group-hover:scale-110 transition-transform`}>{f.icon}</div>
                            <p className="font-bold text-[var(--primary-text)] text-sm mb-1">{f.title}</p>
                            <p className="text-[11px] text-[var(--secondary-text)]/40">{f.desc}</p>
                        </div>
                    ))}
                </motion.div>

                {/* Setup Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-6"
                >
                    {/* Docker Setup */}
                    <div className="p-8 rounded-[2rem] bg-[var(--card-bg)] border border-[var(--border-color)] space-y-6">
                        <div className="flex items-center gap-3">
                            <Server size={20} className="text-orange-400" />
                            <h3 className="text-lg font-black text-[var(--primary-text)] uppercase tracking-tight">Quick Setup</h3>
                        </div>

                        <p className="text-sm text-[var(--secondary-text)]/60">
                            Run this Docker command to start Presenton locally. The app will be available at <code className="text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded text-xs">localhost:5000</code>.
                        </p>

                        <div className="relative group">
                            <pre className="bg-black/60 border border-white/10 rounded-xl p-4 text-xs text-orange-300/80 font-mono overflow-x-auto custom-scrollbar">
                                {dockerCommand}
                            </pre>
                            <button
                                onClick={() => handleCopyCommand(dockerCommand)}
                                className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                title="Copy"
                            >
                                {copied ? <CheckCircle2 size={14} className="text-green-400" /> : <Copy size={14} />}
                            </button>
                        </div>

                        <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-start gap-3">
                            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-300/60">
                                <strong className="text-amber-400">Docker required.</strong> Make sure Docker Desktop is installed and running before executing the command.
                                The first startup will download the ~500MB image.
                            </p>
                        </div>
                    </div>

                    {/* Connection URL */}
                    <div className="p-8 rounded-[2rem] bg-[var(--card-bg)] border border-[var(--border-color)] space-y-6">
                        <div className="flex items-center gap-3">
                            <Globe size={20} className="text-sky-400" />
                            <h3 className="text-lg font-black text-[var(--primary-text)] uppercase tracking-tight">Connect</h3>
                        </div>

                        <div className="flex gap-3">
                            <input
                                type="url"
                                value={presentonUrl}
                                onChange={(e) => setPresentonUrl(e.target.value)}
                                placeholder="http://localhost:5000"
                                className="flex-1 bg-[var(--primary-bg)]/40 border border-[var(--border-color)] rounded-xl py-3 px-5 text-sm text-[var(--primary-text)] font-medium focus:outline-none focus:ring-1 focus:ring-orange-400/50 transition-all placeholder:text-[var(--secondary-text)]/20"
                            />
                            <button
                                onClick={() => checkConnection(presentonUrl)}
                                disabled={isLoading}
                                className="px-5 py-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-white/60 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                Test
                            </button>
                        </div>

                        {isConnected && (
                            <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-2 text-green-400 text-xs font-bold"
                            >
                                <CheckCircle2 size={14} />
                                <span>Connected to Presenton server!</span>
                            </motion.div>
                        )}

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-2 text-red-400 text-xs font-bold"
                            >
                                <AlertTriangle size={14} />
                                <span>{error}</span>
                            </motion.div>
                        )}
                    </div>
                    {/* Action Buttons */}
                    <div className="flex gap-4">
                        <button
                            onClick={handleAutoRunDocker}
                            disabled={isLoading}
                            className="flex-1 py-5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-3"
                        >
                            {isLoading ? (
                                <><Loader2 size={18} className="animate-spin" /> Starting...</>
                            ) : (
                                <><Terminal size={18} /> Auto-Run Docker</>
                            )}
                        </button>
                        <button
                            onClick={handleLaunch}
                            disabled={isLoading}
                            className="flex-1 py-5 bg-[var(--primary-bg)]/10 border border-[var(--border-color)] hover:bg-[var(--primary-bg)]/20 text-[var(--primary-text)] rounded-2xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                        >
                            {isLoading ? (
                                <><Loader2 size={18} className="animate-spin" /> Connecting...</>
                            ) : (
                                <><Play size={18} /> Launch Presenton</>
                            )}
                        </button>
                        <button
                            onClick={handleLaunchAnyway}
                            className="px-6 py-5 bg-[var(--primary-bg)]/5 border border-[var(--border-color)] hover:bg-[var(--primary-bg)]/10 text-[var(--secondary-text)]/40 hover:text-[var(--primary-text)] rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2"
                        >
                            Skip <ArrowRight size={14} />
                        </button>
                    </div>

                    {/* Cloud Alternative */}
                    <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/5 text-center">
                        <p className="text-xs text-white/30 mb-3">
                            Don't want to self-host? Use Presenton Cloud instead.
                        </p>
                        <button
                            onClick={() => {
                                setPresentonUrl('https://app.presenton.ai');
                                localStorage.setItem('presenton_url', 'https://app.presenton.ai');
                                setIframeSrc('https://app.presenton.ai');
                                setShowSetup(false);
                            }}
                            className="inline-flex items-center gap-2 px-6 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold text-white/60 hover:text-white transition-all"
                        >
                            <ExternalLink size={12} /> Open Presenton Cloud
                        </button>
                    </div>

                    {/* GitHub Link */}
                    <div className="text-center">
                        <a
                            href="https://github.com/presenton/presenton"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-orange-400 transition-colors inline-flex items-center gap-2"
                        >
                            <Globe size={12} /> github.com/presenton/presenton
                        </a>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default PresentonStudio;
