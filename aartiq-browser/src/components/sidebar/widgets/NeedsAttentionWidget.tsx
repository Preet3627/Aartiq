"use client";

import React, { memo } from "react";
import { ShieldAlert, KeyRound, HelpCircle, PauseCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { useSidebarData } from "../SidebarContext";
import type { AttentionType } from "../SidebarContext";

const TYPE_META: Record<AttentionType, { icon: React.ReactNode; color: string; bg: string }> = {
  permission: { icon: <ShieldAlert size={12} />, color: "var(--sb-warning)", bg: "color-mix(in srgb, var(--sb-warning) 12%, transparent)" },
  login: { icon: <KeyRound size={12} />, color: "var(--sb-warning)", bg: "color-mix(in srgb, var(--sb-warning) 12%, transparent)" },
  confirmation: { icon: <HelpCircle size={12} />, color: "var(--sb-accent)", bg: "var(--sb-accent-soft)" },
  paused: { icon: <PauseCircle size={12} />, color: "var(--sb-warning)", bg: "color-mix(in srgb, var(--sb-warning) 12%, transparent)" },
  failed: { icon: <AlertTriangle size={12} />, color: "var(--sb-error)", bg: "color-mix(in srgb, var(--sb-error) 12%, transparent)" },
  info: { icon: <HelpCircle size={12} />, color: "var(--sb-accent)", bg: "var(--sb-accent-soft)" },
};

const NeedsAttentionWidget = memo(function NeedsAttentionWidget() {
  const { needsAttention } = useSidebarData();

  if (needsAttention.length === 0) {
    return (
      <p className="text-[11px] text-[var(--sb-muted)]/50 py-1">
        Nothing needs your attention right now. Aartiq will flag permission, login and failure prompts here.
      </p>
    );
  }

  return (
    <div className="space-y-1.5" role="alert">
      {needsAttention.map((item) => {
        const meta = TYPE_META[item.type];
        return (
          <div
            key={item.id}
            className="flex items-start gap-2 rounded-lg border px-2.5 py-2"
            style={{ borderColor: meta.bg, background: meta.bg }}
          >
            <span className="mt-0.5 shrink-0" style={{ color: meta.color }} aria-hidden="true">
              {meta.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold" style={{ color: meta.color }}>
                {item.title}
              </div>
              {item.detail && (
                <p className="text-[10px] text-[var(--sb-muted)]/75 mt-0.5 leading-snug">{item.detail}</p>
              )}
              {item.actionLabel && item.onAction && (
                <button
                  type="button"
                  onClick={item.onAction}
                  className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold rounded-md px-2 py-1 transition-all hover:brightness-110"
                  style={{ background: meta.color, color: "#0b0b0f" }}
                >
                  {item.actionLabel} <ArrowRight size={10} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default NeedsAttentionWidget;
