"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ExternalLink,
  Globe,
  KeyRound,
  LogIn,
  Minus,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  Square,
  User,
  X,
} from 'lucide-react';

import { firebaseConfigStorage } from '@/lib/firebaseConfigStorage';
import { useAppVersion } from '@/lib/useAppVersion';
import { useAppStore } from '@/store/useAppStore';

const heroHighlights = [
  'Private-first browsing and AI',
  'One place for research and actions',
  'Safer approvals for system tasks',
  'Setup that respects your workflow',
];

const featureCards = [
  {
    icon: <Bot size={18} />,
    title: 'AI Workspace',
    description: 'Research, draft, automate, and export without hopping across tools.',
  },
  {
    icon: <ShieldCheck size={18} />,
    title: 'Action Security',
    description: 'Permission gates keep clicks, shell actions, and system controls deliberate.',
  },
  {
    icon: <MonitorSmartphone size={18} />,
    title: 'Desktop + Mobile',
    description: 'Sync automation, clipboard, and control flows across Aartiq devices.',
  },
  {
    icon: <Globe size={18} />,
    title: 'Flexible Models',
    description: 'Use local Ollama or cloud providers for private, high-speed reasoning.',
  },
];

const quickFacts = [
  { label: 'Secure approvals', value: 'Unified' },
  { label: 'Theme-ready', value: 'Setup' },
  { label: 'PDF + search', value: 'Built in' },
];

