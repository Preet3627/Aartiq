"use client";

import React, { memo, useEffect, useRef } from 'react';
import type { AIVisualSettings, GlowMode } from './types';

type AnimationState = 'idle' | 'reading' | 'processing' | 'executing' | 'finished';

interface UseTabAnimationOptions {
  settings: AIVisualSettings;
  tabId?: string;
}

const animationStyles: Record<AnimationState, string> = {
  idle: '',
  reading: 'slow-breathing-glow',
  processing: 'moving-gradient-border',
  executing: 'strong-ai-pulse',
  finished: 'short-completion-flash',
};

export function useTabAura(options: UseTabAnimationOptions) {
  const { settings, tabId } = options;
  const stateRef = useRef<AnimationState>('idle');
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!settings.enabled || settings.glowMode === 'off' || !tabId) return;
    elementRef.current = document.getElementById(tabId) || document.querySelector(`[data-tab-id="${tabId}"]`);
  }, [tabId, settings.enabled, settings.glowMode]);

  const setState = (newState: AnimationState) => {
    if (!settings.enabled || settings.glowMode === 'off') return;
    const el = elementRef.current;
    if (!el) return;

    // Remove all animation classes
    Object.values(animationStyles).forEach(cls => el.classList.remove(cls));

    if (newState === 'finished') {
      el.classList.add(animationStyles.finished);
      setTimeout(() => el.classList.remove(animationStyles.finished), 800 / settings.animationSpeed);
    } else if (newState !== 'idle') {
      el.classList.add(animationStyles[newState]);
    }
    stateRef.current = newState;
  };

  return {
    isReading: stateRef.current === 'reading',
    isProcessing: stateRef.current === 'processing',
    isExecuting: stateRef.current === 'executing',
    setReading: () => setState('reading'),
    setProcessing: () => setState('processing'),
    setExecuting: () => setState('executing'),
    setFinished: () => setState('finished'),
    setIdle: () => setState('idle'),
  };
}

// CSS injection for tab animations
export function injectTabAnimationCSS(settings: AIVisualSettings) {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('ai-tab-animations');
  if (existing) existing.remove();

  if (!settings.enabled || settings.glowMode === 'off') return;

  const c = settings.color;
  const i = settings.intensity;
  const speed = settings.animationSpeed;

  const style = document.createElement('style');
  style.id = 'ai-tab-animations';
  style.textContent = `
    @keyframes slow-breathing-glow {
      0%, 100% { box-shadow: 0 0 ${3 * i}px ${c}33; }
      50% { box-shadow: 0 0 ${10 * i}px ${c}55; }
    }
    .slow-breathing-glow {
      animation: slow-breathing-glow ${2 / speed}s ease-in-out infinite;
    }

    @keyframes moving-gradient-border {
      0% { border-color: ${c}00; }
      50% { border-color: ${c}66; }
      100% { border-color: ${c}00; }
    }
    .moving-gradient-border {
      animation: moving-gradient-border ${1.5 / speed}s ease-in-out infinite;
    }

    @keyframes strong-ai-pulse {
      0%, 100% { box-shadow: 0 0 ${5 * i}px ${c}44; }
      50% { box-shadow: 0 0 ${20 * i}px ${c}88; }
    }
    .strong-ai-pulse {
      animation: strong-ai-pulse ${0.8 / speed}s ease-in-out infinite;
    }

    @keyframes short-completion-flash {
      0% { box-shadow: 0 0 ${15 * i}px ${c}aa; }
      100% { box-shadow: none; }
    }
    .short-completion-flash {
      animation: short-completion-flash ${0.8 / speed}s ease-out forwards;
    }
  `;
  document.head.appendChild(style);
}

export function removeTabAnimationCSS() {
  const existing = document.getElementById('ai-tab-animations');
  if (existing) existing.remove();
}

// Legacy React component wrapper for backward compat
const AITabAnimation = memo(function AITabAnimation({
  state,
  settings,
  children,
}: {
  state: AnimationState;
  settings: AIVisualSettings;
  children: React.ReactNode;
}) {
  if (!settings.enabled || settings.glowMode === 'off' || state === 'idle') {
    return <>{children}</>;
  }
  const cls = animationStyles[state];
  if (!cls) return <>{children}</>;
  return <div className={cls}>{children}</div>;
});

export default memo(AITabAnimation);
