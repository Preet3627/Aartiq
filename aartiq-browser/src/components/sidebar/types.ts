"use client";

/**
 * Sidebar configuration — single source of truth.
 *
 * Everything the sidebar needs to render is derived from `SidebarPreferences`.
 * The schema is versioned, validated on read, and recovered to safe defaults
 * when corrupted so the sidebar can never crash from a bad config.
 *
 * Widget ordering, density, width, theme, accent, transparency and blur all
 * live here. There is no parallel theme system: the sidebar inherits the
 * global Aartiq theme tokens (--card-bg, --accent, --border-color, …) and only
 * derives sidebar-local adjustments (radius, density padding, blur) from them.
 */

export type WidgetId =
  | "current-task"
  | "live-activity"
  | "goal-intent"
  | "workspace"
  | "memory-insights"
  | "ai-suggestions"
  | "needs-attention"
  | "automation-monitor";

export type SidebarLayoutId =
  | "focus"
  | "research"
  | "automation"
  | "minimal"
  | "custom";

export type Density = "compact" | "comfortable" | "spacious";
export type WidgetSize = "small" | "medium" | "large";
export type BlurLevel = "none" | "subtle" | "strong";
export type RadiusLevel = "sharp" | "subtle" | "rounded";

/** Global Aartiq theme identifiers (kept in sync with useAppStore.theme). */
export type ThemeId =
  | "dark"
  | "light"
  | "system"
  | "vibrant"
  | "custom"
  | "minimal";

export interface SidebarWidgetState {
  id: WidgetId;
  enabled: boolean;
  collapsed: boolean;
  size: WidgetSize;
  pinned: boolean;
}

export interface SidebarPreferences {
  version: number;
  layout: SidebarLayoutId;
  widgets: SidebarWidgetState[];
  density: Density;
  width: number;
  theme?: ThemeId;
  accent?: string;
  transparency: number; // 0..1 (0 = fully opaque surface, 1 = most transparent)
  blur: BlurLevel;
  radius: RadiusLevel;
  showSecondaryInfo: boolean;
  /** chrome-level mode for the whole sidebar */
  mode: "full" | "compact" | "hidden";
  /** when true, the modular widget grid is shown on the empty home; otherwise the minimal AI-suggestions home is shown */
  showWidgets: boolean;
  /** permission for Aartiq to read history when composing personalized suggestions */
  historySuggestions: "always" | "ask" | "never";
}

export interface SidebarWidgetMeta {
  id: WidgetId;
  label: string;
  icon: string; // emoji glyph for lightweight rendering
  description: string;
  /** widgets that should never be disabled (e.g. needs-attention) */
  alwaysAvailable?: boolean;
  defaultEnabled: boolean;
  defaultSize: WidgetSize;
  defaultPinned?: boolean;
}

export const WIDGET_REGISTRY: SidebarWidgetMeta[] = [
  {
    id: "current-task",
    label: "Current Task",
    icon: "◉",
    description: "What Aartiq is doing right now, with progress and controls.",
    defaultEnabled: true,
    defaultSize: "medium",
  },
  {
    id: "live-activity",
    label: "Live Activity",
    icon: "❖",
    description: "A live, concise feed of the agent's latest actions.",
    defaultEnabled: true,
    defaultSize: "small",
  },
  {
    id: "goal-intent",
    label: "Goal / Intent",
    icon: "◎",
    description: "What Aartiq believes you are trying to accomplish.",
    defaultEnabled: true,
    defaultSize: "small",
  },
  {
    id: "workspace",
    label: "Workspace",
    icon: "▦",
    description: "Open tabs, sources, findings and selected context.",
    defaultEnabled: true,
    defaultSize: "medium",
  },
  {
    id: "memory-insights",
    label: "Memory Insights",
    icon: "◈",
    description: "Relevant persistent and contextual memories.",
    defaultEnabled: true,
    defaultSize: "medium",
  },
  {
    id: "ai-suggestions",
    label: "AI Suggestions",
    icon: "✦",
    description: "Contextual actions based on the current page and task.",
    defaultEnabled: true,
    defaultSize: "small",
  },
  {
    id: "needs-attention",
    label: "Needs Your Attention",
    icon: "⚠",
    description: "Permission, login, confirmation and failure prompts.",
    alwaysAvailable: true,
    defaultEnabled: true,
    defaultSize: "small",
    defaultPinned: true,
  },
  {
    id: "automation-monitor",
    label: "Automation Monitor",
    icon: "⬡",
    description: "Detailed automation timeline (collapsible).",
    defaultEnabled: true,
    defaultSize: "large",
  },
];

