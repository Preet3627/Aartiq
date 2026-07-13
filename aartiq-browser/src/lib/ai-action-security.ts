export type ActionRiskLevel = 'low' | 'medium' | 'high';

export interface AIActionSecurityDefinition {
  actionType: string;
  label: string;
  description: string;
  category: string;
  risk: ActionRiskLevel;
  detail: string;
  toggleable?: boolean;
}

export interface SecuritySettingsSnapshot {
  autoApproveLowRisk?: boolean;
  autoApproveMidRisk?: boolean;
  autoApprovedActions?: string[];
  requireBiometricPerSession?: boolean;
}

export const AI_ACTION_SECURITY_CATALOG: AIActionSecurityDefinition[] = [
  {
    actionType: 'NAVIGATE',
    label: 'Navigate tabs',
    description: 'Open URLs and move through browser pages.',
    category: 'Browser',
    risk: 'low',
    detail: 'Used for regular browsing flows inside Aartiq.',
    toggleable: true,
  },
  {
    actionType: 'READ_PAGE_CONTENT',
    label: 'Read page content',
    description: 'Extract text from the current page for AI analysis.',
    category: 'Browser',
    risk: 'low',
    detail: 'Read-only DOM access inside the active tab.',
    toggleable: true,
  },
  {
    actionType: 'OPEN_VIEW',
    label: 'Switch workspace views',
    description: 'Move between Aartiq panels like coding, browser, or PDFs.',
    category: 'Workspace',
    risk: 'low',
    detail: 'Changes the visible workspace without touching the OS.',
    toggleable: true,
  },
  {
    actionType: 'OPEN_PDF',
    label: 'Open generated files',
    description: 'Open PDFs or exported documents from local disk.',
    category: 'Files',
    risk: 'low',
    detail: 'Limited to viewing files already available on the machine.',
    toggleable: true,
  },
  {
    actionType: 'CLICK_ELEMENT',
    label: 'Click page elements',
    description: 'Click buttons, links, or controls in the current browser tab.',
    category: 'Browser Automation',
    risk: 'medium',
    detail: 'Can trigger site actions such as submits, purchases, or navigation.',
    toggleable: true,
  },
  {
    actionType: 'CLICK_AT',
    label: 'Click screen coordinates',
    description: 'Click a specific point on screen.',
    category: 'Desktop Automation',
    risk: 'medium',
    detail: 'More flexible than selector clicks, so it should stay gated.',
    toggleable: true,
  },
  {
    actionType: 'FIND_AND_CLICK',
    label: 'Find and click text',
    description: 'Use OCR to locate text on screen, then click it.',
    category: 'Desktop Automation',
    risk: 'medium',
    detail: 'Can affect external apps and system dialogs, not just the browser.',
    toggleable: true,
  },
  {
    actionType: 'FILL_FORM',
    label: 'Fill form fields',
    description: 'Type into form inputs and trigger input/change events.',
    category: 'Browser Automation',
    risk: 'medium',
    detail: 'Useful for workflows, but it can submit or alter data on sites.',
    toggleable: true,
  },
  {
    actionType: 'OPEN_APP',
    label: 'Open external apps',
    description: 'Launch Calculator, Terminal, VS Code, and other desktop apps.',
    category: 'System',
    risk: 'medium',
    detail: 'Starts processes outside the browser shell.',
    toggleable: true,
  },
  {
    actionType: 'SET_VOLUME',
    label: 'Change volume',
    description: 'Adjust system audio output.',
    category: 'System',
    risk: 'medium',
    detail: 'OS-level media control.',
    toggleable: true,
  },
  {
    actionType: 'SET_BRIGHTNESS',
    label: 'Change brightness',
    description: 'Adjust display brightness.',
    category: 'System',
    risk: 'medium',
    detail: 'OS-level display control.',
    toggleable: true,
  },
  {
    actionType: 'GMAIL_AUTHORIZE',
    label: 'Authorize Gmail',
    description: 'Connect a Gmail account to Aartiq.',
    category: 'Integrations',
    risk: 'medium',
    detail: 'Starts access to an external account integration.',
    toggleable: true,
  },
  {
    actionType: 'GMAIL_SEND_MESSAGE',
    label: 'Send email',
    description: 'Send outbound messages through Gmail.',
    category: 'Integrations',
    risk: 'medium',
    detail: 'Can contact external recipients on your behalf.',
    toggleable: true,
  },
  {
    actionType: 'GMAIL_ADD_LABEL',
    label: 'Edit email labels',
    description: 'Change Gmail labels on messages.',
    category: 'Integrations',
    risk: 'medium',
    detail: 'Modifies mailbox state.',
    toggleable: true,
  },
  {
    actionType: 'SHELL_COMMAND',
    label: 'Run shell commands',
    description: 'Execute terminal commands on the host machine.',
    category: 'System',
    risk: 'medium',
    detail: 'Handled with dedicated command approval, QR unlock, and per-command policy below.',
    toggleable: false,
  },
  {
    actionType: 'HIGH_RISK_SHELL',
    label: 'High-risk shell (sudo, rm, etc.)',
    description: 'Potentially destructive shell commands that require elevated approval.',
    category: 'System',
    risk: 'high',
    detail: 'Destructive commands such as sudo, rm -rf, dd, mkfs, shutdown, reboot — always requires mobile QR approval.',
    toggleable: false,
  },
  {
    actionType: 'POWER_ACTION',
    label: 'Power actions (shutdown, reboot)',
    description: 'Shutdown, restart, sleep, or lock the machine.',
    category: 'System',
    risk: 'high',
    detail: 'System-level power management commands that require mobile QR verification.',
    toggleable: false,
  },
  {
    actionType: 'IRREVERSIBLE_COMMAND',
    label: 'Irreversible shell (dd, mkfs, etc.)',
    description: 'Commands that can permanently destroy data or modify system partitions.',
    category: 'System',
    risk: 'high',
    detail: 'Low-level disk write and formatting commands that are irreversible once executed.',
    toggleable: false,
  },
  {
    actionType: 'DELETE_FILE',
    label: 'Delete files or directories',
    description: 'Remove files, folders, or entire directory trees from the filesystem.',
    category: 'Files',
    risk: 'high',
    detail: 'File deletion operations including rm, del, rmdir, and recursive removal. These actions permanently destroy data.',
    toggleable: false,
  },
  {
    actionType: 'REMOVE_FILE',
    label: 'Remove files or directories',
    description: 'Permanently remove files and folders from the system.',
    category: 'Files',
    risk: 'high',
    detail: 'Irreversible file removal operations. Data cannot be recovered after execution.',
    toggleable: false,
  },
  {
    actionType: 'FORMAT_DISK',
    label: 'Format disk or partition',
    description: 'Format storage devices or partitions, destroying all data.',
    category: 'System',
    risk: 'high',
    detail: 'Disk formatting operations that permanently erase all data on the target device.',
    toggleable: false,
  },
  {
    actionType: 'PARTITION_DISK',
    label: 'Partition disk',
    description: 'Modify disk partition tables and layouts.',
    category: 'System',
    risk: 'high',
    detail: 'Partition manipulation that can destroy data and render disks unbootable.',
    toggleable: false,
  },
  {
    actionType: 'WRITE_DISK',
    label: 'Low-level disk write',
    description: 'Direct disk write operations that bypass filesystem safeguards.',
    category: 'System',
    risk: 'high',
    detail: 'Raw disk write commands like dd that can overwrite any data on the system.',
    toggleable: false,
  },
];

