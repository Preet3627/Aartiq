"use client";

import React, { memo } from "react";
import { CornerDownLeft, RefreshCw } from "lucide-react";

export interface BubbleSuggestion {
  id: string;
  label: string;
  command: string;
}

interface AISuggestionBubblesProps {
  autoSuggestions: BubbleSuggestion[];
  onAction: (command: string) => void;
  onRefresh?: () => void;
  loading?: boolean;
  max?: number;
}

const AISuggestionBubbles = memo(function AISuggestionBubbles({
  autoSuggestions,
  onAction,
  onRefresh,
  loading = false,
  max = 4,
}: AISuggestionBubblesProps) {
  const list = autoSuggestions.slice(0, max);
  if (list.length === 0 && !loading) return null;

  return (
    <div className="mx-auto flex w-full max-w-[650px] flex-col gap-1.5 pb-1">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-text/40">
          Suggested for you
        </span>
        {onRefresh && !loading && (
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-secondary-text/60 transition-colors hover:text-primary-text"
            title="Regenerate suggestions"
          >
            <RefreshCw size={11} /> Refresh
          </button>
        )}
      </div>

      {/* Loading skeletons — placeholder lines aligned one by one */}
      {loading && list.length === 0 && (
        <>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={`sk-${i}`}
              className="h-9 w-full animate-pulse rounded-xl bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </>
      )}

      {/* Generated suggestions — themed to the user's accent, aligned one by one */}
      {!loading &&
        list.map((s) => (
          <div
            key={s.id}
            className="group relative flex items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-3 py-2 text-[12.5px] font-medium text-[var(--primary-text)] shadow-[0_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all hover:brightness-110"
          >
            <span className="min-w-0 flex-1 truncate text-left">{s.label}</span>
            <button
              type="button"
              onClick={() => onAction(s.command)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white transition-transform group-hover:translate-x-0.5"
              title="Send"
            >
              <CornerDownLeft size={12} />
            </button>
          </div>
        ))}
    </div>
  );
});

export default AISuggestionBubbles;
