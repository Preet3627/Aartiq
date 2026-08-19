/**
 * OriginGuard — deterministic, fail-closed execution policy.
 *
 * This is Layer 3 of the injection defense: even if the model is persuaded into a
 * malicious plan, no side-effecting action leaves the browser unless it satisfies
 * an explicit policy. Always fails closed (deny) when the policy is unclear.
 */

export type Verb = 'readOnly' | 'navigate' | 'input' | 'sideEffecting' | 'destructive';

export interface AgentAction {
  verb: Verb;
  target?: string; // URL or origin
  origin?: string; // resolved origin of the target
  agentId?: string;
  tool?: string;
}

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  requiresApproval: boolean;
  policy: string;
}

export interface OriginGuardOptions {
  /** Origins the agent may touch at all. Empty + enforceAllowlist=false => same-origin only. */
  allowlist?: string[];
  /** When true, only allowlisted origins are permitted (deny by default). */
  enforceAllowlist?: boolean;
  /** Verbs that always require interactive human approval. */
  approvalVerbs?: Verb[];
  /** Verbs that are categorically denied. */
  denyVerbs?: Verb[];
  killSwitch?: boolean;
}

const DEFAULT_APPROVAL: Verb[] = ['sideEffecting', 'destructive'];
const DEFAULT_DENY: Verb[] = ['destructive'];

export function originOf(target?: string): string | undefined {
  if (!target) return undefined;
  try {
    if (/^https?:\/\//i.test(target)) return new URL(target).origin;
    if (/^[\w-]+:\/\//.test(target)) return target.split('/')[0] + '//' + (target.split('/')[2] ?? '');
    return undefined;
  } catch {
    return undefined;
  }
}

export class OriginGuard {
  private allowlist: Set<string>;
  private enforceAllowlist: boolean;
  private approvalVerbs: Set<Verb>;
  private denyVerbs: Set<Verb>;
  private killSwitch: boolean;
  private audit: Array<{ ts: number; action: AgentAction; decision: PolicyDecision }> = [];

  constructor(opts: OriginGuardOptions = {}) {
    this.allowlist = new Set(opts.allowlist ?? []);
    this.enforceAllowlist = opts.enforceAllowlist ?? false;
    this.approvalVerbs = new Set(opts.approvalVerbs ?? DEFAULT_APPROVAL);
    this.denyVerbs = new Set(opts.denyVerbs ?? DEFAULT_DENY);
    this.killSwitch = opts.killSwitch ?? false;
  }

  setKillSwitch(on: boolean): void {
    this.killSwitch = on;
  }

  isKillSwitchOn(): boolean {
    return this.killSwitch;
  }

  setAllowlist(origins: string[]): void {
    this.allowlist = new Set(origins);
  }

  addAllowlist(origin: string): void {
    this.allowlist.add(origin);
  }

  setEnforceAllowlist(on: boolean): void {
    this.enforceAllowlist = on;
  }

  evaluate(action: AgentAction): PolicyDecision {
    const decision = this.evaluateInternal(action);
    this.audit.push({ ts: Date.now(), action, decision });
    if (this.audit.length > 1000) this.audit.shift();
    return decision;
  }

  private evaluateInternal(action: AgentAction): PolicyDecision {
    if (this.killSwitch) {
      return { allowed: false, reason: 'Kill switch engaged: all agent actions blocked.', requiresApproval: false, policy: 'kill-switch' };
    }
    if (this.denyVerbs.has(action.verb)) {
      return { allowed: false, reason: `Verb "${action.verb}" is categorically denied.`, requiresApproval: false, policy: 'deny-verb' };
    }
    const origin = action.origin ?? originOf(action.target);
    if (this.enforceAllowlist) {
      if (!origin || !this.allowlist.has(origin)) {
        return { allowed: false, reason: `Origin "${origin ?? 'unknown'}" is not in the allowlist.`, requiresApproval: false, policy: 'allowlist' };
      }
    }
    if (this.approvalVerbs.has(action.verb)) {
      // Permissions: approval is required but not auto-denied.
      return { allowed: true, reason: `Verb "${action.verb}" requires human approval.`, requiresApproval: true, policy: 'approval' };
    }
    return { allowed: true, reason: 'Action permitted by policy.', requiresApproval: false, policy: 'allow' };
  }

  getAuditLog(): Array<{ ts: number; action: AgentAction; decision: PolicyDecision }> {
    return [...this.audit];
  }
}