export const WIDGET_META: Record<WidgetId, SidebarWidgetMeta> = WIDGET_REGISTRY.reduce(
  (acc, w) => {
    acc[w.id] = w;
    return acc;
  },
  {} as Record<WidgetId, SidebarWidgetMeta>,
);

export const DEFAULT_DENSITY: Density = "comfortable";
export const DEFAULT_WIDTH = 360;
export const MIN_WIDTH = 280;
export const MAX_WIDTH = 520;
export const DEFAULT_TRANSPARENCY = 0.12;
export const DEFAULT_BLUR: BlurLevel = "subtle";
export const DEFAULT_RADIUS: RadiusLevel = "rounded";

export const SIDEBAR_SCHEMA_VERSION = 3;

function makeWidgetState(meta: SidebarWidgetMeta): SidebarWidgetState {
  return {
    id: meta.id,
    enabled: meta.defaultEnabled,
    collapsed: false,
    size: meta.defaultSize,
    pinned: meta.defaultPinned ?? false,
  };
}

export function buildDefaultWidgets(): SidebarWidgetState[] {
  return WIDGET_REGISTRY.map(makeWidgetState);
}

export const DEFAULT_SIDEBAR_PREFERENCES: SidebarPreferences = {
  version: SIDEBAR_SCHEMA_VERSION,
  layout: "custom",
  widgets: buildDefaultWidgets(),
  density: DEFAULT_DENSITY,
  width: DEFAULT_WIDTH,
  transparency: DEFAULT_TRANSPARENCY,
  blur: DEFAULT_BLUR,
  radius: DEFAULT_RADIUS,
  showSecondaryInfo: true,
  mode: "full",
  // Minimal by default: the empty home shows the AI-suggestions surface,
  // not the modular widget grid.
  showWidgets: false,
  // Ask for permission every time before reading history for suggestions.
  historySuggestions: "ask",
};

function sanitizeHistorySuggestions(v: unknown): "always" | "ask" | "never" {
  return v === "always" || v === "ask" || v === "never" ? v : "ask";
}

/* ─────────────────────────────────────────────────────────────
   Legacy id migration — old widget ids map onto the new registry.
   ───────────────────────────────────────────────────────────── */
const LEGACY_WIDGET_MAP: Record<string, WidgetId> = {
  dashboard: "current-task",
  "current-context": "current-task",
  "live-activity": "live-activity",
  "ai-timeline": "live-activity",
  "session-timeline": "live-activity",
  "goal-intent": "goal-intent",
  intent: "goal-intent",
  "workspace-intelligence": "workspace",
  "session-resume": "workspace",
  tabintelligence: "workspace",
  "memory-insights": "memory-insights",
  memory: "memory-insights",
  "ai-suggestions": "ai-suggestions",
  "quick-actions": "ai-suggestions",
  "needs-attention": "needs-attention",
  attention: "needs-attention",
  "automation-monitor": "automation-monitor",
  tasks: "automation-monitor",
};

const VALID_WIDGET_IDS = new Set<string>(WIDGET_REGISTRY.map((w) => w.id));

function migrateWidgetId(id: unknown): WidgetId | null {
  if (typeof id !== "string") return null;
  if (VALID_WIDGET_IDS.has(id)) return id as WidgetId;
  return LEGACY_WIDGET_MAP[id] ?? null;
}

