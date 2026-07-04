"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Cloud, Cpu, Shield, Key, 
  ChevronRight, ChevronLeft, ExternalLink, 
  Check, Wifi, Info, Globe, AlertCircle, Download
} from 'lucide-react';

interface AISetupGuideProps {
  onClose: () => void;
  onComplete: () => void;
}

const AISetupGuide: React.FC<AISetupGuideProps> = ({ onClose, onComplete }) => {
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const nextStep = () => setStep(s => Math.min(s + 1, totalSteps));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const providers = [
    { name: 'Google Gemini', url: 'https://aistudio.google.com/app/apikey', icon: <img src="/ai-logos/gemini.svg" className="w-4 h-4 object-contain" />, desc: 'Best overall performance & free tier' },
    { name: 'OpenAI (GPT-4)', url: 'https://platform.openai.com/api-keys', icon: <img src="/ai-logos/chatgpt.png" className="w-4 h-4 object-contain" />, desc: 'Industry standard for reasoning' },
    { name: 'Anthropic Claude', url: 'https://console.anthropic.com/settings/keys', icon: <img src="/ai-logos/claude.webp" className="w-4 h-4 object-contain" />, desc: 'Superior for coding & long context' },
    { name: 'Ollama (Local)', url: 'https://ollama.com/download', icon: <img src="/ai-logos/ollama.png" className="w-4 h-4 object-contain" />, desc: 'Private and free local inference' },
    { name: 'xAI (Grok)', url: 'https://console.x.ai/', icon: <img src="/ai-logos/Grok.png" className="w-4 h-4 object-contain" />, desc: 'Latest real-time intelligence' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute inset-0 z-[100] bg-[#0d0d1a]/95 backdrop-blur-2xl p-6 flex flex-col"
    >
      {/* Progress Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-deep-space-accent-neon/10 border border-deep-space-accent-neon/20 flex items-center justify-center">
            <Key size={20} className="text-deep-space-accent-neon" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-white">AI Setup Guide</h2>
            <p className="text-[10px] text-white/40 uppercase tracking-tighter">Step {step} of {totalSteps}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all">
          <Check size={18} />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto modern-scrollbar pr-2">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="p-4 rounded-2xl bg-sky-500/5 border border-sky-500/10">
                <h3 className="text-xs font-bold text-sky-400 mb-2 flex items-center gap-2">
                  <Info size={14} /> Welcome to Aartiq
                </h3>
                <p className="text-xs text-white/60 leading-relaxed">
                  To unlock the full potential of your browser's AI agent, you need to connect an AI Provider. 
                  Comet supports both **Cloud Providers** (for maximum IQ) and **Local Engines** (for maximum privacy).
                </p>
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Choose your path</p>
                <div className="grid grid-cols-1 gap-3">
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-deep-space-accent-neon/30 transition-all group">
                    <div className="flex items-center gap-3 mb-2">
                      <Cloud size={18} className="text-deep-space-accent-neon" />
                      <span className="text-xs font-bold text-white">Cloud Intelligence</span>
                    </div>
                    <p className="text-[10px] text-white/40 leading-relaxed">Fast, accurate, and powerful. Requires an API Key from providers like Google or OpenAI.</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-sky-400/30 transition-all group">
                    <div className="flex items-center gap-3 mb-2">
                      <Cpu size={18} className="text-sky-400" />
                      <span className="text-xs font-bold text-white">Local Performance</span>
                    </div>
                    <p className="text-[10px] text-white/40 leading-relaxed">Private and free. Uses your own computer's hardware via Ollama. No API keys needed.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Get your API Keys</p>
              <div className="space-y-2">
                {providers.map((p) => (
                  <a 
                    key={p.name} 
                    href={p.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/5 hover:border-white/10 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center border border-white/5">
                      {p.icon}
                    </div>
                    <div className="flex-1">
                      <div className="text-[11px] font-bold text-white group-hover:text-deep-space-accent-neon transition-colors">{p.name}</div>
                      <div className="text-[9px] text-white/30">{p.desc}</div>
                    </div>
                    <ExternalLink size={12} className="text-white/20 group-hover:text-white/60 transition-all" />
                  </a>
                ))}
              </div>
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-3">
                <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[9px] text-amber-500/80 leading-relaxed font-medium">
                  Comet stores your keys locally in an encrypted vault. They are never sent to our servers.
                </p>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                  <Wifi size={16} className="text-sky-400" />
                </div>
                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Ollama Network Guide</h3>
              </div>
              
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                  <div className="text-[10px] font-black text-white/40 uppercase">1. Expose to Network</div>
                  <p className="text-[10px] text-white/60 leading-relaxed">
                    By default, Ollama only listens locally. To allow Comet to connect (especially if using a remote server):
                  </p>
                  <div className="bg-black/40 p-2 rounded-lg font-mono text-[9px] text-sky-300 border border-white/5">
                    export OLLAMA_HOST=0.0.0.0
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                  <div className="text-[10px] font-black text-white/40 uppercase">2. Bypass CORS</div>
                  <p className="text-[10px] text-white/60 leading-relaxed">
                    Browser security requires explicit CORS permission to connect to the Ollama API:
                  </p>
                  <div className="bg-black/40 p-2 rounded-lg font-mono text-[9px] text-sky-300 border border-white/5">
                    export OLLAMA_ORIGINS="*"
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                  <div className="text-[10px] font-black text-white/40 uppercase">3. Download Ollama</div>
                  <p className="text-[10px] text-white/60 leading-relaxed">
                    If you haven't installed it yet, download Ollama to run models locally:
                  </p>
                  <a 
                    href="https://ollama.com/download" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black uppercase text-white hover:bg-white/10 transition-all"
                  >
                    <Download size={14} /> Download for Mac/Windows/Linux
                  </a>
                </div>

                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 flex items-start gap-3">
                  <Info size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[9px] text-blue-400/80 leading-relaxed font-medium">
                    After setting these environment variables, restart your Ollama service for changes to take effect.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center justify-center space-y-6 py-8"
            >
              <div className="w-20 h-20 rounded-full bg-deep-space-accent-neon/10 border border-deep-space-accent-neon/30 flex items-center justify-center animate-pulse">
                <Sparkles size={40} className="text-deep-space-accent-neon" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Connect your Intelligence</h3>
                <p className="text-[10px] text-white/40 max-w-[250px] leading-relaxed mx-auto">
                  Enter your API keys below to activate Cloud features immediately.
                </p>
              </div>

              <div className="w-full space-y-3">
                <div className="relative">
                  <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                  <input 
                    type="password" 
                    placeholder="Gemini API Key"
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-[11px] text-white focus:outline-none focus:border-deep-space-accent-neon/50 transition-all"
                    onChange={(e) => window.electronAPI && window.dispatchEvent(new CustomEvent('update-api-key', { detail: { provider: 'gemini', key: e.target.value } }))}
                  />
                </div>
                <div className="relative">
                  <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                  <input 
                    type="password" 
                    placeholder="OpenAI API Key (Optional)"
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-[11px] text-white focus:outline-none focus:border-deep-space-accent-neon/50 transition-all"
                    onChange={(e) => window.electronAPI && window.dispatchEvent(new CustomEvent('update-api-key', { detail: { provider: 'openai', key: e.target.value } }))}
                  />
                </div>
              </div>

              <button 
                onClick={onComplete}
                className="w-full py-3 rounded-2xl bg-deep-space-accent-neon text-black text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_20px_rgba(0,255,242,0.3)]"
              >
                Complete Setup
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Footer */}
      <div className="pt-6 flex items-center justify-between gap-3">
        <button 
          onClick={prevStep}
          disabled={step === 1}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest transition-all ${step === 1 ? 'opacity-0' : 'hover:bg-white/5 text-white/60 hover:text-white'}`}
        >
          <ChevronLeft size={14} /> Back
        </button>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`h-1 rounded-full transition-all ${step === i ? 'w-6 bg-deep-space-accent-neon shadow-[0_0_8px_rgba(0,255,242,0.5)]' : 'w-2 bg-white/10'}`} />
          ))}
        </div>
        <button 
          onClick={nextStep}
          disabled={step === totalSteps}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest transition-all ${step === totalSteps ? 'opacity-0' : 'hover:bg-white/10 text-white'}`}
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </motion.div>
  );
};

export default AISetupGuide;
