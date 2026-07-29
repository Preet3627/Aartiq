export interface TabInfo {
  id: string;
  url: string;
  title: string;
  groupId?: string;
  isLoading?: boolean;
}

export interface HistoryEntry {
  url: string;
  title: string;
  timestamp: number;
}

export interface PageContext {
  tabId: string;
  title: string;
  url: string;
  domain: string;
  path: string;
  isBlank: boolean;
  isSearch: boolean;
  isDocs: boolean;
  isVideo: boolean;
  isCode: boolean;
  isArticle: boolean;
  isCommerce: boolean;
  hasReadableContent: boolean;
}

export interface ContextSuggestion {
  id: string;
  label: string;
  command: string;
  priority: number;
}

export interface TopicGroup {
  topic: string;
  tabs: TabInfo[];
}

export interface DuplicateTabCluster {
  normalizedUrl: string;
  tabs: TabInfo[];
}

export interface MemoryRecord {
  key: string;
  value: string;
  category: 'preference' | 'session' | 'fact';
  timestamp: number;
}

export interface ResumeItem {
  id: string;
  title: string;
  subtitle: string;
  command: string;
  kind: 'research' | 'automation' | 'session';
}

export type TimelinePhase = 'search' | 'read' | 'reason' | 'execute' | 'finish';

export interface TimelineEvent {
  id: string;
  phase: TimelinePhase;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  timestamp: number;
}

const READING_WPM = 220;

export function parsePageContext(tabs: TabInfo[], activeTabId?: string): PageContext | null {
  const tab = activeTabId ? tabs.find((t) => t.id === activeTabId) : tabs[0];
  if (!tab?.url || tab.url === 'about:blank') return null;

  let domain = '';
  let path = '';
  try {
    const u = new URL(tab.url);
    domain = u.hostname.replace(/^www\./, '');
    path = u.pathname;
  } catch {
    return null;
  }

  const lower = `${domain}${path}`.toLowerCase();
  const isSearch = domain.includes('google.') && path.includes('/search');
  const isVideo = /youtube|youtu\.be|vimeo|twitch/.test(lower);
  const isCode = /github|gitlab|stackoverflow|dev\.to/.test(lower);
  const isDocs = /docs\.|notion|figma|linear\.app|cursor/.test(lower);
  const isArticle = /news|blog|medium|substack|arxiv|wikipedia/.test(lower) || path.includes('/article');
  const isCommerce = /amazon|ebay|walmart|shopify|etsy/.test(lower);

  return {
    tabId: tab.id,
    title: tab.title || domain,
    url: tab.url,
    domain,
    path,
    isBlank: false,
    isSearch,
    isDocs,
    isVideo,
    isCode,
    isArticle,
    isCommerce,
    hasReadableContent: !isSearch && !tab.url.startsWith('chrome://'),
  };
}

export function estimateUnderstandingScore(ctx: PageContext | null, memoryCount: number, dwellSeconds: number): number {
  if (!ctx) return 12;
  let score = 28;
  if (ctx.title && ctx.title.length > 8) score += 12;
  if (dwellSeconds > 30) score += Math.min(25, Math.floor(dwellSeconds / 12));
  if (memoryCount > 0) score += Math.min(20, memoryCount * 4);
  if (ctx.isDocs || ctx.isArticle) score += 10;
  if (ctx.isCode) score += 8;
  return Math.min(98, score);
}

export function formatDwellTime(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, seconds)}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function estimateReadingMinutes(tabs: TabInfo[]): number {
  const readable = tabs.filter((t) => t.url && t.url !== 'about:blank');
  if (readable.length === 0) return 0;
  const words = readable.reduce((sum, t) => sum + (t.title?.split(/\s+/).length || 0) * 40, 0);
  return Math.max(1, Math.round(words / READING_WPM));
}