export const AI_ACTIONS_BY_RISK = AI_ACTION_SECURITY_CATALOG.reduce<Record<ActionRiskLevel, AIActionSecurityDefinition[]>>(
  (acc, action) => {
    acc[action.risk].push(action);
    return acc;
  },
  { low: [], medium: [], high: [] }
);

export function normalizeActionType(actionType: string | undefined | null): string {
  return `${actionType || ''}`.trim().toUpperCase();
}

export function normalizeRiskLevel(riskLevel: string | undefined | null): ActionRiskLevel {
  const normalized = `${riskLevel || 'medium'}`.trim().toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized;
  }
  if (normalized === 'critical') {
    return 'high';
  }
  return 'medium';
}

export function getActionPermissionKey(actionType: string, target?: string, what?: string): string {
  const normalizedType = normalizeActionType(actionType);
  return `${normalizedType}:${target || what || normalizedType}`;
}

export function getActionSecurityDefinition(actionType: string): AIActionSecurityDefinition | undefined {
  const normalized = normalizeActionType(actionType);
  return AI_ACTION_SECURITY_CATALOG.find((entry) => entry.actionType === normalized);
}

const LOW_RISK_COMMANDS = new Set([
  'ls', 'll', 'la', 'cat', 'head', 'tail', 'pwd', 'echo', 'which', 'whoami',
  'date', 'cal', 'df', 'du', 'free', 'uptime', 'ps', 'top', 'htop', 'iostat',
  'vmstat', 'lsof', 'netstat', 'ping', 'traceroute', 'dig', 'nslookup',
  'system_profiler', 'find', 'grep', 'cd',
]);

