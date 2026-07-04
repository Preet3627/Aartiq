"use client";

import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Loader2, ChevronRight, Check, X, Zap } from 'lucide-react';

export interface ThinkingStep {
  id: string;
  label: string;
  status: 'running' | 'done' | 'error' | 'skipped';
  detail?: string;
  timestamp: number;
}

interface ThinkingPanelProps {
  steps?: ThinkingStep[];
  thinkText?: string;
  initialOpen?: boolean;
}

const ThinkingPanel = memo(function ThinkingPanel({ steps = [], thinkText, initialOpen = false }: ThinkingPanelProps) {
  const [open, setOpen] = useState(initialOpen);
  const hasRunning = steps.some((s) => s.status === 'running');
  const hasContent = (thinkText && thinkText.trim().length > 0) || steps.length > 0;

  if (!hasContent) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full rounded-xl border border-sky-500/15 bg-sky-500/[0.04] overflow-hidden mb-2"
    >
      {/* Toggle Button — ">" arrow style */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-sky-400/60 hover:text-sky-300 hover:bg-sky-500/5 transition-all font-mono select-none"
      >
        <motion.div
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          <ChevronRight size={12} />
        </motion.div>

        {hasRunning ? (
          <>
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Brain size={11} />
            </motion.div>
            <span>Thinking</span>
            <motion.div
              className="ml-1 flex items-center gap-0.5"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-1 h-1 rounded-full bg-sky-400"
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </motion.div>
          </>
        ) : (
          <>
            <Zap size={11} className="text-sky-400/60" />
            <span>View thinking</span>
            {steps.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-sky-500/10 rounded-full text-[8px] text-sky-400/70 font-black">
                {steps.length}
              </span>
            )}
          </>
        )}
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="thinking-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {/* Chain of thought text */}
            {thinkText && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-3 py-2.5 text-[10px] text-white/40 italic leading-relaxed border-b border-white/5 font-mono max-h-40 overflow-y-auto modern-scrollbar whitespace-pre-wrap"
              >
                {thinkText}
              </motion.div>
            )}

            {/* Step list */}
            {steps.length > 0 && (
              <div className="px-3 py-2 space-y-1.5 bg-black/10">
                {steps.map((step, idx) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="flex items-start gap-2"
                  >
                    <div className={`mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                      step.status === 'running' ? 'border-sky-400 bg-sky-400/20'
                      : step.status === 'done'    ? 'border-green-400/60 bg-green-400/10'
                                                 : 'border-red-400/60 bg-red-400/10'
                    }`}>
                      {step.status === 'running' && (
                        <motion.div
                          className="w-1.5 h-1.5 rounded-full bg-sky-400"
                          animate={{ scale: [1, 1.4, 1], opacity: [0.8, 1, 0.8] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                      )}
                      {step.status === 'done'    && <Check size={8} className="text-green-400" />}
                      {step.status === 'error'   && <X size={8} className="text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[10px] font-medium ${
                        step.status === 'running' ? 'text-sky-300'
                        : step.status === 'done'  ? 'text-white/50'
                                                  : 'text-red-300'
                      }`}>{step.label}</div>
                      {step.detail && (
                        <div className="text-[9px] text-white/25 truncate mt-0.5">{step.detail}</div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default ThinkingPanel;
