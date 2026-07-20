const { exec, spawn } = require('child_process');
const Store = require('electron-store');
const { validateCommand: securityValidate, getShellRisk } = require('../../lib/SecurityValidator');

const permissionStore = new Store({ name: 'comet-permissions' });

function validateCommand(cmd) {
  if (!cmd || typeof cmd !== 'string') {
    throw new Error('Invalid command: command must be a non-empty string');
  }
  const trimmed = cmd.trim();
  if (trimmed.length === 0) {
    throw new Error('Invalid command: empty command');
  }
  if (trimmed.length > 10000) {
    throw new Error('Command too long (max 10000 characters)');
  }
  // Delegate dangerous-pattern and blocked-command checks to SecurityValidator.
  const result = securityValidate(trimmed);
  if (!result.valid) {
    throw new Error(result.errors.join('; '));
  }
  return trimmed;
}

function analyzeCommandRisk(cmd) {
  // Delegate to the single-source-of-truth risk classifier.
  return getShellRisk(cmd);
}

function explainCommand(cmd) {
  const cmds = {
    'ls': 'List directory contents',
    'll': 'List detailed directory contents',
    'cd': 'Change directory',
    'pwd': 'Print working directory',
    'cat': 'Display file contents',
    'mkdir': 'Create a new directory',
    'touch': 'Create an empty file',
    'rm': 'Remove a file',
    'cp': 'Copy files or directories',
    'mv': 'Move or rename files',
    'curl': 'Fetch data from URL',
    'wget': 'Download files from URL',
    'git': 'Git version control',
    'npm': 'Node package manager',
    'npx': 'Execute npm packages',
    'node': 'Run Node.js scripts',
    'python': 'Run Python scripts',
    'open': 'Open files or applications',
  };
  const firstWord = cmd.split(/\s+/)[0].toLowerCase();
  return cmds[firstWord] || `Execute command: ${firstWord}`;
}

function checkShellPermission(command, reason, riskLevel = 'medium') {
  const cmdKey = `command_${command.split(' ')[0]}`;
  if (permissionStore.get(cmdKey)) {
    return true;
  }
  if (permissionStore.get('shell_all')) {
    return true;
  }
  return false;
}

module.exports = {
  validateCommand,
  analyzeCommandRisk,
  explainCommand,
  checkShellPermission,
  permissionStore
};