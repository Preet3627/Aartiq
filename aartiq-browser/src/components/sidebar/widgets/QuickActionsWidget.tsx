"use client";

import React, { memo, useMemo } from 'react';
import { FileText, Download, Search, ScanLine, Rocket, Terminal, Globe, BookOpen, Code, Newspaper, Video, ShoppingCart } from 'lucide-react';

interface TabInfo {
  id: string;
  url: string;
  title: string;
  groupId?: string;
}

interface HistoryEntry {
  url: string;
  title: string;
  timestamp: number;
}

interface QuickActionsWidgetProps {
  onAction: (command: string) => void;
  tabs?: TabInfo[];
  activeTabId?: string;
  history?: HistoryEntry[];
}

const HARDCODED_ACTIONS = [
  { label: 'Organize Downloads', icon: <FileText size={12} />, cmd: 'Organize my Downloads folder' },
  { label: 'Generate PDF', icon: <Download size={12} />, cmd: 'Generate a PDF report' },
  { label: 'Research', icon: <Search size={12} />, cmd: 'Research latest AI news' },
  { label: 'Find Duplicates', icon: <ScanLine size={12} />, cmd: 'Find duplicate files in Downloads' },
  { label: 'Open VS Code', icon: <Rocket size={12} />, cmd: 'Open VS Code' },
  { label: 'Run Command', icon: <Terminal size={12} />, cmd: 'Run df -h in terminal' },
];

function getContextualActions(tabs: TabInfo[], activeTabId?: string, history?: HistoryEntry[]) {
  const suggestions: { label: string; icon: React.ReactNode; cmd: string }[] = [];

  const currentTab = activeTabId ? tabs.find(t => t.id === activeTabId) : tabs[0];
  const url = currentTab?.url || '';
  const domain = url ? (() => { try { return new URL(url).hostname; } catch { return ''; } })() : '';

  if (domain.includes('github.com')) {
    suggestions.push({ label: 'Summarize PR', icon: <Code size={12} />, cmd: 'Summarize the current GitHub pull request' });
    suggestions.push({ label: 'Repo Overview', icon: <BookOpen size={12} />, cmd: 'Give me an overview of this repository' });
  }
  if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
    suggestions.push({ label: 'Summarize Video', icon: <Video size={12} />, cmd: 'Summarize this YouTube video' });
    suggestions.push({ label: 'Get Transcript', icon: <FileText size={12} />, cmd: 'Get the transcript of this video' });
  }
  if (domain.includes('reddit.com')) {
    suggestions.push({ label: 'Thread Summary', icon: <Newspaper size={12} />, cmd: 'Summarize this Reddit thread' });
  }
  if (domain.includes('amazon.com') || domain.includes('ebay.com') || domain.includes('walmart.com')) {
    suggestions.push({ label: 'Product Summary', icon: <ShoppingCart size={12} />, cmd: 'Summarize this product page' });
  }
  if (domain.includes('news') || domain.includes('article') || domain.includes('blog')) {
    suggestions.push({ label: 'Summarize Article', icon: <Newspaper size={12} />, cmd: 'Summarize this article' });
  }
  if (url && !domain.includes('google.com')) {
    suggestions.push({ label: 'Summarize Page', icon: <Globe size={12} />, cmd: 'Summarize the current page' });
  }

  if (history && history.length > 0) {
    const recent = history.slice(-3);
    recent.forEach(entry => {
      if (entry.title && entry.title !== 'New Tab') {
        suggestions.push({
          label: `Continue: ${entry.title.slice(0, 24)}${entry.title.length > 24 ? '…' : ''}`,
          icon: <BookOpen size={12} />,
          cmd: `What was I reading about ${entry.title}?`,
        });
      }
    });
  }

  return suggestions;
}

const QuickActionsWidget = memo(function QuickActionsWidget({ onAction, tabs = [], activeTabId, history = [] }: QuickActionsWidgetProps) {
  const contextualActions = useMemo(() => getContextualActions(tabs, activeTabId, history), [tabs, activeTabId, history]);
  const showContextual = contextualActions.length > 0;

  return (
    <div className="space-y-1.5">
      {showContextual && (
        <div>
          <div className="text-[7px] font-bold uppercase tracking-wider text-secondary-text/30 mb-1 px-0.5">Based on your tab</div>
          <div className="grid grid-cols-2 gap-1">
            {contextualActions.slice(0, 4).map((a) => (
              <button
                key={a.label}
                onClick={() => onAction(a.cmd)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-sky-500/8 hover:bg-sky-500/15 border border-sky-500/15 hover:border-sky-500/30 text-[10px] font-medium text-sky-400/70 hover:text-sky-400 transition-all text-left"
              >
                <span className="text-sky-400/50 shrink-0">{a.icon}</span>
                <span className="truncate">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        {showContextual && <div className="text-[7px] font-bold uppercase tracking-wider text-secondary-text/30 mb-1 px-0.5">General</div>}
        <div className="grid grid-cols-2 gap-1">
          {HARDCODED_ACTIONS.map((a) => (
            <button
              key={a.label}
              onClick={() => onAction(a.cmd)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.05] hover:border-sky-500/20 text-[10px] font-medium text-secondary-text/70 hover:text-secondary-text transition-all text-left"
            >
              <span className="text-secondary-text/60 shrink-0">{a.icon}</span>
              <span className="truncate">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

export default memo(QuickActionsWidget);
