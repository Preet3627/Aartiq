/**
 * ToolRegistry — registers tools and enforces the security pipeline on every call.
 *
 * Enforcement order for a call:
 *   1. If the tool has a `verb`, gate via SecurityPipeline.gateAction
 *      (agent trust → origin-guard). Destructive/side-effecting verbs may require
 *      interactive approval; the call is reported but not force-executed.
 *   2. If the tool `requiresTabLock`, acquire a tab lock for the agent.
 *   3. Run the handler.
 *   4. If the tool `untrustedOutput`, scan the returned text for prompt injection
 *      and quarantine it on detection.
 * Fail-closed: any gate rejection returns an error result, never the action.
 */

import type { Tool, ToolContext, CallOutcome, Bridge } from './types';
import { textResult } from './types';
import { originOf } from '../guardrails/origin-guard';
import type { IpiVerdict } from '../guardrails/prompt-injection';

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  registerMany(tools: Tool[]): void {
    for (const t of tools) this.register(t);
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  async call(name: string, args: any, ctx: Omit<ToolContext, 'bridge'> & { bridge: Bridge }): Promise<CallOutcome> {
    const tool = this.tools.get(name);
    if (!tool) return { error: `Unknown tool: ${name}` };

    // 1. Gate side-effecting verbs.
    if (tool.verb) {
      const target = args.url || args.target || args.tabId;
      const origin = originOf(target) ?? args.origin;
      const gate = await ctx.security.gateAction(ctx.agentId, {
        verb: tool.verb,
        target,
        origin,
        agentId: ctx.agentId,
        tool: name,
      });
      if (!gate.allowed) {
        return { error: gate.reason, gate: { allowed: false, requiresApproval: gate.requiresApproval, reason: gate.reason } };
      }
    }

    // 2. Tab lock.
    if (tool.requiresTabLock && args.tabId) {
      const lock = ctx.agents.locks.acquire({ tabId: String(args.tabId), agentId: ctx.agentId });
      if (!lock.ok) {
        return { error: `Tab ${args.tabId} is locked by another agent (${lock.heldBy}).`, gate: { allowed: false, requiresApproval: false, reason: 'tab-locked' } };
      }
    }

    // 3. Run handler.
    let result;
    try {
      result = await tool.handler(args, ctx as ToolContext);
    } catch (e) {
      return { error: (e as Error).message };
    }

    // 4. Scan untrusted output.
    if (tool.untrustedOutput && result) {
      const text = result.content.map((c) => c.text).join('\n');
      const verdict: IpiVerdict = await ctx.security.injection.scan(text, { untrusted: true });
      if (!verdict.safe) {
        return {
          error: `Refusing to return potentially injected content (score ${verdict.score.toFixed(2)}).`,
          injection: verdict,
          result: textResult(verdict.quarantineToken ?? '<<CONTENT_WITHHELD>>'),
        };
      }
    }

    return { result };
  }
}
