"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from "@/store/useAppStore";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    Sparkles,
    Shield,
    Zap,
    LogIn,
    ArrowRight,
    Cpu,
    BookOpen,
    Github,
    ExternalLink,
    Volume2,
    VolumeX,
    Music
} from "lucide-react";
import { firebaseConfigStorage, FirebaseConfig } from "@/lib/firebaseConfigStorage";
import { useAppVersion } from "@/lib/useAppVersion";

const LandingPage = () => {
    const store = useAppStore();
    const [isLoading, setIsLoading] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const appVersion = useAppVersion();
    const versionLabel = `v${appVersion}`;

    const COMET_README = `
# ☄️ Aartiq (${versionLabel})
### The Future of Autonomous Web Intelligence

**Aartiq** is an AI-native browser designed to automate your digital life. Built for extreme performance and deep AI integration.

**Core Pillars:**
*   **Autonomous Agency**: The Aartiq Agent doesn't just answer questions; it acts.
*   **Neural Orchestration**: Native support for Gemini, Claude, and Local LLMs.
*   **Local Memory**: Built-in vector database for infinite semantic history.
*   **Hardware Isolation**: Sandboxed environment for maximum security.
`.trim();

    useEffect(() => {
        audioRef.current = new Audio('/bgm.mp3');
        audioRef.current.loop = true;
        audioRef.current.volume = 0.3;

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    const toggleMute = () => {
        if (!audioRef.current) return;
        if (isMuted) {
            audioRef.current.play().catch(console.error);
        } else {
            audioRef.current.pause();
        }
        setIsMuted(!isMuted);
    };

    const getFirebaseConfigFromEnv = (): FirebaseConfig => ({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
    });

    const handleGuestMode = () => {
        store.setGuestMode(true);
        store.setHasSeenWelcomePage(true);
        store.setActiveView("browser");
    };

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        if (window.electronAPI) {
            const config = firebaseConfigStorage.load() || getFirebaseConfigFromEnv();
            const authUrl = `https://browser.ponsrischool.in/auth?client_id=desktop-app&redirect_uri=aartiq-browser%3A%2F%2Fauth&firebase_config=${btoa(JSON.stringify(config))}`;
            window.electronAPI.openAuthWindow(authUrl);
        } else {
            const url = `https://browser.ponsrischool.in/auth?client_id=web-app&redirect_uri=${encodeURIComponent(window.location.origin + '/auth')}`;
            window.open(url, "_blank");
        }
    };

    return (
        <div className="min-h-screen text-primary-text relative bg-[#050508] font-sans selection:bg-accent/30 overflow-hidden">
            {/* Ambient Background */}
            <div className="fixed inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/20 blur-[150px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[150px] rounded-full" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 contrast-150 brightness-100" />
            </div>

            {/* Main Content */}
            <div className="relative z-10 pt-12 pb-20 px-6 max-w-6xl mx-auto flex flex-col items-center">

                {/* Hero Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-center mb-24"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/50 mb-8">
                        <Sparkles size={12} className="text-accent" />
                        Neural Interface • {versionLabel}
                    </div>

                    <h1 className="text-6xl md:text-8xl font-black mb-8 tracking-tighter text-white leading-[0.9]">
                        Minimal. <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-white to-accent-light">Intelligent.</span>
                    </h1>

                    <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto leading-relaxed font-medium mb-12">
                        Experience a browsing environment designed for focus.
                        Native AI orchestration, hardened security, and liquid speed.
                    </p>

                    <div className="flex flex-col md:flex-row gap-4 justify-center">
                        <button
                            onClick={handleGuestMode}
                            className="px-10 py-4 bg-accent hover:bg-accent-light text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-[0_10px_40px_-10px_var(--accent)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                        >
                            Enter Workspace <ArrowRight size={18} />
                        </button>
                        <button
                            onClick={handleGoogleSignIn}
                            disabled={isLoading}
                            className="px-10 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all border border-white/10 backdrop-blur-xl flex items-center justify-center gap-3"
                        >
                            <LogIn size={18} />
                            {isLoading ? 'Processing...' : 'Sign in with Google'}
                        </button>
                    </div>
                </motion.div>

                {/* Feature Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-32">
                    {[
                        { icon: <Shield size={24} />, title: "Hardened", desc: "Chromium sandbox with neural firewalling." },
                        { icon: <Zap size={24} />, title: "Instant", desc: "Optimized for extreme low-latency task execution." },
                        { icon: <Cpu size={24} />, title: "Native AI", desc: "Integrated reasoning engines for deep automation." }
                    ].map((feature, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="p-8 rounded-[2rem] bg-white/[0.02] border border-white/5 backdrop-blur-3xl hover:bg-white/[0.04] transition-all group"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-accent mb-6 group-hover:scale-110 transition-transform">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                            <p className="text-white/40 text-sm leading-relaxed">{feature.desc}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Engineering Manifest Section (README) */}
                <motion.section
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="w-full max-w-4xl"
                >
                    <div className="p-10 md:p-16 rounded-[3rem] bg-white/[0.02] border border-white/5 backdrop-blur-3xl relative overflow-hidden">
                        <div className="flex items-center gap-4 mb-12">
                            <BookOpen size={24} className="text-accent" />
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight">System Specification</h2>
                        </div>

                        <article className="prose prose-invert prose-sky max-w-none 
                            prose-headings:text-white prose-headings:font-black prose-headings:uppercase 
                            prose-p:text-white/50 prose-p:leading-relaxed
                            prose-strong:text-accent prose-strong:font-black
                            prose-code:bg-white/5 prose-code:px-1.5 prose-code:rounded-md
                            prose-ul:text-white/40
                        ">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {COMET_README}
                            </ReactMarkdown>
                        </article>
                    </div>
                </motion.section>
            </div>

            {/* Simple Footer */}
            <footer className="relative z-10 py-20 border-t border-white/5 mt-20 text-center">
                <div className="flex flex-col items-center gap-6">
                    <div className="flex items-center gap-3 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500 cursor-pointer">
                        <img src="/icon.png" className="w-8 h-8" alt="Logo" />
                        <span className="font-black text-xl tracking-tight text-white">AARTIQ</span>
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">
                        Made in India 🇮🇳 • © 2026 Latestinssan
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
