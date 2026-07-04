import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type AnimationType = 'thinking' | 'streaming' | 'reasoning' | 'pulse' | 'orb' | 'dots' | 'wave';

export interface AIThinkingAnimationProps {
  type?: AnimationType;
  theme?: 'graphite' | 'crystal' | 'obsidian' | 'azure' | 'rose' | 'aurora' | 'nebula' | 'liquidGlass' | 'translucent' | 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  texts?: string[];
  className?: string;
}

const themeColors = {
  graphite: { primary: '#6366f1', secondary: '#818cf8', glow: '#6366f1' },
  crystal: { primary: '#06b6d4', secondary: '#22d3ee', glow: '#06b6d4' },
  obsidian: { primary: '#a855f7', secondary: '#c084fc', glow: '#a855f7' },
  azure: { primary: '#3b82f6', secondary: '#60a5fa', glow: '#3b82f6' },
  rose: { primary: '#ec4899', secondary: '#f472b6', glow: '#ec4899' },
  aurora: { primary: '#10b981', secondary: '#34d399', glow: '#10b981' },
  nebula: { primary: '#8b5cf6', secondary: '#a78bfa', glow: '#8b5cf6' },
  liquidGlass: { primary: '#6366f1', secondary: '#818cf8', glow: '#818cf8' },
  translucent: { primary: '#64748b', secondary: '#94a3b8', glow: '#64748b' },
  dark: { primary: '#6366f1', secondary: '#818cf8', glow: '#6366f1' },
  light: { primary: '#4f46e5', secondary: '#7c3aed', glow: '#4f46e5' },
};

const defaultTexts = ['Thinking...', 'Analyzing...', 'Processing...', 'Computing...', 'Almost done...'];

export function AIThinkingAnimation({
  type = 'thinking',
  theme = 'dark',
  size = 'md',
  showText = true,
  texts = defaultTexts,
  className = '',
}: AIThinkingAnimationProps) {
  const colors = themeColors[theme];
  const [textIndex, setTextIndex] = useState(0);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % texts.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [texts.length]);

  useEffect(() => {
    const handleVisibility = () => {
      setIsActive(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const sizes = {
    sm: { container: 24, dot: 4, spacing: 4 },
    md: { container: 40, dot: 8, spacing: 6 },
    lg: { container: 60, dot: 12, spacing: 8 },
  };

  const s = sizes[size];

  const renderAnimation = () => {
    switch (type) {
      case 'dots':
        return <DotsAnimation colors={colors} size={s} />;
      case 'wave':
        return <WaveAnimation colors={colors} size={s} />;
      case 'orb':
        return <OrbAnimation colors={colors} size={s} />;
      case 'pulse':
        return <PulseAnimation colors={colors} size={s} />;
      case 'reasoning':
        return <ReasoningAnimation colors={colors} size={s} />;
      case 'streaming':
        return <StreamingAnimation colors={colors} size={s} />;
      case 'thinking':
      default:
        return <ThinkingAnimation colors={colors} size={s} />;
    }
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative" style={{ width: s.container, height: s.container }}>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {renderAnimation()}
          </motion.div>
        )}
      </div>
      {showText && (
        <AnimatePresence mode="wait">
          <motion.span
            key={textIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="text-sm"
            style={{ color: colors.primary }}
          >
            {texts[textIndex]}
          </motion.span>
        </AnimatePresence>
      )}
    </div>
  );
}

function ThinkingAnimation({ colors, size }: { colors: { primary: string; secondary: string; glow: string }; size: { container: number } }) {
  return (
    <svg width={size.container} height={size.container} viewBox="0 0 40 40" className="animate-spin-slow">
      <defs>
        <linearGradient id="thinkingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.primary} />
          <stop offset="100%" stopColor={colors.secondary} />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle
        cx="20"
        cy="20"
        r="15"
        fill="none"
        stroke={`url(#thinkingGrad)`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="30 70"
        filter="url(#glow)"
      />
      <circle
        cx="20"
        cy="20"
        r="8"
        fill={colors.primary}
        opacity="0.8"
      >
        <animate attributeName="opacity" values="0.8;0.4;0.8" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function DotsAnimation({ colors, size }: { colors: { primary: string; secondary: string; glow: string }; size: { dot: number; spacing: number } }) {
  return (
    <div className="flex items-center justify-center gap-[4px]">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, -8, 0],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
          style={{
            width: size.dot,
            height: size.dot,
            borderRadius: '50%',
            backgroundColor: colors.primary,
            boxShadow: `0 0 ${size.dot}px ${colors.glow}`,
          }}
        />
      ))}
    </div>
  );
}

function WaveAnimation({ colors, size }: { colors: { primary: string; secondary: string; glow: string }; size: { dot: number; spacing: number } }) {
  return (
    <div className="flex items-center gap-[3px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          animate={{
            scaleY: [0.3, 1, 0.3],
            opacity: [0.3, 1, 0.3],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
          style={{
            width: size.dot - 2,
            height: size.dot * 2,
            borderRadius: 2,
            backgroundColor: i < 2 ? colors.primary : colors.secondary,
            boxShadow: `0 0 ${size.dot}px ${colors.glow}`,
          }}
        />
      ))}
    </div>
  );
}

