"use client";

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Reorder, motion } from "framer-motion";
import {
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
  X,
  Check,
  ChevronUp,
  ChevronDown,
  Pin,
  Layers,
} from "lucide-react";
import {
  WIDGET_META,
  DEFAULT_SIDEBAR_PREFERENCES,
  MIN_WIDTH,
  MAX_WIDTH,
  type SidebarPreferences,
  type SidebarLayoutId,
  type WidgetId,
  type ThemeId,
  type Density,
  type BlurLevel,
  type RadiusLevel,
  type WidgetSize,
} from "./types";
import { LAYOUT_PRESETS, applyLayout, deriveLayoutId } from "./layouts";

const THEME_OPTIONS: { id: ThemeId; label: string; preview: string }[] = [
  { id: "dark", label: "Dark", preview: "linear-gradient(135deg,#010103,#050508)" },
  { id: "light", label: "Light", preview: "linear-gradient(135deg,#FAFAFE,#FFFFFF)" },
  { id: "system", label: "System", preview: "linear-gradient(135deg,#020204,#F8FAFC)" },
  { id: "vibrant", label: "Vibrant", preview: "linear-gradient(135deg,#040209,#0C0816)" },
  { id: "custom", label: "Custom", preview: "linear-gradient(135deg,#8B5CF6,#06B6D4)" },
  { id: "minimal", label: "Minimal", preview: "linear-gradient(135deg,#030305,#0A0C10)" },
];

