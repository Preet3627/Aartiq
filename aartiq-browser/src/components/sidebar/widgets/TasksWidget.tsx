"use client";

import React, { memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, CheckCircle2, AlertCircle, XCircle,
  ChevronDown, ChevronRight, RotateCcw, Trash2,
  Play, Loader2, ExternalLink
} from 'lucide-react';

interface AutomationRun {
  id: string;
  totalCommands: number;
  successCount: number;
  failedCount: number;
  startTime: number;
  endTime: number;
  commands: { type: string; label: string; status: string; error?: string }[];
}

interface TasksWidgetProps {
  onAction?: (cmd: string) => void;
  activeRunSteps?: { id: string; label: string; status: string; detail?: string; timestamp: number }[];
}

const STORAGE_KEY = 'aartiq_automation_runs';
const MAX_RUNS = 10;

function loadRuns(): AutomationRun[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { }
  return [];
}

function saveRuns(runs: AutomationRun[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs.slice(-MAX_RUNS)));
  } catch { }
}

const statusIcon = (status: string, size = 10) => {
  switch (status) {
    case 'done':
    case 'executed':
    case 'success':
      return <CheckCircle2 size={size} className="text-emerald-400" />;
    case 'running':
    case 'executing':
      return <Loader2 size={size} className="text-sky-400 animate-spin" />;
    case 'failed':
    case 'error':
      return <XCircle size={size} className="text-red-400" />;
    case 'skipped':
      return <span className={`w-[${size}px] h-[${size}px] rounded-full border border-yellow-400/50`} />;
    default:
      return <Clock size={size} className="text-secondary-text/40" />;
  }
};

const TasksWidget = memo(function TasksWidget({ onAction, activeRunSteps = [] }: TasksWidgetProps) {
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [showActiveRun, setShowActiveRun] = useState(true);

  useEffect(() => {
    setRuns(loadRuns());
    const handler = () => setRuns(loadRuns());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const handleRetryFailed = useCallback((run: AutomationRun) => {
    const failedLabels = run.commands
      .filter(c => c.status === 'failed' || c.status === 'error')
      .map(c => c.label?.trim() || c.type)
      .filter(Boolean);
    if (failedLabels.length === 0) return;
    const cmd = `Retry these failed operations: ${failedLabels.join(', ')}`;
    if (onAction) {
      onAction(cmd);
    } else {
      const input = document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="message"]');
      if (input) { input.value = cmd; input.focus(); }
    }
  }, [onAction]);

  const handleClearHistory = useCallback(() => {
    setRuns([]);
    saveRuns([]);
  }, []);

  const hasActiveRun = activeRunSteps.length > 0;
  const hasHistory = runs.length > 0;

  if (!hasActiveRun && !hasHistory) {
    return (
      <div className="text-center py-4">
        <Play size={16} className="mx-auto mb-1 text-secondary-text/30" />
        <p className="text-[10px] text-secondary-text/50">No automation runs yet</p>
        <p className="text-[9px] text-secondary-text/30 mt-0.5">Runs will appear when automation completes</p>
      </div>
    );
  }

  const formatDuration = (start: number, end: number) => {
    const s = Math.round((end - start) / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return time;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
  };

  return (
    <div className="space-y-1.5">
      {/* Active (current) run */}
      {hasActiveRun && (
        <div>
          <div className="text-[7px] font-bold uppercase tracking-wider text-secondary-text/30 mb-1 px-0.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            Current Run
          </div>
          <div className="rounded-lg border border-sky-400/20 bg-sky-400/5 overflow-hidden">
            <div className="px-2 py-1.5 space-y-0.5 max-h-[180px] overflow-y-auto modern-scrollbar">
              {activeRunSteps.map((step, idx) => (
                <div key={step.id || idx} className="flex items-center gap-1.5">
                  <span className="shrink-0">{statusIcon(step.status, 8)}</span>
                  <span className={`text-[9px] truncate flex-1 ${
                    step.status === 'running' ? 'text-sky-400' :
                    step.status === 'done' ? 'text-secondary-text/80' :
                    step.status === 'error' ? 'text-red-400/80' :
                    'text-secondary-text/50'
                  }`}>
                    {step.label}
                  </span>
                  {step.detail && (
                    <span className="text-[8px] text-secondary-text/30 font-mono truncate max-w-[80px]">{step.detail}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Past runs */}
      {hasHistory && (
        <div>
          <div className="text-[7px] font-bold uppercase tracking-wider text-secondary-text/30 mb-1 px-0.5 flex items-center justify-between">
            <span>History ({runs.length})</span>
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-0.5 text-[8px] text-secondary-text/30 hover:text-red-400/60 transition-colors"
            >
              <Trash2 size={8} /> Clear
            </button>
          </div>
          <div className="space-y-1">
            {runs.map((run) => {
              const isExpanded = expandedRunId === run.id;
              const failedCount = run.failedCount;
              return (
                <div key={run.id} className="rounded-lg border border-white/[0.06] overflow-hidden">
                  <button
                    onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-white/[0.03] transition-colors"
                  >
                    <motion.div
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={{ duration: 0.12 }}
                    >
                      <ChevronRight size={9} className="text-secondary-text/40" />
                    </motion.div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {failedCount > 0
                        ? <AlertCircle size={9} className="text-red-400" />
                        : <CheckCircle2 size={9} className="text-emerald-400" />
                      }
                    </div>
                    <span className="text-[9px] text-secondary-text/70 font-medium truncate flex-1">
                      {run.successCount}/{run.totalCommands} steps
                    </span>
                    <span className="text-[8px] text-secondary-text/30 font-mono">
                      {formatDuration(run.startTime, run.endTime)}
                    </span>
                    <span className="text-[8px] text-secondary-text/30 font-mono shrink-0">
                      {formatTime(run.startTime)}
                    </span>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden border-t border-white/[0.04]"
                      >
                        <div className="px-2 py-1.5 space-y-0.5 max-h-[200px] overflow-y-auto modern-scrollbar">
                          {run.commands.map((cmd, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <span className="shrink-0">{statusIcon(cmd.status, 7)}</span>
                              <span className={`text-[8px] truncate flex-1 ${
                                cmd.status === 'error' || cmd.status === 'failed' ? 'text-red-400/70' : 'text-secondary-text/50'
                              }`}>
                                {cmd.label}
                              </span>
                              {cmd.error && (
                                <span className="text-[7px] text-red-400/40 truncate max-w-[80px]" title={cmd.error}>
                                  {cmd.error}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>

                        {failedCount > 0 && (
                          <div className="px-2 py-1 border-t border-white/[0.04]">
                            <button
                              onClick={() => handleRetryFailed(run)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-400/10 hover:bg-red-400/20 border border-red-400/15 text-[8px] font-medium text-red-400/70 hover:text-red-400 transition-all w-full justify-center"
                            >
                              <RotateCcw size={9} />
                              Retry {failedCount} failed
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tip when empty history but active run */}
      {hasActiveRun && !hasHistory && (
        <p className="text-[8px] text-secondary-text/30 text-center pt-1">
          Completed runs will appear here
        </p>
      )}
    </div>
  );
});

export default memo(TasksWidget);
