/**
 * Comet AI Sidebar Configuration
 * Adapted from Thuki by Logan Nguyen (Apache 2.0)
 */

function envInt(key: string, fallback: number): number {
  const raw = import.meta.env[key];
  if (raw == null || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export const quote = {
  maxDisplayLines: envInt('VITE_QUOTE_MAX_DISPLAY_LINES', 4),
  maxDisplayChars: envInt('VITE_QUOTE_MAX_DISPLAY_CHARS', 300),
  maxContextLength: envInt('VITE_QUOTE_MAX_CONTEXT_LENGTH', 4096),
} as const;

export const APP_NAME = 'Comet';
export const APP_NAME_FULL = 'Comet AI';
