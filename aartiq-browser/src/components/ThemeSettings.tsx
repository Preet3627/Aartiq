"use client";

import React from 'react';
import { useAppStore } from '@/store/useAppStore';

interface ThemeSettingsProps {
  theme: 'dark' | 'light' | 'system' | 'vibrant' | 'custom';
  setTheme: (theme: 'dark' | 'light' | 'system' | 'vibrant' | 'custom') => void;
  backgroundImage: string;
  setBackgroundImage: (imageUrl: string) => void;
  showCanvasOverlay?: boolean;
}

const THEMES: {
  id: 'dark' | 'light' | 'system' | 'vibrant' | 'custom';
  label: string;
  emoji: string;
  preview: string; // Tailwind-compatible inline style gradient
  accent: string;
  border: string;
  activeBg: string;
  desc: string;
}[] = [
  {
    id: 'dark',
    label: 'Dark',
    emoji: '🌑',
    preview: 'linear-gradient(135deg, #010103 0%, #050508 100%)',
    accent: 'text-sky-400',
    border: 'border-sky-500/30',
    activeBg: 'bg-sky-500/10',
    desc: 'Deepest space ink',
  },
  {
    id: 'light',
    label: 'Light',
    emoji: '☀️',
    preview: 'linear-gradient(135deg, #FAFAFE 0%, #FFFFFF 100%)',
    accent: 'text-blue-500',
    border: 'border-blue-500/30',
    activeBg: 'bg-blue-500/5',
    desc: 'Crystal azure & slate',
  },
  {
    id: 'vibrant',
    label: 'Vibrant',
    emoji: '🔮',
    preview: 'linear-gradient(135deg, #040209 0%, #0C0816 100%)',
    accent: 'text-violet-400',
    border: 'border-violet-500/40',
    activeBg: 'bg-violet-500/10',
    desc: 'Cosmic violet rift',
  },
  {
    id: 'custom',
    label: 'Custom',
    emoji: '🎨',
    preview: 'linear-gradient(135deg, var(--custom-primary, #8B5CF6) 0%, var(--custom-secondary, #06B6D4) 100%)',
    accent: 'text-purple-400',
    border: 'border-purple-400/40',
    activeBg: 'bg-purple-500/10',
    desc: 'Hybrid neural tint',
  },
  {
    id: 'system',
    label: 'System',
    emoji: '🖥️',
    preview: 'linear-gradient(135deg, #020204 0%, #F8FAFC 100%)',
    accent: 'text-slate-400',
    border: 'border-slate-400/30',
    activeBg: 'bg-slate-500/10',
    desc: 'Follows OS mode',
  },
];

const ThemeSettings: React.FC<ThemeSettingsProps> = ({
  theme,
  setTheme,
  backgroundImage,
  setBackgroundImage,
  showCanvasOverlay = true,
}) => {
  const customThemePrimary = useAppStore((state) => state.customThemePrimary);
  const customThemeSecondary = useAppStore((state) => state.customThemeSecondary);
  const setCustomThemePrimary = useAppStore((state) => state.setCustomThemePrimary);
  const setCustomThemeSecondary = useAppStore((state) => state.setCustomThemeSecondary);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <label className="block text-[10px] uppercase font-bold tracking-widest text-secondary-text">
          Appearance
        </label>

        {/* Theme cards grid */}
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => {
            const isActive = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                  className={`relative group flex flex-col gap-2 p-3 rounded-2xl border transition-all duration-200 text-left overflow-hidden
                  ${isActive
                    ? `${t.activeBg} ${t.border} shadow-lg`
                    : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20'
                  }`}
              >
                {/* Mini preview tile */}
                <div
                  className="w-full h-8 rounded-lg shadow-inner"
                  style={{ background: t.preview }}
                >
                  {/* Fake UI dots on preview */}
                  <div className="flex gap-1 p-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                    <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                    <div className="w-4 h-1.5 rounded bg-white/10" />
                  </div>
                </div>

                {/* Label row */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-[0.15em] ${isActive ? t.accent : 'text-white/50'}`}>
                      {t.emoji} {t.label}
                    </p>
                    <p className="text-[8px] text-secondary-text font-medium mt-0.5 opacity-80">{t.desc}</p>
                  </div>
                  {isActive && (
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${t.activeBg} ${t.border} border`}>
                      <svg className={`w-2.5 h-2.5 ${t.accent}`} fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active theme badge */}
        <p className="text-[9px] text-secondary-text italic text-center opacity-80">
          Active: <span className="text-primary-text font-bold uppercase">{theme}</span>
        </p>
      </div>

      {theme === 'custom' && (
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-widest text-secondary-text mb-2">
              Primary Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={customThemePrimary}
                onChange={(e) => setCustomThemePrimary(e.target.value)}
                className="h-11 w-14 rounded-xl border border-white/15 bg-transparent p-1 cursor-pointer"
              />
              <input
                type="text"
                value={customThemePrimary}
                onChange={(e) => setCustomThemePrimary(e.target.value)}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-primary-text outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold tracking-widest text-secondary-text mb-2">
              Secondary Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={customThemeSecondary}
                onChange={(e) => setCustomThemeSecondary(e.target.value)}
                className="h-11 w-14 rounded-xl border border-white/15 bg-transparent p-1 cursor-pointer"
              />
              <input
                type="text"
                value={customThemeSecondary}
                onChange={(e) => setCustomThemeSecondary(e.target.value)}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-primary-text outline-none"
              />
            </div>
          </div>
          <div
            className="h-20 rounded-2xl border border-white/10 shadow-inner"
            style={{ background: `linear-gradient(135deg, ${customThemePrimary} 0%, ${customThemeSecondary} 100%)` }}
          />
        </div>
      )}

      {showCanvasOverlay && (
        <div className="space-y-2">
          <label className="block text-[10px] uppercase font-bold tracking-widest text-secondary-text">
            Canvas Overlay
          </label>
          <input
            type="text"
            placeholder="Image URL..."
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-primary-text placeholder:text-secondary-text outline-none transition-all focus:border-[var(--accent)]"
            value={backgroundImage}
            onChange={(e) => setBackgroundImage(e.target.value)}
          />
        </div>
      )}

      {/* Advanced Customization (Opacity/Blur) */}
      <div className="space-y-4 pt-4 border-t border-white/10">
        <label className="block text-[10px] uppercase font-bold tracking-widest text-secondary-text">
          Advanced Appearance
        </label>
        
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/50">Interface Opacity</label>
              <span className="text-[10px] font-black text-accent">{useAppStore.getState().themeOpacity}%</span>
            </div>
            <input 
              type="range" 
              min="20" 
              max="100" 
              step="1"
              value={useAppStore.getState().themeOpacity}
              onChange={(e) => useAppStore.getState().setThemeOpacity(parseInt(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/50">Backdrop Blur</label>
              <span className="text-[10px] font-black text-accent">{useAppStore.getState().themeBlur}px</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="60" 
              step="1"
              value={useAppStore.getState().themeBlur}
              onChange={(e) => useAppStore.getState().setThemeBlur(parseInt(e.target.value))}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeSettings;
