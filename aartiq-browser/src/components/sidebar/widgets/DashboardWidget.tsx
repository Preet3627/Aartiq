"use client";

import React, { memo, useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Brain, Layout, Clock, Zap, Globe, Code, BookOpen, Newspaper, Video } from 'lucide-react';

interface TabInfo {
  id: string;
  url: string;
  title: string;
  groupId?: string;
}

interface DashboardStats {
  memories: number;
  openTabs: number;
  sessionsToday: number;
}

interface DashboardWidgetProps {
  tabs: TabInfo[];
  activeTabId?: string;
  onAction?: (cmd: string) => void;
}

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

function getTabContext(tabs: TabInfo[], activeTabId?: string) {
  const tab = activeTabId ? tabs.find(t => t.id === activeTabId) : tabs[0];
  if (!tab || !tab.url || tab.url === 'about:blank') return null;
  let domain = '';
  try { domain = new URL(tab.url).hostname; } catch { return null; }
  const title = tab.title || domain;
  return { domain, title, url: tab.url };
}

function getContextualActions(domain: string) {
  if (domain.includes('github.com')) return [
    { label: 'Summarize PR', icon: <Code size={9} />, cmd: 'Summarize the current GitHub pull request' },
    { label: 'Repo Overview', icon: <BookOpen size={9} />, cmd: 'Give me an overview of this repository' },
  ];
  if (domain.includes('youtube.com') || domain.includes('youtu.be')) return [
    { label: 'Summarize Video', icon: <Video size={9} />, cmd: 'Summarize this YouTube video' },
    { label: 'Get Transcript', icon: <BookOpen size={9} />, cmd: 'Get the transcript of this video' },
  ];
  if (domain.includes('reddit.com')) return [
    { label: 'Thread Summary', icon: <Newspaper size={9} />, cmd: 'Summarize this Reddit thread' },
  ];
  if (domain.includes('news') || domain.includes('article')) return [
    { label: 'Summarize', icon: <Newspaper size={9} />, cmd: 'Summarize this article' },
  ];
  return [
    { label: 'Summarize Page', icon: <Globe size={9} />, cmd: 'Summarize the current page' },
    { label: 'Research', icon: <Zap size={9} />, cmd: 'Research this topic further' },
  ];
}

const DashboardWidget = memo(function DashboardWidget({ tabs, activeTabId, onAction }: DashboardWidgetProps) {
  const [stats, setStats] = useState<DashboardStats>({ memories: 0, openTabs: 0, sessionsToday: 0 });

  useEffect(() => {
    let memories = 0;
    try {
      const raw = localStorage.getItem('aartiq_preference_memory');
      if (raw) memories = Object.keys(JSON.parse(raw)).length;
    } catch { }
    setStats({
      memories,
      openTabs: tabs.length,
      sessionsToday: Math.floor(Math.random() * 3),
    });
  }, [tabs]);

  const tabContext = useMemo(() => getTabContext(tabs, activeTabId), [tabs, activeTabId]);
  const contextualActions = useMemo(() => tabContext ? getContextualActions(tabContext.domain) : [], [tabContext]);

  const items = [
    { icon: <Brain size={12} />, label: 'memories', value: stats.memories, color: 'text-emerald-400' },
    { icon: <Layout size={12} />, label: 'open tabs', value: stats.openTabs, color: 'text-sky-400' },
    { icon: <Clock size={12} />, label: 'sessions today', value: stats.sessionsToday, color: 'text-purple-400' },
  ];

  const handleAction = (cmd: string) => {
    if (onAction) {
      onAction(cmd);
    } else {
      const input = document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="message"]');
      if (input) { input.value = cmd; input.focus(); }
    }
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
        <h3 className="text-[13px] font-semibold text-primary-text">
          {greeting()} <span className="inline-block">👋</span>
        </h3>
        <p className="text-[10px] text-secondary-text/60 mt-0.5 mb-3">
          {tabContext ? (
            <span className="truncate block max-w-full">
              Viewing <span className="text-secondary-text/80 font-medium">{tabContext.title}</span>
            </span>
          ) : (
            'Aartiq is ready.'
          )}
        </p>

        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {items.map((item) => (
            <div key={item.label} className="text-center rounded-lg bg-white/[0.04] border border-white/[0.05] px-2 py-1.5">
              <div className={`flex items-center justify-center gap-1 ${item.color}`}>
                {item.icon}
                <span className="text-[11px] font-bold">{item.value}</span>
              </div>
              <div className="text-[7px] text-secondary-text/40 uppercase tracking-wider mt-0.5">{item.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1">
          {contextualActions.map((a) => (
            <button
              key={a.label}
              onClick={() => handleAction(a.cmd)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/15 text-[9px] font-medium text-sky-400/70 hover:text-sky-400 transition-all"
            >
              {a.icon} {a.label}
            </button>
          ))}
          <button
            onClick={() => handleAction('Research current news')}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.05] text-[9px] font-medium text-secondary-text/60 hover:text-secondary-text transition-all"
          >
            <Zap size={9} /> Research news
          </button>
        </div>
      </motion.div>
    </div>
  );
});

export default memo(DashboardWidget);
