"use client";

import React, { useState } from 'react';
import { Network, Server } from 'lucide-react';

const ProxySettings = () => {
    const [config, setConfig] = useState({
        mode: 'direct', // direct, fixed_servers, system
        server: '',
        port: ''
    });

    const applyProxy = async () => {
        if (window.electronAPI) {
            let proxyConfig: any = { mode: config.mode };
            if (config.mode === 'fixed_servers') {
                proxyConfig.rules = `http=${config.server}:${config.port};https=${config.server}:${config.port}`;
            }
            await window.electronAPI.setProxy(proxyConfig);
            alert('Proxy settings applied successfully.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
                {['direct', 'fixed_servers', 'system'].map(mode => (
                    <button
                        key={mode}
                        onClick={() => setConfig({ ...config, mode })}
                        className={`px-4 py-3 rounded-2xl border text-sm font-bold uppercase tracking-wide ${config.mode === mode
                            ? 'bg-deep-space-accent-neon text-deep-space-bg border-deep-space-accent-neon'
                            : 'bg-white/5 border-white/5 text-white/40 hover:text-white'}`}
                    >
                        {mode.replace('_', ' ')}
                    </button>
                ))}
            </div>

            {config.mode === 'fixed_servers' && (
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Proxy Host / IP</label>
                            <input
                                type="text"
                                value={config.server}
                                onChange={(e) => setConfig({ ...config, server: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
                                placeholder="127.0.0.1"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Port</label>
                            <input
                                type="text"
                                value={config.port}
                                onChange={(e) => setConfig({ ...config, port: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm"
                                placeholder="8080"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/30">
                        <Network size={14} />
                        <span>Supports HTTP/HTTPS/SOCKS v5</span>
                    </div>
                </div>
            )}

            <button
                onClick={applyProxy}
                className="w-full py-4 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-2xl font-black uppercase tracking-widest transition-all"
            >
                Apply Proxy Configuration
            </button>
        </div>
    );
};

export default ProxySettings;
