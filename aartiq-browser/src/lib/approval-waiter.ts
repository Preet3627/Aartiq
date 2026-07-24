// ---------------------------------------------------------------------------
// Approval Waiter — Promise-based async approval waiting with timeout.
// Blocks automation execution until human approves/denies or timeout fires.
// Inspired by comet-t's task-runner.ts:214-231.
// ---------------------------------------------------------------------------

export interface ApprovalRequest {
  id: string;
  actionType: string;
  description: string;
  context: Record<string, unknown>;
  createdAt: number;
  timeoutMs: number;
}

export interface ApprovalResult {
  approved: boolean;
  ticketId?: string;
  reason?: string;
  timedOut: boolean;
}

type ApprovalResolver = (result: ApprovalResult) => void;

// ---------------------------------------------------------------------------
// ApprovalWaiter class
// ---------------------------------------------------------------------------

export class ApprovalWaiter {
  private pendingApprovals: Map<string, ApprovalResolver>;
  private timeouts: Map<string, ReturnType<typeof setTimeout>>;
  private requestCounter: number;

  constructor() {
    this.pendingApprovals = new Map();
    this.timeouts = new Map();
    this.requestCounter = 0;
  }

  /**
   * Create an approval request and return a promise that resolves when
   * the user approves/denies or the timeout fires.
   */
  async waitForApproval(
    actionType: string,
    description: string,
    context: Record<string, unknown> = {},
    timeoutMs: number = 5 * 60 * 1000
  ): Promise<ApprovalResult> {
    const id = `approval-${++this.requestCounter}-${Date.now()}`;

    return new Promise<ApprovalResult>((resolve) => {
      this.pendingApprovals.set(id, resolve);

      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingApprovals.delete(id);
        this.timeouts.delete(id);
        resolve({
          approved: false,
          timedOut: true,
          reason: 'Approval timed out',
        });
      }, timeoutMs);

      this.timeouts.set(id, timeout);

      // Emit event for UI to pick up
      this.emitApprovalRequest({
        id,
        actionType,
        description,
        context,
        createdAt: Date.now(),
        timeoutMs,
      });
    }).finally(() => {
      this.cleanup(id);
    });
  }

  /**
   * Resolve a pending approval (called by UI).
   */
  resolveApproval(id: string, result: ApprovalResult): boolean {
    const resolve = this.pendingApprovals.get(id);
    if (!resolve) return false;

    this.cleanup(id);
    resolve(result);
    return true;
  }

  approve(id: string, ticketId?: string): boolean {
    return this.resolveApproval(id, {
      approved: true,
      ticketId,
      timedOut: false,
    });
  }

  deny(id: string, reason?: string): boolean {
    return this.resolveApproval(id, {
      approved: false,
      reason: reason || 'Denied by user',
      timedOut: false,
    });
  }

  /**
   * Check if an approval is still pending.
   */
  isPending(id: string): boolean {
    return this.pendingApprovals.has(id);
  }

  /**
   * Get count of pending approvals.
   */
  get pendingCount(): number {
    return this.pendingApprovals.size;
  }

  /**
   * Get all pending approval IDs.
   */
  getPendingIds(): string[] {
    return Array.from(this.pendingApprovals.keys());
  }

  /**
   * Cancel all pending approvals (e.g., on service shutdown).
   */
  cancelAll(reason: string = 'Service shutting down'): void {
    for (const [id, resolve] of this.pendingApprovals) {
      this.cleanup(id);
      resolve({
        approved: false,
        reason,
        timedOut: false,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Event sink — overridable for UI integration
  // -----------------------------------------------------------------------

  onApprovalRequest: ((request: ApprovalRequest) => void) | null = null;

  private emitApprovalRequest(request: ApprovalRequest): void {
    if (this.onApprovalRequest) {
      this.onApprovalRequest(request);
    }
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private cleanup(id: string): void {
    this.pendingApprovals.delete(id);
    const timeout = this.timeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(id);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

const globalApprovalWaiter = new ApprovalWaiter();

export function getApprovalWaiter(): ApprovalWaiter {
  return globalApprovalWaiter;
}
