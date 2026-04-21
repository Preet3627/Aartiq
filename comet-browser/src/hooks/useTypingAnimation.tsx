"use client";

import { useMemo } from 'react';

export interface TypingAnimationOptions {
  enabled?: boolean;
  speed?: 'fast' | 'normal' | 'slow';
  showCursor?: boolean;
  cursorStyle?: 'block' | 'line' | 'blink';
  chunkSize?: number;
  minDelay?: number;
  maxDelay?: number;
}

interface UseTypingAnimationResult {
  displayedContent: string;
  isAnimating: boolean;
  progress: number;
  showCursor: boolean;
}

const DEFAULT_OPTIONS: Required<TypingAnimationOptions> = {
  enabled: true,
  speed: 'normal',
  showCursor: true,
  cursorStyle: 'blink',
  chunkSize: 3,
  minDelay: 8,
  maxDelay: 25,
};

export function useTypingAnimation(
  content: string,
  isStreaming: boolean,
  options: TypingAnimationOptions = {}
): UseTypingAnimationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const displayedContent = opts.enabled ? content : content;
  const isAnimating = opts.enabled && isStreaming;
  const progress = content.length > 0 ? 100 : 0;
  const showCursor = Boolean(opts.showCursor && isStreaming);

  return { displayedContent, isAnimating, progress, showCursor };
}

export function TypingCursor({ 
  style = 'blink',
  color = '#38bdf8',
  glowColor = 'rgba(56, 189, 248, 0.45)'
}: { 
  style?: 'block' | 'line' | 'blink';
  color?: string;
  glowColor?: string;
}) {
  if (style === 'block') {
    return (
      <span
        aria-hidden="true"
        className="inline-block w-2.5 h-5 rounded-sm animate-pulse"
        style={{ backgroundColor: color, boxShadow: `0 0 12px ${glowColor}` }}
      />
    );
  }

  if (style === 'line') {
    return (
      <span
        aria-hidden="true"
        className="inline-block w-0.5 h-5 rounded-full animate-pulse"
        style={{ backgroundColor: color, boxShadow: `0 0 10px ${glowColor}` }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="inline-block w-2 h-5 animate-pulse"
    >
      <span
        className="inline-block w-0.5 h-full rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 8px ${glowColor}` }}
      />
    </span>
  );
}

export interface StreamingTextProps {
  content: string;
  isStreaming: boolean;
  options?: TypingAnimationOptions;
  className?: string;
  cursorColor?: string;
  cursorGlowColor?: string;
}

export function StreamingText({
  content,
  isStreaming,
  options = {},
  className = '',
  cursorColor,
  cursorGlowColor,
}: StreamingTextProps) {
  const { displayedContent, showCursor } = useTypingAnimation(content, isStreaming, options);

  return (
    <span className={className}>
      {displayedContent}
      {showCursor && (
        <span className="inline-block ml-0.5">
          <TypingCursor
            style={options.cursorStyle || 'blink'}
            color={cursorColor}
            glowColor={cursorGlowColor}
          />
        </span>
      )}
    </span>
  );
}

export interface WordByWordAnimationOptions extends TypingAnimationOptions {
  wordsPerChunk?: number;
  staggerDelay?: number;
}

export function useWordByWordAnimation(
  content: string,
  isStreaming: boolean,
  options: WordByWordAnimationOptions = {}
): { words: string[]; currentIndex: number; showCursor: boolean } {
  const words = useMemo(() => {
    if (!content) return [];
    return content.split(/(\s+)/).filter(Boolean);
  }, [content]);
  const currentIndex = words.length;
  const showCursor = Boolean(options.showCursor && isStreaming);
  return { words, currentIndex, showCursor };
}

export function WordByWordText({
  content,
  isStreaming,
  options = {},
  className = '',
}: StreamingTextProps & { options?: WordByWordAnimationOptions }) {
  const { words, currentIndex, showCursor } = useWordByWordAnimation(content, isStreaming, options);

  return (
    <span className={className}>
      {words.slice(0, currentIndex).map((word, i) => (
        <span key={`${i}-${word}`}>
          {word}
        </span>
      ))}
      {showCursor && (
        <span className="inline-block ml-0.5">
          <TypingCursor style={options.cursorStyle || 'line'} />
        </span>
      )}
    </span>
  );
}

export default useTypingAnimation;
