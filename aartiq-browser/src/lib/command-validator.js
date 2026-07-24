// ============================================================================
// command-validator.js — Pre-execution command validation with word-boundary
// security. Implements audit-before-validation pattern: every command is logged
// before checking, ensuring full visibility even when validation blocks it.
//
// Inspired by comet-t's command-sandbox.ts approach.
// ============================================================================

const fs = require('fs');
const path = require('path');

const WORD_BOUNDARY = '(^|\\s|[/\\\\])';
const WORD_END = '(\\s|$|&|;|\\||>|<|\\))';

function wordBoundaryRegex(cmd) {
  return new RegExp(WORD_BOUNDARY + escapeRegex(cmd) + WORD_END, 'i');
}

function multiWordRegex(cmd) {
  const escaped = escapeRegex(cmd);
  return new RegExp(WORD_BOUNDARY + escaped + WORD_END, 'i');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let policyCache = null;
let policyLoadError = null;

function loadPolicy() {
  if (policyCache) return policyCache;
  try {
    const configPath = path.resolve(__dirname, '../../config/command-policy.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    policyCache = JSON.parse(raw);
    return policyCache;
  } catch (err) {
    policyLoadError = err;
    console.error('[CommandValidator] Failed to load policy:', err.message);
    return getDefaultPolicy();
  }
}

function getDefaultPolicy() {
  return {
    blockedCommands: ['sudo', 'su', 'passwd', 'shutdown', 'reboot', 'halt', 'poweroff'],
    blockedPatterns: ['rm -rf /', 'rm -rf ~', 'base64 -d', 'chmod 777', 'chown root'],
    approvalRequiredCommands: [],
    safeCommands: ['ls', 'pwd', 'echo', 'cat', 'head', 'tail', 'grep', 'find', 'date', 'whoami'],
  };
}

// ---------------------------------------------------------------------------
// Audit log (in-memory ring buffer, last 500 entries)
// ---------------------------------------------------------------------------
const auditLog = [];
const MAX_AUDIT_LOG = 500;

function auditEntry(entry) {
  auditLog.push({
    ...entry,
    timestamp: Date.now(),
  });
  if (auditLog.length > MAX_AUDIT_LOG) {
    auditLog.splice(0, auditLog.length - MAX_AUDIT_LOG);
  }
}

function getAuditLog() {
  return [...auditLog];
}

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------
const VERDICT = {
  ALLOW: 'allow',
  BLOCK: 'block',
  APPROVAL_REQUIRED: 'approval_required',
};

// ---------------------------------------------------------------------------
// Core validation
// ---------------------------------------------------------------------------

function validateCommand(command, context = {}) {
  // 1. AUDIT FIRST — log every command before validation
  auditEntry({
    command,
    context,
    action: 'pre_validate',
  });

  const result = {
    verdict: VERDICT.ALLOW,
    command,
    reasons: [],
    riskLevel: 'low',
    category: 'unknown',
  };

  if (!command || typeof command !== 'string') {
    result.verdict = VERDICT.BLOCK;
    result.reasons.push('Command must be a non-empty string');
    result.riskLevel = 'medium';
    return result;
  }

  const trimmed = command.trim();
  if (trimmed.length === 0) {
    result.verdict = VERDICT.BLOCK;
    result.reasons.push('Command is empty after trimming');
    return result;
  }

  const policy = loadPolicy();
  const firstWord = trimmed.split(/\s+/)[0].toLowerCase();

  // ---- 2. CHECK BLOCKED COMMANDS (word-boundary) ----
  for (const blocked of policy.blockedCommands) {
    if (wordBoundaryRegex(blocked).test(trimmed)) {
      result.verdict = VERDICT.BLOCK;
      result.reasons.push(`Command "${blocked}" is blocked by policy`);
      result.riskLevel = 'high';
      result.category = 'blocked_command';
      return result;
    }
  }

  // ---- 3. CHECK BLOCKED PATTERNS (word-boundary) ----
  for (const pattern of policy.blockedPatterns) {
    if (wordBoundaryRegex(pattern).test(trimmed)) {
      result.verdict = VERDICT.BLOCK;
      result.reasons.push(`Dangerous pattern detected: "${pattern}"`);
      result.riskLevel = 'critical';
      result.category = 'dangerous_pattern';
      return result;
    }
  }

  // ---- 4. CHECK MULTI-WORD DANGEROUS PATTERNS ----
  const dangerousMultiWordPatterns = [
    'rm -rf', 'rm -r /', 'rm -rf /', 'rm -rf ~',
    'curl.*| bash', 'curl.*| sh', 'wget.*| bash',
    'base64 -d', 'base64 --decode',
    'chmod 777', 'chmod -R 777',
    ':()', 'fork bomb',
    'dd if=', 'mkfs.',
    '| bash', '| sh', '| zsh',
    '>/dev/sda', '>/dev/sdb',
  ];
  for (const pattern of dangerousMultiWordPatterns) {
    if (multiWordRegex(pattern).test(trimmed)) {
      result.verdict = VERDICT.BLOCK;
      result.reasons.push(`Dangerous pattern detected: "${pattern}"`);
      result.riskLevel = 'critical';
      result.category = 'dangerous_pattern';
      return result;
    }
  }

  // ---- 5. CHECK SHELL INJECTION PATTERNS ----
  const injectionPatterns = [
    /[;|&]\s*(sudo|su)\s/i,
    /\$\(.*\)/,
    /`.*`/,
    /\\x[0-9a-f]{2}/i,
    /;\s*rm\s/i,
  ];
  for (const pattern of injectionPatterns) {
    if (pattern.test(trimmed)) {
      result.verdict = VERDICT.BLOCK;
      result.reasons.push('Shell injection pattern detected');
      result.riskLevel = 'critical';
      result.category = 'injection';
      return result;
    }
  }

  // ---- 6. CHECK APPROVAL-REQUIRED COMMANDS ----
  for (const approvalCmd of policy.approvalRequiredCommands) {
    if (wordBoundaryRegex(approvalCmd).test(trimmed)) {
      result.verdict = VERDICT.APPROVAL_REQUIRED;
      result.reasons.push(`Command "${approvalCmd}" requires explicit approval`);
      result.riskLevel = 'medium';
      result.category = 'approval_required';
      break;
    }
  }

  // ---- 7. CHECK SAFE COMMANDS ----
  if (result.verdict === VERDICT.ALLOW) {
    for (const safe of policy.safeCommands) {
      const safeFirstWord = safe.split(/\s+/)[0].toLowerCase();
      if (firstWord === safeFirstWord) {
        result.riskLevel = 'low';
        result.category = 'safe_command';
        return result;
      }
    }

    // If first word didn't match any safe command but also wasn't blocked,
    // mark as medium risk (unknown command)
    if (result.verdict === VERDICT.ALLOW) {
      result.riskLevel = 'medium';
      result.category = 'unknown_command';
    }
  }

  // ---- 8. AUDIT RESULT ----
  auditEntry({
    command,
    verdict: result.verdict,
    riskLevel: result.riskLevel,
    reasons: result.reasons,
    context,
    action: 'post_validate',
  });

  return result;
}

// ---------------------------------------------------------------------------
// Batch validation
// ---------------------------------------------------------------------------

function validateCommands(commands, context = {}) {
  if (!Array.isArray(commands)) {
    return {
      results: [validateCommand(String(commands), context)],
      blocked: true,
      summary: { total: 1, blocked: 1, approvalRequired: 0, allowed: 0 },
    };
  }

  const results = commands.map(cmd => validateCommand(cmd, context));
  const blocked = results.some(r => r.verdict === VERDICT.BLOCK);
  const approvalRequired = results.some(r => r.verdict === VERDICT.APPROVAL_REQUIRED);
  const allowed = results.every(r => r.verdict === VERDICT.ALLOW);

  return {
    results,
    blocked,
    approvalRequired,
    allowed,
    summary: {
      total: results.length,
      blocked: results.filter(r => r.verdict === VERDICT.BLOCK).length,
      approvalRequired: results.filter(r => r.verdict === VERDICT.APPROVAL_REQUIRED).length,
      allowed: results.filter(r => r.verdict === VERDICT.ALLOW).length,
    },
  };
}

// ---------------------------------------------------------------------------
// Policy reload (for hot-reloading config)
// ---------------------------------------------------------------------------

function reloadPolicy() {
  policyCache = null;
  policyLoadError = null;
  return loadPolicy();
}

// ---------------------------------------------------------------------------
// URL / path / domain validation helpers
// ---------------------------------------------------------------------------

function validateUrl(url) {
  const errors = [];
  if (!url || typeof url !== 'string') {
    errors.push('URL must be a non-empty string');
    return { valid: false, errors };
  }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:', 'file:', 'about:', 'data:', 'comet:'].includes(parsed.protocol)) {
      errors.push('Unsupported protocol: ' + parsed.protocol);
    }
    return { valid: errors.length === 0, errors, parsed };
  } catch {
    errors.push('Invalid URL format');
    return { valid: false, errors };
  }
}

function validateFilePath(filePath, allowedDirs = []) {
  const errors = [];
  if (!filePath || typeof filePath !== 'string') {
    errors.push('File path must be a non-empty string');
    return { valid: false, errors };
  }
  if (filePath.includes('..')) {
    errors.push('Path traversal detected (..)');
  }
  if (filePath.includes('\0')) {
    errors.push('Null byte detected');
  }
  const resolved = path.resolve(filePath);
  if (allowedDirs.length > 0) {
    const allowed = allowedDirs.some(dir => resolved.startsWith(path.resolve(dir)));
    if (!allowed) errors.push('Path not in allowed directories');
  }
  return { valid: errors.length === 0, errors, resolvedPath: resolved };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  VERDICT,
  validateCommand,
  validateCommands,
  validateUrl,
  validateFilePath,
  getAuditLog,
  reloadPolicy,
  loadPolicy,
};
