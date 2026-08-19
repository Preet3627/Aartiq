"use client";
import React, { useState, useEffect, useCallback, useRef } from 'react';

interface ExtensionAction {
  id: string;
  name: string;
  title: string;
  popup: string;
  badgeText: string;
  badgeBg: number[];
  icons: { size: number; url: string }[];
  enabled: boolean;
}

function getBestIcon(icons: { size: number; url: string }[]): string | null {
  if (!icons || icons.length === 0) return null;
  const sorted = [...icons].sort((a, b) => a.size - b.size);
  return sorted[0]?.url || null;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

const ACTION_BAR_KEYS = {
  actions: 'ext-actions-state',
};

const ExtensionActionBar = () => {
  const [actions, setActions] = useState<ExtensionAction[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchActions = useCallback(async () => {
    if (!window.electronAPI?.getExtensionActions) return;
    try {
      const result = await window.electronAPI.getExtensionActions();
      setActions(result || []);
    } catch { /* ignore polling errors */ }
  }, []);

  useEffect(() => {
    fetchActions();
    pollingRef.current = setInterval(fetchActions, 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [fetchActions]);

  useEffect(() => {
    if (!window.electronAPI?.onExtensionActionUpdated) return;
    const unsub = window.electronAPI.onExtensionActionUpdated((data: any) => {
      setActions(prev => prev.map(a =>
        a.id === data.id ? { ...a, badgeText: data.badgeText ?? a.badgeText, title: data.title ?? a.title } : a
      ));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onExtensionInstalled) return;
    const unsub = window.electronAPI.onExtensionInstalled(() => fetchActions());
    return () => unsub();
  }, [fetchActions]);

  const handleActionClick = async (extId: string) => {
    if (!window.electronAPI?.openExtensionPopup) return;
    await window.electronAPI.openExtensionPopup(extId);
  };

  if (!actions || actions.length === 0) return null;

  return (
    <div
      className="flex items-center gap-0.5 px-1 border-l border-white/5 ml-1"
      onMouseDown={e => e.stopPropagation()}
    >
      {actions.map(action => (
        <button
          key={action.id}
          onClick={() => handleActionClick(action.id)}
          className="relative w-7 h-7 rounded-lg hover:bg-white/10 active:bg-white/15 transition-all flex items-center justify-center group"
          title={action.title || action.name}
        >
          {action.icons?.[0]?.url ? (
            <img
              src={getBestIcon(action.icons) || ''}
              alt=""
              className="w-4 h-4 object-contain"
              onError={e => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <span className={`text-[9px] font-bold text-white/60 ${action.icons?.[0]?.url ? 'hidden' : ''}`}>
            {getInitials(action.name)}
          </span>
          {action.badgeText ? (
            <span
              className="absolute -top-0.5 -right-0.5 text-[8px] font-bold text-white px-1 rounded-full leading-none py-0.5 min-w-[14px] text-center"
              style={{
                backgroundColor: action.badgeBg
                  ? `rgba(${action.badgeBg[0]}, ${action.badgeBg[1]}, ${action.badgeBg[2]}, ${(action.badgeBg[3] ?? 255) / 255})`
                  : 'rgba(0,0,0,0.5)',
              }}
            >
              {action.badgeText}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
};

export default ExtensionActionBar;
