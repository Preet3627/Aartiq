"use client";

import React, { memo, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Shield, Eye, EyeOff, Brain, Activity, Zap, Trash2, X } from 'lucide-react';
import { getPrivacySettings, savePrivacySettings, type PrivacySettings } from './types';

interface PrivacyControlsProps {
  onClose: () => void;
}

const PrivacyControls = memo(function PrivacyControls({ onClose }: PrivacyControlsProps) {
  const [settings, setSettings] = useState<PrivacySettings>({ ...getPrivacySettings() });

  const update = useCallback((key: keyof PrivacySettings, value: boolean) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    savePrivacySettings(updated);
  }, [settings]);

  const clearAllData = useCallback(() => {
    try {
      localStorage.removeItem('aartiq_preference_memory');
      localStorage.removeItem('aartiq_session_memory');
      localStorage.removeItem('aartiq_vector_memory');
    } catch { }
  }, []);

  const toggles: Array<{
    key: keyof PrivacySettings;
    label: string;
    desc: string;
    icon: React.ReactNode;
    enabled: boolean;
  }> = [
    {
      key: 'disableMemory',
      label: 'Disable Memory',
      desc: 'Stop AI from remembering past conversations',
      icon: <Brain size={12} />,
      enabled: settings.disableMemory,
    },
    {
      key: 'disablePreferenceLearning',
      label: 'Disable Preference Learning',
      desc: 'Stop AI from learning your preferences',
      icon: <Activity size={12} />,
      enabled: settings.disablePreferenceLearning,
    },
    {
      key: 'disableTabIntelligence',
      label: 'Disable Tab Intelligence',
      desc: 'Stop AI from analyzing your open tabs',
      icon: <EyeOff size={12} />,
      enabled: settings.disableTabIntelligence,
    },
    {
      key: 'disableAnimations',
      label: 'Disable Animations',
      desc: 'Turn off AI status animations and glow effects',
      icon: <Zap size={12} />,
      enabled: settings.disableAnimations,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="rounded-xl border border-[color-mix(in_srgb,var(--border-color)_30%,transparent)] bg-[color-mix(in_srgb,var(--card-bg)_96%,transparent)] backdrop-blur-2xl overflow-hidden shadow-2xl"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-sky-400" />
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-secondary-text">AI Data Controls</h3>
        </div>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-white/10 text-secondary-text/50 hover:text-secondary-text transition-all">
          <X size={14} />
        </button>
      </div>

      <div className="px-4 py-3 space-y-2">
        {toggles.map((t) => (
          <label key={t.key} className="flex items-start gap-3 py-2 cursor-pointer group">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={t.enabled}
                onChange={() => update(t.key, !t.enabled)}
                className="sr-only"
              />
              <div className={`w-7 h-4 rounded-full transition-colors ${
                t.enabled ? 'bg-sky-500/40' : 'bg-white/[0.08]'
              }`}>
                <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${
                  t.enabled ? 'translate-x-3.5' : 'translate-x-0.5'
                }`} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-secondary-text/50">{t.icon}</span>
                <span className="text-[10px] font-medium text-secondary-text/80">{t.label}</span>
              </div>
              <p className="text-[8px] text-secondary-text/40 mt-0.5">{t.desc}</p>
            </div>
          </label>
        ))}
      </div>

      <div className="px-4 py-2.5 border-t border-white/[0.06]">
        <button
          onClick={clearAllData}
          className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-red-400/60 hover:text-red-400 transition-colors"
        >
          <Trash2 size={10} /> Clear all AI data
        </button>
      </div>
    </motion.div>
  );
});

export default memo(PrivacyControls);
