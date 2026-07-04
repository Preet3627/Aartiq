"use client";

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Key } from 'lucide-react';

const ApiKeysSettings = () => {
    const {
        openaiApiKey,
        setOpenaiApiKey,
        geminiApiKey,
        setGeminiApiKey,
        anthropicApiKey,
        setAnthropicApiKey,
        groqApiKey,
        setGroqApiKey,
    } = useAppStore();

    return (
        <div className="space-y-8">
            <div className="p-8 rounded-[2rem] bg-white/[0.03] border border-white/5 space-y-8">
                <div>
                    <h3 className="text-lg font-bold text-white mb-2">API Keys</h3>
                    <p className="text-xs text-white/30 mb-6">
                        Provide your own API keys for AI services. These keys are stored locally and are never sent to our servers.
                    </p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-1.5">
                            OpenAI API Key
                        </label>
                        <div className="relative">
                            <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                            <input
                                type="password"
                                value={openaiApiKey || ''}
                                onChange={(e) => setOpenaiApiKey(e.target.value)}
                                placeholder="sk-..."
                                className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-12 pr-6 text-sm text-white focus:outline-none focus:ring-1 focus:ring-deep-space-accent-neon/50 transition-all placeholder:text-white/20"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-1.5">
                            Gemini API Key
                        </label>
                        <div className="relative">
                            <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                            <input
                                type="password"
                                value={geminiApiKey || ''}
                                onChange={(e) => setGeminiApiKey(e.target.value)}
                                placeholder="AIza..."
                                className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-12 pr-6 text-sm text-white focus:outline-none focus:ring-1 focus:ring-deep-space-accent-neon/50 transition-all placeholder:text-white/20"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-1.5">
                            Anthropic API Key (Claude)
                        </label>
                        <div className="relative">
                            <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                            <input
                                type="password"
                                value={anthropicApiKey || ''}
                                onChange={(e) => setAnthropicApiKey(e.target.value)}
                                placeholder="sk-ant-..."
                                className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-12 pr-6 text-sm text-white focus:outline-none focus:ring-1 focus:ring-deep-space-accent-neon/50 transition-all placeholder:text-white/20"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-1.5">
                            Groq API Key
                        </label>
                        <div className="relative">
                            <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                            <input
                                type="password"
                                value={groqApiKey || ''}
                                onChange={(e) => setGroqApiKey(e.target.value)}
                                placeholder="gsk_..."
                                className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-12 pr-6 text-sm text-white focus:outline-none focus:ring-1 focus:ring-deep-space-accent-neon/50 transition-all placeholder:text-white/20"
                            />
                        </div>
                    </div>
                </div>
                <div className="pt-4 border-t border-white/5">
                    <p className="text-[10px] text-orange-400/60 font-medium">
                        ⚠️ Note: For this development build, API keys are stored in local storage. In a production open-source release, it is recommended to use more secure storage like the OS keychain.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ApiKeysSettings;