function OrbAnimation({ colors, size }: { colors: { primary: string; secondary: string; glow: string }; size: { container: number } }) {
  return (
    <motion.div
      animate={{
        scale: [1, 1.2, 1],
        boxShadow: [
          `0 0 ${size.container / 3}px ${colors.primary}`,
          `0 0 ${size.container / 2}px ${colors.secondary}`,
          `0 0 ${size.container / 3}px ${colors.primary}`,
        ],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      style={{
        width: size.container / 2,
        height: size.container / 2,
        borderRadius: '50%',
        background: `radial-gradient(circle at 30% 30%, ${colors.secondary}, ${colors.primary})`,
      }}
    />
  );
}

function PulseAnimation({ colors, size }: { colors: { primary: string; secondary: string; glow: string }; size: { container: number } }) {
  return (
    <div className="relative flex items-center justify-center">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [1, 0, 1],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: i * 0.3,
            ease: 'easeOut',
          }}
          style={{
            position: 'absolute',
            width: size.container / 3,
            height: size.container / 3,
            borderRadius: '50%',
            backgroundColor: colors.primary,
          }}
        />
      ))}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        style={{
          width: size.container / 2.5,
          height: size.container / 2.5,
          borderRadius: '50%',
          border: `2px solid ${colors.primary}`,
          borderTopColor: 'transparent',
        }}
      />
    </div>
  );
}

function ReasoningAnimation({ colors, size }: { colors: { primary: string; secondary: string; glow: string }; size: { container: number } }) {
  const steps = ['①', '②', '③'];
  return (
    <div className="flex flex-col gap-1">
      {steps.map((step, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: [0.5, 1, 0.5], x: 0 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.4,
          }}
          style={{
            fontSize: size.container / 4,
            color: i === 0 ? colors.primary : i === 1 ? colors.secondary : colors.primary,
          }}
        >
          {step}
        </motion.div>
      ))}
    </div>
  );
}

function StreamingAnimation({ colors, size }: { colors: { primary: string; secondary: string; glow: string }; size: { dot: number } }) {
  return (
    <div className="flex items-center gap-[2px]">
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          animate={{
            height: [size.dot, size.dot * 2.5, size.dot],
            opacity: [0.3, 1, 0.3],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.1,
          }}
          style={{
            width: size.dot - 4,
            borderRadius: 2,
            backgroundColor: colors.primary,
            boxShadow: `0 0 ${size.dot}px ${colors.glow}`,
          }}
        />
      ))}
    </div>
  );
}

