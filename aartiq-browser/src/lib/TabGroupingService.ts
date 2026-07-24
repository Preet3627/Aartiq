import { AdvancedTabManager, TabArrangementConfig, TabGroup, getTabManager } from './AdvancedTabManager';

export type GroupingStrategy = 'ai' | 'domain' | 'priority' | 'recent';

export interface GroupingResult {
  success: boolean;
  groups: Array<{ name: string; tabIds: string[] }>;
  closedDuplicates: string[];
  error?: string;
}

export interface GroupingOptions {
  strategy: GroupingStrategy;
  maxGroupSize?: number;
  deduplicate?: boolean;
  timeout?: number;
}

type GroupTabsCallback = (tabIds: string[], groupName: string) => void;
type RemoveTabCallback = (tabId: string) => void;
type GetTabsCallback = () => Array<{ id: string; title: string; url: string }>;
type ClassifyTabsCallback = (tabs: Array<{ id: string; title: string; url: string }>) => Promise<{ success: boolean; classifications?: Record<string, string>; error?: string }>;

export class TabGroupingService {
  private tabManager: AdvancedTabManager;
  private isOrganizing = false;

  constructor() {
    this.tabManager = getTabManager();
  }

  async organizeTabs(
    getTabs: GetTabsCallback,
    groupTabs: GroupTabsCallback,
    removeTab: RemoveTabCallback,
    classifyTabs: ClassifyTabsCallback,
    options: GroupingOptions = { strategy: 'ai' }
  ): Promise<GroupingResult> {
    if (this.isOrganizing) {
      return { success: false, groups: [], closedDuplicates: [], error: 'Already organizing' };
    }
    this.isOrganizing = true;

    try {
      const tabs = getTabs();
      if (tabs.length === 0) {
        return { success: false, groups: [], closedDuplicates: [], error: 'No tabs to organize' };
      }

      let closedDuplicates: string[] = [];
      if (options.deduplicate !== false) {
        closedDuplicates = this.deduplicateTabs(tabs, removeTab);
      }

      let groups: Array<{ name: string; tabIds: string[] }>;

      switch (options.strategy) {
        case 'domain':
          groups = this.groupByDomain(tabs);
          break;
        case 'priority':
          groups = this.groupByPriority(tabs);
          break;
        case 'recent':
          groups = this.groupByRecent(tabs);
          break;
        case 'ai':
        default:
          groups = await this.groupByAI(tabs, classifyTabs, options.timeout);
          break;
      }

      for (const group of groups) {
        if (group.tabIds.length > 0) {
          groupTabs(group.tabIds, group.name);
        }
      }

      return { success: true, groups, closedDuplicates };
    } catch (e: any) {
      return { success: false, groups: [], closedDuplicates: [], error: e.message };
    } finally {
      this.isOrganizing = false;
    }
  }

  private deduplicateTabs(
    tabs: Array<{ id: string; title: string; url: string }>,
    removeTab: RemoveTabCallback
  ): string[] {
    const urlCounts = new Map<string, string[]>();
    const closed: string[] = [];

    for (const t of tabs) {
      const url = t.url || '';
      if (!url) continue;
      const normalized = url.replace(/\/$/, '').toLowerCase();
      const existing = urlCounts.get(normalized) || [];
      existing.push(t.id);
      urlCounts.set(normalized, existing);
    }

    for (const [, tabIds] of urlCounts) {
      if (tabIds.length > 1) {
        for (let i = 1; i < tabIds.length; i++) {
          removeTab(tabIds[i]);
          closed.push(tabIds[i]);
        }
      }
    }

    return closed;
  }

  private groupByDomain(tabs: Array<{ id: string; title: string; url: string }>): Array<{ name: string; tabIds: string[] }> {
    const domainMap = new Map<string, string[]>();

    for (const tab of tabs) {
      try {
        const domain = new URL(tab.url).hostname.replace('www.', '');
        const existing = domainMap.get(domain) || [];
        existing.push(tab.id);
        domainMap.set(domain, existing);
      } catch {
        const existing = domainMap.get('Other') || [];
        existing.push(tab.id);
        domainMap.set('Other', existing);
      }
    }

    return Array.from(domainMap.entries())
      .filter(([, ids]) => ids.length > 0)
      .map(([domain, tabIds]) => ({ name: this.domainToGroupName(domain), tabIds }));
  }

  private domainToGroupName(domain: string): string {
    const map: Record<string, string> = {
      'google.com': 'Google', 'youtube.com': 'YouTube', 'github.com': 'Development',
      'stackoverflow.com': 'Development', 'docs.google.com': 'Documents',
      'mail.google.com': 'Email', 'chat.openai.com': 'AI Chat',
      'notion.so': 'Notes', 'medium.com': 'Reading', 'reddit.com': 'Social',
      'twitter.com': 'Social', 'x.com': 'Social', 'linkedin.com': 'Professional',
    };
    return map[domain] || domain.split('.')[0].replace(/^[a-z]/, c => c.toUpperCase());
  }

  private groupByPriority(tabs: Array<{ id: string; title: string; url: string }>): Array<{ name: string; tabIds: string[] }> {
    const config: TabArrangementConfig = { strategy: 'priority', groupByDomain: false, maxGroupSize: 0 };
    const orderedIds = this.tabManager.arrangeTabs(config);
    return [{ name: 'Priority', tabIds: orderedIds }];
  }

  private groupByRecent(tabs: Array<{ id: string; title: string; url: string }>): Array<{ name: string; tabIds: string[] }> {
    const allTabs = this.tabManager.getAllTabs();
    const sorted = [...allTabs].sort((a, b) => b.lastAccessed - a.lastAccessed);
    return [{ name: 'Recent', tabIds: sorted.map(t => t.id) }];
  }

  private async groupByAI(
    tabs: Array<{ id: string; title: string; url: string }>,
    classifyTabs: ClassifyTabsCallback,
    timeout?: number
  ): Promise<Array<{ name: string; tabIds: string[] }>> {
    const result = await classifyTabs(tabs);
    if (!result.success || !result.classifications) {
      return this.groupByDomain(tabs);
    }

    const groupedMap = new Map<string, string[]>();
    for (const [tabId, groupName] of Object.entries(result.classifications)) {
      const existing = groupedMap.get(groupName as string) || [];
      existing.push(tabId);
      groupedMap.set(groupName as string, existing);
    }

    return Array.from(groupedMap.entries()).map(([name, tabIds]) => ({ name, tabIds }));
  }

  get isBusy(): boolean {
    return this.isOrganizing;
  }
}

export const tabGroupingService = new TabGroupingService();
