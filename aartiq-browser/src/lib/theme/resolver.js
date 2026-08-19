"use strict";
/**
 * Theme resolver — visual themes and UI modes.
 *
 * Produces a set of CSS variables + a body class for a chosen UI mode
 * (normal | focus | reader | zen | presentation). Modes change layout density
 * and chrome visibility, not just colors, so the agent UI can get out of the way
 * during long autonomous runs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRESETS = void 0;
exports.defaultPrefs = defaultPrefs;
exports.resolveTheme = resolveTheme;
exports.applyThemeToDocument = applyThemeToDocument;
exports.PRESETS = {
    aurora: { accent: '#5eead4', background: '#0b1020', foreground: '#e6f1ff', surface: '#121a2e', dark: true },
    midnight: { accent: '#7c8cff', background: '#0a0a12', foreground: '#dfe3ff', surface: '#15151f', dark: true },
    daylight: { accent: '#2563eb', background: '#f7f9fc', foreground: '#0f172a', surface: '#ffffff', dark: false },
    matrix: { accent: '#22c55e', background: '#03120a', foreground: '#d7ffe6', surface: '#07251a', dark: true },
    minimal: { accent: '#94a3b8', background: '#0e0e10', foreground: '#e5e5e5', surface: '#161618', dark: true },
};
function defaultPrefs(preset = 'aurora') {
    const base = {
        accent: '#5eead4', background: '#0b1020', foreground: '#e6f1ff', surface: '#121a2e',
        density: 'comfortable', glow: false, glowIntensity: 0.4, dark: true,
    };
    return { ...base, ...(exports.PRESETS[preset] ?? {}) };
}
const DENSITY_PADDING = {
    compact: '6px',
    comfortable: '10px',
    spacious: '16px',
};
function resolveTheme(mode, prefs = {}) {
    const merged = { ...defaultPrefs(), ...prefs };
    const cssVars = {
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
    }
    else if (mode === 'presentation') {
        cssVars['--chrome-opacity'] = '0';
        cssVars['--content-max-width'] = '100%';
        cssVars['--pad'] = DENSITY_PADDING.spacious;
    }
    else if (mode === 'focus') {
        cssVars['--chrome-opacity'] = '0.15';
    }
    const bodyClass = `theme-${merged.dark ? 'dark' : 'light'} mode-${mode}`;
    return { mode, prefs: merged, cssVars, bodyClass };
}
function applyThemeToDocument(doc, resolved) {
    for (const [k, v] of Object.entries(resolved.cssVars)) {
        doc.documentElement.style.setProperty(k, v);
    }
    doc.documentElement.classList.add(resolved.bodyClass.split(' ')[0]);
    doc.body.className = resolved.bodyClass;
}
