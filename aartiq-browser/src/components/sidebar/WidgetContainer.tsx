"use client";

import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, GripVertical, EyeOff, Settings } from 'lucide-react';
import { type WidgetId } from './types';

interface WidgetContainerProps {
  id: WidgetId;
  label: string;
  icon: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onRemove: () => void;
  children: React.ReactNode;
  dragHandleProps?: Record<string, any>;
  className?: string;
}

const WidgetContainer = memo(function WidgetContainer({
  id,
  label,
  icon,
  isCollapsed,
  onToggleCollapse,
  onRemove,
  children,
  dragHandleProps,
  className = '',
}: WidgetContainerProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, height: 0 }}
      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
      className={`rounded-xl border border-[color-mix(in_srgb,var(--border-color)_35%,transparent)] bg-[color-mix(in_srgb,var(--card-bg)_85%,transparent)] backdrop-blur-xl overflow-hidden ${className}`}
    >
      {/* Header */}
      <div
        className="flex items-center gap-1.5 px-3 py-2 cursor-pointer select-none hover:bg-[color-mix(in_srgb,var(--primary-text)_3%,transparent)] transition-colors group"
        onClick={onToggleCollapse}
      >
        <span {...dragHandleProps} className="cursor-grab active:cursor-grabbing p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical size={12} className="text-secondary-text/40" />
        </span>
        <span className="text-[13px] leading-none">{icon}</span>
        <span className="text-[11px] font-bold uppercase tracking-widest text-secondary-text flex-1 truncate">
          {label}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/15 text-secondary-text/40 hover:text-red-400 transition-all"
            title="Remove widget"
          >
            <EyeOff size={11} />
          </button>
          <motion.div
            animate={{ rotate: isCollapsed ? 0 : 180 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronDown size={12} className="text-secondary-text/40" />
          </motion.div>
        </div>
      </div>

      {/* Body */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            key={`${id}-body`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default memo(WidgetContainer);
