import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTabIntelligenceStore } from '@/store/tabIntelligenceStore';

interface TabActivityOverlayProps {
  tabId: string;
  className?: string;
}

const stateConfig = {
  idle: { scale: 1, opacity: 0, borderOpacity: 0 },
  reading: { scale: 1.02, opacity: 0.6, borderOpacity: 0.5 },
  analyzing: { scale: 1.02, opacity: 0.8, borderOpacity: 0.8 },
  executing: { scale: 1.03, opacity: 0.9, borderOpacity: 1 },
  completed: { scale: 1.05, opacity: 0.4, borderOpacity: 0.6 },
};

export function TabActivityOverlay({ tabId, className = '' }: TabActivityOverlayProps) {
  const tabActivities = useTabIntelligenceStore((s) => s.tabActivities);
  const theme = useTabIntelligenceStore((s) => s.theme);
  const record = tabActivities.get(tabId);

  if (!record || record.state === 'idle') return null;

  const config = stateConfig[record.state];
  const speed = theme.animationSpeed;
  const duration = `${2 / speed}s`;

  return (
    <AnimatePresence>
      <motion.div
        className={`pointer-events-none absolute inset-0 rounded-lg overflow-hidden ${className}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          className="absolute inset-0"
          animate={{
            boxShadow: [
              `0 0 ${8 * theme.glowIntensity}px ${theme.glowColor}`,
              `0 0 ${16 * theme.glowIntensity}px ${theme.glowColor}`,
              `0 0 ${8 * theme.glowIntensity}px ${theme.glowColor}`,
            ],
            opacity: config.opacity,
          }}
          transition={{
            duration: 1.5 / speed,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            borderRadius: 'inherit',
            background: record.state === 'analyzing'
              ? `linear-gradient(135deg, ${theme.primary}22, ${theme.secondary}22, ${theme.tertiary}22)`
              : undefined,
          }}
        />
        <motion.div
          className="absolute inset-0"
          style={{
            borderRadius: 'inherit',
            border: `2px solid ${theme.glowColor}`,
            opacity: config.borderOpacity,
          }}
          animate={
            record.state === 'analyzing'
              ? {
                  borderColor: [theme.primary, theme.secondary, theme.tertiary, theme.primary],
                }
              : undefined
          }
          transition={
            record.state === 'analyzing'
              ? { duration: 3 / speed, repeat: Infinity, ease: 'linear' }
              : undefined
          }
        />
        {record.state === 'reading' && (
          <motion.div
            className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="block w-1 h-1 rounded-full"
                style={{ backgroundColor: theme.glowColor }}
                animate={{
                  opacity: [0.3, 1, 0.3],
                  scale: [0.8, 1.2, 0.8],
                }}
                transition={{
                  duration: 0.8 / speed,
                  repeat: Infinity,
                  delay: i * 0.2 / speed,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
