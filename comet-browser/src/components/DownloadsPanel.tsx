"use client";

import React from "react";
import { motion } from "framer-motion";
import { DownloadCloud, X } from "lucide-react";

export interface DownloadItem {
  name: string;
  status: string;
  progress?: number;
  path?: string;
}

interface DownloadsPanelProps {
  downloads: DownloadItem[];
  onClose: () => void;
}

const DownloadsPanel: React.FC<DownloadsPanelProps> = ({ downloads, onClose }) => {
  return (
    <div className="w-full min-h-[520px] max-h-[560px] rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,12,20,0.96),rgba(5,7,14,0.92))] shadow-[0_24px_80px_rgba(0,0,0,0.45)] overflow-hidden flex flex-col backdrop-blur-2xl">
      <div className="relative border-b border-white/8 bg-white/[0.02] px-6 py-5 drag-region">
        <div className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-sky-400/30 to-transparent" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.28em] text-sky-400">Downloads</h3>
            <p className="mt-1 text-[11px] text-white/35">Files, exports, and completed saves in one place.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all text-white/40 no-drag-region">
          <X size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 p-5">
        {downloads.length === 0 ? (
          <div className="h-full min-h-[390px] rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] flex flex-col items-center justify-center text-center gap-4 text-white/35 px-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
              <DownloadCloud size={34} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-white/55">No Active Downloads</p>
              <p className="text-xs text-white/30">Finished files will land here and stay easy to reopen.</p>
            </div>
          </div>
        ) : (
          downloads.map((download, index) => (
            <div
              key={`${download.name}-${index}`}
              className="group rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3.5 flex items-center gap-4 transition-all cursor-pointer hover:border-sky-400/30 hover:bg-sky-400/[0.06]"
              onClick={async () => {
                if (download.status === "completed" && window.electronAPI?.openFile) {
                  await window.electronAPI.openFile(download.path || download.name);
                }
              }}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-sky-300">
                <DownloadCloud size={18} />
              </div>
              <div className="min-w-0 flex-1 flex flex-col gap-1">
                <span className="text-sm font-semibold text-white truncate">{download.name}</span>
                <span className="text-[10px] uppercase font-black tracking-[0.22em] text-sky-400/65">
                  {download.status === "completed" ? "Click to Open" : download.status}
                </span>
              </div>
              <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: download.status === "completed" ? "100%" : `${download.progress || 0}%` }}
                  className="h-full bg-gradient-to-r from-sky-400 to-cyan-300"
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DownloadsPanel;
