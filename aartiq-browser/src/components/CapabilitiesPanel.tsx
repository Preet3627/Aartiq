import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Code, ExternalLink, ShieldCheck, Cpu } from 'lucide-react';
import { COMMAND_REGISTRY } from '@/lib/AICommandParser';
import { useAppVersion } from '@/lib/useAppVersion';

interface CapabilitiesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const CapabilitiesPanel: React.FC<CapabilitiesPanelProps> = ({ isOpen, onClose }) => {
  const versionLabel = `v${useAppVersion()}`;
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="absolute inset-x-4 top-20 bottom-24 z-[100] bg-[#0a0a10]/95 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
        >
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-br from-white/5 to-transparent">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-sky-500/20 rounded-2xl border border-sky-500/30">
                <Zap className="text-sky-400" size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Strict Intelligence Registry</h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-tight mt-0.5">Available Agentic Capabilities ({versionLabel})</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full text-white/30 hover:text-white transition-all"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
            {Object.entries(COMMAND_REGISTRY).map(([tag, info]) => (
              <div key={tag} className="p-4 bg-white/5 rounded-3xl border border-white/5 hover:border-white/10 transition-all group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black font-mono text-sky-400 bg-sky-400/10 px-2 py-1 rounded-lg uppercase tracking-wider group-hover:bg-sky-400 group-hover:text-black transition-all">
                      [{tag}]
                    </span>
                    <ShieldCheck size={14} className="text-white/20" />
                  </div>
                  <Code size={14} className="text-white/10 group-hover:text-sky-400 transition-all" />
                </div>
                <p className="text-xs font-bold text-white/80">{info.desc}</p>
                <div className="mt-3 p-2.5 bg-black/40 rounded-xl border border-white/5">
                   <p className="text-[10px] font-mono text-white/40 select-all truncate">{info.example}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-white/5 border-t border-white/5 flex flex-col gap-2">
             <div className="flex items-center gap-2 text-amber-400/80 px-3 py-2 bg-amber-400/10 rounded-2xl border border-amber-400/20">
                <Cpu size={14} />
                <p className="text-[9px] font-black uppercase leading-tight tracking-widest">Selected Model: <span className="text-white">Neural Agent Engine</span></p>
             </div>
             <p className="text-[8px] text-center text-white/20 uppercase tracking-[0.2em] font-bold py-1">Mission Control Authorization Active</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CapabilitiesPanel;