export function TypingIndicator({ theme = 'dark', size = 'md', className = '' }: { theme?: keyof typeof themeColors; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const colors = themeColors[theme];
  const sizes = { sm: 6, md: 8, lg: 10 };
  const s = sizes[size];

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -4, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
          }}
          style={{
            width: s,
            height: s,
            borderRadius: '50%',
            backgroundColor: colors.primary,
          }}
        />
      ))}
    </div>
  );
}

export function StreamCursor({
  theme = 'dark',
  className = '',
}: { theme?: keyof typeof themeColors; className?: string }) {
  const colors = themeColors[theme];

  return (
    <motion.span
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.8, repeat: Infinity }}
      className={className}
      style={{
        display: 'inline-block',
        width: 2,
        height: '1em',
        backgroundColor: colors.primary,
        marginLeft: 2,
        verticalAlign: 'text-bottom',
      }}
    />
  );
}

export function ProgressDots({
  count = 5,
  activeIndex = 0,
  theme = 'dark',
  className = '',
}: { count?: number; activeIndex?: number; theme?: keyof typeof themeColors; className?: string }) {
  const colors = themeColors[theme];

  return (
    <div className={`flex gap-1.5 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            scale: i === activeIndex ? 1.2 : 1,
            opacity: i <= activeIndex ? 1 : 0.3,
          }}
          transition={{ duration: 0.2 }}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: i <= activeIndex ? colors.primary : colors.secondary,
          }}
        />
      ))}
    </div>
  );
}

export function GlowRing({
  active = true,
  theme = 'dark',
  size = 'md',
  className = '',
}: { active?: boolean; theme?: keyof typeof themeColors; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const colors = themeColors[theme];
  const sizes = { sm: 24, md: 40, lg: 60 };

  return (
    <motion.div
      animate={{
        rotate: active ? 360 : 0,
        scale: active ? [1, 1.1, 1] : 1,
      }}
      transition={{
        rotate: { duration: 3, repeat: Infinity, ease: 'linear' },
        scale: { duration: 1.5, repeat: Infinity },
      }}
      className={className}
      style={{
        width: sizes[size],
        height: sizes[size],
        borderRadius: '50%',
        border: `2px solid ${colors.primary}`,
        borderTopColor: 'transparent',
        boxShadow: active ? `0 0 ${sizes[size] / 3}px ${colors.glow}` : 'none',
      }}
    />
  );
}

export function ShimmerText({
  text,
  theme = 'dark',
  className = '',
}: { text: string; theme?: keyof typeof themeColors; className?: string }) {
  const colors = themeColors[theme];

  return (
    <motion.span
      animate={{ backgroundPosition: ['200% center', '-200% center'] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      className={className}
      style={{
        background: `linear-gradient(90deg, ${colors.primary}, ${colors.secondary}, ${colors.primary})`,
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
    >
      {text}
    </motion.span>
  );
}

export function StepIndicator({
  currentStep,
  totalSteps,
  labels,
  theme = 'dark',
  className = '',
}: { currentStep: number; totalSteps: number; labels?: string[]; theme?: keyof typeof themeColors; className?: string }) {
  const colors = themeColors[theme];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <React.Fragment key={i}>
          <motion.div
            animate={{
              scale: i === currentStep ? 1.1 : 1,
              backgroundColor: i <= currentStep ? colors.primary : 'transparent',
              borderColor: i <= currentStep ? colors.primary : colors.secondary,
            }}
            transition={{ duration: 0.2 }}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: `2px solid`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 'bold',
              color: i <= currentStep ? '#fff' : colors.secondary,
            }}
          >
            {i < currentStep ? '✓' : i + 1}
          </motion.div>
          {i < totalSteps - 1 && (
            <motion.div
              animate={{ backgroundColor: i < currentStep ? colors.primary : colors.secondary }}
              style={{ width: 20, height: 2, borderRadius: 1 }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default AIThinkingAnimation;