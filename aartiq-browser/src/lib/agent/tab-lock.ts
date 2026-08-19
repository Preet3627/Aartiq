/**
 * TabLockManager — coordinates multiple agents acting on the same browser.
 *
 * At most one agent may "own" a tab at a time. Ownership is a lease with a TTL so
 * a crashed agent cannot hold a tab forever. Handoff is explicit: the owner
 * releases, then another agent acquires. This prevents two agents from issuing
 * conflicting input on the same page.
 */

export interface TabLease {
  tabId: string;
  agentId: string;
  acquiredAt: number;
  expiresAt: number;
}

export interface LockRequest {
  tabId: string;
  agentId: string;
  ttlMs?: number;
}

const DEFAULT_TTL = 30_000;

export class TabLockManager {
  private leases = new Map<string, TabLease>(); // keyed by tabId

  private isExpired(lease: TabLease, now = Date.now()): boolean {
    return lease.expiresAt <= now;
  }

  private cleanup(tabId: string, now = Date.now()): void {
    const l = this.leases.get(tabId);
    if (l && this.isExpired(l, now)) {
      this.leases.delete(tabId);
    }
  }

  /** Returns the current owner of a tab, or null if free/expired. */
  ownerOf(tabId: string): string | null {
    this.cleanup(tabId);
    return this.leases.get(tabId)?.agentId ?? null;
  }

  /** True if the agent currently holds the lock on the tab. */
  isHeldBy(tabId: string, agentId: string): boolean {
    return this.ownerOf(tabId) === agentId;
  }

  /**
   * Acquire the lock. Fails if another (non-expired) agent holds it, unless
   * `force` is set (operator override). Renews if the same agent re-requests.
   */
  acquire(req: LockRequest): { ok: boolean; lease?: TabLease; heldBy?: string; reason?: string } {
    const now = Date.now();
    this.cleanup(req.tabId, now);
    const existing = this.leases.get(req.tabId);
    if (existing && existing.agentId !== req.agentId && !this.isExpired(existing, now)) {
      return { ok: false, heldBy: existing.agentId, reason: 'Tab is locked by another agent.' };
    }
    const ttl = req.ttlMs ?? DEFAULT_TTL;
    const lease: TabLease = {
      tabId: req.tabId,
      agentId: req.agentId,
      acquiredAt: now,
      expiresAt: now + ttl,
    };
    this.leases.set(req.tabId, lease);
    return { ok: true, lease };
  }

  /** Renew a held lease (same agent only). */
  renew(tabId: string, agentId: string, ttlMs = DEFAULT_TTL): boolean {
    const lease = this.leases.get(tabId);
    if (!lease || lease.agentId !== agentId) return false;
    lease.acquiredAt = Date.now();
    lease.expiresAt = Date.now() + ttlMs;
    return true;
  }

  /** Voluntarily release a lock. Only the owner (or force) may release. */
  release(tabId: string, agentId: string, force = false): boolean {
    const lease = this.leases.get(tabId);
    if (!lease) return false;
    if (!force && lease.agentId !== agentId) return false;
    this.leases.delete(tabId);
    return true;
  }

  /** Explicit handoff: current owner releases, then target acquires atomically. */
  handoff(tabId: string, fromAgentId: string, toAgentId: string, ttlMs = DEFAULT_TTL): { ok: boolean; lease?: TabLease; reason?: string } {
    const lease = this.leases.get(tabId);
    if (lease && lease.agentId !== fromAgentId) {
      return { ok: false, reason: 'Handoff requires the current owner.' };
    }
    this.leases.delete(tabId);
    const acquired = this.acquire({ tabId, agentId: toAgentId, ttlMs });
    return acquired.ok ? { ok: true, lease: acquired.lease } : { ok: false, reason: acquired.reason };
  }

  /** Release all locks held by an agent (e.g., on disconnect). */
  releaseAllForAgent(agentId: string): number {
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
  sweep(): number {
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

  snapshot(): TabLease[] {
    const now = Date.now();
    const out: TabLease[] = [];
    for (const [tabId, lease] of this.leases) {
      this.cleanup(tabId, now);
      const l = this.leases.get(tabId);
      if (l) out.push({ ...l });
    }
    return out;
  }
}
