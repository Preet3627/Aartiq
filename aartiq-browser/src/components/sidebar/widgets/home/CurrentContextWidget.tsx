"use client";

import React, { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gauge, Target } from 'lucide-react';
import { AIHomeCard } from '../../home/AIHomeCard';
import { useActiveTabDwell } from '../../home/useActiveTabDwell';
import {
  estimateUnderstandingScore,
  filterRelevantMemories,
  formatDwellTime,
  inferObjective,
  loadMemories,
  parsePageContext,
  type TabInfo,
} from '@/lib/homeIntelligence';

interface CurrentContextWidgetProps {
  tabs: TabInfo[];
  activeTabId?: string;
  sessionLabel?: string;
  isWorking?: boolean;
}

const CurrentContextWidget = memo(function CurrentContextWidget({
  tabs,
  activeTabId,
  sessionLabel = '',
  isWorking = false,
}: CurrentContextWidgetProps) {
  const dwell = useActiveTabDwell(activeTabId);
  const ctx = useMemo(() => parsePageContext(tabs, activeTabId), [tabs, activeTabId]);
  const memories = useMemo(() => loadMemories(), [tabs, activeTabId]);
  const relevant = useMemo(() => filterRelevantMemories(memories, ctx), [memories, ctx]);
  const score = useMemo(
    () => estimateUnderstandingScore(ctx, relevant.length, dwell),
    [ctx, relevant.length, dwell],
  );
  const objective = useMemo(() => inferObjective(ctx, sessionLabel), [ctx, sessionLabel]);
  const relatedSessions = useMemo(
    () => memories.filter((m) => m.category === 'session').slice(0, 2),
    [memories],
  );

  return (
    <AIHomeCard
      title="Current context"
      subtitle={ctx ? ctx.domain : 'No active page'}
      isWorking={isWorking}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTabId || 'empty'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-3"
        >
          {ctx ? (
            <>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-primary-text leading-snug line-clamp-2">
                    {ctx.title}
                  </p>
                  <p className="text-[10px] text-secondary-text/45 mt-1 font-mono truncate">{ctx.url}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] text-secondary-text/45">On page</div>
                  <div className="text-[12px] font-semibold text-sky-400/90 tabular-nums">{formatDwellTime(dwell)}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-[9px] text-secondary-text/50 mb-1">
                    <span className="inline-flex items-center gap-1">
                      <Gauge size={10} /> AI understanding
                    </span>
                    <span className="font-mono">{score}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500/80 to-emerald-400/80"
                      initial={{ width: 0 }}
                      animate={{ width: `${score}%` }}
                      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2">
                <Target size={12} className="text-violet-400/70 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[9px] uppercase tracking-wider text-secondary-text/40">Objective</div>
                  <div className="text-[11px] text-secondary-text/85 truncate">{objective}</div>
                </div>
              </div>

              {(relevant.length > 0 || relatedSessions.length > 0) && (
                <div className="grid grid-cols-2 gap-2">
                  {relevant.length > 0 && (
                    <div>
                      <div className="text-[9px] text-secondary-text/40 mb-1">Related memories</div>
                      <div className="space-y-1">
                        {relevant.slice(0, 2).map((m) => (
                          <div key={m.key} className="text-[10px] text-secondary-text/65 truncate">
                            {m.value.slice(0, 56)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {relatedSessions.length > 0 && (
                    <div>
                      <div className="text-[9px] text-secondary-text/40 mb-1">Related sessions</div>
                      <div className="space-y-1">
                        {relatedSessions.map((s) => (
                          <div key={s.key} className="text-[10px] text-secondary-text/65 truncate">
                            {s.value.slice(0, 56)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-[11px] text-secondary-text/55 py-2">
              Open a page and Aartiq will map what it knows in real time.
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </AIHomeCard>
  );
});

export default CurrentContextWidget;
