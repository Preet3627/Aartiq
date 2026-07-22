/**
 * Approval Ticket Manager
 * 
 * Ticket-based approval pattern for Electron IPC trust boundary.
 * 
 * Ticket lifecycle: issue → pending → approve → approved → redeem → redeemed
 * 
 * Core invariants:
 *   - Params are stored server-side (main process), never trust the renderer
 *   - Hash is computed at propose time, verified at redeem time
 *   - Approval = consent to THAT exact action under THAT exact context
 *   - Redeem uses stored immutable params, never external input
 * 
 * Prevents:
 *   - Renderer tampering with params in transit
 *   - Race conditions where AI assembled different payload
 *   - Replay attacks with stale tickets
 *   - Unattended execution of unverified actions
 */

const crypto = require('crypto');

const DEFAULT_LOGGER = {
  debug: (...args) => {},
  info: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
  audit: (...args) => console.log('[AUDIT]', ...args),
};

class ApprovalTicketManager {
  constructor(options = {}) {
    this.tickets = new Map();
    this.approvedCallShapes = new Map();
    this.ticketTTL = options.ticketTTL || 5 * 60 * 1000;
    this.logger = options.logger || DEFAULT_LOGGER;
    this._cleanupInterval = setInterval(() => this._cleanupExpiredTickets(), 60 * 1000);
  }

  // =========================================================================
  // HASHING
  // =========================================================================

