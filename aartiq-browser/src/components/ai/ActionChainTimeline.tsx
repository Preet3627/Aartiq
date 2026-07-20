"use client";

import React, { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Zap, ChevronDown, ChevronRight } from 'lucide-react';

export interface ActionChainStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  detail?: string;
  icon?: React.ReactNode;
  timestamp: number;
}

export interface ActionChainTimelineProps {
  steps: ActionChainStep[];
  title?: string;
  initialOpen?: boolean;
  onStepClick?: (step: ActionChainStep) => void;
  compact?: boolean;
}

const statusDotColor: Record<string, string> = {
  pending: 'bg-secondary-text/40',
  running: 'bg-sky-400 animate-pulse',
  done: 'bg-emerald-400',
  error: 'bg-red-400',
  skipped: 'bg-yellow-400/60',
};

const statusStyles = {
  pending: 'border-border-color/30 bg-primary-bg/30',
  running: 'border-sky-400/40 bg-sky-400/8',
  done: 'border-emerald-400/40 bg-emerald-400/8',
  error: 'border-red-400/40 bg-red-400/8',
  skipped: 'border-yellow-400/40 bg-yellow-400/8',
};

const statusIcon = {
  pending: <span className="w-2.5 h-2.5 rounded-full bg-secondary-text/30" />,
  running: <Loader2 size={10} className="text-sky-400 animate-spin" />,
  done: <CheckCircle2 size={10} className="text-emerald-400" />,
  error: <XCircle size={10} className="text-red-400" />,
  skipped: <span className="w-2.5 h-2.5 rounded-full border border-yellow-400/50" />,
};

const ActionChainTimeline = memo(function ActionChainTimeline({
  steps,
  title = 'Automation Steps',
  initialOpen = true,
  onStepClick,
  compact = false,
}: ActionChainTimelineProps) {
  const [open, setOpen] = useState(initialOpen);
  const hasRunning = steps.some(s => s.status === 'running');
  const hasContent = steps.length > 0;

  if (!hasContent) return null;

  const completedCount = steps.filter(s => s.status === 'done').length;
  const totalCount = steps.length;
  const isComplete = completedCount === totalCount && totalCount > 0;

  // ── Compact mode: horizontal dot strip for header ──────────────
  if (compact) {
    return (
      <div className="w-full">
        {/* Compact bar: dot strip + toggle */}
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center gap-2 py-1 text-left hover:bg-[color-mix(in_srgb,var(--primary-text)_3%,transparent)] rounded-lg px-2 -mx-2 transition-colors duration-[150ms]"
        >
          <Zap size={11} className="text-sky-400/80 shrink-0" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-secondary-text shrink-0">
            {title}
          </span>

          {/* Dot strip */}
          <div className="flex items-center gap-1 ml-1 max-w-[180px] overflow-hidden">
            {steps.slice(0, 12).map((step) => (
              <span
                key={step.id}
                className="relative group/step shrink-0"
              >
                <span className={`block w-2 h-2 rounded-full ${statusDotColor[step.status]} transition-all duration-[150ms]`} />
                {/* Tooltip */}
                <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-[200] whitespace-nowrap rounded-lg border border-border-color bg-primary-bg/95 px-2 py-1 text-[10px] text-primary-text shadow-xl opacity-0 group-hover/step:opacity-100 transition-opacity duration-[150ms] backdrop-blur-xl">
                  {step.label}
                </span>
              </span>
            ))}
            {steps.length > 12 && (
              <span className="text-[9px] font-mono text-secondary-text/50 shrink-0">+{steps.length - 12}</span>
            )}
          </div>

          {/* Status badge */}
          <motion.span
            animate={{ opacity: hasRunning ? [0.5, 1, 0.5] : 1 }}
            transition={{ duration: 1.5, repeat: hasRunning ? Infinity : 0 }}
            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full ml-auto shrink-0 ${
              isComplete
                ? 'bg-emerald-500/15 text-emerald-400'
                : hasRunning
                ? 'bg-sky-500/15 text-sky-400'
                : 'bg-white/5 text-secondary-text'
            }`}
            title={`${completedCount} of ${totalCount} steps complete`}
          >
            {completedCount}/{totalCount}
          </motion.span>

          <motion.div
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="shrink-0"
          >
            <ChevronRight size={10} className="text-secondary-text/60" />
          </motion.div>
        </button>

        {/* Expanded details */}
        <AnimatePresence>
          {open && (
            <motion.div
              key="compact-steps"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
              className="overflow-hidden"
            >
              <div className="px-1 py-1 space-y-0.5 max-h-[200px] overflow-y-auto modern-scrollbar">
                {steps.map((step, idx) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15, delay: idx * 0.02 }}
                    className={`flex items-center gap-2 rounded-md px-2 py-1 transition-all duration-[150ms] ${
                      statusStyles[step.status]
                    }`}
                  >
                    <div className="flex-shrink-0 w-4 flex items-center justify-center">
                      {statusIcon[step.status]}
                    </div>
                    <span className={`text-[10px] font-medium truncate flex-1 ${
                      step.status === 'running' ? 'text-sky-400' :
                      step.status === 'done' ? 'text-secondary-text' :
                      step.status === 'error' ? 'text-red-400' :
                      'text-secondary-text/60'
                    }`}>
                      {step.label}
                    </span>
                    {step.detail && (
                      <span className="text-[9px] text-secondary-text/40 font-mono truncate max-w-[140px]">
                        {step.detail}
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Full mode: vertical panel for chat area ────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full rounded-xl border border-border-color/10 bg-primary-bg/5 overflow-hidden mb-2"
    >
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[color-mix(in_srgb,var(--primary-text)_3%,transparent)] transition-colors duration-[150ms]"
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
          >
            <ChevronRight size={12} className="text-secondary-text/60" />
          </motion.div>
          <Zap size={13} className="text-sky-400/80" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-secondary-text">
            {title}
          </span>
          <motion.span
            animate={{ opacity: hasRunning ? [0.5, 1, 0.5] : 1 }}
            transition={{ duration: 1.5, repeat: hasRunning ? Infinity : 0 }}
            className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded-full ${
              isComplete
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : hasRunning
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                : 'bg-white/5 text-secondary-text border border-border-color/20'
            }`}
          >
            {isComplete ? 'Complete' : hasRunning ? 'Running' : 'Pending'}
          </motion.span>
          <span className="text-[10px] text-secondary-text/50 font-mono ml-1">
            {completedCount}/{totalCount}
          </span>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="steps"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden border-t border-border-color/10"
          >
            <div className="px-3 py-2 space-y-1.5 max-h-[300px] overflow-y-auto modern-scrollbar">
              {steps.map((step, idx) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02, duration: 0.15 }}
                  className={`group flex items-start gap-2 rounded-lg px-2 py-1.5 transition-all duration-[150ms] ${
                    statusStyles[step.status]
                  }`}
                >
                  <div className="flex-shrink-0 w-5 flex items-center justify-center">
                    {statusIcon[step.status]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-medium truncate ${
                        step.status === 'running' ? 'text-sky-400' :
                        step.status === 'done' ? 'text-secondary-text' :
                        step.status === 'error' ? 'text-red-400' :
                        step.status === 'skipped' ? 'text-yellow-400' :
                        'text-secondary-text/60'
                      }`}>
                        {step.label}
                      </span>
                      {step.detail && (
                        <span className="text-[9px] text-secondary-text/40 font-mono truncate flex-1">
                          {step.detail}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-[9px] text-secondary-text/30 font-mono">
                    {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default ActionChainTimeline;
