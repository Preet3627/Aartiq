// Advanced Tab Optimization System for 50+ tabs on 8GB RAM
// Implements suspension, lazy loading, and memory management

interface TabState {
  id: string;
  url: string;
  title: string;
  isSuspended: boolean;
  lastAccessed: number;
  memoryUsage?: number;
  priority: 'high' | 'normal' | 'low';
  keepAlive?: boolean;
  scrollPosition?: number;
}

class TabOptimizer {
  private static instance: TabOptimizer;
  private activeTabIds: Set<string> = new Set(); // Only keep these loaded
  private maxActiveTabs = 3; // Maximum number of tabs to keep loaded
  private maxMemoryMB = 6000; // Max memory for browser (~6GB of 8GB)
  private suspendDelay = 30000; // Suspend tab after 30s of inactivity
  private memoryCheckInterval = 10000; // Check memory every 10s
  private memoryMonitorInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startMemoryMonitoring();
  }

  static getInstance(): TabOptimizer {
    if (!TabOptimizer.instance) {
      TabOptimizer.instance = new TabOptimizer();
    }
    return TabOptimizer.instance;
  }

  // Get tabs that should be kept active
  getActiveTabs(activeTabId: string, allTabs: any[], recentTabIds: string[]): string[] {
    const activeTabs = new Set<string>();
    
    // Always keep active tab
    activeTabs.add(activeTabId);
    
    // Keep recent tabs (up to maxActiveTabs - 1)
    for (const tabId of recentTabIds) {
      if (activeTabs.size >= this.maxActiveTabs) break;
      if (tabId !== activeTabId) {
        activeTabs.add(tabId);
      }
    }

    // Keep high priority tabs if space available
    const highPriorityTabs = allTabs.filter(
      t => (t.priority === 'high' || t.keepAlive) && !activeTabs.has(t.id)
    );
    for (const tab of highPriorityTabs.slice(0, this.maxActiveTabs - activeTabs.size)) {
      activeTabs.add(tab.id);
    }

    return Array.from(activeTabs);
  }

  // Check if tab should be suspended
  shouldSuspendTab(tabId: string, activeTabId: string, tab: TabState): boolean {
    if (tabId === activeTabId) return false;
    if (tab.keepAlive) return false;
    if (tab.priority === 'high') return false;
    
    const timeSinceAccess = Date.now() - tab.lastAccessed;
    return timeSinceAccess > this.suspendDelay;
  }

  // Calculate tab priority based on usage
  calculatePriority(tab: TabState, isActive: boolean, accessCount: number): 'high' | 'normal' | 'low' {
    if (isActive) return 'high';
    if (tab.keepAlive) return 'high';
    if (accessCount > 10) return 'high';
    if (Date.now() - tab.lastAccessed < 60000) return 'normal'; // Accessed in last minute
    return 'low';
  }

  // Get memory-efficient tab rendering order
  getRenderOrder(activeTabId: string, allTabs: any[]): string[] {
    const order: string[] = [];
    
    // Active tab first
    order.push(activeTabId);
    
    // Then recent tabs
    const recentTabs = allTabs
      .filter(t => t.id !== activeTabId)
      .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))
      .slice(0, this.maxActiveTabs - 1)
      .map(t => t.id);
    
    order.push(...recentTabs);
    
    return order;
  }

  // Memory monitoring and cleanup
  startMemoryMonitoring() {
    if (typeof window === 'undefined') return;
    
    this.memoryMonitorInterval = setInterval(() => {
      this.checkAndCleanup();
    }, this.memoryCheckInterval) as any;
  }

  stopMemoryMonitoring() {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
    }
  }

  private checkAndCleanup() {
    // Memory check can be implemented with performance.memory if available
    if ('performance' in window && 'memory' in (performance as any)) {
      const memory = (performance as any).memory;
      const usedMB = memory.usedJSHeapSize / 1048576;
      
      if (usedMB > this.maxMemoryMB) {
        console.warn(`Memory usage high: ${usedMB.toFixed(2)}MB. Consider suspending tabs.`);
      }
    }
  }

  // Suspend a tab (save state, unload content)
  suspendTab(tab: TabState): TabState {
    return {
      ...tab,
      isSuspended: true,
    };
  }

  // Resume a tab (restore state, load content)
  resumeTab(tab: TabState): TabState {
    return {
      ...tab,
      isSuspended: false,
      lastAccessed: Date.now(),
    };
  }

  // Get recommended tabs to suspend
  getTabsToSuspend(
    activeTabId: string,
    allTabs: TabState[]
  ): string[] {
    return allTabs
      .filter(tab => this.shouldSuspendTab(tab.id, activeTabId, tab))
      .map(tab => tab.id);
  }

  // Get recommended tabs to close if memory is low
  getTabsToClose(allTabs: TabState[], maxTabs: number = 50): string[] {
    if (allTabs.length <= maxTabs) return [];
    
    // Sort by priority and last access, close lowest priority/oldest
    const sortedTabs = [...allTabs].sort((a, b) => {
      const priorityOrder = { low: 0, normal: 1, high: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return (a.lastAccessed || 0) - (b.lastAccessed || 0);
    });

    const excessCount = allTabs.length - maxTabs;
    return sortedTabs.slice(0, excessCount).map(t => t.id);
  }

  // Estimate memory usage per tab
  estimateMemoryUsage(tab: TabState): number {
    // Rough estimate: ~50-150MB per tab depending on content
    if (tab.isSuspended) return 1; // Suspended tabs use minimal memory
    return tab.url.includes('video') || tab.url.includes('stream') ? 150 : 80;
  }
}

export const tabOptimizer = TabOptimizer.getInstance();
export type { TabState };
