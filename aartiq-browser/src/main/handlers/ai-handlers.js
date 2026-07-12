const { ipcMain } = require('electron');

const nativeKeychain = (() => {
  try { return require('../../lib/native-keychain'); }
  catch (e) { return null; }
})();

const API_KEY_SERVICE = 'com.aartiq.apikeys';

async function storeApiKey(account, apiKey) {
  if (!nativeKeychain || !account || !apiKey) return false;
  try {
    await nativeKeychain.addPassword({
      service: API_KEY_SERVICE,
      account,
      password: apiKey,
      label: `Aartiq API Key: ${account}`,
    });
    return true;
  } catch (e) {
    console.warn('[Keychain] Failed to store API key for', account, ':', e.message);
    return false;
  }
}

async function readApiKey(account) {
  if (!nativeKeychain || !account) return null;
  try {
    const result = await nativeKeychain.getPassword({
      service: API_KEY_SERVICE,
      account,
    });
    return result?.success ? result.password : null;
  } catch {
    return null;
  }
}

const API_KEY_MAP = {
  openai: 'openai_api_key',
  'azure-openai': 'azure_openai_api_key',
  google: 'gemini_api_key',
  'google-flash': 'gemini_api_key',
  anthropic: 'anthropic_api_key',
  groq: 'groq_api_key',
  xai: 'xai_api_key',
};

module.exports = function registerAiHandlers(ipcMain, handlers) {
  const { store, cometAiEngine, llmProviders, llmGenerateHandler, llmStreamHandler } = handlers;

  ipcMain.handle('llm-get-available-providers', () => llmProviders);

  ipcMain.handle('llm-get-provider-models', async (event, providerId, options = {}) => {
    const { getProviderModels } = require('./ai-utils.js');
    return await getProviderModels(providerId, options, store);
  });

  ipcMain.handle('llm-set-active-provider', (event, providerId) => {
    store.set('active_llm_provider', providerId);
    return true;
  });

  ipcMain.handle('llm-configure-provider', async (event, providerId, options) => {
    if (options.apiKey) {
      await storeApiKey(providerId, options.apiKey);
      const legacyKey = API_KEY_MAP[providerId];
      if (legacyKey) store.set(legacyKey, options.apiKey);
    }
    if (providerId === 'google') {
      if (options.model) store.set('gemini_model', options.model);
    }
    if (providerId === 'google-flash') {
      if (options.model) store.set('gemini_flash_model', options.model);
    }
    if (providerId === 'openai') {
      if (options.model) store.set('openai_model', options.model);
    }
    if (providerId === 'azure-openai') {
      if (options.baseUrl) store.set('azure_openai_endpoint', options.baseUrl);
      if (options.model) store.set('azure_openai_model', options.model);
    }
    if (providerId === 'anthropic') {
      if (options.model) store.set('anthropic_model', options.model);
    }
    if (providerId === 'xai') {
      if (options.model) store.set('xai_model', options.model);
    }
    if (providerId === 'groq') {
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
    if (keys.GEMINI_API_KEY) {
      await storeApiKey('google', keys.GEMINI_API_KEY);
      store.set('gemini_api_key', keys.GEMINI_API_KEY);
    }
    if (keys.GROQ_API_KEY) {
      await storeApiKey('groq', keys.GROQ_API_KEY);
      store.set('groq_api_key', keys.GROQ_API_KEY);
    }
    if (keys.OPENAI_API_KEY) {
      await storeApiKey('openai', keys.OPENAI_API_KEY);
      store.set('openai_api_key', keys.OPENAI_API_KEY);
    }
    if (keys.AZURE_OPENAI_API_KEY) {
      await storeApiKey('azure-openai', keys.AZURE_OPENAI_API_KEY);
      store.set('azure_openai_api_key', keys.AZURE_OPENAI_API_KEY);
    }
    if (keys.AZURE_OPENAI_BASE_URL) store.set('azure_openai_endpoint', keys.AZURE_OPENAI_BASE_URL);
    if (keys.ANTHROPIC_API_KEY) {
      await storeApiKey('anthropic', keys.ANTHROPIC_API_KEY);
      store.set('anthropic_api_key', keys.ANTHROPIC_API_KEY);
    }
    return { success: true };
  });

  ipcMain.handle('test-gemini-api', async (event, apiKey) => {
    const { testGeminiApi } = require('./ai-utils.js');
    return await testGeminiApi(apiKey);
  });

  ipcMain.handle('get-stored-api-keys', async () => {
    const [openaiKey, geminiKey, anthropicKey, groqKey, xaiKey, azureKey] = await Promise.all([
      readApiKey('openai'),
      readApiKey('google'),
      readApiKey('anthropic'),
      readApiKey('groq'),
      readApiKey('xai'),
      readApiKey('azure-openai'),
    ]);

    return {
      openai_api_key: openaiKey || store.get('openai_api_key') || '',
      openai_model: store.get('openai_model') || '',
      azure_openai_api_key: azureKey || store.get('azure_openai_api_key') || '',
      azure_openai_endpoint: store.get('azure_openai_endpoint') || '',
      azure_openai_model: store.get('azure_openai_model') || 'gpt-4.1-mini',
      gemini_api_key: geminiKey || store.get('gemini_api_key') || '',
      gemini_model: store.get('gemini_model') || '',
      gemini_flash_model: store.get('gemini_flash_model') || '',
      anthropic_api_key: anthropicKey || store.get('anthropic_api_key') || '',
      anthropic_model: store.get('anthropic_model') || '',
      groq_api_key: groqKey || store.get('groq_api_key') || '',
      groq_model: store.get('groq_model') || '',
      xai_api_key: xaiKey || store.get('xai_api_key') || '',
      xai_model: store.get('xai_model') || '',
      ollama_base_url: store.get('ollama_base_url') || 'http://127.0.0.1:11434',
      ollama_model: store.get('ollama_model') || '',
      ollama_enabled: store.get('ollama_enabled') !== false,
      active_llm_provider: store.get('active_llm_provider') || 'ollama',
    };
  });

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