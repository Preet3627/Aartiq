import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Security } from '@/lib/Security';
import { defaultShortcuts, Shortcut } from '@/lib/constants';
import firebaseService from '@/lib/FirebaseService';
import { GoogleAuthProvider } from 'firebase/auth';
import { MODEL_REGISTRY } from '@/lib/modelRegistry';

// ... (rest of the interfaces are the same)

export interface BrowserState {
    // URL and navigation
    currentUrl: string;
    defaultUrl: string;
    setDefaultUrl: (url: string) => void;

    tabs: Array<{
        id: string;
        url: string;
        title: string;
        isIncognito?: boolean;
        isAudible?: boolean;
        isLoading?: boolean;
        lastAccessed?: number;
        isSuspended?: boolean;
        priority?: 'low' | 'normal' | 'high';
        keepAlive?: boolean;
        groupId?: string;
    }>;
    activeTabId: string;
    addTab: (url?: string, groupId?: string) => void;
    addIncognitoTab: (url?: string) => void;
    removeTab: (id: string) => void;
    closeTabGroup: (groupId: string) => void;
    updateTab: (id: string, updates: Partial<{ url: string; title: string; isAudible?: boolean; isLoading?: boolean; isSuspended?: boolean; priority?: 'low' | 'normal' | 'high'; keepAlive?: boolean }>) => void;
    suspendTab: (id: string) => void;
    resumeTab: (id: string) => void;
    setTabs: (tabs: BrowserState['tabs']) => void;
    setCurrentUrl: (url: string) => void;
    setActiveTabId: (id: string) => void;
    setActiveTab: (id: string) => void; // Alias for setActiveTabId
    reorderTabs: (startIndex: number, endIndex: number) => void;
    groupTabs: (tabIds: string[], groupName: string) => void;

    // Performance Mode
    performanceMode: 'normal' | 'performance';
    performanceModeSettings: {
        maxActiveTabs: number;
        maxRam: number; // in MB
        keepAudioTabsActive: boolean;
    };
    setPerformanceMode: (mode: 'normal' | 'performance') => void;
    updatePerformanceModeSettings: (settings: Partial<BrowserState['performanceModeSettings']>) => void;

    // History and clipboard
    history: Array<{ url: string; title: string; timestamp: number }>;
    clipboard: string[];
    setHistory: (history: Array<{ url: string; title: string; timestamp: number }>) => void;
    fetchHistory: () => void;
    addToHistory: (entry: { url: string; title: string }) => void;
    updateHistoryTitle: (url: string, title: string) => void;
    savePageOffline: (url: string, title: string, html: string) => void;
    addToUnifiedCart: (item: any) => void;
    addClipboardItem: (item: string) => void;
    clearClipboard: () => void;

    // User and auth
    user: { uid: string; email: string; displayName: string; photoURL: string; activeTime?: number } | null;
    userEmail: string;
    isAdmin: boolean;
    localPhotoURL: string | null;
    setUser: (user: { uid: string; email: string; displayName: string; photoURL: string } | null) => void;
    setLocalPhotoURL: (url: string | null) => void;
    setAdmin: (isAdmin: boolean) => void;
    authToken: string | null;
    githubToken: string | null;
    setAuthToken: (token: string | null) => void;
    setGithubToken: (token: string | null) => void;
    loginWithToken: (token: string) => void;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    fetchAppConfig: () => Promise<void>;

    // View and UI
    activeView: string;
    settingsSection: string;
    setActiveView: (view: string) => void;
    setSettingsSection: (section: string) => void;

    // Guest mode and sync
    isGuestMode: boolean;
    cloudSyncConsent: boolean | null;
    syncPassphrase: string | undefined;
    setGuestMode: (isGuest: boolean) => void;
    setCloudSyncConsent: (consent: boolean) => void;
    setSyncPassphrase: (passphrase: string) => void;

    // AI settings
    enableAIAssist: boolean;
    openaiApiKey: string;
    azureOpenaiApiKey: string;
    azureOpenaiEndpoint: string;
    geminiApiKey: string;
    aiProvider: string;
    ollamaBaseUrl: string;
    ollamaModel: string;
    anthropicApiKey: string;
    groqApiKey: string;
    setEnableAIAssist: (enable: boolean) => void;
    setOpenaiApiKey: (key: string) => void;
    openaiModel: string;
    setOpenaiModel: (model: string) => void;
    azureOpenaiModel: string;
    setAzureOpenaiApiKey: (key: string) => void;
    setAzureOpenaiEndpoint: (endpoint: string) => void;
    setAzureOpenaiModel: (model: string) => void;
    setGeminiApiKey: (key: string) => void;
    geminiModel: string;
    setGeminiModel: (model: string) => void;
    geminiFlashModel: string;
    setGeminiFlashModel: (model: string) => void;
    autoGeminiModelUpdates: boolean;
    setAutoGeminiModelUpdates: (enabled: boolean) => void;
    setAnthropicApiKey: (key: string) => void;
    setAnthropicModel: (model: string) => void;
    anthropicModel: string;
    setGroqApiKey: (key: string) => void;
    setGroqModel: (model: string) => void;
    groqModel: string;
    xaiApiKey: string;
    setXaiApiKey: (key: string) => void;
    xaiModel: string;
    setXaiModel: (model: string) => void;
    setAIProvider: (provider: string) => void;
    setOllamaBaseUrl: (url: string) => void;
    setOllamaModel: (model: string) => void;
    localLLMBaseUrl: string;
    localLLMModel: string;
    localLlmMode: 'light' | 'normal' | 'heavy';
    setLocalLLMBaseUrl: (url: string) => void;
    setLocalLLMModel: (model: string) => void;
    setLocalLlmMode: (mode: 'light' | 'normal' | 'heavy') => void;

    // AI Overview
    enableAiOverview: boolean;
    setEnableAiOverview: (enable: boolean) => void;

    // AI Permission
    askForAiPermission: boolean;
    setAskForAiPermission: (val: boolean) => void;
    showAiMistakeWarning: boolean;
    setShowAiMistakeWarning: (val: boolean) => void;
    hasSeenAiMistakeWarning: boolean;
    setHasSeenAiMistakeWarning: (val: boolean) => void;
    mcpServerPort: number;
    setMcpServerPort: (port: number) => void;
    mcpServers: Array<{ id: string; name: string; url?: string; status: 'online' | 'offline' | 'connecting'; type?: 'sse' | 'stdio'; command?: string; args?: string[]; env?: Record<string, string>; tools?: any[] }>;
    addMcpServer: (server: { name: string; url?: string; type?: 'sse' | 'stdio'; command?: string; args?: string[]; env?: Record<string, string> }) => Promise<void>;
    removeMcpServer: (id: string) => Promise<void>;
    syncMcpServers: () => Promise<void>;
    updateMcpServerStatus: (id: string, status: 'online' | 'offline' | 'connecting') => void;
    updateMcpServerTools: (id: string, tools: any[]) => void;
    additionalAIInstructions: string;
    setAdditionalAIInstructions: (instructions: string) => void;
    hasSeenNeuralSetup: boolean;
    setHasSeenNeuralSetup: (seen: boolean) => void;

    // AI Safety
    aiSafetyMode: boolean; // If true, AI asks for confirmation before critical actions
    setAiSafetyMode: (enabled: boolean) => void;

