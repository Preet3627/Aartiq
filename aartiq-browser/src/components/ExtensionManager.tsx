"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ToggleRight, ToggleLeft, ExternalLink, RefreshCw, Package } from "lucide-react";

interface Extension {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  path: string;
}

const ExtensionManager = () => {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExtensions = async () => {
    setLoading(true);
    if (window.electronAPI) {
      const fetchedExtensions = await window.electronAPI.getExtensions();
      setExtensions(fetchedExtensions);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchExtensions();
  }, []);

  const handleToggleExtension = async (id: string) => {
    if (window.electronAPI) {
      const success = await window.electronAPI.toggleExtension(id);
      if (success !== undefined) {
        setExtensions((prev) =>
          prev.map((ext) =>
            ext.id === id ? { ...ext, enabled: success } : ext
          )
        );
      } else {
        // Fallback if return is void or error
        fetchExtensions();
      }
    }
  };

  const handleUninstallExtension = async (id: string) => {
    if (window.electronAPI) {
      await window.electronAPI.uninstallExtension(id);
      fetchExtensions();
    }
  };

  const handleOpenExtensionsFolder = async () => {
    if (window.electronAPI) {
      const path = await window.electronAPI.getExtensionPath();
      // In a real app, this would open the folder using shell.showItemInFolder
      alert(`Extensions folder: ${path}. You would open this in your file explorer.`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <RefreshCw className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-8 bg-black/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8"
    >
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">Neural Modules</h2>
          <p className="text-sm text-white/40 max-w-md">
            Extensions run autonomously to augment your workspace's baseline intelligence and privacy.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchExtensions}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 text-white/60 transition-all"
          >
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleOpenExtensionsFolder}
          className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-deep-space-accent-neon/10 text-deep-space-accent-neon rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-deep-space-accent-neon/20 hover:bg-deep-space-accent-neon/20 transition-all"
        >
          <ExternalLink size={18} /> Module Directory
        </button>
      </div>

      <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar pr-2">
        {extensions.length === 0 ? (
          <div className="text-center text-white/20 py-16 border-2 border-dashed border-white/5 rounded-[2rem]">
            No modules integrated yet.
          </div>
        ) : (
          <AnimatePresence>
            {extensions.map((ext) => (
              <motion.div
                key={ext.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center justify-between bg-white/[0.02] border border-white/5 p-6 rounded-[2rem] hover:bg-white/[0.04] transition-all group"
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-black/40 flex items-center justify-center text-deep-space-accent-neon border border-white/5 shadow-xl">
                    <Package size={28} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-white tracking-tight">{ext.name}</h3>
                    <p className="text-xs text-white/40 line-clamp-1">{ext.description}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[9px] font-black text-white/20 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded">v{ext.version}</span>
                      <span className="text-[9px] font-black pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity text-deep-space-accent-neon">ID: {ext.id.substring(0, 8)}...</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleExtension(ext.id)}
                    className={`p-3 rounded-2xl transition-all border ${ext.enabled
                      ? "bg-deep-space-accent-neon/10 border-deep-space-accent-neon/30 text-deep-space-accent-neon shadow-[0_0_15px_rgba(0,255,255,0.1)]"
                      : "bg-white/5 border-white/5 text-white/20"
                      }`}
                    title={ext.enabled ? "Deactivate" : "Activate"}
                  >
                    {ext.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  </button>
                  <button
                    onClick={() => handleUninstallExtension(ext.id)}
                    className="p-3 rounded-2xl bg-red-500/10 border border-red-500/5 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
                    title="Purge Module"
                  >
                    <Trash2 size={24} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};

export default ExtensionManager;
