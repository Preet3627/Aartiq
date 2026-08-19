"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type SidebarPreferences,
  type SidebarWidgetState,
  type WidgetId,
  type WidgetSize,
  type Density,
  type BlurLevel,
  type RadiusLevel,
  type ThemeId,
  WIDGET_META,
  DEFAULT_SIDEBAR_PREFERENCES,
  getSidebarPreferences,
  saveSidebarPreferences,
} from "./types";
import { applyLayout, deriveLayoutId } from "./layouts";

const STORAGE_KEY = "aartiq_sidebar_preferences_v3";
const SAVE_DEBOUNCE_MS = 200;

function mapWidgets(
  prefs: SidebarPreferences,
  fn: (w: SidebarWidgetState) => SidebarWidgetState,
): SidebarWidgetState[] {
  return prefs.widgets.map(fn);
}

function updateWidget(
  prefs: SidebarPreferences,
  id: WidgetId,
  patch: Partial<SidebarWidgetState>,
): SidebarWidgetState[] {
  return prefs.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w));
}

export interface UseSidebarPrefs {
  prefs: SidebarPreferences;
  /** Live, non-persisted update (used for preview). */
  preview: (next: SidebarPreferences) => void;
  /** Commit + persist atomically. */
  commit: (next: SidebarPreferences) => void;
  /** Debounced persist (used for drag / width / sliders). */
  soft: (next: SidebarPreferences) => void;
  resetDefaults: () => void;
  applyLayoutPreset: (id: Parameters<typeof applyLayout>[1]) => void;
  toggleWidget: (id: WidgetId) => void;
  setWidgetCollapsed: (id: WidgetId, collapsed: boolean) => void;
  setWidgetSize: (id: WidgetId, size: WidgetSize) => void;
  setWidgetPinned: (id: WidgetId, pinned: boolean) => void;
  reorderWidgets: (from: number, to: number) => void;
  setDensity: (d: Density) => void;
  setWidth: (w: number) => void;
  setTheme: (t: ThemeId) => void;
  setAccent: (a: string) => void;
  setTransparency: (n: number) => void;
  setBlur: (b: BlurLevel) => void;
  setRadius: (r: RadiusLevel) => void;
  setShowSecondaryInfo: (v: boolean) => void;
  setMode: (m: "full" | "compact" | "hidden") => void;
  setShowWidgets: (v: boolean) => void;
  setHistorySuggestions: (v: "always" | "ask" | "never") => void;
}

