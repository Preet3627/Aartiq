const PROVIDER_LABELS = {
  google: 'Google Gemini',
  'google-flash': 'Google Gemini Flash',
  openai: 'OpenAI',
  anthropic: 'Anthropic Claude',
  groq: 'Groq',
  xai: 'xAI Grok',
};

const PROVIDER_DOCS = {
  google: 'https://ai.google.dev/models/gemini',
  'google-flash': 'https://ai.google.dev/models/gemini',
  openai: 'https://platform.openai.com/docs/models',
  anthropic: 'https://docs.anthropic.com/en/docs/about-claude/models',
  groq: 'https://console.groq.com/docs/api-reference',
  xai: 'https://docs.x.ai/docs/api-reference',
};

const PROVIDER_API_KEY_STORE_KEYS = {
  google: 'gemini_api_key',
  'google-flash': 'gemini_api_key',
  openai: 'openai_api_key',
  anthropic: 'anthropic_api_key',
  groq: 'groq_api_key',
  xai: 'xai_api_key',
};

const PROVIDER_MODEL_STORE_KEYS = {
  google: 'gemini_model',
  'google-flash': 'gemini_flash_model',
  openai: 'openai_model',
  anthropic: 'anthropic_model',
  groq: 'groq_model',
  xai: 'xai_model',
};

const PROVIDER_FALLBACK_MODELS = {
  google: 'gemini-2.5-pro',
  'google-flash': 'gemini-2.5-flash',
  openai: 'gpt-5.1',
  anthropic: 'claude-sonnet-4-20250514',
  groq: 'llama-3.3-70b-versatile',
  xai: 'grok-4-fast-reasoning',
};

const PROVIDER_PRIORITY = {
  google: [
    'gemini-3-pro-preview',
    'gemini-2.5-pro',
    'gemini-pro-latest',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
  ],
  'google-flash': [
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest',
    'gemini-2.0-flash',
  ],
  openai: [
    'gpt-5.1',
    'gpt-5',
    'gpt-5-mini',
    'gpt-4.1',
    'gpt-4o',
  ],
  anthropic: [
    'claude-sonnet-4-20250514',
    'claude-sonnet-4',
    'claude-opus-4-1',
    'claude-opus-4',
    'claude-3-7-sonnet-latest',
    'claude-3-7-sonnet',
    'claude-3-5-haiku-latest',
  ],
  groq: [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'moonshotai/kimi-k2',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'gemma2-9b-it',
  ],
  xai: [
    'grok-4-fast-reasoning',
    'grok-4-fast-non-reasoning',
    'grok-4.20-beta-latest-non-reasoning',
    'grok-4',
    'grok-4-0709',
    'grok-3',
    'grok-2',
  ],
};

const CATALOG_TTL_MS = 1000 * 60 * 60 * 6;

const isTextModelCandidate = (providerId, modelId = '') => {
  const id = `${modelId}`.toLowerCase();
  if (!id) return false;

  if (providerId === 'google' || providerId === 'google-flash') {
    return id.startsWith('gemini-') && !id.includes('-tts') && !id.includes('embedding') && !id.includes('-image');
  }

  if (providerId === 'openai') {
    return (
      (id.startsWith('gpt-') || id.startsWith('o') || id.startsWith('chatgpt-')) &&
      !id.includes('transcribe') &&
      !id.includes('tts') &&
      !id.includes('embedding') &&
      !id.includes('image')
    );
  }

  if (providerId === 'anthropic') {
    return id.startsWith('claude-');
  }

  if (providerId === 'xai') {
    return id.startsWith('grok-') && !id.includes('image');
  }

  if (providerId === 'groq') {
    return !id.includes('whisper') && !id.includes('tts') && !id.includes('playai');
  }

  return true;
};

const normalizeTimestamp = (value) => {
  if (!value) return null;
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const prioritize = (providerId, models = []) => {
  const priorityList = PROVIDER_PRIORITY[providerId] || [];
  const scored = models.map((model) => {
    const id = `${model.id || ''}`;
    const lower = id.toLowerCase();
    const priorityIndex = priorityList.findIndex((candidate) => lower.includes(candidate.toLowerCase()));
    return {
      ...model,
      __priority: priorityIndex === -1 ? Number.MAX_SAFE_INTEGER : priorityIndex,
      __created: normalizeTimestamp(model.created) || 0,
    };
  });

  scored.sort((a, b) => {
    if (a.__priority !== b.__priority) return a.__priority - b.__priority;
    if (a.__created !== b.__created) return b.__created - a.__created;
    return `${a.id}`.localeCompare(`${b.id}`);
  });

  return scored.map(({ __priority, __created, ...model }) => model);
};

const pickRecommendedModel = (providerId, models = []) => {
  const prioritized = prioritize(providerId, models);
  return prioritized[0]?.id || PROVIDER_FALLBACK_MODELS[providerId] || '';
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `${response.status} ${response.statusText}`);
  }

  return response.json();
};

const normalizeOpenAIStyleModels = (providerId, payload = {}) => {
  const items = Array.isArray(payload.data) ? payload.data : [];
  return prioritize(
    providerId,
    items
      .map((model) => ({
        id: model.id,
        label: model.id,
        ownedBy: model.owned_by,
        created: typeof model.created === 'number' ? model.created * 1000 : null,
        contextWindow: model.context_window || null,
      }))
      .filter((model) => isTextModelCandidate(providerId, model.id))
  );
};

