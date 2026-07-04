"use client";

import React from 'react';

interface BackendSettingsProps {
  backend: 'firebase' | 'mysql';
  setBackend: (backend: 'firebase' | 'mysql') => void;
  mysqlConfig: any;
  setMysqlConfig: (config: any) => void;
}

const BackendSettings: React.FC<BackendSettingsProps> = ({ backend, setBackend, mysqlConfig, setMysqlConfig }) => {
  // Check if strategy is enforced by admin
  const enforcedStrategy = process.env.NEXT_PUBLIC_BACKEND_STRATEGY;

  if (enforcedStrategy) {
    return (
      <div className="p-4 rounded-xl bg-deep-space-accent-neon/5 border border-deep-space-accent-neon/20">
        <p className="text-[10px] font-bold uppercase tracking-widest text-deep-space-accent-neon mb-1">Backup Strategy</p>
        <p className="text-xs text-white/60">Managed by Administrator ({enforcedStrategy})</p>
      </div>
    );
  }

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setMysqlConfig((prev: any) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-[10px] uppercase font-bold tracking-widest text-white/40">Data Strategy</label>
        <div className="grid grid-cols-2 gap-2">
          {(['firebase', 'mysql'] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBackend(b)}
              className={`py-1.5 rounded-lg border text-[10px] uppercase font-bold tracking-wider transition-all ${backend === b
                ? 'bg-deep-space-accent-neon/20 border-deep-space-accent-neon/40 text-deep-space-accent-neon'
                : 'bg-white/5 border-white/5 text-white/30 hover:bg-white/10'
                }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {backend === 'mysql' && (
        <div className="space-y-2 pt-2 border-t border-white/5">
          {['host', 'user', 'database'].map((field) => (
            <input
              key={field}
              type="text"
              name={field}
              placeholder={`MySQL ${field.charAt(0).toUpperCase() + field.slice(1)}`}
              className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/10 focus:border-deep-space-accent-neon/30 outline-none"
              value={(mysqlConfig && mysqlConfig[field]) || ''}
              onChange={handleConfigChange}
            />
          ))}
          <input
            type="password"
            name="password"
            placeholder="MySQL Password"
            className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/10 focus:border-deep-space-accent-neon/30 outline-none"
            value={(mysqlConfig && mysqlConfig.password) || ''}
            onChange={handleConfigChange}
          />
        </div>
      )}
    </div>
  );
};

export default BackendSettings;
