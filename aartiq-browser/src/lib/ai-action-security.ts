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
    description: 'Move between Comet panels like coding, browser, or PDFs.',
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
    risk: 'high',
    detail: 'Handled with dedicated command approval, QR unlock, and per-command policy below.',
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
