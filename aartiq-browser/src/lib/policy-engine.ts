import { loadRules, type PolicyRule } from './policy-generator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EnforcementMode = 'strict' | 'log' | 'shadow';

export interface PolicyContext {
  domain?: string;
  actionType?: string;
  commandName?: string;
  url?: string;
  target?: string;
  filePath?: string;
  timeElapsedMinutes?: number;
}

export interface PolicyEvaluation {
  verdict: 'allow' | 'deny' | 'require_approval';
  source: 'local' | 'cloud';
  matchedRule: PolicyRule | null;
  reason: string;
  enforcementMode: EnforcementMode;
}

export interface PolicyEngineOptions {
  cloudEvaluate?: (context: PolicyContext) => Promise<PolicyEvaluation | null>;
  mode?: EnforcementMode;
  localFirst?: boolean;
}

// ---------------------------------------------------------------------------
// Default: no cloud evaluator configured
// ---------------------------------------------------------------------------

const DEFAULT_OPTIONS: PolicyEngineOptions = {
  mode: 'strict',
  localFirst: true,
};

// ---------------------------------------------------------------------------
// Domain/time tracker integration
// ---------------------------------------------------------------------------

function getTimeElapsedForDomain(domain: string): number {
  try {
    const key = `aartiq_domain_time_${domain}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return 0;
    const start = parseInt(raw, 10);
    return (Date.now() - start) / 60000;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Condition evaluator
// ---------------------------------------------------------------------------

function evaluateCondition(cond: PolicyRule['conditions'][0], ctx: PolicyContext): boolean {
  const fieldValue = getFieldValue(cond.field, ctx);

  switch (cond.operator) {
    case 'equals':
      return String(fieldValue).toLowerCase() === String(cond.value).toLowerCase();

    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(cond.value).toLowerCase());

    case 'matches': {
      try {
        return new RegExp(String(cond.value), 'i').test(String(fieldValue));
      } catch {
        return false;
      }
    }

    case 'less_than':
      return Number(fieldValue) < Number(cond.value);

    case 'greater_than':
      return Number(fieldValue) > Number(cond.value);

    case 'in_list': {
      if (Array.isArray(cond.value)) {
        return cond.value.some(v => String(fieldValue).toLowerCase().includes(v.toLowerCase()));
      }
      return false;
    }

    default:
      return false;
  }
}

function getFieldValue(field: string, ctx: PolicyContext): string | number {
  switch (field) {
    case 'domain':
      return ctx.domain || '';
    case 'action_type':
      return ctx.actionType || '';
    case 'command_name':
      return ctx.commandName || '';
    case 'url_match':
      return ctx.url || '';
    case 'time_elapsed_minutes': {
      if (ctx.domain && ctx.timeElapsedMinutes === undefined) {
        return getTimeElapsedForDomain(ctx.domain);
      }
      return ctx.timeElapsedMinutes ?? 0;
    }
    case 'file_path':
      return ctx.filePath || '';
    case 'target':
      return ctx.target || '';
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Rule evaluation
// ---------------------------------------------------------------------------

function evaluateRule(rule: PolicyRule, ctx: PolicyContext): boolean {
  if (!rule.enabled) return false;
  return rule.conditions.every(cond => evaluateCondition(cond, ctx));
}

function getDomainFromContext(ctx: PolicyContext): string {
  if (ctx.domain) return ctx.domain;
  if (ctx.url) {
    try {
      return new URL(ctx.url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }
  return '';
}

// ---------------------------------------------------------------------------
// PolicyEngine class
// ---------------------------------------------------------------------------

export class PolicyEngine {
  private cloudEvaluateFn: ((ctx: PolicyContext) => Promise<PolicyEvaluation | null>) | null;
  private mode: EnforcementMode;
  private localFirst: boolean;

  constructor(options: PolicyEngineOptions = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.cloudEvaluateFn = opts.cloudEvaluate || null;
    this.mode = opts.mode || 'strict';
    this.localFirst = opts.localFirst !== false;
  }

  async evaluate(ctx: PolicyContext): Promise<PolicyEvaluation> {
    const fullCtx: PolicyContext = {
      ...ctx,
      domain: ctx.domain || getDomainFromContext(ctx),
    };

    if (this.localFirst) {
      const localResult = this.evaluateLocal(fullCtx);
      if (localResult && localResult.verdict !== 'allow') {
        return this.applyMode(localResult);
      }

      if (this.cloudEvaluateFn) {
        const cloudResult = await this.cloudEvaluateFn(fullCtx);
        if (cloudResult && cloudResult.verdict !== 'allow') {
          return this.applyMode(cloudResult);
        }
      }

      return this.makeEvaluation('allow', 'local', null, 'No matching rules');
    }

    if (this.cloudEvaluateFn) {
      const cloudResult = await this.cloudEvaluateFn(fullCtx);
      if (cloudResult && cloudResult.verdict !== 'allow') {
        return this.applyMode(cloudResult);
      }
    }

    const localResult = this.evaluateLocal(fullCtx);
    if (localResult && localResult.verdict !== 'allow') {
      return this.applyMode(localResult);
    }

    return this.makeEvaluation('allow', 'local', null, 'No matching rules');
  }

  private evaluateLocal(ctx: PolicyContext): PolicyEvaluation | null {
    const rules = loadRules();
    if (rules.length === 0) return null;

    const sorted = [...rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sorted) {
      if (evaluateRule(rule, ctx)) {
        return this.makeEvaluation(rule.effect, 'local', rule, rule.description);
      }
    }

    return null;
  }

  private makeEvaluation(
    verdict: PolicyEvaluation['verdict'],
    source: PolicyEvaluation['source'],
    matchedRule: PolicyRule | null,
    reason: string,
  ): PolicyEvaluation {
    return {
      verdict,
      source,
      matchedRule,
      reason,
      enforcementMode: this.mode,
    };
  }

  private applyMode(evaluation: PolicyEvaluation): PolicyEvaluation {
    if (this.mode === 'shadow') {
      return {
        ...evaluation,
        verdict: 'allow',
        reason: `${evaluation.reason} (shadow mode — would have been ${evaluation.verdict})`,
      };
    }
    if (this.mode === 'log') {
      return {
        ...evaluation,
        verdict: 'allow',
        reason: `${evaluation.reason} (log mode — allowed for monitoring)`,
      };
    }
    return evaluation;
  }

  setMode(mode: EnforcementMode): void {
    this.mode = mode;
  }

  setCloudEvaluator(fn: (ctx: PolicyContext) => Promise<PolicyEvaluation | null>): void {
    this.cloudEvaluateFn = fn;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let globalEngine: PolicyEngine | null = null;

export function getPolicyEngine(): PolicyEngine {
  if (!globalEngine) {
    globalEngine = new PolicyEngine();
  }
  return globalEngine;
}

export function resetPolicyEngine(): void {
  globalEngine = null;
}
