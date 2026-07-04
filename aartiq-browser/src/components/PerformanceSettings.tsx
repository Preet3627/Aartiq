"use client";

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Zap, ZapOff, Sliders } from 'lucide-react';

const PerformanceSettings = () => {
    const {
        performanceMode,
        setPerformanceMode,
        performanceModeSettings,
        updatePerformanceModeSettings
    } = useAppStore();

    return (
        <div className="space-y-8">
            <div className="p-8 rounded-[2rem] bg-white/[0.03] border border-white/5 space-y-8">
                <div>
                    <h3 className="text-lg font-bold text-white mb-2">Performance Mode</h3>
                    <p className="text-xs text-white/30 mb-6">Optimize resource usage by suspending inactive tabs.</p>
                </div>

                <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
                    <button
                        onClick={() => setPerformanceMode('normal')}
                        className={`w-full px-4 py-2 rounded-lg text-sm font-bold transition-all ${performanceMode === 'normal' ? 'bg-deep-space-accent-neon text-deep-space-bg' : 'text-white/40 hover:text-white'}`}
                    >
                        Normal
                    </button>
                    <button
                        onClick={() => setPerformanceMode('performance')}
                        className={`w-full px-4 py-2 rounded-lg text-sm font-bold transition-all ${performanceMode === 'performance' ? 'bg-deep-space-accent-neon text-deep-space-bg' : 'text-white/40 hover:text-white'}`}
                    >
                        Performance
                    </button>
                </div>

                {performanceMode === 'performance' && (
                    <div className="space-y-6 pt-6 border-t border-white/5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-white">Max Active Tabs</p>
                                <p className="text-xs text-white/30">The maximum number of tabs to keep active.</p>
                            </div>
                            <input
                                type="number"
                                min="1"
                                max="20"
                                value={performanceModeSettings.maxActiveTabs}
                                onChange={(e) => updatePerformanceModeSettings({ maxActiveTabs: parseInt(e.target.value) })}
                                className="w-20 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white text-center"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-white">Max RAM Allocation (MB)</p>
                                <p className="text-xs text-white/30">The total RAM allocated for all tabs.</p>
                            </div>
                            <input
                                type="number"
                                min="512"
                                max="8192"
                                step="512"
                                value={performanceModeSettings.maxRam}
                                onChange={(e) => updatePerformanceModeSettings({ maxRam: parseInt(e.target.value) })}
                                className="w-20 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white text-center"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-white">Keep Audio Tabs Active</p>
                                <p className="text-xs text-white/30">Tabs playing audio will not be suspended.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={performanceModeSettings.keepAudioTabsActive}
                                    onChange={(e) => updatePerformanceModeSettings({ keepAudioTabsActive: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-deep-space-accent-neon"></div>
                            </label>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PerformanceSettings;
