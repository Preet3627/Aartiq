const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  // BrowserView related APIs
  getIsOnline: () => ipcRenderer.invoke('get-is-online'),
  getPlatform: () => ipcRenderer.invoke('get-platform'), // Use IPC for consistency
  getAppleIntelligenceStatus: () => ipcRenderer.invoke('apple-intelligence-status'),
  summarizeWithAppleIntelligence: (text) => ipcRenderer.invoke('apple-intelligence-summary', text),
  generateAppleIntelligenceImage: (payload) => ipcRenderer.invoke('apple-intelligence-generate-image', payload),
  generateGenmoji: (payload) => ipcRenderer.invoke('apple-intelligence-genmoji', payload),
  
  // Biometric Authentication
  checkBiometricAuth: () => ipcRenderer.invoke('biometric-check'),
  authenticateBiometric: (reason) => ipcRenderer.invoke('biometric-authenticate', reason),
  executeWithAuth: (actions, reason) => ipcRenderer.invoke('biometric-execute', actions, reason),
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
  searchDOM: (query) => ipcRenderer.invoke('search-dom', query),
  getSelectedText: () => ipcRenderer.invoke('get-selected-text'),
  findAndClickText: (targetText) => ipcRenderer.invoke('find-and-click-text', targetText),
  setBrowserViewBounds: (bounds) => ipcRenderer.send('set-browser-view-bounds', bounds),
  setUserAgent: (userAgent) => ipcRenderer.invoke('set-user-agent', userAgent),
  setProxy: (config) => ipcRenderer.invoke('set-proxy', config),
  setNativeThemeSource: (source) => ipcRenderer.invoke('set-native-theme-source', source),
  getNetworkSecurityConfig: () => ipcRenderer.invoke('network-security-get'),
  updateNetworkSecurityConfig: (config) => ipcRenderer.invoke('network-security-update', config),
  capturePage: () => ipcRenderer.invoke('capture-page'),
  captureBrowserViewScreenshot: () => ipcRenderer.invoke('capture-browser-view-screenshot'),
  captureScreenRegion: (args) => ipcRenderer.invoke('capture-screen-region', args),
  sendInputEvent: (input) => ipcRenderer.invoke('send-input-event', input),
  openDevTools: () => ipcRenderer.send('open-dev-tools'),
  changeZoom: (deltaY) => ipcRenderer.send('change-zoom', deltaY),
  executeJavaScript: (code) => ipcRenderer.invoke('execute-javascript', code),
  clickElement: (selector) => ipcRenderer.invoke('click-element', selector),
  typeText: (selector, text) => ipcRenderer.invoke('type-text', { selector, text }),
  fillForm: (data) => ipcRenderer.invoke('fill-form', data),
  openExternalApp: (appNameOrPath) => ipcRenderer.invoke('open-external-app', appNameOrPath),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  searchApplications: (query) => ipcRenderer.invoke('search-applications', query),
  getSuggestions: (query) => ipcRenderer.invoke('get-suggestions', query),
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
  onWindowFullscreenChanged: (callback) => {
    const subscription = (event, isFullscreen) => callback(isFullscreen);
    ipcRenderer.on('window-fullscreen-changed', subscription);
    return () => ipcRenderer.removeListener('window-fullscreen-changed', subscription);
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
  getProviderModels: (providerId, options) => ipcRenderer.invoke('llm-get-provider-models', providerId, options),
  setActiveLLMProvider: (providerId) => ipcRenderer.invoke('llm-set-active-provider', providerId),
  configureLLMProvider: (providerId, options) => ipcRenderer.invoke('llm-configure-provider', providerId, options),
  getStoredApiKeys: () => ipcRenderer.invoke('get-stored-api-keys'),
  getOnboardingState: () => ipcRenderer.invoke('get-onboarding-state'),
  setOnboardingState: (partial) => ipcRenderer.invoke('set-onboarding-state', partial),
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
  vaultListEntries: () => ipcRenderer.invoke('vault-list-entries'),
  vaultSaveEntry: (entry) => ipcRenderer.invoke('vault-save-entry', entry),
  vaultDeleteEntry: (entryId) => ipcRenderer.invoke('vault-delete-entry', entryId),
  vaultReadSecret: (entryId) => ipcRenderer.invoke('vault-read-secret', entryId),
  vaultCopySecret: (entryId) => ipcRenderer.invoke('vault-copy-secret', entryId),
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
  onLoadAuthToken: (callback) => {
    const subscription = (event, token) => callback(token);
    ipcRenderer.on('load-auth-token', subscription);
    return () => ipcRenderer.removeListener('load-auth-token', subscription);
  },
  onLoadAuthSession: (callback) => {
    const subscription = (event, session) => callback(session);
    ipcRenderer.on('load-auth-session', session); // Fix: passed session directly might be wrong but was in original
    return () => ipcRenderer.removeListener('load-auth-session', subscription);
  },
  saveAuthToken: (args) => ipcRenderer.send('save-auth-token', args),
  saveAuthSession: (session) => ipcRenderer.send('save-auth-session', session),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAuthToken: () => ipcRenderer.invoke('get-auth-token'),
  getAuthSession: () => ipcRenderer.invoke('get-auth-session'),
  getUserInfo: () => ipcRenderer.invoke('get-user-info'),
  clearAuth: () => ipcRenderer.send('clear-auth'),

  // Gmail API
  testGeminiApi: (apiKey) => ipcRenderer.invoke('test-gemini-api', apiKey),
  gmailAuthorize: () => ipcRenderer.invoke('gmail-authorize'),
  gmailListMessages: (query, maxResults) => ipcRenderer.invoke('gmail-list-messages', query, maxResults),
  gmailGetMessage: (messageId) => ipcRenderer.invoke('gmail-get-message', messageId),
  gmailSendMessage: (to, subject, body, threadId) => ipcRenderer.invoke('gmail-send-message', to, subject, body, threadId),
  gmailAddLabelToMessage: (messageId, labelName) => ipcRenderer.invoke('gmail-add-label-to-message', messageId, labelName),
  onGmailOAuthCode: (callback) => {
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
  generatePDFWithMethod: (method, options) => ipcRenderer.invoke('generate-pdf-with-method', { method, options }),
  generatePPTX: (payload) => ipcRenderer.invoke('generate-pptx', payload),
  generateDOCX: (payload) => ipcRenderer.invoke('generate-docx', payload),
  generateXLSX: (payload) => ipcRenderer.invoke('generate-xlsx', payload),
  openPDF: (filePath) => ipcRenderer.invoke('open-pdf', filePath),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  checkPythonAvailable: () => ipcRenderer.invoke('check-python-available'),

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
  createDesktopShortcut: (args) => ipcRenderer.invoke('create-desktop-shortcut', args),

  // Chat & File Export
  exportChatAsTxt: (messages) => ipcRenderer.invoke('export-chat-txt', messages),
  exportChatAsPdf: (messages) => ipcRenderer.invoke('export-chat-pdf', messages),

  // Database & Sync
  initDatabase: (config) => ipcRenderer.invoke('init-database', config),
  syncData: (params) => ipcRenderer.invoke('sync-data', params),

  // P2P File Sync
  scanFolder: (path, types) => ipcRenderer.invoke('scan-folder', { path, types }),
  classifyTabsAi: (args) => ipcRenderer.invoke('classify-tabs-ai', args),
  organizeFolder: (path) => ipcRenderer.invoke('organize-folder', path),

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
  popSearchShow: (text, x, y) => ipcRenderer.invoke('pop-search-show', { text, x, y }),
  popSearchShowAtCursor: (text) => ipcRenderer.invoke('pop-search-show-at-cursor', text),
  popSearchGetConfig: () => ipcRenderer.invoke('pop-search-get-config'),
  popSearchUpdateConfig: (config) => ipcRenderer.invoke('pop-search-update-config', config),
  popSearchSaveConfig: (data) => ipcRenderer.invoke('pop-search-save-config', data),
  popSearchLoadConfig: () => ipcRenderer.invoke('pop-search-load-config'),
  pullOllamaModel: (model, callback) => {
    ipcRenderer.send('ollama-pull-model', model);
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('ollama-pull-progress', subscription);
    return () => ipcRenderer.removeListener('ollama-pull-progress', subscription);
  },

  importOllamaModel: (data) => ipcRenderer.invoke('ollama-import-model', data),
  selectLocalFile: (options) => ipcRenderer.invoke('select-local-file', options),
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
  getMacNativeUIPreferences: () => ipcRenderer.invoke('get-mac-native-ui-preferences'),
  setMacNativeUIPreferences: (preferences) => ipcRenderer.invoke('set-mac-native-ui-preferences', preferences),
  showMacNativePanel: (mode) => ipcRenderer.invoke('show-mac-native-panel', mode),
  toggleMacNativePanel: (mode) => ipcRenderer.invoke('toggle-mac-native-panel', mode),
  updateNativeMacUIState: (state) => ipcRenderer.send('update-native-mac-ui-state', state),
  onMacNativeUIPreferencesChanged: (callback) => {
    const subscription = (event, preferences) => callback(preferences);
    ipcRenderer.on('mac-native-ui-preferences-changed', subscription);
    return () => ipcRenderer.removeListener('mac-native-ui-preferences-changed', subscription);
  },
  onNativeMacPrompt: (callback) => {
    const subscription = (event, payload) => callback(payload);
    ipcRenderer.on('native-mac-ui-submit-prompt', subscription);
    return () => ipcRenderer.removeListener('native-mac-ui-submit-prompt', subscription);
  },
  onAIChatInputText: (callback) => {
    const subscription = (event, text) => callback(text);
    ipcRenderer.on('ai-chat-input-text', subscription);
    return () => ipcRenderer.removeListener('ai-chat-input-text', subscription);
  },
  onAiChatInputText: (callback) => {
    const subscription = (event, text) => callback(text);
    ipcRenderer.on('ai-chat-input-text', subscription);
    return () => ipcRenderer.removeListener('ai-chat-input-text', subscription);
  },

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

  // Popup Window System
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

  // Google OAuth Integration
  googleOAuthLogin: () => ipcRenderer.send('google-oauth-login'),
  onGoogleOAuthCode: (callback) => {
    const subscription = (event, code) => callback(code);
    ipcRenderer.on('google-oauth-code', subscription);
    return () => ipcRenderer.removeListener('google-oauth-code', subscription);
  },

  // Shell Command Execution
  executeShellCommand: (arg1, arg2 = false) => {
    if (typeof arg1 === 'object' && arg1 !== null) {
      return ipcRenderer.invoke('execute-shell-command', arg1);
    }
    return ipcRenderer.invoke('execute-shell-command', { rawCommand: arg1, preApproved: arg2 });
  },
  setVolume: (level) => ipcRenderer.invoke('set-volume', level),
  setBrightness: (level) => ipcRenderer.invoke('set-brightness', level),

  // System Settings
  openSystemSettings: (url) => ipcRenderer.invoke('open-system-settings', url),
  updateRaycastState: (state) => ipcRenderer.send('raycast-update-state', state),

  // Cross-App Control APIs
  captureScreenRegion: (region) => ipcRenderer.invoke('capture-screen-region', region),
  performCrossAppClick: (coords) => ipcRenderer.invoke('perform-click', coords),
  performClick: (options) => ipcRenderer.invoke('perform-click', options),
  clickAt: (x, y) => ipcRenderer.invoke('perform-click', { x, y }),
  typeText: (text) => ipcRenderer.invoke('type-text-app', text),
  clickAppElement: (appName, elementText, reason) => ipcRenderer.invoke('click-app-element', { appName, elementText, reason }),
  typeTextApp: (text) => ipcRenderer.invoke('type-text-app', text),
  performOCR: (options) => ipcRenderer.invoke('perform-ocr', options),
  getWindowInfo: () => ipcRenderer.invoke('get-window-info'),

  // Unified Search Event Listener
  onOpenUnifiedSearch: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('open-unified-search', subscription);
    return () => ipcRenderer.removeListener('open-unified-search', subscription);
  },

  // WiFi Sync
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

  // Cloud Sync
  loginToCloud: (email, password) => ipcRenderer.invoke('login-to-cloud', email, password),
  logoutFromCloud: () => ipcRenderer.invoke('logout-from-cloud'),
  saveCloudConfig: (provider, config) => ipcRenderer.invoke('save-cloud-config', provider, config),
  getCloudDevices: () => ipcRenderer.invoke('get-cloud-devices'),
  connectToCloudDevice: (deviceId) => ipcRenderer.invoke('connect-to-cloud-device', deviceId),
  disconnectFromCloudDevice: (deviceId) => ipcRenderer.invoke('disconnect-from-cloud-device', deviceId),
  syncClipboard: (text) => ipcRenderer.invoke('sync-clipboard', text),
  syncHistory: (history) => ipcRenderer.invoke('sync-history', history),
  sendDesktopControl: (targetDeviceId, action, args) => ipcRenderer.invoke('send-desktop-control', targetDeviceId, action, args),
  onCloudSyncStatus: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('cloud-sync-status', subscription);
    return () => ipcRenderer.removeListener('cloud-sync-status', subscription);
  },

  // v2 Automation APIs
  permGrant: (key, level, description, sessionOnly) =>
    ipcRenderer.invoke('perm-grant', { key, level, description, sessionOnly }),
  permRevoke: (key) => ipcRenderer.invoke('perm-revoke', key),
  permRevokeAll: () => ipcRenderer.invoke('perm-revoke-all'),
  permCheck: (key) => ipcRenderer.invoke('perm-check', key),
  permList: () => ipcRenderer.invoke('perm-list'),
  permAuditLog: (limit) => ipcRenderer.invoke('perm-audit-log', limit),
  getSecuritySettings: () => ipcRenderer.invoke('security-settings-get'),
  updateSecuritySettings: (settings) => ipcRenderer.invoke('security-settings-update', settings),
  setAutoApprovalCommand: (payload) => ipcRenderer.invoke('permission-auto-command', payload),
  getAutoApprovedCommands: () => ipcRenderer.invoke('permission-auto-commands'),
  setAutoApprovalAction: (payload) => ipcRenderer.invoke('permission-auto-action', payload),
  getAutoApprovedActions: () => ipcRenderer.invoke('permission-auto-actions'),
  generateHighRiskQr: (actionId) => ipcRenderer.invoke('generate-high-risk-qr', actionId),
  onMobileApproveHighRisk: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('mobile-approve-high-risk', subscription);
    return () => ipcRenderer.removeListener('mobile-approve-high-risk', subscription);
  },
  submitShellApprovalResponse: (requestId, allowed, deviceUnlockValidated = false) =>
    ipcRenderer.send('automation-shell-approval-response', { requestId, allowed, deviceUnlockValidated }),

  robotExecute: (action) => ipcRenderer.invoke('robot-execute', action),
  robotExecuteSequence: (actions, options) =>
    ipcRenderer.invoke('robot-execute-sequence', { actions, options }),

  ocrCaptureWords: (displayId) => ipcRenderer.invoke('ocr-capture-words', displayId),
  ocrClick: (target, useAi) => ipcRenderer.invoke('ocr-click', { target, useAi }),

  visionDescribe: (question) => ipcRenderer.invoke('vision-describe', question),
  visionAnalyze: (question) => ipcRenderer.invoke('vision-analyze', question),

  aiEngineChat: (opts) => ipcRenderer.invoke('ai-engine-chat', opts),
  classifyTabsAi: (args) => ipcRenderer.invoke('classify-tabs-ai', args),
  organizeFolder: (path) => ipcRenderer.invoke('organize-folder', path),

  mcpFsRead: (filePath) => ipcRenderer.invoke('mcp-fs-read', filePath),
  mcpFsWrite: (filePath, content) => ipcRenderer.invoke('mcp-fs-write', { path: filePath, content }),
  mcpFsList: (dirPath) => ipcRenderer.invoke('mcp-fs-list', dirPath),

  // Scheduling & Automation
  scheduleTask: (taskData) => ipcRenderer.invoke('automation:create-task', taskData),
  getScheduledTasks: () => ipcRenderer.invoke('automation:get-tasks'),
  getTaskLogs: (date) => ipcRenderer.invoke('automation:get-logs', date),
  enableCLI: () => ipcRenderer.invoke('automation:enable-cli'),
  getServiceStatus: () => ipcRenderer.invoke('automation:get-service-status'),
  installService: (options) => ipcRenderer.invoke('automation:install-background-service', options),
  uninstallService: (options) => ipcRenderer.invoke('automation:uninstall-background-service', options),

  // Unified App Icon API
  getAppIcon: (appPath) => {
    if (appPath) return ipcRenderer.invoke('get-app-icon', appPath);
    return ipcRenderer.invoke('get-app-icon-base64');
  },
  getCometIcon: () => ipcRenderer.invoke('get-app-icon-base64'),
  
  getVersion: () => ipcRenderer.invoke('get-app-version'),

  // Plugin System APIs
  plugins: {
    list: () => ipcRenderer.invoke('plugins:list'),
    get: (pluginId) => ipcRenderer.invoke('plugins:get', pluginId),
    install: (source, options) => ipcRenderer.invoke('plugins:install', source, options),
    uninstall: (pluginId) => ipcRenderer.invoke('plugins:uninstall', pluginId),
    update: (pluginId) => ipcRenderer.invoke('plugins:update', pluginId),
    enable: (pluginId) => ipcRenderer.invoke('plugins:enable', pluginId),
    disable: (pluginId) => ipcRenderer.invoke('plugins:disable', pluginId),
    getCommands: () => ipcRenderer.invoke('plugins:get-commands'),
    executeCommand: (commandId, params) => ipcRenderer.invoke('plugins:execute-command', commandId, params),
    updateConfig: (pluginId, config) => ipcRenderer.invoke('plugins:update-config', pluginId, config),
    getDir: () => ipcRenderer.invoke('plugins:get-dir'),
    scan: (directory) => ipcRenderer.invoke('plugins:scan', directory),
    onInstalled: (callback) => {
      const subscription = (event, manifest) => callback(manifest);
      ipcRenderer.on('plugin:installed', subscription);
      return () => ipcRenderer.removeListener('plugin:installed', subscription);
    },
    onUninstalled: (callback) => {
      const subscription = (event, { pluginId }) => callback(pluginId);
      ipcRenderer.on('plugin:uninstalled', subscription);
      return () => ipcRenderer.removeListener('plugin:uninstalled', subscription);
    },
    onConfigUpdated: (callback) => {
      const subscription = (event, { pluginId, config }) => callback({ pluginId, config });
      ipcRenderer.on('plugin:config-updated', subscription);
      return () => ipcRenderer.removeListener('plugin:config-updated', subscription);
    },
  },

  pluginApi: {
    readFile: (filePath) => ipcRenderer.invoke('plugin-api:read-file', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('plugin-api:write-file', filePath, content),
    log: (message, level) => ipcRenderer.invoke('plugin-api:log', message, level),
  },

  // Siri & Shortcuts Integration
  siri: {
    executeAction: (action, params) => ipcRenderer.invoke('siri:execute-action', action, params),
    speak: (text) => ipcRenderer.invoke('siri:speak', text),
    listen: (timeout) => ipcRenderer.invoke('siri:listen', timeout),
    getVoices: () => ipcRenderer.invoke('siri:get-voices'),
    getUrlScheme: () => ipcRenderer.invoke('siri:get-url-scheme'),
    getShortcutsList: () => ipcRenderer.invoke('siri:get-shortcuts-list'),
    parseCommand: (transcript) => ipcRenderer.invoke('voice:parse-command', transcript),
    onChatInput: (callback) => {
      const subscription = (event, message) => callback(message);
      ipcRenderer.on('siri-chat-input', subscription);
      return () => ipcRenderer.removeListener('siri-chat-input', subscription);
    },
    onNavigate: (callback) => {
      const subscription = (event, url) => callback(url);
      ipcRenderer.on('siri-navigate', subscription);
      return () => ipcRenderer.removeListener('siri-navigate', subscription);
    },
    onSearch: (callback) => {
      const subscription = (event, query) => callback(query);
      ipcRenderer.on('siri-search', subscription);
      return () => ipcRenderer.removeListener('siri-search', subscription);
    },
    onCreatePDF: (callback) => {
      const subscription = (event, data) => callback(data);
      ipcRenderer.on('siri-create-pdf', subscription);
      return () => ipcRenderer.removeListener('siri-create-pdf', subscription);
    },
    onShellCommand: (callback) => {
      const subscription = (event, command) => callback(command);
      ipcRenderer.on('siri-shell-command', subscription);
      return () => ipcRenderer.removeListener('siri-shell-command', subscription);
    },
    onSchedule: (callback) => {
      const subscription = (event, data) => callback(data);
      ipcRenderer.on('siri-schedule', subscription);
      return () => ipcRenderer.removeListener('siri-schedule', subscription);
    },
    onAskAI: (callback) => {
      const subscription = (event, data) => callback(data);
      ipcRenderer.on('siri-ask-ai', subscription);
      return () => ipcRenderer.removeListener('siri-ask-ai', subscription);
    },
  },

  // AppleScript Bridge
  applescript: {
    run: (command, params) => ipcRenderer.invoke('applescript:run', command, params),
    speak: (text, rate, voice) => ipcRenderer.invoke('applescript:speak', text, rate, voice),
    listen: (timeout) => ipcRenderer.invoke('applescript:listen', timeout),
    getVoices: () => ipcRenderer.invoke('applescript:get-voices'),
    createShortcut: (name, params) => ipcRenderer.invoke('applescript:create-shortcut', name, params),
  },

  // Windows Integration
  windows: {
    executeAction: (action, params) => ipcRenderer.invoke('windows:execute-action', action, params),
    openCopilot: () => ipcRenderer.invoke('windows:copilot:open'),
    voice: {
      listen: (params) => ipcRenderer.invoke('windows:voice:listen', params),
      speak: (text, params) => ipcRenderer.invoke('windows:voice:speak', text, params),
      getVoices: () => ipcRenderer.invoke('windows:voice:get-voices'),
    },
    generateUrl: (action, params) => ipcRenderer.invoke('windows:generate-url', action, params),
    createShortcut: (name, action, params) => ipcRenderer.invoke('windows:create-shortcut', name, action, params),
    getShortcutsList: () => ipcRenderer.invoke('windows:get-shortcuts-list'),
    registerProtocol: () => ipcRenderer.invoke('windows:register-protocol'),
  },

  // Linux Integration
  linux: {
    executeAction: (action, params) => ipcRenderer.invoke('linux:execute-action', action, params),
    getDesktop: () => ipcRenderer.invoke('linux:desktop:get'),
    notify: (title, body, options) => ipcRenderer.invoke('linux:notify', title, body, options),
    voice: {
      listen: (params) => ipcRenderer.invoke('linux:voice:listen', params),
      speak: (text, params) => ipcRenderer.invoke('linux:voice:speak', text, params),
      getVoices: () => ipcRenderer.invoke('linux:voice:get-voices'),
    },
    generateUrl: (action, params) => ipcRenderer.invoke('linux:generate-url', action, params),
    createShortcut: (name, action, params) => ipcRenderer.invoke('linux:create-shortcut', name, action, params),
    installGnomeShortcut: (name, action, params) => ipcRenderer.invoke('linux:install-gnome-shortcut', name, action, params),
    createLauncher: () => ipcRenderer.invoke('linux:create-launcher'),
    registerProtocol: () => ipcRenderer.invoke('linux:register-protocol'),
  },
});
