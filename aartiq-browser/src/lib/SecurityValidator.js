const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//i,
  /:\s*\|/i,
  /\\x[0-9a-f]{2}/i,
  /\$\([^)]+\)/,
  /`[^`]+`/,
  /;\s*rm\s/i,
  /mkfs/i,
  /dd\s+if=/i,
  /[>|]\/dev\/sd/i,
  /:\|/i,
];

const SHELL_SANITIZE_PATTERNS = [
  /[;&|`$<>]/g,
  /[\\]/g,
];

const COMMAND_WHITELIST = new Set([
  'ls', 'cd', 'pwd', 'mkdir', 'touch', 'cat', 'grep', 'find', 'echo',
  'curl', 'wget', 'git', 'npm', 'node', 'python', 'python3',
  'open', 'code', ' subl', 'vim', 'nano',
]);

const BLOCKED_COMMANDS = new Set([
  'sudo', 'su', 'passwd', 'chmod', 'chown', 'chgrp',
  'rm', 'del', 'format', 'fdisk', 'dd',
  'shutdown', 'reboot', 'halt', 'poweroff',
  'iptables', 'ufw', 'firewall-cmd',
  'mount', 'umount', 'eject',
]);

const AUTO_EXEC_ALLOWED = new Set([
  'NAVIGATE', 'SHELL_COMMAND_LIGHT',
]);

const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

function sanitizeShellCommand(command) {
  if (!command || typeof command !== 'string') {
    return '';
  }
  
  let sanitized = command.trim();
  
  for (const pattern of SHELL_SANITIZE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }
  
  return sanitized;
}

function containsDangerousPattern(input) {
  if (!input || typeof input !== 'string') {
    return false;
  }
  
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(input));
}

