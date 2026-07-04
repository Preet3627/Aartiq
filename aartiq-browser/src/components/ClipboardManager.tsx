"use client";

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Clipboard, Trash2, Copy, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ClipboardManager = ({ onClose }: { onClose?: () => void }) => {
    const { clipboard, addClipboardItem, clearClipboard } = useAppStore();
    const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

    const handleClose = () => {
        if (onClose) onClose();
        else window.close();
    };

    const handleCopy = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <div className="flex flex-col h-full bg-black/20 rounded-2xl border border-white/5 overflow-hidden relative z-[1000]">
            <header className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5 drag-region">
                <div className="flex items-center gap-2">
                    <Clipboard size={16} className="text-secondary-text" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Clipboard History</span>
                </div>
                <div className="flex items-center gap-2 no-drag-region">
                    <button
                        onClick={clearClipboard}
                        className="p-1.5 hover:bg-red-500/10 text-white/20 hover:text-red-400 rounded-lg transition-all"
                        title="Clear Clipboard"
                    >
                        <Trash2 size={14} />
                    </button>
                    <button
                        onClick={handleClose}
                        className="p-1.5 hover:bg-white/10 text-white/40 hover:text-white rounded-lg transition-all"
                        title="Close"
                    >
                        <X size={14} />
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {clipboard.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-8">
                        <Clipboard size={32} className="mb-2" />
                        <p className="text-[10px] uppercase font-bold tracking-tighter">Empty History</p>
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {clipboard.map((text, i) => (
                            <motion.div
                                key={text + i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="group p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all relative overflow-hidden"
                            >
                                <p className="text-xs text-white/60 line-clamp-2 break-all pr-8">{text}</p>
                                <button
                                    onClick={() => handleCopy(text, i)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/40 rounded-lg text-white/40 hover:text-deep-space-accent-neon transition-all"
                                >
                                    {copiedIndex === i ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>

            <div className="p-3 bg-white/5 border-t border-white/5">
                <p className="text-[8px] text-center text-white/20 uppercase font-black tracking-widest">
                    Synced across devices
                </p>
            </div>
        </div>
    );
};

export default ClipboardManager;
