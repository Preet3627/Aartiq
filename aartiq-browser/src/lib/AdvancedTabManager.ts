/**
 * Advanced Tab Manager
 * Handles multiple tabs, custom sounds, background execution, and tab prioritization
 * Includes shake-to-arrange functionality and tab grouping
 */

export interface TabConfig {
    id: string;
    url: string;
    title: string;
    favicon?: string;
    active: boolean;
    keepAliveInBackground: boolean;
    customSound?: {
        enabled: boolean;
        soundUrl?: string;
        volume: number;
        muteOtherTabs: boolean;
    };
    priority: 'high' | 'normal' | 'low';
    lastAccessed: number;
    memoryUsage?: number;
}

export interface TabGroup {
    id: string;
    name: string;
    color: string;
    tabs: string[];
    collapsed: boolean;
    autoCreated: boolean;
}

export interface ShakeGestureEvent {
    intensity: number;
    timestamp: number;
    axis: 'x' | 'y' | 'z';
}

export interface TabArrangementConfig {
    strategy: 'priority' | 'domain' | 'recent' | 'manual';
    groupByDomain: boolean;
    maxGroupSize: number;
}

export class ShakeToArrangeManager {
    private shakeHistory: ShakeGestureEvent[] = [];
    private shakeThreshold = 2.5;
    private lastShakeTime = 0;
    private shakeCooldown = 500;
    private isListening = false;
    private onShakeCallback: (() => void) | null = null;
    private motionHandler: ((event: DeviceMotionEvent) => void) | null = null;

    startListening(onShake: () => void): void {
        if (this.isListening) return;
        
        this.onShakeCallback = onShake;
        this.isListening = true;
        
        this.motionHandler = (event: DeviceMotionEvent) => {
            const acceleration = event.accelerationIncludingGravity;
            if (!acceleration) return;
            
            const intensity = Math.sqrt(
                (acceleration.x || 0) ** 2 + 
                (acceleration.y || 0) ** 2 + 
                (acceleration.z || 0) ** 2
            );
            
            if (intensity > this.shakeThreshold) {
                this.handleShake(intensity);
            }
        };
        
        window.addEventListener('devicemotion', this.motionHandler);
    }
    
    stopListening(): void {
        if (this.motionHandler) {
            window.removeEventListener('devicemotion', this.motionHandler);
            this.motionHandler = null;
        }
        this.isListening = false;
        this.onShakeCallback = null;
    }
    
    private handleShake(intensity: number): void {
        const now = Date.now();
        if (now - this.lastShakeTime < this.shakeCooldown) return;
        
        this.lastShakeTime = now;
        this.shakeHistory.push({
            intensity,
            timestamp: now,
            axis: this.getDominantAxis(intensity)
        });
        
        if (this.shakeHistory.length > 10) {
            this.shakeHistory.shift();
        }
        
        if (this.onShakeCallback) {
            this.onShakeCallback();
        }
    }
    
    private getDominantAxis(intensity: number): 'x' | 'y' | 'z' {
        return 'x';
    }
    
    getShakePattern(): ShakeGestureEvent[] {
        return [...this.shakeHistory];
    }
    
    clearShakeHistory(): void {
        this.shakeHistory = [];
    }
    
    isShakePattern(): boolean {
        if (this.shakeHistory.length < 3) return false;
        
        const recent = this.shakeHistory.slice(-3);
        const timeSpan = recent[2].timestamp - recent[0].timestamp;
        return timeSpan < 1000;
    }
}

export class TabArrangementEngine {
    private groups: Map<string, TabGroup> = new Map();
    private manualOrder: string[] = [];
    
    constructor(private tabManager: AdvancedTabManager) {}
    
    arrangeTabs(config: TabArrangementConfig): string[] {
        const tabs = this.tabManager.getAllTabs();
        
        switch (config.strategy) {
            case 'priority':
                return this.arrangeByPriority(tabs);
            case 'domain':
                return this.arrangeByDomain(tabs, config.groupByDomain);
            case 'recent':
                return this.arrangeByRecent(tabs);
            case 'manual':
                return this.arrangeManually(tabs);
            default:
                return tabs.map(t => t.id);
        }
    }
    
