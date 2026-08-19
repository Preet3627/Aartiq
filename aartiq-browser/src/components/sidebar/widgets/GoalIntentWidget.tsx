"use client";

import React, { memo } from "react";
import { Target, ChevronDown } from "lucide-react";
import { useSidebarData } from "../SidebarContext";

const GoalIntentWidget = memo(function GoalIntentWidget() {
  const { goal, sessionLabel } = useSidebarData();

  const text = goal?.text || sessionLabel || "";
  const confidence = goal?.confidence;
  const constraints = goal?.constraints ?? [];

  if (!text) {
    return (
      <p className="text-[11px] text-[var(--sb-muted)]/55 py-1">
        Aartiq will infer your goal as the conversation develops.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 rounded-lg bg-[color-mix(in_srgb,var(--sb-accent)_8%,transparent)] border border-[color-mix(in_srgb,var(--sb-accent)_18%,transparent)] px-2.5 py-2">
        <Target size={13} className="text-[var(--sb-accent)] mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-[12px] leading-snug text-[var(--sb-text)]">{text}</p>
      </div>

      {typeof confidence === "number" && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-wider text-[var(--sb-muted)]/50">Confidence</span>
          <div className="flex-1 h-1 rounded-full bg-[color-mix(in_srgb,var(--sb-text)_8%,transparent)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--sb-accent)]"
              style={{ width: `${Math.round(Math.min(1, Math.max(0, confidence)) * 100)}%` }}
            />
          </div>
          <span className="text-[9px] font-mono text-[var(--sb-muted)]/70">
            {Math.round(confidence * 100)}%
          </span>
        </div>
      )}

      {constraints.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-[var(--sb-muted)]/50 mb-1">
            <ChevronDown size={9} /> Constraints
          </div>
          <ul className="space-y-0.5">
            {constraints.slice(0, 4).map((c, i) => (
              <li key={i} className="text-[10px] text-[var(--sb-muted)]/80 truncate">• {c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});

export default GoalIntentWidget;
