"use client";

import React, { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, Clock, PauseCircle, SkipForward } from "lucide-react";
import { useSidebarData } from "../SidebarContext";
import type { ActionChainStep } from "@/components/ai/ActionChainTimeline";

const nodeIcon = (status: ActionChainStep["status"]) => {
  switch (status) {
    case "running":
      return <Loader2 size={10} className="animate-spin" style={{ color: "var(--sb-accent)" }} />;
    case "done":
      return <CheckCircle2 size={10} style={{ color: "var(--sb-success)" }} />;
    case "error":
      return <PauseCircle size={10} style={{ color: "var(--sb-error)" }} />;
    case "skipped":
      return <SkipForward size={10} style={{ color: "var(--sb-warning)" }} />;
    default:
      return <Clock size={10} className="text-[var(--sb-muted)]/40" />;
  }
};

const AutomationMonitorWidget = memo(function AutomationMonitorWidget() {
  const { actionChainSteps, isWorking } = useSidebarData();
  const graph = useMemo(() => actionChainSteps.slice(-10), [actionChainSteps]);

  if (graph.length === 0 && !isWorking) {
    return (
      <p className="text-[11px] text-[var(--sb-muted)]/55 py-1">
        No automation running. Timelines appear here during agent execution.
      </p>
    );
  }

  const completed = graph.filter((s) => s.status === "done" || s.status === "error").length;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[9px] text-[var(--sb-muted)]/60">
        <span>{graph.length ? `${completed}/${graph.length} steps` : "Standing by"}</span>
        {isWorking && <span className="text-[var(--sb-accent)]">Running…</span>}
      </div>
      <div className="relative pl-1">
        <div
          className="absolute left-[10px] top-2 bottom-2 w-px"
          style={{ background: "linear-gradient(to bottom, var(--sb-accent), transparent)" }}
        />
        <ul className="space-y-1.5">
          {graph.map((step, idx) => (
            <motion.li
              key={step.id || idx}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03, duration: 0.2 }}
              className="relative flex items-center gap-2 pl-4"
            >
              <span className="absolute left-0 w-[20px] flex justify-center" aria-hidden="true">
                {nodeIcon(step.status)}
              </span>
              <span
                className="flex-1 rounded-lg px-2 py-1 text-[10px] border truncate"
                style={{
                  borderColor: "var(--sb-border)",
                  background: "color-mix(in srgb, var(--sb-text) 3%, transparent)",
                  color:
                    step.status === "error"
                      ? "var(--sb-error)"
                      : step.status === "running"
                        ? "var(--sb-accent)"
                        : "var(--sb-muted)",
                }}
              >
                {step.label}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
});

export default AutomationMonitorWidget;
