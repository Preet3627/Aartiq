"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, X, CameraOff, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PhoneCamera = ({ onClose }: { onClose: () => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isActive, setIsActive] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsActive(true);
                setError(null);
            }
        } catch (err: any) {
            setError("Camera access denied or unavailable.");
            setIsActive(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(track => track.stop());
            setIsActive(false);
        }
    };

    useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, []);

    return (
        <div className="fixed bottom-8 right-8 z-[100] w-72 rounded-3xl overflow-hidden glass-dark border border-white/10 shadow-2xl shadow-black/50 overflow-hidden">
            <header className="p-4 flex items-center justify-between border-b border-white/5 bg-white/5">
                <div className="flex items-center gap-2">
                    <Camera size={16} className="text-deep-space-accent-neon" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Vision Engine</span>
                </div>
                <button onClick={onClose} className="text-white/20 hover:text-white transition-colors">
                    <X size={16} />
                </button>
            </header>

            <div className="relative aspect-[3/4] bg-black flex items-center justify-center">
                {error ? (
                    <div className="text-center p-6 space-y-4">
                        <CameraOff size={32} className="mx-auto text-red-500/40" />
                        <p className="text-[10px] text-white/40 font-bold uppercase leading-relaxed">{error}</p>
                        <button
                            onClick={startCamera}
                            className="px-4 py-2 bg-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover grayscale brightness-110 contrast-125 opacity-80"
                        />
                        {/* Overlay Grid */}
                        <div className="absolute inset-0 border-[20px] border-black/10 pointer-events-none">
                            <div className="w-full h-full border border-deep-space-accent-neon/20 rounded-2xl relative">
                                {/* Scanning line animation */}
                                <motion.div
                                    animate={{ top: ['0%', '100%', '0%'] }}
                                    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                                    className="absolute left-0 right-0 h-[1px] bg-deep-space-accent-neon shadow-[0_0_10px_#00FFFF]"
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>

            <footer className="p-4 grid grid-cols-2 gap-2 bg-white/5 border-t border-white/5">
                <button className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-deep-space-accent-neon text-deep-space-bg font-bold text-[10px] uppercase tracking-widest hover:scale-105 transition-all">
                    <Sparkles size={12} />
                    Analyze
                </button>
                <button
                    onClick={() => { stopCamera(); startCamera(); }}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/5 text-white/60 font-bold text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                    <RefreshCw size={12} />
                    Flip
                </button>
            </footer>
        </div>
    );
};

export default PhoneCamera;
