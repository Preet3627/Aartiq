"use client";
import React, { useState, useEffect } from 'react';
import { Key, X, Eye, EyeOff, Check, Shield } from 'lucide-react';

interface SaveDialogData {
  domain: string;
  url?: string;
  username: string;
  password: string;
  type: string;
}

interface PasswordSaveDialogProps {
  data: SaveDialogData | null;
  onClose: () => void;
}

export default function PasswordSaveDialog({ data, onClose }: PasswordSaveDialogProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setShowPassword(false);
  }, [data]);

  if (!data) return null;

  const handleSave = async () => {
    if (!window.electronAPI?.vaultSaveEntry) return;
    setSaving(true);
    const result = await window.electronAPI.vaultSaveEntry({
      site: data.domain,
      username: data.username,
      password: data.password,
      type: 'login',
    });
    setSaving(false);
    if (result?.success) onClose();
  };

  const handleDiscard = () => {
    onClose();
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl shadow-2xl backdrop-blur-xl w-80 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-violet-500/10 rounded-lg">
              <Key size={14} className="text-violet-400" />
            </div>
            <span className="text-xs font-bold text-white/70">Save Password?</span>
          </div>
          <button onClick={handleDiscard} className="text-white/20 hover:text-white/60 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-3 space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-white/30">Site</label>
            <p className="text-sm text-white/80 truncate">{data.domain}</p>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-white/30">Username</label>
            <p className="text-sm text-white/80 truncate">{data.username || '(none)'}</p>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-white/30">Password</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/80 font-mono truncate">
                {showPassword ? data.password : '••••••••••••'}
              </span>
              <button onClick={() => setShowPassword(!showPassword)} className="text-white/30 hover:text-white/60 shrink-0">
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-white/5">
          <button
            onClick={handleDiscard}
            className="flex-1 py-2 text-xs font-bold text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
          >
            Never
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {saving ? (
              <span className="animate-pulse">Saving...</span>
            ) : (
              <>
                <Shield size={12} />
                Save to Vault
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
