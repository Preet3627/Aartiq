"use client";

import React, { memo } from 'react';
import { Cpu, Settings, RefreshCw } from 'lucide-react';

interface AIFallbackProps {
  onOpenSettings?: () => void;
  message?: string;
}

const AIFallback = memo(function AIFallback({ onOpenSettings, message }: AIFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-6 text-center">
      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500/20 to-purple-500/20 border border-sky-500/20 flex items-center justify-center mb-3">
        <Cpu size={18} className="text-sky-400/60" />
      </div>
      <h3 className="text-[11px] font-bold text-secondary-text/70 mb-1">AI Provider Not Configured</h3>
      <p className="text-[9px] text-secondary-text/40 leading-relaxed max-w-[240px] mb-3">
        {message || 'No AI provider is configured. Set up an API key or local model to start using AI features.'}
      </p>
      <div className="flex gap-2">
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/20 text-[9px] font-bold text-sky-400 transition-all uppercase tracking-wider"
          >
            <Settings size={10} /> Configure AI
          </button>
        )}
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] text-[9px] font-medium text-secondary-text/50 hover:text-secondary-text transition-all"
        >
          <RefreshCw size={10} /> Retry
        </button>
      </div>
      <div className="mt-4 pt-3 border-t border-white/[0.04] w-full max-w-[200px]">
        <p className="text-[7px] text-secondary-text/25 uppercase tracking-wider mb-2">Supported Providers</p>
        <div className="flex flex-wrap justify-center gap-1">
          {['OpenAI', 'Anthropic', 'Gemini', 'Groq', 'xAI', 'Ollama'].map(p => (
            <span key={p} className="px-1.5 py-0.5 rounded bg-white/[0.03] text-[7px] text-secondary-text/30 font-medium">{p}</span>
          ))}
        </div>
      </div>
    </div>
  );
});

export default memo(AIFallback);