const normalizeGeminiModels = (payload = {}, providerId = 'google') => {
  const models = Array.isArray(payload.models) ? payload.models : [];

  return prioritize(
    providerId,
    models
      .map((model) => {
        const id = `${model.name || ''}`.replace(/^models\//, '');
        return {
          id,
          label: model.displayName || id,
          description: model.description || '',
          supportedGenerationMethods: model.supportedGenerationMethods || [],
          inputTokenLimit: model.inputTokenLimit || null,
          outputTokenLimit: model.outputTokenLimit || null,
        };
      })
      .filter((model) => {
        const methods = model.supportedGenerationMethods || [];
        const canGenerate = methods.includes('generateContent') || methods.includes('streamGenerateContent');
        return canGenerate && isTextModelCandidate(providerId, model.id);
      })
  );
};

const normalizeAnthropicModels = (payload = {}) => {
  const items = Array.isArray(payload.data) ? payload.data : [];
  return prioritize(
    'anthropic',
    items
      .map((model) => ({
        id: model.id,
        label: model.display_name || model.id,
        created: normalizeTimestamp(model.created_at),
      }))
      .filter((model) => isTextModelCandidate('anthropic', model.id))
  );
};

const buildCatalog = (providerId, models = [], source = 'official-api') => ({
  success: true,
  providerId,
  providerName: PROVIDER_LABELS[providerId] || providerId,
  docsUrl: PROVIDER_DOCS[providerId] || '',
  models,
  recommendedModel: pickRecommendedModel(providerId, models),
  fetchedAt: Date.now(),
  source,
});

const fetchProviderModelCatalog = async (providerId, { apiKey } = {}) => {
  if (!PROVIDER_LABELS[providerId]) {
    throw new Error(`Unsupported provider: ${providerId}`);
  }

  if (providerId === 'google' || providerId === 'google-flash') {
    if (!apiKey) {
      return {
        success: false,
        providerId,
        providerName: PROVIDER_LABELS[providerId],
        docsUrl: PROVIDER_DOCS[providerId],
        requiresApiKey: true,
        models: [],
        recommendedModel: PROVIDER_FALLBACK_MODELS[providerId],
        error: 'API key required to fetch Gemini models.',
      };
    }

    const payload = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
    return buildCatalog(providerId, normalizeGeminiModels(payload, providerId));
  }

  if (providerId === 'openai') {
    if (!apiKey) {
      return {
        success: false,
        providerId,
        providerName: PROVIDER_LABELS[providerId],
        docsUrl: PROVIDER_DOCS[providerId],
        requiresApiKey: true,
        models: [],
        recommendedModel: PROVIDER_FALLBACK_MODELS[providerId],
        error: 'API key required to fetch OpenAI models.',
      };
    }

    const payload = await fetchJson('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    return buildCatalog(providerId, normalizeOpenAIStyleModels(providerId, payload));
  }

  if (providerId === 'anthropic') {
    if (!apiKey) {
      return {
        success: false,
        providerId,
        providerName: PROVIDER_LABELS[providerId],
        docsUrl: PROVIDER_DOCS[providerId],
        requiresApiKey: true,
        models: [],
        recommendedModel: PROVIDER_FALLBACK_MODELS[providerId],
        error: 'API key required to fetch Anthropic models.',
      };
    }

    const payload = await fetchJson('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });
    return buildCatalog(providerId, normalizeAnthropicModels(payload));
  }

  if (providerId === 'groq') {
    if (!apiKey) {
      return {
        success: false,
        providerId,
        providerName: PROVIDER_LABELS[providerId],
        docsUrl: PROVIDER_DOCS[providerId],
        requiresApiKey: true,
        models: [],
        recommendedModel: PROVIDER_FALLBACK_MODELS[providerId],
        error: 'API key required to fetch Groq models.',
      };
    }

    const payload = await fetchJson('https://api.groq.com/openai/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    return buildCatalog(providerId, normalizeOpenAIStyleModels(providerId, payload));
  }

  if (providerId === 'xai') {
    if (!apiKey) {
      return {
        success: false,
        providerId,
        providerName: PROVIDER_LABELS[providerId],
        docsUrl: PROVIDER_DOCS[providerId],
        requiresApiKey: true,
        models: [],
        recommendedModel: PROVIDER_FALLBACK_MODELS[providerId],
        error: 'API key required to fetch xAI models.',
      };
    }

    const payload = await fetchJson('https://api.x.ai/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    return buildCatalog(providerId, normalizeOpenAIStyleModels(providerId, payload));
  }

  return {
    success: false,
    providerId,
    providerName: PROVIDER_LABELS[providerId],
    docsUrl: PROVIDER_DOCS[providerId],
    models: [],
    recommendedModel: PROVIDER_FALLBACK_MODELS[providerId],
    error: `No discovery handler implemented for ${providerId}.`,
  };
};

module.exports = {
  CATALOG_TTL_MS,
  PROVIDER_API_KEY_STORE_KEYS,
  PROVIDER_DOCS,
  PROVIDER_FALLBACK_MODELS,
  PROVIDER_LABELS,
  PROVIDER_MODEL_STORE_KEYS,
  fetchProviderModelCatalog,
  getProviderApiKeyStoreKey: (providerId) => PROVIDER_API_KEY_STORE_KEYS[providerId],
  getProviderDocsUrl: (providerId) => PROVIDER_DOCS[providerId] || '',
  getProviderFallbackModel: (providerId) => PROVIDER_FALLBACK_MODELS[providerId] || '',
  getProviderLabel: (providerId) => PROVIDER_LABELS[providerId] || providerId,
  getProviderModelStoreKey: (providerId) => PROVIDER_MODEL_STORE_KEYS[providerId],
  pickRecommendedModel,
  prioritize,
};
