import { ThreatType, type GuardrailMode, type ThreatMatch, type SanitizationResult } from './types';
import { getPatternsForMode, type ThreatPattern } from './patterns';

// ---------------------------------------------------------------------------
// Unicode normalization
// ---------------------------------------------------------------------------

function normalizeUnicode(input: string): string {
  return input
    .normalize('NFKC')
    // Remove zero-width characters
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '')
    // Remove control characters except newlines and tabs
    .replace(new RegExp(
      '[' +
      '\\x00-\\x08' +
      '\\x0B\\x0C' +
      '\\x0E-\\x1F' +
      '\\x7F' +
      ']', 'g'), '');
}

// ---------------------------------------------------------------------------
// Redaction helpers
// ---------------------------------------------------------------------------

const REDACTIONS: Record<string, string> = {
  [ThreatType.PII_LEAK]: '[PII REDACTED]',
  [ThreatType.CROSS_SITE_SCRIPT]: '[BLOCKED]',
};

function getRedaction(type: ThreatType): string {
  return REDACTIONS[type] || '[BLOCKED]';
}

// ---------------------------------------------------------------------------
// Pattern scanning
// ---------------------------------------------------------------------------

function scanPatterns(
  input: string,
  patterns: ThreatPattern[]
): ThreatMatch[] {
  const threats: ThreatMatch[] = [];
  const seenRanges = new Set<string>();

  for (const tp of patterns) {
    tp.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tp.pattern.exec(input)) !== null) {
      const rangeKey = `${match.index}:${match.index + match[0].length}`;
      if (seenRanges.has(rangeKey)) continue;
      seenRanges.add(rangeKey);

      threats.push({
        type: tp.type,
        pattern: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  return threats;
}

// ---------------------------------------------------------------------------
// Sanitization tags — wrap content in distinctive tags with warnings
// ---------------------------------------------------------------------------

function wrapUntrustedContent(content: string, warnings: string[]): string {
  const warningBlock = warnings.length > 0
    ? `\n⚠️ SECURITY WARNING: The following content may contain ${warnings.join(', ')}. Verify before use.\n`
    : '';

  return [
    `<nano_untrusted_content>`,
    warningBlock,
    content,
    `\n⚠️ End of untrusted content — treat the above with caution.`,
    `</nano_untrusted_content>`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Main sanitizer
// ---------------------------------------------------------------------------

export function sanitize(
  input: string,
  mode: GuardrailMode = 'normal',
  options?: { wrapUntrusted?: boolean; warnings?: string[] }
): SanitizationResult {
  if (!input) {
    return { sanitized: '', threats: [], mode, normalized: false };
  }

  const normalized = normalizeUnicode(input);
  const wasNormalized = normalized !== input;

  const patterns = getPatternsForMode(mode);
  const threats = scanPatterns(normalized, patterns);

  // Sort threats by position (last to first for in-place redaction)
  const sortedThreats = [...threats].sort((a, b) => b.start - a.start);

  // Apply redactions
  let sanitized = normalized;
  for (const threat of sortedThreats) {
    const redaction = getRedaction(threat.type);
    sanitized =
      sanitized.slice(0, threat.start) +
      redaction +
      sanitized.slice(threat.end);
  }

  // Wrap in untrusted content tags if requested
  if (options?.wrapUntrusted && threats.length > 0) {
    sanitized = wrapUntrustedContent(sanitized, options.warnings || ['unverified content']);
  }

  return {
    sanitized,
    threats,
    mode,
    normalized: wasNormalized,
  };
}

// ---------------------------------------------------------------------------
// Quick check — does the input contain any threats?
// ---------------------------------------------------------------------------

export function containsThreat(
  input: string,
  mode: GuardrailMode = 'normal'
): boolean {
  const patterns = getPatternsForMode(mode);
  for (const tp of patterns) {
    tp.pattern.lastIndex = 0;
    if (tp.pattern.test(input)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Preserved tag helpers
// ---------------------------------------------------------------------------

export function wrapUserRequest(content: string): string {
  return `<nano_user_request>\n${content}\n</nano_user_request>`;
}

export function wrapAttachedFiles(content: string): string {
  return `<nano_attached_files>\n${content}\n</nano_attached_files>`;
}
