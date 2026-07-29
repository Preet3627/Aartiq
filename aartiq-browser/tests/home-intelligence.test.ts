import {
  buildContextSuggestions,
  findDuplicateTabs,
  groupTabsByTopic,
  parsePageContext,
} from '../src/lib/homeIntelligence';

describe('homeIntelligence', () => {
  it('parses active tab context', () => {
    const ctx = parsePageContext(
      [{ id: '1', url: 'https://github.com/org/repo', title: 'My Repo' }],
      '1',
    );
    expect(ctx?.isCode).toBe(true);
    expect(ctx?.domain).toBe('github.com');
  });

  it('builds dynamic suggestions from page type', () => {
    const ctx = parsePageContext(
      [{ id: '1', url: 'https://news.example.com/article', title: 'Long read' }],
      '1',
    );
    const suggestions = buildContextSuggestions(ctx, 1);
    const labels = suggestions.map((s) => s.label);
    expect(labels).toContain('Summarize');
    expect(labels).toContain('Extract tasks');
  });

  it('groups tabs by topic', () => {
    const groups = groupTabsByTopic([
      { id: 'a', url: 'https://github.com/a', title: 'A' },
      { id: 'b', url: 'https://github.com/b', title: 'B' },
      { id: 'c', url: 'https://youtube.com/watch', title: 'V' },
    ]);
    expect(groups.length).toBeGreaterThanOrEqual(2);
  });

  it('detects duplicate URLs', () => {
    const dupes = findDuplicateTabs([
      { id: '1', url: 'https://example.com/page', title: 'One' },
      { id: '2', url: 'https://example.com/page#section', title: 'Two' },
    ]);
    expect(dupes.length).toBe(1);
    expect(dupes[0].tabs.length).toBe(2);
  });
});
