import { create } from 'zustand';
import type { TabActivityState, TabMetadata } from '@/lib/TabContextManager';

export type SessionPhase = 'idle' | 'planning' | 'reading' | 'analyzing' | 'generating' | 'complete' | 'error';

export interface AIThemeSettings {
  glowColor: string;
  glowIntensity: number;
  animationSpeed: number;
  gradientStyle: 'solid' | 'gradient' | 'rgb';
  enabled: boolean;
  preset: string;
  primary: string;
  secondary: string;
  tertiary: string;
}

export interface TabActivityRecord {
  tabId: string;
  state: TabActivityState;
  title: string;
  url: string;
  startedAt: number;
  completedAt?: number;
}

export interface TabIntelligenceState {
  sessionPhase: SessionPhase;
  sessionLabel: string;
  sessionStartedAt: number | null;

  tabActivities: Map<string, TabActivityRecord>;
  activeTabIds: Set<string>;

  theme: AIThemeSettings;

  sessionHistory: Array<{
    phase: SessionPhase;
    label: string;
    timestamp: number;
  }>;

  setSessionPhase: (phase: SessionPhase, label?: string) => void;
  startTabActivity: (tabId: string, state: TabActivityState, title?: string, url?: string) => void;
  updateTabActivity: (tabId: string, state: TabActivityState) => void;
  completeTabActivity: (tabId: string) => void;
  resetTabActivity: (tabId: string) => void;
  resetAll: () => void;

  updateTheme: (settings: Partial<AIThemeSettings>) => void;
  setThemePreset: (preset: string) => void;

  resetSession: () => void;
}

const DEFAULT_THEME: AIThemeSettings = {
  glowColor: '#38bdf8',
  glowIntensity: 0.5,
  animationSpeed: 1,
  gradientStyle: 'gradient',
  enabled: true,
  preset: 'ocean-blue',
  primary: '#3b82f6',
  secondary: '#06b6d4',
  tertiary: '#818cf8',
};

export const useTabIntelligenceStore = create<TabIntelligenceState>((set, get) => ({
  sessionPhase: 'idle',
  sessionLabel: '',
  sessionStartedAt: null,
  tabActivities: new Map(),
  activeTabIds: new Set(),
  theme: DEFAULT_THEME,
  sessionHistory: [],

  setSessionPhase: (phase, label) => {
    const state = get();
    const now = Date.now();
    const historyEntry = { phase, label: label || phase, timestamp: now };

    set({
      sessionPhase: phase,
      sessionLabel: label || phase,
      sessionStartedAt: phase === 'idle' ? null : state.sessionStartedAt || now,
      sessionHistory: [...state.sessionHistory.slice(-49), historyEntry],
    });
  },

  startTabActivity: (tabId, state, title, url) => {
    const record: TabActivityRecord = {
      tabId,
      state,
      title: title || '',
      url: url || '',
      startedAt: Date.now(),
    };
    set((s) => {
      const newMap = new Map(s.tabActivities);
      newMap.set(tabId, record);
      const newSet = new Set(s.activeTabIds);
      newSet.add(tabId);
      return { tabActivities: newMap, activeTabIds: newSet };
    });
  },

  updateTabActivity: (tabId, state) => {
    set((s) => {
      const existing = s.tabActivities.get(tabId);
      if (!existing) return s;
      const newMap = new Map(s.tabActivities);
      newMap.set(tabId, { ...existing, state });
      return { tabActivities: newMap };
    });
  },

  completeTabActivity: (tabId) => {
    set((s) => {
      const existing = s.tabActivities.get(tabId);
      if (!existing) return s;
      const newMap = new Map(s.tabActivities);
      newMap.set(tabId, { ...existing, state: 'completed', completedAt: Date.now() });
      return { tabActivities: newMap };
    });
  },

  resetTabActivity: (tabId) => {
    set((s) => {
      const newMap = new Map(s.tabActivities);
      newMap.delete(tabId);
      const newSet = new Set(s.activeTabIds);
      newSet.delete(tabId);
      return { tabActivities: newMap, activeTabIds: newSet };
    });
  },

  resetAll: () => {
    set({
      tabActivities: new Map(),
      activeTabIds: new Set(),
      sessionPhase: 'idle',
      sessionLabel: '',
      sessionStartedAt: null,
      sessionHistory: [],
    });
  },

  updateTheme: (settings) => {
    set((s) => ({ theme: { ...s.theme, ...settings } }));
    applyThemeToCSS({ ...get().theme, ...settings });
  },

  setThemePreset: (preset) => {
    const presets: Record<string, Partial<AIThemeSettings>> = {
      'purple-cosmos': { primary: '#a855f7', secondary: '#6366f1', tertiary: '#ec4899', glowColor: '#a855f7' },
      'ocean-blue': { primary: '#3b82f6', secondary: '#06b6d4', tertiary: '#818cf8', glowColor: '#3b82f6' },
      'emerald-forest': { primary: '#10b981', secondary: '#06b6d4', tertiary: '#34d399', glowColor: '#10b981' },
      'sunset-fire': { primary: '#f97316', secondary: '#ef4444', tertiary: '#f59e0b', glowColor: '#f97316' },
      'rose-gold': { primary: '#f43f5e', secondary: '#ec4899', tertiary: '#fb7185', glowColor: '#f43f5e' },
      'arctic-ice': { primary: '#06b6d4', secondary: '#818cf8', tertiary: '#e0f2fe', glowColor: '#06b6d4' },
    };

    const presetColors = presets[preset] || presets['ocean-blue'];
    set((s) => ({
      theme: { ...s.theme, ...presetColors, preset },
    }));
    applyThemeToCSS({ ...get().theme, ...presetColors, preset });
  },

  resetSession: () => {
    set({
      sessionPhase: 'idle',
      sessionLabel: '',
      sessionStartedAt: null,
      tabActivities: new Map(),
      activeTabIds: new Set(),
      sessionHistory: [],
    });
  },
}));

function applyThemeToCSS(theme: AIThemeSettings) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--ai-glow-primary', theme.primary);
  root.style.setProperty('--ai-glow-secondary', theme.secondary);
  root.style.setProperty('--ai-glow-tertiary', theme.tertiary);
  root.style.setProperty('--ai-glow-color', theme.glowColor);
  root.style.setProperty('--ai-glow-intensity', String(theme.glowIntensity));
  root.style.setProperty('--ai-animation-speed', String(theme.animationSpeed));
  root.style.setProperty('--ai-gradient-style', theme.gradientStyle);
}