    // Theme settings
    theme: "system" | "dark" | "light" | "vibrant" | "custom";
    customThemePrimary: string;
    customThemeSecondary: string;
    setTheme: (theme: "system" | "dark" | "light" | "vibrant" | "custom") => void;
    setCustomThemePrimary: (color: string) => void;
    setCustomThemeSecondary: (color: string) => void;

    // Online status
    isOnline: boolean;
    setIsOnline: (online: boolean) => void;

    // Active time tracking
    activeStartTime: number | null;
    startActiveSession: () => void;
    updateActiveTime: () => void;

    // Tab navigation
    nextTab: () => void;
    prevTab: () => void;

    // Sidebar
    sidebarOpen: boolean;
    sidebarWidth: number;
    sidebarSide: "left" | "right";
    isSidebarCollapsed: boolean;
    toggleSidebar: () => void;
    toggleSidebarCollapse: () => void;
    setSidebarSide: (side: "left" | "right") => void;
    setSidebarWidth: (width: number) => void;
    macNativeSidebarMode: 'electron' | 'swiftui';
    macNativeActionChainMode: 'electron' | 'swiftui';
    macNativeUtilityPanelMode: 'electron' | 'swiftui';
    macNativePermissionMode: 'electron' | 'swiftui';
    macNativeSidebarAutoMinimize: boolean;
    setMacNativeSidebarMode: (mode: 'electron' | 'swiftui') => void;
    setMacNativeActionChainMode: (mode: 'electron' | 'swiftui') => void;
    setMacNativeUtilityPanelMode: (mode: 'electron' | 'swiftui') => void;
    setMacNativePermissionMode: (mode: 'electron' | 'swiftui') => void;
    setMacNativeSidebarAutoMinimize: (enabled: boolean) => void;
    applyMacNativeUiPreferences: (preferences: Partial<Pick<BrowserState, 'macNativeSidebarMode' | 'macNativeActionChainMode' | 'macNativeUtilityPanelMode' | 'macNativePermissionMode' | 'macNativeSidebarAutoMinimize'>>) => void;

    // Student mode
    studentMode: boolean;
    setStudentMode: (student: boolean) => void;

    // Coding mode
    isCodingMode: boolean;
    setCodingMode: (coding: boolean) => void;

    // Vibrant mode
    isVibrant: boolean;

    // Site warnings
    showSiteWarnings: boolean;

    // Unified cart
    unifiedCart: Array<{ id: string; item: string; site: string; price: string; }>;
    removeFromCart: (itemId: string) => void;
    ambientMusicUrl: string;
    enableAmbientMusic: boolean;
    ambientMusicMode: 'always' | 'idle' | 'google' | 'off';
    ambientMusicVolume: number;
    setAmbientMusicUrl: (url: string) => void;
    setEnableAmbientMusic: (enable: boolean) => void;
    setAmbientMusicMode: (mode: 'always' | 'idle' | 'google' | 'off') => void;
    setAmbientMusicVolume: (volume: number) => void;

    // Search and bookmarks
    selectedEngine: string;
    setSelectedEngine: (engine: string) => void;
    bookmarks: Array<{ id: string; url: string; title: string }>;
    addBookmark: (bookmark: { url: string; title: string }) => void;
    removeBookmark: (url: string) => void;

    // Passwords and autofill
    passwords: Array<{ url: string; username: string; password: string }>;
    addresses: Array<{ id: string; name: string; address: string; street: string; city: string; zip: string; country: string }>;
    paymentMethods: Array<{ id: string; name: string; cardNumber: string; expiry: string; cvc: string }>;
    addAddress: (address: Omit<BrowserState['addresses'][0], 'id'>) => void;
    removeAddress: (id: string) => void;
    addPaymentMethod: (method: Omit<BrowserState['paymentMethods'][0], 'id'>) => void;
    removePaymentMethod: (id: string) => void;

    // Settings
    shortcuts: Array<{ action: string; accelerator: string }>;
    updateShortcut: (action: string, accelerator: string) => void;
    hasSeenWelcomePage: boolean;
    setHasSeenWelcomePage: (seen: boolean) => void;
    hasCompletedStartupSetup: boolean;
    setHasCompletedStartupSetup: (completed: boolean) => void;
    appName: string;
    backendStrategy: 'firebase' | 'mysql';
    customFirebaseConfig: any | null;
    customMysqlConfig: any | null;
    setBackendStrategy: (strategy: 'firebase' | 'mysql') => void;
    setCustomFirebaseConfig: (config: any | null) => void;
    setCustomMysqlConfig: (config: any | null) => void;

    // Firewall and Security
    firewallLevel: 'standard' | 'strict' | 'paranoid';
    setFirewallLevel: (level: 'standard' | 'strict' | 'paranoid') => void;

    // Language and Translation
    selectedLanguage: string;
    setSelectedLanguage: (lang: string) => void;
    availableLanguages: string[];

    // Ollama Management
    ollamaModelsList: Array<{ name: string; size?: number; details?: any }>;
    setOllamaModelsList: (models: any[]) => void;

    // Offline Reading
    offlineReadingList: Array<{ url: string; title: string; html: string; timestamp: number }>;
    addOfflinePage: (page: { url: string; title: string; html: string }) => void;

    // Logout
    logout: () => void;

    // Adblocker
    enableAdblocker: boolean;
    setEnableAdblocker: (enable: boolean) => void;

    // Top Bar Icon Visibility
    showDownloadsIcon: boolean;
    showClipboardIcon: boolean;
    showCartIcon: boolean;
    showTranslateIcon: boolean;
    showExtensionsIcon: boolean;
    setShowDownloadsIcon: (show: boolean) => void;
    setShowClipboardIcon: (show: boolean) => void;
    setShowCartIcon: (show: boolean) => void;
    setShowTranslateIcon: (show: boolean) => void;
    setShowExtensionsIcon: (show: boolean) => void;

    // Advanced Theme customization
    themeOpacity: number;
    themeBlur: number;
    setThemeOpacity: (opacity: number) => void;
    setThemeBlur: (blur: number) => void;

    openMcpSettings: () => void;
    clearHistory: () => void;
}