function validateCommand(command) {
  const errors = [];
  const warnings = [];
  
  if (!command || typeof command !== 'string') {
    return { valid: false, errors: ['Command must be a non-empty string'] };
  }
  
  if (command.length > 10000) {
    errors.push('Command exceeds maximum length of 10000 characters');
  }
  
  if (containsDangerousPattern(command)) {
    errors.push('Command contains dangerous patterns');
  }
  
  const firstWord = command.trim().split(/\s+/)[0].toLowerCase();
  
  if (BLOCKED_COMMANDS.has(firstWord)) {
    errors.push(`Command "${firstWord}" is blocked for security reasons`);
  }
  
  if (command.includes('..')) {
    warnings.push('Command contains path traversal pattern (..)');
  }
  
  if (command.includes('$(') || command.includes('`')) {
    warnings.push('Command contains command substitution');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateOcrCoordinates(x, y, screenBounds) {
  const errors = [];
  
  if (typeof x !== 'number' || typeof y !== 'number') {
    errors.push('Coordinates must be numbers');
    return { valid: false, errors };
  }
  
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    errors.push('Coordinates must be finite numbers');
  }
  
  if (x < 0 || y < 0) {
    errors.push('Coordinates cannot be negative');
  }
  
  if (screenBounds) {
    if (x > screenBounds.width || y > screenBounds.height) {
      errors.push('Coordinates are outside screen bounds');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateFilePath(filePath, allowedDirs = []) {
  const errors = [];
  
  if (!filePath || typeof filePath !== 'string') {
    errors.push('File path must be a non-empty string');
    return { valid: false, errors };
  }
  
  if (filePath.includes('..')) {
    errors.push('File path contains path traversal (../)');
  }
  
  if (filePath.includes('\0')) {
    errors.push('File path contains null byte');
  }
  
  const resolvedPath = path.resolve(filePath);
  
  if (allowedDirs.length > 0) {
    const isAllowed = allowedDirs.some(dir => 
      resolvedPath.startsWith(path.resolve(dir))
    );
    
    if (!isAllowed) {
      errors.push('File path is not in allowed directories');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    resolvedPath,
  };
}

function validateUrl(url) {
  const errors = [];
  
  if (!url || typeof url !== 'string') {
    errors.push('URL must be a non-empty string');
    return { valid: false, errors };
  }
  
  try {
    const parsed = new URL(url);
    
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      errors.push('URL must use HTTP or HTTPS protocol');
    }
    
    if (parsed.hostname === 'localhost' || /^127\./.test(parsed.hostname)) {
      errors.push('Access to localhost is restricted');
    }
    
    return { valid: errors.length === 0, errors, parsed };
  } catch (e) {
    errors.push('Invalid URL format');
    return { valid: false, errors };
  }
}

function validateAiCommand(command) {
  const errors = [];
  const warnings = [];
  
  if (!command || typeof command !== 'object') {
    errors.push('AI command must be an object');
    return { valid: false, errors };
  }
  
  const knownCommands = [
    'NAVIGATE', 'SHELL_COMMAND', 'CREATE_PDF', 'CREATE_PDF_JSON',
    'CLICK_ELEMENT', 'FIND_AND_CLICK', 'OCR_SCREEN', 'OCR_COORDINATES',
    'SET_VOLUME', 'OPEN_APP', 'SCROLL_DOWN', 'SCROLL_UP',
    'SHELL_COMMAND_LIGHT', 'SCHEDULE_TASK', 'PLUGIN_COMMAND',
  ];
  
  if (command.command && !knownCommands.includes(command.command)) {
    warnings.push(`Unknown command type: ${command.command}`);
  }
  
  if (command.params) {
    if (command.params.path && typeof command.params.path === 'string') {
      const pathValidation = validateFilePath(command.params.path);
      if (!pathValidation.valid) {
        errors.push(...pathValidation.errors.map(e => `path: ${e}`));
      }
    }
    
    if (command.params.url && typeof command.params.url === 'string') {
      const urlValidation = validateUrl(command.params.url);
      if (!urlValidation.valid) {
        errors.push(...urlValidation.errors.map(e => `url: ${e}`));
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function getRiskLevel(commandType) {
  const riskMap = {
    'NAVIGATE': RISK_LEVELS.LOW,
    'SHELL_COMMAND_LIGHT': RISK_LEVELS.LOW,
    'CREATE_PDF': RISK_LEVELS.LOW,
    'CREATE_PDF_JSON': RISK_LEVELS.LOW,
    'SET_VOLUME': RISK_LEVELS.LOW,
    'SCROLL_DOWN': RISK_LEVELS.LOW,
    'SCROLL_UP': RISK_LEVELS.LOW,
    'OCR_SCREEN': RISK_LEVELS.MEDIUM,
    'OCR_COORDINATES': RISK_LEVELS.MEDIUM,
    'OPEN_APP': RISK_LEVELS.MEDIUM,
    'SHELL_COMMAND': RISK_LEVELS.HIGH,
    'CLICK_ELEMENT': RISK_LEVELS.HIGH,
    'FIND_AND_CLICK': RISK_LEVELS.HIGH,
    'SCHEDULE_TASK': RISK_LEVELS.HIGH,
    'PLUGIN_COMMAND': RISK_LEVELS.HIGH,
  };
  
  return riskMap[commandType] || RISK_LEVELS.MEDIUM;
}

function canAutoExecute(commandType) {
  return AUTO_EXEC_ALLOWED.has(commandType);
}

class SecurityValidator {
  constructor(options = {}) {
    this.allowedDirs = options.allowedDirs || [
      os.homedir(),
      '/tmp',
      '/Applications',
      '/System/Applications',
    ];
    this.enableDeepValidation = options.enableDeepValidation !== false;
  }

  validateShell(command) {
    return validateCommand(command);
  }

  validateAiCommand(command) {
    return validateAiCommand(command);
  }

  validateFilePath(filePath) {
    return validateFilePath(filePath, this.allowedDirs);
  }

  validateUrl(url) {
    return validateUrl(url);
  }

  validateCoordinates(x, y, bounds) {
    return validateOcrCoordinates(x, y, bounds);
  }

  sanitizeCommand(command) {
    return sanitizeShellCommand(command);
  }

  getRiskLevel(commandType) {
    return getRiskLevel(commandType);
  }

  canAutoExecute(commandType) {
    return canAutoExecute(commandType);
  }
}

const globalValidator = new SecurityValidator();

module.exports = {
  SecurityValidator,
  globalValidator,
  validateCommand,
  validateAiCommand,
  validateFilePath,
  validateUrl,
  validateOcrCoordinates,
  sanitizeShellCommand,
  containsDangerousPattern,
  getRiskLevel,
  canAutoExecute,
  RISK_LEVELS,
  BLOCKED_COMMANDS,
  DANGEROUS_PATTERNS,
};
