"use client";
import React from 'react';
import { Shield } from 'lucide-react';

const LoginPrompt = ({ onLogin }: { onLogin: () => void }) => {
    return (
        <div className="p-12 glass-vibrant rounded-[3rem] border border-white/10 text-center">
            <Shield size={64} className="text-cyan-400 mx-auto mb-8 animate-pulse" />
            <h3 className="text-2xl font-black uppercase mb-4">Portal Verification</h3>
            <p className="text-sm text-white/40 mb-8">Click below to authenticate via your official Ponsri School account.</p>
            <button onClick={onLogin} className="w-full py-4 bg-cyan-400 text-black font-black rounded-2xl uppercase tracking-widest text-xs hover:scale-105 transition-all">
                Authenticate Now
            </button>
        </div>
    );
};

export default LoginPrompt;
