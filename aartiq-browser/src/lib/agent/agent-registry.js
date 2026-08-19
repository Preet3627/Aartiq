"use strict";
/**
 * AgentRegistry — live multi-agent session registry for one browser.
 *
 * Tracks connected agents (MCP clients, remote agents, in-product assistants),
 * their trust, and coordinates tab locks via TabLockManager. This is the
 * coordination layer that lets "multiple agents connected to the same browser at
 * once" operate without stepping on each other.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRegistry = void 0;
const agent_trust_1 = require("../guardrails/agent-trust");
const tab_lock_1 = require("./tab-lock");
class AgentRegistry {
    constructor(trust) {
        this.connections = new Map();
        this.trust = trust ?? new agent_trust_1.AgentTrustRegistry();
        this.locks = new tab_lock_1.TabLockManager();
    }
    /** Register an agent and open a connection. Default trust = limited. */
    connect(input) {
        const agent = this.trust.register({ id: input.id, name: input.name, trust: input.trust, capabilities: input.capabilities });
        this.connections.set(input.id, {
            id: input.id,
            transport: input.transport ?? 'mcp',
            remote: input.remote ?? false,
            userAgent: input.userAgent,
            pairedAt: Date.now(),
        });
        return agent;
    }
    disconnect(agentId) {
        this.locks.releaseAllForAgent(agentId);
        this.connections.delete(agentId);
        // Keep the trust record for behavioral history, but revoke live access.
        const a = this.trust.get(agentId);
        if (a)
            this.trust.revoke(agentId, 'disconnected');
    }
    getConnection(agentId) {
        return this.connections.get(agentId);
    }
    connectedAgents() {
        return [...this.connections.values()];
    }
    /** Convenience: gate an action for a connected agent (trust + tab lock). */
    async authorize(agentId, tabId, verb, origin) {
        const agent = this.trust.get(agentId);
        if (!agent || agent.revoked)
            return { ok: false, reason: 'Agent not connected or revoked.' };
        if (!this.trust.can(agentId, verb, origin)) {
            return { ok: false, reason: `Agent "${agent.trust}" cannot perform "${verb}".` };
        }
        const heldBy = this.locks.ownerOf(tabId);
        if (heldBy && heldBy !== agentId) {
            return { ok: false, reason: 'Tab is locked by another agent.', heldBy };
        }
        return { ok: true, reason: 'authorized' };
    }
    /** Acquire a tab lock as part of authorizing an action. */
    lockTab(tabId, agentId, ttlMs) {
        return this.locks.acquire({ tabId, agentId, ttlMs });
    }
}
exports.AgentRegistry = AgentRegistry;
