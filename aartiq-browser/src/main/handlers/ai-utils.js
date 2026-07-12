const {
  CATALOG_TTL_MS,
  PROVIDER_API_KEY_STORE_KEYS,
  fetchProviderModelCatalog,
  getProviderFallbackModel,
  getProviderLabel,
} = require('../../lib/provider-model-discovery');

const LLM_MODEL_CATALOG_STORE_KEY = 'llm_model_catalogs_v1';

function getCachedProviderCatalogs(store) {
  const cached = store.get(LLM_MODEL_CATALOG_STORE_KEY);
  return cached && typeof cached === 'object' ? cached : {};
}

function saveCachedProviderCatalog(store, providerId, catalog) {
  const cachedCatalogs = getCachedProviderCatalogs(store);
  cachedCatalogs[providerId] = catalog;
  store.set(LLM_MODEL_CATALOG_STORE_KEY, cachedCatalogs);
}

function getConfiguredProviderApiKey(store, providerId) {
  const storeKey = PROVIDER_API_KEY_STORE_KEYS[providerId];
  return (storeKey && store.get(storeKey)) || '';
}

async function getProviderModels(providerId, options = {}, store) {
  if (!store) {
    return {
      success: false,
      providerId,
      models: [],
      recommendedModel: getProviderFallbackModel(providerId),
      error: 'Store not available.',
    };
  }

  const forceRefresh = options.forceRefresh === true;
  const cachedCatalogs = getCachedProviderCatalogs(store);
  const cachedCatalog = cachedCatalogs[providerId];

  if (
    !forceRefresh &&
    cachedCatalog &&
    cachedCatalog.fetchedAt &&
    Date.now() - cachedCatalog.fetchedAt < CATALOG_TTL_MS
  ) {
    return cachedCatalog;
  }

  try {
    const catalog = await fetchProviderModelCatalog(providerId, {
      apiKey: getConfiguredProviderApiKey(store, providerId),
    });

    if (catalog.success) {
      saveCachedProviderCatalog(store, providerId, catalog);
      return catalog;
    }

    if (cachedCatalog && !forceRefresh) {
      return cachedCatalog;
    }

    return catalog;
  } catch (error) {
    if (cachedCatalog && !forceRefresh) {
      return {
        ...cachedCatalog,
        warning: error.message,
      };
    }

    return {
      success: false,
      providerId,
      providerName: getProviderLabel(providerId),
      models: [],
      recommendedModel: getProviderFallbackModel(providerId),
      error: error.message,
    };
  }
}

async function testGeminiApi(apiKey) {
  try {
    const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
    const { generateText } = await import('ai');

    const google = createGoogleGenerativeAI({ apiKey });

    const result = await generateText({
      model: google('gemini-1.5-flash'),
      prompt: 'Identity check. Respond with "passed".',
    });

    if (result.text.toLowerCase().includes('passed')) {
      return { success: true };
    }
    return { success: false, error: 'Unexpected response from Gemini' };
  } catch (error) {
    console.error('Gemini API test failed:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { getProviderModels, testGeminiApi };
