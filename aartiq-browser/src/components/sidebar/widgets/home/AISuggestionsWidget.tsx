"use client";

import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { AIHomeCard } from '../../home/AIHomeCard';
import { buildContextSuggestions, parsePageContext, type TabInfo } from '@/lib/homeIntelligence';

interface AISuggestionsWidgetProps {
  tabs: TabInfo[];
  activeTabId?: string;
  onAction: (cmd: string) => void;
  isWorking?: boolean;
}

const AISuggestionsWidget = memo(function AISuggestionsWidget({
  tabs,
  activeTabId,
  onAction,
  isWorking = false,
}: AISuggestionsWidgetProps) {
  const ctx = useMemo(() => parsePageContext(tabs, activeTabId), [tabs, activeTabId]);
  const suggestions = useMemo(
    () => buildContextSuggestions(ctx, tabs.length),
    [ctx, tabs.length],
  );

  return (
    <AIHomeCard
      title="AI suggestions"
      subtitle="Generated from your current page"
      isWorking={isWorking}
    >
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s, idx) => (
          <motion.button
            key={s.id}
            type="button"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.03, duration: 0.18 }}
            onClick={() => onAction(s.command)}
            className="group/btn relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium border border-[color-mix(in_srgb,var(--ai-glow-color,#38bdf8)_18%,transparent)] bg-[color-mix(in_srgb,var(--ai-glow-color,#38bdf8)_8%,transparent)] text-primary-text/85 hover:text-primary-text hover:border-[color-mix(in_srgb,var(--ai-glow-color,#38bdf8)_35%,transparent)] transition-all duration-200"
          >
            <Sparkles size={11} className="text-sky-400/70 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
            {s.label}
          </motion.button>
        ))}
      </div>
    </AIHomeCard>
  );
});

export default AISuggestionsWidget;
