"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGeminiModelMetadata = exports.getRecommendedGeminiModel = exports.MODEL_REGISTRY = void 0;
exports.MODEL_REGISTRY = {
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
var RECOMMENDED_BY_PROVIDER = {
    google: exports.MODEL_REGISTRY.google.pro,
    'google-flash': exports.MODEL_REGISTRY.google.flash,
};
var getRecommendedGeminiModel = function (providerId) {
    if (providerId === void 0) { providerId = 'google'; }
    return RECOMMENDED_BY_PROVIDER[providerId] ? RECOMMENDED_BY_PROVIDER[providerId].id : exports.MODEL_REGISTRY.google.pro.id;
};
exports.getRecommendedGeminiModel = getRecommendedGeminiModel;
var getGeminiModelMetadata = function (providerId) {
    if (providerId === void 0) { providerId = 'google'; }
    return RECOMMENDED_BY_PROVIDER[providerId] || exports.MODEL_REGISTRY.google.pro;
};
exports.getGeminiModelMetadata = getGeminiModelMetadata;