export function groupTabsByTopic(tabs: TabInfo[]): TopicGroup[] {
  const map = new Map<string, TabInfo[]>();

  tabs.forEach((tab) => {
    if (!tab.url || tab.url === 'about:blank') return;
    let topic = 'General';
    try {
      const host = new URL(tab.url).hostname.replace(/^www\./, '');
      const title = (tab.title || '').toLowerCase();
      if (/github|gitlab/.test(host)) topic = 'Development';
      else if (/youtube|vimeo|twitch/.test(host)) topic = 'Media';
      else if (/news|nyt|bbc|cnn|reuters/.test(host)) topic = 'News';
      else if (/docs|notion|figma|linear/.test(host)) topic = 'Workspace';
      else if (/amazon|shop|ebay/.test(host)) topic = 'Shopping';
      else if (title.includes('research') || host.includes('arxiv') || host.includes('scholar')) topic = 'Research';
      else topic = host.split('.')[0] || 'Browsing';
    } catch {
      topic = 'Browsing';
    }
    if (!map.has(topic)) map.set(topic, []);
    map.get(topic)!.push(tab);
  });

  return Array.from(map.entries())
    .map(([topic, groupTabs]) => ({ topic, tabs: groupTabs }))
    .sort((a, b) => b.tabs.length - a.tabs.length);
}

export function findDuplicateTabs(tabs: TabInfo[]): DuplicateTabCluster[] {
  const byUrl = new Map<string, TabInfo[]>();
  tabs.forEach((tab) => {
    if (!tab.url || tab.url === 'about:blank') return;
    let key = tab.url;
    try {
      const u = new URL(tab.url);
      u.hash = '';
      key = u.toString();
    } catch { /* keep raw */ }
    if (!byUrl.has(key)) byUrl.set(key, []);
    byUrl.get(key)!.push(tab);
  });
  return Array.from(byUrl.entries())
    .filter(([, group]) => group.length > 1)
    .map(([normalizedUrl, groupTabs]) => ({ normalizedUrl, tabs: groupTabs }));
}

export function loadMemories(): MemoryRecord[] {
  const items: MemoryRecord[] = [];
  try {
    const rawPrefs = localStorage.getItem('aartiq_preference_memory');
    if (rawPrefs) {
      const prefs = JSON.parse(rawPrefs) as Record<string, unknown>;
      Object.entries(prefs).forEach(([key, value]) => {
        items.push({ key, value: String(value), category: 'preference', timestamp: Date.now() });
      });
    }
    const rawSessions = localStorage.getItem('aartiq_session_memory');
    if (rawSessions) {
      const sessions = JSON.parse(rawSessions) as string[];
      if (Array.isArray(sessions)) {
        sessions.slice(-8).forEach((s, i) => {
          items.push({
            key: `session-${i}`,
            value: s,
            category: 'session',
            timestamp: Date.now() - i * 120_000,
          });
        });
      }
    }
  } catch { /* ignore */ }
  return items;
}

