"use client";

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { History as HistoryIcon, Globe } from 'lucide-react';

const HistoryPanel = () => {
    const history = useAppStore((state) => state.history);
    const clearHistory = useAppStore((state) => state.clearHistory);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Browsing History</h3>
                {history.length > 0 && (
                    <button 
                        onClick={clearHistory}
                        className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                    >
                        Clear Browsing Data
                    </button>
                )}
            </div>
            {history.length === 0 ? (
                <p className="text-white/50">No browsing history yet.</p>
            ) : (
                <ul className="space-y-2">
                    {history.map((item, index) => (
                        <li key={index} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
                            <Globe size={16} className="text-white/50" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-white truncate">{item.title}</p>
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-white/40 hover:text-deep-space-accent-neon truncate">
                                    {item.url}
                                </a>
                            </div>
                            {item.timestamp &&
                                <p className="text-xs text-white/30">{new Date(item.timestamp).toLocaleString()}</p>
                            }
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default HistoryPanel;