const openExternal = async (url: string) => {
  if (window.electronAPI?.openExternalUrl) {
    await window.electronAPI.openExternalUrl(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
};

export default function WelcomeScreen() {
  const { setHasSeenWelcomePage, setGuestMode } = useAppStore();
  const versionLabel = `v${useAppVersion()}`;
  const [activeHighlight, setActiveHighlight] = useState(0);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.userAgent.toLowerCase().includes('mac'));
  }, []);

  const handleMinimize = () => window.electronAPI?.minimizeWindow();
  const handleMaximize = () => window.electronAPI?.maximizeWindow();
  const handleClose = () => window.electronAPI?.closeWindow();

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveHighlight((current) => (current + 1) % heroHighlights.length);
    }, 2800);

    return () => window.clearInterval(timer);
  }, []);

  const authBaseUrl = useMemo(() => 'https://aartiq-three.vercel.app/auth', []);

  const getFirebaseConfigFromEnv = () => ({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  });

  const handleGoogleSignIn = async () => {
    if (window.electronAPI) {
      const config = firebaseConfigStorage.load() || getFirebaseConfigFromEnv();
      const authUrl = `${authBaseUrl}?client_id=desktop-app&redirect_uri=aartiq-browser%3A%2F%2Fauth&firebase_config=${btoa(JSON.stringify(config))}`;
      window.electronAPI.openAuthWindow(authUrl);
      setHasSeenWelcomePage(true);
      return;
    }

    const authUrl = `${authBaseUrl}?client_id=web-app&redirect_uri=${encodeURIComponent(window.location.origin + '/auth')}`;
    window.open(authUrl, '_blank');
    setHasSeenWelcomePage(true);
  };

  const handleContinue = () => setHasSeenWelcomePage(true);

  const handleGuestMode = () => {
    setGuestMode(true);
    setHasSeenWelcomePage(true);
  };

  const handleCloseAuthPopup = () => {
    if (window.electronAPI?.closeAuthWindow) {
      window.electronAPI.closeAuthWindow();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[20000] overflow-hidden bg-[#071018] text-white"
      style={{ fontFamily: "'Outfit', 'DM Sans', system-ui, sans-serif" }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_42%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(15,118,110,0.12),transparent_28%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_18%,transparent_82%,rgba(255,255,255,0.03))]" />
      <motion.div
        className="absolute -top-16 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-400/10 blur-[100px]"
        animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.65, 0.4] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 flex h-full flex-col">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between px-8 py-6"
        >
          <div className="flex items-center gap-4">
            {!isMac && (
              <div className="flex items-center gap-1 mr-3 py-2">
                <button
                  onClick={handleMinimize}
                  className="h-8 w-10 flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/10 active:bg-white/15 transition-colors rounded"
                  title="Minimize"
                >
                  <Minus size={14} />
                </button>
                <button
                  onClick={handleMaximize}
                  className="h-8 w-10 flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/10 active:bg-white/15 transition-colors rounded"
                  title="Maximize"
                >
                  <Square size={11} />
                </button>
                <button
                  onClick={handleClose}
                  className="h-8 w-10 flex items-center justify-center text-white/50 hover:text-white hover:bg-red-500/80 active:bg-red-500 transition-colors rounded"
                  title="Close"
                >
                  <X size={15} />
                </button>
              </div>
            )}
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/6 shadow-[0_18px_60px_rgba(0,0,0,0.25)]">
              <img src="/logo-transparent.png" alt="Aartiq" className="h-9 w-9 object-contain" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-200/70">Aartiq Browser</p>
              <p className="text-sm text-white/45">Minimal AI workspace for research, actions, and secure automation.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55 md:block">
              {versionLabel}
            </div>
            <button
              onClick={handleContinue}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Skip intro
            </button>
            <button
              onClick={handleContinue}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>

        <div className="flex-1 overflow-y-auto px-6 pb-8 md:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="rounded-[32px] border border-white/10 bg-white/[0.04] p-8 shadow-[0_30px_120px_rgba(0,0,0,0.3)] backdrop-blur-2xl md:p-10"
            >
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-100/90">
                <Sparkles size={14} />
                Welcome to Aartiq
              </div>

              <div className="space-y-5">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">
                  Clean browsing, capable AI, and safer actions in one focused workspace.
                </h1>

                <div className="h-7 overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={activeHighlight}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -18 }}
                      transition={{ duration: 0.35 }}
                      className="text-sm font-medium uppercase tracking-[0.24em] text-sky-100/65"
                    >
                      {heroHighlights[activeHighlight]}
                    </motion.p>
                  </AnimatePresence>
                </div>

                <p className="max-w-2xl text-base leading-8 text-white/62">
                  Aartiq gives you a modern browser shell, AI assistance, automation approvals, live search tooling,
                  and setup that helps you start in minutes instead of hunting through settings.
                </p>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:max-w-xl">
                <button
                  onClick={handleGoogleSignIn}
                  className="group flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-left text-black shadow-[0_24px_80px_rgba(255,255,255,0.14)] transition hover:-translate-y-0.5"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold">
                    <LogIn size={18} />
                    Sign in with Google
                  </span>
                  <ArrowRight size={18} className="transition group-hover:translate-x-1" />
                </button>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={handleContinue}
                    className="rounded-2xl border border-sky-300/20 bg-sky-300/10 px-5 py-4 text-left text-sm font-semibold text-sky-50 transition hover:border-sky-300/35 hover:bg-sky-300/16"
                  >
                    Continue to setup
                  </button>
                  <button
                    onClick={handleGuestMode}
                    className="rounded-2xl border border-white/10 bg-white/6 px-5 py-4 text-left text-sm font-semibold text-white/82 transition hover:bg-white/10"
                  >
                    Browse in guest mode
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                   <button
                    onClick={handleCloseAuthPopup}
                    className="w-full rounded-2xl border border-white/10 bg-transparent px-5 py-3 text-sm font-medium text-white/60 transition hover:bg-white/6 hover:text-white"
                  >
                    Close sign-in popup
                  </button>
                </div>
              </div>

              <div className="mt-10 grid gap-4 md:grid-cols-3">
                {quickFacts.map((fact, index) => (
                  <motion.div
                    key={fact.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index + 0.15 }}
                    className="rounded-2xl border border-white/10 bg-black/20 px-5 py-4"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">{fact.label}</p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">{fact.value}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.65, delay: 0.1 }}
              className="space-y-6"
            >
              <div className="rounded-[28px] border border-white/10 bg-[#08141d]/90 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">First-run overview</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">What setup covers</h2>
                  </div>
                  <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-200/90">
                    Guided
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {[
                    'Choose your theme before the browser opens fully.',
                    'Connect Ollama or cloud AI keys when you are ready.',
                    'Your security and AI keys stay encrypted on your machine.',
                    'Review sync and security basics in one pass.',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                      <CheckCircle2 size={18} className="mt-0.5 text-sky-300" />
                      <p className="text-sm leading-6 text-white/68">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {featureCards.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 * index + 0.2 }}
                    className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-sky-200">
                      {feature.icon}
                    </div>
                    <h3 className="mt-4 text-lg font-semibold tracking-[-0.02em] text-white">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/56">{feature.description}</p>
                  </motion.div>
                ))}
              </div>


            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