const MEDIUM_RISK_COMMANDS_SET = new Set([
  'cp', 'mv', 'mkdir', 'touch', 'rmdir', 'ln', 'tar', 'unzip', 'zip',
  'git', 'npm', 'npx', 'node', 'python', 'python3', 'pip', 'pip3',
  'ruby', 'perl', 'php', 'curl', 'wget', 'ssh', 'scp', 'rsync',
  'open', 'xdg-open', 'gnome-open', 'kde-open',
  'xattr', 'plutil', 'defaults', 'codesign', 'spctl',
  'pmset', 'caffeinate', 'say', 'afplay', 'osascript', 'diskutil',
  'chmod', 'chown', 'networksetup', 'code', 'docker',
]);

const HIGH_RISK_COMMANDS_SET = new Set([
  'sudo', 'su', 'del', 'rm', 'format', 'fdisk', 'mkfs', 'dd',
  'reboot', 'shutdown', 'halt', 'init', 'poweroff',
  'systemctl', 'launchctl', 'kill', 'killall', 'pkill',
  'iptables', 'ufw', 'firewall-cmd', 'mount', 'umount', 'eject',
  'passwd', 'chgrp',
]);

const IRREVERSIBLE_COMMANDS = new Set([
  'dd', 'mkfs', 'fdisk', 'format', 'del',
  'shutdown', 'reboot', 'halt', 'poweroff', 'init',
  'rm', 'mv',
]);

const COMMAND_DESCRIPTIONS: Record<string, string> = {
  ls: 'List directory contents',
  ll: 'List detailed directory contents',
  la: 'List all directory contents',
  cat: 'Display file contents',
  head: 'Show first lines of a file',
  tail: 'Show last lines of a file',
  pwd: 'Print current working directory',
  cd: 'Change current directory',
  cp: 'Copy files or directories',
  mv: 'Move or rename files or directories',
  mkdir: 'Create a new directory',
  rm: 'Remove files or directories',
  rmdir: 'Remove empty directories',
  touch: 'Create empty files or update timestamps',
  ln: 'Create links between files',
  tar: 'Archive files',
  unzip: 'Extract zip archives',
  zip: 'Create zip archives',
  find: 'Search for files by criteria',
  grep: 'Search file contents for patterns',
  echo: 'Print text to output',
  which: 'Locate a command in PATH',
  whoami: 'Show current username',
  date: 'Display current date and time',
  cal: 'Display a calendar',
  df: 'Show disk space usage',
  du: 'Show directory space usage',
  free: 'Show memory usage',
  uptime: 'Show system uptime',
  ps: 'List running processes',
  top: 'Show live process overview',
  htop: 'Interactive process viewer',
  iostat: 'Show CPU and I/O statistics',
  vmstat: 'Show virtual memory statistics',
  lsof: 'List open files',
  netstat: 'Show network connections',
  ping: 'Test network connectivity',
  traceroute: 'Trace network route to host',
  dig: 'DNS lookup utility',
  nslookup: 'Query DNS records',
  system_profiler: 'Show system hardware/software info',
  git: 'Version control operations',
  npm: 'Node.js package manager',
  npx: 'Execute Node.js packages',
  node: 'Run JavaScript runtime',
  python: 'Run Python interpreter',
  python3: 'Run Python 3 interpreter',
  pip: 'Python package installer',
  pip3: 'Python 3 package installer',
  ruby: 'Run Ruby interpreter',
  perl: 'Run Perl interpreter',
  php: 'Run PHP interpreter',
  curl: 'Transfer data from/to URLs',
  wget: 'Download files from the web',
  ssh: 'Secure shell remote connection',
  scp: 'Secure file copy over SSH',
  rsync: 'Remote file sync',
  open: 'Open files or URLs with default app',
  xdg_open: 'Open files with default app (Linux)',
  xattr: 'Manage extended file attributes',
  plutil: 'Manage macOS plist files',
  defaults: 'Read/write macOS user defaults',
  codesign: 'Sign macOS code and apps',
  spctl: 'Assess macOS security policy',
  pmset: 'Manage macOS power settings',
  caffeinate: 'Prevent macOS sleep',
  say: 'Text-to-speech on macOS',
  afplay: 'Play audio files on macOS',
  osascript: 'Run AppleScript on macOS',
  diskutil: 'Manage macOS disks and volumes',
  chmod: 'Change file permissions',
  chown: 'Change file owner',
  networksetup: 'Configure macOS network settings',
  code: 'Open VS Code editor',
  docker: 'Run container operations',
  sudo: 'Execute commands with superuser privileges',
  su: 'Switch user account',
  del: 'Delete files (Windows)',
  format: 'Format a disk (Windows)',
  fdisk: 'Partition a disk',
  mkfs: 'Format/create a filesystem',
  dd: 'Low-level disk read/write operations',
  reboot: 'Restart the system',
  shutdown: 'Shut down the system',
  halt: 'Halt the system',
  init: 'Change system runlevel',
  poweroff: 'Power off the system',
  systemctl: 'Manage systemd services',
  launchctl: 'Manage macOS launchd services',
  kill: 'Terminate a process by PID',
  killall: 'Terminate processes by name',
  pkill: 'Terminate processes by pattern',
  iptables: 'Configure network firewall rules',
  ufw: 'Uncomplicated firewall manager',
  'firewall-cmd': 'Firewall manager (firewalld)',
  mount: 'Mount a filesystem',
  umount: 'Unmount a filesystem',
  eject: 'Eject removable media',
  passwd: 'Change user password',
  chgrp: 'Change file group ownership',
};

