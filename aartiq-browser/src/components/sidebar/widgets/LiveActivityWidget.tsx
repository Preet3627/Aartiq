"use client";

import React, { memo, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Search, Globe, BookOpen, FileText, Brain, Cpu, Play, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useSidebarData } from "../SidebarContext";
import type { ActionChainStep } from "@/components/ai/ActionChainTimeline";

const ACTIVITY_META: Record<string, { icon: React.ReactNode; color: string }> = {
  searching: { icon: <Search size={11} />, color: "var(--sb-accent)" },
  navigating: { icon: <Globe size={11} />, color: "var(--sb-accent)" },
  reading: { icon: <BookOpen size={11} />, color: "var(--sb-accent-light, var(--sb-accent))" },
  extracting: { icon: <FileText size={11} />, color: "var(--sb-accent-light, var(--sb-accent))" },
  thinking: { icon: <Brain size={11} />, color: "var(--sb-accent-light, var(--sb-accent))" },
  executing: { icon: <Cpu size={11} />, color: "var(--sb-accent)" },
  waiting: { icon: <Clock size={11} />, color: "var(--sb-warning)" },
  completed: { icon: <CheckCircle2 size={11} />, color: "var(--sb-success)" },
  failed: { icon: <XCircle size={11} />, color: "var(--sb-error)" },
};

function classifyStep(step: ActionChainStep): keyof typeof ACTIVITY_META {
  const label = step.label.toLowerCase();
  if (step.status === "error") return "failed";
  if (step.status === "done") return "completed";
  if (step.status === "pending") return "waiting";
  if (label.includes("search")) return "searching";
  if (label.includes("navigat") || label.includes("open") || label.includes("goto")) return "navigating";
  if (label.includes("extract") || label.includes("scrap")) return "extracting";
  if (label.includes("read")) return "reading";
  if (label.includes("think")) return "thinking";
  return "executing";
}

interface ActivityItem {
  key: string;
  kind: keyof typeof ACTIVITY_META;
  label: string;
  status: ActionChainStep["status"];
}

const LiveActivityWidget = memo(function LiveActivityWidget() {
  const { actionChainSteps, agentState } = useSidebarData();
  const [expanded, setExpanded] = useState(false);

  const items = useMemo<ActivityItem[]>(() => {
    const base = actionChainSteps.map((s, i) => ({
      key: s.id || `s-${i}`,
      kind: classifyStep(s),
      label: s.label,
      status: s.status,
    }));
    if (agentState === "thinking") {
      base.push({ key: "thinking-now", kind: "thinking", label: "Thinking…", status: "running" });
    }
    return base.slice(-12).reverse();
  }, [actionChainSteps, agentState]);

  if (items.length === 0) {
    return (
      <p className="text-[11px] text-[var(--sb-muted)]/55 py-1">
        No recent activity. Actions will appear here as Aartiq works.
      </p>
    );
  }

  const visible = expanded ? items : items.slice(0, 4);

  return (
    <div className="space-y-1.5">
      <ul className="space-y-1" aria-live="polite">
        {visible.map((it) => {
          const meta = ACTIVITY_META[it.kind];
          const spin = it.status === "running" ? "animate-spin" : "";
          return (
            <li key={it.key} className="flex items-center gap-2 text-[11px]">
              <span className={`shrink-0 ${spin}`} style={{ color: meta.color }} aria-hidden="true">
                {meta.icon}
              </span>
              <span className="flex-1 truncate text-[var(--sb-text)]/90">{it.label}</span>
              <span className="text-[8px] uppercase tracking-wider text-[var(--sb-muted)]/40 shrink-0">
                {it.kind}
              </span>
            </li>
          );
        })}
      </ul>
      {items.length > 4 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[var(--sb-accent)]/80 hover:text-[var(--sb-accent)] transition-colors"
          aria-expanded={expanded}
        >
          <ChevronDown size={10} className={expanded ? "rotate-180" : ""} />
          {expanded ? "Show less" : `Show ${items.length - 4} more`}
        </button>
      )}
    </div>
  );
});

export default LiveActivityWidget;
