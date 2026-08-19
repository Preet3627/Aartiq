import { TabLockManager } from '../lib/agent/tab-lock';

describe('TabLockManager — multi-agent coordination', () => {
  it('grants lock to one agent and blocks another', () => {
    const m = new TabLockManager();
    expect(m.acquire({ tabId: 't1', agentId: 'a1' }).ok).toBe(true);
    const second = m.acquire({ tabId: 't1', agentId: 'a2' });
    expect(second.ok).toBe(false);
    expect(second.heldBy).toBe('a1');
  });

  it('allows renewal and explicit release', () => {
    const m = new TabLockManager();
    m.acquire({ tabId: 't1', agentId: 'a1' });
    expect(m.renew('t1', 'a1')).toBe(true);
    expect(m.release('t1', 'a1')).toBe(true);
    expect(m.acquire({ tabId: 't1', agentId: 'a2' }).ok).toBe(true);
  });

  it('supports explicit handoff between owners', () => {
    const m = new TabLockManager();
    m.acquire({ tabId: 't1', agentId: 'a1' });
    const h = m.handoff('t1', 'a1', 'a2');
    expect(h.ok).toBe(true);
    expect(m.ownerOf('t1')).toBe('a2');
  });

  it('releases all locks for a disconnected agent', () => {
    const m = new TabLockManager();
    m.acquire({ tabId: 't1', agentId: 'a1' });
    m.acquire({ tabId: 't2', agentId: 'a1' });
    expect(m.releaseAllForAgent('a1')).toBe(2);
    expect(m.ownerOf('t1')).toBeNull();
  });

  it('sweeps expired leases', () => {
    const m = new TabLockManager();
    m.acquire({ tabId: 't1', agentId: 'a1', ttlMs: -1 });
    expect(m.sweep()).toBe(1);
  });
});
