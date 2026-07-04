// Hook for optimized tab management with suspension and lazy loading
import { useEffect, useMemo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '@/store/useAppStore';
import { tabOptimizer } from '@/lib/TabOptimizer';
import { selectOptimizedTabsStore } from '@/store/selectors';

export const useOptimizedTabs = () => {
  const {
    tabs,
    activeTabId,
    performanceMode,
    performanceModeSettings,
    setActiveTab,
    updateTab,
  } = useAppStore(useShallow(selectOptimizedTabsStore));

  // Track recent tab access for optimizer
  const recentTabIds = useMemo(() => {
    // Get recently accessed tabs (last 5)
    return tabs
      .slice()
      .sort((a, b) => ((b as any).lastAccessed || 0) - ((a as any).lastAccessed || 0))
      .slice(0, 5)
      .map(t => t.id);
  }, [tabs]);

  // Get tabs that should be kept loaded (active + recent)
  const activeTabIds = useMemo(() => {
    if (performanceMode === 'performance') {
      const sortedTabs = tabs.slice().sort((a, b) => ((b as any).lastAccessed || 0) - ((a as any).lastAccessed || 0));
      let activeTabs = [activeTabId];
      let currentRam = 0;

      for (const tab of sortedTabs) {
        if (activeTabs.length >= performanceModeSettings.maxActiveTabs) break;
        if (activeTabs.includes(tab.id)) continue;

        const tabRam = tabOptimizer.estimateMemoryUsage({
          ...tab,
          isSuspended: false,
          lastAccessed: (tab as any).lastAccessed || Date.now(),
          priority: (tab as any).priority || 'normal',
        });
        if (currentRam + tabRam > performanceModeSettings.maxRam) continue;

        if (performanceModeSettings.keepAudioTabsActive && tab.isAudible) {
          activeTabs.push(tab.id);
          currentRam += tabRam;
        }
      }

      for (const tab of sortedTabs) {
        if (activeTabs.length >= performanceModeSettings.maxActiveTabs) break;
        if (activeTabs.includes(tab.id)) continue;

        const tabRam = tabOptimizer.estimateMemoryUsage({
          ...tab,
          isSuspended: false,
          lastAccessed: (tab as any).lastAccessed || Date.now(),
          priority: (tab as any).priority || 'normal',
        });
        if (currentRam + tabRam > performanceModeSettings.maxRam) continue;

        activeTabs.push(tab.id);
        currentRam += tabRam;
      }

      return activeTabs;
    }
    return tabOptimizer.getActiveTabs(activeTabId, tabs, recentTabIds);
  }, [activeTabId, tabs, recentTabIds, performanceMode, performanceModeSettings]);

  // Suspend inactive tabs automatically
  useEffect(() => {
    if (tabs.length < 2) return;

    tabs.forEach(tab => {
      const shouldBeActive = activeTabIds.includes(tab.id);
      if (shouldBeActive && tab.isSuspended) {
        updateTab(tab.id, { isSuspended: false });
        if (window.electronAPI) window.electronAPI.resumeTab?.(tab.id);
      } else if (!shouldBeActive && !tab.isSuspended) {
        // Suspend if not in active tabs list
        updateTab(tab.id, { isSuspended: true });
        if (window.electronAPI) window.electronAPI.suspendTab?.(tab.id);
      }
    });
  }, [tabs, activeTabIds, updateTab]);

  // Only render active tab (others are suspended/unloaded)
  const shouldRenderTab = useCallback((tabId: string) => {
    return activeTabIds.includes(tabId);
  }, [activeTabIds]);

  // Update tab last accessed time when switched
  const handleTabSwitch = useCallback((tabId: string) => {
    setActiveTab(tabId);
    // Note: setActiveTab now updates lastAccessed and isSuspended in the store
    if (window.electronAPI) window.electronAPI.resumeTab?.(tabId);
  }, [setActiveTab]);

  // Check if tab is suspended
  const isTabSuspended = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    return (tab as any)?.isSuspended || false;
  }, [tabs]);

  // Get memory usage estimate
  const getMemoryUsage = useCallback(() => {
    const estimated = tabs.reduce((total, tab) => {
      const tabState = {
        id: tab.id,
        url: tab.url,
        title: tab.title || 'New Tab',
        isSuspended: (tab as any).isSuspended || false,
        lastAccessed: (tab as any).lastAccessed || Date.now(),
        priority: (tab as any).priority || 'normal',
      };
      return total + tabOptimizer.estimateMemoryUsage(tabState);
    }, 0);
    return estimated;
  }, [tabs]);

  return {
    activeTabIds,
    shouldRenderTab,
    handleTabSwitch,
    isTabSuspended,
    getMemoryUsage,
  };
};
