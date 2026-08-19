"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_PATTERNS = void 0;
exports.getPatternsForMode = getPatternsForMode;
const types_1 = require("./types");
// Critical threats — always detected in both modes
const CRITICAL = [
    {
        type: types_1.ThreatType.PROMPT_INJECTION,
        pattern: /ignore\s+(previous|all|your|above|prior|system)\s+(instructions?|prompt|rules?|constraints?)/i,
        severity: 'critical',
        modes: ['normal', 'strict'],
    },
    {
        type: types_1.ThreatType.PROMPT_INJECTION,
        pattern: /\byou\s+are\s+(now\s+)?(?:a|an)\s+(?:different|evil|unrestricted|unfiltered|jailbroken|DAN|GPT-?\d*)\b/i,
        severity: 'critical',
        modes: ['normal', 'strict'],
    },
    {
        type: types_1.ThreatType.PROMPT_INJECTION,
        pattern: /\b(?:bypass|disable|override)\s+(?:safety|filter|restriction|content|moderation|guardrail)/i,
        severity: 'critical',
        modes: ['normal', 'strict'],
    },
    {
        type: types_1.ThreatType.DANGEROUS_COMMAND,
        pattern: /\b(?:rm\s+-rf\s+\/|mkfs\.|dd\s+if=|:\(\)\s*\{|:\)\s*\|)/i,
        severity: 'critical',
        modes: ['normal', 'strict'],
    },
    {
        type: types_1.ThreatType.DATA_EXFILTRATION,
        pattern: /\b(?:exfiltrate|exfil|data\s+leak|steal\s+data|upload\s+to\s+remote|send\s+to\s+attacker)/i,
        severity: 'critical',
        modes: ['normal', 'strict'],
    },
];
// High threats — detected in both modes
const HIGH = [
    {
        type: types_1.ThreatType.PROMPT_INJECTION,
        pattern: /\b(?:reveal|show|tell\s+me|print|leak|expose|output|dump)\s+.*\bsystem\s+prompt\b/i,
        severity: 'high',
        modes: ['normal', 'strict'],
    },
    {
        type: types_1.ThreatType.PROMPT_INJECTION,
        pattern: /\b(?:what\s+is|what\s+are)\s+(?:in|inside)\s+(?:your|the)\s+(?:memory|cache|context|session)/i,
        severity: 'high',
        modes: ['normal', 'strict'],
    },
    {
        type: types_1.ThreatType.ENCODED_PAYLOAD,
        pattern: /(?:\\x[0-9a-f]{2}|\\u[0-9a-f]{4}|%[0-9a-f]{2}[0-9a-f]{2}){4,}/i,
        severity: 'high',
        modes: ['normal', 'strict'],
    },
    {
        type: types_1.ThreatType.SUSPICIOUS_URL,
        pattern: /https?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\/?(?:[^\s]*)/,
        severity: 'high',
        modes: ['normal', 'strict'],
    },
];
// Medium threats — strict mode only
const MEDIUM = [
    {
        type: types_1.ThreatType.PII_LEAK,
        pattern: /\b(?:\d{3}-\d{2}-\d{4}|\d{9})\b/g,
        severity: 'medium',
        modes: ['strict'],
    },
    {
        type: types_1.ThreatType.PII_LEAK,
        pattern: /\b(?:Bearer\s+[A-Za-z0-9_-]{20,}|token\s*[:=]\s*['"]?[A-Za-z0-9_-]{20,})/gi,
        severity: 'medium',
        modes: ['strict'],
    },
    {
        type: types_1.ThreatType.CROSS_SITE_SCRIPT,
        pattern: /<script[\s>].*?<\/script>/gi,
        severity: 'medium',
        modes: ['strict'],
    },
    {
        type: types_1.ThreatType.CROSS_SITE_SCRIPT,
        pattern: /javascript:\s*(?:eval|alert|confirm|prompt|document\.cookie|fetch|XMLHttpRequest)\s*\(/i,
        severity: 'medium',
        modes: ['strict'],
    },
    {
        type: types_1.ThreatType.SUSPICIOUS_URL,
        pattern: /https?:\/\/[^\s]*\.(?:xyz|tk|ml|ga|cf|gq|top|loan|work|date|racing|win|bid|trade|webcam|science|review|stream|download|myftpupload)/i,
        severity: 'medium',
        modes: ['strict'],
    },
    {
        type: types_1.ThreatType.PROMPT_INJECTION,
        pattern: /\b(?:repeat|say\s+again|echo)\s+(?:the|your|all|every)\s+(?:text|word|character|letter)\s+(?:above|before|prior|earlier)/i,
        severity: 'medium',
        modes: ['strict'],
    },
];
// Low threats — strict mode only
const LOW = [
    {
        type: types_1.ThreatType.ZERO_WIDTH_CHAR,
        pattern: /[\u200B-\u200F\u2028-\u202F\uFEFF]/,
        severity: 'low',
        modes: ['strict'],
    },
    {
        type: types_1.ThreatType.PII_LEAK,
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
        severity: 'low',
        modes: ['strict'],
    },
];
exports.ALL_PATTERNS = [...CRITICAL, ...HIGH, ...MEDIUM, ...LOW];
function getPatternsForMode(mode) {
    return exports.ALL_PATTERNS.filter(p => p.modes.includes(mode));
}
