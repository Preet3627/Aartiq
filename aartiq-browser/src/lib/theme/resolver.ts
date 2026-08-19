/**
 * Theme resolver — visual themes and UI modes.
 *
 * Produces a set of CSS variables + a body class for a chosen UI mode
 * (normal | focus | reader | zen | presentation). Modes change layout density
 * and chrome visibility, not just colors, so the agent UI can get out of the way
 * during long autonomous runs.
 */

export type UiMode = 'normal' | 'focus' | 'reader' | 'zen' | 'presentation';

export interface ThemePrefs {
  accent: string;
  background: string;
  foreground: string;
  surface: string;
  density: 'compact' | 'comfortable' | 'spacious';
  glow: boolean;
  glowIntensity: number; // 0..1
  dark: boolean;
}

export interface ResolvedTheme {
  mode: UiMode;
  prefs: ThemePrefs;
  cssVars: Record<string, string>;
  bodyClass: string;
}

export const PRESETS: Record<string, Partial<ThemePrefs>> = {
  aurora: { accent: '#5eead4', background: '#0b1020', foreground: '#e6f1ff', surface: '#121a2e', dark: true },
  midnight: { accent: '#7c8cff', background: '#0a0a12', foreground: '#dfe3ff', surface: '#15151f', dark: true },
  daylight: { accent: '#2563eb', background: '#f7f9fc', foreground: '#0f172a', surface: '#ffffff', dark: false },
  matrix: { accent: '#22c55e', background: '#03120a', foreground: '#d7ffe6', surface: '#07251a', dark: true },
  minimal: { accent: '#94a3b8', background: '#0e0e10', foreground: '#e5e5e5', surface: '#161618', dark: true },
};

export function defaultPrefs(preset = 'aurora'): ThemePrefs {
  const base: ThemePrefs = {
    accent: '#5eead4', background: '#0b1020', foreground: '#e6f1ff', surface: '#121a2e',
    density: 'comfortable', glow: false, glowIntensity: 0.4, dark: true,
  };
  return { ...base, ...(PRESETS[preset] ?? {}) };
}

const DENSITY_PADDING: Record<ThemePrefs['density'], string> = {
  compact: '6px',
  comfortable: '10px',
  spacious: '16px',
};

export function resolveTheme(mode: UiMode, prefs: Partial<ThemePrefs> = {}): ResolvedTheme {
  const merged = { ...defaultPrefs(), ...prefs };
  const cssVars: Record<string, string> = {
    '--accent': merged.accent,
    '--bg': merged.background,
    '--fg': merged.foreground,
    '--surface': merged.surface,
    '--pad': DENSITY_PADDING[merged.density],
    '--glow': merged.glow ? `0 0 ${Math.round(20 * merged.glowIntensity)}px ${merged.accent}` : 'none',
  };

  // Mode adjustments: reader/zen/presentation reduce chrome and increase focus.
  if (mode === 'reader' || mode === 'zen') {
    cssVars['--chrome-opacity'] = '0';
    cssVars['--content-max-width'] = mode === 'reader' ? '720px' : '100%';
  } else if (mode === 'presentation') {
    cssVars['--chrome-opacity'] = '0';
    cssVars['--content-max-width'] = '100%';
    cssVars['--pad'] = DENSITY_PADDING.spacious;
  } else if (mode === 'focus') {
    cssVars['--chrome-opacity'] = '0.15';
  }

  const bodyClass = `theme-${merged.dark ? 'dark' : 'light'} mode-${mode}`;
  return { mode, prefs: merged, cssVars, bodyClass };
}

export function applyThemeToDocument(doc: { documentElement: { style: { setProperty(k: string, v: string): void }; classList: { add(...c: string[]): void } }; body: { className: string } }, resolved: ResolvedTheme): void {
  for (const [k, v] of Object.entries(resolved.cssVars)) {
    doc.documentElement.style.setProperty(k, v);
  }
  doc.documentElement.classList.add(resolved.bodyClass.split(' ')[0]);
  doc.body.className = resolved.bodyClass;
}
