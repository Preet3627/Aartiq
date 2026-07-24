import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTabIntelligenceStore, type SessionPhase } from '@/store/tabIntelligenceStore';

const phaseConfig: Record<SessionPhase, { label: string; icon: string; color: string }> = {
  idle: { label: 'Idle', icon: '○', color: '#64748b' },
  planning: { label: 'Planning', icon: '◇', color: '#f59e0b' },
  reading: { label: 'Reading tabs', icon: '◎', color: '#3b82f6' },
  analyzing: { label: 'Analyzing', icon: '◈', color: '#8b5cf6' },
  generating: { label: 'Generating answer', icon: '◆', color: '#10b981' },
  complete: { label: 'Complete', icon: '●', color: '#22c55e' },
  error: { label: 'Error', icon: '▲', color: '#ef4444' },
};

interface AISessionVisualizationProps {
  compact?: boolean;
  className?: string;
}

export function AISessionVisualization({ compact = false, className = '' }: AISessionVisualizationProps) {
  const sessionPhase = useTabIntelligenceStore((s) => s.sessionPhase);
  const sessionLabel = useTabIntelligenceStore((s) => s.sessionLabel);
  const activeTabIds = useTabIntelligenceStore((s) => s.activeTabIds);
  const theme = useTabIntelligenceStore((s) => s.theme);

  if (sessionPhase === 'idle' && compact) return null;

  const current = phaseConfig[sessionPhase];

  if (compact) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={sessionPhase}
          className={`flex items-center gap-2 text-xs ${className}`}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.2 }}
        >
          <motion.span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: current.color }}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span style={{ color: current.color }}>{sessionLabel || current.label}</span>
          {activeTabIds.size > 0 && (
            <span className="text-[10px] opacity-60">
              ({activeTabIds.size} tab{activeTabIds.size !== 1 ? 's' : ''})
            </span>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  const phases: SessionPhase[] = ['idle', 'planning', 'reading', 'analyzing', 'generating', 'complete'];
  const currentIdx = phases.indexOf(sessionPhase);

  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-1">
        {phases.map((phase, idx) => {
          const config = phaseConfig[phase];
          const isCurrent = phase === sessionPhase;
          const isPast = idx < currentIdx;
          const isFuture = idx > currentIdx;

          return (
            <React.Fragment key={phase}>
              {idx > 0 && (
                <motion.div
                  className="h-px flex-1 mx-0.5"
                  style={{
                    backgroundColor: isPast ? config.color : 'rgba(255,255,255,0.1)',
                  }}
                  animate={isCurrent ? { backgroundColor: [theme.glowColor, 'rgba(255,255,255,0.1)'] } : undefined}
                  transition={isCurrent ? { duration: 1, repeat: Infinity } : undefined}
                />
              )}
              <motion.div
                className="relative flex items-center justify-center"
                animate={
                  isCurrent
                    ? { scale: [1, 1.15, 1] }
                    : isPast
                    ? { scale: 0.9 }
                    : { scale: 0.8 }
                }
                transition={isCurrent ? { duration: 1.5, repeat: Infinity } : { duration: 0.3 }}
              >
                <motion.div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{
                    backgroundColor: isPast
                      ? config.color + '33'
                      : isCurrent
                      ? config.color + '44'
                      : 'rgba(255,255,255,0.05)',
                    border: `1.5px solid ${
                      isCurrent ? theme.glowColor : isPast ? config.color : 'rgba(255,255,255,0.1)'
                    }`,
                    color: isPast || isCurrent ? config.color : 'rgba(255,255,255,0.3)',
                  }}
                >
                  {config.icon}
                </motion.div>
                {!compact && (
                  <motion.span
                    className="absolute -bottom-4 text-[9px] whitespace-nowrap"
                    style={{
                      color: isCurrent ? config.color : isPast ? config.color + '88' : 'rgba(255,255,255,0.2)',
                    }}
                    animate={isCurrent ? { opacity: [0.6, 1, 0.6] } : undefined}
                    transition={isCurrent ? { duration: 2, repeat: Infinity } : undefined}
                  >
                    {config.label}
                  </motion.span>
                )}
              </motion.div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
