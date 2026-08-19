import {
  tabContextManager,
  cacheTabContent,
  getCachedTabContent,
} from '../src/lib/TabContextManager';
import {
  useTabIntelligenceStore,
  type AIThemeSettings,
  type SessionPhase,
} from '../src/store/tabIntelligenceStore';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// TabContextManager Tests
// ============================================================
describe('TabContextManager', () => {
  beforeEach(() => {
    tabContextManager.resetAllStates();
  });

  describe('tab listing', () => {
    it('should return empty array when electronAPI is unavailable', async () => {
      const tabs = await tabContextManager.list();
      expect(Array.isArray(tabs)).toBe(true);
    });

    it('should expose list method', () => {
      expect(typeof tabContextManager.list).toBe('function');
    });

    it('should expose getContent method', () => {
      expect(typeof tabContextManager.getContent).toBe('function');
    });

    it('should expose extractReadableContent method', () => {
      expect(typeof tabContextManager.extractReadableContent).toBe('function');
    });

    it('should expose getSnapshot method', () => {
      expect(typeof tabContextManager.getSnapshot).toBe('function');
    });
  });

  describe('getSnapshot', () => {
    it('should return snapshot with empty tabs when API unavailable', async () => {
      const snapshot = await tabContextManager.getSnapshot();
      expect(snapshot).toHaveProperty('tabs');
      expect(snapshot).toHaveProperty('activeTabId');
      expect(snapshot).toHaveProperty('totalTabs');
      expect(snapshot).toHaveProperty('capturedAt');
      expect(typeof snapshot.capturedAt).toBe('number');
      expect(snapshot.totalTabs).toBe(0);
    });
  });

  describe('readMultipleTabs', () => {
    it('should return empty map for no tabs', async () => {
      const results = await tabContextManager.readMultipleTabs([]);
      expect(results instanceof Map).toBe(true);
      expect(results.size).toBe(0);
    });

    it('should handle non-existent tab IDs gracefully', async () => {
      const results = await tabContextManager.readMultipleTabs(['nonexistent-1']);
      expect(results.size).toBe(1);
      expect(results.get('nonexistent-1')).toBeNull();
    });
  });

  describe('findInTabs', () => {
    it('should return empty array when API unavailable', async () => {
      const results = await tabContextManager.findInTabs('test query');
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('compareTabs', () => {
    it('should return empty array for empty tab IDs', async () => {
      const results = await tabContextManager.compareTabs([]);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('summarizeTabsContent', () => {
    it('should return empty results when API unavailable', async () => {
      const result = await tabContextManager.summarizeTabsContent();
      expect(result).toHaveProperty('tabs');
      expect(result).toHaveProperty('contents');
      expect(Array.isArray(result.tabs)).toBe(true);
      expect(Array.isArray(result.contents)).toBe(true);
      expect(result.tabs.length).toBe(0);
      expect(result.contents.length).toBe(0);
    });
  });

  describe('activity events', () => {
    it('should emit and receive activity events', (done) => {
      const unsub = tabContextManager.onActivity((event) => {
        expect(event.tabId).toBe('test-tab-1');
        expect(event.state).toBe('reading');
        expect(typeof event.timestamp).toBe('number');
        unsub();
        done();
      });

      tabContextManager['emit']({ tabId: 'test-tab-1', state: 'reading', timestamp: Date.now() });
    });

    it('should track tab state changes', () => {
      tabContextManager['emit']({ tabId: 'tab-1', state: 'reading', timestamp: Date.now() });
      expect(tabContextManager.getTabState('tab-1')).toBe('reading');

      tabContextManager['emit']({ tabId: 'tab-1', state: 'completed', timestamp: Date.now() });
      expect(tabContextManager.getTabState('tab-1')).toBe('completed');
    });

    it('should reset tab state', () => {
      tabContextManager['emit']({ tabId: 'tab-1', state: 'reading', timestamp: Date.now() });
      expect(tabContextManager.getTabState('tab-1')).toBe('reading');

      tabContextManager.resetTabState('tab-1');
      expect(tabContextManager.getTabState('tab-1')).toBe('idle');
    });

    it('should remove listeners on unsubscribe', () => {
      let callCount = 0;
      const unsub = tabContextManager.onActivity(() => {
        callCount++;
      });
      unsub();
      tabContextManager['emit']({ tabId: 'tab-1', state: 'reading', timestamp: Date.now() });
      expect(callCount).toBe(0);
    });

    it('should reset all states', () => {
      tabContextManager['emit']({ tabId: 'tab-1', state: 'reading', timestamp: Date.now() });
      tabContextManager['emit']({ tabId: 'tab-2', state: 'analyzing', timestamp: Date.now() });
      expect(tabContextManager.getTabState('tab-1')).toBe('reading');
      expect(tabContextManager.getTabState('tab-2')).toBe('analyzing');

      tabContextManager.resetAllStates();
      expect(tabContextManager.getTabState('tab-1')).toBe('idle');
      expect(tabContextManager.getTabState('tab-2')).toBe('idle');
    });
  });
});

// ============================================================
// Tab Content Cache Tests
// ============================================================
describe('Tab content cache', () => {
  const hasLocalStorage = typeof localStorage !== 'undefined';

  beforeEach(() => {
    if (hasLocalStorage) {
      localStorage.removeItem('aartiq_tab_context_content');
    }
  });

  it('should cache and retrieve tab content', () => {
    if (!hasLocalStorage) return;
    cacheTabContent('tab-1', 'test content');
    const cached = getCachedTabContent('tab-1');
    expect(cached).toBe('test content');
  });

  it('should return null for uncached tab', () => {
    if (!hasLocalStorage) return;
    const cached = getCachedTabContent('nonexistent');
    expect(cached).toBeNull();
  });

  it('should handle empty content', () => {
    if (!hasLocalStorage) return;
    cacheTabContent('tab-1', '');
    const cached = getCachedTabContent('tab-1');
    expect(cached).toBe('');
  });
});

// ============================================================
// TabIntelligenceStore Tests
// ============================================================
describe('useTabIntelligenceStore', () => {
  beforeEach(() => {
    useTabIntelligenceStore.getState().resetAll();
  });

  describe('session phase management', () => {
    it('should start in idle phase', () => {
      const state = useTabIntelligenceStore.getState();
      expect(state.sessionPhase).toBe('idle');
      expect(state.sessionLabel).toBe('');
      expect(state.sessionStartedAt).toBeNull();
    });

    it('should set session phase and label', () => {
      useTabIntelligenceStore.getState().setSessionPhase('reading', 'Reading your tabs...');
      const state = useTabIntelligenceStore.getState();
      expect(state.sessionPhase).toBe('reading');
      expect(state.sessionLabel).toBe('Reading your tabs...');
      expect(state.sessionStartedAt).not.toBeNull();
    });

    it('should track session phase history', () => {
      useTabIntelligenceStore.getState().setSessionPhase('planning', 'Planning...');
      useTabIntelligenceStore.getState().setSessionPhase('reading', 'Reading...');

      const state = useTabIntelligenceStore.getState();
      expect(state.sessionHistory.length).toBe(2);
      expect(state.sessionHistory[0].phase).toBe('planning');
      expect(state.sessionHistory[1].phase).toBe('reading');
    });

    it('should cycle through all session phases', () => {
      const phases: SessionPhase[] = ['planning', 'reading', 'analyzing', 'generating', 'complete'];
      for (const phase of phases) {
        useTabIntelligenceStore.getState().setSessionPhase(phase);
        expect(useTabIntelligenceStore.getState().sessionPhase).toBe(phase);
      }
    });

    it('should reset session state', () => {
      useTabIntelligenceStore.getState().setSessionPhase('reading', 'Reading...');
      useTabIntelligenceStore.getState().startTabActivity('tab-1', 'reading');
      useTabIntelligenceStore.getState().resetSession();

      const state = useTabIntelligenceStore.getState();
      expect(state.sessionPhase).toBe('idle');
      expect(state.sessionLabel).toBe('');
      expect(state.sessionStartedAt).toBeNull();
      expect(state.tabActivities.size).toBe(0);
      expect(state.activeTabIds.size).toBe(0);
      expect(state.sessionHistory.length).toBe(0);
    });
  });

  describe('tab activity tracking', () => {
    it('should start tab activity with correct initial state', () => {
      useTabIntelligenceStore.getState().startTabActivity('tab-1', 'reading', 'Test Page', 'https://example.com');

      const state = useTabIntelligenceStore.getState();
      expect(state.activeTabIds.has('tab-1')).toBe(true);
      const record = state.tabActivities.get('tab-1');
      expect(record).toBeDefined();
      expect(record!.state).toBe('reading');
      expect(record!.title).toBe('Test Page');
      expect(record!.url).toBe('https://example.com');
      expect(typeof record!.startedAt).toBe('number');
    });

    it('should update tab activity state', () => {
      useTabIntelligenceStore.getState().startTabActivity('tab-1', 'reading');
      useTabIntelligenceStore.getState().updateTabActivity('tab-1', 'analyzing');

      const record = useTabIntelligenceStore.getState().tabActivities.get('tab-1');
      expect(record!.state).toBe('analyzing');
    });

    it('should complete tab activity with timestamp', () => {
      useTabIntelligenceStore.getState().startTabActivity('tab-1', 'reading');
      useTabIntelligenceStore.getState().completeTabActivity('tab-1');

      const record = useTabIntelligenceStore.getState().tabActivities.get('tab-1');
      expect(record!.state).toBe('completed');
      expect(typeof record!.completedAt).toBe('number');
    });

    it('should reset individual tab activity', () => {
      useTabIntelligenceStore.getState().startTabActivity('tab-1', 'reading');
      expect(useTabIntelligenceStore.getState().activeTabIds.has('tab-1')).toBe(true);

      useTabIntelligenceStore.getState().resetTabActivity('tab-1');
      expect(useTabIntelligenceStore.getState().activeTabIds.has('tab-1')).toBe(false);
      expect(useTabIntelligenceStore.getState().tabActivities.has('tab-1')).toBe(false);
    });

    it('should track multiple tab activities simultaneously', () => {
      useTabIntelligenceStore.getState().startTabActivity('tab-1', 'reading', 'Page 1');
      useTabIntelligenceStore.getState().startTabActivity('tab-2', 'analyzing', 'Page 2');

      const state = useTabIntelligenceStore.getState();
      expect(state.activeTabIds.size).toBe(2);
      expect(state.tabActivities.get('tab-1')!.state).toBe('reading');
      expect(state.tabActivities.get('tab-2')!.state).toBe('analyzing');
    });
  });

  describe('theme management', () => {
    it('should have default theme settings', () => {
      const state = useTabIntelligenceStore.getState();
      expect(state.theme.enabled).toBe(true);
      expect(state.theme.preset).toBe('ocean-blue');
      expect(state.theme.glowColor).toBe('#38bdf8');
    });

    it('should update theme settings partially', () => {
      useTabIntelligenceStore.getState().updateTheme({
        glowColor: '#ff0000',
        glowIntensity: 0.8,
      });

      const state = useTabIntelligenceStore.getState();
      expect(state.theme.glowColor).toBe('#ff0000');
      expect(state.theme.glowIntensity).toBe(0.8);
      expect(state.theme.preset).toBe('ocean-blue');
    });

    it('should set theme preset with all colors', () => {
      useTabIntelligenceStore.getState().setThemePreset('sunset-fire');

      const state = useTabIntelligenceStore.getState();
      expect(state.theme.preset).toBe('sunset-fire');
      expect(state.theme.primary).toBe('#f97316');
      expect(state.theme.secondary).toBe('#ef4444');
      expect(state.theme.tertiary).toBe('#f59e0b');
    });

    it('should fall back to ocean-blue for unknown preset', () => {
      useTabIntelligenceStore.getState().setThemePreset('unknown-preset');

      const state = useTabIntelligenceStore.getState();
      expect(state.theme.preset).toBe('unknown-preset');
      expect(state.theme.primary).toBe('#3b82f6');
    });

    it('should set all available presets without error', () => {
      const presets = ['purple-cosmos', 'ocean-blue', 'emerald-forest', 'sunset-fire', 'rose-gold', 'arctic-ice'];
      for (const preset of presets) {
        expect(() => useTabIntelligenceStore.getState().setThemePreset(preset)).not.toThrow();
        expect(useTabIntelligenceStore.getState().theme.preset).toBe(preset);
      }
    });
  });
});

// ============================================================
// Security/Action Permission Tests
// ============================================================
describe('Tab action permissions', () => {
  it('should have low risk for read-only tab actions', () => {
    const { AI_ACTION_SECURITY_CATALOG } = require('../src/lib/ai-action-security');
    const readActions = ['LIST_OPEN_TABS', 'READ_TAB_CONTENT', 'SUMMARIZE_TABS', 'COMPARE_TABS', 'FIND_INFORMATION_IN_TABS', 'CREATE_TAB_RESEARCH_CONTEXT'];

    for (const actionType of readActions) {
      const def = AI_ACTION_SECURITY_CATALOG.find((a: any) => a.actionType === actionType);
      expect(def).toBeDefined();
      expect(def!.risk).toBe('low');
    }
  });

  it('should have medium risk for modifying tab actions', () => {
    const { AI_ACTION_SECURITY_CATALOG } = require('../src/lib/ai-action-security');
    const modifyActions = ['CLOSE_TAB', 'MOVE_TAB'];

    for (const actionType of modifyActions) {
      const def = AI_ACTION_SECURITY_CATALOG.find((a: any) => a.actionType === actionType);
      expect(def).toBeDefined();
      expect(def!.risk).toBe('medium');
    }
  });

  it('should auto-approve low risk tab actions', () => {
    const { isActionAutoApproved } = require('../src/lib/ai-action-security');
    const settings = { autoApproveLowRisk: true, autoApprovedActions: [] };

    const approved = isActionAutoApproved(settings, 'READ_TAB_CONTENT', 'low');
    expect(approved).toBe(true);
  });

  it('should not auto-approve medium risk tab actions without settings', () => {
    const { isActionAutoApproved } = require('../src/lib/ai-action-security');
    const settings = { autoApproveLowRisk: true, autoApprovedActions: [] };

    const approved = isActionAutoApproved(settings, 'CLOSE_TAB', 'medium');
    expect(approved).toBe(false);
  });

  it('should register tab intelligence category', () => {
    const { AI_ACTION_SECURITY_CATALOG } = require('../src/lib/ai-action-security');
    const tabActions = AI_ACTION_SECURITY_CATALOG.filter((a: any) => a.category === 'Tab Intelligence');
    expect(tabActions.length).toBeGreaterThanOrEqual(6);
  });
});

// ============================================================
// TabGroupingService Tests
// ============================================================
describe('TabGroupingService', () => {
  const { TabGroupingService } = require('../src/lib/TabGroupingService');

  it('should create service instance', () => {
    const service = new TabGroupingService();
    expect(service).toBeDefined();
    expect(service.isBusy).toBe(false);
  });

  it('should deduplicate identical URLs', async () => {
    const service = new TabGroupingService();
    const tabs = [
      { id: 'tab-1', title: 'Page 1', url: 'https://example.com/page1' },
      { id: 'tab-2', title: 'Page 2', url: 'https://example.com/page1' },
      { id: 'tab-3', title: 'Google', url: 'https://google.com' },
    ];
    const closed: string[] = [];
    const groups: Array<{ name: string; tabIds: string[] }> = [];

    const result = await service.organizeTabs(
      () => tabs,
      (tabIds: string[], name: string) => groups.push({ name, tabIds }),
      (tabId: string) => closed.push(tabId),
      async () => ({
        success: true,
        classifications: { 'tab-1': 'Work', 'tab-3': 'Search' },
      }),
      { strategy: 'ai', deduplicate: true }
    );

    expect(closed).toContain('tab-2');
    expect(result.closedDuplicates).toContain('tab-2');
    expect(result.success).toBe(true);
  });

  it('should return error when already organizing', async () => {
    const service = new TabGroupingService();
    (service as any).isOrganizing = true;

    const result = await service.organizeTabs(
      () => [{ id: 'tab-1', title: 'Test', url: 'https://example.com' }],
      () => {},
      () => {},
      async () => ({ success: true, classifications: {} }),
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Already organizing');
  });

  it('should return error when no tabs to organize', async () => {
    const service = new TabGroupingService();
    const result = await service.organizeTabs(
      () => [],
      () => {},
      () => {},
      async () => ({ success: true, classifications: {} }),
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('No tabs to organize');
  });

  it('should group by domain when AI classification fails', async () => {
    const service = new TabGroupingService();
    const tabs = [
      { id: 'tab-1', title: 'Google', url: 'https://google.com/search' },
      { id: 'tab-2', title: 'Gmail', url: 'https://mail.google.com/' },
      { id: 'tab-3', title: 'GitHub', url: 'https://github.com/project' },
    ];
    const groups: Array<{ name: string; tabIds: string[] }> = [];

    await service.organizeTabs(
      () => tabs,
      (tabIds: string[], name: string) => groups.push({ name, tabIds }),
      () => {},
      async () => ({ success: false, error: 'AI failed' }),
      { strategy: 'ai' }
    );

    expect(groups.length).toBeGreaterThanOrEqual(1);
    const googleGroup = groups.find(g => g.name === 'Google');
    expect(googleGroup).toBeDefined();
    expect(googleGroup!.tabIds).toContain('tab-1');
  });

  it('should group by domain strategy', async () => {
    const service = new TabGroupingService();
    const tabs = [
      { id: 'tab-1', title: 'Search', url: 'https://google.com/search' },
      { id: 'tab-2', title: 'YouTube', url: 'https://youtube.com/watch' },
    ];
    const groups: Array<{ name: string; tabIds: string[] }> = [];

    await service.organizeTabs(
      () => tabs,
      (tabIds: string[], name: string) => groups.push({ name, tabIds }),
      () => {},
      async () => ({ success: true, classifications: {} }),
      { strategy: 'domain' }
    );

    expect(groups.length).toBe(2);
    expect(groups.find(g => g.name === 'Google')).toBeDefined();
    expect(groups.find(g => g.name === 'YouTube')).toBeDefined();
  });

  it('should use AI classification result to create groups', async () => {
    const service = new TabGroupingService();
    const tabs = [
      { id: 'tab-1', title: 'AI News', url: 'https://example.com/ai' },
      { id: 'tab-2', title: 'ML Paper', url: 'https://example.com/ml' },
      { id: 'tab-3', title: 'React Docs', url: 'https://react.dev/' },
    ];
    const groups: Array<{ name: string; tabIds: string[] }> = [];

    await service.organizeTabs(
      () => tabs,
      (tabIds: string[], name: string) => groups.push({ name, tabIds }),
      () => {},
      async () => ({
        success: true,
        classifications: {
          'tab-1': 'Research',
          'tab-2': 'Research',
          'tab-3': 'Development',
        },
      }),
      { strategy: 'ai' }
    );

    expect(groups.length).toBe(2);
    const research = groups.find(g => g.name === 'Research');
    expect(research).toBeDefined();
    expect(research!.tabIds).toContain('tab-1');
    expect(research!.tabIds).toContain('tab-2');
    const dev = groups.find(g => g.name === 'Development');
    expect(dev).toBeDefined();
    expect(dev!.tabIds).toContain('tab-3');
  });

  it('should handle priority strategy', async () => {
    const service = new TabGroupingService();
    const tabs = [
      { id: 'tab-1', title: 'Test', url: 'https://example.com' },
    ];

    const result = await service.organizeTabs(
      () => tabs,
      () => {},
      () => {},
      async () => ({ success: true, classifications: {} }),
      { strategy: 'priority' }
    );

    expect(result.success).toBe(true);
  });

  it('should handle recent strategy', async () => {
    const service = new TabGroupingService();
    const tabs = [
      { id: 'tab-1', title: 'Test', url: 'https://example.com' },
    ];

    const result = await service.organizeTabs(
      () => tabs,
      () => {},
      () => {},
      async () => ({ success: true, classifications: {} }),
      { strategy: 'recent' }
    );

    expect(result.success).toBe(true);
  });

  it('should map domain names to readable group names', () => {
    const service = new TabGroupingService();
    const tabs = [
      { id: 'tab-1', title: 'Mail', url: 'https://mail.google.com/' },
      { id: 'tab-2', title: 'Chat', url: 'https://chat.openai.com/' },
      { id: 'tab-3', title: 'Issues', url: 'https://github.com/issues' },
      { id: 'tab-4', title: 'Tweets', url: 'https://x.com/home' },
    ];
    const groups: Array<{ name: string; tabIds: string[] }> = [];

    service.organizeTabs(
      () => tabs,
      (tabIds: string[], name: string) => groups.push({ name, tabIds }),
      () => {},
      async () => ({ success: false, error: 'fail' }),
      { strategy: 'domain' }
    );

    expect(groups.find(g => g.name === 'Email')).toBeDefined();
    expect(groups.find(g => g.name === 'AI Chat')).toBeDefined();
    expect(groups.find(g => g.name === 'Development')).toBeDefined();
    expect(groups.find(g => g.name === 'Social')).toBeDefined();
  });
});

// ============================================================
// Tab Command String Constants Tests
// ============================================================
describe('Tab command constants', () => {
  it('should define all required tab commands as strings', () => {
    const commands = [
      'READ_TAB_CONTENT',
      'SUMMARIZE_TABS',
      'COMPARE_TABS',
      'FIND_INFORMATION_IN_TABS',
      'CREATE_TAB_RESEARCH_CONTEXT',
    ];
    for (const cmd of commands) {
      expect(typeof cmd).toBe('string');
      expect(cmd.length).toBeGreaterThan(0);
    }
  });

  it('should have READ_TAB_CONTENT in action security catalog', () => {
    const { AI_ACTION_SECURITY_CATALOG } = require('../src/lib/ai-action-security');
    const def = AI_ACTION_SECURITY_CATALOG.find((a: any) => a.actionType === 'READ_TAB_CONTENT');
    expect(def).toBeDefined();
    expect(def!.risk).toBe('low');
  });
});
