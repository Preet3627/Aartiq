"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = void 0;
const types_1 = require("./types");
const origin_guard_1 = require("../guardrails/origin-guard");
class ToolRegistry {
    constructor() {
        this.tools = new Map();
    }
    register(tool) {
        this.tools.set(tool.name, tool);
    }
    registerMany(tools) {
        for (const t of tools)
            this.register(t);
    }
    list() {
        return [...this.tools.values()];
    }
    get(name) {
        return this.tools.get(name);
    }
    async call(name, args, ctx) {
        const tool = this.tools.get(name);
        if (!tool)
            return { error: `Unknown tool: ${name}` };
        // 1. Gate side-effecting verbs.
        if (tool.verb) {
            const target = args.url || args.target || args.tabId;
            const origin = (0, origin_guard_1.originOf)(target) ?? args.origin;
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
            result = await tool.handler(args, ctx);
        }
        catch (e) {
            return { error: e.message };
        }
        // 4. Scan untrusted output.
        if (tool.untrustedOutput && result) {
            const text = result.content.map((c) => c.text).join('\n');
            const verdict = await ctx.security.injection.scan(text, { untrusted: true });
            if (!verdict.safe) {
                return {
                    error: `Refusing to return potentially injected content (score ${verdict.score.toFixed(2)}).`,
                    injection: verdict,
                    result: (0, types_1.textResult)(verdict.quarantineToken ?? '<<CONTENT_WITHHELD>>'),
                };
            }
        }
        return { result };
    }
}
exports.ToolRegistry = ToolRegistry;