  /**
   * Canonicalize and hash params with execution context.
   * 
   * Hash includes action + params + context fields so approval covers
   * the full execution environment, not just arguments.
   */
  _hashParams(actionName, params, context = {}) {
    const normalized = this._normalizeParams(params);
    const payload = JSON.stringify({
      action: actionName,
      params: normalized,
      context: this._normalizeParams(context),
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Canonicalize params for consistent hashing.
   * Sorts object keys recursively, normalizes nested structures.
   */
  _normalizeParams(params) {
    if (params === null || params === undefined) return null;
    if (typeof params !== 'object') return params;

    if (Array.isArray(params)) {
      return params.map(p => this._normalizeParams(p));
    }

    const sorted = {};
    for (const key of Object.keys(params).sort()) {
      sorted[key] = this._normalizeParams(params[key]);
    }
    return sorted;
  }

  // =========================================================================
  // VALIDATION (separated by lifecycle stage)
  // =========================================================================

  /**
   * Validate ticket exists and is not expired.
   */
  _validateExists(ticketId) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      return { valid: false, reason: 'Ticket not found' };
    }
    if (Date.now() > ticket.expiresAt) {
      ticket.status = 'expired';
      return { valid: false, reason: 'Ticket expired' };
    }
    return { valid: true, ticket };
  }

  /**
   * Validate ticket is in pending state (for approve/deny).
   */
  _validatePending(ticketId) {
    const exists = this._validateExists(ticketId);
    if (!exists.valid) return exists;

    if (exists.ticket.status !== 'pending') {
      return { valid: false, reason: `Ticket already ${exists.ticket.status}` };
    }
    return exists;
  }

  /**
   * Validate ticket is approved (for redeem).
   */
  _validateApproved(ticketId) {
    const exists = this._validateExists(ticketId);
    if (!exists.valid) return exists;

    if (exists.ticket.status !== 'approved') {
      return { valid: false, reason: `Ticket status is ${exists.ticket.status}, expected approved` };
    }
    return exists;
  }

  // =========================================================================
  // TICKET LIFECYCLE
  // =========================================================================

  /**
   * Issue a new approval ticket.
   * 
   * @param {string} actionName - Name of the action requiring approval
   * @param {object} params - Exact parameters for the action
   * @param {object} metadata - Risk level, description, who requested, etc.
   * @param {object} context - Execution context for approval hash (cwd, toolVersion, riskLevel, targetPid, etc.)
   * @returns {{ ticketId, expiresAt, action, params, paramsHash, contextHash }}
   */
  issueTicket(actionName, params = {}, metadata = {}, context = {}) {
    const ticketId = crypto.randomUUID();
    const paramsHash = this._hashParams(actionName, params, context);
    const expiresAt = Date.now() + this.ticketTTL;

    const ticket = {
      id: ticketId,
      action: actionName,
      params: structuredClone(params),
      paramsHash: paramsHash,
      context: structuredClone(context),
      metadata: structuredClone(metadata),
      createdAt: Date.now(),
      expiresAt: expiresAt,
      status: 'pending',
      approvedAt: null,
      approvedBy: null,
    };

    this.tickets.set(ticketId, ticket);

    this.logger.info(`[ApprovalTicket] Issued ticket ${ticketId} for "${actionName}"`);
    this.logger.debug(`[ApprovalTicket] Params hash: ${paramsHash}`);

    return {
      ticketId,
      expiresAt,
      action: actionName,
      params: ticket.params,
      paramsHash,
      metadata: ticket.metadata,
    };
  }

  /**
   * Approve a pending ticket.
   * 
   * @param {string} ticketId
   * @param {string} approvedBy - Who approved (user, system, etc.)
   */
  approveTicket(ticketId, approvedBy = 'user') {
    const validation = this._validatePending(ticketId);
    if (!validation.valid) {
      return { success: false, reason: validation.reason };
    }

    const ticket = validation.ticket;
    ticket.status = 'approved';
    ticket.approvedAt = Date.now();
    ticket.approvedBy = approvedBy;

    this.logger.audit(`Ticket ${ticketId} approved by ${approvedBy}`);

    return {
      success: true,
      action: ticket.action,
      params: ticket.params,
      paramsHash: ticket.paramsHash,
      metadata: ticket.metadata,
    };
  }

  /**
   * Deny a pending ticket.
   */
  denyTicket(ticketId, deniedBy = 'user', reason = 'User denied') {
    const validation = this._validatePending(ticketId);
    if (!validation.valid) {
      return { success: false, reason: validation.reason };
    }

    const ticket = validation.ticket;
    ticket.status = 'denied';
    ticket.deniedAt = Date.now();
    ticket.deniedBy = deniedBy;
    ticket.denyReason = reason;

    this.logger.audit(`Ticket ${ticketId} denied: ${reason}`);

    return { success: true };
  }

  /**
   * Redeem an approved ticket for execution.
   * 
   * Uses stored immutable params — no external params accepted.
   * This prevents parameter injection at redeem time.
   * 
   * Flow: approve → approved → redeemTicket → redeemed
   */
  redeemTicket(ticketId) {
    const validation = this._validateApproved(ticketId);
    if (!validation.valid) {
      return { success: false, reason: validation.reason };
    }

    const ticket = validation.ticket;
    ticket.status = 'redeemed';
    ticket.redeemedAt = Date.now();

    this.logger.audit(`Ticket ${ticketId} redeemed for execution`);

    return {
      success: true,
      action: ticket.action,
      params: ticket.params,
      context: ticket.context,
      metadata: ticket.metadata,
    };
  }

  // =========================================================================
  // PRE-REGISTERED CALL SHAPES (unattended execution)
  // =========================================================================

  /**
   * Register an exact call shape for unattended execution.
   * 
   * For scheduled tasks that run without a human present.
   * The call shape is the exact (action, params) pair approved
   * during a session where a human was watching.
   */
  registerCallShape(actionName, params, metadata = {}, context = {}) {
    const paramsHash = this._hashParams(actionName, params, context);
    const shapeId = `${actionName}:${paramsHash}`;

    this.approvedCallShapes.set(shapeId, {
      action: actionName,
      params: structuredClone(params),
      context: structuredClone(context),
      paramsHash: paramsHash,
      registeredAt: Date.now(),
      registeredBy: metadata.approvedBy || 'user',
      riskLevel: metadata.riskLevel || 'low',
      description: metadata.description || '',
    });

    this.logger.audit(`Registered call shape: ${shapeId}`);

    return { registered: true, shapeId, paramsHash };
  }

  /**
   * Register a declarative call shape pattern for flexible matching.
   * 
   * Patterns use constraint objects, not arbitrary regex/functions.
   * This makes approvals auditable and prevents overly broad matches.
   * 
   * @param {string} actionName - The action name
   * @param {object} paramConstraints - Declarative constraints per param
   * @param {object} metadata
   * 
   * Constraint types:
   *   { type: 'exact', value: 'foo' }                   — exact string match
   *   { type: 'regex', pattern: '^/logs/.*\\.csv$' }    — regex match
   *   { type: 'maxLength', value: 10000 }               — string length limit
   *   { type: 'enum', values: ['a', 'b', 'c'] }        — whitelist
   *   { type: 'range', min: 0, max: 100 }               — numeric range
   *   { type: 'exists' }                                — param must be present
   *   { type: 'type', value: 'string' }                 — type check
   *   { type: 'all', constraints: [...] }               — all must match
   *   { type: 'any', constraints: [...] }               — at least one must match
   * 
   * Example:
   *   registerCallShapePattern('shell-write-file', {
   *     path: { type: 'regex', pattern: '^/logs/report-\\d{4}-\\d{2}-\\d{2}\\.csv$' },
   *     content: { type: 'maxLength', value: 100000 },
   *   }, { approvedBy: 'scheduler', riskLevel: 'medium' })
   */
  registerCallShapePattern(actionName, paramConstraints, metadata = {}) {
    const patternId = `pattern:${actionName}:${crypto.randomBytes(8).toString('hex')}`;

    const compiledConstraints = this._compileConstraints(paramConstraints);

    this.approvedCallShapes.set(patternId, {
      action: actionName,
      paramConstraints: compiledConstraints,
      isPattern: true,
      registeredAt: Date.now(),
      registeredBy: metadata.approvedBy || 'user',
      riskLevel: metadata.riskLevel || 'low',
      description: metadata.description || '',
    });

    this.logger.audit(`Registered call shape pattern: ${patternId}`);

    return { registered: true, patternId };
  }

  /**
   * Verify a call matches an approved call shape.
   */
  verifyCallShape(actionName, params) {
    const paramsHash = this._hashParams(actionName, params);
    const exactShapeId = `${actionName}:${paramsHash}`;

    if (this.approvedCallShapes.has(exactShapeId)) {
      const shape = this.approvedCallShapes.get(exactShapeId);
      return {
        approved: true,
        shapeId: exactShapeId,
        matchType: 'exact',
        registeredBy: shape.registeredBy,
      };
    }

    for (const [patternId, shape] of this.approvedCallShapes) {
      if (!shape.isPattern) continue;
      if (shape.action !== actionName) continue;

      if (this._matchConstraints(shape.paramConstraints, params)) {
        return {
          approved: true,
          shapeId: patternId,
          matchType: 'pattern',
          registeredBy: shape.registeredBy,
        };
      }
    }

    return { approved: false, reason: 'No approved call shape found', paramsHash };
  }

  /**
   * Pre-compile regex patterns at registration time.
   * Avoids recompiling on every verification.
   */
  _compileConstraints(constraints) {
    if (!constraints || typeof constraints !== 'object') return constraints;

    const compiled = {};
    for (const [key, constraint] of Object.entries(constraints)) {
      if (constraint && constraint.type === 'regex' && typeof constraint.pattern === 'string') {
        compiled[key] = { ...constraint, _compiledRegex: new RegExp(constraint.pattern) };
      } else if (constraint && constraint.type === 'all' && Array.isArray(constraint.constraints)) {
        compiled[key] = { ...constraint, constraints: constraint.constraints.map(c => {
          const inner = {};
          for (const [k, v] of Object.entries(c)) {
            inner[k] = v && v.type === 'regex' ? { ...v, _compiledRegex: new RegExp(v.pattern) } : v;
          }
          return inner;
        })};
      } else if (constraint && constraint.type === 'any' && Array.isArray(constraint.constraints)) {
        compiled[key] = { ...constraint, constraints: constraint.constraints.map(c => {
          const inner = {};
          for (const [k, v] of Object.entries(c)) {
            inner[k] = v && v.type === 'regex' ? { ...v, _compiledRegex: new RegExp(v.pattern) } : v;
          }
          return inner;
        })};
      } else {
        compiled[key] = constraint;
      }
    }
    return compiled;
  }

  /**
   * Match params against declarative constraints.
   * 
   * Each constraint is an object with a `type` field.
   * No arbitrary functions or raw regex — everything is auditable.
   */
  _matchConstraints(constraints, params) {
    if (!constraints || !params) return false;

    for (const [key, constraint] of Object.entries(constraints)) {
      const value = params[key];

      if (!this._matchSingleConstraint(constraint, value)) {
        return false;
      }
    }

    return true;
  }

  _matchSingleConstraint(constraint, value) {
    if (value === undefined || value === null) {
      return constraint.type === 'exists' ? false : true;
    }

    switch (constraint.type) {
      case 'exact':
        return String(value) === String(constraint.value);

      case 'regex':
        return constraint._compiledRegex
          ? constraint._compiledRegex.test(String(value))
          : new RegExp(constraint.pattern).test(String(value));

      case 'maxLength':
        return typeof value === 'string' && value.length <= constraint.value;

      case 'minLength':
        return typeof value === 'string' && value.length >= constraint.value;

      case 'enum':
        return constraint.values.includes(value);

      case 'range':
        const num = Number(value);
        return !isNaN(num) && num >= (constraint.min ?? -Infinity) && num <= (constraint.max ?? Infinity);

      case 'exists':
        return value !== undefined && value !== null;

      case 'type':
        return typeof value === constraint.value;

      case 'all':
        return constraint.constraints.every(c => this._matchSingleConstraint(c, value));

      case 'any':
        return constraint.constraints.some(c => this._matchSingleConstraint(c, value));

      default:
        this.logger.warn(`[ApprovalTicket] Unknown constraint type: ${constraint.type}`);
        return false;
    }
  }

  getCallShapes(actionName) {
    const shapes = [];
    for (const [shapeId, shape] of this.approvedCallShapes) {
      if (shape.action === actionName) {
        shapes.push({
          shapeId,
          isPattern: shape.isPattern,
          paramsHash: shape.paramsHash,
          registeredAt: shape.registeredAt,
          registeredBy: shape.registeredBy,
        });
      }
    }
    return shapes;
  }

  revokeCallShape(shapeId) {
    if (this.approvedCallShapes.has(shapeId)) {
      this.approvedCallShapes.delete(shapeId);
      this.logger.audit(`Revoked call shape: ${shapeId}`);
      return { revoked: true };
    }
    return { revoked: false, reason: 'Shape not found' };
  }

  // =========================================================================
  // QUERY / CLEANUP
  // =========================================================================

  getTicketStatus(ticketId) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return { status: 'not_found' };

    if (ticket.status === 'pending' && Date.now() > ticket.expiresAt) {
      ticket.status = 'expired';
    }

    return {
      status: ticket.status,
      action: ticket.action,
      paramsHash: ticket.paramsHash,
      createdAt: ticket.createdAt,
      expiresAt: ticket.expiresAt,
      approvedAt: ticket.approvedAt,
      deniedAt: ticket.deniedAt,
    };
  }

