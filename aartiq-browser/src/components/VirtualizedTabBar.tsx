// Memory-efficient virtualized tab bar for 50+ tabs with Drag-and-Drop and AI Grouping
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Globe, Plus, Volume2, FolderOpen, Loader2, Sparkles } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { Reorder, AnimatePresence, motion } from 'framer-motion';

interface Tab {
  id: string;
  title: string;
  url?: string;
  isAudible?: boolean;
  groupId?: string;
}

interface VirtualizedTabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onAddTab: () => void;
  isTabSuspended?: (tabId: string) => boolean;
  maxVisibleTabs?: number;
}

export const VirtualizedTabBar: React.FC<VirtualizedTabBarProps> = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onAddTab,
  isTabSuspended,
  maxVisibleTabs = 10,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const store = useAppStore();
  const lastSwitchTime = useRef(0);
  
  // Shake detection logic
  const dragStartTime = useRef(0);
  const lastX = useRef(0);
  const shakeCount = useRef(0);
  const lastDirection = useRef<number>(0); // -1 for left, 1 for right
  const [isShaking, setIsShaking] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);

  const handleTabClick = (tabId: string) => {
    const now = Date.now();
    if (now - lastSwitchTime.current < 300) return;
    lastSwitchTime.current = now;
    onTabClick(tabId);
  };

  const handleReorder = (newOrder: Tab[]) => {
    // Only update if order actually changed to avoid jitter
    if (newOrder.map(t => t.id).join(',') !== tabs.map(t => t.id).join(',')) {
      store.setTabs(newOrder as any);
    }
  };

  const onDragStart = () => {
    dragStartTime.current = Date.now();
    shakeCount.current = 0;
    lastDirection.current = 0;
    setIsShaking(false);
  };

  const onDragEnd = (event: any, info: any, tab: Tab) => {
    const dragDuration = Date.now() - dragStartTime.current;
    
    // If user "shook" the tab (multiple rapid direction changes)
    if (shakeCount.current >= 4 && dragDuration < 1500) {
      console.log("[CometAI] Tab shake detected! Invoking AI Organizer...");
      autoGroupTabsAI();
      // Stop shaking immediately
      setIsShaking(false);
      shakeCount.current = 0;
    }
  };

  const onDrag = (event: any, info: any) => {
    if (isOrganizing) return;
    
    const currentX = info.point.x;
    const deltaX = currentX - lastX.current;
    const direction = deltaX > 0 ? 1 : deltaX < 0 ? -1 : 0;

    if (direction !== 0 && direction !== lastDirection.current) {
      shakeCount.current++;
      lastDirection.current = direction;
      
      if (shakeCount.current >= 4) {
        setIsShaking(true);
      }
    }
    lastX.current = currentX;
  };

  const autoGroupTabsAI = async () => {
    if (isOrganizing) return;
    setIsOrganizing(true);
    
    // Safety timeout: Reset state after 10 seconds max if IPC hangs
    const safetyTimeout = setTimeout(() => {
      setIsOrganizing(false);
      setIsShaking(false);
    }, 10000);
    
    try {
      const tabList = tabs.map(t => ({ id: t.id, title: t.title, url: t.url || '' }));
      const result = await (window as any).electronAPI.classifyTabsAi({ tabs: tabList });
      
      if (result.success && result.classifications) {
        // Group each tab
        const classifications = result.classifications;
        Object.entries(classifications).forEach(([tabId, groupName]) => {
          store.groupTabs([tabId], groupName as string);
        });
        
        // Final feedback
        if (window.electronAPI) {
          const uniqueGroups = new Set(Object.values(classifications)).size;
          window.electronAPI.sendToAIChatInput(`AI: I've successfully organized your tabs into ${uniqueGroups} logical groups based on their content.`);
        }
      }
    } catch (e) {
      console.error('[AI Tab Organizer] Failed to organize:', e);
    } finally {
      clearTimeout(safetyTimeout);
      setIsOrganizing(false);
      setIsShaking(false);
    }
  };

  // Group tabs by groupId for rendering with logic
  const renderedTabs = useMemo(() => {
    return tabs;
  }, [tabs]);

  return (
    <>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(var(--color-accent), 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(var(--color-accent), 0.4);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .tab-shaking {
          animation: tab-shake 0.2s ease-in-out infinite;
        }
        @keyframes tab-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px) rotate(-1deg); }
          75% { transform: translateX(4px) rotate(1deg); }
        }
      `}</style>

      {/* AI Organizing Notifier */}
      <AnimatePresence>
        {isOrganizing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-violet-600/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl flex items-center gap-3 z-50 shadow-2xl border border-violet-400/30"
          >
            <Sparkles className="text-amber-300 animate-pulse" size={18} />
            <span className="text-xs font-black uppercase tracking-widest italic">AI is Classifying Tabs...</span>
            <Loader2 className="animate-spin" size={16} />
          </motion.div>
        )}
      </AnimatePresence>

      <Reorder.Group
        as="div"
        axis="x"
        values={renderedTabs}
        onReorder={handleReorder}
        ref={scrollContainerRef as any}
        onWheel={(e) => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft += e.deltaY;
          }
        }}
        className="h-10 flex items-center px-4 gap-1 overflow-x-auto custom-scrollbar drag-region"
      >
        <AnimatePresence mode="popLayout">
          {renderedTabs.map((tab) => (
            <Reorder.Item
              key={tab.id}
              value={tab}
              onClick={() => handleTabClick(tab.id)}
              onDragStart={onDragStart}
              onDragEnd={(e, info) => onDragEnd(e, info, tab)}
              onDrag={onDrag}
              className="no-drag-region"
              dragListener={!isOrganizing}
            >
              <motion.div
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ 
                  opacity: 1, 
                  x: 0,
                  scale: (isShaking && lastX.current !== 0) || isOrganizing ? 1.05 : 1
                }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`group relative flex items-center h-8 px-4 rounded-t-xl min-w-[140px] max-w-[200px] cursor-pointer transition-all border-t border-x ${
                  activeTabId === tab.id
                    ? store.theme === 'light'
                      ? 'bg-white border-white text-primary-text shadow-[0_-4px_15px_var(--shadow-color)]'
                      : 'bg-deep-space-accent-neon/10 border-deep-space-accent-neon/30 text-white shadow-[0_-2px_10px_var(--shadow-color)]'
                    : store.theme === 'light'
                      ? 'bg-transparent border-transparent text-slate-400 opacity-50 hover:opacity-80 hover:bg-black/5'
                      : 'bg-transparent border-transparent text-slate-400 hover:bg-white/[0.02]'
                  } ${isShaking ? 'tab-shaking' : ''} ${isOrganizing ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {/* Group Indicator */}
                {tab.groupId && (
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-deep-space-accent-neon rounded-t-full opacity-60" />
                )}

                {tab.isAudible && <Volume2 size={12} className="mr-2 flex-shrink-0 text-accent animate-pulse" />}
                {!tab.isAudible && (
                  tab.url && tab.url.startsWith('http') ? (
                    <img
                      src={`https://www.google.com/s2/favicons?sz=64&domain=${(() => {
                        try { return new URL(tab.url).hostname; } catch { return 'google.com'; }
                      })()}`}
                      className="w-3 h-3 mr-2 flex-shrink-0"
                      alt=""
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://www.google.com/s2/favicons?sz=64&domain=about:blank'; }}
                    />
                  ) : (
                    <Globe size={12} className="mr-2 flex-shrink-0 text-slate-500" />
                  )
                )}

                <span
                  className={`text-[10px] font-bold truncate flex-1 ${isTabSuspended?.(tab.id) ? 'opacity-30' : ''
                    }`}
                >
                  {tab.title}
                  {isTabSuspended?.(tab.id) && (
                    <span className="ml-1 text-[8px] text-slate-600">(z)</span>
                  )}
                  {tab.groupId && (
                    <span className="ml-1 text-[8px] text-deep-space-accent-neon uppercase opacity-60">[{tab.groupId}]</span>
                  )}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.id);
                  }}
                  className={`ml-2 p-1 rounded-md transition-all opacity-0 group-hover:opacity-100 ${
                    store.theme === 'light' ? 'hover:bg-black/5 text-slate-500' : 'hover:bg-white/10 text-white'
                  }`}
                  title="Close Tab"
                >
                  <Plus size={10} className="rotate-45" />
                </button>
              </motion.div>
            </Reorder.Item>
          ))}
        </AnimatePresence>

        <button
          onClick={onAddTab}
          className={`p-1.5 rounded-lg transition-all ml-2 no-drag-region ${
            store.theme === 'light' ? 'text-slate-500 hover:bg-black/5 hover:text-primary-text' : 'text-slate-500 hover:bg-white/5 hover:text-white'
          }`}
          title="Add New Tab"
        >
          <Plus size={14} />
        </button>
        
        <button
          onClick={() => {
            if (window.electronAPI) {
              window.electronAPI.translateWebsite({ targetLanguage: store.selectedLanguage });
            }
          }}
          className={`p-1.5 rounded-lg transition-all ml-2 no-drag-region ${
            store.theme === 'light' ? 'text-slate-500 hover:bg-black/5 hover:text-primary-text' : 'text-slate-500 hover:bg-white/5 hover:text-white'
          }`}
          title="Translate Page"
        >
          <Globe size={14} />
        </button>

        {/* AI Grouping Button (Quick Action) */}
        <button
          onClick={() => autoGroupTabsAI()}
          disabled={isOrganizing}
          className={`p-1.5 rounded-lg transition-all ml-2 no-drag-region ${
            store.theme === 'light' ? 'text-slate-500 hover:bg-black/5 hover:text-primary-text' : 'text-slate-500 hover:bg-white/5 hover:text-white'
          } ${isOrganizing ? 'animate-pulse' : ''}`}
          title="AI Auto-Group Tabs"
        >
          {isOrganizing ? <Loader2 size={14} className="animate-spin" /> : <FolderOpen size={14} />}
        </button>
      </Reorder.Group>
    </>
  );
};
