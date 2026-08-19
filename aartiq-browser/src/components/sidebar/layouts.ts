"use client";

import {
  type SidebarLayoutId,
  type SidebarPreferences,
  type SidebarWidgetState,
  type WidgetId,
  WIDGET_META,
} from "./types";

export interface LayoutPreset {
  id: SidebarLayoutId;
  label: string;
  description: string;
  /** widgets that should be enabled, in order (others disabled) */
  enabled: WidgetId[];
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: "focus",
    label: "Focus",
    description: "Just the task, live activity and anything needing you.",
    enabled: ["current-task", "live-activity", "needs-attention"],
  },
  {
    id: "research",
    label: "Research",
    description: "Workspace, memory and suggestions front and centre.",
    enabled: ["current-task", "workspace", "memory-insights", "ai-suggestions", "live-activity"],
  },
  {
    id: "automation",
    label: "Automation",
    description: "Keep the automation timeline and controls close.",
    enabled: ["current-task", "automation-monitor", "live-activity", "needs-attention"],
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Only the essentials: current task and your attention.",
    enabled: ["current-task", "needs-attention"],
  },
  {
    id: "custom",
    label: "Custom",
    description: "You decide every widget and its order.",
    enabled: (Object.keys(WIDGET_META) as WidgetId[]),
  },
];

export const LAYOUT_MAP: Record<SidebarLayoutId, LayoutPreset> = LAYOUT_PRESETS.reduce(
  (acc, l) => {
    acc[l.id] = l;
    return acc;
  },
  {} as Record<SidebarLayoutId, LayoutPreset>,
);

/**
 * Produce a new widget array for a chosen layout preset.
 * Order follows the preset; all listed widgets are enabled, the rest disabled
 * (always-available widgets stay enabled regardless). The result is a stable,
 * deduplicated list of every known widget.
 */
export function applyLayout(
  widgets: SidebarWidgetState[],
  layoutId: SidebarLayoutId,
): SidebarWidgetState[] {
  const preset = LAYOUT_MAP[layoutId];
  const enabledSet = new Set(preset.enabled);
  const byId = new Map(widgets.map((w) => [w.id, { ...w }]));

  const result: SidebarWidgetState[] = [];
  const seen = new Set<WidgetId>();

  for (const id of preset.enabled) {
    if (seen.has(id)) continue;
    seen.add(id);
    const existing = byId.get(id);
    result.push({
      id,
      enabled: true,
      collapsed: existing?.collapsed ?? false,
      size: existing?.size ?? WIDGET_META[id].defaultSize,
      pinned: existing?.pinned ?? WIDGET_META[id].defaultPinned ?? false,
    });
  }

  // Append any remaining (disabled) widgets in their previous relative order.
  for (const w of widgets) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    const meta = WIDGET_META[w.id];
    result.push({
      id: w.id,
      enabled: meta.alwaysAvailable ? true : false,
      collapsed: w.collapsed,
      size: w.size,
      pinned: w.pinned,
    });
  }

  return result;
}

export function layoutMatchesWidgets(widgets: SidebarWidgetState[], layoutId: SidebarLayoutId): boolean {
  const preset = LAYOUT_MAP[layoutId];
  const enabled = widgets.filter((w) => w.enabled).map((w) => w.id);
  if (enabled.length !== preset.enabled.length) return false;
  return preset.enabled.every((id, i) => enabled[i] === id);
}

export function deriveLayoutId(prefs: SidebarPreferences): SidebarLayoutId {
  for (const preset of LAYOUT_PRESETS) {
    if (layoutMatchesWidgets(prefs.widgets, preset.id)) return preset.id;
  }
  return "custom";
}
