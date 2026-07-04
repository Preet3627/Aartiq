"use client";

import React from 'react';
import type { AnimationType } from './ai/AIThinkingAnimation';

export type ThemePreset = 'graphite' | 'crystal' | 'obsidian' | 'azure' | 'rose' | 'aurora' | 'nebula' | 'liquidGlass' | 'translucent' | 'dark' | 'light';

interface ThinkingIndicatorProps {
  theme?: ThemePreset;
  animationType?: AnimationType;
  showText?: boolean;
  texts?: string[];
  size?: 'sm' | 'md' | 'lg';
  variant?: 'compact' | 'full' | 'minimal';
}

const themeGradients: Record<ThemePreset, { bg: string; border: string; shadow: string; primary: string; secondary: string }> = {
  graphite: {
    bg: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.85), rgba(99,102,241,0.25))',
    border: 'border-indigo-500/30',
    shadow: 'shadow-[0_22px_60px_rgba(99,102,241,0.25)]',
    primary: '#6366f1',
    secondary: '#818cf8'
  },
  crystal: {
    bg: 'linear-gradient(135deg, rgba(8,47,73,0.92), rgba(6,182,212,0.25))',
    border: 'border-cyan-500/30',
    shadow: 'shadow-[0_22px_60px_rgba(6,182,212,0.25)]',
    primary: '#06b6d4',
    secondary: '#22d3ee'
  },
  obsidian: {
    bg: 'linear-gradient(135deg, rgba(15,15,25,0.95), rgba(88,28,135,0.35))',
    border: 'border-purple-500/30',
    shadow: 'shadow-[0_22px_60px_rgba(168,85,247,0.3)]',
    primary: '#a855f7',
    secondary: '#c084fc'
  },
  azure: {
    bg: 'linear-gradient(135deg, rgba(15,23,42,0.92), rgba(59,130,246,0.25))',
    border: 'border-blue-500/30',
    shadow: 'shadow-[0_22px_60px_rgba(59,130,246,0.25)]',
    primary: '#3b82f6',
    secondary: '#60a5fa'
  },
  rose: {
    bg: 'linear-gradient(135deg, rgba(30,10,20,0.95), rgba(236,72,153,0.25))',
    border: 'border-pink-500/30',
    shadow: 'shadow-[0_22px_60px_rgba(236,72,153,0.25)]',
    primary: '#ec4899',
    secondary: '#f472b6'
  },
  aurora: {
    bg: 'linear-gradient(135deg, rgba(10,30,25,0.95), rgba(16,185,129,0.25))',
    border: 'border-emerald-500/30',
    shadow: 'shadow-[0_22px_60px_rgba(16,185,129,0.25)]',
    primary: '#10b981',
    secondary: '#34d399'
  },
  nebula: {
    bg: 'linear-gradient(135deg, rgba(20,15,35,0.95), rgba(139,92,246,0.3))',
    border: 'border-violet-500/30',
    shadow: 'shadow-[0_22px_60px_rgba(139,92,246,0.3)]',
    primary: '#8b5cf6',
    secondary: '#a78bfa'
  },
  liquidGlass: {
    bg: 'linear-gradient(135deg, rgba(30,30,60,0.85), rgba(99,102,241,0.2), rgba(6,182,212,0.15))',
    border: 'border-indigo-400/30',
    shadow: 'shadow-[0_22px_60px_rgba(99,102,241,0.3)]',
    primary: '#6366f1',
    secondary: '#818cf8'
  },
  translucent: {
    bg: 'linear-gradient(135deg, rgba(100,116,139,0.15), rgba(148,163,184,0.1))',
    border: 'border-slate-400/20',
    shadow: 'shadow-[0_22px_60px_rgba(100,116,139,0.15)]',
    primary: '#64748b',
    secondary: '#94a3b8'
  },
  dark: {
    bg: 'linear-gradient(135deg, rgba(15,23,42,0.82), rgba(8,47,73,0.54), rgba(88,28,135,0.38))',
    border: 'border-white/10',
    shadow: 'shadow-[0_22px_60px_rgba(14,165,233,0.18)]',
    primary: '#38bdf8',
    secondary: '#a855f7'
  },
  light: {
    bg: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(79,70,229,0.1))',
    border: 'border-indigo-500/20',
    shadow: 'shadow-[0_22px_60px_rgba(79,70,229,0.15)]',
    primary: '#4f46e5',
    secondary: '#7c3aed'
  }
};

const variantStyles = {
  compact: 'py-2 px-4 rounded-xl gap-2',
  full: 'py-4 px-6 rounded-[2rem] gap-4',
  minimal: 'py-2 px-3 rounded-lg gap-2'
};

const textStyles = {
  compact: { label: 'text-[9px]', sublabel: 'text-[7px]' },
  full: { label: 'text-[10px]', sublabel: 'text-[8px]' },
  minimal: { label: 'text-[8px]', sublabel: 'text-[6px]' }
};

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  theme = 'dark',
  animationType = 'thinking',
  showText = true,
  texts,
  size = 'md',
  variant = 'full'
}) => {
  const colors = themeGradients[theme];
  const textStylesVariant = textStyles[variant];
  const isMinimal = variant === 'minimal';
  const dotSizeClass = size === 'lg' ? 'w-3 h-3' : size === 'sm' ? 'w-1.5 h-1.5' : 'w-2.5 h-2.5';
  const sublabel = animationType === 'reasoning'
    ? 'Processing reasoning chains...'
    : animationType === 'streaming'
      ? 'Streaming response...'
      : 'Streaming thoughts through the live workspace';

  const dots = (
    <div className="flex items-center gap-1.5">
      {[1, 0.7, 0.45].map((opacity, index) => (
        <span
          key={index}
          className={`${dotSizeClass} rounded-full animate-pulse`}
          style={{
            backgroundColor: colors.primary,
            opacity,
            animationDelay: `${index * 120}ms`,
            boxShadow: `0 0 10px ${colors.primary}55`,
          }}
        />
      ))}
    </div>
  );

  if (isMinimal) {
    return (
      <div className="flex items-center gap-2">
        {dots}
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center ${variantStyles[variant]} self-start group backdrop-blur-2xl overflow-hidden border ${colors.border} ${colors.shadow}`}
      style={{ background: colors.bg }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-40" />
      {dots}

      {showText && (
        <div className="relative z-10 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span 
              className={`${textStylesVariant.label} font-black uppercase tracking-[0.32em]`}
              style={{ color: colors.primary }}
            >
              Neural Flow
            </span>
            <div className="flex gap-1">{dots}</div>
          </div>
          <p 
            className={`${textStylesVariant.sublabel} font-bold uppercase tracking-[0.24em] opacity-45 whitespace-nowrap`}
            style={{ color: colors.secondary }}
          >
            {sublabel}
          </p>
        </div>
      )}
    </div>
  );
};

export default ThinkingIndicator;
