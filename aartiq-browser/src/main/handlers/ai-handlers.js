const { ipcMain } = require('electron');

module.exports = function registerAiHandlers(ipcMain, handlers) {
  const { store, cometAiEngine, llmProviders, llmGenerateHandler, llmStreamHandler } = handlers;

  ipcMain.handle('llm-get-available-providers', () => llmProviders);

  ipcMain.handle('llm-get-provider-models', async (event, providerId, options = {}) => {
    const { getProviderModels } = require('./ai-utils.js');
    return await getProviderModels(providerId, options);
  });

  ipcMain.handle('llm-set-active-provider', (event, providerId) => {
    store.set('active_llm_provider', providerId);
    return true;
  });

  ipcMain.handle('llm-configure-provider', (event, providerId, options) => {
    if (providerId === 'google') {
      if (options.apiKey) store.set('gemini_api_key', options.apiKey);
      if (options.model) store.set('gemini_model', options.model);
    }
    if (providerId === 'google-flash') {
      if (options.apiKey) store.set('gemini_api_key', options.apiKey);
      if (options.model) store.set('gemini_flash_model', options.model);
    }
    if (providerId === 'openai') {
      if (options.apiKey) store.set('openai_api_key', options.apiKey);
      if (options.model) store.set('openai_model', options.model);
    }
    if (providerId === 'azure-openai') {
      if (options.apiKey) store.set('azure_openai_api_key', options.apiKey);
      if (options.baseUrl) store.set('azure_openai_endpoint', options.baseUrl);
      if (options.model) store.set('azure_openai_model', options.model);
    }
    if (providerId === 'anthropic') {
      if (options.apiKey) store.set('anthropic_api_key', options.apiKey);
      if (options.model) store.set('anthropic_model', options.model);
    }
    if (providerId === 'xai') {
      if (options.apiKey) store.set('xai_api_key', options.apiKey);
      if (options.model) store.set('xai_model', options.model);
    }
    if (providerId === 'groq') {
      if (options.apiKey) store.set('groq_api_key', options.apiKey);
      if (options.model) store.set('groq_model', options.model);
    }
    if (providerId === 'ollama') {
      if (options.baseUrl) store.set('ollama_base_url', options.baseUrl);
      if (options.model) store.set('ollama_model', options.model);
      if (options.localLlmMode !== undefined) store.set('local_llm_mode', options.localLlmMode);
    }
    return true;
  });

  ipcMain.handle('llm-generate-chat-content', async (event, messages, options = {}) => {
    try {
      return await llmGenerateHandler(messages, options);
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.on('llm-stream-chat-content', (event, messages, options = {}) => {
    llmStreamHandler(event, messages, options);
  });

  ipcMain.handle('ai-engine-chat', async (event, { message, model, provider, systemPrompt, history }) => {
    if (!cometAiEngine) return { success: false, error: 'AI engine not initialized' };
    try {
      const response = await cometAiEngine.chat({ message, model, provider, systemPrompt, history });
      return { success: true, response };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('ai-engine-configure', async (event, keys) => {
    if (!cometAiEngine) return { success: false, error: 'AI engine not initialized' };
    cometAiEngine.configure(keys);
    if (keys.GEMINI_API_KEY) store.set('gemini_api_key', keys.GEMINI_API_KEY);
    if (keys.GROQ_API_KEY) store.set('groq_api_key', keys.GROQ_API_KEY);
    if (keys.OPENAI_API_KEY) store.set('openai_api_key', keys.OPENAI_API_KEY);
    if (keys.AZURE_OPENAI_API_KEY) store.set('azure_openai_api_key', keys.AZURE_OPENAI_API_KEY);
    if (keys.AZURE_OPENAI_BASE_URL) store.set('azure_openai_endpoint', keys.AZURE_OPENAI_BASE_URL);
    if (keys.ANTHROPIC_API_KEY) store.set('anthropic_api_key', keys.ANTHROPIC_API_KEY);
    return { success: true };
  });

  ipcMain.handle('test-gemini-api', async (event, apiKey) => {
    const { testGeminiApi } = require('./ai-utils.js');
    return await testGeminiApi(apiKey);
  });

  ipcMain.handle('get-stored-api-keys', () => ({
    openai_api_key: store.get('openai_api_key') || '',
    openai_model: store.get('openai_model') || '',
    azure_openai_api_key: store.get('azure_openai_api_key') || '',
    azure_openai_endpoint: store.get('azure_openai_endpoint') || '',
    azure_openai_model: store.get('azure_openai_model') || 'gpt-4.1-mini',
    gemini_api_key: store.get('gemini_api_key') || '',
    gemini_model: store.get('gemini_model') || '',
    gemini_flash_model: store.get('gemini_flash_model') || '',
    anthropic_api_key: store.get('anthropic_api_key') || '',
    anthropic_model: store.get('anthropic_model') || '',
    groq_api_key: store.get('groq_api_key') || '',
    groq_model: store.get('groq_model') || '',
    xai_api_key: store.get('xai_api_key') || '',
    xai_model: store.get('xai_model') || '',
    ollama_base_url: store.get('ollama_base_url') || 'http://127.0.0.1:11434',
    ollama_model: store.get('ollama_model') || '',
    ollama_enabled: store.get('ollama_enabled') !== false,
    active_llm_provider: store.get('active_llm_provider') || 'ollama',
  }));

  const userPrefsPath = require('path').join(require('electron').app.getPath('userData'), 'ai-user-preferences.json');
  function readUserPreferences() {
    try { return JSON.parse(require('fs').readFileSync(userPrefsPath, 'utf8') || '{}'); }
    catch { return {}; }
  }
  function writeUserPreferences(prefs) {
    try { require('fs').writeFileSync(userPrefsPath, JSON.stringify(prefs, null, 2)); }
    catch (e) { console.error('[UserPrefs] Save failed:', e.message); }
  }

  ipcMain.handle('user-preference:save', (event, { key, value }) => {
    const prefs = readUserPreferences();
    prefs[key] = { value, updatedAt: Date.now() };
    writeUserPreferences(prefs);
    return { success: true };
  });

  ipcMain.handle('user-preference:load-all', () => {
    return readUserPreferences();
  });

  ipcMain.handle('user-preference:delete', (event, key) => {
    const prefs = readUserPreferences();
    delete prefs[key];
    writeUserPreferences(prefs);
    return { success: true };
  });

  ipcMain.handle('ollama-list-models', async () => {
    try {
      const http = require('http');
      return new Promise((resolve) => {
        const req = http.get('http://localhost:11434/api/tags', (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              const models = (parsed.models || []).map(m => ({
                name: m.name,
                modified_at: m.modified_at,
              }));
              resolve({ models });
            } catch {
              resolve({ models: [], error: 'Failed to parse Ollama response' });
            }
          });
        });
        req.on('error', () => resolve({ models: [], error: 'Ollama not running' }));
        req.setTimeout(3000, () => { req.destroy(); resolve({ models: [], error: 'Ollama timeout' }); });
      });
    } catch {
      return { models: [], error: 'Ollama request failed' };
    }
  });

  console.log('[Handlers] AI handlers registered');
};