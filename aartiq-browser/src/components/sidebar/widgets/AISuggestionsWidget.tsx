"use client";

import React, { memo, useMemo } from "react";
import { Sparkles, ArrowUpRight } from "lucide-react";
import { useSidebarData } from "../SidebarContext";
import { buildContextSuggestions, parsePageContext, type TabInfo } from "@/lib/homeIntelligence";

const AISuggestionsWidget = memo(function AISuggestionsWidget() {
  const { tabs, activeTabId, onAction, isWorking } = useSidebarData();

  const suggestions = useMemo<Array<Record<string, any>>>(() => {
    if (isWorking) return [];
    try {
      const ctx = parsePageContext(tabs as TabInfo[], activeTabId);
      return (buildContextSuggestions(ctx, (tabs as TabInfo[]).length) as unknown as Array<Record<string, any>>).slice(0, 6);
    } catch {
      return [];
    }
  }, [tabs, activeTabId, isWorking]);

  if (suggestions.length === 0) {
    return (
      <p className="text-[11px] text-[var(--sb-muted)]/55 py-1">
        Contextual suggestions will appear based on the current page and task.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {suggestions.map((s, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onAction(String(s.command ?? s.label ?? s))}
          className="group flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--sb-accent)_22%,transparent)] bg-[var(--sb-accent-soft)] px-2.5 py-1 text-[10px] font-medium text-[var(--sb-accent)] hover:brightness-110 transition-all"
          title={s.description ?? s.label ?? s.command ?? ""}
        >
          <Sparkles size={9} className="opacity-70" />
          <span className="truncate max-w-[140px]">{s.label ?? s}</span>
          <ArrowUpRight size={9} className="opacity-0 group-hover:opacity-70 transition-opacity" />
        </button>
      ))}
    </div>
  );
});

export default AISuggestionsWidget;