function clamp(n: number, min: number, max: number, fallback: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeSize(v: unknown): WidgetSize {
  return v === "small" || v === "medium" || v === "large" ? v : "medium";
}
function sanitizeDensity(v: unknown): Density {
  return v === "compact" || v === "comfortable" || v === "spacious" ? v : DEFAULT_DENSITY;
}
function sanitizeBlur(v: unknown): BlurLevel {
  return v === "none" || v === "subtle" || v === "strong" ? v : DEFAULT_BLUR;
}
function sanitizeRadius(v: unknown): RadiusLevel {
  return v === "sharp" || v === "subtle" || v === "rounded" ? v : DEFAULT_RADIUS;
}
function sanitizeLayout(v: unknown): SidebarLayoutId {
  return v === "focus" || v === "research" || v === "automation" || v === "minimal" || v === "custom"
    ? v
    : "custom";
}
function sanitizeMode(v: unknown): "full" | "compact" | "hidden" {
  return v === "full" || v === "compact" || v === "hidden" ? v : "full";
}

/**
 * Validate + migrate an arbitrary (possibly corrupt) object into a safe
 * SidebarPreferences. Never throws — returns defaults on any failure.
 */
export function migrateSidebarPreferences(raw: unknown): SidebarPreferences {
  try {
    if (!raw || typeof raw !== "object") return { ...DEFAULT_SIDEBAR_PREFERENCES };
    const input = raw as Record<string, unknown>;

    const rawWidgets = Array.isArray(input.widgets) ? (input.widgets as unknown[]) : null;

    let widgets: SidebarWidgetState[];
    if (rawWidgets && rawWidgets.length > 0) {
      const seen = new Set<WidgetId>();
      widgets = [];
      for (const w of rawWidgets) {
        const obj = (w ?? {}) as Record<string, unknown>;
        const id = migrateWidgetId(obj.id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const meta = WIDGET_META[id];
        widgets.push({
          id,
          enabled: obj.enabled === undefined ? meta.defaultEnabled : Boolean(obj.enabled),
          collapsed: Boolean(obj.collapsed),
          size: sanitizeSize(obj.size ?? meta.defaultSize),
          pinned: Boolean(obj.pinned ?? meta.defaultPinned ?? false),
        });
      }
      // Backfill any widget missing from the stored array (e.g. new widgets).
      for (const meta of WIDGET_REGISTRY) {
        if (!seen.has(meta.id)) widgets.push(makeWidgetState(meta));
      }
    } else {
      // Older schema: enabledWidgets + widgetOrder + collapsedWidgets
      const enabled = ((input.enabledWidgets as unknown[]) ?? [])
        .map(migrateWidgetId)
        .filter((x): x is WidgetId => x !== null);
      const order = ((input.widgetOrder as unknown[]) ?? [])
        .map(migrateWidgetId)
        .filter((x): x is WidgetId => x !== null);
      const collapsed = ((input.collapsedWidgets as unknown[]) ?? [])
        .map(migrateWidgetId)
        .filter((x): x is WidgetId => x !== null);

      const dedupe = <T extends string>(arr: T[]) => Array.from(new Set(arr));
      const enabledSet = new Set(dedupe(enabled.length ? enabled : WIDGET_REGISTRY.filter((w) => w.defaultEnabled).map((w) => w.id)));
      const ordered = dedupe([...order, ...WIDGET_REGISTRY.map((w) => w.id)]).filter((id) =>
        VALID_WIDGET_IDS.has(id),
      );

      widgets = ordered.map((id) => {
        const meta = WIDGET_META[id];
        return {
          id,
          enabled: enabledSet.has(id),
          collapsed: collapsed.includes(id),
          size: meta.defaultSize,
          pinned: meta.defaultPinned ?? false,
        };
      });
    }

    return {
      version: SIDEBAR_SCHEMA_VERSION,
      layout: sanitizeLayout(input.layout),
      widgets,
      density: sanitizeDensity(input.density),
      width: clamp(Number(input.width), MIN_WIDTH, MAX_WIDTH, DEFAULT_WIDTH),
      theme: (input.theme as ThemeId) ?? undefined,
      accent: typeof input.accent === "string" ? input.accent : undefined,
      transparency: clamp(Number(input.transparency), 0, 1, DEFAULT_TRANSPARENCY),
      blur: sanitizeBlur(input.blur),
      radius: sanitizeRadius(input.radius),
      showSecondaryInfo: input.showSecondaryInfo === undefined ? true : Boolean(input.showSecondaryInfo),
      mode: sanitizeMode(input.mode),
      // Default to the minimal home; never auto-enable the widget grid.
      showWidgets: input.showWidgets === undefined ? false : Boolean(input.showWidgets),
      historySuggestions: sanitizeHistorySuggestions(input.historySuggestions),
    };
  } catch {
    return { ...DEFAULT_SIDEBAR_PREFERENCES };
  }
}

const STORAGE_KEY = "aartiq_sidebar_preferences_v3";

export function getSidebarPreferences(): SidebarPreferences {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const migrated = migrateSidebarPreferences(parsed);
        // Self-heal: if the stored blob was corrupt/migrated, rewrite it.
        if (JSON.stringify(migrated) !== raw) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        }
        return migrated;
      }
    }
  } catch {
    /* fall through to defaults */
  }
  return { ...DEFAULT_SIDEBAR_PREFERENCES };
}