export function useSidebarPrefs(): UseSidebarPrefs {
  const [prefs, setPrefs] = useState<SidebarPreferences>(() => getSidebarPreferences());
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback((p: SidebarPreferences) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    saveSidebarPreferences(p);
  }, []);

  const scheduleSave = useCallback(
    (p: SidebarPreferences) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveSidebarPreferences(p);
        saveTimer.current = null;
      }, SAVE_DEBOUNCE_MS);
    },
    [],
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = getSidebarPreferences();
      setPrefs(next);
    };
    window.addEventListener("storage", onStorage);
    const onCustom = () => setPrefs(getSidebarPreferences());
    window.addEventListener("aartiq-sidebar-prefs", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("aartiq-sidebar-prefs", onCustom);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const preview = useCallback((next: SidebarPreferences) => setPrefs(next), []);

  const commit = useCallback(
    (next: SidebarPreferences) => {
      setPrefs(next);
      flush(next);
    },
    [flush],
  );

  const soft = useCallback(
    (next: SidebarPreferences) => {
      setPrefs(next);
      scheduleSave(next);
    },
    [scheduleSave],
  );

  const resetDefaults = useCallback(() => {
    const next: SidebarPreferences = { ...DEFAULT_SIDEBAR_PREFERENCES, theme: prefsRef.current.theme, accent: prefsRef.current.accent };
    setPrefs(next);
    flush(next);
  }, [flush]);

  const applyLayoutPreset = useCallback(
    (id: Parameters<typeof applyLayout>[1]) => {
      const next = { ...prefsRef.current, layout: id, widgets: applyLayout(prefsRef.current.widgets, id) };
      setPrefs(next);
      flush(next);
    },
    [flush],
  );

  const toggleWidget = useCallback(
    (id: WidgetId) => {
      const current = prefsRef.current.widgets.find((w) => w.id === id);
      if (!current) return;
      const meta = WIDGET_META[id];
      // Always-available widgets (e.g. Needs Your Attention) can never be hidden.
      if (meta.alwaysAvailable && current.enabled) return;
      const next = { ...prefsRef.current, widgets: updateWidget(prefsRef.current, id, { enabled: !current.enabled }) };
      next.layout = deriveLayoutId(next);
      setPrefs(next);
      flush(next);
    },
    [flush],
  );

  const setWidgetCollapsed = useCallback(
    (id: WidgetId, collapsed: boolean) => {
      const next = { ...prefsRef.current, widgets: updateWidget(prefsRef.current, id, { collapsed }) };
      setPrefs(next);
      flush(next);
    },
    [flush],
  );

  const setWidgetSize = useCallback(
    (id: WidgetId, size: WidgetSize) => {
      const next = { ...prefsRef.current, widgets: updateWidget(prefsRef.current, id, { size }) };
      setPrefs(next);
      flush(next);
    },
    [flush],
  );

  const setWidgetPinned = useCallback(
    (id: WidgetId, pinned: boolean) => {
      const next = { ...prefsRef.current, widgets: updateWidget(prefsRef.current, id, { pinned }) };
      setPrefs(next);
      flush(next);
    },
    [flush],
  );

  const reorderWidgets = useCallback(
    (from: number, to: number) => {
      const arr = [...prefsRef.current.widgets];
      if (from < 0 || from >= arr.length || to < 0 || to >= arr.length || from === to) return;
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      const next = { ...prefsRef.current, widgets: arr, layout: "custom" as const };
      setPrefs(next);
      flush(next);
    },
    [flush],
  );

  const setDensity = useCallback((d: Density) => { const next = { ...prefsRef.current, density: d }; setPrefs(next); flush(next); }, [flush]);
  const setWidth = useCallback((w: number) => { const next = { ...prefsRef.current, width: w }; setPrefs(next); scheduleSave(next); }, [scheduleSave]);
  const setTheme = useCallback((t: ThemeId) => { const next = { ...prefsRef.current, theme: t }; setPrefs(next); flush(next); }, [flush]);
  const setAccent = useCallback((a: string) => { const next = { ...prefsRef.current, accent: a }; setPrefs(next); flush(next); }, [flush]);
  const setTransparency = useCallback((n: number) => { const next = { ...prefsRef.current, transparency: n }; setPrefs(next); scheduleSave(next); }, [scheduleSave]);
  const setBlur = useCallback((b: BlurLevel) => { const next = { ...prefsRef.current, blur: b }; setPrefs(next); flush(next); }, [flush]);
  const setRadius = useCallback((r: RadiusLevel) => { const next = { ...prefsRef.current, radius: r }; setPrefs(next); flush(next); }, [flush]);
  const setShowSecondaryInfo = useCallback((v: boolean) => { const next = { ...prefsRef.current, showSecondaryInfo: v }; setPrefs(next); flush(next); }, [flush]);
  const setMode = useCallback((m: "full" | "compact" | "hidden") => { const next = { ...prefsRef.current, mode: m }; setPrefs(next); flush(next); }, [flush]);
  const setShowWidgets = useCallback((v: boolean) => { const next = { ...prefsRef.current, showWidgets: v }; setPrefs(next); flush(next); }, [flush]);
  const setHistorySuggestions = useCallback((v: "always" | "ask" | "never") => { const next = { ...prefsRef.current, historySuggestions: v }; setPrefs(next); flush(next); }, [flush]);

  return useMemo(
    () => ({
      prefs,
      preview,
      commit,
      soft,
      resetDefaults,
      applyLayoutPreset,
      toggleWidget,
      setWidgetCollapsed,
      setWidgetSize,
      setWidgetPinned,
      reorderWidgets,
      setDensity,
      setWidth,
      setTheme,
      setAccent,
      setTransparency,
      setBlur,
      setRadius,
      setShowSecondaryInfo,
      setMode,
      setShowWidgets,
      setHistorySuggestions,
    }),
    [
      prefs, preview, commit, soft, resetDefaults, applyLayoutPreset, toggleWidget,
      setWidgetCollapsed, setWidgetSize, setWidgetPinned, reorderWidgets, setDensity,
      setWidth, setTheme, setAccent, setTransparency, setBlur, setRadius,
      setShowSecondaryInfo, setMode, setShowWidgets, setHistorySuggestions,
    ],
  );
}
