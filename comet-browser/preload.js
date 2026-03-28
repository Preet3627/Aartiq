const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  // BrowserView related APIs
  getIsOnline: () => ipcRenderer.invoke('get-is-online'),
  getPlatform: () => process.platform, // Expose platform info
  onAddNewTab: (callback) => {
    const subscription = (event, url) => callback(url);
    ipcRenderer.on('add-new-tab', subscription);
    return () => ipcRenderer.removeListener('add-new-tab', subscription);
  },
  onAiQueryDetected: (callback) => {
    const subscription = (event, query) => callback(query);
    ipcRenderer.on('ai-query-detected', subscription);
    return () => ipcRenderer.removeListener('ai-query-detected', subscription);
  },
  createView: (args) => ipcRenderer.send('create-view', args),
  addNewTab: (url) => ipcRenderer.send('create-view', { tabId: `tab-${Date.now()}`, url }),
  activateView: (args) => ipcRenderer.send('activate-view', args),
  hideAllViews: () => ipcRenderer.send('hide-all-views'),
  showAllViews: () => ipcRenderer.send('show-all-views'),
  destroyView: (tabId) => ipcRenderer.send('destroy-view', tabId),
  onBrowserViewUrlChanged: (callback) => {
    const subscription = (event, { tabId, url }) => callback({ tabId, url });
    ipcRenderer.on('browser-view-url-changed', subscription);
    return () => ipcRenderer.removeListener('browser-view-url-changed', subscription);
  },
  onBrowserViewTitleChanged: (callback) => {
    const subscription = (event, { tabId, title }) => callback({ tabId, title });
    ipcRenderer.on('browser-view-title-changed', subscription);
    return () => ipcRenderer.removeListener('browser-view-title-changed', subscription);
  },
  navigateBrowserView: (args) => ipcRenderer.send('navigate-browser-view', args),
  goBack: () => ipcRenderer.send('browser-view-go-back'),
  goForward: () => ipcRenderer.send('browser-view-go-forward'),
  reload: () => ipcRenderer.send('browser-view-reload'),
  getCurrentUrl: () => ipcRenderer.invoke('get-browser-view-url'),
  getOpenTabs: () => ipcRenderer.invoke('get-open-tabs'),
  extractPageContent: () => ipcRenderer.invoke('extract-page-content'),
  extractSecureDOM: () => ipcRenderer.invoke('extract-secure-dom'),
  getPageDomInfo: (tabId) => ipcRenderer.invoke('dom-get-page-info', { tabId }),
  searchDOM: (query) => ipcRenderer.invoke('search-dom', query),
  getSelectedText: () => ipcRenderer.invoke('get-selected-text'),
  findAndClickText: (targetText) => ipcRenderer.invoke('find-and-click-text', targetText),
  setBrowserViewBounds: (bounds) => ipcRenderer.send('set-browser-view-bounds', bounds),
  setUserAgent: (userAgent) => ipcRenderer.invoke('set-user-agent', userAgent),
  setProxy: (config) => ipcRenderer.invoke('set-proxy', config),
  capturePage: () => ipcRenderer.invoke('capture-page'),
  captureBrowserViewScreenshot: () => ipcRenderer.invoke('capture-browser-view-screenshot'),
  captureScreenRegion: (args) => ipcRenderer.invoke('capture-screen-region', args),
  sendInputEvent: (input) => ipcRenderer.invoke('send-input-event', input),
  openDevTools: () => ipcRenderer.send('open-dev-tools'),
  changeZoom: (deltaY) => ipcRenderer.send('change-zoom', deltaY),
  resetZoom: () => ipcRenderer.send('reset-zoom'),
  executeJavaScript: (code) => ipcRenderer.invoke('execute-javascript', code),
  clickElement: (selector) => ipcRenderer.invoke('click-element', selector),
  typeText: (selector, text) => ipcRenderer.invoke('type-text', { selector, text }),
  fillForm: (data) => ipcRenderer.invoke('fill-form', data),
  openExternalApp: (appNameOrPath) => ipcRenderer.invoke('open-external-app', appNameOrPath),
  searchApplications: (query) => ipcRenderer.invoke('search-applications', query),
  getSuggestions: (query) => ipcRenderer.invoke('get-suggestions', query), // New IPC handler
  onAudioStatusChanged: (callback) => {
    const subscription = (event, isPlaying) => callback(isPlaying);
    ipcRenderer.on('audio-status-changed', subscription);
    return () => ipcRenderer.removeListener('audio-status-changed', subscription);
  },
  onTabLoadingStatus: (callback) => {
    const subscription = (event, { tabId, isLoading }) => callback({ tabId, isLoading });
    ipcRenderer.on('tab-loading-status', subscription);
    return () => ipcRenderer.removeListener('tab-loading-status', subscription);
  },

  // Download Listeners
  onDownloadStarted: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('download-started', subscription);
    return () => ipcRenderer.removeListener('download-started', subscription);
  },
  onDownloadProgress: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('download-progress', subscription);
    return () => ipcRenderer.removeListener('download-progress', subscription);
  },
  onDownloadComplete: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('download-complete', subscription);
    return () => ipcRenderer.removeListener('download-complete', subscription);
  },
  onDownloadFailed: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('download-failed', subscription);
    return () => ipcRenderer.removeListener('download-failed', subscription);
  },
  onTabLoaded: (callback) => {
    const subscription = (event, { tabId, url }) => callback({ tabId, url });
    ipcRenderer.on('on-tab-loaded', subscription);
    return () => ipcRenderer.removeListener('on-tab-loaded', subscription);
  },

  // LLM & Memory APIs
  getAvailableLLMProviders: () => ipcRenderer.invoke('llm-get-available-providers'),
  setActiveLLMProvider: (providerId) => ipcRenderer.invoke('llm-set-active-provider', providerId),
  configureLLMProvider: (providerId, options) => ipcRenderer.invoke('llm-configure-provider', providerId, options),
  getStoredApiKeys: () => ipcRenderer.invoke('get-stored-api-keys'),
  generateChatContent: (messages, options) => ipcRenderer.invoke('llm-generate-chat-content', messages, options),
  streamChatContent: (messages, options) => {
    ipcRenderer.send('llm-stream-chat-content', messages, options);
  },
  onChatStreamPart: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('llm-chat-stream-part', subscription);
    return () => ipcRenderer.removeListener('llm-chat-stream-part', subscription);
  },
  getAiMemory: () => ipcRenderer.invoke('get-ai-memory'),
  addAiMemory: (entry) => ipcRenderer.send('add-ai-memory', entry),
  saveVectorStore: (data) => ipcRenderer.invoke('save-vector-store', data),
  loadVectorStore: () => ipcRenderer.invoke('load-vector-store'),
  saveGoogleConfig: (config) => ipcRenderer.send('save-google-config', config),
  getGoogleConfig: () => ipcRenderer.invoke('get-google-config'),
  webSearchRag: (query) => ipcRenderer.invoke('web-search-rag', query),
  extractSearchResults: (tabId) => ipcRenderer.invoke('extract-search-results', tabId),
  translateWebsite: (args) => ipcRenderer.invoke('translate-website', args),
  translateText: (args) => ipcRenderer.invoke('translate-text', args),
  onTriggerTranslationDialog: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('trigger-translation-dialog', subscription);
    return () => ipcRenderer.removeListener('trigger-translation-dialog', subscription);
  },
  onAutomationShellApproval: (callback) => {
    const subscription = (event, payload) => callback(payload);
    ipcRenderer.on('automation-shell-approval', subscription);
    return () => ipcRenderer.removeListener('automation-shell-approval', subscription);
  },
  respondAutomationShellApproval: (response) => ipcRenderer.send('automation-shell-approval-response', response),

  // Auth
  openAuthWindow: (url) => ipcRenderer.send('open-auth-window', url),
  closeAuthWindow: () => ipcRenderer.send('close-auth-window'),
  onAuthCallback: (callback) => {
    const subscription = (event, url) => callback(event, url);
    ipcRenderer.on('auth-callback', subscription);
    return () => ipcRenderer.removeListener('auth-callback', subscription);
  },
  onAuthTokenReceived: (callback) => {
    const subscription = (event, token) => callback(token);
    ipcRenderer.on('auth-token-received', subscription);
    return () => ipcRenderer.removeListener('auth-token-received', subscription);
  },

  // Popups
  openSettingsPopup: (section) => ipcRenderer.send('open-settings-popup', section),
  openProfilePopup: () => ipcRenderer.send('open-profile-popup'),
  openPluginsPopup: () => ipcRenderer.send('open-plugins-popup'),
  openPopupWindow: (type, options) => ipcRenderer.send('open-popup-window', { type, options }),
  closePopupWindow: (type) => ipcRenderer.send('close-popup-window', type),
  closeAllPopups: () => ipcRenderer.send('close-all-popups'),
  getAiOverviewData: () => ipcRenderer.invoke('get-ai-overview-data'),
  getDownloadPanelData: () => ipcRenderer.invoke('get-download-panel-data'),
  onLoadAuthToken: (callback) => {
    const subscription = (event, token) => callback(token);
    ipcRenderer.on('load-auth-token', subscription);
    return () => ipcRenderer.removeListener('load-auth-token', subscription);
  },
  saveAuthToken: (args) => ipcRenderer.send('save-auth-token', args),
  getAuthToken: () => ipcRenderer.invoke('get-auth-token'),
  getUserInfo: () => ipcRenderer.invoke('get-user-info'),
  clearAuth: () => ipcRenderer.send('clear-auth'),

  // Gmail API
  testGeminiApi: (apiKey) => ipcRenderer.invoke('test-gemini-api', apiKey),
  gmailAuthorize: () => ipcRenderer.invoke('gmail-authorize'),
  gmailListMessages: (query, maxResults) => ipcRenderer.invoke('gmail-list-messages', query, maxResults),
  gmailGetMessage: (messageId) => ipcRenderer.invoke('gmail-get-message', messageId),
  gmailSendMessage: (to, subject, body, threadId) => ipcRenderer.invoke('gmail-send-message', to, subject, body, threadId),
  gmailAddLabelToMessage: (messageId, labelName) => ipcRenderer.invoke('gmail-add-label-to-message', messageId, labelName),
  onGmailOAuthCode: (callback) => { // New event listener for OAuth code
    const subscription = (event, code) => callback(code);
    ipcRenderer.on('gmail-oauth-code', subscription);
    return () => ipcRenderer.removeListener('gmail-oauth-code', subscription);
  },

  // Dev-MCP & Analytics
  sendMcpCommand: (command, data) => ipcRenderer.invoke('mcp-command', { command, data }),
  shareDeviceFolder: () => ipcRenderer.invoke('share-device-folder'),
  capturePageHtml: () => ipcRenderer.invoke('capture-page-html'),
  saveOfflinePage: (data) => ipcRenderer.invoke('save-offline-page', data),
  generatePDF: (title, content) => ipcRenderer.invoke('generate-pdf', title, content),
  openPDF: (filePath) => ipcRenderer.invoke('open-pdf', filePath),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),

  // Utils
  setUserId: (userId) => ipcRenderer.send('set-user-id', userId),
  getClipboardText: () => ipcRenderer.invoke('get-clipboard-text'),
  setClipboardText: (text) => ipcRenderer.send('set-clipboard-text', text),

  // Extension & File Utils
  getExtensionPath: () => ipcRenderer.invoke('get-extension-path'),
  getIconPath: () => ipcRenderer.invoke('get-icon-path'),
  getExtensions: () => ipcRenderer.invoke('get-extensions'),
  toggleExtension: (id) => ipcRenderer.invoke('toggle-extension', id),
  uninstallExtension: (id) => ipcRenderer.invoke('uninstall-extension', id),
  openExtensionDir: () => ipcRenderer.send('open-extension-dir'),
  toggleAdblocker: (enable) => ipcRenderer.send('toggle-adblocker', enable),

  // Window Controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
  setAsDefaultBrowser: () => ipcRenderer.invoke('set-as-default-browser'),
  hideWebview: () => ipcRenderer.send('hide-webview'),
  showWebview: () => ipcRenderer.send('show-webview'),

  // Chat & File Export
  exportChatAsTxt: (messages) => ipcRenderer.invoke('export-chat-txt', messages),
  exportChatAsPdf: (messages) => ipcRenderer.invoke('export-chat-pdf', messages),
  sendAiOverviewData: (data) => ipcRenderer.send('send-ai-overview-to-sidebar', data),
  sendDownloadPanelData: (data) => ipcRenderer.send('send-download-panel-data', data),
  closeAiOverview: () => ipcRenderer.send('close-ai-overview'),

  // MCP Support
  mcpCommand: (command, data) => ipcRenderer.invoke('mcp-command', { command, data }),

  // Database & Sync
  initDatabase: (config) => ipcRenderer.invoke('init-database', config),
  syncData: (params) => ipcRenderer.invoke('sync-data', params),

  // P2P File Sync
  scanFolder: (path, types) => ipcRenderer.invoke('scan-folder', { path, types }),
  readFileBuffer: (path) => ipcRenderer.invoke('read-file-buffer', path),

  // Phone Control
  sendPhoneCommand: (command, data) => ipcRenderer.invoke('send-phone-command', { command, data }),

  // Contacts
  getDeviceContacts: () => ipcRenderer.invoke('get-device-contacts'),
  syncContacts: (deviceId, contacts) => ipcRenderer.invoke('sync-contacts', { deviceId, contacts }),

  // OTP
  startSMSListener: () => ipcRenderer.invoke('start-sms-listener'),
  startEmailListener: () => ipcRenderer.invoke('start-email-listener'),
  syncOTP: (otp) => ipcRenderer.invoke('sync-otp', otp),
  requestSMSPermission: () => ipcRenderer.invoke('request-sms-permission'),
  onShortcut: (callback) => {
    const subscription = (event, action) => callback(action);
    ipcRenderer.on('execute-shortcut', subscription);
    return () => ipcRenderer.removeListener('execute-shortcut', subscription);
  },
  updateShortcuts: (shortcuts) => ipcRenderer.send('update-shortcuts', shortcuts),
  setAlarm: (time, message) => ipcRenderer.invoke('set-alarm', { time, message }),

  // Tab Optimization APIs
  suspendTab: (tabId) => ipcRenderer.send('suspend-tab', tabId),
  resumeTab: (args) => ipcRenderer.send('resume-tab', args),
  onTabSuspended: (callback) => {
    const subscription = (event, tabId) => callback(tabId);
    ipcRenderer.on('tab-suspended', subscription);
    return () => ipcRenderer.removeListener('tab-suspended', subscription);
  },
  onTabResumed: (callback) => {
    const subscription = (event, tabId) => callback(tabId);
    ipcRenderer.on('tab-resumed', subscription);
    return () => ipcRenderer.removeListener('tab-resumed', subscription);
  },
  onResumeTabAndActivate: (callback) => {
    const subscription = (event, tabId) => callback(tabId);
    ipcRenderer.on('resume-tab-and-activate', subscription);
    return () => ipcRenderer.removeListener('resume-tab-and-activate', subscription);
  },
  getMemoryUsage: () => ipcRenderer.invoke('get-memory-usage'),
  pullOllamaModel: (model, callback) => {
    ipcRenderer.send('ollama-pull-model', model);
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('ollama-pull-progress', subscription);
    return () => ipcRenderer.removeListener('ollama-pull-progress', subscription);
  },

  importOllamaModel: (data) => ipcRenderer.invoke('ollama-import-model', data),
  selectLocalFile: () => ipcRenderer.invoke('select-local-file'),
  triggerDownload: (url, filename) => ipcRenderer.invoke('trigger-download', url, filename),
  setMcpServerPort: (port) => ipcRenderer.send('set-mcp-server-port', port),
  sendToAIChatInput: (text) => ipcRenderer.send('send-to-ai-chat-input', text),
  ollamaListModels: () => ipcRenderer.invoke('ollama-list-models'),
  connectToRemoteDevice: (remoteDeviceId) => ipcRenderer.invoke('connect-to-remote-device', remoteDeviceId),
  sendP2PSignal: (signal, remoteDeviceId) => ipcRenderer.send('send-p2p-signal', { signal, remoteDeviceId }),

  onP2PConnected: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('p2p-connected', subscription);
    return () => ipcRenderer.removeListener('p2p-connected', subscription);
  },
  onP2PDisconnected: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('p2p-disconnected', subscription);
    return () => ipcRenderer.removeListener('p2p-disconnected', subscription);
  },
  onP2PFirebaseReady: (callback) => {
    const subscription = (event, userId) => callback(userId);
    ipcRenderer.on('p2p-firebase-ready', subscription);
    return () => ipcRenderer.removeListener('p2p-firebase-ready', subscription);
  },
  onP2POfferCreated: (callback) => {
    const subscription = (event, { offer, remoteDeviceId }) => callback({ offer, remoteDeviceId });
    ipcRenderer.on('p2p-offer-created', subscription);
    return () => ipcRenderer.removeListener('p2p-offer-created', subscription);
  },
  onP2PAnswerCreated: (callback) => {
    const subscription = (event, { answer, remoteDeviceId }) => callback({ answer, remoteDeviceId });
    ipcRenderer.on('p2p-answer-created', subscription);
    return () => ipcRenderer.removeListener('p2p-answer-created', subscription);
  },
  onP2PIceCandidate: (callback) => {
    const subscription = (event, { candidate, remoteDeviceId }) => callback({ candidate, remoteDeviceId });
    ipcRenderer.on('p2p-ice-candidate', subscription);
    return () => ipcRenderer.removeListener('p2p-ice-candidate', subscription);
  },
  onP2PLocalDeviceId: (callback) => {
    const subscription = (event, deviceId) => callback(deviceId);
    ipcRenderer.on('p2p-local-device-id', subscription);
    return () => ipcRenderer.removeListener('p2p-local-device-id', subscription);
  },
  onP2PMessage: (callback) => {
    const subscription = (event, message) => callback(message);
    ipcRenderer.on('p2p-message', subscription);
    return () => ipcRenderer.removeListener('p2p-message', subscription);
  },
  getP2PLocalDeviceId: () => ipcRenderer.invoke('p2p-get-device-id'),
  on: (channel, callback) => {
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },

  saveAiResponse: (content) => ipcRenderer.send('save-ai-response', content),

  // Persistent Storage APIs for user data
  savePersistentData: (key, data) => ipcRenderer.invoke('save-persistent-data', { key, data }),
  loadPersistentData: (key) => ipcRenderer.invoke('load-persistent-data', key),
  deletePersistentData: (key) => ipcRenderer.invoke('delete-persistent-data', key),

  // Network status
  onNetworkStatusChanged: (callback) => {
    const subscription = (event, isOnline) => callback(isOnline);
    ipcRenderer.on('network-status-changed', subscription);
    return () => ipcRenderer.removeListener('network-status-changed', subscription);
  },

  // Clipboard monitoring
  onClipboardChanged: (callback) => {
    const subscription = (event, text) => callback(text);
    ipcRenderer.on('clipboard-changed', subscription);
    return () => ipcRenderer.removeListener('clipboard-changed', subscription);
  },

  // AI chat input
  onAIChatInputText: (callback) => {
    const subscription = (event, text) => callback(text);
    ipcRenderer.on('ai-chat-input-text', subscription);
    return () => ipcRenderer.removeListener('ai-chat-input-text', subscription);
  },

  // Popup Window System - Fix for panels appearing behind browser view
  openPopupWindow: (type, options) => ipcRenderer.send('open-popup-window', { type, options }),
  closePopupWindow: (type) => ipcRenderer.send('close-popup-window', type),
  closeAllPopups: () => ipcRenderer.send('close-all-popups'),

  // Specific popup handlers
  openSettingsPopup: (section) => ipcRenderer.send('open-settings-popup', section),
  openProfilePopup: () => ipcRenderer.send('open-profile-popup'),
  openPluginsPopup: () => ipcRenderer.send('open-plugins-popup'),
  openDownloadsPopup: () => ipcRenderer.send('open-downloads-popup'),
  openClipboardPopup: () => ipcRenderer.send('open-clipboard-popup'),
  openCartPopup: () => ipcRenderer.send('open-cart-popup'),
  openSearchPopup: (options) => ipcRenderer.send('open-search-popup', options),
  openTranslatePopup: (options) => ipcRenderer.send('open-translate-popup', options),
  openContextMenuPopup: (options) => ipcRenderer.send('open-context-menu-popup', options),

  // Listen for settings section changes (for popup windows)
  onSetSettingsSection: (callback) => {
    const subscription = (event, section) => callback(section);
    ipcRenderer.on('set-settings-section', subscription);
    return () => ipcRenderer.removeListener('set-settings-section', subscription);
  },

  // Google OAuth Integration
  googleOAuthLogin: () => ipcRenderer.send('google-oauth-login'),
  onGoogleOAuthCode: (callback) => {
    const subscription = (event, code) => callback(code);
    ipcRenderer.on('google-oauth-code', subscription);
    return () => ipcRenderer.removeListener('google-oauth-code', subscription);
  },

  // Shell Command Execution (for brightness, volume, WiFi, Bluetooth, etc.)
  executeShellCommand: (command, preApproved = false) => ipcRenderer.invoke('execute-shell-command', { rawCommand: command, preApproved }),
  setVolume: (level) => ipcRenderer.invoke('set-volume', level),
  setBrightness: (level) => ipcRenderer.invoke('set-brightness', level),

  // System Settings
  openSystemSettings: (url) => ipcRenderer.invoke('open-system-settings', url),
  closeAuthWindow: () => ipcRenderer.send('close-auth-window'),
  updateRaycastState: (state) => ipcRenderer.send('raycast-update-state', state),

  // Cross-App Control APIs
  captureScreenRegion: (region) => ipcRenderer.invoke('capture-screen-region', region),
  searchApplications: (query) => ipcRenderer.invoke('search-applications', query),
  openExternalApp: (appPath) => ipcRenderer.invoke('open-external-app', appPath),
  performCrossAppClick: (coords) => ipcRenderer.invoke('perform-click', coords), // Use improved backend
  performClick: (options) => ipcRenderer.invoke('perform-click', options), // New API
  performOCR: (options) => ipcRenderer.invoke('perform-ocr', options),
  getWindowInfo: () => ipcRenderer.invoke('get-window-info'),

  // Unified Search Event Listener
  onOpenUnifiedSearch: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('open-unified-search', subscription);
    return () => ipcRenderer.removeListener('open-unified-search', subscription);
  },

  // WiFi Sync (Mobile to Desktop)
  getWifiSyncQr: () => ipcRenderer.invoke('get-wifi-sync-qr'),
  getWifiSyncInfo: () => ipcRenderer.invoke('get-wifi-sync-info'),
  onWifiSyncStatus: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('wifi-sync-status', subscription);
    return () => ipcRenderer.removeListener('wifi-sync-status', subscription);
  },
  onRemoteAiPrompt: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('remote-ai-prompt', subscription);
    return () => ipcRenderer.removeListener('remote-ai-prompt', subscription);
  },
  // Generic listener support
  on: (channel, callback) => {
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  onAiChatInputText: (callback) => {
    const subscription = (event, text) => callback(text);
    ipcRenderer.on('ai-chat-input-text', subscription);
    return () => ipcRenderer.removeListener('ai-chat-input-text', subscription);
  },

  // ============================================================================
  // Desktop Automation v2 — Permission, Robot, OCR, Vision APIs
  // ============================================================================

  // Permission Store
  permGrant: (key, level, description, sessionOnly) =>
    ipcRenderer.invoke('perm-grant', { key, level, description, sessionOnly }),
  permRevoke: (key) => ipcRenderer.invoke('perm-revoke', key),
  permRevokeAll: () => ipcRenderer.invoke('perm-revoke-all'),
  permCheck: (key) => ipcRenderer.invoke('perm-check', key),
  permList: () => ipcRenderer.invoke('perm-list'),
  permAuditLog: (limit) => ipcRenderer.invoke('perm-audit-log', limit),

  // Security Settings
  getSecuritySettings: () => ipcRenderer.invoke('security-settings-get'),
  updateSecuritySettings: (settings) => ipcRenderer.invoke('security-settings-update', settings),
  setAutoApprovalCommand: (payload) => ipcRenderer.invoke('permission-auto-command', payload),
  getAutoApprovedCommands: () => ipcRenderer.invoke('permission-auto-commands'),

  // Robot Service (gated desktop automation)
  robotExecute: (action) => ipcRenderer.invoke('robot-execute', action),
  robotExecuteSequence: (actions, options) =>
    ipcRenderer.invoke('robot-execute-sequence', { actions, options }),
  robotKill: () => ipcRenderer.invoke('robot-kill'),
  robotResetKill: () => ipcRenderer.invoke('robot-reset-kill'),
  robotStatus: () => ipcRenderer.invoke('robot-status'),
  onRobotKilled: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('robot-killed', subscription);
    return () => ipcRenderer.removeListener('robot-killed', subscription);
  },

  // Tesseract OCR v2 (with sharp preprocessing + AI resolution)
  ocrCaptureWords: (displayId) => ipcRenderer.invoke('ocr-capture-words', displayId),
  ocrClick: (target, useAi) => ipcRenderer.invoke('ocr-click', { target, useAi }),
  ocrScreenText: (displayId) => ipcRenderer.invoke('ocr-screen-text', displayId),

  // Screen Vision AI
  visionDescribe: (question) => ipcRenderer.invoke('vision-describe', question),
  visionAnalyze: (question) => ipcRenderer.invoke('vision-analyze', question),
  visionCaptureBase64: () => ipcRenderer.invoke('vision-capture-base64'),

  // AI Engine (direct multi-provider chat for automation)
  aiEngineChat: (opts) => ipcRenderer.invoke('ai-engine-chat', opts),
  aiEngineConfigure: (keys) => ipcRenderer.invoke('ai-engine-configure', keys),

  // Flutter Bridge
  bridgeGetPairingCode: () => ipcRenderer.invoke('bridge-get-pairing-code'),
  bridgeGetStatus: () => ipcRenderer.invoke('bridge-get-status'),
  bridgeRotateSecret: () => ipcRenderer.invoke('bridge-rotate-secret'),
  bridgeBroadcast: (message) => ipcRenderer.invoke('bridge-broadcast', message),

  // MCP Desktop — FileSystem (sandboxed)
  mcpFsRead: (filePath) => ipcRenderer.invoke('mcp-fs-read', filePath),
  mcpFsWrite: (filePath, content) => ipcRenderer.invoke('mcp-fs-write', { path: filePath, content }),
  mcpFsList: (dirPath) => ipcRenderer.invoke('mcp-fs-list', dirPath),
  mcpFsApprovedDirs: () => ipcRenderer.invoke('mcp-fs-approved-dirs'),

  // MCP Desktop — NativeApp (AppleScript/PowerShell)
  mcpNativeApplescript: (script) => ipcRenderer.invoke('mcp-native-applescript', script),
  mcpNativePowershell: (script) => ipcRenderer.invoke('mcp-native-powershell', script),
  mcpNativeActiveWindow: () => ipcRenderer.invoke('mcp-native-active-window'),

  // MCP Core (SSE / Stdio transports)
  mcpConnectServer: (config) => ipcRenderer.invoke('mcp-connect-server', config),
  mcpDisconnectServer: (id) => ipcRenderer.invoke('mcp-disconnect-server', id),
  mcpListServers: () => ipcRenderer.invoke('mcp-list-servers'),
  mcpGetTools: () => ipcRenderer.invoke('mcp-get-tools'),

  // RAG — Local Vector Store
  ragIngest: (text, source) => ipcRenderer.invoke('rag-ingest', { text, source }),
  ragRetrieve: (query, k) => ipcRenderer.invoke('rag-retrieve', { query, k }),
  ragContext: (query, k) => ipcRenderer.invoke('rag-context', { query, k }),
  ragStats: () => ipcRenderer.invoke('rag-stats'),
  ragDeleteSource: (source) => ipcRenderer.invoke('rag-delete-source', source),
  ragClear: () => ipcRenderer.invoke('rag-clear'),

  // Voice Control (Whisper)
  voiceTranscribe: (audioBase64, format) => ipcRenderer.invoke('voice-transcribe', { audioBase64, format }),
  voiceMicPermission: () => ipcRenderer.invoke('voice-mic-permission'),

  // Workflow Recorder
  workflowStart: () => ipcRenderer.invoke('workflow-start'),
  workflowRecord: (type, action) => ipcRenderer.invoke('workflow-record', { type, action }),
  workflowStop: () => ipcRenderer.invoke('workflow-stop'),
  workflowSave: (name, description) => ipcRenderer.invoke('workflow-save', { name, description }),
  workflowList: () => ipcRenderer.invoke('workflow-list'),
  workflowReplay: (name) => ipcRenderer.invoke('workflow-replay', name),
  workflowDelete: (name) => ipcRenderer.invoke('workflow-delete', name),
  workflowStatus: () => ipcRenderer.invoke('workflow-status'),

  // PopSearch - Instant Search Popup
  popSearchShow: (text, x, y) => ipcRenderer.invoke('pop-search-show', { text, x, y }),
  popSearchShowAtCursor: (text) => ipcRenderer.invoke('pop-search-show-at-cursor', text),
  popSearchGetConfig: () => ipcRenderer.invoke('pop-search-get-config'),
  popSearchUpdateConfig: (config) => ipcRenderer.invoke('pop-search-update-config', config),
  popSearchSaveConfig: (data) => ipcRenderer.invoke('pop-search-save-config', data),
  popSearchLoadConfig: () => ipcRenderer.invoke('pop-search-load-config'),

  // WiFi Sync
  wifiSyncBroadcast: (message) => ipcRenderer.invoke('wifi-sync-broadcast', message),
  getWifiSyncUri: () => ipcRenderer.invoke('get-wifi-sync-uri'),
  getWifiSyncQr: () => ipcRenderer.invoke('get-wifi-sync-qr'),
  getWifiSyncInfo: () => ipcRenderer.invoke('get-wifi-sync-info'),
  generateHighRiskQr: (actionId) => ipcRenderer.invoke('generate-high-risk-qr', actionId),
  onMobileApproveHighRisk: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('mobile-approve-high-risk', subscription);
    return () => ipcRenderer.removeListener('mobile-approve-high-risk', subscription);
  },

  // Scheduling & Automation
  scheduleTask: (taskData) => ipcRenderer.invoke('automation:create-task', taskData),
  getScheduledTasks: () => ipcRenderer.invoke('automation:get-tasks'),
  getScheduledTask: (taskId) => ipcRenderer.invoke('automation:get-task', taskId),
  updateScheduledTask: (taskId, updates) => ipcRenderer.invoke('automation:update-task', taskId, updates),
  deleteScheduledTask: (taskId) => ipcRenderer.invoke('automation:delete-task', taskId),
  toggleScheduledTask: (taskId) => ipcRenderer.invoke('automation:toggle-task', taskId),
  runScheduledTask: (taskId) => ipcRenderer.invoke('automation:run-task', taskId),
  getTaskLogs: (date) => ipcRenderer.invoke('automation:get-logs', date),
  getTaskResults: (taskId) => ipcRenderer.invoke('automation:get-results', taskId),

  // Window utilities
  bringWindowToTop: () => ipcRenderer.invoke('bring-window-to-top'),
  getAppIcon: () => ipcRenderer.invoke('get-app-icon-base64'),
});
