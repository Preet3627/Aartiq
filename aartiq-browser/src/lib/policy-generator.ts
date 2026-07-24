export type RuleEffect = 'allow' | 'deny' | 'require_approval';

export type RuleScope = 'domain' | 'action_type' | 'command' | 'url_pattern' | 'time_based';

export interface PolicyRule {
  id: string;
  description: string;
  effect: RuleEffect;
  scope: RuleScope;
  conditions: RuleCondition[];
  priority: number;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface RuleCondition {
  field: 'domain' | 'action_type' | 'command_name' | 'url_match' | 'time_elapsed_minutes' | 'file_path' | 'target';
  operator: 'equals' | 'contains' | 'matches' | 'less_than' | 'greater_than' | 'in_list';
  value: string | number | string[];
}

const STORAGE_KEY = 'aartiq_policy_rules';

export function loadRules(): PolicyRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveRules(rules: PolicyRule[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch {
    console.warn('[PolicyGenerator] Failed to save rules');
  }
}

export function addRule(rule: PolicyRule): void {
  const rules = loadRules();
  rules.push(rule);
  saveRules(rules);
}

export function removeRule(id: string): void {
  const rules = loadRules().filter(r => r.id !== id);
  saveRules(rules);
}

export function updateRule(id: string, updates: Partial<PolicyRule>): void {
  const rules = loadRules().map(r =>
    r.id === id ? { ...r, ...updates, updatedAt: Date.now() } : r
  );
  saveRules(rules);
}

let ruleIdCounter = Date.now();
function generateRuleId(): string {
  return `rule-${ruleIdCounter++}-${Math.random().toString(36).slice(2, 6)}`;
}

// ---------------------------------------------------------------------------
// Common intent patterns — instant rule generation
// ---------------------------------------------------------------------------

interface IntentPattern {
  match: RegExp;
  generate: (input: string) => PolicyRule | PolicyRule[];
  label: string;
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    match: /block\s+(social\s*media|youtube|twitter|x\.com|facebook|instagram|reddit|tiktok)/i,
    generate: () => ({
      id: generateRuleId(),
      description: 'Block social media sites',
      effect: 'deny',
      scope: 'domain',
      conditions: [
        {
          field: 'domain',
          operator: 'in_list',
          value: ['youtube.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'reddit.com', 'tiktok.com'],
        },
      ],
      priority: 100,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
    label: 'Block social media',
  },
  {
    match: /block\s+(?!social|media)([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    generate: (input: string) => {
      const match = input.match(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      const domain = match?.[1] || '';
      return {
        id: generateRuleId(),
        description: `Block domain: ${domain}`,
        effect: 'deny',
        scope: 'domain',
        conditions: [{ field: 'domain', operator: 'equals', value: domain.toLowerCase() }],
        priority: 90,
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    },
    label: 'Block specific domain',
  },
  {
    match: /require\s+approval\s+(for|before|to)\s+(any\s+)?(file\s+writes?|file\s+create|write\s+file|file\s+operation)/i,
    generate: () => ({
      id: generateRuleId(),
      description: 'Require approval for all file write operations',
      effect: 'require_approval',
      scope: 'action_type',
      conditions: [
        { field: 'action_type', operator: 'in_list', value: ['WRITE_FILE', 'CREATE_FILE_JSON', 'DOWNLOAD_FILE'] },
      ],
      priority: 80,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
    label: 'File write approval',
  },
  {
    match: /require\s+approval\s+(for|before|to)\s+(any\s+)?shell/i,
    generate: () => ({
      id: generateRuleId(),
      description: 'Require approval for all shell commands',
      effect: 'require_approval',
      scope: 'action_type',
      conditions: [
        { field: 'action_type', operator: 'equals', value: 'SHELL_COMMAND' },
      ],
      priority: 80,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
    label: 'Shell command approval',
  },
  {
    match: /(block|deny|prevent)\s+(all\s+)?(shell|terminal|command)/i,
    generate: () => ({
      id: generateRuleId(),
      description: 'Block all shell commands',
      effect: 'deny',
      scope: 'action_type',
      conditions: [
        { field: 'action_type', operator: 'equals', value: 'SHELL_COMMAND' },
      ],
      priority: 100,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
    label: 'Block shell commands',
  },
  {
    match: /(block|deny|prevent)\s+(navigation|navigate)\s+(to\s+)?(any\s+)?(crypto|banking|finance|loan|casino|gambling)/i,
    generate: () => ({
      id: generateRuleId(),
      description: 'Block crypto/banking/finance/gambling domains',
      effect: 'deny',
      scope: 'domain',
      conditions: [
        {
          field: 'domain',
          operator: 'matches',
          value: '(crypto|bank|finance|loan|casino|gambling|bet|poker)',
        },
      ],
      priority: 95,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
    label: 'Block financial sites',
  },
  {
    match: /(enable|activate)\s+credit\s*card\s+(shield|protect|guard|blocker)/i,
    generate: () => ({
      id: generateRuleId(),
      description: 'Credit card number protection',
      effect: 'deny',
      scope: 'action_type',
      conditions: [
        { field: 'action_type', operator: 'in_list', value: ['WRITE_FILE', 'SHELL_COMMAND', 'CLIPBOARD_WRITE'] },
        { field: 'target', operator: 'matches', value: '(?:\\d{4}[\\s-]?){4}' },
      ],
      priority: 100,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
    label: 'Credit card shield',
  },
  {
    match: /(enable|activate)\s+(PII|privacy|personal\s*data)\s+(shield|protect|guard|blocker)/i,
    generate: () => ({
      id: generateRuleId(),
      description: 'PII / personal data protection',
      effect: 'deny',
      scope: 'action_type',
      conditions: [
        { field: 'action_type', operator: 'in_list', value: ['WRITE_FILE', 'SHELL_COMMAND', 'CLIPBOARD_WRITE', 'READ_PAGE_CONTENT'] },
        { field: 'target', operator: 'matches', value: '([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,})' },
      ],
      priority: 100,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
    label: 'PII shield',
  },
  {
    match: /(block|deny|prevent)\s+(after|past)\s+(\d+)\s*(minute|min|m)\s+on\s+(social\s*media|youtube)/i,
    generate: (input: string) => {
      const match = input.match(/(\d+)\s*(minute|min|m)/i);
      const minutes = parseInt(match?.[1] || '20', 10);
      return {
        id: generateRuleId(),
        description: `Block social media after ${minutes} minutes`,
        effect: 'deny',
        scope: 'time_based',
        conditions: [
          {
            field: 'domain',
            operator: 'in_list',
            value: ['youtube.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'reddit.com', 'tiktok.com'],
          },
          { field: 'time_elapsed_minutes', operator: 'greater_than', value: minutes },
        ],
        priority: 100,
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    },
    label: 'Time-based social media block',
  },
  {
    match: /(limit|cap|max)\s+price\s+(to|at|of)\s+(\d+)/i,
    generate: (input: string) => {
      const match = input.match(/(\d+)/);
      const priceLimit = parseInt(match?.[1] || '100', 10);
      return {
        id: generateRuleId(),
        description: `Price limit: $${priceLimit}`,
        effect: 'require_approval',
        scope: 'action_type',
        conditions: [
          { field: 'action_type', operator: 'equals', value: 'NAVIGATE' },
          { field: 'target', operator: 'matches', value: `checkout|cart|purchase|pay|buy|order|price=.*[${priceLimit}]` },
        ],
        priority: 90,
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    },
    label: 'Price limit guard',
  },
];

// ---------------------------------------------------------------------------
// Parse NL input into structured rules
// ---------------------------------------------------------------------------

export interface ParseResult {
  rules: PolicyRule[];
  ambiguous: boolean;
  clarification?: string;
  matchedIntent?: string;
}

export function parseNaturalLanguage(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      rules: [],
      ambiguous: true,
      clarification: 'Please describe what policy you want to set. Examples:\n' +
        '- "block social media"\n' +
        '- "require approval for file writes"\n' +
        '- "block youtube after 20 minutes"\n' +
        '- "enable credit card shield"\n' +
        '- "require approval for all shell commands"',
    };
  }

  for (const intent of INTENT_PATTERNS) {
    if (intent.match.test(trimmed)) {
      const rules = Array.isArray(intent.generate(trimmed))
        ? intent.generate(trimmed) as PolicyRule[]
        : [intent.generate(trimmed) as PolicyRule];
      return {
        rules,
        ambiguous: false,
        matchedIntent: intent.label,
      };
    }
  }

  // Generic fallback — extract action types
  const actionTypeMatch = trimmed.match(
    /(block|deny|require\s+approval\s+for|allow)\s+(.*)$/i
  );
  if (actionTypeMatch) {
    const effect = actionTypeMatch[1].toLowerCase();
    const targets = actionTypeMatch[2].toLowerCase();
    const rule: PolicyRule = {
      id: generateRuleId(),
      description: trimmed,
      effect: effect.startsWith('allow') ? 'allow'
        : effect.startsWith('block') || effect.startsWith('deny') ? 'deny'
        : 'require_approval',
      scope: 'action_type',
      conditions: [
        {
          field: 'action_type',
          operator: 'contains',
          value: targets,
        },
      ],
      priority: 50,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return { rules: [rule], ambiguous: false };
  }

  return {
    rules: [],
    ambiguous: true,
    clarification: 'I\'m not sure what policy you want. Try something like:\n' +
      '- "block social media"\n' +
      '- "require approval for shell commands"\n' +
      '- "block youtube.com"\n' +
      '- "enable PII shield"',
  };
}

// ---------------------------------------------------------------------------
// Rule validation
// ---------------------------------------------------------------------------

export interface ValidationError {
  field: string;
  message: string;
}

const VALID_OPERATORS = ['equals', 'contains', 'matches', 'less_than', 'greater_than', 'in_list'];
const VALID_SCOPES = ['domain', 'action_type', 'command', 'url_pattern', 'time_based'];
const VALID_EFFECTS = ['allow', 'deny', 'require_approval'];

export function validateRule(rule: Partial<PolicyRule>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!rule.description || rule.description.trim().length < 2) {
    errors.push({ field: 'description', message: 'Description must be at least 2 characters' });
  }

  if (!rule.effect || !VALID_EFFECTS.includes(rule.effect)) {
    errors.push({ field: 'effect', message: `Effect must be one of: ${VALID_EFFECTS.join(', ')}` });
  }

  if (!rule.scope || !VALID_SCOPES.includes(rule.scope)) {
    errors.push({ field: 'scope', message: `Scope must be one of: ${VALID_SCOPES.join(', ')}` });
  }

  if (!rule.conditions || rule.conditions.length === 0) {
    errors.push({ field: 'conditions', message: 'At least one condition is required' });
  } else {
    for (let i = 0; i < rule.conditions.length; i++) {
      const cond = rule.conditions[i];
      if (!cond.field) {
        errors.push({ field: `conditions[${i}].field`, message: 'Field is required' });
      }
      if (!cond.operator || !VALID_OPERATORS.includes(cond.operator)) {
        errors.push({ field: `conditions[${i}].operator`, message: `Operator must be one of: ${VALID_OPERATORS.join(', ')}` });
      }
      if (cond.value === undefined || cond.value === null || cond.value === '') {
        errors.push({ field: `conditions[${i}].value`, message: 'Value is required' });
      }
    }
  }

  if (rule.priority !== undefined && (rule.priority < 0 || rule.priority > 1000)) {
    errors.push({ field: 'priority', message: 'Priority must be between 0 and 1000' });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function listIntentPatterns(): { label: string; example: string }[] {
  return INTENT_PATTERNS.map(p => ({
    label: p.label,
    example: p.match.source.replace(/\\/g, '').replace(/\(.*\)/g, '...'),
  }));
}

export function clearAllRules(): void {
  saveRules([]);
}

export { INTENT_PATTERNS };
