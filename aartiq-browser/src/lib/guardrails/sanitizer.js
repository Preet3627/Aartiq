"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitize = sanitize;
exports.containsThreat = containsThreat;
exports.wrapUserRequest = wrapUserRequest;
exports.wrapAttachedFiles = wrapAttachedFiles;
const types_1 = require("./types");
const patterns_1 = require("./patterns");
// ---------------------------------------------------------------------------
// Unicode normalization
// ---------------------------------------------------------------------------
function normalizeUnicode(input) {
    return input
        .normalize('NFKC')
        // Remove zero-width characters
        .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '')
        // Remove control characters except newlines and tabs
        .replace(new RegExp('[' +
        '\\x00-\\x08' +
        '\\x0B\\x0C' +
        '\\x0E-\\x1F' +
        '\\x7F' +
        ']', 'g'), '');
}
// ---------------------------------------------------------------------------
// Redaction helpers
// ---------------------------------------------------------------------------
const REDACTIONS = {
    [types_1.ThreatType.PII_LEAK]: '[PII REDACTED]',
    [types_1.ThreatType.CROSS_SITE_SCRIPT]: '[BLOCKED]',
};
function getRedaction(type) {
    return REDACTIONS[type] || '[BLOCKED]';
}
// ---------------------------------------------------------------------------
// Pattern scanning
// ---------------------------------------------------------------------------
function scanPatterns(input, patterns) {
    const threats = [];
    const seenRanges = new Set();
    for (const tp of patterns) {
        tp.pattern.lastIndex = 0;
        let match;
        while ((match = tp.pattern.exec(input)) !== null) {
            const rangeKey = `${match.index}:${match.index + match[0].length}`;
            if (seenRanges.has(rangeKey))
                continue;
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
function wrapUntrustedContent(content, warnings) {
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
function sanitize(input, mode = 'normal', options) {
    if (!input) {
        return { sanitized: '', threats: [], mode, normalized: false };
    }
    const normalized = normalizeUnicode(input);
    const wasNormalized = normalized !== input;
    const patterns = (0, patterns_1.getPatternsForMode)(mode);
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
function containsThreat(input, mode = 'normal') {
    const patterns = (0, patterns_1.getPatternsForMode)(mode);
    for (const tp of patterns) {
        tp.pattern.lastIndex = 0;
        if (tp.pattern.test(input))
            return true;
    }
    return false;
}
// ---------------------------------------------------------------------------
// Preserved tag helpers
// ---------------------------------------------------------------------------
function wrapUserRequest(content) {
    return `<nano_user_request>\n${content}\n</nano_user_request>`;
}
function wrapAttachedFiles(content) {
    return `<nano_attached_files>\n${content}\n</nano_attached_files>`;
}
