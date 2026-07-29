"use client";

import React, { memo, useMemo } from 'react';
import { Layers, Clock, Copy } from 'lucide-react';
import { AIHomeCard } from '../../home/AIHomeCard';
import {
  activeWorkspaceLabel,
  estimateReadingMinutes,
  findDuplicateTabs,
  groupTabsByTopic,
  type TabInfo,
} from '@/lib/homeIntelligence';

interface WorkspaceIntelligenceWidgetProps {
  tabs: TabInfo[];
  onAction?: (cmd: string) => void;
}

const WorkspaceIntelligenceWidget = memo(function WorkspaceIntelligenceWidget({
  tabs,
  onAction,
}: WorkspaceIntelligenceWidgetProps) {
  const groups = useMemo(() => groupTabsByTopic(tabs), [tabs]);
  const duplicates = useMemo(() => findDuplicateTabs(tabs), [tabs]);
  const readingMin = useMemo(() => estimateReadingMinutes(tabs), [tabs]);
  const workspace = useMemo(() => activeWorkspaceLabel(tabs), [tabs]);

  return (
    <AIHomeCard title="Workspace intelligence" subtitle={workspace} collapsible defaultExpanded>
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-[10px]">
          <span className="inline-flex items-center gap-1 text-secondary-text/55">
            <Clock size={11} /> ~{readingMin} min read
          </span>
          <span className="inline-flex items-center gap-1 text-secondary-text/55">
            <Layers size={11} /> {tabs.length} tabs
          </span>
        </div>

        <div className="space-y-2">
          {groups.slice(0, 4).map((g) => (
            <div key={g.topic} className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-primary-text/90">{g.topic}</span>
                <span className="text-[9px] font-mono text-secondary-text/40">{g.tabs.length}</span>
              </div>
              <div className="space-y-0.5">
                {g.tabs.slice(0, 3).map((t) => (
                  <div key={t.id} className="text-[10px] text-secondary-text/55 truncate">
                    {t.title || t.url}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {duplicates.length > 0 && (
          <button
            type="button"
            onClick={() => onAction?.('Close duplicate tabs and keep one of each URL')}
            className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[10px] border border-amber-500/20 bg-amber-500/8 text-amber-300/80 hover:bg-amber-500/12 transition-colors duration-200"
          >
            <Copy size={12} />
            {duplicates.length} duplicate URL{duplicates.length > 1 ? 's' : ''} detected
          </button>
        )}
      </div>
    </AIHomeCard>
  );
});

export default WorkspaceIntelligenceWidget;
