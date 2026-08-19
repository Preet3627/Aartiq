import { resolveTheme, defaultPrefs, PRESETS } from '../lib/theme/resolver';

describe('Theme resolver — themes + UI modes', () => {
  it('produces CSS variables from a preset', () => {
    const r = resolveTheme('normal', defaultPrefs('aurora'));
    expect(r.cssVars['--accent']).toBe('#5eead4');
    expect(r.bodyClass).toContain('theme-dark');
  });

  it('reader mode hides chrome and narrows content', () => {
    const r = resolveTheme('reader', defaultPrefs('midnight'));
    expect(r.cssVars['--chrome-opacity']).toBe('0');
    expect(r.cssVars['--content-max-width']).toBe('720px');
  });

  it('respects custom overrides', () => {
    const r = resolveTheme('focus', { accent: '#ff0000' });
    expect(r.cssVars['--accent']).toBe('#ff0000');
    expect(r.bodyClass).toContain('mode-focus');
  });

  it('exposes multiple presets', () => {
    expect(Object.keys(PRESETS).length).toBeGreaterThanOrEqual(4);
  });
});
