"use client";

import React, { memo, useCallback } from 'react';
import { getAIVisualSettings, saveAIVisualSettings, type AIVisualSettings, type GlowMode } from './types';

const colorOptions = [
  { label: 'Sky', value: '#38bdf8' },
  { label: 'Green', value: '#34d399' },
  { label: 'Purple', value: '#a78bfa' },
  { label: 'Rose', value: '#fb7185' },
  { label: 'Amber', value: '#fbbf24' },
  { label: 'Cyan', value: '#22d3ee' },
];

export function getCSSForAIVisual(settings: AIVisualSettings): Record<string, string> {
  if (!settings.enabled) return {};
  const c = settings.color;
  const i = settings.intensity;
  return {
    '--ai-glow-color': c,
    '--ai-glow-intensity': String(i),
    '--ai-glow-speed': String(settings.animationSpeed),
    '--ai-glow-subtle': `0 0 ${8 * i}px ${c}${Math.round(15 * i).toString(16).padStart(2, '0')}`,
    '--ai-glow-dynamic': `0 0 ${15 * i}px ${c}${Math.round(25 * i).toString(16).padStart(2, '0')}`,
  };
}

export function getTabAnimationStyle(glowMode: GlowMode, settings: AIVisualSettings): Record<string, string> {
  if (glowMode === 'off' || !settings.enabled) return {};
  const c = settings.color;
  const i = settings.intensity;
  return {
    '--tab-glow-color': c,
    '--tab-glow-intensity': String(i),
  };
}

interface ThemeControlProps {
  current: AIVisualSettings;
  onUpdate: (s: AIVisualSettings) => void;
}

const AIVisualThemeControl = memo(function AIVisualThemeControl({ current, onUpdate }: ThemeControlProps) {
  const update = useCallback((partial: Partial<AIVisualSettings>) => {
    const updated = { ...current, ...partial };
    saveAIVisualSettings(partial);
    onUpdate(updated);
  }, [current, onUpdate]);

  return (
    <div className="space-y-3">
      {/* Enable toggle */}
      <label className="flex items-center justify-between py-1 cursor-pointer">
        <span className="text-[10px] font-medium text-secondary-text/80">AI Visual Effects</span>
        <div className="relative">
          <input
            type="checkbox"
            checked={current.enabled}
            onChange={() => update({ enabled: !current.enabled })}
            className="sr-only"
          />
          <div className={`w-7 h-4 rounded-full transition-colors ${current.enabled ? 'bg-sky-500/40' : 'bg-white/[0.08]'}`}>
            <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${current.enabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
          </div>
        </div>
      </label>

      {/* Glow mode */}
      <div>
        <label className="text-[9px] font-bold uppercase tracking-wider text-secondary-text/50 mb-1 block">Glow Mode</label>
        <div className="flex gap-1">
          {(['off', 'subtle', 'dynamic'] as GlowMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => update({ glowMode: mode })}
              className={`flex-1 text-[9px] font-medium px-2 py-1.5 rounded-lg border transition-all capitalize ${
                current.glowMode === mode
                  ? 'bg-sky-500/15 border-sky-500/30 text-sky-400'
                  : 'bg-white/[0.04] border-white/[0.06] text-secondary-text/50 hover:text-secondary-text'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div>
        <label className="text-[9px] font-bold uppercase tracking-wider text-secondary-text/50 mb-1 block">Color</label>
        <div className="flex gap-1.5">
          {colorOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update({ color: opt.value })}
              className={`w-6 h-6 rounded-full border-2 transition-all ${
                current.color === opt.value
                  ? 'border-white scale-110 shadow-lg'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
              style={{ backgroundColor: opt.value }}
              title={opt.label}
            />
          ))}
        </div>
      </div>

      {/* Intensity */}
      <div>
        <label className="text-[9px] font-bold uppercase tracking-wider text-secondary-text/50 mb-1 block">
          Intensity: {Math.round(current.intensity * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={current.intensity}
          onChange={(e) => update({ intensity: parseFloat(e.target.value) })}
          className="w-full h-1 appearance-none rounded-full bg-white/[0.08] outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-400 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer"
        />
      </div>

      {/* Speed */}
      <div>
        <label className="text-[9px] font-bold uppercase tracking-wider text-secondary-text/50 mb-1 block">
          Speed: {current.animationSpeed}x
        </label>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.25"
          value={current.animationSpeed}
          onChange={(e) => update({ animationSpeed: parseFloat(e.target.value) })}
          className="w-full h-1 appearance-none rounded-full bg-white/[0.08] outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-400 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer"
        />
      </div>
    </div>
  );
});

export default memo(AIVisualThemeControl);
