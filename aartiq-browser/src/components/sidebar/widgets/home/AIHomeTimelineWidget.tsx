"use client";

import React, { memo, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  BookOpen,
  Brain,
  Zap,
  Flag,
  ChevronDown,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { AIHomeCard } from '../../home/AIHomeCard';
import { mapStepsToTimeline, type TimelinePhase } from '@/lib/homeIntelligence';
import type { ActionChainStep } from '@/components/ai/ActionChainTimeline';

interface AIHomeTimelineWidgetProps {
  steps: ActionChainStep[];
  isWorking?: boolean;
}

const PHASE_META: Record<
  TimelinePhase,
  { label: string; icon: React.ReactNode }
> = {
  search: { label: 'Search', icon: <Search size={11} /> },
  read: { label: 'Read', icon: <BookOpen size={11} /> },
  reason: { label: 'Reason', icon: <Brain size={11} /> },
  execute: { label: 'Execute', icon: <Zap size={11} /> },
  finish: { label: 'Finish', icon: <Flag size={11} /> },
};

const AIHomeTimelineWidget = memo(function AIHomeTimelineWidget({
  steps,
  isWorking = false,
}: AIHomeTimelineWidgetProps) {
  const events = useMemo(() => mapStepsToTimeline(steps), [steps]);
  const [collapsedDone, setCollapsedDone] = useState(true);

  const grouped = useMemo(() => {
    const order: TimelinePhase[] = ['search', 'read', 'reason', 'execute', 'finish'];
    return order
      .map((phase) => ({
        phase,
        events: events.filter((e) => e.phase === phase),
      }))
      .filter((g) => g.events.length > 0);
  }, [events]);

  if (events.length === 0) {
    return (
      <AIHomeCard title="Timeline" subtitle="Live event stream" collapsible defaultExpanded={false}>
        <p className="text-[10px] text-secondary-text/50 py-1">Actions will stream here as the AI works.</p>
      </AIHomeCard>
    );
  }

  return (
    <AIHomeCard
      title="Timeline"
      subtitle="Search → Read → Reason → Execute → Finish"
      isWorking={isWorking}
      collapsible
      defaultExpanded
    >
      <div className="space-y-3">
        {grouped.map(({ phase, events: phaseEvents }) => {
          const allDone = phaseEvents.every((e) => e.status === 'done' || e.status === 'skipped');
          const isCollapsed = allDone && collapsedDone;
          const meta = PHASE_META[phase];

          return (
            <div key={phase} className="rounded-xl border border-white/[0.05] overflow-hidden">
              <button
                type="button"
                onClick={() => allDone && setCollapsedDone((v) => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-white/[0.02] text-left"
              >
                <span className="text-sky-400/70">{meta.icon}</span>
                <span className="text-[10px] font-semibold text-primary-text/85 flex-1">{meta.label}</span>
                {phaseEvents.some((e) => e.status === 'running') && (
                  <Loader2 size={11} className="text-sky-400 animate-spin" />
                )}
                {allDone && <CheckCircle2 size={11} className="text-emerald-400/80" />}
                {allDone && (
                  <motion.span animate={{ rotate: isCollapsed ? 0 : 180 }} transition={{ duration: 0.15 }}>
                    <ChevronDown size={12} className="text-secondary-text/35" />
                  </motion.span>
                )}
              </button>
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-2 space-y-1">
                      {phaseEvents.map((ev, idx) => (
                        <motion.div
                          key={ev.id}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.02, duration: 0.18 }}
                          className="flex items-center gap-2 text-[10px] text-secondary-text/65"
                        >
                          <span className="w-1 h-1 rounded-full bg-white/25 shrink-0" />
                          <span className="truncate flex-1">{ev.label}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </AIHomeCard>
  );
});

export default AIHomeTimelineWidget;
