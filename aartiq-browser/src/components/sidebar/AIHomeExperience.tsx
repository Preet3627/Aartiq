"use client";

import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { WidgetId } from './types';
import type { ActionChainStep } from '@/components/ai/ActionChainTimeline';
import type { HistoryEntry, TabInfo } from '@/lib/homeIntelligence';
import CurrentContextWidget from './widgets/home/CurrentContextWidget';
import WorkspaceIntelligenceWidget from './widgets/home/WorkspaceIntelligenceWidget';
import AISuggestionsWidget from './widgets/home/AISuggestionsWidget';
import SessionResumeWidget from './widgets/home/SessionResumeWidget';
import AutomationMonitorWidget from './widgets/home/AutomationMonitorWidget';
import MemoryInsightsWidget from './widgets/home/MemoryInsightsWidget';
import AIHomeTimelineWidget from './widgets/home/AIHomeTimelineWidget';

export interface AIHomeExperienceProps {
  enabledWidgets: WidgetId[];
  widgetOrder: WidgetId[];
  tabs: TabInfo[];
  activeTabId?: string;
  history?: HistoryEntry[];
  actionSteps: ActionChainStep[];
  sessionLabel?: string;
  isWorking?: boolean;
  onAction: (cmd: string) => void;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const AIHomeExperience = memo(function AIHomeExperience({
  enabledWidgets,
  widgetOrder,
  tabs,
  activeTabId,
  history = [],
  actionSteps,
  sessionLabel = '',
  isWorking = false,
  onAction,
}: AIHomeExperienceProps) {
  const ordered = widgetOrder.filter((id) => enabledWidgets.includes(id));

  const renderWidget = (id: WidgetId) => {
    switch (id) {
      case 'current-context':
        return (
          <CurrentContextWidget
            tabs={tabs}
            activeTabId={activeTabId}
            sessionLabel={sessionLabel}
            isWorking={isWorking}
          />
        );
      case 'workspace-intelligence':
        return <WorkspaceIntelligenceWidget tabs={tabs} onAction={onAction} />;
      case 'ai-suggestions':
        return (
          <AISuggestionsWidget
            tabs={tabs}
            activeTabId={activeTabId}
            onAction={onAction}
            isWorking={isWorking}
          />
        );
      case 'session-resume':
        return <SessionResumeWidget history={history} onAction={onAction} />;
      case 'automation-monitor':
        return <AutomationMonitorWidget steps={actionSteps} isWorking={isWorking} />;
      case 'memory-insights':
        return (
          <MemoryInsightsWidget tabs={tabs} activeTabId={activeTabId} onAction={onAction} />
        );
      case 'ai-timeline':
        return <AIHomeTimelineWidget steps={actionSteps} isWorking={isWorking} />;
      default:
        return null;
    }
  };

  const sections: React.ReactNode[] = [];
  let scan = 0;
  while (scan < ordered.length) {
    const id = ordered[scan];
    const next = ordered[scan + 1];
    if (
      (id === 'ai-suggestions' && next === 'workspace-intelligence') ||
      (id === 'workspace-intelligence' && next === 'ai-suggestions')
    ) {
      sections.push(
        <div key={`pair-${id}-${next}`} className="grid grid-cols-1 gap-4">
          {id === 'ai-suggestions' ? renderWidget('ai-suggestions') : renderWidget('workspace-intelligence')}
          {next === 'ai-suggestions' ? renderWidget('ai-suggestions') : renderWidget('workspace-intelligence')}
        </div>,
      );
      scan += 2;
      continue;
    }
    const node = renderWidget(id);
    if (node) sections.push(<div key={id}>{node}</div>);
    scan += 1;
  }

  return (
    <div className="mx-auto w-full max-w-[650px] space-y-5 pb-2">
      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="px-1 pt-1"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl border border-white/[0.08] bg-white/[0.04] flex items-center justify-center">
            <Sparkles size={14} className="text-sky-400/80" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-primary-text">{greeting()}</h2>
            <p className="text-[10px] text-secondary-text/50">Your workspace, understood in real time</p>
          </div>
        </div>
      </motion.header>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTabId || 'home'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="space-y-4"
        >
          {sections}
        </motion.div>
      </AnimatePresence>
    </div>
  );
});

export default AIHomeExperience;
