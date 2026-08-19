import { AgentTrustRegistry } from '../lib/guardrails/agent-trust';

describe('AgentTrustRegistry — trust and behavioral scoring', () => {
  it('defaults to limited and denies privileged verbs', () => {
    const r = new AgentTrustRegistry();
    r.register({ id: 'a1', name: 'Test' });
    expect(r.can('a1', 'destructive')).toBe(false);
    expect(r.can('a1', 'navigate')).toBe(true);
  });

  it('unknown agent cannot act', () => {
    const r = new AgentTrustRegistry();
    expect(r.can('ghost', 'readOnly')).toBe(false);
  });

  it('downgrades and revokes after repeated injection attempts', () => {
    const r = new AgentTrustRegistry();
    r.register({ id: 'a2', name: 'Bad', trust: 'privileged' });
    expect(r.can('a2', 'destructive')).toBe(true);
    r.recordInjectionAttempt('a2');
    r.recordInjectionAttempt('a2');
    r.recordInjectionAttempt('a2');
    expect(r.get('a2')!.revoked).toBe(true);
    expect(r.can('a2', 'readOnly')).toBe(false);
  });

  it('raises trust on consistent success', () => {
    const r = new AgentTrustRegistry();
    r.register({ id: 'a3', name: 'Ok', trust: 'standard' });
    for (let i = 0; i < 20; i++) r.recordAction('a3', true, 'navigate');
    expect(r.get('a3')!.trustScore).toBeGreaterThan(60);
  });
});