export function filterRelevantMemories(memories: MemoryRecord[], ctx: PageContext | null): MemoryRecord[] {
  if (!ctx) return memories.filter((m) => m.category === 'preference').slice(0, 4);
  const hay = `${ctx.title} ${ctx.domain} ${ctx.path}`.toLowerCase();
  const scored = memories.map((m) => {
    const text = `${m.key} ${m.value}`.toLowerCase();
    let score = m.category === 'preference' ? 1 : 0;
    text.split(/\W+/).forEach((word) => {
      if (word.length > 3 && hay.includes(word)) score += 2;
    });
    return { m, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .filter((s) => s.score > 0 || s.m.category === 'preference')
    .slice(0, 5)
    .map((s) => s.m);
}

export function buildContextSuggestions(ctx: PageContext | null, tabCount: number): ContextSuggestion[] {
  if (!ctx) {
    return [
      { id: 'explore', label: 'Explore', command: 'What can you help me with right now?', priority: 1 },
      { id: 'organize', label: 'Organize tabs', command: 'Organize my open tabs by topic', priority: 2 },
    ];
  }

  const suggestions: ContextSuggestion[] = [];
  const pageRef = ctx.title ? `"${ctx.title}"` : 'this page';

  if (ctx.hasReadableContent) {
    suggestions.push({
      id: 'summarize',
      label: 'Summarize',
      command: `Summarize ${pageRef}`,
      priority: 10,
    });
    suggestions.push({
      id: 'explain',
      label: 'Explain',
      command: `Explain the key ideas on ${pageRef} in simple terms`,
      priority: 9,
    });
  }

  if (ctx.isArticle || ctx.isDocs) {
    suggestions.push({
      id: 'extract-tasks',
      label: 'Extract tasks',
      command: `Extract actionable tasks from ${pageRef}`,
      priority: 8,
    });
    suggestions.push({
      id: 'continue-research',
      label: 'Continue research',
      command: `Continue researching the topic from ${pageRef}`,
      priority: 7,
    });
  }

  if (ctx.isCode) {
    suggestions.push({
      id: 'compare',
      label: 'Compare',
      command: `Compare approaches discussed on ${pageRef}`,
      priority: 8,
    });
    suggestions.push({
      id: 'find-similar',
      label: 'Find similar',
      command: `Find similar repositories or resources related to ${pageRef}`,
      priority: 6,
    });
  }

  if (ctx.isVideo) {
    suggestions.push({
      id: 'summarize-video',
      label: 'Summarize',
      command: `Summarize this video: ${pageRef}`,
      priority: 10,
    });
    suggestions.push({
      id: 'transcript',
      label: 'Extract tasks',
      command: `Pull key takeaways and tasks from ${pageRef}`,
      priority: 7,
    });
  }

  if (ctx.isCommerce) {
    suggestions.push({
      id: 'compare-products',
      label: 'Compare',
      command: `Compare this product with alternatives based on ${pageRef}`,
      priority: 9,
    });
  }

  if (tabCount > 2) {
    suggestions.push({
      id: 'cross-tab',
      label: 'Find similar',
      command: 'Find connections and similar themes across my open tabs',
      priority: 5,
    });
  }

  if (ctx.isSearch) {
    suggestions.push({
      id: 'research',
      label: 'Continue research',
      command: 'Turn these search results into a structured research brief',
      priority: 10,
    });
  }

  const byId = new Map<string, ContextSuggestion>();
  suggestions.forEach((s) => {
    const existing = byId.get(s.id);
    if (!existing || s.priority > existing.priority) byId.set(s.id, s);
  });

  return Array.from(byId.values())
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);
}

export function buildResumeItems(
  history: HistoryEntry[],
  runs: { id: string; commands: { label: string; status: string }[]; startTime: number }[],
): ResumeItem[] {
  const items: ResumeItem[] = [];

  history
    .filter((h) => h.title && h.title !== 'New Tab')
    .slice(-3)
    .reverse()
    .forEach((h, i) => {
      items.push({
        id: `hist-${i}-${h.timestamp}`,
        title: h.title.slice(0, 48),
        subtitle: 'Pick up where you left off',
        command: `Continue my work on "${h.title}" — summarize what I was exploring and suggest next steps`,
        kind: 'research',
      });
    });

  runs.slice(-2).reverse().forEach((run) => {
    const failed = run.commands.filter((c) => c.status === 'failed' || c.status === 'error');
    if (failed.length > 0) {
      items.push({
        id: `run-${run.id}`,
        title: 'Restore automations',
        subtitle: `${failed.length} step${failed.length > 1 ? 's' : ''} need attention`,
        command: `Retry these failed automation steps: ${failed.map((f) => f.label).join(', ')}`,
        kind: 'automation',
      });
    }
  });

  return items.slice(0, 4);
}

export function inferObjective(ctx: PageContext | null, sessionLabel: string): string {
  if (sessionLabel && sessionLabel !== 'idle') return sessionLabel;
  if (!ctx) return 'Ready when you are';
  if (ctx.isSearch) return 'Exploring search results';
  if (ctx.isCode) return 'Reviewing code & repos';
  if (ctx.isVideo) return 'Watching & learning';
  if (ctx.isArticle) return 'Reading & synthesizing';
  if (ctx.isDocs) return 'Working in docs';
  return `Understanding ${ctx.domain}`;
}

export function mapStepsToTimeline(
  steps: { id: string; label: string; status: string; timestamp: number }[],
): TimelineEvent[] {
  const phaseForLabel = (label: string): TimelinePhase => {
    const l = label.toLowerCase();
    if (/search|find|query/.test(l)) return 'search';
    if (/read|fetch|navigate|open|scan/.test(l)) return 'read';
    if (/think|reason|plan|analyze/.test(l)) return 'reason';
    if (/exec|run|click|type|write|shell|autom/.test(l)) return 'execute';
    if (/done|complete|finish|success/.test(l)) return 'finish';
    return 'reason';
  };

  return steps.map((step, idx) => ({
    id: step.id || `tl-${idx}`,
    phase: phaseForLabel(step.label),
    label: step.label,
    status: (step.status as TimelineEvent['status']) || 'pending',
    timestamp: step.timestamp || Date.now(),
  }));
}

export function activeWorkspaceLabel(tabs: TabInfo[]): string {
  const grouped = groupTabsByTopic(tabs);
  if (grouped.length === 0) return 'Empty workspace';
  const top = grouped[0];
  if (grouped.length === 1) return top.topic;
  return `${top.topic} +${grouped.length - 1}`;
}
