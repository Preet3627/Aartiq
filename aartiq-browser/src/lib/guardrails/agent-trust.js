"use strict";
/**
 * AgentTrustRegistry — per-agent trust, capability scoping and behavioral scoring.
 *
 * Multiple agents may share one browser. Each gets a trust level that gates which
 * verbs/origins it may use. Failed actions and injection attempts lower trust;
 * enough degradation revokes the agent. Default-deny: an unknown agent has no
 * capabilities until explicitly registered.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentTrustRegistry = void 0;
const BASELINE = {
    untrusted: 10,
    limited: 35,
    standard: 60,
    privileged: 85,
};
const DEFAULT_CAPS = {
    untrusted: { verbs: ['readOnly'], origins: [], maxConcurrentTabs: 1, canRequestApproval: false },
    limited: { verbs: ['readOnly', 'navigate', 'input'], origins: [], maxConcurrentTabs: 2, canRequestApproval: true },
    standard: { verbs: ['readOnly', 'navigate', 'input', 'sideEffecting'], origins: [], maxConcurrentTabs: 4, canRequestApproval: true },
    privileged: { verbs: ['readOnly', 'navigate', 'input', 'sideEffecting', 'destructive'], origins: [], maxConcurrentTabs: 8, canRequestApproval: true },
};
class AgentTrustRegistry {
    constructor() {
        this.agents = new Map();
    }
    register(input) {
        const trust = input.trust ?? 'limited';
        const caps = mergeCaps(trust, input.capabilities);
        const now = Date.now();
        const agent = {
            id: input.id,
            name: input.name,
            trust,
            trustScore: BASELINE[trust],
            capabilities: caps,
            createdAt: now,
            lastSeen: now,
            revoked: false,
            injectionAttempts: 0,
            failedActions: 0,
            successfulActions: 0,
        };
        this.agents.set(input.id, agent);
        return agent;
    }
    get(id) {
        return this.agents.get(id);
    }
    list() {
        return [...this.agents.values()];
    }
    touch(id) {
        const a = this.agents.get(id);
        if (a)
            a.lastSeen = Date.now();
    }
    setTrust(id, trust) {
        const a = this.agents.get(id);
        if (!a)
            return;
        a.trust = trust;
        a.capabilities = mergeCaps(trust, a.capabilities);
        a.trustScore = BASELINE[trust];
    }
    revoke(id, reason = 'revoked') {
        const a = this.agents.get(id);
        if (!a)
            return;
        a.revoked = true;
        a.capabilities = { verbs: [], origins: [], maxConcurrentTabs: 0, canRequestApproval: false };
        a.trust = 'untrusted';
        a.trustScore = 0;
        void reason;
    }
    /** Record a behavioral event and adjust trust score. */
    recordInjectionAttempt(id) {
        const a = this.agents.get(id);
        if (!a)
            return;
        a.injectionAttempts += 1;
        a.trustScore = Math.max(0, a.trustScore - 25);
        if (a.trustScore < 20)
            this.revoke(id, 'repeated injection attempts');
    }
    recordAction(id, success, verb) {
        const a = this.agents.get(id);
        if (!a)
            return;
        if (success) {
            a.successfulActions += 1;
            a.trustScore = Math.min(100, a.trustScore + 1);
        }
        else {
            a.failedActions += 1;
            a.trustScore = Math.max(0, a.trustScore - 5);
        }
        this.recomputeLevel(a);
    }
    recomputeLevel(a) {
        if (a.revoked)
            return;
        let level = 'untrusted';
        if (a.trustScore >= 80)
            level = 'privileged';
        else if (a.trustScore >= 55)
            level = 'standard';
        else if (a.trustScore >= 30)
            level = 'limited';
        if (level !== a.trust) {
            a.trust = level;
            a.capabilities = mergeCaps(level, a.capabilities);
        }
    }
    /** Does this agent have the capability to perform the verb at the origin? */
    can(id, verb, origin) {
        const a = this.agents.get(id);
        if (!a || a.revoked)
            return false;
        if (!a.capabilities.verbs.includes(verb))
            return false;
        if (origin && a.capabilities.origins.length > 0 && !a.capabilities.origins.includes(origin)) {
            return false;
        }
        return true;
    }
}
exports.AgentTrustRegistry = AgentTrustRegistry;
function mergeCaps(trust, partial) {
    const base = DEFAULT_CAPS[trust];
    return {
        verbs: partial?.verbs ?? base.verbs,
        origins: partial?.origins ?? base.origins,
        maxConcurrentTabs: partial?.maxConcurrentTabs ?? base.maxConcurrentTabs,
        canRequestApproval: partial?.canRequestApproval ?? base.canRequestApproval,
    };
}
