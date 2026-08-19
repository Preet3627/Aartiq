"use strict";
/**
 * OriginGuard — deterministic, fail-closed execution policy.
 *
 * This is Layer 3 of the injection defense: even if the model is persuaded into a
 * malicious plan, no side-effecting action leaves the browser unless it satisfies
 * an explicit policy. Always fails closed (deny) when the policy is unclear.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OriginGuard = void 0;
exports.originOf = originOf;
const DEFAULT_APPROVAL = ['sideEffecting', 'destructive'];
const DEFAULT_DENY = ['destructive'];
function originOf(target) {
    if (!target)
        return undefined;
    try {
        if (/^https?:\/\//i.test(target))
            return new URL(target).origin;
        if (/^[\w-]+:\/\//.test(target))
            return target.split('/')[0] + '//' + (target.split('/')[2] ?? '');
        return undefined;
    }
    catch {
        return undefined;
    }
}
class OriginGuard {
    constructor(opts = {}) {
        this.audit = [];
        this.allowlist = new Set(opts.allowlist ?? []);
        this.enforceAllowlist = opts.enforceAllowlist ?? false;
        this.approvalVerbs = new Set(opts.approvalVerbs ?? DEFAULT_APPROVAL);
        this.denyVerbs = new Set(opts.denyVerbs ?? DEFAULT_DENY);
        this.killSwitch = opts.killSwitch ?? false;
    }
    setKillSwitch(on) {
        this.killSwitch = on;
    }
    isKillSwitchOn() {
        return this.killSwitch;
    }
    setAllowlist(origins) {
        this.allowlist = new Set(origins);
    }
    addAllowlist(origin) {
        this.allowlist.add(origin);
    }
    setEnforceAllowlist(on) {
        this.enforceAllowlist = on;
    }
    evaluate(action) {
        const decision = this.evaluateInternal(action);
        this.audit.push({ ts: Date.now(), action, decision });
        if (this.audit.length > 1000)
            this.audit.shift();
        return decision;
    }
    evaluateInternal(action) {
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
    getAuditLog() {
        return [...this.audit];
    }
}
exports.OriginGuard = OriginGuard;
