/**
 * approval-ticket-security.test.js
 *
 * Regression tests for the approval-ticket / capability-controller security
 * hardening described in the audit. Each describe block maps to a finding.
 */

const assert = require('assert');
const crypto = require('crypto');
const {
  ApprovalTicketManager,
} = require('../src/core/approval-ticket-manager');
const {
  CapabilityController,
} = require('../src/core/capability-controller');

// ---------------------------------------------------------------------------
// Mock persistent permission store (survives across approvals)
// ---------------------------------------------------------------------------
class MockPersistentPermissionStore {
  constructor() {
    this.grants = new Map();
  }
  grant(key) {
    this.grants.set(key, { key, grantedAt: Date.now() });
  }
  revoke(key) {
    this.grants.delete(key);
  }
  isGranted(key) {
    return this.grants.has(key);
  }
}

// ===========================================================================
// RED 1: execution-context hash must be verified at redeem time
// ===========================================================================
describe('Red 1: redeemTicket verifies the params hash (tamper detection)', () => {
  it('succeeds when stored params match the recomputed hash', () => {
    const mgr = new ApprovalTicketManager();
    const t = mgr.issueTicket('write', { path: '/a' }, { riskLevel: 'low' }, { cwd: '/w' });
    mgr.approveTicket(t.ticketId);
    const r = mgr.redeemTicket(t.ticketId);
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.action, 'write');
  });

  it('marks the ticket tampered when params are mutated in place', () => {
    const mgr = new ApprovalTicketManager();
    const t = mgr.issueTicket('write', { path: '/a' }, {}, { cwd: '/w' });
    // The manager returns a clone in issueTicket; mutate the internal store to
    // simulate a memory-corruption / renderer-side tamper of the Map.
    const ticket = mgr.tickets.get(t.ticketId);
    ticket.params.path = '/evil';
    mgr.approveTicket(t.ticketId);
    const r = mgr.redeemTicket(t.ticketId);
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.reason, 'Ticket integrity verification failed');
    assert.strictEqual(mgr.tickets.get(t.ticketId).status, 'tampered');
  });

  it('rejects redeem when ticket not approved', () => {
    const mgr = new ApprovalTicketManager();
    const t = mgr.issueTicket('write', { path: '/a' });
    const r = mgr.redeemTicket(t.ticketId);
    assert.strictEqual(r.success, false);
  });
});

// ===========================================================================
// RED 2: permissionStore must NOT override an 'always' approval policy
// ===========================================================================
describe("Red 2: 'always' approval is never bypassed by a persistent grant", () => {
  it('requires approval every time even after a prior approval grant', async () => {
    const store = new MockPersistentPermissionStore();
    const cc = new CapabilityController({ permissionStore: store });

    let approveCalls = 0;
    cc.onApprovalRequired = (ticket) => {
      approveCalls++;
      setImmediate(() => cc.approveAndExecute(ticket.ticketId, 'user'));
    };

    cc.registerAction({
      name: 'danger',
      handler: async () => 'ok',
      requiresApproval: 'always',
      riskLevel: 'high',
    });

    const r1 = await cc.executeAction('danger', {});
    assert.strictEqual(r1.approved, true);
    assert.strictEqual(approveCalls, 1);

    // The persistent grant must NOT have been created for an 'always' action.
    assert.strictEqual(store.isGranted('CAPABILITY:danger'), false);

    // Second call must still ask for approval.
    const r2 = await cc.executeAction('danger', {});
    assert.strictEqual(r2.approved, true);
    assert.strictEqual(approveCalls, 2);
  });
});

// ===========================================================================
// RED 3: first-time-per-session must NOT become a persistent grant
// ===========================================================================
describe('Red 3: first-time-per-session does not persist across sessions', () => {
  it('does not create a persistent grant after first approval', async () => {
    const store = new MockPersistentPermissionStore();
    const cc = new CapabilityController({ permissionStore: store });

    let approveCalls = 0;
    cc.onApprovalRequired = (ticket) => {
      approveCalls++;
      setImmediate(() => cc.approveAndExecute(ticket.ticketId, 'user'));
    };

    cc.registerAction({
      name: 'partial',
      handler: async () => 'ok',
      requiresApproval: 'first-time-per-session',
      riskLevel: 'medium',
    });

    await cc.executeAction('partial', {});
    assert.strictEqual(store.isGranted('CAPABILITY:partial'), false);

    // Simulate a new session: clear the in-memory first-time set.
    cc.firstTimeApprovals.clear();
    const before = approveCalls;
    await cc.executeAction('partial', {});
    assert.strictEqual(approveCalls, before + 1, 'should require approval again in new session');
  });
});

// ===========================================================================
// RED 4: call-shape registration / verification agree on context
// ===========================================================================
describe('Red 4: exact call-shape match respects execution context', () => {
  it('does not match when context differs between register and verify', () => {
    const mgr = new ApprovalTicketManager();
    mgr.registerCallShape('backup', { path: '/data' }, {}, { cwd: '/workspace' });
    const mismatch = mgr.verifyCallShape('backup', { path: '/data' }, {});
    assert.strictEqual(mismatch.approved, false);

    const match = mgr.verifyCallShape('backup', { path: '/data' }, { cwd: '/workspace' });
    assert.strictEqual(match.approved, true);
    assert.strictEqual(match.matchType, 'exact');
  });
});

