'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ResearchStep {
  id: string;
  stage: string;
  label: string;
  detail?: string;
  status: 'pending' | 'running' | 'done' | 'error';
  icon?: string;
  timestamp?: number;
  source?: string;
  favicon?: string;
  url?: string;
  score?: number;
}

interface ResearchTimelineProps {
  steps: ResearchStep[];
  isComplete: boolean;
}

const stageIcons: Record<string, string> = {
  planning: '🧠',
  searching: '🔍',
  search_complete: '✅',
  follow_up_search: '🔍',
  fetching: '📄',
  extracting: '📄',
  extracted: '✓',
  fetch_error: '⚠️',
  ranking: '📊',
  clustering: '🔀',
  contradiction_check: '🔍',
  coverage_update: '📋',
  processing: '🧠',
  generating: '✍️',
  complete: '✨',
  search_error: '⚠️',
  error: '❌',
};

const stageLabels: Record<string, string> = {
  planning: 'Planning research',
  searching: 'Searching web',
  search_complete: 'Found results',
  follow_up_search: 'Searching for missing info',
  fetching: 'Reading page',
  extracting: 'Extracting content',
  extracted: 'Content extracted',
  fetch_error: 'Failed to read',
  ranking: 'Ranking sources',
  clustering: 'Clustering stories',
  contradiction_check: 'Verifying facts',
  coverage_update: 'Coverage update',
  processing: 'Processing articles',
  generating: 'Writing report',
  complete: 'Research complete',
  search_error: 'Search failed',
  error: 'Error',
};

function displayText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object') {
    const maybeLink = value as { title?: unknown; url?: unknown; name?: unknown };
    return displayText(maybeLink.title || maybeLink.name || maybeLink.url, fallback);
  }
  return fallback;
}

function stepKey(step: ResearchStep, index: number): string {
  return [
    'research-timeline-step',
    displayText(step.id),
    displayText(step.stage),
    displayText(step.url),
    displayText(step.label),
    index,
  ].filter(Boolean).join('-');
}

function StepItem({ step, index }: { step: ResearchStep; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const stage = displayText(step.stage);
  const icon = displayText(step.icon) || stageIcons[stage] || '⚙️';
  const label = displayText(step.label) || stageLabels[stage] || stage || 'Research step';
  const detail = displayText(step.detail);
  const source = displayText(step.source);
  const hasDetail = detail || source;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
      className="flex items-start gap-2.5 group"
    >
      <div className="flex flex-col items-center shrink-0 pt-0.5">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
          step.status === 'done' ? 'bg-emerald-500/15 text-emerald-400' :
          step.status === 'error' ? 'bg-red-500/15 text-red-400' :
          step.status === 'running' ? 'bg-sky-500/15 text-sky-400' :
          'bg-white/5 text-zinc-500'
        }`}>
          {step.status === 'done' ? '✓' : step.status === 'error' ? '✕' : step.status === 'running' ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="w-3.5 h-3.5 border-2 border-sky-400/30 border-t-sky-400 rounded-full" />
          ) : icon}
        </div>
        {index < 20 && <div className="w-px h-3 bg-white/8 mt-1" />}
      </div>

      <div
        className={`flex-1 min-w-0 pb-2 cursor-pointer ${hasDetail ? 'hover:bg-white/3 rounded px-1 -mx-1 transition-colors' : ''}`}
        onClick={() => hasDetail && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${
            step.status === 'done' ? 'text-zinc-300' :
            step.status === 'error' ? 'text-red-300' :
            step.status === 'running' ? 'text-sky-300' :
            'text-zinc-500'
          }`}>
            {label}
          </span>
          {source && (
            <span className="text-[10px] text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded">{source}</span>
          )}
          {step.score !== undefined && (
            <span className={`text-[10px] font-mono ${
              step.score >= 90 ? 'text-emerald-400' : step.score >= 70 ? 'text-sky-400' : 'text-zinc-400'
            }`}>{step.score}</span>
          )}
        </div>

        <AnimatePresence>
          {expanded && detail && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{detail}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function ResearchTimeline({ steps, isComplete }: ResearchTimelineProps) {
  const [expanded, setExpanded] = useState(true);
  const runningStep = steps.find(s => s.status === 'running');
  const completedCount = steps.filter(s => s.status === 'done').length;
  const errorCount = steps.filter(s => s.status === 'error').length;

  if (steps.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-2 h-2 rounded-full ${isComplete ? 'bg-emerald-400' : runningStep ? 'bg-sky-400 animate-pulse' : 'bg-zinc-500'}`} />
          <span className="text-xs font-medium text-zinc-300">
            {isComplete ? 'Research Complete' : runningStep ? displayText(runningStep.label, 'Research Progress') : 'Research Progress'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <span className="text-emerald-400">{completedCount}</span>
            {errorCount > 0 && <span className="text-red-400">{errorCount}</span>}
            <span>/ {steps.length}</span>
          </div>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-zinc-500"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
              {steps.map((step, i) => (
                <StepItem key={stepKey(step, i)} step={step} index={i} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