    private arrangeByPriority(tabs: TabConfig[]): string[] {
        return [...tabs].sort((a, b) => {
            const priorityOrder = { high: 0, normal: 1, low: 2 };
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0) return priorityDiff;
            return b.lastAccessed - a.lastAccessed;
        }).map(t => t.id);
    }
    
    private arrangeByDomain(tabs: TabConfig[], groupByDomain: boolean): string[] {
        const domainGroups = new Map<string, TabConfig[]>();
        
        for (const tab of tabs) {
            try {
                const url = new URL(tab.url);
                const domain = url.hostname.replace('www.', '');
                
                if (!domainGroups.has(domain)) {
                    domainGroups.set(domain, []);
                }
                domainGroups.get(domain)!.push(tab);
            } catch {
                if (!domainGroups.has('other')) {
                    domainGroups.set('other', []);
                }
                domainGroups.get('other')!.push(tab);
            }
        }
        
        const orderedTabs: TabConfig[] = [];
        for (const [, groupTabs] of domainGroups) {
            orderedTabs.push(...groupTabs.sort((a, b) => b.lastAccessed - a.lastAccessed));
        }
        
        return orderedTabs.map(t => t.id);
    }
    
    private arrangeByRecent(tabs: TabConfig[]): string[] {
        return [...tabs].sort((a, b) => b.lastAccessed - a.lastAccessed).map(t => t.id);
    }
    
    private arrangeManually(tabs: TabConfig[]): string[] {
        const tabIds = tabs.map(t => t.id);
        return this.manualOrder.length > 0 
            ? this.manualOrder.filter(id => tabIds.includes(id)).concat(tabIds.filter(id => !this.manualOrder.includes(id)))
            : tabIds;
    }
    
    createGroup(name: string, color: string, tabIds: string[]): TabGroup {
        const id = `group-${Date.now()}`;
        const group: TabGroup = {
            id,
            name,
            color,
            tabs: tabIds,
            collapsed: false,
            autoCreated: false
        };
        this.groups.set(id, group);
        return group;
    }
    
    autoCreateGroups(config: TabArrangementConfig): TabGroup[] {
        const tabs = this.tabManager.getAllTabs();
        this.groups.clear();
        const createdGroups: TabGroup[] = [];
        
        const domainGroups = new Map<string, TabConfig[]>();
        
        for (const tab of tabs) {
            try {
                const url = new URL(tab.url);
                const domain = url.hostname.replace('www.', '');
                
                if (!domainGroups.has(domain)) {
                    domainGroups.set(domain, []);
                }
                domainGroups.get(domain)!.push(tab);
            } catch {
                if (!domainGroups.has('other')) {
                    domainGroups.set('other', []);
                }
                domainGroups.get('other')!.push(tab);
            }
        }
        
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
        let colorIndex = 0;
        
        for (const [domain, groupTabs] of domainGroups) {
            if (groupTabs.length < 1) continue;
            if (config.maxGroupSize > 0 && groupTabs.length > config.maxGroupSize) continue;
            
            const group = this.createGroup(
                domain,
                colors[colorIndex % colors.length],
                groupTabs.map(t => t.id)
            );
            group.autoCreated = true;
            createdGroups.push(group);
            colorIndex++;
        }
        
        return createdGroups;
    }
    
    getGroup(id: string): TabGroup | undefined {
        return this.groups.get(id);
    }
    
    getAllGroups(): TabGroup[] {
        return Array.from(this.groups.values());
    }
    
    toggleGroupCollapse(groupId: string): boolean {
        const group = this.groups.get(groupId);
        if (group) {
            group.collapsed = !group.collapsed;
            return group.collapsed;
        }
        return false;
    }
    
    removeGroup(groupId: string): boolean {
        return this.groups.delete(groupId);
    }
    
    addTabToGroup(groupId: string, tabId: string): boolean {
        const group = this.groups.get(groupId);
        if (group && !group.tabs.includes(tabId)) {
            group.tabs.push(tabId);
            return true;
        }
        return false;
    }
    
    removeTabFromGroup(groupId: string, tabId: string): boolean {
        const group = this.groups.get(groupId);
        if (group) {
            const index = group.tabs.indexOf(tabId);
            if (index > -1) {
                group.tabs.splice(index, 1);
                return true;
            }
        }
        return false;
    }
    
    setManualOrder(order: string[]): void {
        this.manualOrder = order;
    }
}

export class AdvancedTabManager {
    private tabs: Map<string, TabConfig> = new Map();
    private activeTabId: string | null = null;
    private maxTabs: number = 50;
    private audioContexts: Map<string, AudioContext> = new Map();
    private shakeManager: ShakeToArrangeManager | null = null;
    private arrangementEngine: TabArrangementEngine | null = null;
    