// ===========================================================================
// RED 5 + ORANGE 6: missing parameters fail constraints (exists simplified)
// ===========================================================================
describe('Red 5 / Orange 6: constraints reject missing parameters', () => {
  it('fails a regex constraint when the param is absent', () => {
    const mgr = new ApprovalTicketManager();
    mgr.registerCallShapePattern('write', {
      path: { type: 'regex', pattern: '^/safe/.*$' },
    }, {});
    const r = mgr.verifyCallShape('write', {});
    assert.strictEqual(r.approved, false);
  });

  it('exists constraint fails when value is missing', () => {
    const mgr = new ApprovalTicketManager();
    mgr.registerCallShapePattern('write', {
      path: { type: 'exists' },
    }, {});
    const r = mgr.verifyCallShape('write', {});
    assert.strictEqual(r.approved, false);
  });

  it('optional constraint allows a missing value but enforces the inner match', () => {
    const mgr = new ApprovalTicketManager();
    mgr.registerCallShapePattern('write', {
      path: { type: 'optional', constraint: { type: 'regex', pattern: '^/safe/.*$' } },
    }, {});
    assert.strictEqual(mgr.verifyCallShape('write', {}).approved, true);
    assert.strictEqual(mgr.verifyCallShape('write', { path: '/evil' }).approved, false);
    assert.strictEqual(mgr.verifyCallShape('write', { path: '/safe/x' }).approved, true);
  });
});

// ===========================================================================
// ORANGE 7 + 8: unattended registration requires a ticket; pattern checks action exists
// ===========================================================================
describe('Orange 7 / 8: call-shape registration is gated and validated', () => {
  it('rejects pattern registration for an unregistered action', () => {
    const cc = new CapabilityController({});
    assert.throws(() => {
      cc.registerCallShapePattern('does-not-exist', { x: { type: 'exists' } }, {});
    }, /unregistered action/);
  });

  it('requires a ticket when explicit gating is enabled', () => {
    const cc = new CapabilityController({});
    cc.registerAction({ name: 'ok', handler: async () => 'ok', requiresApproval: 'never' });
    assert.throws(() => {
      cc.registerCallShapePattern('ok', { x: { type: 'exists' } }, {}, true);
    }, /requires a validated approval ticket/);
  });
});

// ===========================================================================
// ORANGE 9: regex patterns are length-limited to prevent catastrophic backtracking
// ===========================================================================
describe('Orange 9: regex constraint length limit', () => {
  it('throws on oversized regex patterns at registration', () => {
    const mgr = new ApprovalTicketManager();
    const huge = 'a'.repeat(600) + '.*';
    assert.throws(() => {
      mgr.registerCallShapePattern('write', {
        path: { type: 'regex', pattern: huge },
      }, {});
    }, /maximum length/);
  });

  it('accepts a reasonable regex pattern', () => {
    const mgr = new ApprovalTicketManager();
    const r = mgr.registerCallShapePattern('write', {
      path: { type: 'regex', pattern: '^/safe/.*$' },
    }, {});
    assert.strictEqual(r.registered, true);
  });
});

// ===========================================================================
// ORANGE 10: unknown / invalid ticket IDs are not trusted
// ===========================================================================
describe('Orange 10: approveAndExecute rejects unknown tickets', () => {
  it('returns failure for a non-existent ticket id', async () => {
    const cc = new CapabilityController({});
    const r = await cc.approveAndExecute('not-a-real-ticket', 'user');
    assert.strictEqual(r.approved, false);
    assert.ok(r.reason);
  });
});

// ===========================================================================
// YELLOW 11: tickets become unredeemable when the action definition changes
// ===========================================================================
describe('Yellow 11: ticket bound to capability version', () => {
  it('refuses to redeem after the action definition is replaced', async () => {
    const cc = new CapabilityController({});
    let approveCalls = 0;
    cc.onApprovalRequired = (ticket) => {
      approveCalls++;
      setImmediate(() => cc.approveAndExecute(ticket.ticketId, 'user'));
    };

    cc.registerAction({
      name: 'mut', handler: async () => 'v1', requiresApproval: 'always', capabilityVersion: 1,
    });

    const pending = cc.executeAction('mut', {});
    // Replace the action (bumps capability version) before approval completes.
    cc.replaceAction({
      name: 'mut', handler: async () => 'v2', requiresApproval: 'always', capabilityVersion: 2,
    });

    const r = await pending;
    assert.strictEqual(r.approved, false);
    assert.ok(/definition changed/.test(r.reason));
  });
});

// ===========================================================================
// YELLOW 12: returned ticket params are clones, not internal references
// ===========================================================================
describe('Yellow 12: returned params are defensive copies', () => {
  it('issueTicket returns a clone that does not affect the stored ticket', () => {
    const mgr = new ApprovalTicketManager();
    const t = mgr.issueTicket('write', { path: '/a' });
    t.params.path = '/mutated';
    assert.strictEqual(mgr.tickets.get(t.ticketId).params.path, '/a');
  });

  it('redeemTicket returns a clone of the stored params', () => {
    const mgr = new ApprovalTicketManager();
    const t = mgr.issueTicket('write', { path: '/a' });
    mgr.approveTicket(t.ticketId);
    const r = mgr.redeemTicket(t.ticketId);
    r.params.path = '/mutated';
    assert.strictEqual(mgr.tickets.get(t.ticketId).params.path, '/a');
  });
});
