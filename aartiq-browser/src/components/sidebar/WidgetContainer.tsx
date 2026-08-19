"use client";

import React, { memo, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown, Pin, PinOff, Maximize2, Minimize2 } from "lucide-react";
import type { WidgetSize } from "./types";

interface WidgetContainerProps {
  id: string;
  label: string;
  icon: string;
  description?: string;
  collapsed: boolean;
  size: WidgetSize;
  pinned: boolean;
  onToggleCollapse: () => void;
  onCycleSize: () => void;
  onTogglePin: () => void;
  children: React.ReactNode;
  /** optional drag affordance props (used inside the customization modal) */
  dragHandleProps?: Record<string, unknown>;
  headerExtra?: React.ReactNode;
}

const SIZE_MAX_HEIGHT: Record<WidgetSize, string> = {
  small: "200px",
  medium: "340px",
  large: "560px",
};

const WidgetContainer = memo(function WidgetContainer({
  id,
  label,
  icon,
  description,
  collapsed,
  size,
  pinned,
  onToggleCollapse,
  onCycleSize,
  onTogglePin,
  children,
  dragHandleProps,
  headerExtra,
}: WidgetContainerProps) {
  const reduce = useReducedMotion();
  const headerId = `sb-widget-header-${id}`;

  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggleCollapse();
      }
    },
    [onToggleCollapse],
  );

  return (
    <motion.section
      layout={!reduce}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
      className="rounded-[var(--sb-radius)] border border-[var(--sb-border)] bg-[var(--sb-surface)] shadow-[0_2px_12px_var(--sb-shadow)] overflow-hidden"
      aria-label={label}
    >
      <div
        id={headerId}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        aria-label={`${label} widget. ${collapsed ? "Collapsed" : "Expanded"}. Activate to ${collapsed ? "expand" : "collapse"}.`}
        onClick={onToggleCollapse}
        onKeyDown={handleKey}
        className="flex items-center gap-2 px-[var(--sb-pad)] py-2 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--sb-accent)] hover:bg-[color-mix(in_srgb,var(--sb-text)_4%,transparent)] transition-colors group"
      >
        {dragHandleProps && (
          <span
            {...dragHandleProps}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 rounded text-[var(--sb-muted)]/40 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            aria-hidden="true"
            title="Drag to reorder"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <circle cx="3" cy="3" r="1" /><circle cx="9" cy="3" r="1" /><circle cx="3" cy="9" r="1" /><circle cx="9" cy="9" r="1" /><circle cx="6" cy="6" r="1" />
            </svg>
          </span>
        )}
        <span className="text-[13px] leading-none" aria-hidden="true">{icon}</span>
        <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--sb-text)] flex-1 truncate">
          {label}
        </span>
        {pinned && (
          <Pin size={11} className="text-[var(--sb-accent)]" aria-label="Pinned" />
        )}
        <div className="flex items-center gap-0.5">
          {headerExtra}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCycleSize(); }}
            className="p-1 rounded-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[color-mix(in_srgb,var(--sb-text)_8%,transparent)] text-[var(--sb-muted)]/60 hover:text-[var(--sb-text)] transition-all"
            title={`Size: ${size}`}
            aria-label={`Change widget size, currently ${size}`}
          >
            {size === "large" ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
            className="p-1 rounded-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[color-mix(in_srgb,var(--sb-text)_8%,transparent)] text-[var(--sb-muted)]/60 hover:text-[var(--sb-text)] transition-all"
            title={pinned ? "Unpin" : "Pin"}
            aria-label={pinned ? "Unpin widget" : "Pin widget"}
            aria-pressed={pinned}
          >
            {pinned ? <PinOff size={11} /> : <Pin size={11} />}
          </button>
          <motion.span
            animate={{ rotate: collapsed ? -90 : 0 }}
            transition={{ duration: 0.15 }}
            className="text-[var(--sb-muted)]/60"
            aria-hidden="true"
          >
            <ChevronDown size={13} />
          </motion.span>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="body"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div
              className="px-[var(--sb-pad)] pb-[var(--sb-pad)] text-[var(--sb-text)]"
              style={{ maxHeight: SIZE_MAX_HEIGHT[size], overflowY: "auto" }}
              role="region"
              aria-labelledby={headerId}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
});

export default memo(WidgetContainer);
