"use client";

export type WidgetId =
  | 'dashboard'
  | 'ai-chat'
  | 'memory'
  | 'session-timeline'
  | 'tab-intelligence'
  | 'quick-actions'
  | 'capabilities'
  | 'tasks';

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
  { id: 'dashboard', label: 'Dashboard', icon: '👋', defaultVisible: true, defaultOrder: 0 },
  { id: 'ai-chat', label: 'AI Chat', icon: '💬', defaultVisible: true, defaultOrder: 1 },
  { id: 'memory', label: 'Memory', icon: '🧠', defaultVisible: true, defaultOrder: 2 },
  { id: 'session-timeline', label: 'Session Timeline', icon: '⏱️', defaultVisible: true, defaultOrder: 3 },
  { id: 'tab-intelligence', label: 'Tab Intelligence', icon: '📑', defaultVisible: true, defaultOrder: 4 },
  { id: 'quick-actions', label: 'Quick Actions', icon: '⚡', defaultVisible: true, defaultOrder: 5 },
  { id: 'capabilities', label: 'Capabilities', icon: '🛠️', defaultVisible: false, defaultOrder: 6 },
  { id: 'tasks', label: 'Tasks', icon: '📋', defaultVisible: false, defaultOrder: 7 },
];

export const DEFAULT_SIDEBAR_PREFERENCES: SidebarPreferences = {
  enabledWidgets: WIDGET_DEFINITIONS.filter(w => w.defaultVisible).map(w => w.id),
  widgetOrder: WIDGET_DEFINITIONS.sort((a, b) => a.defaultOrder - b.defaultOrder).map(w => w.id),
  collapsedWidgets: ['dashboard', 'memory', 'session-timeline', 'tab-intelligence'],
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

export function getSidebarPreferences(): SidebarPreferences {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_SIDEBAR_PREFERENCES, ...JSON.parse(raw) };
    }
  } catch { }
  return { ...DEFAULT_SIDEBAR_PREFERENCES };
}

export function saveSidebarPreferences(prefs: Partial<SidebarPreferences>): SidebarPreferences {
  const current = getSidebarPreferences();
  const updated = { ...current, ...prefs };
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
