"use client";

import React, { memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle2, XCircle, Clock, X, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

interface BackgroundTaskEvent {
  id: string;
  taskName: string;
  taskType: string;
  status: 'success' | 'failed' | 'missed';
  timestamp: number;
  result?: { filepath?: string; preview?: string };
  error?: string;
  seen: boolean;
}

const STORAGE_KEY = 'aartiq_background_task_events';

function loadEvents(): BackgroundTaskEvent[] {
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

function saveEvents(events: BackgroundTaskEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch { }
}

function markAllSeen(events: BackgroundTaskEvent[]): BackgroundTaskEvent[] {
  return events.map(e => ({ ...e, seen: true }));
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

export interface BackgroundNotificationsProps {
  onShowDetails?: (event: BackgroundTaskEvent) => void;
}

const BackgroundNotifications = memo(function BackgroundNotifications({ onShowDetails }: BackgroundNotificationsProps) {
  const [events, setEvents] = useState<BackgroundTaskEvent[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const loaded = loadEvents();
    const unseen = loaded.filter(e => !e.seen);
    if (unseen.length > 0) {
      setEvents(loaded);
      saveEvents(markAllSeen(loaded));
    } else {
      const recent = loaded.filter(e => Date.now() - e.timestamp < 86400000);
      if (recent.length > 0) {
        setEvents(recent.slice(0, 5));
      }
    }

    const handler = () => {
      const fresh = loadEvents();
      const recent = fresh.filter(e => Date.now() - e.timestamp < 86400000);
      if (recent.length > 0) {
        setEvents(recent.slice(0, 5));
        setDismissed(false);
      }
    };
    window.addEventListener('storage', handler);
    window.addEventListener('automation-task-completed', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('automation-task-completed', handler);
    };
  }, []);

  const clearAll = useCallback(() => {
    setEvents([]);
    setDismissed(true);
    try { localStorage.removeItem(STORAGE_KEY); } catch { }
  }, []);

  if (events.length === 0 || dismissed) return null;

  const successCount = events.filter(e => e.status === 'success').length;
  const failedCount = events.filter(e => e.status === 'failed').length;
  const missedCount = events.filter(e => e.status === 'missed').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
      className="mx-4 mb-2 rounded-xl border border-amber-500/20 bg-[color-mix(in_srgb,var(--card-bg)_92%,transparent)] backdrop-blur-2xl overflow-hidden shadow-lg"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <Bell size={11} className="text-amber-400" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-secondary-text/70">
            While you were away
          </span>
          <span className="text-[8px] text-secondary-text/30 font-mono">
            {events.length} event{events.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setExpanded(v => !v)} className="p-0.5 rounded text-secondary-text/30 hover:text-secondary-text transition-colors">
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
          <button onClick={clearAll} className="p-0.5 rounded text-secondary-text/30 hover:text-secondary-text transition-colors">
            <X size={11} />
          </button>
        </div>
      </div>

      <div className="px-3 py-1.5">
        <div className="flex items-center gap-3 mb-1">
          {successCount > 0 && (
            <div className="flex items-center gap-1">
              <CheckCircle2 size={9} className="text-emerald-400" />
              <span className="text-[9px] text-emerald-400/70 font-bold">{successCount}</span>
              <span className="text-[7px] text-secondary-text/40 uppercase">done</span>
            </div>
          )}
          {failedCount > 0 && (
            <div className="flex items-center gap-1">
              <XCircle size={9} className="text-red-400" />
              <span className="text-[9px] text-red-400/70 font-bold">{failedCount}</span>
              <span className="text-[7px] text-secondary-text/40 uppercase">failed</span>
            </div>
          )}
          {missedCount > 0 && (
            <div className="flex items-center gap-1">
              <Clock size={9} className="text-yellow-400" />
              <span className="text-[9px] text-yellow-400/70 font-bold">{missedCount}</span>
              <span className="text-[7px] text-secondary-text/40 uppercase">missed</span>
            </div>
          )}
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden border-t border-white/[0.04] mt-1"
            >
              <div className="py-1 space-y-1">
                {events.map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-start gap-2 py-1 group"
                  >
                    <span className="mt-0.5 shrink-0">
                      {evt.status === 'success' ? (
                        <CheckCircle2 size={8} className="text-emerald-400" />
                      ) : evt.status === 'failed' ? (
                        <XCircle size={8} className="text-red-400" />
                      ) : (
                        <Clock size={8} className="text-yellow-400" />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-secondary-text/70 truncate">{evt.taskName}</span>
                        <span className="text-[7px] text-secondary-text/30 font-mono shrink-0">{formatTime(evt.timestamp)}</span>
                      </div>
                      {evt.result?.preview && (
                        <p className="text-[8px] text-secondary-text/40 truncate mt-0.5">{evt.result.preview}</p>
                      )}
                      {evt.error && (
                        <p className="text-[8px] text-red-400/50 truncate mt-0.5">{evt.error}</p>
                      )}
                    </div>
                    {evt.result?.filepath && (
                      <button
                        onClick={() => {
                          try { window.electronAPI?.showItemInFolder?.(evt.result!.filepath!); } catch { }
                        }}
                        className="shrink-0 p-0.5 rounded text-secondary-text/20 opacity-0 group-hover:opacity-100 hover:text-sky-400 transition-all"
                        title="Open file location"
                      >
                        <ExternalLink size={8} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

export { type BackgroundTaskEvent };
export default memo(BackgroundNotifications);