const ACCENT_PRESETS = ["#38bdf8", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#a3e635"];

const DENSITY_OPTIONS: { id: Density; label: string }[] = [
  { id: "compact", label: "Compact" },
  { id: "comfortable", label: "Comfortable" },
  { id: "spacious", label: "Spacious" },
];

const BLUR_OPTIONS: { id: BlurLevel; label: string }[] = [
  { id: "none", label: "None" },
  { id: "subtle", label: "Subtle" },
  { id: "strong", label: "Strong" },
];

const RADIUS_OPTIONS: { id: RadiusLevel; label: string }[] = [
  { id: "sharp", label: "Sharp" },
  { id: "subtle", label: "Subtle" },
  { id: "rounded", label: "Rounded" },
];

const SIZE_CYCLE: Record<WidgetSize, WidgetSize> = { small: "medium", medium: "large", large: "small" };

export interface CustomizationPanelProps {
  initialPrefs: SidebarPreferences;
  initialGlobalTheme: ThemeId;
  onPreview: (prefs: SidebarPreferences) => void;
  onApply: (prefs: SidebarPreferences) => void;
  onClose: () => void;
  setGlobalTheme: (theme: ThemeId) => void;
}

const CustomizationPanel = memo(function CustomizationPanel({
  initialPrefs,
  initialGlobalTheme,
  onPreview,
  onApply,
  onClose,
  setGlobalTheme,
}: CustomizationPanelProps) {
  const [draft, setDraft] = useState<SidebarPreferences>(() => ({ ...initialPrefs }));
  const [tab, setTab] = useState<"layout" | "widgets" | "appearance">("layout");
  const [mounted, setMounted] = useState(false);
  const initialRef = useRef(initialPrefs);
  const appliedRef = useRef(false);

  useEffect(() => setMounted(true), []);
  useEffect(
    () => () => {
      if (!appliedRef.current) setGlobalTheme(initialGlobalTheme);
    },
    [initialGlobalTheme, setGlobalTheme],
  );

  const update = useCallback(
    (next: SidebarPreferences) => {
      setDraft(next);
      onPreview(next);
    },
    [onPreview],
  );

  const previewTheme = useCallback(
    (theme: ThemeId) => {
      setGlobalTheme(theme);
      update({ ...draft, theme });
    },
    [draft, setGlobalTheme, update],
  );

  const setLayout = useCallback(
    (id: SidebarLayoutId) => {
      const next = { ...draft, layout: id, widgets: applyLayout(draft.widgets, id) };
      update(next);
    },
    [draft, update],
  );

  const toggleWidget = useCallback(
    (id: WidgetId) => {
      const next = {
        ...draft,
        widgets: draft.widgets.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)),
      };
      next.layout = deriveLayoutId(next);
      update(next);
    },
    [draft, update],
  );

  const setCollapsed = useCallback(
    (id: WidgetId, collapsed: boolean) => {
      update({ ...draft, widgets: draft.widgets.map((w) => (w.id === id ? { ...w, collapsed } : w)) });
    },
    [draft, update],
  );

  const setSize = useCallback(
    (id: WidgetId, size: WidgetSize) => {
      update({ ...draft, widgets: draft.widgets.map((w) => (w.id === id ? { ...w, size } : w)) });
    },
    [draft, update],
  );

  const setPinned = useCallback(
    (id: WidgetId, pinned: boolean) => {
      update({ ...draft, widgets: draft.widgets.map((w) => (w.id === id ? { ...w, pinned } : w)) });
    },
    [draft, update],
  );

  const reorderEnabled = useCallback(
    (newOrder: string[]) => {
      const enabledSet = new Set(newOrder);
      const reordered: typeof draft.widgets = [];
      newOrder.forEach((id) => {
        const w = draft.widgets.find((x) => x.id === id);
        if (w) reordered.push({ ...w, enabled: true });
      });
      draft.widgets.forEach((w) => {
        if (!enabledSet.has(w.id)) reordered.push(w);
      });
      update({ ...draft, widgets: reordered, layout: "custom" });
    },
    [draft, update],
  );

  const moveWidget = useCallback(
    (index: number, dir: -1 | 1) => {
      const ordered = draft.widgets.filter((w) => w.enabled);
      if (index < 0 || index >= ordered.length) return;
      const target = index + dir;
      if (target < 0 || target >= ordered.length) return;
      const ids = ordered.map((w) => w.id);
      [ids[index], ids[target]] = [ids[target], ids[index]];
      reorderEnabled(ids);
    },
    [draft, reorderEnabled],
  );

  const resetDefaults = useCallback(() => {
    const next = { ...DEFAULT_SIDEBAR_PREFERENCES, theme: initialRef.current.theme, accent: initialRef.current.accent };
    update(next);
  }, [update]);

  const apply = useCallback(() => {
    appliedRef.current = true;
    onApply(draft);
    onClose();
  }, [draft, onApply, onClose]);

  const cancel = useCallback(() => {
    setGlobalTheme(initialGlobalTheme);
    onPreview(initialRef.current);
    onClose();
  }, [initialGlobalTheme, initialRef.current, onPreview, onClose, setGlobalTheme]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initialRef.current),
    [draft],
  );

  const enabledWidgets = useMemo(() => draft.widgets.filter((w) => w.enabled), [draft.widgets]);
  const disabledWidgets = useMemo(() => draft.widgets.filter((w) => !w.enabled), [draft.widgets]);

  if (!mounted || typeof document === "undefined") return null;

  const panel = (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Customize Workspace"
      onKeyDown={(e) => {
        if (e.key === "Escape") cancel();
      }}
    >
      {/* Single dim + mild blur layer. The panel itself is opaque so we never
          stack backdrop-filters (the old blur/darkness bug). */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
        onClick={cancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
        className="relative w-full max-w-md max-h-[88vh] flex flex-col rounded-2xl border overflow-hidden shadow-2xl"
        style={{
          background: "color-mix(in srgb, var(--card-bg) 98%, transparent)",
          borderColor: "color-mix(in srgb, var(--border-color) 55%, transparent)",
          color: "var(--primary-text)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "color-mix(in srgb, var(--border-color) 45%, transparent)" }}>
          <div className="flex items-center gap-2">
            <Layers size={15} style={{ color: "var(--accent)" }} />
            <h3 className="text-[12px] font-bold uppercase tracking-widest" style={{ color: "var(--primary-text)" }}>Customize Workspace</h3>
          </div>
          <button
            onClick={cancel}
            className="p-1.5 rounded-lg hover:bg-[color-mix(in_srgb,var(--primary-text)_10%,transparent)] transition-colors"
            style={{ color: "color-mix(in srgb, var(--secondary-text) 70%, transparent)" }}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 pt-3" role="tablist">
          {(["layout", "widgets", "appearance"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
              style={{
                background: tab === t ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "transparent",
                color: tab === t ? "var(--accent)" : "color-mix(in srgb, var(--secondary-text) 70%, transparent)",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="px-4 py-3 overflow-y-auto modern-scrollbar flex-1">
          {tab === "layout" && (
            <div className="space-y-2">
              <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: "color-mix(in srgb, var(--secondary-text) 60%, transparent)" }}>Quick Layout</p>
              <div className="grid grid-cols-1 gap-1.5">
                {LAYOUT_PRESETS.map((l) => {
                  const active = draft.layout === l.id;
                  return (
                    <button
                      key={l.id}
                      onClick={() => setLayout(l.id)}
                      className="flex items-center justify-between text-left px-3 py-2 rounded-xl border transition-all"
                      style={{
                        borderColor: active ? "var(--accent)" : "color-mix(in srgb, var(--border-color) 45%, transparent)",
                        background: active ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent",
                      }}
                      aria-pressed={active}
                    >
                      <div>
                        <div className="text-[12px] font-semibold" style={{ color: "var(--primary-text)" }}>{l.label}</div>
                        <div className="text-[9px]" style={{ color: "color-mix(in srgb, var(--secondary-text) 70%, transparent)" }}>{l.description}</div>
                      </div>
                      {active && <Check size={14} style={{ color: "var(--accent)" }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "widgets" && (
            <div className="space-y-3">
              <p className="text-[9px] uppercase tracking-wider" style={{ color: "color-mix(in srgb, var(--secondary-text) 60%, transparent)" }}>
                Active Widgets — drag to reorder
              </p>
              <Reorder.Group axis="y" values={enabledWidgets.map((w) => w.id)} onReorder={reorderEnabled} className="space-y-1.5">
                {enabledWidgets.map((w, idx) => {
                  const meta = WIDGET_META[w.id];
                  return (
                    <Reorder.Item
                      key={w.id}
                      value={w.id}
                      className="flex items-center gap-2 px-2 py-2 rounded-xl border bg-[color-mix(in_srgb,var(--card-bg)_60%,transparent)]"
                      style={{ borderColor: "color-mix(in srgb, var(--border-color) 40%, transparent)" }}
                      whileDrag={{ scale: 1.02, boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}
                    >
                      <span className="cursor-grab active:cursor-grabbing text-[color-mix(in_srgb,var(--secondary-text)_50%,transparent)]" aria-hidden="true">
                        <GripVertical size={13} />
                      </span>
                      <span className="text-[13px]" aria-hidden="true">{meta.icon}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[11px] font-semibold truncate" style={{ color: "var(--primary-text)" }}>{meta.label}</span>
                      </span>
                      {meta.alwaysAvailable && <Pin size={11} style={{ color: "var(--accent)" }} aria-label="Always available" />}
                      <button
                        onClick={() => moveWidget(idx, -1)}
                        disabled={idx === 0}
                        className="p-1 rounded-md hover:bg-[color-mix(in_srgb,var(--primary-text)_10%,transparent)] disabled:opacity-30 transition-colors"
                        style={{ color: "var(--secondary-text)" }}
                        aria-label={`Move ${meta.label} up`}
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        onClick={() => moveWidget(idx, 1)}
                        disabled={idx === enabledWidgets.length - 1}
                        className="p-1 rounded-md hover:bg-[color-mix(in_srgb,var(--primary-text)_10%,transparent)] disabled:opacity-30 transition-colors"
                        style={{ color: "var(--secondary-text)" }}
                        aria-label={`Move ${meta.label} down`}
                      >
                        <ChevronDown size={12} />
                      </button>
                      <button
                        onClick={() => setCollapsed(w.id, !w.collapsed)}
                        className="px-1.5 py-1 rounded-md text-[9px] font-bold uppercase hover:bg-[color-mix(in_srgb,var(--primary-text)_10%,transparent)] transition-colors"
                        style={{ color: "var(--secondary-text)" }}
                        aria-label={`${w.collapsed ? "Expand" : "Collapse"} ${meta.label}`}
                      >
                        {w.collapsed ? "Show" : "Hide"}
                      </button>
                      {!meta.alwaysAvailable && (
                        <button
                          onClick={() => toggleWidget(w.id)}
                          className="p-1 rounded-md hover:bg-[color-mix(in_srgb,var(--error)_15%,transparent)] transition-colors"
                          style={{ color: "var(--secondary-text)" }}
                          aria-label={`Disable ${meta.label}`}
                          title="Disable"
                        >
                          <EyeOff size={13} />
                        </button>
                      )}
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>

              {disabledWidgets.length > 0 && (
                <div className="pt-1">
                  <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: "color-mix(in srgb, var(--secondary-text) 50%, transparent)" }}>Hidden Widgets</p>
                  <div className="space-y-1">
                    {disabledWidgets.map((w) => {
                      const meta = WIDGET_META[w.id];
                      return (
                        <div key={w.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl border opacity-70" style={{ borderColor: "color-mix(in srgb, var(--border-color) 25%, transparent)" }}>
                          <span className="text-[13px]" aria-hidden="true">{meta.icon}</span>
                          <span className="flex-1 text-[11px] truncate" style={{ color: "var(--secondary-text)" }}>{meta.label}</span>
                          <button
                            onClick={() => toggleWidget(w.id)}
                            className="p-1 rounded-md hover:bg-[color-mix(in_srgb,var(--success)_15%,transparent)] transition-colors"
                            style={{ color: "var(--success, #34d399)" }}
                            aria-label={`Enable ${meta.label}`}
                            title="Enable"
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "appearance" && (
            <div className="space-y-4">
              {/* Theme */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--secondary-text)" }}>Theme</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {THEME_OPTIONS.map((t) => {
                    const active = draft.theme === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => previewTheme(t.id)}
                        className="flex flex-col gap-1.5 p-2 rounded-xl border transition-all"
                        style={{
                          borderColor: active ? "var(--accent)" : "color-mix(in srgb, var(--border-color) 40%, transparent)",
                          background: active ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent",
                        }}
                        aria-pressed={active}
                      >
                        <div className="w-full h-7 rounded-md" style={{ background: t.preview }} />
                        <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: active ? "var(--accent)" : "var(--secondary-text)" }}>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Accent */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--secondary-text)" }}>Accent</label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {ACCENT_PRESETS.map((c) => (
                    <button
                      key={c}
                      onClick={() => update({ ...draft, accent: c })}
                      className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ background: c, borderColor: draft.accent === c ? "var(--primary-text)" : "transparent" }}
                      aria-label={`Accent ${c}`}
                      aria-pressed={draft.accent === c}
                    />
                  ))}
                  <label className="w-6 h-6 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
                    <input
                      type="color"
                      value={draft.accent || "#38bdf8"}
                      onChange={(e) => update({ ...draft, accent: e.target.value })}
                      className="w-8 h-8 -ml-1 -mt-1 cursor-pointer bg-transparent border-0"
                      aria-label="Custom accent color"
                    />
                  </label>
                  {draft.accent && (
                    <button onClick={() => update({ ...draft, accent: undefined })} className="text-[9px] uppercase tracking-wider ml-1" style={{ color: "var(--secondary-text)" }}>Reset</button>
                  )}
                </div>
              </div>

              {/* Density */}
              <Segmented label="Density" options={DENSITY_OPTIONS} value={draft.density} onChange={(v) => update({ ...draft, density: v })} />
              {/* Radius */}
              <Segmented label="Corner radius" options={RADIUS_OPTIONS} value={draft.radius} onChange={(v) => update({ ...draft, radius: v })} />
              {/* Blur */}
              <Segmented label="Blur" options={BLUR_OPTIONS} value={draft.blur} onChange={(v) => update({ ...draft, blur: v })} />

              {/* Width */}
              <Slider
                label="Sidebar width"
                min={MIN_WIDTH}
                max={MAX_WIDTH}
                step={4}
                value={draft.width}
                display={`${draft.width}px`}
                onChange={(v) => update({ ...draft, width: v })}
              />
              {/* Transparency */}
              <Slider
                label="Transparency"
                min={0}
                max={100}
                step={1}
                value={Math.round(draft.transparency * 100)}
                display={`${Math.round(draft.transparency * 100)}%`}
                onChange={(v) => update({ ...draft, transparency: v / 100 })}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "color-mix(in srgb, var(--border-color) 45%, transparent)" }}>
          <button
            onClick={resetDefaults}
            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider transition-colors"
            style={{ color: "color-mix(in srgb, var(--secondary-text) 60%, transparent)" }}
          >
            <RotateCcw size={11} /> Restore defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={cancel}
              className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: "color-mix(in srgb, var(--secondary-text) 70%, transparent)" }}
            >
              Cancel
            </button>
            <button
              onClick={apply}
              disabled={!dirty}
              className="text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 rounded-lg transition-all"
              style={{
                background: dirty ? "color-mix(in srgb, var(--accent) 22%, transparent)" : "color-mix(in srgb, var(--primary-text) 6%, transparent)",
                color: dirty ? "var(--accent)" : "color-mix(in srgb, var(--secondary-text) 40%, transparent)",
                cursor: dirty ? "pointer" : "not-allowed",
              }}
            >
              {dirty ? "Apply" : "Saved"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(panel, document.body);
});

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--secondary-text)" }}>{label}</label>
      <div className="flex gap-1 p-1 rounded-xl border" style={{ borderColor: "color-mix(in srgb, var(--border-color) 35%, transparent)" }}>
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-colors"
              style={{
                background: active ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "transparent",
                color: active ? "var(--accent)" : "var(--secondary-text)",
              }}
              aria-pressed={active}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  display,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--secondary-text)" }}>{label}</label>
        <span className="text-[10px] font-black tabular-nums" style={{ color: "var(--accent)" }}>{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
        style={{ accentColor: "var(--accent)", background: "color-mix(in srgb, var(--primary-text) 12%, transparent)" }}
        aria-label={label}
      />
    </div>
  );
}

export default memo(CustomizationPanel);