    constructor() {
        if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
            this.shakeManager = new ShakeToArrangeManager();
            this.arrangementEngine = new TabArrangementEngine(this);
        }
    }
    
    enableShakeToArrange(onArrange: () => void): void {
        this.shakeManager?.startListening(onArrange);
    }
    
    disableShakeToArrange(): void {
        this.shakeManager?.stopListening();
    }
    
    arrangeTabs(config: TabArrangementConfig): string[] {
        return this.arrangementEngine?.arrangeTabs(config) || this.getAllTabs().map(t => t.id);
    }
    
    autoCreateTabGroups(config: TabArrangementConfig): TabGroup[] {
        return this.arrangementEngine?.autoCreateGroups(config) || [];
    }
    
    getTabGroups(): TabGroup[] {
        return this.arrangementEngine?.getAllGroups() || [];
    }
    
    toggleGroupCollapse(groupId: string): boolean {
        return this.arrangementEngine?.toggleGroupCollapse(groupId) || false;
    }
    
    removeGroup(groupId: string): boolean {
        return this.arrangementEngine?.removeGroup(groupId) || false;
    }

    createTab(url: string, config?: Partial<TabConfig>): string {
        if (this.tabs.size >= this.maxTabs) {
            this.closeLowPriorityTab();
        }

        const id = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const tab: TabConfig = {
            id,
            url,
            title: url,
            active: false,
            keepAliveInBackground: false,
            priority: 'normal',
            lastAccessed: Date.now(),
            customSound: {
                enabled: false,
                volume: 1.0,
                muteOtherTabs: false
            },
            ...config
        };

        this.tabs.set(id, tab);
        return id;
    }

    switchToTab(tabId: string): boolean {
        const tab = this.tabs.get(tabId);
        if (!tab) return false;

        if (this.activeTabId) {
            const currentTab = this.tabs.get(this.activeTabId);
            if (currentTab) {
                currentTab.active = false;
                if (!currentTab.keepAliveInBackground) {
                    this.pauseTab(this.activeTabId);
                }
            }
        }

        tab.active = true;
        tab.lastAccessed = Date.now();
        this.activeTabId = tabId;
        this.resumeTab(tabId);

        return true;
    }

    closeTab(tabId: string): boolean {
        const tab = this.tabs.get(tabId);
        if (!tab) return false;

        this.stopTabSound(tabId);
        this.audioContexts.delete(tabId);
        this.tabs.delete(tabId);

        if (this.activeTabId === tabId) {
            const remainingTabs = Array.from(this.tabs.values());
            if (remainingTabs.length > 0) {
                this.switchToTab(remainingTabs[0].id);
            } else {
                this.activeTabId = null;
            }
        }

        return true;
    }

    private closeLowPriorityTab(): void {
        const lowPriorityTabs = Array.from(this.tabs.values())
            .filter(tab => tab.priority === 'low' && !tab.active)
            .sort((a, b) => a.lastAccessed - b.lastAccessed);

        if (lowPriorityTabs.length > 0) {
            this.closeTab(lowPriorityTabs[0].id);
        } else {
            const normalTabs = Array.from(this.tabs.values())
                .filter(tab => tab.priority === 'normal' && !tab.active)
                .sort((a, b) => a.lastAccessed - b.lastAccessed);

            if (normalTabs.length > 0) {
                this.closeTab(normalTabs[0].id);
            }
        }
    }

    setTabSound(tabId: string, soundUrl: string, volume: number = 1.0, muteOthers: boolean = false): boolean {
        const tab = this.tabs.get(tabId);
        if (!tab) return false;

        tab.customSound = {
            enabled: true,
            soundUrl,
            volume: Math.max(0, Math.min(1, volume)),
            muteOtherTabs: muteOthers
        };

        this.tabs.set(tabId, tab);
        return true;
    }

    async playTabSound(tabId: string): Promise<boolean> {
        const tab = this.tabs.get(tabId);
        if (!tab || !tab.customSound?.enabled || !tab.customSound.soundUrl) {
            return false;
        }

        try {
            if (tab.customSound.muteOtherTabs) {
                this.muteAllTabsExcept(tabId);
            }

            let audioContext = this.audioContexts.get(tabId);
            if (!audioContext) {
                audioContext = new AudioContext();
                this.audioContexts.set(tabId, audioContext);
            }

            const response = await fetch(tab.customSound.soundUrl);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            const source = audioContext.createBufferSource();
            const gainNode = audioContext.createGain();

            source.buffer = audioBuffer;
            gainNode.gain.value = tab.customSound.volume;

            source.connect(gainNode);
            gainNode.connect(audioContext.destination);

            source.start(0);
            return true;
        } catch (error) {
            console.error('[Tab Sound] Failed to play:', error);
            return false;
        }
    }

    stopTabSound(tabId: string): void {
        const audioContext = this.audioContexts.get(tabId);
        if (audioContext) {
            audioContext.close();
            this.audioContexts.delete(tabId);
        }
    }

    private muteAllTabsExcept(exceptTabId: string): void {
        for (const [tabId, audioContext] of this.audioContexts.entries()) {
            if (tabId !== exceptTabId) {
                audioContext.suspend();
            }
        }
    }

    setKeepAlive(tabId: string, keepAlive: boolean): boolean {
        const tab = this.tabs.get(tabId);
        if (!tab) return false;

        tab.keepAliveInBackground = keepAlive;
        this.tabs.set(tabId, tab);
        return true;
    }

    setTabPriority(tabId: string, priority: 'high' | 'normal' | 'low'): boolean {
        const tab = this.tabs.get(tabId);
        if (!tab) return false;

        tab.priority = priority;
        this.tabs.set(tabId, tab);
        return true;
    }

    private pauseTab(tabId: string): void {
        this.stopTabSound(tabId);
        console.log(`[Tab Manager] Paused tab: ${tabId}`);
    }

    private resumeTab(tabId: string): void {
        const tab = this.tabs.get(tabId);
        if (tab?.customSound?.enabled) {
            this.playTabSound(tabId);
        }
        console.log(`[Tab Manager] Resumed tab: ${tabId}`);
    }

    getAllTabs(): TabConfig[] {
        return Array.from(this.tabs.values()).sort((a, b) => b.lastAccessed - a.lastAccessed);
    }

    getActiveTab(): TabConfig | null {
        return this.activeTabId ? this.tabs.get(this.activeTabId) || null : null;
    }

    getBackgroundTabs(): TabConfig[] {
        return Array.from(this.tabs.values()).filter(tab => !tab.active);
    }

    getTabsByPriority(priority: 'high' | 'normal' | 'low'): TabConfig[] {
        return Array.from(this.tabs.values()).filter(tab => tab.priority === priority);
    }

    updateTabTitle(tabId: string, title: string): boolean {
        const tab = this.tabs.get(tabId);
        if (!tab) return false;

        tab.title = title;
        this.tabs.set(tabId, tab);
        return true;
    }

    updateTabFavicon(tabId: string, favicon: string): boolean {
        const tab = this.tabs.get(tabId);
        if (!tab) return false;

        tab.favicon = favicon;
        this.tabs.set(tabId, tab);
        return true;
    }

    getTabCount(): number {
        return this.tabs.size;
    }

    setMaxTabs(max: number): void {
        this.maxTabs = Math.max(1, Math.min(100, max));
    }

    closeOtherTabs(): number {
        const activeId = this.activeTabId;
        let closed = 0;

        for (const [tabId] of this.tabs.entries()) {
            if (tabId !== activeId) {
                this.closeTab(tabId);
                closed++;
            }
        }

        return closed;
    }

    closeTabsByPriority(priority: 'high' | 'normal' | 'low'): number {
        const tabsToClose = this.getTabsByPriority(priority);
        let closed = 0;

        for (const tab of tabsToClose) {
            if (!tab.active) {
                this.closeTab(tab.id);
                closed++;
            }
        }

        return closed;
    }

    getMemoryUsage(): { total: number; perTab: Map<string, number> } {
        const perTab = new Map<string, number>();
        let total = 0;

        for (const [tabId, tab] of this.tabs.entries()) {
            const usage = tab.memoryUsage || 50;
            perTab.set(tabId, usage);
            total += usage;
        }

        return { total, perTab };
    }

    optimizeMemory(targetMB: number): number {
        const { total } = this.getMemoryUsage();
        if (total <= targetMB) return 0;

        let freed = 0;
        const lowPriorityTabs = this.getTabsByPriority('low')
            .filter(tab => !tab.active)
            .sort((a, b) => a.lastAccessed - b.lastAccessed);

        for (const tab of lowPriorityTabs) {
            if (total - freed <= targetMB) break;
            this.closeTab(tab.id);
            freed += tab.memoryUsage || 50;
        }

        return freed;
    }
}

let tabManagerInstance: AdvancedTabManager | null = null;

export function getTabManager(): AdvancedTabManager {
    if (!tabManagerInstance) {
        tabManagerInstance = new AdvancedTabManager();
    }
    return tabManagerInstance;
}
