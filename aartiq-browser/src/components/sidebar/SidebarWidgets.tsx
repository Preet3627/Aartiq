"use client";

import React, { memo, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import WidgetContainer from "./WidgetContainer";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary";
import { WIDGET_COMPONENTS } from "./registry";
import { WIDGET_META, type SidebarPreferences, type WidgetId, type WidgetSize } from "./types";
import { useSidebarData } from "./SidebarContext";

const SIZE_CYCLE: Record<WidgetSize, WidgetSize> = {
  small: "medium",
  medium: "large",
  large: "small",
};

export interface SidebarWidgetsController {
  setWidgetCollapsed: (id: WidgetId, collapsed: boolean) => void;
  setWidgetSize: (id: WidgetId, size: WidgetSize) => void;
  setWidgetPinned: (id: WidgetId, pinned: boolean) => void;
  toggleWidget: (id: WidgetId) => void;
}

interface SidebarWidgetsProps {
  prefs: SidebarPreferences;
  controller: SidebarWidgetsController;
  emptyState?: React.ReactNode;
}

const SidebarWidgets = memo(function SidebarWidgets({
  prefs,
  controller,
  emptyState,
}: SidebarWidgetsProps) {
  const data = useSidebarData();

  const ordered = useMemo(
    () => prefs.widgets.filter((w) => w.enabled),
    [prefs.widgets],
  );

  const cycleSize = useCallback(
    (id: WidgetId, current: WidgetSize) => controller.setWidgetSize(id, SIZE_CYCLE[current]),
    [controller],
  );

  if (ordered.length === 0) {
    return (
      <>
        {emptyState}
        <div className="rounded-[var(--sb-radius)] border border-dashed border-[var(--sb-border)] px-3 py-6 text-center">
          <p className="text-[11px] text-[var(--sb-muted)]/60">
            All widgets are hidden. Open <span className="font-semibold text-[var(--sb-accent)]">Customize Workspace</span> to bring them back.
          </p>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-[var(--sb-gap)]">
      <AnimatePresence initial={false}>
        {ordered.map((w) => {
          const meta = WIDGET_META[w.id];
          const Comp = WIDGET_COMPONENTS[w.id];
          return (
            <motion.div
              key={w.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            >
              <WidgetContainer
                id={w.id}
                label={meta.label}
                icon={meta.icon}
                description={meta.description}
                collapsed={w.collapsed}
                size={w.size}
                pinned={w.pinned}
                onToggleCollapse={() => controller.setWidgetCollapsed(w.id, !w.collapsed)}
                onCycleSize={() => cycleSize(w.id, w.size)}
                onTogglePin={() => controller.setWidgetPinned(w.id, !w.pinned)}
              >
                <WidgetErrorBoundary widgetName={meta.label}>
                  <Comp />
                </WidgetErrorBoundary>
              </WidgetContainer>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
});

export default SidebarWidgets;
