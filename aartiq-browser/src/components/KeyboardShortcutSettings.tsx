"use client";

import { useAppStore } from "@/store/useAppStore";
import { shortcutDefinitions } from "@/lib/constants";
import { motion } from "framer-motion";
import { useMemo } from "react";

const KeyboardShortcutSettings = () => {
  const store = useAppStore();
  const shortcuts = store.shortcuts;
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);

  const shortcutsByAction = useMemo(
    () => new Map(shortcuts.map((shortcut) => [shortcut.action, shortcut.accelerator])),
    [shortcuts]
  );

  const groupedShortcuts = useMemo(() => {
    return shortcutDefinitions.reduce<Record<string, Array<(typeof shortcutDefinitions)[number]>>>((acc, definition) => {
      if (!acc[definition.category]) {
        acc[definition.category] = [];
      }
      acc[definition.category].push(definition);
      return acc;
    }, {});
  }, []);

  const handleUpdateShortcut = (action: string, newAccelerator: string) => {
    store.updateShortcut(action, newAccelerator);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-6 text-white/55">
        {isMac
          ? 'These shortcuts now power both the shortcut manager and the native macOS menu accelerators.'
          : 'These shortcuts update Comet actions and global-safe hotkeys where supported.'}
      </div>

      <div className="space-y-4">
        {Object.entries(groupedShortcuts).map(([category, definitions]) => (
          <div key={category} className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
            <div className="mb-3 text-[10px] font-black uppercase tracking-[0.28em] text-white/35">
              {category}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {definitions.map((definition) => (
                <div
                  key={definition.action}
                  className="w-full rounded-2xl border border-white/6 bg-black/20 px-4 py-3 transition-all hover:bg-white/[0.05]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-bold text-white">{definition.label}</div>
                      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">
                        {definition.action}
                      </div>
                    </div>
                    <input
                      type="text"
                      value={shortcutsByAction.get(definition.action) || definition.accelerator}
                      readOnly
                      onKeyDown={(e) => {
                        e.preventDefault();
                        const parts = [];
                        if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
                        if (e.altKey) parts.push('Alt');
                        if (e.shiftKey) parts.push('Shift');

                        const key = e.key.toUpperCase();
                        if (['CONTROL', 'ALT', 'SHIFT', 'META'].includes(key)) return;

                        let finalKey = key;
                        if (key === ' ') finalKey = 'Space';
                        else if (key === 'ARROWUP') finalKey = 'Up';
                        else if (key === 'ARROWDOWN') finalKey = 'Down';
                        else if (key === 'ARROWLEFT') finalKey = 'Left';
                        else if (key === 'ARROWRIGHT') finalKey = 'Right';
                        else if (key === 'ESCAPE') finalKey = 'Esc';
                        else if (key === 'ENTER') finalKey = 'Enter';
                        else if (key === 'BACKSPACE') finalKey = 'Backspace';
                        else if (key === 'DELETE') finalKey = 'Delete';
                        else if (key === 'TAB') finalKey = 'Tab';

                        parts.push(finalKey);
                        handleUpdateShortcut(definition.action, parts.join('+'));
                      }}
                      className="w-56 cursor-pointer rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-right text-xs font-black tracking-widest text-deep-space-accent-neon focus:border-deep-space-accent-neon/50 focus:outline-none"
                      placeholder="Press Keys..."
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KeyboardShortcutSettings;
