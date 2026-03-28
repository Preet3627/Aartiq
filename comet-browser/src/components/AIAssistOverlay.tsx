import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Search, ExternalLink, RefreshCw, ChevronRight, Zap, Target, Layers, Cpu } from 'lucide-react';

interface AIAssistOverlayProps {
    query: string;
    result: string | null;
    sources: { text: string; metadata: any; }[] | null;
    isLoading: boolean;
    provider: string;
    model: string;
    statusMessage?: string;
    durationMs?: number;
    onClose: () => void;
    onRefresh: () => void;
    availableOllamaModels?: { name: string; modified_at?: string }[];
    selectedOllamaModel?: string;
    onOllamaModelSelect?: (model: string) => void;
    onOllamaModelsUpdate?: (models: { name: string; modified_at?: string }[]) => void;
    mode?: 'overlay' | 'window';
}

const AIAssistOverlay = ({
    query, result, sources, isLoading, provider, model,
    statusMessage, durationMs, onClose, onRefresh,
    availableOllamaModels = [], selectedOllamaModel,
    onOllamaModelSelect, onOllamaModelsUpdate,
    mode = 'overlay',
}: AIAssistOverlayProps) => {
    const [ollamaInput, setOllamaInput] = useState(selectedOllamaModel || '');
    const isWindowMode = mode === 'window';

    useEffect(() => {
        setOllamaInput(selectedOllamaModel || '');
    }, [selectedOllamaModel]);

    useEffect(() => {
        if (provider !== 'ollama' || typeof window === 'undefined') return;
        let active = true;
        (async () => {
            if (!window.electronAPI) return;
            const { models } = await window.electronAPI.ollamaListModels();
            if (!active) return;
            if (models?.length) {
                onOllamaModelsUpdate?.(models);
            }
        })();
        return () => {
            active = false;
        };
    }, [provider, onOllamaModelsUpdate]);

    const handleApplyOllamaModel = () => {
        if (!ollamaInput) return;
        onOllamaModelSelect?.(ollamaInput);
    };

    const getSourceHostname = (rawUrl: unknown) => {
        if (typeof rawUrl !== 'string') return 'local-context';
        const value = rawUrl.trim();
        if (!value) return 'local-context';
        try {
            return new URL(value).hostname || 'local-context';
        } catch {
            try {
                return new URL(`https://${value}`).hostname || 'local-context';
            } catch {
                return 'local-context';
            }
        }
    };

    return (
        <div className={isWindowMode ? "h-full w-full p-4" : "fixed top-28 right-8 w-[450px] z-[99999] pointer-events-none"}>
            <motion.div
                initial={{ opacity: 0, scale: 0.9, x: 50, filter: 'blur(20px)' }}
                animate={{ opacity: 1, scale: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.9, x: 50, filter: 'blur(20px)' }}
                className={`pointer-events-auto bg-[#070812]/95 backdrop-blur-3xl border border-white/10 shadow-[0_40px_120px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col relative ${isWindowMode ? 'h-full rounded-[2rem]' : 'rounded-[3rem]'}`}
            >
                {/* Neural Glow Background */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-deep-space-accent-neon/5 blur-[100px] rounded-full -mr-20 -mt-20 pointer-events-none" />

                {/* Header Section */}
                <div className="p-8 pb-4 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                        <motion.div
                            animate={isLoading ? { rotate: 360 } : {}}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-deep-space-accent-neon to-purple-500 flex items-center justify-center text-white shadow-[0_0_30px_rgba(0,255,255,0.3)]"
                        >
                            {isLoading ? <Cpu size={24} /> : <Zap size={24} />}
                        </motion.div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Sparkles size={12} className="text-deep-space-accent-neon animate-pulse" />
                                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Neural Analysis Node</h2>
                            </div>
                            <p className="text-sm font-black text-white truncate max-w-[240px] tracking-tight">{query}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/20 hover:bg-red-500/20 hover:text-red-400 transition-all border border-white/5"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-8 pb-2 space-y-2 relative z-10">
                    <div className="flex flex-wrap gap-3 text-[10px] text-white/60">
                        <span className="px-3 py-1 rounded-full bg-white/10 border border-white/5">{provider.toUpperCase()}</span>
                        <span className="px-3 py-1 rounded-full bg-white/10 border border-white/5">Model: {model}</span>
                        {durationMs && (
                            <span className="px-3 py-1 rounded-full bg-white/10 border border-white/5 text-white/40">Latency: {durationMs}ms</span>
                        )}
                    </div>
                    <p className="text-[9px] text-white/40">{statusMessage || 'Smart overview ready.'}</p>
                    {provider === 'ollama' && (
                        <div className="space-y-2 p-3 bg-white/5 border border-white/10 rounded-2xl text-[9px] text-white/70">
                            <div className="flex items-center justify-between">
                                <span className="font-black uppercase tracking-[0.3em] text-white/40">Ollama Model Picker</span>
                                <span className="text-[8px] text-white/30">Any model, any time.</span>
                            </div>
                            <div className="flex gap-2">
                                <select
                                    value={selectedOllamaModel || ''}
                                    onChange={(e) => onOllamaModelSelect?.(e.target.value)}
                                    className="flex-1 bg-black/20 border border-white/10 rounded-2xl px-3 py-2 text-[10px] text-white outline-none"
                                >
                                    <option value="">Select from installed models</option>
                                    {availableOllamaModels?.map((modelEntry) => (
                                        <option key={modelEntry.name} value={modelEntry.name}>
                                            {modelEntry.name}{modelEntry.modified_at ? ` · ${modelEntry.modified_at}` : ''}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!window.electronAPI) return;
                                        const { models } = await window.electronAPI.ollamaListModels();
                                        if (models?.length) {
                                            onOllamaModelsUpdate?.(models);
                                        }
                                    }}
                                    className="px-4 py-2 rounded-full bg-white/10 text-[9px] font-black uppercase tracking-[0.5em] text-white border border-white/20 hover:bg-white/20"
                                >
                                    Refresh
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    className="flex-1 bg-black/20 border border-white/10 rounded-2xl px-3 py-2 text-[10px] text-white outline-none"
                                    placeholder="Type any Ollama model (e.g. custom-model:1.0)"
                                    value={ollamaInput}
                                    onChange={(e) => setOllamaInput(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={handleApplyOllamaModel}
                                    className="px-4 py-2 rounded-full bg-deep-space-accent-neon/60 text-[9px] font-black uppercase tracking-[0.5em] text-black border border-deep-space-accent-neon/30"
                                >
                                    Use
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="px-8 py-2 flex-1 overflow-y-auto custom-scrollbar space-y-8 max-h-[60vh] relative z-10">
                    {/* Active State Tabs */}
                    <div className="flex gap-2 p-1 bg-white/[0.03] rounded-2xl border border-white/5">
                        <div className="flex-1 px-4 py-2 bg-white/5 rounded-xl flex items-center justify-center gap-2">
                            <Target size={12} className="text-deep-space-accent-neon" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-white/60">Insight</span>
                        </div>
                        <div className="flex-1 px-4 py-2 hover:bg-white/5 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer">
                            <Layers size={12} className="text-purple-400" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Context</span>
                        </div>
                    </div>

                    {/* Sources Section */}
                    {!isLoading && sources && sources.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[9px] font-black uppercase tracking-widest text-white/20">Verified Knowledge Base</h3>
                                <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-deep-space-accent-neon/10 text-deep-space-accent-neon border border-deep-space-accent-neon/20">{sources.length} SOURCES</span>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                {sources.slice(0, 3).map((s, i: number) => (
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        key={i}
                                        className="p-4 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-deep-space-accent-neon/30 transition-all group cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-deep-space-accent-neon shadow-[0_0_8px_#00ffff]" />
                                                <span className="text-[10px] font-bold text-white/40 truncate max-w-[150px]">
                                                    {getSourceHostname(s?.metadata?.url)}
                                                </span>
                                            </div>
                                            <ExternalLink size={10} className="text-white/20 group-hover:text-deep-space-accent-neon transition-colors" />
                                        </div>
                                        <p className="text-xs text-white/70 line-clamp-2 leading-relaxed italic">"{s.text}"</p>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Main Content */}
                    <div className="relative">
                        {isLoading ? (
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <div className="h-4 bg-white/5 rounded-lg w-full animate-pulse" />
                                    <div className="h-4 bg-white/5 rounded-lg w-5/6 animate-pulse" />
                                    <div className="h-4 bg-white/5 rounded-lg w-4/6 animate-pulse" />
                                </div>
                                <div className="h-32 bg-white/[0.02] rounded-[2rem] border border-white/5 w-full animate-pulse flex items-center justify-center">
                                    <RefreshCw className="text-white/10 animate-spin" size={32} />
                                </div>
                            </div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="space-y-6"
                            >
                                <div className="prose prose-invert prose-sm text-white/90 leading-[1.8] font-medium text-sm">
                                    <div
                                        className="ai-response-content"
                                        dangerouslySetInnerHTML={{ __html: result || "Processing semantic data..." }}
                                    />
                                </div>

                                {/* Deep Insight Points */}
                                <div className="p-6 rounded-[2.5rem] bg-gradient-to-br from-white/[0.03] to-transparent border border-white/5 space-y-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 rounded-xl bg-deep-space-accent-neon/10 text-deep-space-accent-neon">
                                            <Target size={14} />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white">Synthesized Intel</span>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-4">
                                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-deep-space-accent-neon shadow-[0_0_12px_#00ffff]" />
                                            <p className="text-[11px] text-white/60 leading-relaxed">Integrated from <span className="text-white">Global Web Index</span> and <span className="text-white">Local History Memory</span>.</p>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_12px_#a855f7]" />
                                            <p className="text-[11px] text-white/60 leading-relaxed">Cross-referenced against verified <span className="text-purple-400">Academic & Technical nodes</span>.</p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Footer / Follow-ups */}
                {!isLoading && (
                    <div className="p-8 pt-4 relative z-10">
                        <div className="pt-6 border-t border-white/5 flex gap-3">
                        <button
                            className="flex-1 py-4 bg-white/[0.05] hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/60 transition-all border border-white/5 flex items-center justify-center gap-2 group"
                            onClick={onRefresh}
                            disabled={isLoading}
                        >
                            Deep Dive <Search size={14} />
                        </button>
                            <button className="flex-1 py-4 bg-deep-space-accent-neon/10 hover:bg-deep-space-accent-neon/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-deep-space-accent-neon transition-all border border-deep-space-accent-neon/20 flex items-center justify-center gap-2 group shadow-[0_0_20px_rgba(0,255,255,0.1)]">
                                Full RAG <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>

            <style jsx global>{`
                .ai-response-content b, .ai-response-content strong {
                    color: #00ffff;
                    font-weight: 900;
                    text-shadow: 0 0 10px rgba(0,255,255,0.3);
                }
                .ai-response-content p {
                    margin-bottom: 1.25rem;
                }
            `}</style>
        </div>
    );
};

export default AIAssistOverlay;
