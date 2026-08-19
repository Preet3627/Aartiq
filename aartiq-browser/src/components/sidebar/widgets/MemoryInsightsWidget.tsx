"use client";

import React, { memo, useMemo } from "react";
import { Brain, Check, History } from "lucide-react";
import { useSidebarData } from "../SidebarContext";
import {
  filterRelevantMemories,
  loadMemories,
  parsePageContext,
  type TabInfo,
} from "@/lib/homeIntelligence";

const MemoryInsightsWidget = memo(function MemoryInsightsWidget() {
  const { tabs, activeTabId } = useSidebarData();

  const { preferences, relevant } = useMemo(() => {
    const ctx = parsePageContext(tabs as TabInfo[], activeTabId);
    const all = loadMemories();
    return {
      preferences: all.filter((m) => m.category === "preference").slice(0, 3),
      relevant: filterRelevantMemories(all, ctx).slice(0, 4),
    };
  }, [tabs, activeTabId]);

  if (preferences.length === 0 && relevant.length === 0) {
    return (
      <div className="text-center py-2">
        <Brain size={16} className="mx-auto mb-1 text-[var(--sb-muted)]/40" />
        <p className="text-[10px] text-[var(--sb-muted)]/50">No memories yet</p>
        <p className="text-[9px] text-[var(--sb-muted)]/30 mt-0.5">Learned as you use Aartiq</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {relevant.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-wider text-[var(--sb-muted)]/45 mb-1">
            Relevant now
          </div>
          <ul className="space-y-1">
            {relevant.map((m, i) => (
              <li key={i} className="text-[10px] text-[var(--sb-muted)]/80 truncate">{m.value}</li>
            ))}
          </ul>
        </div>
      )}
      {preferences.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-wider text-[var(--sb-muted)]/45 mb-1 flex items-center gap-1">
            <History size={9} /> Preferences
          </div>
          <ul className="space-y-1">
            {preferences.map((m, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[10px]">
                <Check size={9} className="mt-0.5 text-[var(--sb-success)]/80 shrink-0" />
                <span className="text-[var(--sb-muted)]/75">
                  {m.key.replace(/_/g, " ")}: <span className="text-[var(--sb-text)]/90">{m.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});

export default MemoryInsightsWidget;
