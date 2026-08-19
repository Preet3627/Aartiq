import { OriginGuard, originOf } from '../lib/guardrails/origin-guard';

describe('OriginGuard — fail-closed execution policy', () => {
  it('parses origins', () => {
    expect(originOf('https://a.com/path')).toBe('https://a.com');
    expect(originOf('http://b.com:8080/x')).toBe('http://b.com:8080');
  });

  it('blocks when allowlist enforced and origin missing', () => {
    const g = new OriginGuard({ enforceAllowlist: true, allowlist: ['https://a.com'] });
    const d = g.evaluate({ verb: 'navigate', target: 'https://b.com' });
    expect(d.allowed).toBe(false);
    expect(d.policy).toBe('allowlist');
  });

  it('allows allowlisted origin read-only', () => {
    const g = new OriginGuard({ enforceAllowlist: true, allowlist: ['https://a.com'] });
    const d = g.evaluate({ verb: 'readOnly', target: 'https://a.com/page' });
    expect(d.allowed).toBe(true);
  });

  it('requires approval for side-effecting verbs but does not auto-deny', () => {
    const g = new OriginGuard();
    const d = g.evaluate({ verb: 'sideEffecting', target: 'https://a.com' });
    expect(d.allowed).toBe(true);
    expect(d.requiresApproval).toBe(true);
  });

  it('categorically denies destructive by default', () => {
    const g = new OriginGuard();
    expect(g.evaluate({ verb: 'destructive', target: 'https://a.com' }).allowed).toBe(false);
  });

  it('kill switch blocks everything', () => {
    const g = new OriginGuard();
    g.setKillSwitch(true);
    expect(g.evaluate({ verb: 'readOnly', target: 'https://a.com' }).allowed).toBe(false);
    expect(g.isKillSwitchOn()).toBe(true);
  });
});
