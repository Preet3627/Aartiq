"use client";
import React from 'react';
import { motion } from 'framer-motion';

const InitializingOverlay = () => {
    return (
        <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-[#050505]"
        >
            <div className="relative flex flex-col items-center">
                {/* Subtle glowing background */}
                <motion.div 
                    animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.2, 0.4, 0.2]
                    }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 bg-sky-500/20 blur-[120px] rounded-full"
                />
                
                {/* Minimal Logo */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="relative z-10 flex flex-col items-center gap-6"
                >
                    <div className="w-20 h-20 relative px-4">
                        <img src="/logo-transparent.png" alt="Aartiq" className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(56,189,248,0.5)]" />
                    </div>
                    
                    <div className="flex flex-col items-center gap-3">
                        <h1 className="text-3xl font-black tracking-[0.5em] text-white uppercase bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">Aartiq</h1>
                        <div className="flex items-center gap-4">
                            <div className="h-[1px] w-16 bg-white/5" />
                            <motion.span 
                                animate={{ opacity: [0.2, 0.5, 0.2] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40"
                            >
                                Neural Core Engine
                            </motion.span>
                            <div className="h-[1px] w-16 bg-white/5" />
                        </div>
                    </div>
                </motion.div>

                {/* Minimalist Loading Bar */}
                <div className="absolute bottom-[240px] w-40 h-[2px] bg-white/5 overflow-hidden rounded-full">
                    <motion.div 
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                        className="w-1/2 h-full bg-gradient-to-r from-transparent via-sky-400 to-transparent"
                    />
                </div>
            </div>
        </motion.div>
    );
};

export default InitializingOverlay;
