export const MODEL_REGISTRY = {
  google: {
    pro: {
      id: 'gemini-3-pro-preview',
      friendlyName: 'Gemini 3 Pro Preview',
      releaseDate: '2025-11-01',
      notes: 'Latest flagship Gemini preview from the official model catalog, tuned for long-context multimodal reasoning.',
    },
    flash: {
      id: 'gemini-3-flash-preview',
      friendlyName: 'Gemini 3 Flash Preview',
      releaseDate: '2025-12-01',
      notes: 'Latest Flash-tier Gemini preview focused on speed, scale, and strong general reasoning.',
    },
  },
};

const RECOMMENDED_BY_PROVIDER: Record<string, any> = {
  google: MODEL_REGISTRY.google.pro,
  'google-flash': MODEL_REGISTRY.google.flash,
};

export const getRecommendedGeminiModel = (providerId = 'google'): string => {
  return RECOMMENDED_BY_PROVIDER[providerId] ? RECOMMENDED_BY_PROVIDER[providerId].id : MODEL_REGISTRY.google.pro.id;
};

export const getGeminiModelMetadata = (providerId = 'google'): any => {
  return RECOMMENDED_BY_PROVIDER[providerId] || MODEL_REGISTRY.google.pro;
};
