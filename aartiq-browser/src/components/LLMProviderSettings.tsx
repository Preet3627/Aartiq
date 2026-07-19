// LLMProviderSettings component
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LLMProviderOptions } from '@/lib/llm/providers/base';
import SearchEngineSettings from './SearchEngineSettings';
import ThemeSettings from './ThemeSettings';
import BackendSettings from './BackendSettings';
import { motion, AnimatePresence } from 'framer-motion';
import { OpenAICompatibleProvider } from '@/lib/llm/providers/openai-compatible';
import { useAppStore } from '@/store/useAppStore';
import { Cpu, Cloud, Settings, Save, Shield, Database, ChevronDown, Check, Sparkles, Puzzle, FolderOpen, ExternalLink, Monitor, RefreshCw, X } from 'lucide-react';
import { getGeminiModelMetadata, getRecommendedGeminiModel } from '@/lib/modelRegistry';

// ─── Collapsible Section Component ─────────────────────────────────────────────

function CollapsibleSection({ icon, label, defaultOpen = false, children }: {
  icon: React.ReactNode;
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-white/[0.04] overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.02] transition-colors text-left"
      >
        <span className="text-deep-space-accent-neon">{icon}</span>
        <span className="text-[10px] uppercase font-black tracking-widest text-white/50 flex-1">{label}</span>
        <ChevronDown
          size={12}
          className={`text-white/20 transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface LLMProviderSettingsProps {
  selectedEngine: string;
  setSelectedEngine: (engine: string) => void;
  theme: 'dark' | 'light' | 'system' | 'vibrant' | 'custom' | 'minimal';
  setTheme: (theme: 'dark' | 'light' | 'system' | 'vibrant' | 'custom' | 'minimal') => void;
  backgroundImage: string;
  setBackgroundImage: (imageUrl: string) => void;
  backend: 'firebase' | 'mysql';
  setBackend: (backend: 'firebase' | 'mysql') => void;
  mysqlConfig: any;
  setMysqlConfig: (config: any) => void;
  ollamaModels: { name: string; modified_at: string; }[];
  setOllamaModels: (models: { name: string; modified_at: string; }[]) => void;
  setError: (error: string | null) => void; // New prop for setting errors
  showSettings: boolean; // New prop for controlling visibility
  setShowSettings: (show: boolean) => void; // New prop for setting visibility
}

interface ProviderCatalog {
  success: boolean;
  providerId: string;
  providerName?: string;
  docsUrl?: string;
  models: Array<{
    id: string;
    label?: string;
    ownedBy?: string;
    created?: number | null;
    contextWindow?: number | null;
    description?: string;
    inputTokenLimit?: number | null;
    outputTokenLimit?: number | null;
  }>;
  recommendedModel?: string;
  fetchedAt?: number;
  requiresApiKey?: boolean;
  warning?: string;
  error?: string;
}

const LLMProviderSettings: React.FC<LLMProviderSettingsProps> = (props: LLMProviderSettingsProps) => {
  const store = useAppStore();
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [providerCatalogs, setProviderCatalogs] = useState<Record<string, ProviderCatalog>>({});
  const [catalogLoading, setCatalogLoading] = useState<Record<string, boolean>>({});
  const [isMac, setIsMac] = useState(false);
  const [appleStatus, setAppleStatus] = useState<{
    success: boolean;
    available?: boolean;
    supportsSummaries?: boolean;
    supportsImageGeneration?: boolean;
    summaryAvailable?: boolean;
    imageAvailable?: boolean;
    summaryReason?: string;
    imageReason?: string;
    osVersion?: string;
    error?: string;
  } | null>(null);
  const [appleSummaryInput, setAppleSummaryInput] = useState('');
  const [appleSummaryResult, setAppleSummaryResult] = useState('');
  const [appleImagePrompt, setAppleImagePrompt] = useState('A cinematic Aartiq hero illustration with a glowing browser cockpit on a Mac desktop');
  const [appleImagePath, setAppleImagePath] = useState<string | null>(null);
  const [appleBusy, setAppleBusy] = useState<'summary' | 'image' | null>(null);
  const [appleUiError, setAppleUiError] = useState<string | null>(null);
  const geminiPreferences = useMemo(() => {
    const providerId = activeProviderId === 'google-flash' ? 'google-flash' : 'google';
    return {
      recommended: getRecommendedGeminiModel(providerId),
      metadata: getGeminiModelMetadata(providerId),
    };
  }, [activeProviderId]);
  const activeCatalog = activeProviderId ? providerCatalogs[activeProviderId] : undefined;

  const openExternal = async (url: string) => {
    if (window.electronAPI?.openExternalUrl) {
      await window.electronAPI.openExternalUrl(url);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const refreshAppleStatus = useCallback(async () => {
    if (!window.electronAPI) return;

    try {
      const status = await window.electronAPI.getAppleIntelligenceStatus();
      setAppleStatus(status);
      return status;
    } catch (error: any) {
      const failedStatus = { success: false, error: error?.message || 'Failed to read Apple Intelligence status' };
      setAppleStatus(failedStatus);
      return failedStatus;
    }
  }, []);

  const loadProviderCatalog = useCallback(async (providerId: string, forceRefresh = false) => {
    if (!window.electronAPI || providerId === 'ollama' || providerId === 'azure-openai') {
      return;
    }

    setCatalogLoading(prev => ({ ...prev, [providerId]: true }));
    try {
      const catalog = await window.electronAPI.getProviderModels(providerId, { forceRefresh });
      setProviderCatalogs(prev => ({ ...prev, [providerId]: catalog }));
      if (catalog.error && forceRefresh) {
        props.setError(catalog.error);
      }
    } catch (error: any) {
      if (forceRefresh) {
        props.setError(error?.message || `Failed to refresh ${providerId} models`);
      }
    } finally {
      setCatalogLoading(prev => ({ ...prev, [providerId]: false }));
    }
  }, [props]);

  // Use store.aiProvider as source of truth
  useEffect(() => {
    const fetchProviders = async () => {
      if (window.electronAPI) {
        try {
          const availableProviders = await window.electronAPI.getAvailableLLMProviders();
          if (availableProviders && availableProviders.length > 0) {
            setProviders(availableProviders);
            // Default to store value if present, else first provider
            const currentp = store.aiProvider || availableProviders[0].id;
            setActiveProviderId(currentp);
            return;
          }
        } catch (e) {
          console.warn("Electron LLM API failed, falling back to local:", e);
        }
      }

      // Fallback
      setProviders([
        { id: 'ollama', name: 'Ollama (Local AI Engine)' }
      ]);
      setActiveProviderId(store.aiProvider || 'ollama');
    };
    fetchProviders();
  }, [store.aiProvider]);

  useEffect(() => {
    if (!activeProviderId) return;
    if (activeProviderId === 'google' || activeProviderId === 'google-flash') {
      if (!store.geminiApiKey) return;
    }
    if (activeProviderId === 'openai' && !store.openaiApiKey) return;
    if (activeProviderId === 'anthropic' && !store.anthropicApiKey) return;
    if (activeProviderId === 'groq' && !store.groqApiKey) return;
    if (activeProviderId === 'xai' && !store.xaiApiKey) return;

    void loadProviderCatalog(activeProviderId);
  }, [
    activeProviderId,
    loadProviderCatalog,
    store.anthropicApiKey,
    store.geminiApiKey,
    store.groqApiKey,
    store.openaiApiKey,
    store.xaiApiKey,
  ]);

  useEffect(() => {
    const loadAppleStatus = async () => {
      if (!window.electronAPI) return;
      const platform = await window.electronAPI.getPlatform();
      const mac = platform === 'darwin';
      setIsMac(mac);
      if (!mac) return;

      await refreshAppleStatus();
    };

    void loadAppleStatus();
  }, [refreshAppleStatus]);

  const handleProviderChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProviderId = e.target.value;
    setActiveProviderId(newProviderId);
    store.setAIProvider(newProviderId);
    if (window.electronAPI) {
      await window.electronAPI.setActiveLLMProvider(newProviderId);
    }
  };

  const renderCatalogControls = (
    providerId: string,
    currentModel: string,
    setModel: (model: string) => void,
    placeholder: string
  ) => {
    const catalog = providerCatalogs[providerId];
    const loading = !!catalogLoading[providerId];
    const hasModels = !!catalog?.models?.length;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label className="text-[9px] text-white/30 uppercase font-bold">Live Model Catalog</label>
          <button
            type="button"
            onClick={() => void loadProviderCatalog(providerId, true)}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[8px] font-black uppercase tracking-[0.25em] text-white/60 transition hover:bg-white/10"
          >
            <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <select
          className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-deep-space-accent-neon/50 transition-all font-bold"
          value={currentModel || catalog?.recommendedModel || ''}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setModel(e.target.value)}
          disabled={!hasModels}
        >
          {hasModels ? (
            catalog.models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label || model.id}
              </option>
            ))
          ) : (
            <option value="">{catalog?.requiresApiKey ? 'Add API key to fetch live models' : 'No live models available yet'}</option>
          )}
        </select>

        <div className="space-y-1 rounded-xl border border-white/5 bg-white/[0.03] p-3 text-[9px] text-white/55">
          <p>
            Recommended: <strong className="text-white">{catalog?.recommendedModel || placeholder}</strong>
          </p>
          {catalog?.fetchedAt && (
            <p>Last sync: {new Date(catalog.fetchedAt).toLocaleString()}</p>
          )}
          {catalog?.warning && <p className="text-amber-300/80">{catalog.warning}</p>}
          {catalog?.error && !catalog.requiresApiKey && <p className="text-rose-300/80">{catalog.error}</p>}
          {catalog?.docsUrl && (
            <button
              type="button"
              onClick={() => void openExternal(catalog.docsUrl!)}
              className="inline-flex items-center gap-1 text-deep-space-accent-neon hover:text-deep-space-accent-neon/80 transition"
            >
              <ExternalLink size={10} />
              Official models docs
            </button>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[9px] text-white/30 uppercase font-bold">Manual Override</label>
          <input
            type="text"
            placeholder={placeholder}
            className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-white/10 outline-none"
            value={currentModel || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setModel(e.target.value)}
          />
        </div>
      </div>
    );
  };

  const updateAppleFailureState = useCallback((message: string, kind: 'summary' | 'image') => {
    setAppleUiError(message);
    setAppleStatus(prev => ({
      ...(prev || { success: false }),
      success: false,
      ...(kind === 'summary'
        ? { summaryAvailable: false, summaryReason: message }
        : { imageAvailable: false, imageReason: message }),
    }));
  }, []);

  const getAppleIntelligenceErrorMessage = (status: any): string => {
    if (!status) return 'Apple Intelligence not detected on this Mac.';
    if (!status.success) return status.error || 'Apple Intelligence helper failed to initialize.';
    if (!status.available) {
      if (status.summaryReason?.includes('not supported on this Mac')) {
        return 'Apple Intelligence requires Apple Silicon Mac with 16GB+ memory.';
      }
      if (status.summaryReason?.includes('not enabled')) {
        return 'Enable Apple Intelligence in System Settings > Apple Intelligence.';
      }
      if (status.summaryReason?.includes('still preparing')) {
        return 'Apple Intelligence models are downloading. Please wait.';
      }
      if (status.summaryReason?.includes('macOS 26')) {
        return 'Summaries require macOS 26.0+ with Foundation Models.';
      }
      return status.summaryReason || 'Apple Intelligence is unavailable.';
    }
    return 'Apple Intelligence ready.';
  };

  const canUseAppleSummary = !!appleStatus?.supportsSummaries && !!appleStatus?.summaryAvailable;
  const canUseAppleImage = !!appleStatus?.supportsImageGeneration && !!appleStatus?.imageAvailable;
  const appleSummaryStatusText = appleStatus?.summaryReason || (canUseAppleSummary ? 'Ready' : 'Not supported');
  const appleImageStatusText = appleStatus?.imageReason || (canUseAppleImage ? 'Ready' : 'Not supported');

  const runAppleSummary = async (text: string) => {
    if (!window.electronAPI) return;
    if (!canUseAppleSummary) {
      updateAppleFailureState(appleSummaryStatusText || 'Apple Intelligence summaries are not available on this Mac.', 'summary');
      return;
    }

    setAppleUiError(null);
    setAppleBusy('summary');
    setAppleSummaryResult('');
    try {
      const result = await window.electronAPI.summarizeWithAppleIntelligence(text);
      if (result.success && result.summary) {
        setAppleSummaryResult(result.summary);
      } else {
        const message = result.summaryReason || result.error || 'Apple Intelligence summary failed';
        updateAppleFailureState(message, 'summary');
        props.setError(message);
      }
    } catch (error: any) {
      const message = error?.message || 'Apple Intelligence summary failed';
      updateAppleFailureState(message, 'summary');
      props.setError(message);
    } finally {
      setAppleBusy(null);
    }
  };

  const handleApplePageSummary = async () => {
    if (!window.electronAPI) return;
    if (!canUseAppleSummary) {
      updateAppleFailureState(appleSummaryStatusText || 'Apple Intelligence summaries are not available on this Mac.', 'summary');
      return;
    }
    try {
      const result = await window.electronAPI.extractPageContent();
      if (!result?.content) {
        const message = result?.error || 'No active page content available to summarize.';
        setAppleUiError(message);
        props.setError(message);
        return;
      }
      await runAppleSummary(result.content);
    } catch (error: any) {
      const message = error?.message || 'Failed to extract page content for Apple Intelligence.';
      setAppleUiError(message);
      props.setError(message);
    }
  };

  const handleAppleImage = async () => {
    if (!window.electronAPI || !appleImagePrompt.trim()) return;
    if (!canUseAppleImage) {
      updateAppleFailureState(appleImageStatusText || 'Apple image generation is not available on this Mac.', 'image');
      return;
    }

    setAppleUiError(null);
    setAppleBusy('image');
    setAppleImagePath(null);
    try {
      const result = await window.electronAPI.generateAppleIntelligenceImage({ prompt: appleImagePrompt.trim() });
      if (result.success && result.imagePath) {
        setAppleImagePath(result.imagePath);
      } else {
        const message = result.imageReason || result.error || 'Apple Intelligence image generation failed';
        updateAppleFailureState(message, 'image');
        props.setError(message);
      }
    } catch (error: any) {
      const message = error?.message || 'Apple Intelligence image generation failed';
      updateAppleFailureState(message, 'image');
      props.setError(message);
    } finally {
      setAppleBusy(null);
    }
  };


  const handleSaveConfig = async () => {
    if (!activeProviderId) return;



    let config: LLMProviderOptions = {};
    if (activeProviderId === 'ollama') {
      config = { baseUrl: store.ollamaBaseUrl, model: store.ollamaModel, localLlmMode: store.localLlmMode };
    } else if (activeProviderId === 'google' || activeProviderId === 'google-flash') {
      const providerId = activeProviderId === 'google-flash' ? 'google-flash' : 'google';
      const recommendedModel = providerCatalogs[activeProviderId]?.recommendedModel || getRecommendedGeminiModel(providerId);
      config = {
        apiKey: store.geminiApiKey,
        model: providerId === 'google-flash'
          ? (store.geminiFlashModel || recommendedModel)
          : (store.geminiModel || recommendedModel)
      };
    } else if (activeProviderId === 'openai') {
      config = { apiKey: store.openaiApiKey, model: store.openaiModel || providerCatalogs.openai?.recommendedModel || 'gpt-5.1' };
    } else if (activeProviderId === 'azure-openai') {
      config = {
        apiKey: store.azureOpenaiApiKey,
        baseUrl: store.azureOpenaiEndpoint,
        model: store.azureOpenaiModel || 'gpt-4.1-mini'
      };
    } else if (activeProviderId === 'anthropic') {
      config = { apiKey: store.anthropicApiKey, model: store.anthropicModel || providerCatalogs.anthropic?.recommendedModel || 'claude-sonnet-4-20250514' };
    } else if (activeProviderId === 'xai') {
      config = { apiKey: store.xaiApiKey, model: store.xaiModel || providerCatalogs.xai?.recommendedModel || 'grok-4-fast-reasoning' };
    } else if (activeProviderId === 'groq') {
      config = { apiKey: store.groqApiKey, model: store.groqModel || providerCatalogs.groq?.recommendedModel || 'llama-3.3-70b-versatile' };
    }

    if (window.electronAPI) {
      const success = await window.electronAPI.configureLLMProvider(activeProviderId, config);
      setFeedback(success ? 'Intelligence Configured' : 'Configuration Failed');
      if (success) {
        setTimeout(() => {
          props.setShowSettings(false);
        }, 2000);
      }
    } else {
      setFeedback('Local IQ Active');
      setTimeout(() => props.setShowSettings(false), 2000);
    }
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="border border-white/5 rounded-2xl overflow-hidden glass-dark transition-all">
      <AnimatePresence>
        {props.showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4 custom-scrollbar max-h-[450px] overflow-y-auto">

              {/* ── Section: Appearance ─────────────────────────────── */}
              <CollapsibleSection icon={<Cpu size={12} />} label="Appearance" defaultOpen={false}>
                <ThemeSettings {...props} />
                <SearchEngineSettings {...props} />
                <BackendSettings {...props} />
              </CollapsibleSection>

              {/* ── Section: AI Provider ────────────────────────────── */}
              <CollapsibleSection icon={<Cloud size={12} />} label="AI Provider" defaultOpen={true}>
                <div className="space-y-3">
                  <select
                    id="ai-orchestration-select"
                    aria-label="AI Orchestration Provider Selection"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-deep-space-accent-neon/50 transition-all font-bold"
                    value={activeProviderId || ''}
                    onChange={handleProviderChange}
                  >
                    {providers.map((p: { id: string; name: string }) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </CollapsibleSection>

              {/* ── Section: Provider Configuration ─────────────────── */}
              <CollapsibleSection icon={<Settings size={12} />} label="Provider Config" defaultOpen={true}>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="space-y-4">
                    {activeProviderId === 'ollama' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 text-deep-space-accent-neon mb-1">
                          <img src="/ai-logos/ollama.png" className="w-4 h-4 object-contain" alt="Ollama" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-deep-space-accent-neon">Native Ollama Models</span>
                        </div>

                        {/* Base URL Input */}
                        <div className="space-y-1">
                          <label className="text-[9px] text-white/30 uppercase font-bold">Base URL (Remote / Local)</label>
                          <input
                            type="text"
                            placeholder="e.g. http://localhost:11434"
                            className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-white/10 outline-none"
                            value={store.ollamaBaseUrl || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => store.setOllamaBaseUrl(e.target.value)}
                          />
                        </div>

                        {/* Model Selection Dropdown */}
                        <div className="space-y-1">
                          <label htmlFor="ollama-model-select" className="text-[9px] text-white/30 uppercase font-bold">Select Active Model</label>
                          <select
                            id="ollama-model-select"
                            aria-label="Ollama Model Selection"
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-deep-space-accent-neon/50 transition-all font-bold"
                            value={store.ollamaModel}
                            onChange={async (e: React.ChangeEvent<HTMLSelectElement>) => {
                              const newModel = e.target.value;
                              store.setOllamaModel(newModel);
                              if (window.electronAPI && newModel !== 'custom') {
                                await window.electronAPI.configureLLMProvider('ollama', {
                                  baseUrl: store.ollamaBaseUrl,
                                  model: newModel
                                });
                                setFeedback(`Synced: ${newModel}`);
                                setTimeout(() => setFeedback(null), 2000);
                              }
                            }}
                            onFocus={async () => {
                              if (window.electronAPI) {
                                setFeedback("Syncing Models...");
                                const { models, error } = await window.electronAPI.ollamaListModels();
                                if (models) {
                                  props.setOllamaModels(models);
                                  setFeedback(null);
                                } else if (error) {
                                  props.setError(`Ollama error: ${error}`);
                                  setFeedback("Sync Failed");
                                }
                              }
                            }}
                          >
                            {props.ollamaModels.length > 0 ? (
                              props.ollamaModels.map((model) => (
                                <option key={model.name} value={model.name}>{model.name} ({model.modified_at})</option>
                              ))
                            ) : (
                              <option value="">No Ollama models found</option>
                            )}
                            <option value="custom">Custom (Type below)</option>
                          </select>
                          <p className="text-[8px] text-amber-400/60 font-medium pt-1 italic">
                            Choose Ollama Only if You have at Least enough hardware to run LLM
                          </p>
                          <button
                            onClick={async () => {
                              try {
                                setFeedback("Verifying...");
                                const res = await fetch(`${store.ollamaBaseUrl}/api/tags`);
                                if (res.ok) {
                                  setFeedback("Connection Active");
                                  const data = await res.json();
                                  if (data.models) props.setOllamaModels(data.models);
                                } else {
                                  setFeedback("Node Offline");
                                }
                              } catch (e) {
                                setFeedback("Bridge Failed");
                              }
                              setTimeout(() => setFeedback(null), 2000);
                            }}
                            className="mt-2 w-full py-2 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400 text-[9px] font-black uppercase tracking-widest hover:bg-sky-500/20 transition-all"
                          >
                            Verify Connection
                          </button>
                        </div>

                        {/* Manual Override */}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[9px] text-white/30 uppercase font-bold">Manual Model Override</label>
                            <span className="text-[8px] text-purple-400 font-bold uppercase cursor-pointer hover:underline" onClick={() => store.setOllamaModel('gpt-oss-cloud:120b')}>Try GPT-OSS 120B</span>
                          </div>
                          <input
                            type="text"
                            placeholder="Or type model name..."
                            className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-[10px] text-white outline-none italic"
                            value={store.ollamaModel || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => store.setOllamaModel(e.target.value)}
                          />
                        </div>

                        {/* Local LLM Mode Selection */}
                        <div className="space-y-1">
                          <label htmlFor="local-mode-select" className="text-[9px] text-white/30 uppercase font-bold">Local Intelligence Intensity</label>
                          <div className="grid grid-cols-3 gap-2">
                            {(['light', 'normal', 'heavy'] as const).map((m) => (
                              <button
                                key={m}
                                onClick={() => store.setLocalLlmMode(m)}
                                className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all border ${store.localLlmMode === m
                                  ? 'bg-deep-space-accent-neon/20 border-deep-space-accent-neon/50 text-deep-space-accent-neon'
                                  : 'bg-black/20 border-white/5 text-white/40 hover:text-white/60'
                                  }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                          <p className="text-[8px] text-white/20 italic pt-1">
                            {store.localLlmMode === 'light' && 'Optimized for speed. Uses smaller, efficient models.'}
                            {store.localLlmMode === 'normal' && 'Balanced performance. Good for most daily tasks.'}
                            {store.localLlmMode === 'heavy' && 'Max reasoning. Recommended for coding and analysis.'}
                          </p>
                        </div>

                        {/* Terminal & Pull Section */}
                        <div className="flex flex-col gap-2 pt-2 border-t border-white/5 mt-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[9px] text-white/30 uppercase font-bold">Install New Model</p>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Model Name (e.g. gpt-oss-cloud:120b)"
                              className="flex-1 bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-[10px] text-white outline-none"
                              id="ollama-pull-input"
                              defaultValue="gpt-oss-cloud:120b"
                            />
                            <button
                              onClick={() => {
                                const input = document.getElementById('ollama-pull-input') as HTMLInputElement;
                                const model = input.value.trim();
                                if (!model || !window.electronAPI) return;
                                setFeedback(`Pulling ${model}...`);
                                window.electronAPI.ollamaPullModel(model).then((res) => {
                                  if (res.success) {
                                    setFeedback(`Installed: ${model}`);
                                  } else {
                                    setFeedback(`Failed: ${res.error}`);
                                  }
                                  setTimeout(() => setFeedback(null), 3000);
                                });
                              }}
                              className="px-3 py-2 bg-deep-space-accent-neon/10 border border-deep-space-accent-neon/20 rounded-lg text-deep-space-accent-neon text-[9px] font-bold uppercase hover:bg-deep-space-accent-neon/20 transition-all"
                            >
                              Pull
                            </button>
                          </div>
                          <div className="flex gap-2 mt-1">
                            <label className="flex-1 flex items-center gap-2 px-3 py-2 bg-black/20 border border-white/5 rounded-lg text-[9px] text-white/40 cursor-pointer hover:bg-white/[0.03] transition-all">
                              <input type="file" accept=".gguf" className="hidden" onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file && window.electronAPI) {
                                  setFeedback(`Importing ${file.name}...`);
                                  window.electronAPI.ollamaImportModel?.(file.path).then((res: any) => {
                                    setFeedback(res?.success ? `Imported: ${file.name}` : `Failed: ${res?.error}`);
                                    setTimeout(() => setFeedback(null), 3000);
                                  });
                                }
                              }} />
                              <FolderOpen size={10} />
                              Import .GGUF
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeProviderId === 'gemini' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 text-deep-space-accent-neon mb-1">
                          <img src="/ai-logos/gemini.png" className="w-4 h-4 object-contain" alt="Gemini" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-deep-space-accent-neon">Google Gemini Configuration</span>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-white/30 uppercase font-bold">Gemini API Key</label>
                          <input
                            type="password"
                            placeholder="Enter Gemini API Key"
                            className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-white/10 outline-none"
                            value={store.geminiApiKey || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => store.setGeminiApiKey(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-white/30 uppercase font-bold">Active Model</label>
                          <select
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-deep-space-accent-neon/50 transition-all font-bold"
                            value={store.geminiModel}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => store.setGeminiModel(e.target.value)}
                          >
                            {props.ollamaModels.length > 0 ? (
                              props.ollamaModels.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)
                            ) : (
                              <>
                                <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fast)</option>
                                <option value="gemini-2.5-pro-preview-05-06">Gemini 2.5 Pro (Reasoning)</option>
                                <option value="gemini-2.5-flash-preview-04-17">Gemini 2.5 Flash (Balanced)</option>
                              </>
                            )}
                          </select>
                        </div>
                        <button
                          onClick={async () => {
                            if (!store.geminiApiKey) { setFeedback("Enter API Key"); setTimeout(() => setFeedback(null), 2000); return; }
                            try {
                              setFeedback("Fetching Models...");
                              const catalogs = await (window.electronAPI as any).fetchProviderCatalogs?.('gemini', store.geminiApiKey);
                              if (catalogs?.success && catalogs.models?.length > 0) {
                                props.setOllamaModels(catalogs.models.map((m: any) => ({ name: m.id, modified_at: '' })));
                                setFeedback(`${catalogs.models.length} Models Loaded`);
                              } else {
                                setFeedback("No Models Found");
                              }
                            } catch { setFeedback("API Key Invalid"); }
                            setTimeout(() => setFeedback(null), 2500);
                          }}
                          className="w-full py-2 bg-deep-space-accent-neon/10 border border-deep-space-accent-neon/20 rounded-lg text-deep-space-accent-neon text-[9px] font-black uppercase tracking-widest hover:bg-deep-space-accent-neon/20 transition-all flex items-center justify-center gap-2"
                        >
                          <RefreshCw size={10} />
                          Fetch Live Model Catalog
                        </button>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-white/30 uppercase font-bold">Auto-Update Models</span>
                          <button
                            onClick={() => store.setGeminiAutoUpdate(!store.geminiAutoUpdate)}
                            className={`w-8 h-4 rounded-full transition-all ${store.geminiAutoUpdate ? 'bg-deep-space-accent-neon' : 'bg-white/10'}`}
                          >
                            <span className={`block w-3 h-3 rounded-full bg-white shadow transition-transform ${store.geminiAutoUpdate ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                      </div>
                    )}

                    {activeProviderId === 'openai' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 text-deep-space-accent-neon mb-1">
                          <img src="/ai-logos/openai.png" className="w-4 h-4 object-contain" alt="OpenAI" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-deep-space-accent-neon">OpenAI Configuration</span>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-white/30 uppercase font-bold">OpenAI API Key</label>
                          <input
                            type="password"
                            placeholder="Enter OpenAI API Key"
                            className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-white/10 outline-none"
                            value={store.openaiApiKey || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => store.setOpenaiApiKey(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-white/30 uppercase font-bold">Active Model</label>
                          <select
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-deep-space-accent-neon/50 transition-all font-bold"
                            value={store.openaiModel}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => store.setOpenaiModel(e.target.value)}
                          >
                            {props.ollamaModels.length > 0 ? (
                              props.ollamaModels.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)
                            ) : (
                              <>
                                <option value="gpt-4o">GPT-4o</option>
                                <option value="gpt-4o-mini">GPT-4o Mini</option>
                                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                <option value="o3-mini">o3-mini</option>
                              </>
                            )}
                          </select>
                        </div>
                        <button
                          onClick={async () => {
                            if (!store.openaiApiKey) { setFeedback("Enter API Key"); setTimeout(() => setFeedback(null), 2000); return; }
                            try {
                              setFeedback("Fetching Models...");
                              const catalogs = await (window.electronAPI as any).fetchProviderCatalogs?.('openai', store.openaiApiKey);
                              if (catalogs?.success && catalogs.models?.length > 0) {
                                props.setOllamaModels(catalogs.models.map((m: any) => ({ name: m.id, modified_at: '' })));
                                setFeedback(`${catalogs.models.length} Models Loaded`);
                              } else {
                                setFeedback("No Models Found");
                              }
                            } catch { setFeedback("API Key Invalid"); }
                            setTimeout(() => setFeedback(null), 2500);
                          }}
                          className="w-full py-2 bg-deep-space-accent-neon/10 border border-deep-space-accent-neon/20 rounded-lg text-deep-space-accent-neon text-[9px] font-black uppercase tracking-widest hover:bg-deep-space-accent-neon/20 transition-all flex items-center justify-center gap-2"
                        >
                          <RefreshCw size={10} />
                          Fetch Live Model Catalog
                        </button>
                      </div>
                    )}

                    {activeProviderId === 'anthropic' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 text-deep-space-accent-neon mb-1">
                          <img src="/ai-logos/anthropic.png" className="w-4 h-4 object-contain" alt="Anthropic" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-deep-space-accent-neon">Anthropic Claude Configuration</span>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-white/30 uppercase font-bold">Anthropic API Key</label>
                          <input
                            type="password"
                            placeholder="Enter Anthropic API Key"
                            className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-white/10 outline-none"
                            value={store.anthropicApiKey || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => store.setAnthropicApiKey(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-white/30 uppercase font-bold">Active Model</label>
                          <select
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-deep-space-accent-neon/50 transition-all font-bold"
                            value={store.anthropicModel}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => store.setAnthropicModel(e.target.value)}
                          >
                            {props.ollamaModels.length > 0 ? (
                              props.ollamaModels.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)
                            ) : (
                              <>
                                <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                                <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                              </>
                            )}
                          </select>
                        </div>
                        <button
                          onClick={async () => {
                            if (!store.anthropicApiKey) { setFeedback("Enter API Key"); setTimeout(() => setFeedback(null), 2000); return; }
                            try {
                              setFeedback("Fetching Models...");
                              const catalogs = await (window.electronAPI as any).fetchProviderCatalogs?.('anthropic', store.anthropicApiKey);
                              if (catalogs?.success && catalogs.models?.length > 0) {
                                props.setOllamaModels(catalogs.models.map((m: any) => ({ name: m.id, modified_at: '' })));
                                setFeedback(`${catalogs.models.length} Models Loaded`);
                              } else {
                                setFeedback("No Models Found");
                              }
                            } catch { setFeedback("API Key Invalid"); }
                            setTimeout(() => setFeedback(null), 2500);
                          }}
                          className="w-full py-2 bg-deep-space-accent-neon/10 border border-deep-space-accent-neon/20 rounded-lg text-deep-space-accent-neon text-[9px] font-black uppercase tracking-widest hover:bg-deep-space-accent-neon/20 transition-all flex items-center justify-center gap-2"
                        >
                          <RefreshCw size={10} />
                          Fetch Live Model Catalog
                        </button>
                      </div>
                    )}

                    {activeProviderId === 'groq' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 text-deep-space-accent-neon mb-1">
                          <img src="/ai-logos/groq.png" className="w-4 h-4 object-contain" alt="Groq" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-deep-space-accent-neon">Groq (LPU) Configuration</span>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-white/30 uppercase font-bold">Groq API Key</label>
                          <input
                            type="password"
                            placeholder="Enter Groq API Key"
                            className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-white/10 outline-none"
                            value={store.groqApiKey || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => store.setGroqApiKey(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-white/30 uppercase font-bold">Active Model</label>
                          <select
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-deep-space-accent-neon/50 transition-all font-bold"
                            value={store.groqModel}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => store.setGroqModel(e.target.value)}
                          >
                            {props.ollamaModels.length > 0 ? (
                              props.ollamaModels.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)
                            ) : (
                              <>
                                <option value="llama-3.3-70b-versatile">Llama 3.3 70B</option>
                                <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                                <option value="gemma2-9b-it">Gemma 2 9B</option>
                              </>
                            )}
                          </select>
                        </div>
                        <button
                          onClick={async () => {
                            if (!store.groqApiKey) { setFeedback("Enter API Key"); setTimeout(() => setFeedback(null), 2000); return; }
                            try {
                              setFeedback("Fetching Models...");
                              const catalogs = await (window.electronAPI as any).fetchProviderCatalogs?.('groq', store.groqApiKey);
                              if (catalogs?.success && catalogs.models?.length > 0) {
                                props.setOllamaModels(catalogs.models.map((m: any) => ({ name: m.id, modified_at: '' })));
                                setFeedback(`${catalogs.models.length} Models Loaded`);
                              } else {
                                setFeedback("No Models Found");
                              }
                            } catch { setFeedback("API Key Invalid"); }
                            setTimeout(() => setFeedback(null), 2500);
                          }}
                          className="w-full py-2 bg-deep-space-accent-neon/10 border border-deep-space-accent-neon/20 rounded-lg text-deep-space-accent-neon text-[9px] font-black uppercase tracking-widest hover:bg-deep-space-accent-neon/20 transition-all flex items-center justify-center gap-2"
                        >
                          <RefreshCw size={10} />
                          Fetch Live Model Catalog
                        </button>
                      </div>
                    )}

                    {activeProviderId === 'xai' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 text-deep-space-accent-neon mb-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-deep-space-accent-neon">xAI Grok Configuration</span>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-white/30 uppercase font-bold">xAI API Key</label>
                          <input
                            type="password"
                            placeholder="Enter xAI API Key"
                            className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-white/10 outline-none"
                            value={store.xaiApiKey || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => store.setXaiApiKey(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-white/30 uppercase font-bold">Active Model</label>
                          <select
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-deep-space-accent-neon/50 transition-all font-bold"
                            value={store.xaiModel}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => store.setXaiModel(e.target.value)}
                          >
                            {props.ollamaModels.length > 0 ? (
                              props.ollamaModels.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)
                            ) : (
                              <>
                                <option value="grok-3">Grok 3</option>
                                <option value="grok-3-mini">Grok 3 Mini</option>
                              </>
                            )}
                          </select>
                        </div>
                        <button
                          onClick={async () => {
                            if (!store.xaiApiKey) { setFeedback("Enter API Key"); setTimeout(() => setFeedback(null), 2000); return; }
                            try {
                              setFeedback("Fetching Models...");
                              const catalogs = await (window.electronAPI as any).fetchProviderCatalogs?.('xai', store.xaiApiKey);
                              if (catalogs?.success && catalogs.models?.length > 0) {
                                props.setOllamaModels(catalogs.models.map((m: any) => ({ name: m.id, modified_at: '' })));
                                setFeedback(`${catalogs.models.length} Models Loaded`);
                              } else {
                                setFeedback("No Models Found");
                              }
                            } catch { setFeedback("API Key Invalid"); }
                            setTimeout(() => setFeedback(null), 2500);
                          }}
                          className="w-full py-2 bg-deep-space-accent-neon/10 border border-deep-space-accent-neon/20 rounded-lg text-deep-space-accent-neon text-[9px] font-black uppercase tracking-widest hover:bg-deep-space-accent-neon/20 transition-all flex items-center justify-center gap-2"
                        >
                          <RefreshCw size={10} />
                          Fetch Live Model Catalog
                        </button>
                      </div>
                    )}

                    {activeProviderId === 'azure' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 text-deep-space-accent-neon mb-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-deep-space-accent-neon">Azure OpenAI Configuration</span>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-white/30 uppercase font-bold">Azure API Key</label>
                          <input
                            type="password"
                            placeholder="Enter Azure API Key"
                            className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-white/10 outline-none"
                            value={store.azureApiKey || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => store.setAzureApiKey(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-white/30 uppercase font-bold">Azure Base URL</label>
                          <input
                            type="text"
                            placeholder="https://your-resource.openai.azure.com"
                            className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-white/10 outline-none"
                            value={store.azureBaseUrl || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => store.setAzureBaseUrl(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-white/30 uppercase font-bold">Deployment / Model</label>
                          <input
                            type="text"
                            placeholder="e.g. gpt-4o"
                            className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-white/10 outline-none"
                            value={store.azureModel || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => store.setAzureModel(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {activeProviderId === 'apple-intelligence' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 text-deep-space-accent-neon mb-1">
                          <Monitor size={16} className="text-white" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-deep-space-accent-neon">Apple Intelligence (macOS)</span>
                        </div>
                        <p className="text-[9px] text-white/30 leading-relaxed">
                          Use Apple Intelligence for on-device summarization, writing, and image generation on macOS.
                        </p>
                        <button
                          onClick={() => window.electronAPI?.openAppleIntelligence?.()}
                          className="w-full py-2 bg-white/5 border border-white/10 rounded-lg text-white/60 text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                        >
                          Open Apple Intelligence
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </CollapsibleSection>

              {/* ── Section: Advanced ───────────────────────────────── */}
              <CollapsibleSection icon={<Shield size={12} />} label="Advanced" defaultOpen={false}>
                <div className="space-y-4">
                  {/* MCP Server */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-white/30 uppercase font-bold">MCP Server Port</label>
                    <input
                      type="number"
                      placeholder="e.g. 3001"
                      className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-white/10 outline-none"
                      value={store.mcpServerPort || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const newPort = parseInt(e.target.value, 10);
                        if (!isNaN(newPort)) {
                          store.setMcpServerPort(newPort);
                          if (window.electronAPI) {
                            (window.electronAPI as any).setMcpServerPort(newPort);
                          }
                        }
                      }}
                    />
                  </div>

                  {/* AI Instructions */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-white/30 uppercase font-bold">Persistent AI Instructions</label>
                    <textarea
                      placeholder="Enter persistent instructions for the AI (e.g., 'Always respond in markdown')."
                      className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-white/10 outline-none h-20 resize-none"
                      value={store.additionalAIInstructions}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => store.setAdditionalAIInstructions(e.target.value)}
                    />
                  </div>
                </div>
              </CollapsibleSection>

              {/* ── Save Button ──────────────────────────────────────── */}
              <button
                onClick={handleSaveConfig}
                className="w-full py-3 bg-deep-space-accent-neon/10 border border-deep-space-accent-neon/20 hover:bg-deep-space-accent-neon/20 text-deep-space-accent-neon text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Save size={12} />
                {feedback || 'Save Intelligence Config'}
              </button>

              {/* ── Vault Status ─────────────────────────────────────── */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database size={12} className="text-white/40" />
                  <span className="text-[10px] uppercase font-black tracking-widest text-white/30">Vault Status</span>
                </div>
                <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Secure</span>
              </div>

              {/* ── Extensions ───────────────────────────────────────── */}
              <div className="pt-2 border-t border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Puzzle size={12} className="text-deep-space-accent-neon" />
                  <label className="block text-[10px] uppercase font-black tracking-widest text-white/40">Extensions</label>
                </div>
                <button
                  onClick={() => {
                    if (window.electronAPI) {
                      window.electronAPI.openExtensionDir();
                    }
                  }}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/60 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <FolderOpen size={12} />
                  Open Extensions Directory
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LLMProviderSettings;