export function getShellCommandRisk(command: string): ActionRiskLevel {
  const base = (command || '').trim().split(/\s+/)[0].toLowerCase();
  const lower = (command || '').toLowerCase();
  
  if (LOW_RISK_COMMANDS.has(base)) return 'low';
  
  if (HIGH_RISK_COMMANDS_SET.has(base)) return 'high';
  
  if (MEDIUM_RISK_COMMANDS_SET.has(base)) {
    if (base === 'mv' && (lower.includes('rm') || lower.includes('del') || lower.includes('/dev'))) return 'high';
    if (base === 'cp' && lower.includes('/dev')) return 'high';
    return 'medium';
  }
  
  if (lower.includes('rm ') || lower.includes('rm\t') || lower.includes('rm -')) return 'high';
  if (lower.includes('del ') || lower.includes('del/') || lower.includes('del\\')) return 'high';
  if (lower.includes('rmdir') || lower.includes('rd /s')) return 'high';
  if (lower.includes(' unlink') || lower.includes('unlink ')) return 'high';
  if (lower.includes('shred') || lower.includes('wipe')) return 'high';
  if (lower.includes('find ') && lower.includes('-delete')) return 'high';
  if (lower.includes('find ') && lower.includes('-exec rm')) return 'high';
  if (lower.includes('xargs rm') || lower.includes('xargs del')) return 'high';
  
  return 'medium';
}

export function getShellBaseCommand(command: string): string {
  return (command || '').trim().split(/\s+/)[0].toLowerCase();
}

export function isIrreversibleCommand(command: string): boolean {
  const base = getShellBaseCommand(command);
  const lower = command.toLowerCase();
  if (IRREVERSIBLE_COMMANDS.has(base)) return true;
  if (base === 'rm' && (lower.includes('-rf') || lower.includes('-r') || lower.includes('-f'))) return true;
  if (base === 'rm') return true;
  if (base === 'mv' && lower.includes('/')) return true;
  if (lower.includes('>') || lower.includes('>>') || lower.includes('|')) return true;
  if (lower.includes('shred') || lower.includes('wipe')) return true;
  if (lower.includes('find ') && lower.includes('-delete')) return true;
  if (lower.includes('find ') && lower.includes('-exec rm')) return true;
  if (lower.includes('xargs rm') || lower.includes('xargs del')) return true;
  if (lower.includes('rmdir') || lower.includes('rd /s')) return true;
  if (lower.includes(' unlink')) return true;
  return false;
}

export function getCommandDescription(command: string): string {
  const base = getShellBaseCommand(command);
  return COMMAND_DESCRIPTIONS[base] || `Execute: ${base}`;
}

export function isActionAutoApproved(
  settings: SecuritySettingsSnapshot | null | undefined,
  actionType: string,
  riskLevel: string
): boolean {
  const normalizedType = normalizeActionType(actionType);
  const normalizedRisk = normalizeRiskLevel(riskLevel);

  if (normalizedRisk === 'high') {
    return false;
  }

  const autoApprovedActions = Array.isArray(settings?.autoApprovedActions)
    ? settings?.autoApprovedActions?.map((entry) => normalizeActionType(entry))
    : [];

  if (autoApprovedActions.includes(normalizedType)) {
    return true;
  }

  if (normalizedRisk === 'low') {
    return !!settings?.autoApproveLowRisk;
  }

  return !!settings?.autoApproveMidRisk;
}
