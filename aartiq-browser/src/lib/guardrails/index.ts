export { ThreatType, GuardrailMode } from './types';
export type { ThreatMatch, SanitizationResult } from './types';

export {
  sanitize,
  containsThreat,
  wrapUserRequest,
  wrapAttachedFiles,
  normalizeUnicode,
} from './sanitizer';

export { ALL_PATTERNS, getPatternsForMode } from './patterns';
export type { ThreatPattern } from './patterns';

// ---------------------------------------------------------------------------
// SecurityGuardrails class — two-tier (normal/strict)
// ---------------------------------------------------------------------------

import { type GuardrailMode, type SanitizationResult } from './types';
import { sanitize, containsThreat } from './sanitizer';

export class SecurityGuardrails {
  private mode: GuardrailMode;

  constructor(mode: GuardrailMode = 'normal') {
    this.mode = mode;
  }

  setMode(mode: GuardrailMode): void {
    this.mode = mode;
  }

  getMode(): GuardrailMode {
    return this.mode;
  }

  sanitize(
    input: string,
    options?: { wrapUntrusted?: boolean; warnings?: string[] }
  ): SanitizationResult {
    return sanitize(input, this.mode, options);
  }

  containsThreat(input: string): boolean {
    return containsThreat(input, this.mode);
  }

  checkAndSanitize(
    input: string,
    options?: { wrapUntrusted?: boolean; warnings?: string[] }
  ): { safe: boolean; result: SanitizationResult } {
    const result = this.sanitize(input, options);
    return {
      safe: result.threats.length === 0,
      result,
    };
  }
}

// ---------------------------------------------------------------------------
// Re-export the normalize function from sanitizer (for internal use)
// ---------------------------------------------------------------------------

function normalizeUnicode(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '')
    .replace(new RegExp(
      '[' +
      '\\x00-\\x08' +
      '\\x0B\\x0C' +
      '\\x0E-\\x1F' +
      '\\x7F' +
      ']', 'g'), '');
}
export { normalizeUnicode };
