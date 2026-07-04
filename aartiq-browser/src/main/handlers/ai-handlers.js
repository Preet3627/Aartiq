const { ipcMain } = require('electron');

module.exports = function registerAiHandlers(ipcMain, handlers) {
  const { store, cometAiEngine, llmProviders, llmGenerateHandler, llmStreamHandler } = handlers;

  ipcMain.handle('llm-get-available-providers', () => llmProviders);

  ipcMain.handle('llm-get-provider-models', async (event, providerId, options = {}) => {
    const { getProviderModels } = require('./ai-utils.js');
    return await getProviderModels(providerId, options);
  });

  ipcMain.handle('llm-set-active-provider', (event, providerId) => {
    store.set('ai_provider', providerId);
    return { success: true };
  });

  ipcMain.handle('llm-configure-provider', (event, providerId, options) => {
    store.set(`provider_${providerId}_config`, options);
    return { success: true };
  });

  ipcMain.handle('llm-generate-chat-content', async (event, messages, options = {}) => {
    try {
      return await llmGenerateHandler(messages, options);
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.on('llm-stream-chat-content', (event, messages, options = {}) => {
    llmStreamHandler(event.sender, messages, options);
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
    gemini: store.get('gemini_api_key') ? 'set' : '',
    openai: store.get('openai_api_key') ? 'set' : '',
    anthropic: store.get('anthropic_api_key') ? 'set' : '',
    groq: store.get('groq_api_key') ? 'set' : '',
    azure: store.get('azure_openai_api_key') ? 'set' : '',
  }));

  console.log('[Handlers] AI handlers registered');
};