/**
 * Atomic persist. Writes the full validated object in a single setItem call.
 * Returns the value actually persisted (post-validation).
 */
export function saveSidebarPreferences(prefs: SidebarPreferences): SidebarPreferences {
  const validated = migrateSidebarPreferences(prefs);
  try {
    if (typeof localStorage !== "undefined") {
      const blob = JSON.stringify(validated);
      localStorage.setItem(STORAGE_KEY, blob);
      // Notify other tabs/instances for cross-window sync. The StorageEvent
      // only fires in OTHER windows; this custom event also reaches same-window
      // listeners (e.g. Settings panel + sidebar both mounted in one window).
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: blob }));
      window.dispatchEvent(new Event("aartiq-sidebar-prefs"));
    }
  } catch {
    /* ignore quota / availability errors */
  }
  return validated;
}

/* ─────────────────────────────────────────────────────────────
   AI visual + privacy settings (unchanged responsibility).
   ───────────────────────────────────────────────────────────── */
export type GlowMode = "off" | "subtle" | "dynamic";

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

export const DEFAULT_AI_VISUAL_SETTINGS: AIVisualSettings = {
  enabled: true,
  glowMode: "subtle",
  color: "#38bdf8",
  intensity: 0.5,
  animationSpeed: 1,
};

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  disableMemory: false,
  disablePreferenceLearning: false,
  disableTabIntelligence: false,
  disableAnimations: false,
};

const VISUAL_KEY = "aartiq_ai_visual_settings";
const PRIVACY_KEY = "aartiq_ai_privacy_settings";

export function getAIVisualSettings(): AIVisualSettings {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(VISUAL_KEY);
      if (raw) return { ...DEFAULT_AI_VISUAL_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_AI_VISUAL_SETTINGS };
}

export function saveAIVisualSettings(settings: Partial<AIVisualSettings>): AIVisualSettings {
  const current = getAIVisualSettings();
  const updated = { ...current, ...settings };
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(VISUAL_KEY, JSON.stringify(updated));
    }
  } catch {
    /* ignore */
  }
  return updated;
}

export function getPrivacySettings(): PrivacySettings {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(PRIVACY_KEY);
      if (raw) return { ...DEFAULT_PRIVACY_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_PRIVACY_SETTINGS };
}

export function savePrivacySettings(settings: Partial<PrivacySettings>): PrivacySettings {
  const current = getPrivacySettings();
  const updated = { ...current, ...settings };
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PRIVACY_KEY, JSON.stringify(updated));
    }
  } catch {
    /* ignore */
  }
  return updated;
}
