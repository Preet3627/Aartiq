"use client";

import React, { memo, useEffect, useMemo, useState } from 'react';
import { ArrowRight, PlayCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { AIHomeCard } from '../../home/AIHomeCard';
import { buildResumeItems, type HistoryEntry } from '@/lib/homeIntelligence';

interface AutomationRun {
  id: string;
  startTime: number;
  commands: { label: string; status: string }[];
}

const STORAGE_KEY = 'aartiq_automation_runs';

function loadRuns(): AutomationRun[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

interface SessionResumeWidgetProps {
  history?: HistoryEntry[];
  onAction: (cmd: string) => void;
}

const SessionResumeWidget = memo(function SessionResumeWidget({
  history = [],
  onAction,
}: SessionResumeWidgetProps) {
  const [runs, setRuns] = useState<AutomationRun[]>([]);

  useEffect(() => {
    setRuns(loadRuns());
    const onStorage = () => setRuns(loadRuns());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const items = useMemo(() => buildResumeItems(history, runs), [history, runs]);

  if (items.length === 0) return null;

  return (
    <AIHomeCard title="Session resume" subtitle="Continue previous work" collapsible defaultExpanded>
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <motion.button
            key={item.id}
            type="button"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.04, duration: 0.2 }}
            onClick={() => onAction(item.command)}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] hover:border-sky-500/20 transition-all duration-200 group/row"
          >
            <PlayCircle size={14} className="text-sky-400/60 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-primary-text/90 truncate">{item.title}</div>
              <div className="text-[9px] text-secondary-text/45 truncate">{item.subtitle}</div>
            </div>
            <ArrowRight size={12} className="text-secondary-text/25 group-hover/row:text-sky-400/70 shrink-0 transition-colors" />
          </motion.button>
        ))}
      </div>
    </AIHomeCard>
  );
});

export default SessionResumeWidget;
