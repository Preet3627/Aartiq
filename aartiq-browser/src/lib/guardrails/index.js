"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityPipeline = exports.SecurityGuardrails = exports.UNTRUSTED_CONTENT_DIRECTIVE = exports.unspotlight = exports.spotlight = exports.AgentTrustRegistry = exports.originOf = exports.OriginGuard = exports.defaultPromptInjectionGuard = exports.PromptInjectionGuard = exports.getPatternsForMode = exports.ALL_PATTERNS = exports.wrapAttachedFiles = exports.wrapUserRequest = exports.containsThreat = exports.sanitize = exports.ThreatType = void 0;
var types_1 = require("./types");
Object.defineProperty(exports, "ThreatType", { enumerable: true, get: function () { return types_1.ThreatType; } });
var sanitizer_1 = require("./sanitizer");
Object.defineProperty(exports, "sanitize", { enumerable: true, get: function () { return sanitizer_1.sanitize; } });
Object.defineProperty(exports, "containsThreat", { enumerable: true, get: function () { return sanitizer_1.containsThreat; } });
Object.defineProperty(exports, "wrapUserRequest", { enumerable: true, get: function () { return sanitizer_1.wrapUserRequest; } });
Object.defineProperty(exports, "wrapAttachedFiles", { enumerable: true, get: function () { return sanitizer_1.wrapAttachedFiles; } });
var patterns_1 = require("./patterns");
Object.defineProperty(exports, "ALL_PATTERNS", { enumerable: true, get: function () { return patterns_1.ALL_PATTERNS; } });
Object.defineProperty(exports, "getPatternsForMode", { enumerable: true, get: function () { return patterns_1.getPatternsForMode; } });
// ---------------------------------------------------------------------------
// Advanced defense-in-depth modules (ported/inspired from tandem + research)
// ---------------------------------------------------------------------------
var prompt_injection_1 = require("./prompt-injection");
Object.defineProperty(exports, "PromptInjectionGuard", { enumerable: true, get: function () { return prompt_injection_1.PromptInjectionGuard; } });
Object.defineProperty(exports, "defaultPromptInjectionGuard", { enumerable: true, get: function () { return prompt_injection_1.defaultPromptInjectionGuard; } });
var origin_guard_1 = require("./origin-guard");
Object.defineProperty(exports, "OriginGuard", { enumerable: true, get: function () { return origin_guard_1.OriginGuard; } });
Object.defineProperty(exports, "originOf", { enumerable: true, get: function () { return origin_guard_1.originOf; } });
var agent_trust_1 = require("./agent-trust");
Object.defineProperty(exports, "AgentTrustRegistry", { enumerable: true, get: function () { return agent_trust_1.AgentTrustRegistry; } });
var spotlight_1 = require("./spotlight");
Object.defineProperty(exports, "spotlight", { enumerable: true, get: function () { return spotlight_1.spotlight; } });
Object.defineProperty(exports, "unspotlight", { enumerable: true, get: function () { return spotlight_1.unspotlight; } });
Object.defineProperty(exports, "UNTRUSTED_CONTENT_DIRECTIVE", { enumerable: true, get: function () { return spotlight_1.UNTRUSTED_CONTENT_DIRECTIVE; } });
const sanitizer_2 = require("./sanitizer");
class SecurityGuardrails {
    constructor(mode = 'normal') {
        this.mode = mode;
    }
    setMode(mode) {
        this.mode = mode;
    }
    getMode() {
        return this.mode;
    }
    sanitize(input, options) {
        return (0, sanitizer_2.sanitize)(input, this.mode, options);
    }
    containsThreat(input) {
        return (0, sanitizer_2.containsThreat)(input, this.mode);
    }
    checkAndSanitize(input, options) {
        const result = this.sanitize(input, options);
        return {
            safe: result.threats.length === 0,
            result,
        };
    }
}
exports.SecurityGuardrails = SecurityGuardrails;
// ---------------------------------------------------------------------------
// Re-export the normalize function from sanitizer (for internal use)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// SecurityPipeline — ties prompt-injection, agent-trust and origin-guard into
// one enforceable gate for agent/MCP actions. Every side-effecting action must
// pass through here. Fail-closed by construction.
// ---------------------------------------------------------------------------
const prompt_injection_2 = require("./prompt-injection");
const origin_guard_2 = require("./origin-guard");
const agent_trust_2 = require("./agent-trust");
class SecurityPipeline {
    constructor(opts) {
        this.injection = opts?.injection ?? new prompt_injection_2.PromptInjectionGuard();
        this.origin = opts?.origin ?? new origin_guard_2.OriginGuard();
        this.agents = opts?.agents ?? new agent_trust_2.AgentTrustRegistry();
    }
    /** Scan untrusted text (web content / tool output) before it reaches the model. */
    async scanUntrusted(text, toolName, ctx) {
        return this.injection.scanToolOutput(toolName ?? 'unknown', text, ctx);
    }
    /** Gate an agent action: trust → injection → origin policy. */
    async gateAction(agentId, action) {
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
exports.SecurityPipeline = SecurityPipeline;
