const { ApprovalTicketManager } = require('./approval-ticket-manager');

class CapabilityController {
  constructor(options = {}) {
    this.actions = new Map();
    this.firstTimeApprovals = new Set();
    this.permissionStore = options.permissionStore || null;
    
    // Ticket-based approval system
    this.ticketManager = new ApprovalTicketManager({
      ticketTTL: options.ticketTTL || 5 * 60 * 1000, // 5 minutes
    });
    
    // Callback to notify renderer of pending approvals
    this.onApprovalRequired = options.onApprovalRequired || null;

    // Pending approval resolvers: ticketId → { resolve, reject, timer }
    this._pendingApprovalCallbacks = new Map();
  }

  registerAction(action) {
    if (this.actions.has(action.name)) {
      throw new Error(`Action "${action.name}" is already registered.`);
    }
    const capabilityVersion = action.capabilityVersion || 1;
    this.actions.set(action.name, {
      name: action.name,
      handler: action.handler,
      requiresApproval: action.requiresApproval || 'never',
      riskLevel: action.riskLevel || 'low',
      description: action.description || '',
      capabilityVersion,
      registeredAt: Date.now(),
    });
  }

  /**
   * Replace an action's handler/definition while bumping its capability version.
   * Any outstanding tickets bound to the previous version become unredeemable.
   */
  replaceAction(action) {
    if (!this.actions.has(action.name)) {
      throw new Error(`Action "${action.name}" is not registered.`);
    }
    const prev = this.actions.get(action.name);
    this.actions.set(action.name, {
      name: action.name,
      handler: action.handler,
      requiresApproval: action.requiresApproval || 'never',
      riskLevel: action.riskLevel || 'low',
      description: action.description || '',
      capabilityVersion: (prev.capabilityVersion || 1) + 1,
      registeredAt: Date.now(),
    });
  }

  getAction(name) {
    return this.actions.get(name);
  }

  /**
   * Execute an action with ticket-based approval
   * 
   * Flow:
   * 1. Check if action needs approval
   * 2. If yes, issue a ticket and return {needsApproval: true, ticketId, ...}
   * 3. Renderer shows approval UI with ticketId
   * 4. User approves → renderer calls approveAndExecute(ticketId)
   * 5. Main validates ticket, verifies params hash, executes action
   */
  async executeAction(name, params = {}) {
    const action = this.actions.get(name);
    if (!action) {
      return { approved: false, reason: `Action "${name}" is not registered.` };
    }

    let needsApproval = false;
    let approvalReason = '';

    if (action.requiresApproval === 'always') {
      needsApproval = true;
      approvalReason = 'This action always requires approval';
    } else if (action.requiresApproval === 'first-time-per-session') {
      if (!this.firstTimeApprovals.has(name)) {
        needsApproval = true;
        approvalReason = 'First time executing this action this session';
      }
    }

    // Check permission store - DO NOT override 'always'
    if (
      needsApproval &&
      action.requiresApproval !== 'always' &&
      this.permissionStore
    ) {
      const permKey = `CAPABILITY:${name}`;
      if (this.permissionStore.isGranted(permKey)) {
        needsApproval = false;
      }
    }

    // If approval needed, issue a ticket and WAIT for user response
    if (needsApproval) {
      const ticket = this.ticketManager.issueTicket(name, params, {
        riskLevel: action.riskLevel,
        description: action.description,
        approvalReason,
        capabilityVersion: action.capabilityVersion,
      });

      // Notify renderer about pending approval
      if (this.onApprovalRequired) {
        this.onApprovalRequired(ticket);
      }

      // Wait for the user to approve/deny via the renderer UI
      const approvalResult = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this._pendingApprovalCallbacks.delete(ticket.ticketId);
          resolve({
            approved: false,
            needsApproval: true,
            ticketId: ticket.ticketId,
            action: name,
            params: ticket.params,
            paramsHash: ticket.paramsHash,
            metadata: ticket.metadata,
            expiresAt: ticket.expiresAt,
            reason: `${approvalReason} (timed out)`,
          });
        }, this.ticketManager.ticketTTL);

