"use client";

import React, { memo, useMemo } from 'react';
import { FileText, Search, Layout, Layers, Globe, Code, Newspaper, Video, ShoppingCart } from 'lucide-react';

interface TabInfo {
  id: string;
  url: string;
  title: string;
  groupId?: string;
  isLoading?: boolean;
}

interface TabIntelligenceWidgetProps {
  tabs: TabInfo[];
  setInputMessage?: (msg: string) => void;
}

const domainIcon = (hostname: string) => {
  if (hostname.includes('github') || hostname.includes('gitlab')) return <Code size={9} className="text-purple-400/60" />;
  if (hostname.includes('youtube') || hostname.includes('twitch') || hostname.includes('vimeo')) return <Video size={9} className="text-red-400/60" />;
  if (hostname.includes('news') || hostname.includes('nyt') || hostname.includes('cnn') || hostname.includes('bbc') || hostname.includes('medium')) return <Newspaper size={9} className="text-amber-400/60" />;
  if (hostname.includes('amazon') || hostname.includes('ebay') || hostname.includes('walmart') || hostname.includes('shop')) return <ShoppingCart size={9} className="text-emerald-400/60" />;
  return <Globe size={9} className="text-sky-400/60" />;
};

const TabIntelligenceWidget = memo(function TabIntelligenceWidget({
  tabs,
  setInputMessage,
}: TabIntelligenceWidgetProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, { tabs: TabInfo[]; hostname: string }>();
    tabs.forEach(tab => {
      let hostname = '';
      try { hostname = new URL(tab.url).hostname.replace(/^www\./, ''); } catch { hostname = tab.url || 'unknown'; }
      const key = hostname || 'other';
      if (!map.has(key)) map.set(key, { tabs: [], hostname });
      map.get(key)!.tabs.push(tab);
    });
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b.tabs.length - a.tabs.length);
  }, [tabs]);

  const loadingCount = useMemo(() => tabs.filter(t => t.isLoading).length, [tabs]);

  if (tabs.length === 0) {
    return (
      <div className="text-center py-4">
        <Layers size={18} className="mx-auto mb-1.5 text-secondary-text/30" />
        <p className="text-[10px] text-secondary-text/50">No open tabs</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[9px] font-bold text-secondary-text/60">{tabs.length} tab{tabs.length !== 1 ? 's' : ''}</span>
        {loadingCount > 0 && (
          <span className="text-[8px] text-sky-400/50 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-sky-400 animate-pulse" />
            {loadingCount} loading
          </span>
        )}
      </div>

      {/* Quick actions row */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setInputMessage?.('Summarize all open tabs')}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06] text-[9px] font-medium text-secondary-text/70 hover:text-secondary-text transition-all"
        >
          <FileText size={10} /> Summarize all
        </button>
        <button
          onClick={() => setInputMessage?.('Search across all my open tabs')}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06] text-[9px] font-medium text-secondary-text/70 hover:text-secondary-text transition-all"
        >
          <Search size={10} /> Find in tabs
        </button>
        <button
          onClick={() => setInputMessage?.('Organize my open tabs into groups by domain')}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06] text-[9px] font-medium text-secondary-text/70 hover:text-secondary-text transition-all"
        >
          <Layout size={10} /> Organize
        </button>
      </div>

      {/* Domain-grouped tabs */}
      <div className="space-y-1.5">
        {grouped.map(([domain, { tabs: groupTabs, hostname }]) => {
          const hasLoading = groupTabs.some(t => t.isLoading);
          return (
            <div key={domain}>
              <div className="flex items-center gap-1 mb-0.5 group">
                {domainIcon(hostname)}
                <span className="text-[8px] font-bold uppercase tracking-wider text-secondary-text/50 truncate">{hostname}</span>
                {hasLoading && <span className="w-1 h-1 rounded-full bg-sky-400 animate-pulse shrink-0" />}
                <span className="text-[7px] text-secondary-text/30 font-mono ml-auto">{groupTabs.length}</span>
              </div>
              <div className="space-y-0.5">
                {groupTabs.slice(0, 5).map((tab) => {
                  let hostname = '';
                  try { hostname = new URL(tab.url).hostname.replace(/^www\./, ''); } catch { hostname = tab.url; }
                  return (
                    <div key={tab.id} className="flex items-center gap-1.5 text-[9px] pl-1">
                      {tab.isLoading ? (
                        <span className="w-1 h-1 rounded-full bg-sky-400 animate-pulse shrink-0" />
                      ) : (
                        <span className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
                      )}
                      <span className="truncate text-secondary-text/60 flex-1">{tab.title || hostname}</span>
                      <button
                        onClick={() => setInputMessage?.(`Summarize the tab "${tab.title || hostname}"`)}
                        className="text-secondary-text/20 hover:text-sky-400/60 shrink-0 opacity-0 group-hover:opacity-100 transition-all"
                        title="Summarize this tab"
                      >
                        <FileText size={8} />
                      </button>
                    </div>
                  );
                })}
                {groupTabs.length > 5 && (
                  <div className="text-[8px] text-secondary-text/30 pl-1.5">
                    +{groupTabs.length - 5} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default memo(TabIntelligenceWidget);
