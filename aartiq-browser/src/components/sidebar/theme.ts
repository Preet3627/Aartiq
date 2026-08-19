"use client";

import type { CSSProperties } from "react";
import { type SidebarPreferences, type Density, type BlurLevel, type RadiusLevel } from "./types";

/**
 * Single source of truth for sidebar visual tokens.
 *
 * The sidebar NEVER redefines colors. It derives every surface, border, text
 * and accent token from the global Aartiq theme variables (--card-bg,
 * --accent, --border-color, --primary-text, --secondary-text, …). That means
 * the sidebar automatically inherits Dark, Light, Vibrant, Custom, Minimal and
 * any future theme with zero extra work. The only sidebar-local adjustments
 * are structural: density padding, corner radius, frosted blur and a small
 * transparency range — all clamped so text stays readable.
 */

const DENSITY_PAD: Record<Density, string> = {
  compact: "8px",
  comfortable: "12px",
  spacious: "16px",
};

const DENSITY_GAP: Record<Density, string> = {
  compact: "8px",
  comfortable: "12px",
  spacious: "16px",
};

const RADIUS: Record<RadiusLevel, string> = {
  sharp: "6px",
  subtle: "12px",
  rounded: "18px",
};

const BLUR_PX: Record<BlurLevel, number> = {
  none: 0,
  subtle: 10,
  strong: 22,
};

/** surface opacity 100% → 82% across the transparency slider (readability-safe). */
function surfaceAlpha(transparency: number): number {
  const t = Math.min(1, Math.max(0, transparency));
  return Math.round((1 - t * 0.18) * 100);
}

export function sidebarRootStyle(prefs: SidebarPreferences): CSSProperties {
  const a = surfaceAlpha(prefs.transparency);
  const blurPx = BLUR_PX[prefs.blur];
  const accent = prefs.accent;

  const vars: Record<string, string> = {
    "--sb-pad": DENSITY_PAD[prefs.density],
    "--sb-gap": DENSITY_GAP[prefs.density],
    "--sb-radius": RADIUS[prefs.radius],
    "--sb-blur": `${blurPx}px`,
    "--sb-surface": `color-mix(in srgb, var(--card-bg) ${a}%, transparent)`,
    "--sb-surface-2": `color-mix(in srgb, var(--card-bg) ${Math.min(100, a + 6)}%, transparent)`,
    "--sb-elevated": `color-mix(in srgb, var(--navbar-bg, var(--card-bg)) ${Math.min(100, a + 4)}%, transparent)`,
    "--sb-border": `color-mix(in srgb, var(--border-color) 70%, transparent)`,
    "--sb-border-strong": `color-mix(in srgb, var(--border-color) 100%, transparent)`,
    "--sb-text": "var(--primary-text)",
    "--sb-muted": "var(--secondary-text)",
    "--sb-accent": accent || "var(--accent)",
    "--sb-accent-soft": accent
      ? `color-mix(in srgb, ${accent} 14%, transparent)`
      : "color-mix(in srgb, var(--accent) 14%, transparent)",
    "--sb-accent-line": accent
      ? `color-mix(in srgb, ${accent} 35%, var(--border-color))`
      : "color-mix(in srgb, var(--accent) 35%, transparent)",
    "--sb-success": "var(--success, #34d399)",
    "--sb-warning": "var(--warning, #fbbf24)",
    "--sb-error": "var(--error, #f87171)",
    "--sb-glow": accent
      ? `0 0 0 1px color-mix(in srgb, ${accent} 20%, transparent), 0 10px 30px color-mix(in srgb, ${accent} 8%, transparent)`
      : `0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent), 0 10px 30px color-mix(in srgb, var(--accent) 8%, transparent)`,
    "--sb-shadow": "var(--shadow-color, rgba(0,0,0,0.4))",
  };

  return {
    ...(vars as unknown as CSSProperties),
    width: `${prefs.width}px`,
    maxWidth: "100%",
    backdropFilter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
    WebkitBackdropFilter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
  };
}

export type AgentStateName =
  | "idle"
  | "working"
  | "thinking"
  | "waiting"
  | "paused"
  | "error"
  | "success";

export const AGENT_STATE_COLORS: Record<AgentStateName, string> = {
  idle: "var(--secondary-text)",
  working: "var(--accent)",
  thinking: "var(--accent-light, var(--accent))",
  waiting: "var(--warning, #fbbf24)",
  paused: "var(--warning, #fbbf24)",
  error: "var(--error, #f87171)",
  success: "var(--success, #34d399)",
};

export function agentStateColor(state: string): string {
  const map: Record<string, AgentStateName> = {
    idle: "idle",
    working: "working",
    executing: "working",
    planning: "thinking",
    thinking: "thinking",
    searching: "working",
    waiting: "waiting",
    paused: "paused",
    error: "error",
    failed: "error",
    finished: "success",
    success: "success",
    done: "success",
  };
  return AGENT_STATE_COLORS[map[state] ?? "idle"];
}

export function agentStateLabel(state: string): string {
  switch (state) {
    case "working":
    case "executing":
      return "Working";
    case "planning":
      return "Planning";
    case "thinking":
      return "Thinking";
    case "searching":
      return "Searching";
    case "waiting":
      return "Waiting";
    case "paused":
      return "Paused";
    case "error":
    case "failed":
      return "Error";
    case "finished":
    case "success":
    case "done":
      return "Done";
    default:
      return "Idle";
  }
}
