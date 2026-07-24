"use client";

import React, { memo, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, Eye, EyeOff, RotateCcw, X } from 'lucide-react';
import { WIDGET_DEFINITIONS, type WidgetId, type SidebarPreferences, saveSidebarPreferences, getSidebarPreferences } from './types';

interface CustomizationPanelProps {
  onClose: () => void;
  currentPrefs: SidebarPreferences;
  onUpdatePrefs: (prefs: SidebarPreferences) => void;
}

const CustomizationPanel = memo(function CustomizationPanel({
  onClose,
  currentPrefs,
  onUpdatePrefs,
}: CustomizationPanelProps) {
  const [localEnabled, setLocalEnabled] = useState<WidgetId[]>(currentPrefs.enabledWidgets);
  const [localOrder, setLocalOrder] = useState<WidgetId[]>(currentPrefs.widgetOrder);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    setLocalEnabled(currentPrefs.enabledWidgets);
    setLocalOrder(currentPrefs.widgetOrder);
  }, [currentPrefs]);

  const toggleWidget = useCallback((id: WidgetId) => {
    setLocalEnabled(prev =>
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    );
  }, []);

  const moveWidget = useCallback((from: number, to: number) => {
    if (to < 0 || to >= localOrder.length) return;
    const newOrder = [...localOrder];
    const [moved] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, moved);
    setLocalOrder(newOrder);
  }, [localOrder]);

  const resetDefaults = useCallback(() => {
    import('./types').then(m => {
      const defaults = m.DEFAULT_SIDEBAR_PREFERENCES;
      setLocalEnabled(defaults.enabledWidgets);
      setLocalOrder(defaults.widgetOrder);
    });
  }, []);

  const save = useCallback(() => {
    const updated: SidebarPreferences = {
      ...currentPrefs,
      enabledWidgets: localEnabled,
      widgetOrder: localOrder,
    };
    saveSidebarPreferences(updated);
    onUpdatePrefs(updated);
    onClose();
  }, [currentPrefs, localEnabled, localOrder, onUpdatePrefs, onClose]);

  const orderedWidgets = localOrder
    .map(id => WIDGET_DEFINITIONS.find(w => w.id === id))
    .filter((w): w is NonNullable<typeof w> => w !== undefined);
  const disabledWidgets = WIDGET_DEFINITIONS.filter(w => !localEnabled.includes(w.id));
  const hasChanges = JSON.stringify(localEnabled) !== JSON.stringify(currentPrefs.enabledWidgets) ||
    JSON.stringify(localOrder) !== JSON.stringify(currentPrefs.widgetOrder);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="rounded-xl border border-[color-mix(in_srgb,var(--border-color)_30%,transparent)] bg-[color-mix(in_srgb,var(--card-bg)_96%,transparent)] backdrop-blur-2xl overflow-hidden shadow-2xl"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-secondary-text">Customize Workspace</h3>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-white/10 text-secondary-text/50 hover:text-secondary-text transition-all">
          <X size={14} />
        </button>
      </div>

      <div className="px-4 py-3 space-y-3 max-h-[400px] overflow-y-auto modern-scrollbar">
        {/* Active widgets */}
        <div>
          <h4 className="text-[9px] font-bold uppercase tracking-wider text-secondary-text/50 mb-1.5">Active Widgets</h4>
          <div className="space-y-1">
            {orderedWidgets.map((widget, idx) => (
              <div
                key={widget.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.05]"
              >
                <span className="cursor-grab active:cursor-grabbing text-secondary-text/30" onMouseDown={() => setDragIndex(idx)}>
                  <GripVertical size={11} />
                </span>
                <span className="text-[11px]">{widget.icon}</span>
                <span className="text-[10px] font-medium text-secondary-text/80 flex-1">{widget.label}</span>
                <button
                  onClick={() => toggleWidget(widget.id)}
                  className="p-1 rounded-md hover:bg-red-500/15 text-secondary-text/40 hover:text-red-400 transition-all"
                >
                  <EyeOff size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Disabled widgets */}
        {disabledWidgets.length > 0 && (
          <div>
            <h4 className="text-[9px] font-bold uppercase tracking-wider text-secondary-text/50 mb-1.5">Hidden Widgets</h4>
            <div className="space-y-1">
              {disabledWidgets.map((widget) => (
                <div
                  key={widget.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.03] opacity-60"
                >
                  <span className="text-[11px]">{widget.icon}</span>
                  <span className="text-[10px] font-medium text-secondary-text/60 flex-1">{widget.label}</span>
                  <button
                    onClick={() => toggleWidget(widget.id)}
                    className="p-1 rounded-md hover:bg-emerald-500/15 text-secondary-text/40 hover:text-emerald-400 transition-all"
                  >
                    <Eye size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.06]">
        <button
          onClick={resetDefaults}
          className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-secondary-text/40 hover:text-secondary-text transition-colors"
        >
          <RotateCcw size={10} /> Restore defaults
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg text-secondary-text/50 hover:text-secondary-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!hasChanges}
            className={`text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all ${
              hasChanges
                ? 'bg-sky-500/20 text-sky-400 hover:bg-sky-500/30'
                : 'bg-white/[0.04] text-secondary-text/30 cursor-not-allowed'
            }`}
          >
            {hasChanges ? 'Apply' : 'Saved'}
          </button>
        </div>
      </div>
    </motion.div>
  );
});

export default memo(CustomizationPanel);
