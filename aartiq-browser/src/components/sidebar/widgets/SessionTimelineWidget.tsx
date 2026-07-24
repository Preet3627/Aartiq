"use client";

import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, XCircle, Zap } from 'lucide-react';
import type { ActionChainStep } from '@/components/ai/ActionChainTimeline';

interface SessionTimelineWidgetProps {
  steps: ActionChainStep[];
}

const statusConfig = {
  pending: { dot: 'bg-secondary-text/30', label: 'text-secondary-text/50' },
  running: { dot: 'bg-sky-400 animate-pulse', label: 'text-sky-400' },
  done: { dot: 'bg-emerald-400', label: 'text-secondary-text/70' },
  error: { dot: 'bg-red-400', label: 'text-red-400' },
  skipped: { dot: 'bg-yellow-400/60', label: 'text-yellow-400/70' },
};

const statusIcon = {
  pending: <span className="w-1.5 h-1.5 rounded-full bg-secondary-text/30" />,
  running: <Loader2 size={8} className="text-sky-400 animate-spin" />,
  done: <CheckCircle2 size={10} className="text-emerald-400" />,
  error: <XCircle size={10} className="text-red-400" />,
  skipped: <span className="w-1.5 h-1.5 rounded-full border border-yellow-400/50" />,
};

function displayText(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v && typeof v === 'object') {
    const o = v as { title?: unknown; label?: unknown; name?: unknown };
    return displayText(o.title || o.label || o.name, fallback);
  }
  return fallback;
}

const SessionTimelineWidget = memo(function SessionTimelineWidget({ steps }: SessionTimelineWidgetProps) {
  if (steps.length === 0) {
    return (
      <div className="text-center py-4">
        <Zap size={18} className="mx-auto mb-1.5 text-secondary-text/30" />
        <p className="text-[10px] text-secondary-text/50">No activity yet</p>
        <p className="text-[9px] text-secondary-text/30 mt-0.5">AI actions will appear here</p>
      </div>
    );
  }

  const completedCount = steps.filter(s => s.status === 'done' || s.status === 'error').length;
  const totalCount = steps.length;

  return (
    <div className="space-y-1">
      {/* Summary bar */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className="flex-1 h-1 rounded-full bg-secondary-text/10 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(completedCount / totalCount) * 100}%` }}
            className="h-full rounded-full bg-sky-400/60"
            transition={{ duration: 0.4 }}
          />
        </div>
        <span className="text-[8px] font-mono text-secondary-text/50">{completedCount}/{totalCount}</span>
      </div>

      {/* Steps */}
      <div className="space-y-1 max-h-[160px] overflow-y-auto modern-scrollbar">
        {steps.map((step, idx) => {
          const cfg = statusConfig[step.status];
          const label = displayText(step.label, 'Step');
          const detail = typeof step.detail === 'string' ? step.detail : '';
          return (
            <motion.div
              key={`${displayText(step.id)}-${idx}`}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.02 }}
              className="flex items-start gap-2 py-1"
            >
              <div className="mt-0.5 shrink-0">{statusIcon[step.status]}</div>
              <div className="flex-1 min-w-0">
                <div className={`text-[9px] font-medium truncate ${cfg.label}`}>
                  {label}
                </div>
                {detail && (
                  <div className="text-[8px] text-secondary-text/30 truncate mt-0.5">{detail}</div>
                )}
              </div>
              <div className="text-[7px] text-secondary-text/20 font-mono shrink-0">
                {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
});

export default memo(SessionTimelineWidget);
