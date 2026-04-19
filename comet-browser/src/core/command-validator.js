const { exec, spawn } = require('child_process');
const Store = require('electron-store');

const permissionStore = new Store({ name: 'comet-permissions' });

const SAFE_COMMANDS = new Set([
  'ls', 'll', 'la', 'cd', 'pwd', 'echo', 'cat', 'head', 'tail', 'grep', 'find', 'which',
  'whoami', 'date', 'cal', 'df', 'du', 'free', 'uptime', 'ps', 'kill', 'killall',
  'mkdir', 'touch', 'rm', 'rmdir', 'cp', 'mv', 'ln', 'chmod', 'chown', 'tar', 'unzip', 'zip',
  'git', 'npm', 'npx', 'node', 'python', 'python3', 'pip', 'pip3', 'ruby', 'perl', 'php',
  'curl', 'wget', 'ssh', 'scp', 'rsync', 'open', 'xdg-open', 'gnome-open', 'kde-open',
  'xattr', 'plutil', 'defaults', 'codesign', 'spctl', 'pmset', 'caffeinate', 'say',
  'afplay', 'osascript', 'diskutil', 'netstat', 'ping', 'traceroute', 'dig', 'nslookup',
  'top', 'htop', 'iostat', 'vmstat', 'lsof', 'networksetup', 'system_profiler'
]);

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
  const forbidden = ['&', '&&', '|', '||', ';', '`', '$(', '\\', '>', '>>', '<'];
  for (const token of forbidden) {
    if (trimmed.includes(token)) {
      throw new Error(`Invalid command: forbidden token "${token}"`);
    }
  }
  const firstWord = trimmed.split(/\s+/)[0];
  if (SAFE_COMMANDS.has(firstWord.toLowerCase())) {
    return trimmed;
  }
  const mediumRisk = [
    'sudo', 'su', 'chmod', 'chown', 'del', 'format', 'fdisk', 'mkfs', 'dd',
    'reboot', 'shutdown', 'halt', 'init', 'systemctl', 'launchctl',
    'kill', 'killall', 'pkill', 'force-quit'
  ];
  const hasSudo = trimmed.toLowerCase().includes('sudo');
  if (hasSudo && !trimmed.toLowerCase().startsWith('sudo ') && !trimmed.toLowerCase().startsWith('sudo -')) {
    throw new Error('Invalid command: sudo must be at the beginning');
  }
  const firstToken = trimmed.toLowerCase();
  for (const risk of mediumRisk) {
    if (firstToken.startsWith(risk + ' ') || firstToken === risk) {
      return trimmed;
    }
  }
  return trimmed;
}

function analyzeCommandRisk(cmd) {
  const lowRisk = ['ls', 'll', 'la', 'pwd', 'echo', 'cat', 'head', 'tail', 'grep', 'find', 'which', 'whoami', 'date', 'cal', 'df', 'du', 'free', 'uptime', 'ps', 'top', 'git status', 'git log'];
  const mediumRisk = ['git', 'npm', 'npx', 'node', 'mkdir', 'touch', 'cp', 'mv', 'tar', 'unzip', 'curl', 'wget', 'open', 'xdg-open', 'defaults', 'plutil'];
  const highRisk = ['sudo', 'su', 'del', 'format', 'rm -rf', 'dd', 'mkfs', 'fdisk', 'reboot', 'shutdown', 'kill', 'killall', 'pkill', 'launchctl', 'systemctl'];
  const critical = ['>', '>>', '|', ';', '&&', '$(', '`'];
  const cmdLower = cmd.toLowerCase();
  for (const c of critical) {
    if (cmd.includes(c)) return 'critical';
  }
  for (const c of highRisk) {
    if (cmdLower.includes(c)) return 'high';
  }
  for (const c of mediumRisk) {
    if (cmdLower.startsWith(c + ' ') || cmdLower === c) return 'medium';
  }
  for (const c of lowRisk) {
    if (cmdLower.startsWith(c + ' ') || cmdLower === c) return 'low';
  }
  return 'medium';
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
  return true;
}

module.exports = {
  validateCommand,
  analyzeCommandRisk,
  explainCommand,
  checkShellPermission,
  permissionStore
};