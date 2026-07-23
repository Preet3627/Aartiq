'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ExecutionStepData {
  id: string;
  stage: string;
  message: string;
  url?: string;
  source?: string;
  favicon?: string;
  score?: number;
  index?: number;
  status: 'running' | 'done' | 'error';
}

interface ResearchExecutionCardProps {
  steps: ExecutionStepData[];
  isComplete: boolean;
  query: string;
  progress?: number;
  currentStep?: number;
  totalSteps?: number;
  coverage?: { percentage: number; covered: number; total: number };
}

const stageEmoji: Record<string, string> = {
  planning: '🧠', searching: '🔍', search_complete: '✅', follow_up_search: '🔍',
  fetching: '📄', extracting: '📝', extracted: '✓', fetch_error: '⚠️',
  ranking: '📊', clustering: '🔀', contradiction_check: '🔎', coverage_update: '📋',
  processing: '🧠', generating: '✍️', complete: '✨', search_error: '⚠️', error: '❌',
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

function stepKey(step: ExecutionStepData, index: number): string {
  return [
    'research-step',
    displayText(step.id),
    displayText(step.stage),
    displayText(step.url),
    index,
  ].filter(Boolean).join('-');
}

function StepCard({ step, index }: { step: ExecutionStepData; index: number }) {
  const [showDetail, setShowDetail] = useState(false);
  const stage = displayText(step.stage);
  const message = displayText(step.message, 'Working...');
  const source = displayText(step.source);
  const url = displayText(step.url);
  const emoji = stageEmoji[stage] || '⚙️';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.2) }}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
        step.status === 'running' ? 'bg-sky-500/8 border border-sky-500/20' :
        step.status === 'done' ? 'bg-white/[0.02] border border-white/5' :
        'bg-red-500/5 border border-red-500/10'
      } ${url ? 'cursor-pointer hover:bg-white/[0.04]' : ''}`}
      onClick={() => url && setShowDetail(!showDetail)}
    >
      <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-sm shrink-0">
        {step.status === 'running' ? (
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="rgba(56,189,248,0.2)" strokeWidth="1.5" />
              <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </motion.div>
        ) : step.status === 'done' ? (
          <span className="text-emerald-400 text-xs">✓</span>
        ) : (
          <span className="text-xs">{emoji}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${
            step.status === 'running' ? 'text-sky-300' :
            step.status === 'done' ? 'text-zinc-300' :
            'text-red-300'
          }`}>
            {message}
          </span>
          {source && (
            <span className="text-[10px] text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded shrink-0">{source}</span>
          )}
        </div>
        {url && (
          <div className="text-[10px] text-zinc-600 truncate mt-0.5">{url}</div>
        )}
      </div>

      {step.score !== undefined && (
        <span className={`text-[10px] font-mono font-bold shrink-0 ${
          step.score >= 90 ? 'text-emerald-400' : step.score >= 70 ? 'text-sky-400' : 'text-zinc-400'
        }`}>
          {step.score}
        </span>
      )}
    </motion.div>
  );
}

export function ResearchExecutionCard({ steps, isComplete, query, progress, currentStep, totalSteps, coverage }: ResearchExecutionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const runningCount = steps.filter(s => s.status === 'running').length;
  const doneCount = steps.filter(s => s.status === 'done').length;
  const errorCount = steps.filter(s => s.status === 'error').length;

  if (steps.length === 0) return null;

  const activeStep = steps.find(s => s.status === 'running');
  const currentMessage = displayText(activeStep?.message, isComplete ? 'Research complete' : 'Researching...');
  const visibleSteps = steps.slice(-5);
  const progressValue = Math.max(0, Math.min(100, progress ?? (isComplete ? 100 : 0)));
  const stepLabel = totalSteps ? `${Math.min(currentStep || totalSteps, totalSteps)}/${totalSteps}` : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.025]"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex flex-1 items-center gap-2.5">
            <div className={`h-2 w-2 shrink-0 rounded-full ${
              isComplete ? 'bg-emerald-400' : runningCount > 0 ? 'bg-sky-400 animate-pulse' : 'bg-zinc-500'
            }`} />
            <div className="min-w-0 text-left">
              <div className="truncate text-[12px] font-semibold text-zinc-200">{currentMessage}</div>
              {query && (
                <div className="mt-0.5 truncate text-[10px] text-zinc-500">{query}</div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-1.5 sm:flex" title={coverage ? `Coverage ${coverage.covered}/${coverage.total}` : 'Research progress'}>
              <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-sky-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressValue}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className="text-[10px] text-zinc-500">{progressValue}%</span>
            </div>
            {coverage && (
              <span className="hidden text-[10px] text-zinc-600 md:inline">
                {coverage.covered}/{coverage.total}
              </span>
            )}
            <div className="flex items-center gap-1 text-[10px] text-zinc-500">
              {stepLabel && <span>{stepLabel}</span>}
              {!stepLabel && doneCount > 0 && <span className="text-emerald-400">{doneCount}</span>}
              {errorCount > 0 && <span className="text-red-400">/{errorCount}</span>}
            </div>
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-zinc-500">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-1 overflow-y-auto px-3 pb-3 modern-scrollbar max-h-[168px]">
              <AnimatePresence mode="popLayout">
                {visibleSteps.map((step, i) => (
                  <StepCard key={stepKey(step, i)} step={step} index={i} />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