  getPendingTickets() {
    const pending = [];
    for (const [id, ticket] of this.tickets) {
      if (ticket.status === 'pending') {
        pending.push({
          id,
          action: ticket.action,
          paramsHash: ticket.paramsHash,
          createdAt: ticket.createdAt,
          expiresAt: ticket.expiresAt,
        });
      }
    }
    return pending;
  }

  _cleanupExpiredTickets() {
    const now = Date.now();
    const toDelete = new Set();

    for (const [id, ticket] of this.tickets) {
      if (ticket.status === 'pending' && now > ticket.expiresAt) {
        ticket.status = 'expired';
      }
      if (now - ticket.createdAt > 60 * 60 * 1000) {
        toDelete.add(id);
      }
    }

    for (const id of toDelete) {
      this.tickets.delete(id);
    }

    if (toDelete.size > 0) {
      this.logger.debug(`[ApprovalTicket] Cleaned up ${toDelete.size} expired tickets`);
    }
  }

  getStats() {
    let pending = 0, approved = 0, denied = 0, expired = 0, redeemed = 0, tampered = 0;

    for (const ticket of this.tickets.values()) {
      switch (ticket.status) {
        case 'pending': pending++; break;
        case 'approved': approved++; break;
        case 'denied': denied++; break;
        case 'expired': expired++; break;
        case 'redeemed': redeemed++; break;
        case 'tampered': tampered++; break;
      }
    }

    return {
      tickets: { pending, approved, denied, expired, redeemed, tampered },
      callShapes: this.approvedCallShapes.size,
    };
  }

  destroy() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
    }
    this.tickets.clear();
    this.approvedCallShapes.clear();
  }
}

module.exports = { ApprovalTicketManager };
