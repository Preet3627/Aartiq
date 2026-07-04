import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus } from 'lucide-react';

export interface ChatMessage {
  id?: string;
  role: 'user' | 'model' | 'system' | 'assistant';
  content: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: any[];
  createdAt: number;
  updatedAt: number;
}

interface ConversationHistoryPanelProps {
  show: boolean;
  conversations: Conversation[];
  activeId: string | null;
  onClose: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

const ConversationHistoryPanel = memo(function ConversationHistoryPanel({
  show,
  conversations,
  activeId,
  onClose,
  onLoad,
  onDelete,
  onNew,
}: ConversationHistoryPanelProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ x: -280, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -280, opacity: 0 }}
          className="absolute left-0 top-0 bottom-0 w-72 bg-[#0a0a14] border-r border-white/10 z-[100] overflow-y-auto modern-scrollbar backdrop-blur-2xl shadow-2xl"
        >
          <div className="sticky top-0 p-5 border-b border-white/5 flex items-center justify-between bg-[#0a0a14]/80 backdrop-blur-md z-10">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/60">Neural Cache</h3>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all">
              <X size={16} />
            </button>
          </div>
          
          <div className="p-4 space-y-2">
            <button
              onClick={onNew}
              className="w-full p-4 mb-4 rounded-2xl bg-sky-500/10 hover:bg-sky-500/20 transition-all text-xs font-bold flex items-center gap-3 text-sky-400 border border-sky-500/20 group"
            >
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus size={18} />
              </div>
              Initialize New Stream
            </button>
            
            <div className="space-y-1">
              {conversations.length === 0 && (
                <div className="py-20 text-center">
                  <div className="text-[10px] uppercase font-bold tracking-widest text-white/20">No active streams found</div>
                </div>
              )}
              
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`flex items-center rounded-2xl p-2.5 transition-all group relative border ${
                    activeId === conv.id ? 'bg-white/5 border-white/10 shadow-lg' : 'hover:bg-white/[0.02] border-transparent'
                  }`}
                >
                  <div
                    onClick={() => onLoad(conv.id)}
                    className="flex-1 cursor-pointer min-w-0 pr-8"
                  >
                    <div className={`text-xs font-medium truncate ${activeId === conv.id ? 'text-white' : 'text-white/60 group-hover:text-white/90'}`}>
                      {conv.title}
                    </div>
                    <div className="text-[9px] font-mono text-white/20 mt-1 flex items-center gap-2">
                       <span className="w-1 h-1 rounded-full bg-sky-500/40" />
                       {new Date(conv.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(conv.id);
                    }}
                    className="absolute right-3 p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded-xl transition-all text-white/20 hover:text-red-400"
                    title="Delete Stream"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default ConversationHistoryPanel;
