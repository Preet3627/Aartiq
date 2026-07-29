"use client";

import React, { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const cardTransition = { duration: 0.2, ease: [0.32, 0.72, 0, 1] as const };

interface AIHomeCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  isWorking?: boolean;
  defaultExpanded?: boolean;
  collapsible?: boolean;
  headerActions?: React.ReactNode;
  className?: string;
}

export const AIHomeCard = memo(function AIHomeCard({
  title,
  subtitle,
  children,
  isWorking = false,
  defaultExpanded = true,
  collapsible = false,
  headerActions,
  className = '',
}: AIHomeCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={cardTransition}
      className={`group relative rounded-2xl border border-[color-mix(in_srgb,var(--border-color)_28%,transparent)] bg-[color-mix(in_srgb,var(--card-bg)_72%,transparent)] backdrop-blur-xl overflow-hidden transition-shadow duration-200 hover:shadow-[var(--ai-glow-subtle,0_8px_32px_rgba(56,189,248,0.08))] hover:border-[color-mix(in_srgb,var(--ai-glow-color,#38bdf8)_22%,transparent)] ${className}`}
    >
      {isWorking && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-[color-mix(in_srgb,var(--ai-glow-color,#38bdf8)_35%,transparent)]"
          animate={{ opacity: [0.35, 0.75, 0.35] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <div
        className={`flex items-start gap-2 px-4 pt-3.5 pb-2 ${collapsible ? 'cursor-pointer select-none' : ''}`}
        onClick={collapsible ? () => setExpanded((v) => !v) : undefined}
      >
        <div className="flex-1 min-w-0">
          <h3 className="text-[12px] font-semibold tracking-tight text-primary-text">{title}</h3>
          {subtitle && (
            <p className="text-[10px] text-secondary-text/55 mt-0.5 leading-snug truncate">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {headerActions}
          {collapsible && (
            <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.15 }}>
              <ChevronDown size={14} className="text-secondary-text/40" />
            </motion.span>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {(!collapsible || expanded) && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={cardTransition}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
});

export function HomeSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-3 rounded-md bg-white/[0.06]" style={{ width: `${70 - i * 12}%` }} />
      ))}
    </div>
  );
}