        this._pendingApprovalCallbacks.set(ticket.ticketId, {
          resolve: (result) => {
            clearTimeout(timeout);
            this._pendingApprovalCallbacks.delete(ticket.ticketId);
            resolve(result);
          },
        });
      });

      return approvalResult;
    }

    // No approval needed, execute directly
    if (action.requiresApproval === 'first-time-per-session') {
      this.firstTimeApprovals.add(name);
    }

    try {
      const result = await action.handler(params);
      return { approved: true, result };
    } catch (e) {
      return { approved: false, reason: `Action "${name}" failed: ${e.message}` };
    }
  }

  /**
   * Approve a ticket and execute the action
   * 
   * This is called by the renderer after user approves.
   * It validates the ticket, verifies params hash, and executes.
   */
  async approveAndExecute(ticketId, approvedBy = 'user') {
    // Step 1: Approve the ticket (pending → approved)
    const approval = this.ticketManager.approveTicket(ticketId, approvedBy);
    if (!approval.success) {
      // Resolve any pending callback with failure
      this._resolvePendingApproval(ticketId, {
        approved: false,
        reason: approval.reason,
        ticketId,
      });
      return {
        approved: false,
        reason: approval.reason,
        ticketId,
      };
    }

    // Step 2: Redeem the ticket (approved → redeemed, uses stored immutable params)
    const redemption = this.ticketManager.redeemTicket(ticketId);
    
    if (!redemption.success) {
      this._resolvePendingApproval(ticketId, {
        approved: false, 
        reason: redemption.reason,
        ticketId,
      });
      return { 
        approved: false, 
        reason: redemption.reason,
        ticketId,
      };
    }

    const action = this.actions.get(redemption.action);
    if (!action) {
      this._resolvePendingApproval(ticketId, {
        approved: false, 
        reason: `Action "${redemption.action}" no longer registered`,
        ticketId,
      });
      return { 
        approved: false, 
        reason: `Action "${redemption.action}" no longer registered`,
        ticketId,
      };
    }

    // Yellow 11: the action definition may have changed since the ticket was
    // issued. If the capability version differs, refuse to redeem — the ticket
    // was bound to a specific (action, version) and is no longer valid.
    if (
      redemption.capabilityVersion !== undefined &&
      action.capabilityVersion !== undefined &&
      redemption.capabilityVersion !== action.capabilityVersion
    ) {
      this._resolvePendingApproval(ticketId, {
        approved: false,
        reason: `Action "${redemption.action}" definition changed since ticket issued`,
        ticketId,
      });
      return {
        approved: false,
        reason: `Action "${redemption.action}" definition changed since ticket issued`,
        ticketId,
      };
    }

    // Mark as first-time-approved if applicable
    if (action.requiresApproval === 'first-time-per-session') {
      this.firstTimeApprovals.add(redemption.action);
    }

    // Store in permission store ONLY for explicitly persistent capabilities.
    // 'always' and 'first-time-per-session' must NOT become persistent grants
    // (they would silently bypass their own approval policy).
    if (
      this.permissionStore &&
      action.requiresApproval === 'explicit-persistent'
    ) {
      const permKey = `CAPABILITY:${redemption.action}`;
      this.permissionStore.grant(permKey, {
        approvedBy,
        approvedAt: Date.now(),
        riskLevel: redemption.metadata?.riskLevel,
      });
    }

    // Execute the action with the EXACT params that were approved
    try {
      const result = await action.handler(redemption.params);
      const execResult = { 
        approved: true, 
        result,
        ticketId,
        action: redemption.action,
      };
      // Resolve any pending callback (from executeAction waiting for approval)
      this._resolvePendingApproval(ticketId, execResult);
      return execResult;
    } catch (e) {
      const failResult = { 
        approved: false, 
        reason: `Action "${redemption.action}" failed: ${e.message}`,
        ticketId,
      };
      this._resolvePendingApproval(ticketId, failResult);
      return failResult;
    }
  }

  /**
   * Deny a ticket
   */
  denyTicket(ticketId, deniedBy = 'user', reason = 'User denied') {
    const result = this.ticketManager.denyTicket(ticketId, deniedBy, reason);
    // Resolve any pending callback with denial
    if (result.success) {
      this._resolvePendingApproval(ticketId, {
        approved: false,
        reason,
        ticketId,
      });
    }
    return result;
  }

  /**
   * Resolve a pending approval callback if one exists
   */
  _resolvePendingApproval(ticketId, result) {
    const pending = this._pendingApprovalCallbacks.get(ticketId);
    if (pending) {
      this._pendingApprovalCallbacks.delete(ticketId);
      pending.resolve(result);
    }
  }

  /**
   * Get ticket status (for renderer polling)
   */
  getTicketStatus(ticketId) {
    return this.ticketManager.getTicketStatus(ticketId);
  }

  // =========================================================================
  // UNATTENDED EXECUTION (for scheduled tasks)
  // =========================================================================

  /**
   * Register a call shape for unattended execution
   * 
   * Call this after a human approves an action during an interactive session.
   * The registered shape can then be used for scheduled/unattended execution.
   * 
   * @param {string} actionName - The action name
   * @param {object} params - The exact params that were approved
   * @param {object} metadata - Who approved, risk level, etc.
   * @returns {{ registered, shapeId, paramsHash }}
   */
  registerCallShape(actionName, params, metadata = {}, requireTicket = false) {
    if (requireTicket && !metadata.ticketId) {
      throw new Error('Call shape registration requires a validated approval ticket');
    }
    return this.ticketManager.registerCallShape(actionName, params, {
      approvedBy: metadata.approvedBy || 'interactive-session',
      riskLevel: metadata.riskLevel || 'low',
      description: metadata.description || '',
    });
  }

  /**
   * Register a call shape PATTERN for flexible unattended execution
   * 
   * Use this when scheduled tasks need variable args (e.g., dated filenames).
   * The pattern defines what's allowed, not the exact value.
   * 
   * @param {string} actionName - The action name
   * @param {object} paramPatterns - Patterns for each param (regex, glob, or exact)
   * @param {object} metadata - Who approved, risk level, etc.
   * @returns {{ registered, patternId }}
   */
  registerCallShapePattern(actionName, paramPatterns, metadata = {}, requireTicket = false) {
    if (requireTicket && !metadata.ticketId) {
      throw new Error('Call shape pattern registration requires a validated approval ticket');
    }
    if (!this.actions.has(actionName)) {
      throw new Error(`Cannot register call shape pattern for unregistered action "${actionName}"`);
    }
    return this.ticketManager.registerCallShapePattern(actionName, paramPatterns, {
      approvedBy: metadata.approvedBy || 'interactive-session',
      riskLevel: metadata.riskLevel || 'low',
      description: metadata.description || '',
    });
  }

  /**
   * Execute an action for unattended/scheduled execution
   * 
   * This verifies the call matches an approved call shape before executing.
   * No interactive approval prompt - must have pre-registered shape.
   * 
   * @param {string} actionName - The action name
   * @param {object} params - The params to execute with
   * @returns {{ approved, result, reason }}
   */
  async executeUnattended(actionName, params = {}) {
    const action = this.actions.get(actionName);
    if (!action) {
      return { approved: false, reason: `Action "${actionName}" is not registered.` };
    }

    // Verify call shape is approved
    const shapeCheck = this.ticketManager.verifyCallShape(actionName, params, {});
    
    if (!shapeCheck.approved) {
      console.warn(`[CapabilityController] Unattended execution denied: ${shapeCheck.reason}`);
      return { 
        approved: false, 
        reason: shapeCheck.reason,
        action: actionName,
      };
    }

    console.log(`[CapabilityController] Unattended execution approved via ${shapeCheck.matchType} match`);

    // Execute the action
    try {
      const result = await action.handler(params);
      return { 
        approved: true, 
        result,
        action: actionName,
        matchType: shapeCheck.matchType,
        shapeId: shapeCheck.shapeId,
      };
    } catch (e) {
      return { 
        approved: false, 
        reason: `Action "${actionName}" failed: ${e.message}`,
        action: actionName,
      };
    }
  }

  /**
   * Get all registered call shapes
   */
  getCallShapes(actionName) {
    return this.ticketManager.getCallShapes(actionName);
  }

  /**
   * Revoke a call shape
   */
  revokeCallShape(shapeId) {
    return this.ticketManager.revokeCallShape(shapeId);
  }

  /**
   * Get all registered actions
   */
  getRegisteredActions() {
    return Array.from(this.actions.values()).map(a => ({
      name: a.name,
      riskLevel: a.riskLevel,
      requiresApproval: a.requiresApproval,
      description: a.description,
    }));
  }

  /**
   * Get pending approval tickets
   */
  getPendingApprovals() {
    return this.ticketManager.getPendingTickets();
  }

  /**
   * Get approval statistics
   */
  getStats() {
    return this.ticketManager.getStats();
  }

  /**
   * Destroy the controller
   */
  destroy() {
    this.ticketManager.destroy();
  }
}

module.exports = { CapabilityController };
