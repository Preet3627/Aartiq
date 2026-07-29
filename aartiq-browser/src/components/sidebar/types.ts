"use client";

export type WidgetId =
  | 'current-context'
  | 'workspace-intelligence'
  | 'ai-suggestions'
  | 'session-resume'
  | 'automation-monitor'
  | 'memory-insights'
  | 'ai-timeline';

export interface SidebarWidget {
  id: WidgetId;
  label: string;
  icon: string;
  defaultVisible: boolean;
  defaultOrder: number;
  minHeight?: number;
}

export interface SidebarPreferences {
  enabledWidgets: WidgetId[];
  widgetOrder: WidgetId[];
  collapsedWidgets: WidgetId[];
  sidebarWidth: number;
  sidebarMode: 'full' | 'compact' | 'hidden';
}

export type GlowMode = 'off' | 'subtle' | 'dynamic';

export interface AIVisualSettings {
  enabled: boolean;
  glowMode: GlowMode;
  color: string;
  intensity: number;
  animationSpeed: number;
}

export interface PrivacySettings {
  disableMemory: boolean;
  disablePreferenceLearning: boolean;
  disableTabIntelligence: boolean;
  disableAnimations: boolean;
}

export const WIDGET_DEFINITIONS: SidebarWidget[] = [
  { id: 'current-context', label: 'Current Context', icon: '◎', defaultVisible: true, defaultOrder: 0 },
  { id: 'ai-suggestions', label: 'AI Suggestions', icon: '✦', defaultVisible: true, defaultOrder: 1 },
  { id: 'workspace-intelligence', label: 'Workspace Intelligence', icon: '◫', defaultVisible: true, defaultOrder: 2 },
  { id: 'session-resume', label: 'Session Resume', icon: '↻', defaultVisible: true, defaultOrder: 3 },
  { id: 'automation-monitor', label: 'Automation Monitor', icon: '⬡', defaultVisible: true, defaultOrder: 4 },
  { id: 'memory-insights', label: 'Memory Insights', icon: '◈', defaultVisible: true, defaultOrder: 5 },
  { id: 'ai-timeline', label: 'Timeline', icon: '│', defaultVisible: true, defaultOrder: 6 },
];

export const DEFAULT_SIDEBAR_PREFERENCES: SidebarPreferences = {
  enabledWidgets: WIDGET_DEFINITIONS.filter(w => w.defaultVisible).map(w => w.id),
  widgetOrder: WIDGET_DEFINITIONS.sort((a, b) => a.defaultOrder - b.defaultOrder).map(w => w.id),
  collapsedWidgets: ['memory-insights', 'ai-timeline'],
  sidebarWidth: 380,
  sidebarMode: 'full',
};

export const DEFAULT_AI_VISUAL_SETTINGS: AIVisualSettings = {
  enabled: true,
  glowMode: 'subtle',
  color: '#38bdf8',
  intensity: 0.5,
  animationSpeed: 1,
};

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  disableMemory: false,
  disablePreferenceLearning: false,
  disableTabIntelligence: false,
  disableAnimations: false,
};

const STORAGE_KEY = 'aartiq_sidebar_preferences';
const VISUAL_KEY = 'aartiq_ai_visual_settings';
const PRIVACY_KEY = 'aartiq_ai_privacy_settings';

const LEGACY_WIDGET_MAP: Record<string, WidgetId> = {
  dashboard: 'current-context',
  memory: 'memory-insights',
  'session-timeline': 'ai-timeline',
  'tab-intelligence': 'workspace-intelligence',
  'quick-actions': 'ai-suggestions',
  capabilities: 'ai-suggestions',
  tasks: 'automation-monitor',
};

const VALID_WIDGET_IDS = new Set<string>(WIDGET_DEFINITIONS.map((w) => w.id));

function migrateWidgetId(id: string): WidgetId | null {
  if (VALID_WIDGET_IDS.has(id)) return id as WidgetId;
  return LEGACY_WIDGET_MAP[id] ?? null;
}

function migratePreferences(raw: Partial<SidebarPreferences>): SidebarPreferences {
  const enabled = (raw.enabledWidgets || [])
    .map((id) => migrateWidgetId(String(id)))
    .filter((id): id is WidgetId => id !== null);
  const order = (raw.widgetOrder || [])
    .map((id) => migrateWidgetId(String(id)))
    .filter((id): id is WidgetId => id !== null);
  const collapsed = (raw.collapsedWidgets || [])
    .map((id) => migrateWidgetId(String(id)))
    .filter((id): id is WidgetId => id !== null);

  const dedupe = <T extends string>(arr: T[]) => Array.from(new Set(arr));

  const enabledWidgets = dedupe(enabled.length ? enabled : DEFAULT_SIDEBAR_PREFERENCES.enabledWidgets);
  const widgetOrder = dedupe(order.length ? order : DEFAULT_SIDEBAR_PREFERENCES.widgetOrder);
  DEFAULT_SIDEBAR_PREFERENCES.widgetOrder.forEach((id) => {
    if (!widgetOrder.includes(id)) widgetOrder.push(id);
  });

  return {
    ...DEFAULT_SIDEBAR_PREFERENCES,
    ...raw,
    enabledWidgets,
    widgetOrder,
    collapsedWidgets: dedupe(collapsed),
  };
}

export function getSidebarPreferences(): SidebarPreferences {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migratePreferences(JSON.parse(raw));
    }
  } catch { }
  return { ...DEFAULT_SIDEBAR_PREFERENCES };
}

export function saveSidebarPreferences(prefs: Partial<SidebarPreferences>): SidebarPreferences {
  const current = getSidebarPreferences();
  const updated = migratePreferences({ ...current, ...prefs });
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  } catch { }
  return updated;
}

export function getAIVisualSettings(): AIVisualSettings {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(VISUAL_KEY);
      if (raw) return { ...DEFAULT_AI_VISUAL_SETTINGS, ...JSON.parse(raw) };
    }
  } catch { }
  return { ...DEFAULT_AI_VISUAL_SETTINGS };
}

export function saveAIVisualSettings(settings: Partial<AIVisualSettings>): AIVisualSettings {
  const current = getAIVisualSettings();
  const updated = { ...current, ...settings };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(VISUAL_KEY, JSON.stringify(updated));
    }
  } catch { }
  return updated;
}

export function getPrivacySettings(): PrivacySettings {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(PRIVACY_KEY);
      if (raw) return { ...DEFAULT_PRIVACY_SETTINGS, ...JSON.parse(raw) };
    }
  } catch { }
  return { ...DEFAULT_PRIVACY_SETTINGS };
}

export function savePrivacySettings(settings: Partial<PrivacySettings>): PrivacySettings {
  const current = getPrivacySettings();
  const updated = { ...current, ...settings };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PRIVACY_KEY, JSON.stringify(updated));
    }
  } catch { }
  return updated;
}
