"use client";

import React from 'react';

export const searchEngines = {
  google: { name: 'Google', url: 'https://www.google.com/search?q=' },
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
};

interface SearchEngineSettingsProps {
  selectedEngine: string;
  setSelectedEngine: (engine: string) => void;
}

const SearchEngineSettings: React.FC<SearchEngineSettingsProps> = ({ selectedEngine, setSelectedEngine }) => {
  return (
    <div className="space-y-2">
      <label className="block text-[10px] uppercase font-bold tracking-widest text-white/40">Default Engine</label>
      <div className="grid grid-cols-1 gap-1.5">
        {Object.entries(searchEngines).map(([key, engine]) => (
          <button
            key={key}
            onClick={() => setSelectedEngine(key)}
            className={`w-full px-3 py-2 flex items-center justify-between rounded-xl border transition-all ${selectedEngine === key
                ? 'bg-white/10 border-white/20 text-white'
                : 'bg-transparent border-transparent text-white/40 hover:bg-white/5'
              }`}
          >
            <span className="text-xs">{engine.name}</span>
            {selectedEngine === key && <span className="text-[10px] text-deep-space-accent-neon">●</span>}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SearchEngineSettings;
