"use client";

import React, { memo, useState } from "react";
import { ShieldQuestion, RotateCcw } from "lucide-react";
import { useSidebarData } from "./SidebarContext";
import { useSidebarPrefs } from "./useSidebarPrefs";
import {
  buildResumeItems,
  type HistoryEntry,
} from "@/lib/homeIntelligence";

export interface Suggestion {
  label: string;
  command: string;
  hint?: string;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Derive repetitive-task suggestions from history (no active page needed). */
export function historySuggestions(history: HistoryEntry[]): Suggestion[] {
  if (!history.length) return [];
  const out: Suggestion[] = [];

  const resumes = buildResumeItems(history, []).map((r) => ({ label: r.title, command: r.command, hint: r.subtitle }));
  out.push(...resumes);

  const byDomain = new Map<string, number>();
  history.forEach((h) => {
    const d = domainOf(h.url);
    if (d) byDomain.set(d, (byDomain.get(d) ?? 0) + 1);
  });
  const newsish = ["news", "nytimes", "bbc", "cnn", "reuters", "theverge", "techcrunch"];
  let sawNews = false;
  Array.from(byDomain.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .forEach(([domain, count]) => {
      if (newsish.some((n) => domain.includes(n))) sawNews = true;
      if (count >= 2) {
        out.push({
          label: `Reopen ${domain}`,
          command: `Open ${domain} in a new tab`,
          hint: `You visit this ${count} times`,
        });
      }
    });

  if (sawNews) {
    out.push({ label: "Search for news", command: "Search for the latest news and summarize the top stories" });
  }

  return out.slice(0, 6);
}

export const GENERIC_SUGGESTIONS: Suggestion[] = [
  { label: "What can you do?", command: "What can Aartiq help me with right now?" },
  { label: "Search for news", command: "Search for the latest news and give me a brief summary" },
  { label: "Summarize a page", command: "Summarize the page I'm currently viewing" },
  { label: "Organize tabs", command: "Organize my open tabs by topic" },
  { label: "Plan my day", command: "Plan my day based on my open tabs and recent activity" },
];

const AISuggestionsHome = memo(function AISuggestionsHome() {
  useSidebarData();
  const sidebar = useSidebarPrefs();
  const permission = sidebar.prefs.historySuggestions;

  const [granted, setGranted] = useState<boolean>(permission === "always");
  const [dismissed, setDismissed] = useState<boolean>(false);

  const showPermission = permission === "ask" && !granted && !dismissed;

  return (
    <div className="w-full flex flex-col gap-4 py-2">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl">
          <img
            src="/logo-transparent.png"
            alt="Aartiq"
            className="h-7 w-7 object-contain"
            draggable={false}
          />
        </div>
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-[var(--sb-text)] leading-tight">
            How can Aartiq help?
          </h3>
          <p className="text-[11px] text-[var(--sb-muted)]/70 mt-0.5 leading-snug">
            Pick a starting point, or just ask anything.
          </p>
        </div>
      </div>

      {showPermission && (
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--sb-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--sb-accent)_8%,transparent)] p-3">
          <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--sb-text)]">
            <ShieldQuestion size={14} className="text-[var(--sb-accent)]" />
            Personalize with your history?
          </div>
          <p className="text-[10.5px] text-[var(--sb-muted)]/70 mt-1 leading-snug">
            Aartiq can suggest prompts from your past browsing and repetitive tasks. It asks
            every time before reading history.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                sidebar.setHistorySuggestions("always");
                setGranted(true);
              }}
              className="rounded-lg bg-[var(--sb-accent)] px-2.5 py-1.5 text-[10.5px] font-semibold text-white hover:brightness-110 transition-all"
            >
              Allow always
            </button>
            <button
              type="button"
              onClick={() => setGranted(true)}
              className="rounded-lg border border-[color-mix(in_srgb,var(--sb-accent)_30%,transparent)] px-2.5 py-1.5 text-[10.5px] font-medium text-[var(--sb-accent)] hover:bg-[color-mix(in_srgb,var(--sb-accent)_12%,transparent)] transition-all"
            >
              Only this time
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-lg px-2.5 py-1.5 text-[10.5px] font-medium text-[var(--sb-muted)]/80 hover:bg-white/5 transition-all"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {permission === "never" && (
        <p className="flex items-center gap-1.5 text-[10px] text-[var(--sb-muted)]/60">
          <RotateCcw size={10} /> History suggestions are off. Enable them in Settings → Sidebar.
        </p>
      )}
    </div>
  );
});

export default AISuggestionsHome;
