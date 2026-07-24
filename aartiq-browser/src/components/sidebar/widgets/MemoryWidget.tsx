"use client";

import React, { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { Brain, Trash2, X, Check, Search as SearchIcon } from 'lucide-react';

interface MemoryItem {
  key: string;
  value: string;
  category: 'preference' | 'session' | 'fact';
  timestamp: number;
}

const MemoryWidget = memo(function MemoryWidget() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [preferencesExpanded, setPreferencesExpanded] = useState(true);
  const [sessionsExpanded, setSessionsExpanded] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadMemories(); }, []);

  const loadMemories = useCallback(async () => {
    const items: MemoryItem[] = [];
    try {
      const rawPrefs = localStorage.getItem('aartiq_preference_memory');
      if (rawPrefs) {
        const prefs = JSON.parse(rawPrefs);
        Object.entries(prefs).forEach(([key, value]) => {
          items.push({ key, value: String(value), category: 'preference', timestamp: Date.now() });
        });
      }
      const rawSessions = localStorage.getItem('aartiq_session_memory');
      if (rawSessions) {
        const sessions = JSON.parse(rawSessions);
        if (Array.isArray(sessions)) {
          sessions.slice(-5).forEach((s: string, i: number) => {
            items.push({ key: `session-${i}`, value: s, category: 'session', timestamp: Date.now() - i * 60000 });
          });
        }
      }
    } catch { }
    setMemories(items);
  }, []);

  const clearMemory = useCallback(() => {
    try {
      localStorage.removeItem('aartiq_preference_memory');
      localStorage.removeItem('aartiq_session_memory');
    } catch { }
    setMemories([]);
    setConfirmClear(false);
  }, []);

  const deleteMemoryItem = useCallback((key: string) => {
    setMemories(prev => prev.filter(m => m.key !== key));
    try {
      const rawPrefs = localStorage.getItem('aartiq_preference_memory');
      if (rawPrefs) {
        const prefs = JSON.parse(rawPrefs);
        delete prefs[key];
        localStorage.setItem('aartiq_preference_memory', JSON.stringify(prefs));
      }
    } catch { }
  }, []);

  const filtered = useMemo(() => {
    if (!search) return memories;
    const q = search.toLowerCase();
    return memories.filter(m =>
      m.key.toLowerCase().includes(q) ||
      m.value.toLowerCase().includes(q)
    );
  }, [memories, search]);

  const preferences = useMemo(() => filtered.filter(m => m.category === 'preference'), [filtered]);
  const sessions = useMemo(() => filtered.filter(m => m.category === 'session'), [filtered]);

  return (
    <div className="space-y-2">
      {/* Search */}
      {memories.length > 0 && (
        <div className="relative">
          <SearchIcon size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-secondary-text/30" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search memories..."
            className="w-full pl-6 pr-2 py-1 text-[9px] rounded-lg bg-white/[0.04] border border-white/[0.06] text-secondary-text/70 placeholder:text-secondary-text/20 outline-none focus:border-sky-500/30 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary-text/30 hover:text-secondary-text/60"
            >
              <X size={9} />
            </button>
          )}
        </div>
      )}

      {memories.length === 0 ? (
        <div className="text-center py-4">
          <Brain size={20} className="mx-auto mb-2 text-secondary-text/40" />
          <p className="text-[10px] text-secondary-text/50">No memories yet</p>
          <p className="text-[9px] text-secondary-text/30 mt-1">Memories are created as you use Aartiq</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-3">
          <p className="text-[9px] text-secondary-text/40">No results for &quot;{search}&quot;</p>
        </div>
      ) : (
        <>
          {/* Preferences */}
          {preferences.length > 0 && (
            <div>
              <button
                onClick={() => setPreferencesExpanded(v => !v)}
                className="flex items-center gap-1.5 w-full text-left mb-1"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-secondary-text/60 flex-1">
                  Preferences ({preferences.length})
                </span>
                <span className={`text-[9px] text-secondary-text/30 transition-transform duration-150 ${preferencesExpanded ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {preferencesExpanded && (
                <div className="space-y-1">
                  {preferences.map((mem) => (
                    <div key={mem.key} className="flex items-start gap-1.5 group/pref">
                      <Check size={10} className="mt-0.5 text-emerald-400/60 shrink-0" />
                      <span className="text-[10px] text-secondary-text/70 flex-1 leading-relaxed">
                        {mem.key.replace(/_/g, ' ')}: <span className="text-secondary-text/90">{mem.value}</span>
                      </span>
                      <button
                        onClick={() => deleteMemoryItem(mem.key)}
                        className="p-0.5 opacity-0 group-hover/pref:opacity-100 hover:text-red-400 transition-all shrink-0"
                      >
                        <X size={9} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recent Sessions */}
          {sessions.length > 0 && (
            <div>
              <button
                onClick={() => setSessionsExpanded(v => !v)}
                className="flex items-center gap-1.5 w-full text-left mb-1"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-sky-400/60" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-secondary-text/60 flex-1">
                  Recent Sessions ({sessions.length})
                </span>
                <span className={`text-[9px] text-secondary-text/30 transition-transform duration-150 ${sessionsExpanded ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {sessionsExpanded && (
                <div className="space-y-1">
                  {sessions.map((mem) => (
                    <div key={mem.key} className="text-[10px] text-secondary-text/60 truncate leading-relaxed">
                      {mem.value}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2 pt-1">
            {confirmClear ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={clearMemory}
                  className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                >
                  Confirm clear
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="text-[9px] px-2 py-1 rounded-md text-secondary-text/50 hover:text-secondary-text transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-secondary-text/40 hover:text-red-400 transition-colors"
              >
                <Trash2 size={10} /> Clear memory
              </button>
            )}
            <span className="text-[8px] text-secondary-text/20 ml-auto">{memories.length} items</span>
          </div>
        </>
      )}
    </div>
  );
});

export default memo(MemoryWidget);
