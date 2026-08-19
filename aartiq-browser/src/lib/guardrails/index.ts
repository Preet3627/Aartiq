export type { ThreatType, GuardrailMode } from './types';
export type { ThreatMatch, SanitizationResult } from './types';

export {
  sanitize,
  containsThreat,
  wrapUserRequest,
  wrapAttachedFiles,
} from './sanitizer';

export { ALL_PATTERNS, getPatternsForMode } from './patterns';
export type { ThreatPattern } from './patterns';

// ---------------------------------------------------------------------------
// Advanced defense-in-depth modules (ported/inspired from tandem + research)
// ---------------------------------------------------------------------------

export {
  PromptInjectionGuard,
  defaultPromptInjectionGuard,
} from './prompt-injection';
export type {
  IpiLayer,
  IpiAction,
  IpiThreat,
  IpiVerdict,
  SemanticCritic,
  ScanContext,
} from './prompt-injection';

export { OriginGuard, originOf } from './origin-guard';
export type { Verb, AgentAction, PolicyDecision, OriginGuardOptions } from './origin-guard';

export { AgentTrustRegistry } from './agent-trust';
export type {
  TrustLevel,
  AgentCapabilities,
  RegisteredAgent,
  RegisterAgentInput,
} from './agent-trust';

export { spotlight, unspotlight, UNTRUSTED_CONTENT_DIRECTIVE } from './spotlight';
export type { SpotlightMethod } from './spotlight';

// ---------------------------------------------------------------------------
// SecurityGuardrails class — two-tier (normal/strict)
// ---------------------------------------------------------------------------

import { type GuardrailMode, type SanitizationResult } from './types';
import { sanitize, containsThreat } from './sanitizer';

export class SecurityGuardrails {
  private mode: GuardrailMode;

  constructor(mode: GuardrailMode = 'normal') {
    this.mode = mode;
  }

  setMode(mode: GuardrailMode): void {
    this.mode = mode;
  }

  getMode(): GuardrailMode {
    return this.mode;
  }

  sanitize(
    input: string,
    options?: { wrapUntrusted?: boolean; warnings?: string[] }
  ): SanitizationResult {
    return sanitize(input, this.mode, options);
  }

  containsThreat(input: string): boolean {
    return containsThreat(input, this.mode);
  }

  checkAndSanitize(
    input: string,
    options?: { wrapUntrusted?: boolean; warnings?: string[] }
  ): { safe: boolean; result: SanitizationResult } {
    const result = this.sanitize(input, options);
    return {
      safe: result.threats.length === 0,
      result,
    };
  }
}

// ---------------------------------------------------------------------------
// Re-export the normalize function from sanitizer (for internal use)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// SecurityPipeline — ties prompt-injection, agent-trust and origin-guard into
// one enforceable gate for agent/MCP actions. Every side-effecting action must
// pass through here. Fail-closed by construction.
// ---------------------------------------------------------------------------

import { PromptInjectionGuard } from './prompt-injection';
import { OriginGuard } from './origin-guard';
import { AgentTrustRegistry } from './agent-trust';
import type { AgentAction } from './origin-guard';

export interface GateResult {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
  injection?: import('./prompt-injection').IpiVerdict;
}

export class SecurityPipeline {
  readonly injection: PromptInjectionGuard;
  readonly origin: OriginGuard;
  readonly agents: AgentTrustRegistry;

  constructor(opts?: { injection?: PromptInjectionGuard; origin?: OriginGuard; agents?: AgentTrustRegistry }) {
    this.injection = opts?.injection ?? new PromptInjectionGuard();
    this.origin = opts?.origin ?? new OriginGuard();
    this.agents = opts?.agents ?? new AgentTrustRegistry();
  }

  /** Scan untrusted text (web content / tool output) before it reaches the model. */
  async scanUntrusted(text: string, toolName?: string, ctx?: import('./prompt-injection').ScanContext) {
    return this.injection.scanToolOutput(toolName ?? 'unknown', text, ctx);
  }

  /** Gate an agent action: trust → injection → origin policy. */
  async gateAction(agentId: string, action: AgentAction): Promise<GateResult> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { allowed: false, requiresApproval: false, reason: 'Unknown agent: not registered.' };
    }
    if (agent.revoked) {
      return { allowed: false, requiresApproval: false, reason: 'Agent is revoked.' };
    }
    if (!this.agents.can(agentId, action.verb, action.origin ?? undefined)) {
      return { allowed: false, requiresApproval: false, reason: `Agent trust level "${agent.trust}" lacks verb "${action.verb}".` };
    }
    const decision = this.origin.evaluate(action);
    if (!decision.allowed && !decision.requiresApproval) {
      return { allowed: false, requiresApproval: false, reason: decision.reason };
    }
    this.agents.touch(agentId);
    return { allowed: true, requiresApproval: decision.requiresApproval, reason: decision.reason };
  }
}
