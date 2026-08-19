"use strict";
/**
 * TabLockManager — coordinates multiple agents acting on the same browser.
 *
 * At most one agent may "own" a tab at a time. Ownership is a lease with a TTL so
 * a crashed agent cannot hold a tab forever. Handoff is explicit: the owner
 * releases, then another agent acquires. This prevents two agents from issuing
 * conflicting input on the same page.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TabLockManager = void 0;
const DEFAULT_TTL = 30000;
class TabLockManager {
    constructor() {
        this.leases = new Map(); // keyed by tabId
    }
    isExpired(lease, now = Date.now()) {
        return lease.expiresAt <= now;
    }
    cleanup(tabId, now = Date.now()) {
        const l = this.leases.get(tabId);
        if (l && this.isExpired(l, now)) {
            this.leases.delete(tabId);
        }
    }
    /** Returns the current owner of a tab, or null if free/expired. */
    ownerOf(tabId) {
        this.cleanup(tabId);
        return this.leases.get(tabId)?.agentId ?? null;
    }
    /** True if the agent currently holds the lock on the tab. */
    isHeldBy(tabId, agentId) {
        return this.ownerOf(tabId) === agentId;
    }
    /**
     * Acquire the lock. Fails if another (non-expired) agent holds it, unless
     * `force` is set (operator override). Renews if the same agent re-requests.
     */
    acquire(req) {
        const now = Date.now();
        this.cleanup(req.tabId, now);
        const existing = this.leases.get(req.tabId);
        if (existing && existing.agentId !== req.agentId && !this.isExpired(existing, now)) {
            return { ok: false, heldBy: existing.agentId, reason: 'Tab is locked by another agent.' };
        }
        const ttl = req.ttlMs ?? DEFAULT_TTL;
        const lease = {
            tabId: req.tabId,
            agentId: req.agentId,
            acquiredAt: now,
            expiresAt: now + ttl,
        };
        this.leases.set(req.tabId, lease);
        return { ok: true, lease };
    }
    /** Renew a held lease (same agent only). */
    renew(tabId, agentId, ttlMs = DEFAULT_TTL) {
        const lease = this.leases.get(tabId);
        if (!lease || lease.agentId !== agentId)
            return false;
        lease.acquiredAt = Date.now();
        lease.expiresAt = Date.now() + ttlMs;
        return true;
    }
    /** Voluntarily release a lock. Only the owner (or force) may release. */
    release(tabId, agentId, force = false) {
        const lease = this.leases.get(tabId);
        if (!lease)
            return false;
        if (!force && lease.agentId !== agentId)
            return false;
        this.leases.delete(tabId);
        return true;
    }
    /** Explicit handoff: current owner releases, then target acquires atomically. */
    handoff(tabId, fromAgentId, toAgentId, ttlMs = DEFAULT_TTL) {
        const lease = this.leases.get(tabId);
        if (lease && lease.agentId !== fromAgentId) {
            return { ok: false, reason: 'Handoff requires the current owner.' };
        }
        this.leases.delete(tabId);
        const acquired = this.acquire({ tabId, agentId: toAgentId, ttlMs });
        return acquired.ok ? { ok: true, lease: acquired.lease } : { ok: false, reason: acquired.reason };
    }
    /** Release all locks held by an agent (e.g., on disconnect). */
    releaseAllForAgent(agentId) {
        let count = 0;
        for (const [tabId, lease] of this.leases) {
            if (lease.agentId === agentId) {
                this.leases.delete(tabId);
                count++;
            }
        }
        return count;
    }
    /** Drop every expired lease (call periodically). */
    sweep() {
        const now = Date.now();
        let count = 0;
        for (const [tabId, lease] of this.leases) {
            if (this.isExpired(lease, now)) {
                this.leases.delete(tabId);
                count++;
            }
        }
        return count;
    }
    snapshot() {
        const now = Date.now();
        const out = [];
        for (const [tabId, lease] of this.leases) {
            this.cleanup(tabId, now);
            const l = this.leases.get(tabId);
            if (l)
                out.push({ ...l });
        }
        return out;
    }
}
exports.TabLockManager = TabLockManager;
