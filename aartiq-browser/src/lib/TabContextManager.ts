export interface TabMetadata {
  tabId: string;
  url: string;
  title: string;
  favicon?: string;
  isActive: boolean;
  isLoading?: boolean;
  lastAccessed?: number;
  isAudible?: boolean;
  isSuspended?: boolean;
}

export interface TabContent {
  tabId: string;
  url: string;
  title: string;
  content: string;
  textLength: number;
  extractedAt: number;
}

export interface TabSnapshot {
  tabs: TabMetadata[];
  activeTabId: string | null;
  totalTabs: number;
  capturedAt: number;
}

export type TabActivityState = 'idle' | 'reading' | 'analyzing' | 'executing' | 'completed';

export interface TabActivityEvent {
  tabId: string;
  state: TabActivityState;
  timestamp: number;
}

type Listener = (event: TabActivityEvent) => void;

class TabContextManager {
  private listeners: Set<Listener> = new Set();
  private activityStates: Map<string, TabActivityState> = new Map();
  private electronAPI: any;

  constructor() {
    this.electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : null;
  }

  private async getAPI() {
    if (this.electronAPI) return this.electronAPI;
    if (typeof window !== 'undefined') {
      this.electronAPI = (window as any).electronAPI;
    }
    return this.electronAPI;
  }

  async list(): Promise<TabMetadata[]> {
    const api = await this.getAPI();
    if (!api?.getOpenTabs) return [];
    try {
      const tabs = await api.getOpenTabs();
      return (tabs || []).map((t: any) => ({
        tabId: t.tabId,
        url: t.url || '',
        title: t.title || '',
        isActive: !!t.isActive,
        isLoading: !!t.isLoading,
        isAudible: !!t.isAudible,
      }));
    } catch {
      return [];
    }
  }

  async getContent(tabId?: string): Promise<TabContent | null> {
    const api = await this.getAPI();
    if (!api?.extractPageContent) return null;
    try {
      const result = await api.extractPageContent(tabId);
      if (!result || result.error) return null;

      const tabs = await this.list();
      const tab = tabs.find(t => t.tabId === (tabId || undefined));
      return {
        tabId: tabId || 'active',
        url: tab?.url || '',
        title: tab?.title || '',
        content: result.content || '',
        textLength: (result.content || '').length,
        extractedAt: Date.now(),
      };
    } catch {
      return null;
    }
  }

  async extractReadableContent(tabId?: string): Promise<string | null> {
    const content = await this.getContent(tabId);
    if (!content) return null;
    return this.stripNoise(content.content);
  }

  async getSnapshot(): Promise<TabSnapshot> {
    const api = await this.getAPI();
    let tabs: TabMetadata[] = [];
    try {
      tabs = await this.list();
    } catch {
      tabs = [];
    }
    return {
      tabs,
      activeTabId: tabs.find(t => t.isActive)?.tabId || null,
      totalTabs: tabs.length,
      capturedAt: Date.now(),
    };
  }

  async readMultipleTabs(tabIds: string[]): Promise<Map<string, TabContent | null>> {
    const results = new Map<string, TabContent | null>();
    for (const tabId of tabIds) {
      this.emit({ tabId, state: 'reading', timestamp: Date.now() });
      const content = await this.getContent(tabId);
      results.set(tabId, content);
      if (content) {
        this.emit({ tabId, state: 'completed', timestamp: Date.now() });
      }
    }
    return results;
  }

  async summarizeTabsContent(tabIds?: string[]): Promise<{ tabs: TabMetadata[]; contents: TabContent[] }> {
    const tabs = await this.list();
    const targetTabs = tabIds
      ? tabs.filter(t => tabIds.includes(t.tabId))
      : tabs;

    const contents: TabContent[] = [];
    for (const tab of targetTabs) {
      this.emit({ tabId: tab.tabId, state: 'reading', timestamp: Date.now() });
      const content = await this.getContent(tab.tabId);
      if (content) {
        contents.push(content);
        this.emit({ tabId: tab.tabId, state: 'completed', timestamp: Date.now() });
      }
    }

    return { tabs: targetTabs, contents };
  }

  async findInTabs(query: string): Promise<Array<{ tabId: string; title: string; url: string; matches: string[] }>> {
    const tabs = await this.list();
    const results: Array<{ tabId: string; title: string; url: string; matches: string[] }> = [];

    for (const tab of tabs) {
      this.emit({ tabId: tab.tabId, state: 'reading', timestamp: Date.now() });
      const content = await this.getContent(tab.tabId);
      if (!content) continue;

      const lower = content.content.toLowerCase();
      const searchTerm = query.toLowerCase();
      const matches: string[] = [];
      let idx = lower.indexOf(searchTerm);
      while (idx !== -1 && matches.length < 5) {
        const start = Math.max(0, idx - 60);
        const end = Math.min(content.content.length, idx + query.length + 60);
        matches.push(content.content.slice(start, end));
        idx = lower.indexOf(searchTerm, idx + 1);
      }

      if (matches.length > 0 || tab.title.toLowerCase().includes(searchTerm)) {
        results.push({ tabId: tab.tabId, title: tab.title, url: tab.url, matches });
      }
      this.emit({ tabId: tab.tabId, state: 'completed', timestamp: Date.now() });
    }

    return results;
  }

  async compareTabs(tabIds: string[]): Promise<Array<{ tabId: string; title: string; url: string; contentLength: number; preview: string }>> {
    const tabs = await this.list();
    const targetTabs = tabs.filter(t => tabIds.includes(t.tabId));
    const results: Array<{ tabId: string; title: string; url: string; contentLength: number; preview: string }> = [];

    for (const tab of targetTabs) {
      this.emit({ tabId: tab.tabId, state: 'reading', timestamp: Date.now() });
      const content = await this.getContent(tab.tabId);
      if (!content) continue;
      results.push({
        tabId: tab.tabId,
        title: tab.title,
        url: tab.url,
        contentLength: content.textLength,
        preview: content.content.slice(0, 500),
      });
      this.emit({ tabId: tab.tabId, state: 'completed', timestamp: Date.now() });
    }

    return results;
  }

  onActivity(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: TabActivityEvent) {
    this.activityStates.set(event.tabId, event.state);
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  getTabState(tabId: string): TabActivityState {
    return this.activityStates.get(tabId) || 'idle';
  }

  resetTabState(tabId: string) {
    this.activityStates.set(tabId, 'idle');
    this.emit({ tabId, state: 'idle', timestamp: Date.now() });
  }

  resetAllStates() {
    for (const [tabId] of this.activityStates) {
      this.activityStates.set(tabId, 'idle');
      this.emit({ tabId, state: 'idle', timestamp: Date.now() });
    }
  }

  private stripNoise(text: string): string {
    return text
      .replace(/cookie|privacy|terms of service|accept all|got it/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s{2,}/g, ' ')
      .replace(/https?:\/\/\S+/g, '')
      .trim();
  }
}

const STORAGE_KEY = 'aartiq_tab_context_content';

export function cacheTabContent(tabId: string, content: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    cache[tabId] = { content: content.slice(0, 10000), cachedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {}
}

export function getCachedTabContent(tabId: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const entry = cache[tabId];
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > 300000) {
      delete cache[tabId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
      return null;
    }
    return entry.content;
  } catch {
    return null;
  }
}

export const tabContextManager = new TabContextManager();
