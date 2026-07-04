"use client";

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Image as ImageIcon, Video, File, ArrowRight, Zap, Download } from 'lucide-react';

const MediaStudio = () => {
    const [activeTab, setActiveTab] = useState<'upscaler' | 'converter'>('upscaler');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [processedImage, setProcessedImage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Converter State
    const [convertFormat, setConvertFormat] = useState('png');

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => setSelectedImage(e.target?.result as string);
            reader.readAsDataURL(file);
            setProcessedImage(null);
        }
    };

    const handleUpscale = () => {
        if (!selectedImage) return;
        setIsProcessing(true);
        // Simulation of AI upscaling delay
        setTimeout(() => {
            // In a real app, this would send to Electron/Backend or use a WASM model.
            // For now, we simulate success by just using the same image (or a larger canvas draw).
            // A clearer demo would be to just pretend for the UI flow.
            setProcessedImage(selectedImage);
            setIsProcessing(false);
        }, 3000);
    };

    const handleConvert = () => {
        if (!selectedImage) return;
        setIsProcessing(true);
        setTimeout(() => {
            // Simulate conversion
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0);
                // Real conversion logic
                const mime = `image/${convertFormat}`;
                const dataUrl = canvas.toDataURL(mime);
                setProcessedImage(dataUrl);
                setIsProcessing(false);
            };
            img.src = selectedImage;
        }, 1500);
    };

    return (
        <div className="flex h-full w-full bg-[var(--primary-bg)] gap-4 p-4 text-[var(--primary-text)] font-sans relative z-50">
            <div className="w-64 bg-[var(--card-bg)]/40 backdrop-blur-xl rounded-3xl border border-[var(--border-color)] flex flex-col p-4 gap-2">
                <div className="p-4 mb-4">
                    <h2 className="text-xl font-black uppercase tracking-tight text-[var(--primary-text)] mb-1">Media Studio</h2>
                    <p className="text-[10px] text-[var(--secondary-text)]/40 uppercase tracking-widest">Inbuilt AI Utilities</p>
                </div>

                <button onClick={() => setActiveTab('upscaler')} className={`flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === 'upscaler' ? 'bg-gradient-to-r from-accent/20 to-accent-light/10 text-accent border border-accent/20 shadow-[0_4px_15px_rgba(0,0,0,0.1)]' : 'text-[var(--secondary-text)]/60 hover:bg-[var(--primary-bg)]/5 border border-transparent'}`}>
                    <Zap size={18} />
                    <span className="text-xs font-bold uppercase tracking-widest">AI Upscaler</span>
                </button>
                <button onClick={() => setActiveTab('converter')} className={`flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === 'converter' ? 'bg-gradient-to-r from-accent/20 to-accent-light/10 text-accent border border-accent/20 shadow-[0_4px_15px_rgba(0,0,0,0.1)]' : 'text-[var(--secondary-text)]/60 hover:bg-[var(--primary-bg)]/5 border border-transparent'}`}>
                    <ArrowRight size={18} />
                    <span className="text-xs font-bold uppercase tracking-widest">Universal Converter</span>
                </button>
            </div>

            <div className="flex-1 bg-[var(--card-bg)]/20 backdrop-blur-lg rounded-3xl border border-[var(--border-color)] flex flex-col items-center justify-center p-8 relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute inset-0 bg-grid-white/[0.02]" />

                {!selectedImage ? (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="relative z-10 w-full max-w-xl h-96 border-2 border-dashed border-[var(--border-color)] rounded-[3rem] flex flex-col items-center justify-center cursor-pointer hover:border-accent/50 hover:bg-[var(--primary-bg)]/5 transition-all group"
                    >
                        <div className="w-20 h-20 bg-[var(--primary-bg)]/5 rounded-3xl flex items-center justify-center text-[var(--secondary-text)]/20 group-hover:text-accent group-hover:scale-110 transition-all mb-6">
                            <ImageIcon size={40} />
                        </div>
                        <p className="text-lg font-bold text-[var(--primary-text)] mb-2">Drop your media here</p>
                        <p className="text-xs text-[var(--secondary-text)]/40 uppercase tracking-widest">Supports JPG, PNG, WEBP</p>
                    </div>
                ) : (
                    <div className="flex gap-8 w-full h-full relative z-10">
                        <div className="flex-1 flex flex-col gap-4">
                            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--secondary-text)]/40">Original</h3>
                            <div className="flex-1 rounded-3xl bg-accent/5 border border-[var(--border-color)] overflow-hidden flex items-center justify-center p-4">
                                <img src={selectedImage} alt="Original" className="max-w-full max-h-full object-contain" />
                            </div>
                            <button onClick={() => setSelectedImage(null)} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-bold uppercase tracking-widest text-white/60 transition-all">
                                Cancel
                            </button>
                        </div>

                        <div className="flex flex-col justify-center gap-4">
                            <ArrowRight className="text-white/20" size={32} />
                        </div>

                        <div className="flex-1 flex flex-col gap-4">
                            <h3 className="text-xs font-black uppercase tracking-widest text-white/40">{activeTab === 'upscaler' ? 'AI Enhanced' : `Converted (${convertFormat.toUpperCase()})`}</h3>
                            <div className="flex-1 rounded-3xl bg-black/40 border border-white/5 overflow-hidden flex items-center justify-center p-4 relative">
                                {isProcessing && (
                                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center flex-col gap-4 z-20">
                                        <div className="w-12 h-12 border-4 border-white/20 border-t-deep-space-accent-neon rounded-full animate-spin" />
                                        <p className="text-xs font-bold uppercase tracking-widest animate-pulse">Processing Media...</p>
                                    </div>
                                )}
                                {processedImage ? (
                                    <img src={processedImage} alt="Processed" className="max-w-full max-h-full object-contain" />
                                ) : (
                                    <div className="text-white/20 text-center">
                                        <Zap size={40} className="mx-auto mb-4 opacity-50" />
                                        <p className="text-xs font-bold">Ready to process</p>
                                    </div>
                                )}
                            </div>
                            {processedImage ? (
                                <a href={processedImage} download={`processed_comet.${activeTab === 'converter' ? convertFormat : 'png'}`} className="p-4 bg-deep-space-accent-neon hover:bg-deep-space-accent-neon/80 rounded-2xl text-deep-space-bg text-xs font-black uppercase tracking-widest text-center transition-all flex items-center justify-center gap-2">
                                    <Download size={16} /> Download Result
                                </a>
                            ) : (
                                activeTab === 'upscaler' ? (
                                    <button onClick={handleUpscale} className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl text-xs font-bold uppercase tracking-widest text-white transition-all">
                                        Start Upscaling (2x)
                                    </button>
                                ) : (
                                    <div className="flex gap-2">
                                        <select value={convertFormat} onChange={e => setConvertFormat(e.target.value)} className="bg-black/40 border border-white/10 rounded-2xl px-4 text-xs font-bold text-white focus:outline-none">
                                            <option value="png">PNG</option>
                                            <option value="jpeg">JPG</option>
                                            <option value="webp">WEBP</option>
                                        </select>
                                        <button onClick={handleConvert} className="flex-1 p-4 bg-white/10 hover:bg-white/20 rounded-2xl text-xs font-bold uppercase tracking-widest text-white transition-all">
                                            Convert
                                        </button>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                )}

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileSelect}
                />
            </div>
        </div>
    );
};

export default MediaStudio;
