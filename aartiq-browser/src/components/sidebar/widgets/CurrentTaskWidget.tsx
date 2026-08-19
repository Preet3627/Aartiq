"use client";

import React, { memo, useMemo } from "react";
import { Pause, Play, Square, Loader2 } from "lucide-react";
import { useSidebarData } from "../SidebarContext";
import { agentStateColor, agentStateLabel } from "../theme";

const CurrentTaskWidget = memo(function CurrentTaskWidget() {
  const { agentState, currentTask, progress, isPaused, onPause, onResume, onStop, isWorking } =
    useSidebarData();

  const color = agentStateColor(agentState);
  const label = agentStateLabel(agentState);
  const pct = useMemo(() => {
    if (typeof progress !== "number" || Number.isNaN(progress)) return null;
    return Math.round(Math.min(1, Math.max(0, progress)) * 100);
  }, [progress]);

  const showControls = Boolean(onPause || onResume || onStop);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="relative flex h-2.5 w-2.5 shrink-0"
          aria-hidden="true"
        >
          {(agentState === "working" || agentState === "thinking") && (
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
              style={{ background: color }}
            />
          )}
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        </span>
        <span className="text-[12px] font-semibold" style={{ color }}>
          {label}
        </span>
        {isWorking && <Loader2 size={12} className="animate-spin text-[var(--sb-muted)]/60" />}
      </div>

      <p className="text-[13px] leading-snug text-[var(--sb-text)]">
        {currentTask || "No active task. Ask Aartiq to do something."}
      </p>

      {pct !== null && (
        <div>
          <div className="flex items-center justify-between text-[9px] text-[var(--sb-muted)]/70 mb-1">
            <span>Progress</span>
            <span className="font-mono tabular-nums">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[color-mix(in_srgb,var(--sb-text)_8%,transparent)] overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-300 ease-[var(--ease-spring)]"
              style={{ width: `${pct}%`, background: color }}
            />
          </div>
        </div>
      )}

      {showControls && (
        <div className="flex items-center gap-2 pt-0.5">
          {isPaused ? (
            <button
              type="button"
              onClick={onResume}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--sb-accent-soft)] text-[var(--sb-accent)] hover:brightness-110 transition-all"
            >
              <Play size={11} /> Resume
            </button>
          ) : (
            <button
              type="button"
              onClick={onPause}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-[color-mix(in_srgb,var(--sb-text)_6%,transparent)] text-[var(--sb-text)] hover:bg-[color-mix(in_srgb,var(--sb-text)_12%,transparent)] transition-all"
            >
              <Pause size={11} /> Pause
            </button>
          )}
          {onStop && (
            <button
              type="button"
              onClick={onStop}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-[color-mix(in_srgb,var(--sb-error)_12%,transparent)] text-[var(--sb-error)] hover:brightness-110 transition-all"
            >
              <Square size={10} /> Stop
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export default CurrentTaskWidget;
