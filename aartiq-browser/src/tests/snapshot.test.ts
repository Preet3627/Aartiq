import { SnapshotManager } from '../lib/snapshot/manager';
import type { RawAxNode } from '../lib/snapshot/types';

function sampleTree(): RawAxNode[] {
  return [
    {
      role: 'document', name: 'Page',
      children: [
        { role: 'heading', name: 'Title', backendNodeId: 1 },
        { role: 'button', name: 'Submit', backendNodeId: 2 },
        { role: 'textbox', name: 'Email', backendNodeId: 3 },
        { role: 'generic', name: '', children: [{ role: 'link', name: 'Home', href: 'https://x.com', backendNodeId: 4 }] },
      ],
    },
  ];
}

describe('SnapshotManager — accessibility tree + stable refs', () => {
  it('assigns stable refs and renders', () => {
    const m = new SnapshotManager();
    const r = m.build(sampleTree());
    expect(r.refs['e1']).toBeDefined();
    expect(r.text).toContain('[ref=');
    expect(r.text).toContain('Submit');
  });

  it('keeps refs stable across snapshots for surviving nodes', () => {
    const m = new SnapshotManager();
    const first = m.build(sampleTree());
    const submitRef = m.findByText(first, 'Submit')[0].ref;
    const second = m.build(sampleTree());
    expect(second.refs[submitRef].name).toBe('Submit');
  });

  it('filters to interactive-only (removes non-interactive leaves, keeps ancestors)', () => {
    const m = new SnapshotManager();
    const r = m.build(sampleTree(), { interactiveOnly: true });
    const roles = Object.values(r.refs).map((n) => n.role);
    expect(roles).not.toContain('heading'); // non-interactive leaf removed
    expect(roles).toContain('button');
    expect(roles).toContain('link');
  });

  it('compacts empty structural nodes', () => {
    const m = new SnapshotManager();
    const r = m.build(sampleTree(), { compact: true });
    expect(r.refs['e1'].role).toBe('document'); // document has content
  });

  it('finds by text', () => {
    const m = new SnapshotManager();
    const r = m.build(sampleTree());
    const found = m.findByText(r, 'submit');
    expect(found.length).toBe(1);
    expect(found[0].role).toBe('button');
  });

  it('resets refs on navigation', () => {
    const m = new SnapshotManager();
    m.build(sampleTree());
    m.reset();
    const r = m.build(sampleTree());
    expect(Object.keys(r.refs).length).toBeGreaterThan(0);
  });
});
