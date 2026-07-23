"use client";

import React, { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Key, Check, ChevronDown, ChevronUp, ExternalLink, Cpu, Sparkles } from 'lucide-react';

const PROVIDER_PRIORITY_MODELS: Record<string, string[]> = {
    google: ['gemini-3-pro-preview', 'gemini-2.5-pro', 'gemini-pro-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    'google-flash': ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-2.0-flash'],
    openai: ['gpt-5.1', 'gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4o'],
    anthropic: ['claude-sonnet-4-20250514', 'claude-sonnet-4', 'claude-opus-4-1', 'claude-opus-4', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
    groq: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'moonshotai/kimi-k2', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'],
    xai: ['grok-4-fast-reasoning', 'grok-4-fast-non-reasoning', 'grok-4', 'grok-3', 'grok-2'],
};

const PROVIDER_DOCS: Record<string, string> = {
    google: 'https://ai.google.dev/models/gemini',
    'google-flash': 'https://ai.google.dev/models/gemini',
    openai: 'https://platform.openai.com/docs/models',
    anthropic: 'https://docs.anthropic.com/en/docs/about-claude/models',
    groq: 'https://console.groq.com/docs/api-reference',
    xai: 'https://docs.x.ai/docs/api-reference',
};

const PROVIDER_COLORS: Record<string, string> = {
    google: 'from-blue-500/20 to-green-500/20 border-blue-500/20',
    'google-flash': 'from-blue-500/20 to-green-500/20 border-blue-500/20',
    openai: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/20',
    anthropic: 'from-orange-500/20 to-amber-500/20 border-orange-500/20',
    groq: 'from-purple-500/20 to-violet-500/20 border-purple-500/20',
    xai: 'from-sky-500/20 to-cyan-500/20 border-sky-500/20',
    ollama: 'from-zinc-500/20 to-gray-500/20 border-zinc-500/20',
    'azure-openai': 'from-blue-600/20 to-indigo-500/20 border-blue-600/20',
};

const PROVIDER_ICONS: Record<string, string> = {
    google: '🔵',
    'google-flash': '⚡',
    openai: '🟢',
    anthropic: '🟠',
    groq: '🟣',
    xai: '💫',
    ollama: '🦙',
    'azure-openai': '🔷',
};

interface ProviderCardProps {
    id: string;
    name: string;
    apiKey: string;
    setApiKey: (key: string) => void;
    model: string;
    setModel: (model: string) => void;
    placeholder: string;
    isActive: boolean;
    onActivate: () => void;
    extraFields?: React.ReactNode;
}

const ProviderCard = ({ id, name, apiKey, setApiKey, model, setModel, placeholder, isActive, onActivate, extraFields }: ProviderCardProps) => {
    const [expanded, setExpanded] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const hasKey = apiKey && apiKey.length > 0;
    const colorClass = PROVIDER_COLORS[id] || PROVIDER_COLORS.ollama;
    const icon = PROVIDER_ICONS[id] || '🤖';
    const models = PROVIDER_PRIORITY_MODELS[id] || [];
    const docsUrl = PROVIDER_DOCS[id];

    return (
        <div className={`rounded-2xl border transition-all ${isActive ? 'border-sky-400/40 bg-sky-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
            <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center text-lg flex-shrink-0`}>
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{name}</span>
                        {isActive && (
                            <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 text-[10px] font-bold uppercase tracking-wider">
                                Active
                            </span>
                        )}
                        {hasKey && !isActive && (
                            <span className="w-2 h-2 rounded-full bg-green-400/60" title="API key configured" />
                        )}
                    </div>
                    <p className="text-[11px] text-white/30 truncate mt-0.5">
                        {hasKey ? `Key: ••••${apiKey.slice(-4)}` : 'No API key configured'}
                        {model ? ` · ${model}` : ''}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {!isActive && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onActivate(); }}
                            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-white/50 hover:text-white transition-all"
                        >
                            Set Active
                        </button>
                    )}
                    {expanded ? <ChevronUp size={16} className="text-white/30" /> : <ChevronDown size={16} className="text-white/30" />}
                </div>
            </div>

            {expanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
                            API Key
                        </label>
                        <div className="relative">
                            <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                            <input
                                type={showKey ? 'text' : 'password'}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={placeholder}
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-20 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-400/50 transition-all placeholder:text-white/20"
                            />
                            <button
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-white/30 hover:text-white/60 transition-colors"
                            >
                                {showKey ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>

                    {models.length > 0 && (
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
                                Model
                            </label>
                            <select
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-400/50 transition-all appearance-none cursor-pointer"
                            >
                                {models.map((m) => (
                                    <option key={m} value={m} className="bg-[#111]">{m}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {extraFields}

                    {docsUrl && (
                        <a
                            href={docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[11px] text-white/25 hover:text-sky-400 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <ExternalLink size={11} />
                            API docs
                        </a>
                    )}
                </div>
            )}
        </div>
    );
};

const ApiKeysSettings = () => {
    const store = useAppStore();

    const providers = [
        {
            id: 'google',
            name: 'Google Gemini',
            apiKey: store.geminiApiKey || '',
            setApiKey: store.setGeminiApiKey,
            model: store.geminiModel || '',
            setModel: store.setGeminiModel,
            placeholder: 'AIza...',
        },
        {
            id: 'google-flash',
            name: 'Google Gemini Flash',
            apiKey: store.geminiApiKey || '',
            setApiKey: store.setGeminiApiKey,
            model: store.geminiFlashModel || '',
            setModel: store.setGeminiFlashModel,
            placeholder: 'Uses same key as Google Gemini',
        },
        {
            id: 'openai',
            name: 'OpenAI',
            apiKey: store.openaiApiKey || '',
            setApiKey: store.setOpenaiApiKey,
            model: store.openaiModel || '',
            setModel: store.setOpenaiModel,
            placeholder: 'sk-...',
        },
        {
            id: 'anthropic',
            name: 'Anthropic Claude',
            apiKey: store.anthropicApiKey || '',
            setApiKey: store.setAnthropicApiKey,
            model: store.anthropicModel || '',
            setModel: store.setAnthropicModel,
            placeholder: 'sk-ant-...',
        },
        {
            id: 'groq',
            name: 'Groq',
            apiKey: store.groqApiKey || '',
            setApiKey: store.setGroqApiKey,
            model: store.groqModel || '',
            setModel: store.setGroqModel,
            placeholder: 'gsk_...',
        },
        {
            id: 'xai',
            name: 'xAI Grok',
            apiKey: store.xaiApiKey || '',
            setApiKey: store.setXaiApiKey,
            model: store.xaiModel || '',
            setModel: store.setXaiModel,
            placeholder: 'xai-...',
        },
        {
            id: 'azure-openai',
            name: 'Azure OpenAI',
            apiKey: store.azureOpenaiApiKey || '',
            setApiKey: store.setAzureOpenaiApiKey,
            model: store.azureOpenaiModel || '',
            setModel: store.setAzureOpenaiModel,
            placeholder: 'Azure endpoint key',
            extraFields: (
                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
                        Endpoint URL
                    </label>
                    <input
                        type="text"
                        value={store.azureOpenaiEndpoint || ''}
                        onChange={(e) => store.setAzureOpenaiEndpoint(e.target.value)}
                        placeholder="https://your-resource.openai.azure.com/"
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-400/50 transition-all placeholder:text-white/20"
                    />
                </div>
            ),
        },
        {
            id: 'ollama',
            name: 'Ollama (Local)',
            apiKey: '',
            setApiKey: () => {},
            model: store.ollamaModel || '',
            setModel: store.setOllamaModel,
            placeholder: '',
            extraFields: (
                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
                        Base URL
                    </label>
                    <input
                        type="text"
                        value={store.ollamaBaseUrl || 'http://127.0.0.1:11434'}
                        onChange={(e) => store.setOllamaBaseUrl(e.target.value)}
                        placeholder="http://127.0.0.1:11434"
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-400/50 transition-all placeholder:text-white/20"
                    />
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/5">
                <div className="flex items-center gap-3 mb-2">
                    <Sparkles size={18} className="text-sky-400" />
                    <h3 className="text-lg font-bold text-white">AI Providers</h3>
                </div>
                <p className="text-xs text-white/30 mb-6">
                    Configure API keys, select models, and set your active AI provider. Keys are stored in your OS keychain.
                </p>

                <div className="space-y-2">
                    {providers.map((p) => (
                        <ProviderCard
                            key={p.id}
                            id={p.id}
                            name={p.name}
                            apiKey={p.apiKey}
                            setApiKey={p.setApiKey}
                            model={p.model}
                            setModel={p.setModel}
                            placeholder={p.placeholder}
                            isActive={store.aiProvider === p.id}
                            onActivate={() => store.setAIProvider(p.id)}
                            extraFields={p.extraFields}
                        />
                    ))}
                </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="flex items-start gap-3">
                    <Cpu size={16} className="text-white/20 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-bold text-white/40 mb-1">Security Note</p>
                        <p className="text-[11px] text-white/25 leading-relaxed">
                            API keys are stored locally in your OS native keychain (macOS Keychain / Windows Credential Manager) and are never sent to our servers. Only the active provider is used for AI requests.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ApiKeysSettings;
