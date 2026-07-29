"use client";

import React, { memo, useMemo } from 'react';
import { Brain, Link2, CheckCircle2 } from 'lucide-react';
import { AIHomeCard, HomeSkeleton } from '../../home/AIHomeCard';
import {
  filterRelevantMemories,
  loadMemories,
  parsePageContext,
  type TabInfo,
} from '@/lib/homeIntelligence';

interface MemoryInsightsWidgetProps {
  tabs: TabInfo[];
  activeTabId?: string;
  onAction?: (cmd: string) => void;
}

const MemoryInsightsWidget = memo(function MemoryInsightsWidget({
  tabs,
  activeTabId,
  onAction,
}: MemoryInsightsWidgetProps) {
  const ctx = useMemo(() => parsePageContext(tabs, activeTabId), [tabs, activeTabId]);
  const all = useMemo(() => loadMemories(), [tabs, activeTabId]);
  const relevant = useMemo(() => filterRelevantMemories(all, ctx), [all, ctx]);
  const preferences = useMemo(() => all.filter((m) => m.category === 'preference').slice(0, 3), [all]);

  const similarPages = useMemo(() => {
    if (!ctx) return [];
    return tabs
      .filter((t) => t.id !== ctx.tabId && t.url && t.url !== 'about:blank')
      .filter((t) => {
        try {
          return new URL(t.url).hostname === new URL(ctx.url).hostname;
        } catch {
          return false;
        }
      })
      .slice(0, 3);
  }, [tabs, ctx]);

  if (all.length === 0 && similarPages.length === 0) {
    return (
      <AIHomeCard title="Memory insights" subtitle="Learning as you work" collapsible defaultExpanded={false}>
        <p className="text-[10px] text-secondary-text/50">No relevant memories yet for this context.</p>
      </AIHomeCard>
    );
  }

  return (
    <AIHomeCard title="Memory insights" subtitle="Relevant to now" collapsible defaultExpanded={false}>
      {relevant.length === 0 ? (
        <HomeSkeleton rows={2} />
      ) : (
        <div className="space-y-3">
          {relevant.length > 0 && (
            <div>
              <div className="text-[9px] uppercase tracking-wider text-secondary-text/40 mb-1.5 flex items-center gap-1">
                <Brain size={10} /> Contextual recall
              </div>
              <div className="space-y-1">
                {relevant.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => onAction?.(`Apply what you know: ${m.value}`)}
                    className="w-full text-left text-[10px] text-secondary-text/70 hover:text-primary-text truncate rounded-lg px-2 py-1 hover:bg-white/[0.04] transition-colors"
                  >
                    {m.value}
                  </button>
                ))}
              </div>
            </div>
          )}

          {similarPages.length > 0 && (
            <div>
              <div className="text-[9px] uppercase tracking-wider text-secondary-text/40 mb-1.5 flex items-center gap-1">
                <Link2 size={10} /> Similar pages open
              </div>
              <div className="space-y-1">
                {similarPages.map((t) => (
                  <div key={t.id} className="text-[10px] text-secondary-text/60 truncate">
                    {t.title}
                  </div>
                ))}
              </div>
            </div>
          )}

          {preferences.length > 0 && (
            <div>
              <div className="text-[9px] uppercase tracking-wider text-secondary-text/40 mb-1.5 flex items-center gap-1">
                <CheckCircle2 size={10} /> Learned preferences
              </div>
              <div className="flex flex-wrap gap-1">
                {preferences.map((p) => (
                  <span
                    key={p.key}
                    className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300/70 border border-emerald-500/15"
                  >
                    {p.key.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AIHomeCard>
  );
});

export default MemoryInsightsWidget;