export const useAppStore = create<BrowserState>()(
    persist(
       (set, get) => ({
            // URL and navigation
            currentUrl: 'https://www.google.com',
            defaultUrl: 'https://www.google.com',

            // Tabs
            tabs: [{ id: 'default', url: 'https://www.google.com', title: 'New Tab', isLoading: false }],
            activeTabId: 'default',

            // History and clipboard
           history: [] as BrowserState['history'],
           clipboard: [] as BrowserState['clipboard'],
            // User and auth
            user: null,
            userEmail: '',
            isAdmin: false,
            localPhotoURL: null,
            authToken: null,
            setLocalPhotoURL: (url: string | null) => set({ localPhotoURL: url }),
            githubToken: null,
            clientId: '',
            clientSecret: '',
            redirectUri: '',
            fetchAppConfig: async () => {
                // Initialize with safe defaults immediately in case fetch fails
                const defaults = {
                    clientId: '601898745585-8g9t0k72gq4q1a4s1o4d1t6t7e5v4c4g.apps.googleusercontent.com',
                    clientSecret: '',
                    redirectUri: 'https://browser.ponsrischool.in/oauth2callback'
                };
                
                try {
                    const res = await fetch('https://browser.ponsrischool.in/api/config', {
                        headers: {
                            'X-Comet-App-Token': 'comet-secure-v1' // Same token as landing page
                        },
                        signal: AbortSignal.timeout(5000) // Don't hang forever
                    });
                    
                    if (res.ok) {
                        const config = await res.json();
                        const update = {
                            clientId: config.googleClientId || defaults.clientId,
                            clientSecret: config.googleClientSecret || defaults.clientSecret,
                            redirectUri: config.googleRedirectUri || defaults.redirectUri
                        };
                        set({
                            ...update,
                            customFirebaseConfig: config.firebaseConfig || null
                        });
                        if (window.electronAPI) window.electronAPI.saveGoogleConfig(update);
                        console.log('App config synced and persisted:', config);
                    } else {
                        // Fallback to local persistence if server is reachable but errors
                        set(defaults);
                    }
                } catch (e) {
                    console.warn('Network sync for app config failed, using secure defaults:', e);
                    // Critical: ensures no crash on network failure
                    set(defaults);
                }
            },

            // View and UI
            activeView: 'browser',
            settingsSection: 'profile',
            setSettingsSection: (section: string) => set({ settingsSection: section }),

            // Guest mode and sync
            isGuestMode: false,
            cloudSyncConsent: null,
            syncPassphrase: undefined,

            // AI settings
            enableAIAssist: false,
            openaiApiKey: '',
            openaiModel: 'gpt-5.1',
            azureOpenaiApiKey: '',
            azureOpenaiEndpoint: '',
            azureOpenaiModel: 'gpt-4.1-mini',
            geminiApiKey: '',
            geminiModel: MODEL_REGISTRY.google.pro.id,
            geminiFlashModel: MODEL_REGISTRY.google.flash.id,
            anthropicApiKey: '',
            anthropicModel: 'claude-sonnet-4-20250514',
            groqApiKey: '',
            groqModel: 'llama-3.3-70b-versatile',
            xaiApiKey: '',
            xaiModel: 'grok-4-fast-reasoning',
            aiProvider: 'ollama',
            ollamaBaseUrl: 'http://127.0.0.1:11434',
            ollamaModel: 'deepseek-r1:1.5b',
            localLLMBaseUrl: '',
            localLLMModel: '',
            localLlmMode: 'normal',
            autoGeminiModelUpdates: true,

            // AI Overview
            enableAiOverview: false,
            setEnableAiOverview: (enable: boolean) => set({ enableAiOverview: enable }),

            mcpServerPort: 3001,
            additionalAIInstructions: '',
            hasSeenNeuralSetup: false,
            setHasSeenNeuralSetup: (seen: boolean) => {
                const prev = get().hasSeenNeuralSetup;
                if (prev === seen) return; // Skip if already the same value
                set({ hasSeenNeuralSetup: seen });
                if (typeof window !== 'undefined' && window.electronAPI?.setOnboardingState) {
                    void window.electronAPI.setOnboardingState({ hasSeenNeuralSetup: seen });
                }
            },
 
            // Theme settings
            theme: 'system',
            customThemePrimary: '#ff6b6b',
            customThemeSecondary: '#22d3ee',
            ambientMusicUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            enableAmbientMusic: false,
            ambientMusicMode: 'off',
            ambientMusicVolume: 0.5,
            setAmbientMusicUrl: (url: string) => set({ ambientMusicUrl: url }),
            setEnableAmbientMusic: (enable: boolean) => set({ enableAmbientMusic: enable }),
            setAmbientMusicMode: (mode: 'always' | 'idle' | 'google' | 'off') => set({ ambientMusicMode: mode }),
            setAmbientMusicVolume: (volume: number) => set({ ambientMusicVolume: volume }),

            // Online status
            isOnline: true,

            // Active time tracking
            activeStartTime: null,

            // Sidebar
            sidebarOpen: true,
            sidebarWidth: 280,
            sidebarSide: "left",
            isSidebarCollapsed: false,
            macNativeSidebarMode: 'electron',
            macNativeActionChainMode: 'electron',
            macNativeUtilityPanelMode: 'electron',
            macNativePermissionMode: 'electron',
            macNativeSidebarAutoMinimize: false,

            // Student mode
            studentMode: false,

            // Coding mode
            isCodingMode: false,

            // Vibrant mode
            isVibrant: false,

            // New states
            firewallLevel: 'standard',
            setFirewallLevel: (level: 'standard' | 'strict' | 'paranoid') => set({ firewallLevel: level }),

            selectedLanguage: 'en',
            setSelectedLanguage: (lang: string) => set({ selectedLanguage: lang }),
            availableLanguages: [
                'en', 'hi', 'bn', 'te', 'mr', 'ta', 'gu', 'ur', 'kn', 'or', 'ml', 'pa', 'as', 'mai', 'sat', 'ks', 'ne', 'kok', 'sd', 'doi', 'mni', 'sa', 'brx', // Indian
                'es', 'fr', 'de', 'ja', 'zh', 'ru', 'pt', 'it', 'ko', 'ar', 'tr', 'vi', 'th', 'nl', 'pl' // World
            ],

            ollamaModelsList: [],
            setOllamaModelsList: (models: any[]) => set({ ollamaModelsList: models }),

            offlineReadingList: [],
            addOfflinePage: (page: { url: string; title: string; html: string }) => set((state: BrowserState) => ({
                offlineReadingList: [...state.offlineReadingList, { ...page, timestamp: Date.now() }]
            })),


            // Site warnings
            showSiteWarnings: true,

            // Unified cart
            unifiedCart: [],

            // Search and bookmarks
            selectedEngine: 'google',
            bookmarks: [],

            // Passwords and autofill
            passwords: [],
            addresses: [],
            paymentMethods: [],

            // Settings
            shortcuts: defaultShortcuts,
            hasSeenWelcomePage: true,
            hasCompletedStartupSetup: true,
            appName: 'Comet',
            backendStrategy: 'firebase',
            customFirebaseConfig: null,
            customMysqlConfig: null,

            // Adblocker
            enableAdblocker: false,
            setEnableAdblocker: (enable: boolean) => {
                set({ enableAdblocker: enable });
                if (window.electronAPI) {
                    window.electronAPI.toggleAdblocker(enable);
                }
            },

            // Top Bar Icon Visibility
            showDownloadsIcon: true,
            showClipboardIcon: true,
            showCartIcon: true,
            showTranslateIcon: true,
            showExtensionsIcon: true,
            setShowDownloadsIcon: (show: boolean) => set({ showDownloadsIcon: show }),
            setShowClipboardIcon: (show: boolean) => set({ showClipboardIcon: show }),
            setShowCartIcon: (show: boolean) => set({ showCartIcon: show }),
            setShowTranslateIcon: (show: boolean) => set({ showTranslateIcon: show }),
            setShowExtensionsIcon: (show: boolean) => set({ showExtensionsIcon: show }),

            // Advanced Theme customization
            themeOpacity: 100,
            themeBlur: 20,
            setThemeOpacity: (opacity: number) => set({ themeOpacity: opacity }),
            setThemeBlur: (blur: number) => set({ themeBlur: blur }),

            // Performance Mode
            performanceMode: 'normal',
            performanceModeSettings: {
                maxActiveTabs: 5,
                maxRam: 2048, // 2GB
                keepAudioTabsActive: true,
            },

            // MCP Servers
            mcpServers: [],
            addMcpServer: async (server: { name: string; url?: string; type?: 'sse' | 'stdio'; command?: string; args?: string[]; env?: Record<string, string> }) => {
                const id = `mcp-${Date.now()}`;
                const serverConfig = { ...server, id };
                if (window.electronAPI) {
                    set((state: BrowserState) => ({
                        mcpServers: [...state.mcpServers, { ...serverConfig, status: 'connecting' as const }]
                    }));
                    const res = await window.electronAPI.mcpConnectServer(serverConfig);
                    set((state: BrowserState) => ({
                        mcpServers: state.mcpServers.map(s => s.id === id ? { ...s, status: res.success ? 'online' : 'offline' } : s)
                    }));
                } else {
                    set((state: BrowserState) => ({
                        mcpServers: [...state.mcpServers, { ...serverConfig, status: 'online' as const }]
                    }));
                }
            },
            removeMcpServer: async (id: string) => {
                if (window.electronAPI) {
                    await window.electronAPI.mcpDisconnectServer(id);
                }
                set((state: BrowserState) => ({
                    mcpServers: state.mcpServers.filter(s => s.id !== id)
                }));
            },
            updateMcpServerStatus: (id: string, status: 'online' | 'offline' | 'connecting') => set((state: BrowserState) => ({
                mcpServers: state.mcpServers.map(s => s.id === id ? { ...s, status } : s)
            })),
            updateMcpServerTools: (id: string, tools: any[]) => set((state: BrowserState) => ({
                mcpServers: state.mcpServers.map(s => s.id === id ? { ...s, tools } : s)
            })),
            syncMcpServers: async () => {
                if (window.electronAPI) {
                    const res = await window.electronAPI.mcpListServers();
                    if (res && res.success) {
                        set({ mcpServers: res.servers });
                    }
                }
            },

            openMcpSettings: () => {
                set({ activeView: 'settings', settingsSection: 'mcp' });
            },

            closeTabGroup: (groupId: string) => {
                const state = get();
                const tabsToRemove = state.tabs.filter(t => t.groupId === groupId);
                tabsToRemove.forEach(t => {
                    const id = t.id;
                    if (window.electronAPI) window.electronAPI.destroyView(id);
                });
                set((state: BrowserState) => {
                    const newTabs = state.tabs.filter(t => t.groupId !== groupId);
                    if (newTabs.length === 0) {
                        const defaultId = 'default';
                        const defaultUrl = state.defaultUrl || 'https://www.google.com';
                        if (window.electronAPI) window.electronAPI.createView({ tabId: defaultId, url: defaultUrl });
                        return {
                            tabs: [{ id: defaultId, url: defaultUrl, title: 'New Tab', isLoading: false }],
                            activeTabId: defaultId,
                            currentUrl: defaultUrl
                        };
                    }
                    // If active tab was in group, switch to last remaining tab
                    let newActiveId = state.activeTabId;
                    if (tabsToRemove.some(t => t.id === state.activeTabId)) {
                        newActiveId = newTabs[newTabs.length - 1].id;
                    }
                    return {
                        tabs: newTabs,
                        activeTabId: newActiveId,
                        currentUrl: newTabs.find(t => t.id === newActiveId)?.url || state.currentUrl
                    };
                });
            },

            // URL and navigation
            setDefaultUrl: (url: string) => set({ defaultUrl: url }),
            setCurrentUrl: (url: string) => set({ currentUrl: url }),

            // Tabs
            setActiveTabId: (id: string) => {
                const state = get();
                if (id === state.activeTabId) return;

                const now = Date.now();
                const lastAccessed = state.tabs.find(t => t.id === id)?.lastAccessed || 0;
                if (now - lastAccessed < 300) return;

                set((state) => {
                    const newTab = state.tabs.find(t => t.id === id);
                    return {
                        activeTabId: id,
                        currentUrl: newTab?.url || state.currentUrl,
                        tabs: state.tabs.map(t => t.id === id ? { ...t, lastAccessed: now, isSuspended: false } : t)
                    };
                });
            },
            setActiveTab: (id: string) => get().setActiveTabId(id),
            updateTab: (id: string, updates: any) => set((state: BrowserState) => ({
                tabs: state.tabs.map(tab =>
                    tab.id === id ? { ...tab, ...updates } : tab
                )
            })),
            suspendTab: (id: string) => set((state: BrowserState) => ({
                tabs: state.tabs.map(tab =>
                    tab.id === id ? { ...tab, isSuspended: true } : tab
                )
            })),
            resumeTab: (id: string) => set((state: BrowserState) => ({
                tabs: state.tabs.map(tab =>
                    tab.id === id ? { ...tab, isSuspended: false } : tab
                )
            })),
            reorderTabs: (startIndex: number, endIndex: number) => set((state: BrowserState) => {
                const newTabs = [...state.tabs];
                const [removed] = newTabs.splice(startIndex, 1);
                newTabs.splice(endIndex, 0, removed);
                return { tabs: newTabs };
            }),
            groupTabs: (tabIds: string[], groupName: string) => set((state: BrowserState) => ({
                tabs: state.tabs.map(tab =>
                    tabIds.includes(tab.id) ? { ...tab, groupId: groupName } : tab
                )
            })),
            setTabs: (tabs: BrowserState['tabs']) => set({ tabs }),

            // Performance Mode
            setPerformanceMode: (mode: 'normal' | 'performance') => set({ performanceMode: mode }),
            updatePerformanceModeSettings: (settings: any) => set((state: BrowserState) => ({
                performanceModeSettings: { ...state.performanceModeSettings, ...settings }
            })),

            // History and clipboard
            setHistory: (history: any[]) => set({ history }),
            fetchHistory: () => {
                // This would be where you fetch history from a backend
                // For now, it does nothing
            },
            addToHistory: (entry: any) => set((state: BrowserState) => ({
                history: [...state.history, { ...entry, timestamp: Date.now() }]
            })),
            updateHistoryTitle: (url: string, title: string) => set((state: BrowserState) => {
                const newHistory = [...state.history];
                // Find the latest entry with this URL and update its title
                for (let i = newHistory.length - 1; i >= 0; i--) {
                    if (newHistory[i].url === url) {
                        newHistory[i].title = title;
                        break;
                    }
                }
                return { history: newHistory };
            }),
            savePageOffline: (url: string, title: string, html: string) => {
                console.log('Saving page offline:', url, title);
            },
            addToUnifiedCart: (item: any) => {
                console.log('Adding to unified cart:', item);
            },
            addClipboardItem: (item: string) => set((state: BrowserState) => {
                const newClipboard = [item, ...state.clipboard.filter(i => i !== item)].slice(0, 50);
                return { clipboard: newClipboard };
            }),
            clearClipboard: () => set({ clipboard: [] }),
            clearHistory: () => set({ history: [] }),

            // User and auth
            setUser: (user: any) => set({ user, isAdmin: user?.email === 'preetjgfilj2@gmail.com' }),
            setUserEmail: (email: string) => set({ userEmail: email }),
            setAdmin: (isAdmin: boolean) => set({ isAdmin }),
            setAuthToken: (token: string | null) => set({ authToken: token }),
            setGithubToken: (token: string | null) => set({ githubToken: token }),
            loginWithToken: (token: string) => {
                set({ authToken: token });
                const credential = GoogleAuthProvider.credential(token);
                firebaseService.signInWithCredential(credential).catch((error) => {
                    console.error("Token sign-in error:", error);
                });
            },


            // View and UI
            setActiveView: (view: string) => set({ activeView: view }),

            // AI settings
            setEnableAIAssist: (enable: boolean) => set({ enableAIAssist: enable }),
            setOpenaiApiKey: (key: string) => {
                set({ openaiApiKey: key });
                if (window.electronAPI) {
                    window.electronAPI.savePersistentData('openai_api_key', key);
                    window.electronAPI.configureLLMProvider('openai', { apiKey: key });
                }
            },
            setOpenaiModel: (model: string) => {
                set({ openaiModel: model });
                if (window.electronAPI) {
                    window.electronAPI.configureLLMProvider('openai', { model });
                }
            },
            setAzureOpenaiApiKey: (key: string) => {
                set({ azureOpenaiApiKey: key });
                if (window.electronAPI) {
                    window.electronAPI.savePersistentData('azure_openai_api_key', key);
                    window.electronAPI.configureLLMProvider('azure-openai', { apiKey: key });
                }
            },
            setAzureOpenaiEndpoint: (endpoint: string) => {
                set({ azureOpenaiEndpoint: endpoint });
                if (window.electronAPI) {
                    window.electronAPI.savePersistentData('azure_openai_endpoint', endpoint);
                    window.electronAPI.configureLLMProvider('azure-openai', { baseUrl: endpoint });
                }
            },
            setAzureOpenaiModel: (model: string) => {
                set({ azureOpenaiModel: model });
                if (window.electronAPI) {
                    window.electronAPI.configureLLMProvider('azure-openai', { model });
                }
            },
            setGeminiApiKey: (key: string) => {
                set({ geminiApiKey: key });
                if (window.electronAPI) {
                    window.electronAPI.savePersistentData('gemini_api_key', key);
                    window.electronAPI.configureLLMProvider('google', { apiKey: key });
                }
            },
            setGeminiModel: (model: string) => {
                set({ geminiModel: model });
                if (window.electronAPI) {
                    window.electronAPI.configureLLMProvider('google', { model });
                }
            },
            setGeminiFlashModel: (model: string) => {
                set({ geminiFlashModel: model });
                if (window.electronAPI) {
                    window.electronAPI.configureLLMProvider('google-flash', { model });
                }
            },
            setAutoGeminiModelUpdates: (enabled: boolean) => set({ autoGeminiModelUpdates: enabled }),
            setAnthropicApiKey: (key: string) => {
                set({ anthropicApiKey: key });
                if (window.electronAPI) {
                    window.electronAPI.savePersistentData('anthropic_api_key', key);
                    window.electronAPI.configureLLMProvider('anthropic', { apiKey: key });
                }
            },
            setAnthropicModel: (model: string) => {
                set({ anthropicModel: model });
                if (window.electronAPI) {
                    window.electronAPI.configureLLMProvider('anthropic', { model });
                }
            },
            setGroqApiKey: (key: string) => {
                set({ groqApiKey: key });
                if (window.electronAPI) {
                    window.electronAPI.savePersistentData('groq_api_key', key);
                    window.electronAPI.configureLLMProvider('groq', { apiKey: key });
                }
            },
            setGroqModel: (model: string) => {
                set({ groqModel: model });
                if (window.electronAPI) {
                    window.electronAPI.configureLLMProvider('groq', { model });
                }
            },
            setXaiApiKey: (key: string) => {
                set({ xaiApiKey: key });
                if (window.electronAPI) {
                    window.electronAPI.savePersistentData('xai_api_key', key);
                    window.electronAPI.configureLLMProvider('xai', { apiKey: key });
                }
            },
            setXaiModel: (model: string) => {
                set({ xaiModel: model });
                if (window.electronAPI) {
                    window.electronAPI.configureLLMProvider('xai', { model });
                }
            },
            setAIProvider: (provider: string) => {
                set({ aiProvider: provider });
                if (window.electronAPI) {
                    window.electronAPI.setActiveLLMProvider(provider);
                }
            },
            setOllamaBaseUrl: (url: string) => {
                set({ ollamaBaseUrl: url });
                if (window.electronAPI) {
                    window.electronAPI.configureLLMProvider('ollama', { baseUrl: url });
                }
            },
            setOllamaModel: (model: string) => {
                set({ ollamaModel: model });
                if (window.electronAPI) {
                    window.electronAPI.configureLLMProvider('ollama', { model });
                }
            },
            setLocalLLMBaseUrl: (url: string) => set({ localLLMBaseUrl: url }),
            setLocalLLMModel: (model: string) => set({ localLLMModel: model }),
            setLocalLlmMode: (mode: 'light' | 'normal' | 'heavy') => {
                set({ localLlmMode: mode });
                if (window.electronAPI) {
                    window.electronAPI.configureLLMProvider('ollama', { localLlmMode: mode });
                }
            },

            // AI Permission
            askForAiPermission: true,
            setAskForAiPermission: (val: boolean) => set({ askForAiPermission: val }),
            showAiMistakeWarning: false,
            setShowAiMistakeWarning: (val: boolean) => set({ showAiMistakeWarning: val }),
            hasSeenAiMistakeWarning: false,
            setHasSeenAiMistakeWarning: (val: boolean) => set({ hasSeenAiMistakeWarning: val }),
            setMcpServerPort: (port: number) => set({ mcpServerPort: port }),
            setAdditionalAIInstructions: (instructions: string) => set({ additionalAIInstructions: instructions }),

            // AI Safety
            aiSafetyMode: true, // Default to Safe Mode
            setAiSafetyMode: (enabled: boolean) => set({ aiSafetyMode: enabled }),

            // Theme settings
            setTheme: (theme: "light" | "dark" | "system" | "vibrant" | "custom") => set({ theme }),
            setCustomThemePrimary: (color: string) => set({ customThemePrimary: color }),
            setCustomThemeSecondary: (color: string) => set({ customThemeSecondary: color }),

            // Online status
            setIsOnline: (online: boolean) => set({ isOnline: online }),

            // Active time tracking
            startActiveSession: () => set({ activeStartTime: Date.now() }),
            updateActiveTime: () => {
                // Implementation for updating active time
            },

            // Tab navigation
            nextTab: () => set((state: BrowserState) => {
                const currentIndex = state.tabs.findIndex(tab => tab.id === state.activeTabId);
                const nextIndex = (currentIndex + 1) % state.tabs.length;
                const nextTab = state.tabs[nextIndex];
                return {
                    activeTabId: nextTab.id,
                    currentUrl: nextTab.url
                };
            }),
            prevTab: () => set((state: BrowserState) => {
                const currentIndex = state.tabs.findIndex(tab => tab.id === state.activeTabId);
                const prevIndex = currentIndex === 0 ? state.tabs.length - 1 : currentIndex - 1;
                const prevTab = state.tabs[prevIndex];
                return {
                    activeTabId: prevTab.id,
                    currentUrl: prevTab.url
                };
            }),

            // Sidebar
            toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
            toggleSidebarCollapse: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
            setSidebarSide: (side: 'left' | 'right') => set({ sidebarSide: side }),
            setSidebarWidth: (width: number) => set({ sidebarWidth: width }),
            setMacNativeSidebarMode: (mode: 'electron' | 'swiftui') => {
                set((state) => ({
                    macNativeSidebarMode: mode,
                    sidebarOpen: mode === 'swiftui' ? false : state.sidebarOpen,
                }));
                if (window.electronAPI?.setMacNativeUIPreferences) {
                    void window.electronAPI.setMacNativeUIPreferences({ sidebarMode: mode });
                }
            },
            setMacNativeActionChainMode: (mode: 'electron' | 'swiftui') => {
                set({ macNativeActionChainMode: mode });
                if (window.electronAPI?.setMacNativeUIPreferences) {
                    void window.electronAPI.setMacNativeUIPreferences({ actionChainMode: mode });
                }
            },
            setMacNativeUtilityPanelMode: (mode: 'electron' | 'swiftui') => {
                set({ macNativeUtilityPanelMode: mode });
                if (window.electronAPI?.setMacNativeUIPreferences) {
                    void window.electronAPI.setMacNativeUIPreferences({ utilityMode: mode });
                }
            },
            setMacNativePermissionMode: (mode: 'electron' | 'swiftui') => {
                set({ macNativePermissionMode: mode });
                if (window.electronAPI?.setMacNativeUIPreferences) {
                    void window.electronAPI.setMacNativeUIPreferences({ permissionMode: mode });
                }
            },
            setMacNativeSidebarAutoMinimize: (enabled: boolean) => {
                set({ macNativeSidebarAutoMinimize: enabled });
                if (window.electronAPI?.setMacNativeUIPreferences) {
                    void window.electronAPI.setMacNativeUIPreferences({ sidebarAutoMinimize: enabled });
                }
            },
            applyMacNativeUiPreferences: (preferences) => set((state) => ({
                macNativeSidebarMode: preferences.macNativeSidebarMode || state.macNativeSidebarMode,
                macNativeActionChainMode: preferences.macNativeActionChainMode || state.macNativeActionChainMode,
                macNativeUtilityPanelMode: preferences.macNativeUtilityPanelMode || state.macNativeUtilityPanelMode,
                macNativePermissionMode: preferences.macNativePermissionMode || state.macNativePermissionMode,
                macNativeSidebarAutoMinimize: typeof preferences.macNativeSidebarAutoMinimize === 'boolean'
                    ? preferences.macNativeSidebarAutoMinimize
                    : state.macNativeSidebarAutoMinimize,
            })),

            // Student mode
            setStudentMode: (student: boolean) => set({ studentMode: student }),

            // Coding mode
            setCodingMode: (coding: boolean) => set({ isCodingMode: coding }),

            // Search engine
            setSelectedEngine: (engine: string) => set({ selectedEngine: engine }),

            // Bookmarks
            addBookmark: (bookmark: { url: string; title: string }) => set((state: BrowserState) => ({
                bookmarks: [...state.bookmarks, { id: `bookmark-${Date.now()}`, ...bookmark }]
            })),
            removeBookmark: (url: string) => set((state: BrowserState) => ({
                bookmarks: state.bookmarks.filter(b => b.url !== url)
            })),

            // Passwords and autofill
            addAddress: (address: any) => set((state: BrowserState) => ({
                addresses: [...state.addresses, { id: `address-${Date.now()}`, ...address }]
            })),
            removeAddress: (id: string) => set((state: BrowserState) => ({
                addresses: state.addresses.filter(a => a.id !== id)
            })),
            addPaymentMethod: (method: any) => set((state: BrowserState) => ({
                paymentMethods: [...state.paymentMethods, { id: `pm-${Date.now()}`, ...method }]
            })),
            removePaymentMethod: (id: string) => set((state: BrowserState) => ({
                paymentMethods: state.paymentMethods.filter(pm => pm.id !== id)
            })),

            // Shortcuts
            updateShortcut: (action, accelerator) => {
                let nextShortcuts: BrowserState['shortcuts'] = [];
                set((state) => {
                    const exists = state.shortcuts.some((shortcut) => shortcut.action === action);
                    nextShortcuts = exists
                        ? state.shortcuts.map((shortcut) =>
                            shortcut.action === action ? { ...shortcut, accelerator } : shortcut
                        )
                        : [...state.shortcuts, { action: action as Shortcut['action'], accelerator }];

                    return { shortcuts: nextShortcuts };
                });

                if (window.electronAPI) {
                    window.electronAPI.updateShortcuts(nextShortcuts);
                }
            },
            setHasSeenWelcomePage: (seen) => {
                const prev = get().hasSeenWelcomePage;
                if (prev === seen) return; // Skip if already the same value
                set({ hasSeenWelcomePage: seen });
                if (typeof window !== 'undefined' && window.electronAPI?.setOnboardingState) {
                    void window.electronAPI.setOnboardingState({ hasSeenWelcomePage: seen });
                }
            },
            setHasCompletedStartupSetup: (completed: boolean) => {
                const prev = get().hasCompletedStartupSetup;
                if (prev === completed) return; // Skip if already the same value
                set({ hasCompletedStartupSetup: completed });
                if (typeof window !== 'undefined' && window.electronAPI?.setOnboardingState) {
                    void window.electronAPI.setOnboardingState({ hasCompletedStartupSetup: completed });
                }
            },

            setBackendStrategy: (strategy: 'firebase' | 'mysql') => set({ backendStrategy: strategy }),
            setCustomFirebaseConfig: (config: any | null) => set({ customFirebaseConfig: config }),
            setCustomMysqlConfig: (config: any | null) => set({ customMysqlConfig: config }),

            setGuestMode: (isGuest: boolean) => {
                set({ isGuestMode: isGuest });
                if (isGuest) {
                    set({
                        user: null,
                        userEmail: '',
                        history: [],
                        bookmarks: [],
                        passwords: [],
                        addresses: [],
                        paymentMethods: [],
                        selectedEngine: 'google',
                        cloudSyncConsent: false,
                        activeView: 'browser',
                        tabs: [{ id: 'default', url: get().defaultUrl, title: 'New Tab' }],
                        currentUrl: get().defaultUrl,
                    });
                } else {
                    get().logout();
                }
            },

            setCloudSyncConsent: (consent: boolean) => set({ cloudSyncConsent: consent }),

            removeFromCart: (itemId: string) => set((state: BrowserState) => ({
                unifiedCart: state.unifiedCart.filter((item: any) => item.id !== itemId)
            })),

            addTab: (url?: string, groupId?: string) => {
                const state = get();
                // Use search engine URL if no URL provided
                const getSearchEngineUrl = (): string => {
                    const engine = state.selectedEngine || 'google';
                    const urls: Record<string, string> = {
                        google: 'https://www.google.com',
                        bing: 'https://www.bing.com',
                        duckduckgo: 'https://duckduckgo.com',
                        brave: 'https://search.brave.com',
                        perplexity: 'https://www.perplexity.ai'
                    };
                    return urls[engine] || 'https://www.google.com';
                };

                // Ensure we never default to 'about:blank' or empty unless explicitly requested
                let finalUrl: string = url || '';
                if (!finalUrl || finalUrl === 'about:blank') {
                    if (state.defaultUrl && state.defaultUrl !== 'about:blank') {
                        finalUrl = state.defaultUrl;
                    } else {
                        finalUrl = getSearchEngineUrl();
                    }
                }
                const id = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

                if (window.electronAPI) {
                    // Create the view. Activation with correct bounds will 
                    // happen in the frontend component (useEffect on activeTabId).
                    window.electronAPI.createView({ tabId: id, url: finalUrl });
                }

                set((state: BrowserState) => {
                    let newTabs: BrowserState['tabs'] = [...state.tabs, {
                        id,
                        url: finalUrl,
                        title: 'New Tab',
                        isLoading: true, // Default to true for new tabs
                        lastAccessed: Date.now(),
                        priority: 'high' as const,
                        groupId
                    }];

                    // Enforce 50 tab limit
                    if (newTabs.length > 50) {
                        const tabsToKeep = newTabs.filter(t => t.id === id || t.keepAlive || t.id === state.activeTabId);
                        const others = newTabs.filter(t => !tabsToKeep.find(tk => tk.id === t.id));
                        others.sort((a, b) => {
                            const priorityOrder: Record<string, number> = { low: 0, normal: 1, high: 2 };
                            const diff = (priorityOrder[a.priority || 'normal'] as number) - (priorityOrder[b.priority || 'normal'] as number);
                            if (diff !== 0) return diff;
                            return (a.lastAccessed || 0) - (b.lastAccessed || 0);
                        });
                        const toRemoveCount = newTabs.length - 50;
                        const removedIds = others.slice(0, toRemoveCount).map(t => t.id);
                        removedIds.forEach(id => {
                            if (window.electronAPI) window.electronAPI.destroyView(id);
                        });
                        newTabs = newTabs.filter(t => !removedIds.includes(t.id));
                    }

                    return {
                        tabs: newTabs,
                        activeTabId: id,
                        currentUrl: finalUrl
                        // Preserve activeView - don't force 'browser' view
                    };
                });
            },
            addIncognitoTab: (url?: string) => {
                const finalUrl = url || get().defaultUrl;
                const id = `incognito-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

                if (window.electronAPI) {
                    window.electronAPI.createView({ tabId: id, url: finalUrl });
                }

                set((state: BrowserState) => {
                    let newTabs: BrowserState['tabs'] = [...state.tabs, {
                        id,
                        url: finalUrl,
                        title: 'New Incognito Tab',
                        isIncognito: true,
                        lastAccessed: Date.now(),
                        priority: 'high' as const
                    }];

                    if (newTabs.length > 50) {
                        const others = newTabs.filter(t => t.id !== id && !t.keepAlive && t.id !== state.activeTabId);
                        others.sort((a, b) => {
                            const priorityOrder: Record<string, number> = { low: 0, normal: 1, high: 2 };
                            const diff = (priorityOrder[a.priority || 'normal'] as number) - (priorityOrder[b.priority || 'normal'] as number);
                            if (diff !== 0) return diff;
                            return (a.lastAccessed || 0) - (b.lastAccessed || 0);
                        });
                        const toRemoveCount = newTabs.length - 50;
                        const removedIds = others.slice(0, toRemoveCount).map(t => t.id);
                        newTabs = newTabs.filter(t => !removedIds.includes(t.id));
                    }

                    return {
                        tabs: newTabs,
                        activeTabId: id,
                        currentUrl: finalUrl
                        // Preserve activeView - don't force 'browser' view
                    };
                });
            },
            removeTab: (id: string) => {
                if (window.electronAPI) {
                    window.electronAPI.destroyView(id);
                }
                set((state) => {
                    const newTabs = state.tabs.filter(t => t.id !== id);
                    const defaultUrl = get().defaultUrl;
                    let finalTabs = newTabs.length ? newTabs : [{ id: 'default', url: defaultUrl, title: 'New Tab' }];

                    if (newTabs.length === 0) {
                        if (window.electronAPI) {
                            window.electronAPI.createView({ tabId: 'default', url: defaultUrl });
                        }
                    }

                    const nextTabId = state.activeTabId === id ? (finalTabs[0]?.id || 'default') : state.activeTabId;
                    const nextUrl = finalTabs.find(t => t.id === nextTabId)?.url || defaultUrl;

                    return {
                        tabs: finalTabs,
                        activeTabId: nextTabId,
                        currentUrl: nextUrl
                    };
                });
            },

            setSyncPassphrase: (passphrase: string) => set({ syncPassphrase: passphrase }),

            logout: () => {
                if (window.electronAPI) {
                    window.electronAPI.deletePersistentData('user-data');
                    window.electronAPI.clearAuth();
                }
                set({
                    user: null,
                    userEmail: '',
                    isAdmin: false,
                    activeView: 'browser',
                    history: [],
                    bookmarks: [],
                    passwords: [],
                    addresses: [],
                    paymentMethods: [],
                    cloudSyncConsent: null,
                    isGuestMode: false,
                    tabs: [{ id: 'default', url: 'https://www.google.com', title: 'New Tab' }],
                    currentUrl: 'https://www.google.com',
                });
            },

            // ...
        }),
        {
            name: 'comet-browser-storage',
            partialize: (state) => ({
                hasSeenWelcomePage: state.hasSeenWelcomePage,
                hasCompletedStartupSetup: state.hasCompletedStartupSetup,
                hasSeenNeuralSetup: state.hasSeenNeuralSetup,
                user: state.user,
                isGuestMode: state.isGuestMode,
                theme: state.theme,
                customThemePrimary: state.customThemePrimary,
                customThemeSecondary: state.customThemeSecondary,
                sidebarOpen: state.sidebarOpen,
                sidebarWidth: state.sidebarWidth,
                sidebarSide: state.sidebarSide,
                macNativeSidebarMode: state.macNativeSidebarMode,
                macNativeActionChainMode: state.macNativeActionChainMode,
                macNativeUtilityPanelMode: state.macNativeUtilityPanelMode,
                macNativePermissionMode: state.macNativePermissionMode,
                macNativeSidebarAutoMinimize: state.macNativeSidebarAutoMinimize,
                selectedEngine: state.selectedEngine,
                aiProvider: state.aiProvider,
                bookmarks: state.bookmarks,
                history: state.history,
                tabs: state.tabs,
                activeTabId: state.activeTabId,
                currentUrl: state.currentUrl,
                showDownloadsIcon: state.showDownloadsIcon,
                showClipboardIcon: state.showClipboardIcon,
                showCartIcon: state.showCartIcon,
                showTranslateIcon: state.showTranslateIcon,
                showExtensionsIcon: state.showExtensionsIcon,
                themeOpacity: state.themeOpacity,
                themeBlur: state.themeBlur,
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    console.log('[Store] Rehydrated state:', {
                        hasSeenWelcomePage: state.hasSeenWelcomePage,
                        hasCompletedStartupSetup: state.hasCompletedStartupSetup,
                        hasSeenNeuralSetup: state.hasSeenNeuralSetup,
                        user: state.user ? 'present' : 'null',
                        isGuestMode: state.isGuestMode,
                    });
                    // NOTE: Do NOT call setOnboardingState here — we just read these values
                    // FROM the main process. Writing them back would create a pointless loop
                    // that floods the log on every HMR cycle / rehydration.
                }
                if (typeof window !== 'undefined' && window.electronAPI?.getOnboardingState) {
                    window.electronAPI
                        .getOnboardingState()
                        .then((flags) => {
                            if (!flags) return;
                            useAppStore.setState((prev) => ({
                                hasSeenWelcomePage: prev.hasSeenWelcomePage || !!flags.hasSeenWelcomePage,
                                hasCompletedStartupSetup:
                                    prev.hasCompletedStartupSetup || !!flags.hasCompletedStartupSetup,
                                hasSeenNeuralSetup: prev.hasSeenNeuralSetup || !!flags.hasSeenNeuralSetup,
                            }));
                        })
                        .catch(() => {});
                }
            },
        }
    )
);

// Firebase auth listener
if (typeof window !== 'undefined' && window.electronAPI) {
    // Merge onboarding flags from main-process store (reliable for packaged .dmg/.exe).
    window.electronAPI
        .getOnboardingState()
        .then((flags) => {
            if (!flags) return;
            useAppStore.setState((prev) => ({
                hasSeenWelcomePage: prev.hasSeenWelcomePage || !!flags.hasSeenWelcomePage,
                hasCompletedStartupSetup:
                    prev.hasCompletedStartupSetup || !!flags.hasCompletedStartupSetup,
                hasSeenNeuralSetup: prev.hasSeenNeuralSetup || !!flags.hasSeenNeuralSetup,
            }));
        })
        .catch(() => {});

    // Initial load of user data from persistent storage
    window.electronAPI.loadPersistentData('user-data').then((result: any) => {
        if (result.success && result.data) {
            useAppStore.getState().setUser(result.data);
            useAppStore.getState().setActiveView('browser');
        }
    });

    // Load stored API keys from electron-store on startup
    window.electronAPI.getStoredApiKeys().then((keys: any) => {
        if (keys) {
            if (keys.openai_api_key) {
                useAppStore.getState().setOpenaiApiKey(keys.openai_api_key);
                window.electronAPI.configureLLMProvider('openai', { apiKey: keys.openai_api_key });
            }
            if (keys.openai_model) {
                useAppStore.getState().setOpenaiModel(keys.openai_model);
                window.electronAPI.configureLLMProvider('openai', { model: keys.openai_model });
            }
            if (keys.azure_openai_api_key) {
                useAppStore.getState().setAzureOpenaiApiKey(keys.azure_openai_api_key);
                window.electronAPI.configureLLMProvider('azure-openai', { apiKey: keys.azure_openai_api_key });
            }
            if (keys.azure_openai_endpoint) {
                useAppStore.getState().setAzureOpenaiEndpoint(keys.azure_openai_endpoint);
                window.electronAPI.configureLLMProvider('azure-openai', { baseUrl: keys.azure_openai_endpoint });
            }
            if (keys.azure_openai_model) {
                useAppStore.getState().setAzureOpenaiModel(keys.azure_openai_model);
                window.electronAPI.configureLLMProvider('azure-openai', { model: keys.azure_openai_model });
            }
            if (keys.gemini_api_key) {
                useAppStore.getState().setGeminiApiKey(keys.gemini_api_key);
                window.electronAPI.configureLLMProvider('google', { apiKey: keys.gemini_api_key });
            }
            if (keys.gemini_model) {
                useAppStore.getState().setGeminiModel(keys.gemini_model);
                window.electronAPI.configureLLMProvider('google', { model: keys.gemini_model });
            }
            if (keys.gemini_flash_model) {
                useAppStore.getState().setGeminiFlashModel(keys.gemini_flash_model);
                window.electronAPI.configureLLMProvider('google-flash', { model: keys.gemini_flash_model });
            }
            if (keys.anthropic_api_key) {
                useAppStore.getState().setAnthropicApiKey(keys.anthropic_api_key);
                window.electronAPI.configureLLMProvider('anthropic', { apiKey: keys.anthropic_api_key });
            }
            if (keys.anthropic_model) {
                useAppStore.getState().setAnthropicModel(keys.anthropic_model);
                window.electronAPI.configureLLMProvider('anthropic', { model: keys.anthropic_model });
            }
            if (keys.groq_api_key) {
                useAppStore.getState().setGroqApiKey(keys.groq_api_key);
                window.electronAPI.configureLLMProvider('groq', { apiKey: keys.groq_api_key });
            }
            if (keys.groq_model) {
                useAppStore.getState().setGroqModel(keys.groq_model);
                window.electronAPI.configureLLMProvider('groq', { model: keys.groq_model });
            }
            if (keys.xai_api_key) {
                useAppStore.getState().setXaiApiKey(keys.xai_api_key);
                window.electronAPI.configureLLMProvider('xai', { apiKey: keys.xai_api_key });
            }
            if (keys.xai_model) {
                useAppStore.getState().setXaiModel(keys.xai_model);
                window.electronAPI.configureLLMProvider('xai', { model: keys.xai_model });
            }
            if (keys.ollama_base_url) {
                useAppStore.getState().setOllamaBaseUrl(keys.ollama_base_url);
                window.electronAPI.configureLLMProvider('ollama', { baseUrl: keys.ollama_base_url });
            }
            if (keys.ollama_model) {
                useAppStore.getState().setOllamaModel(keys.ollama_model);
                window.electronAPI.configureLLMProvider('ollama', { model: keys.ollama_model });
            }
            if (keys.active_llm_provider) {
                useAppStore.getState().setAIProvider(keys.active_llm_provider);
            }
        }
    });

    // Sync initial shortcuts with main process on startup
    const initialShortcuts = useAppStore.getState().shortcuts;
    if (initialShortcuts && initialShortcuts.length > 0) {
        window.electronAPI.updateShortcuts(initialShortcuts);
    }

    firebaseService.onAuthStateChanged(async (user) => {
            const { user: currentUser, defaultUrl, tabs, activeTabId } = useAppStore.getState();

            if (user) {
                const userData = {
                    uid: user.uid,
                    email: user.email || '',
                    displayName: user.displayName || '',
                    photoURL: user.photoURL || '',
                };

                // Persist to user data directory
                window.electronAPI.savePersistentData('user-data', userData);
                window.electronAPI.saveAuthSession({
                    user: userData,
                    token: await user.getIdToken().catch(() => null),
                    refreshToken: user.refreshToken || null,
                    provider: 'firebase-session',
                    savedAt: Date.now(),
                });

                if (!currentUser || currentUser.uid !== user.uid) {
                    useAppStore.getState().setUser(userData);
                    useAppStore.getState().setActiveView('browser');

                    const activeTab = tabs.find(t => t.id === activeTabId);
                    if (activeTab && (activeTab.url === 'about:blank' || activeTab.url === '')) {
                        useAppStore.getState().updateTab(activeTab.id, { url: defaultUrl });
                        useAppStore.getState().setCurrentUrl(defaultUrl);
                    }
                }
            } else {
                if (currentUser) {
                    const savedSession = await window.electronAPI.getAuthSession().catch(() => null);
                    if (savedSession?.user?.uid === currentUser.uid) {
                        console.log('[Auth] Keeping cached secure session while Firebase restores.');
                        return;
                    }
                    window.electronAPI.deletePersistentData('user-data');
                    useAppStore.getState().logout();
                }
            }
        });
}
