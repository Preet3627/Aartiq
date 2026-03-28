import { ChatMessage } from "../lib/llm/providers/base";

declare global {
    interface Window {
        pdfjsLib: any;
        electronAPI: {
            // BrowserView related APIs
            getIsOnline: () => Promise<boolean>;
            getPlatform: () => string;
            onAiQueryDetected: (callback: (query: string) => void) => () => void;
            createView: (args: { tabId: string; url: string }) => void;
            activateView: (args: { tabId: string; bounds: { x: number; y: number; width: number; height: number } }) => void;
            destroyView: (tabId: string) => void;
            hideAllViews: () => void;
            showAllViews: () => void;
            onBrowserViewUrlChanged: (callback: (data: { tabId: string; url: string }) => void) => () => void;
            onBrowserViewTitleChanged: (callback: (data: { tabId: string; title: string }) => void) => () => void;
            navigateBrowserView: (args: { tabId: string; url: string }) => void;
            navigateTo: (url: string) => void;
            goBack: () => void;
            goForward: () => void;
            reload: () => void;
            getCurrentUrl: () => Promise<string>;
            extractPageContent: () => Promise<{ content?: string; error?: string }>;
            extractSecureDOM: () => Promise<{
                content: string;
                elements: Array<{ tag: string; text: string; xpath: string; children: any[] }>;
                metadata: {
                    url: string;
                    title: string;
                    timestamp: number;
                    injectionDetected: boolean;
                    filterStats: {
                        piiRemoved: number;
                        scriptsRemoved: number;
                        stylesRemoved: number;
                        navRemoved: number;
                        adsRemoved: number;
                    };
                };
                error?: string;
            }>;
            getPageDomInfo: (tabId?: string) => Promise<{
                success: boolean;
                url?: string;
                title?: string;
                bodyText?: string;
                links?: Array<{ href: string; text: string }>;
                forms?: Array<{ action: string; method: string; inputs: Array<{ name: string; type: string; placeholder: string }> }>;
                clickableElements?: Array<{
                    index: number;
                    tagName: string;
                    text: string;
                    selector?: string;
                    href?: string | null;
                    ariaLabel?: string | null;
                    title?: string | null;
                    rect?: { x: number; y: number; width: number; height: number };
                }>;
                error?: string;
            }>;
            searchDOM: (query: string) => Promise<{
                results: Array<{
                    text: string;
                    context: string;
                    xpath: string;
                    score: number;
                    tag: string;
                }>;
                query: string;
                error?: string;
            }>;
            setBrowserViewBounds: (bounds: { x: number; y: number; width: number; height: number }) => void;
            capturePageHtml: () => Promise<string>;
            saveOfflinePage: (data: { url: string; title: string, html: string }) => Promise<boolean>;
            setUserAgent: (userAgent: string) => Promise<boolean>;
            setProxy: (config: any) => Promise<boolean>;
            capturePage: () => Promise<string>;
            sendInputEvent: (input: any) => Promise<void>;
            openDevTools: () => void;
            changeZoom: (deltaY: number) => void;
            resetZoom: () => void;
            onAudioStatusChanged: (callback: (isPlaying: boolean) => void) => () => void;

            // Download APIs
            onDownloadStarted: (callback: (filename: string) => void) => () => void;
            onDownloadProgress: (callback: (data: { name: string, progress: number }) => void) => () => void;
            onDownloadComplete: (callback: (filename: string) => void) => () => void;
            triggerDownload: (url: string, filename: string) => Promise<boolean>;
            on: (channel: string, listener: (...args: any[]) => void) => () => void; // Generic 'on' for ipcRenderer events
            onAddNewTab: (callback: (url: string) => void) => () => void; // Specific add new tab event

            getSuggestions: (query: string) => Promise<any[]>; // New IPC handler

            // LLM & Memory APIs
            getAvailableLLMProviders: () => Promise<{ id: string; name: string }[]>;
            setActiveLLMProvider: (providerId: string) => Promise<boolean>;
            configureLLMProvider: (providerId: string, options: any) => Promise<boolean>;
            getStoredApiKeys: () => Promise<any>;
            generateChatContent: (messages: ChatMessage[], options?: any) => Promise<{ text?: string; thought?: string; error?: string }>;
            streamChatContent: (messages: ChatMessage[], options?: any) => void;
            onChatStreamPart: (callback: (part: any) => void) => () => void;
            getAiMemory: () => Promise<any[]>;
            addAiMemory: (entry: any) => void;
            getSelectedText: () => Promise<string>; // For context menu integration
            sendToAIChatInput: (text: string) => void; // For sending selected text to AI chat
            captureBrowserViewScreenshot: () => Promise<string>; // For vision capabilities

            // Dev-MCP & Analytics
            sendMcpCommand: (command: string, data: any) => Promise<any>;
            shareDeviceFolder: () => Promise<{ path?: string; success: boolean }>;
            setMcpServerPort: (port: number) => void; // For updating the MCP server port

            // Ollama specific APIs
            ollamaListModels: () => Promise<{ models: { name: string; modified_at: string }[]; error?: string }>;

            // Window Controls
            minimizeWindow: () => void;
            maximizeWindow: () => void;
            closeWindow: () => void;
            toggleFullscreen: () => void;
            setAsDefaultBrowser: () => Promise<boolean>;
            showWebview: () => void;
            hideWebview: () => void;
            bringWindowToTop: () => void;
            getOpenTabs: () => Promise<any[]>;

            // Auth
            openAuthWindow: (url: string) => void;
            closeAuthWindow: () => void;
            updateRaycastState: (state: { tabs?: Array<{ id: string; title: string; url: string; isActive?: boolean; isLoading?: boolean }>; history?: Array<{ url: string; title: string; timestamp: number }> }) => void;
            saveGoogleConfig: (config: { clientId?: string; clientSecret?: string; redirectUri?: string }) => void;
    getGoogleConfig: () => Promise<{ clientId: string; clientSecret: string; redirectUri: string }>;
    onAuthCallback: (callback: (event: any, url: string) => void) => () => void;
            onAuthTokenReceived: (callback: (token: string) => void) => () => void;

            // Chat & File Export
            exportChatAsTxt: (messages: ChatMessage[]) => Promise<boolean>;
            exportChatAsPdf: (messages: ChatMessage[]) => Promise<boolean>;
            sendAiOverviewData: (data: any) => void;
            sendDownloadPanelData: (data: any) => void;
            closeAiOverview: () => void;

            // MCP Support
            mcpCommand: (command: string, data: any) => Promise<any>;
            mcpConnectServer: (config: { id: string; name: string; url: string; type?: string }) => Promise<{ success: boolean; error?: string }>;
            mcpDisconnectServer: (id: string) => Promise<{ success: boolean; error?: string }>;
            mcpListServers: () => Promise<{ success: boolean; servers: any[], error?: string }>;
            mcpGetTools: (serverId: string) => Promise<{ success: boolean; tools: any[], error?: string }>;
            mcpCallTool: (serverId: string, toolName: string, args: any) => Promise<{ success: boolean, result?: any; error?: string }>;

            // Database & Sync
            initDatabase: (config: { host?: string; port?: number; user?: string; password?: string; database?: string }) => Promise<{ success: boolean; error?: string }>;
            syncData: (params: { userId: string; type: string; data: any[]; direction: 'push' | 'pull' }) => Promise<{ success: boolean; synced?: number }>;

            // P2P File Sync
            scanFolder: (path: string, types: string[]) => Promise<any[]>;
            readFileBuffer: (path: string) => Promise<ArrayBuffer>;

            // Phone Control
            sendPhoneCommand: (command: string, data: any) => Promise<void>;

            // Contacts
            getDeviceContacts: () => Promise<any[]>;
            syncContacts: (deviceId: string, contacts: any[]) => Promise<{ success: boolean; synced: number }>;

            // OTP
            startSMSListener: () => Promise<boolean>;
            startEmailListener: () => Promise<boolean>;
            syncOTP: (otp: any) => Promise<void>;
            requestSMSPermission: () => Promise<boolean>;
            onShortcut: (callback: (action: string) => void) => () => void;
            updateShortcuts: (shortcuts: { action: string; accelerator: string }[]) => void;

            // Tab Optimization
            suspendTab: (tabId: string) => void;
            resumeTab: (tabId: string) => void;
            getMemoryUsage: () => Promise<any>;
            // RAG Persistence & Ollama
            saveVectorStore: (data: any[]) => Promise<boolean>;
            loadVectorStore: () => Promise<any[]>;
            webSearchRag: (query: string) => Promise<string[]>;
            getPasswordsForSite: (domain: string) => Promise<any[]>;
            proposePasswordSave: (data: { domain: string; username?: string; password?: string }) => void;
            getOllamaModels: () => Promise<{ name: string; modified_at: string }[]>;
            pullOllamaModel: (model: string, callback: (data: any) => void) => () => void;
            importOllamaModel: (data: { modelName: string; filePath: string }) => Promise<{ success: boolean; error?: string }>;
            selectLocalFile: (options?: { filters?: { name: string; extensions: string[] }[]; properties?: string[] }) => Promise<string | null>;
            executeJavaScript: (code: string) => Promise<any>;

            // Tab Management
            onTabLoaded: (callback: (data: { tabId: string; url: string }) => void) => () => void;
            onTabLoadingStatus: (callback: (data: { tabId: string; isLoading: boolean }) => void) => () => void;
            onTabSuspended: (callback: (tabId: string) => void) => () => void;
            onTabResumed: (callback: (tabId: string) => void) => () => void;
            onResumeTabAndActivate: (callback: (tabId: string) => void) => () => void;
            extractSearchResults: (tabId?: string) => Promise<{ success: boolean; results?: any[]; error?: string }>;
            addNewTab: (url: string) => void;

            // Shell Commands
            executeShellCommand: (command: string, preApproved?: boolean) => Promise<{ success: boolean; output?: string; error?: string }>;

            // Cross-App Control APIs
            captureScreenRegion: (coords: { x: number; y: number; width: number; height: number }) => Promise<{ success: boolean; image?: string; error?: string }>;
            searchApplications: (query: string) => Promise<{ success: boolean; results: any[]; error?: string }>;
            openExternalApp: (appPath: string) => Promise<{ success: boolean; error?: string }>;
            openSystemSettings: (url: string) => Promise<{ success: boolean; error?: string }>;
            performCrossAppClick: (coords: { x: number; y: number }) => Promise<{ success: boolean; error?: string }>;
            onOpenUnifiedSearch: (callback: () => void) => () => void;

            // Element Control (deprecated - use performCrossAppClick instead)
            clickElement: (selector: string) => Promise<{ success: boolean; error?: string; matchedBy?: string; tagName?: string; text?: string; rect?: { x: number; y: number; width: number; height: number } }>;
            typeText: (selector: string, text: string) => Promise<{ success: boolean; error?: string }>;
            fillForm: (data: any) => Promise<{ success: boolean; error?: string }>;
            findAndClickText: (targetText: string) => Promise<{ success: boolean; x?: number; y?: number; error?: string; foundText?: string }>;

            // Gmail Integration
            gmailAuthorize: () => Promise<{ success: boolean; error?: string }>;
            gmailListMessages: (query: string, maxResults: number) => Promise<{ success: boolean; messages?: any[]; error?: string }>;
            gmailGetMessage: (messageId: string) => Promise<{ success: boolean; message?: any; error?: string }>;
            gmailSendMessage: (to: string, subject: string, body: string, threadId?: string | null) => Promise<{ success: boolean; result?: any; error?: string }>;
            gmailAddLabelToMessage: (messageId: string, labelName: string) => Promise<{ success: boolean; result?: any; error?: string }>;
            onGmailOAuthCode: (callback: (code: string) => void) => () => void;

            // AI Response
            saveAiResponse: (content: string) => void;

            // LLM Provider Testing
            testGeminiApi: (apiKey: string) => Promise<{ success: boolean; error?: string }>;

            // Alarm & Applications
            setAlarm: (alarmTime: string, message: string) => Promise<{ success: boolean; error?: string }>;
            setUserId: (userId: string | null) => void;
            getExtensions: () => Promise<any[]>;
            toggleExtension: (id: string) => Promise<boolean>;
            uninstallExtension: (id: string) => Promise<boolean>;
            openExtensionDir: () => void;
            getExtensionPath: () => Promise<string>;
            getIconPath: () => Promise<string>;
            connectToRemoteDevice: (remoteDeviceId: string) => Promise<boolean>;
            sendP2PSignal: (signal: any, remoteDeviceId: string) => void;
            onP2PConnected: (callback: () => void) => () => void;
            onP2PDisconnected: (callback: () => void) => () => void;
            onP2PFirebaseReady: (callback: (userId: string) => void) => () => void;
            onP2POfferCreated: (callback: (data: { offer: any; remoteDeviceId: string }) => void) => () => void;
            onP2PAnswerCreated: (callback: (data: { answer: any; remoteDeviceId: string }) => void) => () => void;
            onP2PIceCandidate: (callback: (data: { candidate: any; remoteDeviceId: string }) => void) => () => void;
            onP2PLocalDeviceId: (callback: (deviceId: string) => void) => () => void;
            getP2PLocalDeviceId: () => Promise<string>;
            onP2PMessage: (callback: (message: any) => void) => () => void;
            encryptData: (data: ArrayBuffer, key: string) => Promise<{ encryptedData: ArrayBuffer; iv: ArrayBuffer; authTag: ArrayBuffer; salt: ArrayBuffer; } | { error: string }>;
            decryptData: (encryptedData: ArrayBuffer, key: string, iv: ArrayBuffer, authTag: ArrayBuffer, salt: ArrayBuffer) => Promise<{ decryptedData: ArrayBuffer; } | { error: string }>;
            // scanFolder and readFileBuffer are already defined above (lines 88-89)

            // Persistent Storage
            savePersistentData: (key: string, data: any) => Promise<{ success: boolean; error?: string }>;
            loadPersistentData: (key: string) => Promise<{ success: boolean; data?: any; error?: string }>;
            deletePersistentData: (key: string) => Promise<{ success: boolean; error?: string }>;

            // Event Listeners for UI updates
            onNetworkStatusChanged: (callback: (isOnline: boolean) => void) => () => void;
            onClipboardChanged: (callback: (text: string) => void) => () => void;
            onAIChatInputText: (callback: (text: string) => void) => () => void;
            onAiChatInputText: (callback: (text: string) => void) => () => void;
            translateWebsite: (args: { targetLanguage: string; method?: 'google' | 'chrome-ai' }) => Promise<{ success?: boolean; error?: string }>;
            onTriggerTranslationDialog: (callback: () => void) => () => void;
            onAutomationShellApproval: (callback: (payload: { requestId: string; command: string; risk: string; reason?: string; highRiskQr?: string }) => void) => () => void;
            respondAutomationShellApproval: (response: { requestId: string; allowed: boolean }) => void;
            toggleAdblocker: (enable: boolean) => void;
            translateText: (args: { text: string; to: string; from?: string }) => Promise<{ success: boolean; translated?: string; error?: string }>;
            openSettingsPopup: (section?: string) => void;
            openProfilePopup: () => void;
            openPluginsPopup: () => void;
            openDownloadsPopup: () => void;
            openClipboardPopup: () => void;
            openCartPopup: () => void;
            openSearchPopup: (options?: any) => void;
            popSearchShow: (text: string, x: number, y: number) => Promise<{ success: boolean; error?: string }>;
            popSearchShowAtCursor: (text: string) => Promise<{ success: boolean; error?: string }>;
            popSearchGetConfig: () => Promise<{ success: boolean; config?: any; error?: string }>;
            popSearchUpdateConfig: (config: any) => Promise<{ success: boolean; error?: string }>;
            popSearchSaveConfig: (data: any) => Promise<{ success: boolean; canceled?: boolean; error?: string }>;
            popSearchLoadConfig: () => Promise<string | null>;
            openTranslatePopup: (options?: any) => void;
            openContextMenuPopup: (options?: any) => void;
            openPopupWindow: (type: string, options?: any) => void;
            closePopupWindow: (type: string) => void;
            closeAllPopups: () => void;
            getAiOverviewData: () => Promise<any>;
            getDownloadPanelData: () => Promise<any>;
            onLoadAuthToken: (callback: (token: string) => void) => () => void;
            saveAuthToken: (args: { token: string }) => void;
            getAuthToken: () => Promise<string | null>;
            getUserInfo: () => Promise<any>;
            clearAuth: () => void;
            googleOAuthLogin: () => void;
            onGoogleOAuthCode: (callback: (code: string) => void) => () => void;
            onSetSettingsSection: (callback: (section: string) => void) => () => void;

            getWifiSyncUri: () => Promise<string | null>;
            getWifiSyncQr: () => Promise<string | null>;
            getWifiSyncInfo: () => Promise<{ deviceName: string, pairingCode: string, ip: string, port: number }>;
            onWifiSyncStatus: (callback: (data: { connected: boolean }) => void) => () => void;
            onRemoteAiPrompt: (callback: (data: { prompt: string; commandId: string }) => void) => () => void;
            wifiSyncBroadcast: (data: any) => void;

            // Missing APIs
            generatePDF: (title: string, content: string) => Promise<{ success: boolean; fileName?: string; filePath?: string; log?: string; error?: string }>;
            openPDF: (filePath: string) => Promise<{ success: boolean; error?: string }>;
            openFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
            getClipboardText: () => Promise<string>;
            setClipboardText: (text: string) => void;
            setVolume: (level: number) => Promise<{ success: boolean; error?: string }>;
            setBrightness: (level: number) => Promise<{ success: boolean; error?: string }>;
            performClick: (options: any) => Promise<{ success: boolean; error?: string }>;
            performOCR: (options: any) => Promise<{ success: boolean; results: any[]; error?: string }>;
            getWindowInfo: () => Promise<any>;

            // Desktop Automation v2 — Permission Store
            permGrant: (key: string, level: string, description: string, sessionOnly?: boolean) => Promise<{ success: boolean; error?: string }>;
            permRevoke: (key: string) => Promise<{ success: boolean }>;
            permRevokeAll: () => Promise<{ success: boolean }>;
            permCheck: (key: string) => Promise<{ granted: boolean }>;
            permList: () => Promise<Array<{ key: string; level: string; granted_at: number; expires_at: number | null; description: string }>>;
            permAuditLog: (limit?: number) => Promise<Array<{ entry: string; timestamp: number }>>;
            getSecuritySettings: () => Promise<{ autoApproveLowRisk: boolean; autoApproveMidRisk: boolean; autoApprovedCommands: string[] }>;
            updateSecuritySettings: (settings: { autoApproveLowRisk?: boolean; autoApproveMidRisk?: boolean }) => Promise<{ success: boolean; settings: { autoApproveLowRisk: boolean; autoApproveMidRisk: boolean; autoApprovedCommands: string[] } }>;
            setAutoApprovalCommand: (payload: { command: string; enabled: boolean }) => Promise<{ success: boolean; commands: string[] }>;
            getAutoApprovedCommands: () => Promise<{ commands: string[] }>;

            // Desktop Automation v2 — Robot Service
            robotExecute: (action: {
                type: 'click' | 'type' | 'key' | 'scroll';
                x?: number; y?: number;
                button?: 'left' | 'right' | 'middle';
                double?: boolean;
                text?: string;
                key?: string;
                modifiers?: ('command' | 'control' | 'alt' | 'shift')[];
                direction?: 'up' | 'down' | 'left' | 'right';
                amount?: number;
                reason: string;
            }) => Promise<{ success: boolean; error?: string }>;
            robotExecuteSequence: (actions: any[], options?: { stopOnError?: boolean; skipConfirm?: boolean }) => Promise<any[]>;
            robotKill: () => Promise<{ success: boolean }>;
            robotResetKill: () => Promise<{ success: boolean }>;
            robotStatus: () => Promise<{ available: boolean; permitted: boolean; killActive: boolean }>;
            onRobotKilled: (callback: () => void) => () => void;

            // Desktop Automation v2 — Tesseract OCR
            ocrCaptureWords: (displayId?: string) => Promise<{
                success: boolean;
                words?: Array<{ text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number }; centerX: number; centerY: number }>;
                error?: string;
            }>;
            ocrClick: (target: string, useAi?: boolean) => Promise<{ success: boolean; clickedText?: string; method?: string; error?: string }>;
            ocrScreenText: (displayId?: string) => Promise<{ success: boolean; text?: string; error?: string }>;

            // Desktop Automation v2 — Screen Vision AI
            visionDescribe: (question?: string) => Promise<{ success: boolean; description?: string; error?: string }>;
            visionAnalyze: (question: string) => Promise<{ success: boolean; description?: string; analysis?: string; ocrWordCount?: number; error?: string }>;
            visionCaptureBase64: () => Promise<{ success: boolean; image?: string; error?: string }>;

            // Desktop Automation v2 — AI Engine
            aiEngineChat: (opts: { message: string; model?: string; systemPrompt?: string; history?: Array<{ role: string; content: string }> }) => Promise<{ success: boolean; response?: string; error?: string }>;
            aiEngineConfigure: (keys: Record<string, string>) => Promise<{ success: boolean }>;

            // Flutter Bridge
            bridgeGetPairingCode: () => Promise<{ success: boolean; code?: string; error?: string }>;
            bridgeGetStatus: () => Promise<{ running: boolean; connectedDevices: number }>;
            bridgeRotateSecret: () => Promise<{ success: boolean; code?: string }>;
            bridgeBroadcast: (message: any) => Promise<{ success: boolean }>;

            // MCP Desktop — FileSystem (sandboxed)
            mcpFsRead: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
            mcpFsWrite: (filePath: string, content: string) => Promise<{ success: boolean; result?: string; error?: string }>;
            mcpFsList: (dirPath: string) => Promise<{ success: boolean; entries?: Array<{ name: string; isDirectory: boolean; path: string }>; error?: string }>;
            mcpFsApprovedDirs: () => Promise<{ success: boolean; dirs?: string[] }>;

            // MCP Desktop — NativeApp (AppleScript/PowerShell)
            mcpNativeApplescript: (script: string) => Promise<{ success: boolean; result?: string; error?: string }>;
            mcpNativePowershell: (script: string) => Promise<{ success: boolean; result?: string; error?: string }>;
            mcpNativeActiveWindow: () => Promise<{ success: boolean; app?: string; window?: string; error?: string }>;

            // Web Search v2 (Brave / Tavily / SerpAPI)
            webSearch: (query: string, provider?: 'brave' | 'tavily' | 'serp', count?: number) => Promise<{ success: boolean; results?: Array<{ title: string; url: string; snippet: string }>; error?: string }>;
            webSearchContext: (query: string, provider?: string) => Promise<{ success: boolean; context?: string; error?: string }>;
            webSearchProviders: () => Promise<{ success: boolean; providers?: string[] }>;
            webSearchConfigure: (keys: Record<string, string>) => Promise<{ success: boolean }>;

            // RAG — Local Vector Store
            ragIngest: (text: string, source: string) => Promise<{ success: boolean; chunksAdded?: number; error?: string }>;
            ragRetrieve: (query: string, k?: number) => Promise<{ success: boolean; results?: Array<{ text: string; source: string; score: number }>; error?: string }>;
            ragContext: (query: string, k?: number) => Promise<{ success: boolean; context?: string; error?: string }>;
            ragStats: () => Promise<{ success: boolean; totalChunks?: number; sources?: string[]; error?: string }>;
            ragDeleteSource: (source: string) => Promise<{ success: boolean; deleted?: number; error?: string }>;
            ragClear: () => Promise<{ success: boolean }>;

            // Voice Control (Whisper)
            voiceTranscribe: (audioBase64: string, format?: string) => Promise<{ success: boolean; text?: string; error?: string }>;
            voiceMicPermission: () => Promise<{ success: boolean; granted?: boolean; error?: string }>;

            // Workflow Recorder
            workflowStart: () => Promise<{ success: boolean; recording?: boolean }>;
            workflowRecord: (type: string, action: any) => Promise<{ success: boolean }>;
            workflowStop: () => Promise<{ success: boolean; steps?: number }>;
            workflowSave: (name: string, description?: string) => Promise<{ success: boolean; filePath?: string; steps?: number; error?: string }>;
            workflowList: () => Promise<{ success: boolean; workflows?: Array<{ name: string; description: string; steps: number; created: number; file: string }>; error?: string }>;
            workflowReplay: (name: string) => Promise<{ success: boolean; results?: any[]; error?: string }>;
            workflowDelete: (name: string) => Promise<{ success: boolean; deleted?: boolean; error?: string }>;
            workflowStatus: () => Promise<{ success: boolean; isRecording?: boolean; stepCount?: number }>;
            generateHighRiskQr: (actionId: string) => Promise<string | null>;
            onMobileApproveHighRisk: (callback: (data: { pin: string; id: string }) => void) => () => void;
            getAppIcon: () => Promise<string | null>;
            organizeFolder: (path: string) => Promise<{ success: boolean; count?: number; summary?: string; path?: string; error?: string }>;

            // Automation & Scheduling
            scheduleTask: (taskData: {
                name: string;
                type: 'ai-prompt' | 'web-scrape' | 'pdf-generate' | 'workflow' | 'daily-brief' | 'shell';
                cronExpression?: string;
                prompt?: string;
                url?: string;
                action?: string;
                outputPath?: string;
                enabled?: boolean;
            }) => Promise<{ success: boolean; taskId?: string; error?: string }>;
            getScheduledTasks: () => Promise<{ success: boolean; tasks?: any[]; error?: string }>;
            toggleScheduledTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
            runScheduledTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
            deleteScheduledTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;

        };

    }
}

export { };
