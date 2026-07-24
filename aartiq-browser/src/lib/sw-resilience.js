// ============================================================================
// sw-resilience.js — Service Worker Lifecycle Resilience
// Persists pending approvals across service restarts.
// Clears orphaned approvals from previous lifecycle.
// Alarm-based timeouts survive restarts via localStorage timestamps.
// ============================================================================

const PENDING_APPROVALS_KEY = 'aartiq_sw_pending_approvals';
const ORPHAN_CLEANUP_KEY = 'aartiq_sw_orphan_cleanup_id';

// ---------------------------------------------------------------------------
// Pending approval persistence
// ---------------------------------------------------------------------------

function loadPendingApprovals() {
    try {
        const raw = localStorage.getItem(PENDING_APPROVALS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function savePendingApprovals(approvals) {
    try {
        localStorage.setItem(PENDING_APPROVALS_KEY, JSON.stringify(approvals));
    } catch {
        console.warn('[SWResilience] Failed to save pending approvals');
    }
}

// ---------------------------------------------------------------------------
// Approval record for persistence
// ---------------------------------------------------------------------------

class PersistedApproval {
    constructor(id, actionType, description, context, createdAt, timeoutMs) {
        this.id = id;
        this.actionType = actionType;
        this.description = description;
        this.context = context;
        this.createdAt = createdAt;
        this.timeoutMs = timeoutMs;
        this.timeoutAt = createdAt + timeoutMs;
    }

    isExpired() {
        return Date.now() > this.timeoutAt;
    }

    remainingMs() {
        return Math.max(0, this.timeoutAt - Date.now());
    }
}

// ---------------------------------------------------------------------------
// Approval Resolver
// ---------------------------------------------------------------------------

class ApprovalResolver {
    constructor() {
        this.handlers = new Map();
        this.persistenceInterval = null;
    }

    // Register an approval that can be resolved later
    registerApproval(id, actionType, description, context = {}, timeoutMs = 5 * 60 * 1000) {
        const approval = new PersistedApproval(
            id, actionType, description, context,
            Date.now(), timeoutMs
        );

        const existing = loadPendingApprovals();
        existing.push({
            id: approval.id,
            actionType: approval.actionType,
            description: approval.description,
            context: approval.context,
            createdAt: approval.createdAt,
            timeoutMs: approval.timeoutMs,
            timeoutAt: approval.timeoutAt,
        });
        savePendingApprovals(existing);

        return approval;
    }

    // Resolve an approval (called by UI or timeout)
    resolveApproval(id, result) {
        const handler = this.handlers.get(id);
        if (handler) {
            handler(result);
            this.handlers.delete(id);
        }

        // Remove from persisted storage
        const existing = loadPendingApprovals().filter(a => a.id !== id);
        savePendingApprovals(existing);
    }

    // Wait for an approval to be resolved (create promise)
    waitForApproval(id) {
        return new Promise((resolve) => {
            this.handlers.set(id, resolve);
        });
    }

    // Called when service starts — rehydrate pending approvals
    rehydratePendingApprovals() {
        const pending = loadPendingApprovals();
        const now = Date.now();
        const valid = [];

        for (const approval of pending) {
            // Remove expired approvals
            if (now > approval.timeoutAt) {
                continue;
            }

            valid.push(approval);

            // If handler exists, don't re-register
            if (!this.handlers.has(approval.id)) {
                const remaining = approval.timeoutAt - now;
                const timeout = setTimeout(() => {
                    this.resolveApproval(approval.id, {
                        approved: false,
                        timedOut: true,
                        reason: 'Approval timed out (rehydrated)',
                    });
                }, remaining);

                this.handlers.set(approval.id, (result) => {
                    clearTimeout(timeout);
                    // Forward result to waiter
                });
            }
        }

        savePendingApprovals(valid);

        if (valid.length > 0) {
            console.log(`[SWResilience] Rehydrated ${valid.length} pending approval(s)`);
        }

        return valid;
    }

    // Clear orphaned approvals from previous lifecycle
    clearOrphanedApprovals() {
        const cleanupId = `cleanup-${Date.now()}`;
        const previousCleanupId = localStorage.getItem(ORPHAN_CLEANUP_KEY);

        if (previousCleanupId) {
            const pending = loadPendingApprovals();
            // Orphaned = approvals created before this cleanup run
            const threshold = Date.now() - 60000; // 1 minute buffer
            const orphans = pending.filter(a => a.createdAt < threshold);

            for (const orphan of orphans) {
                console.log(`[SWResilience] Cleaning orphaned approval: ${orphan.id}`);
                const existing = loadPendingApprovals().filter(a => a.id !== orphan.id);
                savePendingApprovals(existing);
            }

            if (orphans.length > 0) {
                console.log(`[SWResilience] Cleared ${orphans.length} orphaned approval(s)`);
            }
        }

        localStorage.setItem(ORPHAN_CLEANUP_KEY, cleanupId);
    }

    // Start periodic persistence sync
    startAutoSync(intervalMs = 30000) {
        if (this.persistenceInterval) return;
        this.persistenceInterval = setInterval(() => {
            // Prune expired approvals
            const pending = loadPendingApprovals();
            const valid = pending.filter(a => !new PersistedApproval(
                a.id, a.actionType, a.description, a.context, a.createdAt, a.timeoutMs
            ).isExpired());
            if (valid.length !== pending.length) {
                savePendingApprovals(valid);
            }
        }, intervalMs);
    }

    stopAutoSync() {
        if (this.persistenceInterval) {
            clearInterval(this.persistenceInterval);
            this.persistenceInterval = null;
        }
    }

    getStats() {
        const pending = loadPendingApprovals();
        return {
            persistedApprovals: pending.length,
            activeHandlers: this.handlers.size,
            expiredApprovals: pending.filter(a => new PersistedApproval(
                a.id, a.actionType, a.description, a.context, a.createdAt, a.timeoutMs
            ).isExpired()).length,
        };
    }

    // Called on service shutdown — persist state
    onShutdown() {
        this.stopAutoSync();
        // Pending approvals remain in localStorage for next lifecycle
    }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

const globalResolver = new ApprovalResolver();

module.exports = {
    ApprovalResolver,
    globalResolver,
    PersistedApproval,
    loadPendingApprovals,
    savePendingApprovals,
};
