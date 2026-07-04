import React, { useRef, useState, memo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ChevronDown, ChevronUp, Scan, Sparkles } from 'lucide-react';

interface CollapsibleOCRMessageProps {
  label: string;
  content: string;
}

const CollapsibleOCRMessage = memo(function CollapsibleOCRMessage({
  label,
  content,
}: CollapsibleOCRMessageProps) {
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(150);
  const [isRevealing, setIsRevealing] = useState(false);
  const [revealedChars, setRevealedChars] = useState(0);
  const dragStartY = useRef<number | null>(null);
  const dragStartH = useRef<number>(150);
  const revealTimeout = useRef<NodeJS.Timeout | null>(null);

  const onDragStart = (e: React.MouseEvent) => {
    dragStartY.current = e.clientY;
    dragStartH.current = height;
    const onMove = (ev: MouseEvent) => {
      if (dragStartY.current === null) return;
      const delta = ev.clientY - dragStartY.current;
      setHeight(Math.max(80, Math.min(600, dragStartH.current + delta)));
    };
    const onUp = () => {
      dragStartY.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  useEffect(() => {
    if (open && !isRevealing) {
      setIsRevealing(true);
      setRevealedChars(0);
      const totalChars = content.length;
      const revealSpeed = Math.max(5, Math.min(50, totalChars / 20));
      
      const interval = setInterval(() => {
        setRevealedChars(prev => {
          if (prev >= totalChars) {
            clearInterval(interval);
            setIsRevealing(false);
            return totalChars;
          }
          return prev + revealSpeed;
        });
      }, 30);

      revealTimeout.current = interval;

      return () => {
        if (revealTimeout.current) clearInterval(revealTimeout.current);
      };
    }
  }, [open, content, isRevealing]);

  const displayedContent = isRevealing 
    ? content.substring(0, revealedChars) + (revealedChars < content.length ? '█' : '')
    : content;
  const normalizedLabel = label.toUpperCase();
  const isDomSource = normalizedLabel.includes('DOM') || normalizedLabel.includes('PAGE_CONTENT');
  const isSearchDom = normalizedLabel.includes('SEARCH_PAGE_DOM');
  const sourceBadgeText = isDomSource
    ? (isSearchDom ? 'Search DOM' : 'DOM Result')
    : 'OCR Result';
  const sourceHint = isDomSource
    ? (open ? 'click to hide DOM snapshot' : `${content.length} chars — click to inspect DOM content`)
    : (open
      ? isRevealing
        ? `typing... ${Math.round((revealedChars / content.length) * 100)}%`
        : 'click to hide'
      : `${content.length} chars — click to view`);

  return (
    <div className="w-full mt-1 rounded-2xl border border-white/10 overflow-hidden bg-gradient-to-br from-black/40 via-slate-900/30 to-black/40 relative">
      {/* Animated scanline effect */}
      <AnimatePresence>
        {open && isRevealing && (
          <motion.div
            initial={{ top: 0, opacity: 1 }}
            animate={{ 
              top: '100%',
              opacity: [1, 0.5, 0]
            }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: 1.5,
              repeat: Infinity,
              ease: 'linear'
            }}
            className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent z-10 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Glowing border animation */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        animate={open ? { 
          boxShadow: [
            '0 0 5px rgba(34, 211, 238, 0.1), inset 0 0 5px rgba(34, 211, 238, 0.05)',
            '0 0 15px rgba(34, 211, 238, 0.3), inset 0 0 10px rgba(34, 211, 238, 0.1)',
            '0 0 5px rgba(34, 211, 238, 0.1), inset 0 0 5px rgba(34, 211, 238, 0.05)'
          ]
        } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      />

      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white/70 hover:bg-white/5 transition-all relative z-[5]"
      >
        <div className="flex items-center gap-3">
          <motion.div
            animate={open ? { rotate: [0, 360] } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
          {open ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={isDomSource ? 'text-sky-400' : 'text-cyan-400'}
              >
                <Scan size={14} />
              </motion.div>
            ) : (
              <Eye size={11} className={isDomSource ? 'text-sky-400' : 'text-amber-400'} />
            )}
          </motion.div>
          <div className="flex items-center gap-2">
            <span className={isDomSource ? 'text-sky-400/70' : 'text-cyan-400/60'}>[{label}]</span>
            <span className="text-white/20 font-normal normal-case tracking-normal">
              {sourceHint}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1"
            >
              <Sparkles size={10} className={`${isDomSource ? 'text-sky-400' : 'text-cyan-400'} animate-pulse`} />
              <span className={`text-[9px] ${isDomSource ? 'text-sky-400/70' : 'text-cyan-400/60'}`}>{sourceBadgeText}</span>
            </motion.div>
          )}
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            {open ? <ChevronUp size={14} className={isDomSource ? 'text-sky-400' : 'text-cyan-400'} /> : <ChevronDown size={12} />}
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0, scaleY: 0.95 }}
            animate={{ height, opacity: 1, scaleY: 1 }}
            exit={{ height: 0, opacity: 0, scaleY: 0.95 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            style={{ height }}
            className="overflow-y-auto modern-scrollbar bg-black/50 relative"
          >
            {/* Matrix-style background pattern */}
            <div 
              className="absolute inset-0 opacity-5 pointer-events-none"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  0deg,
                  transparent,
                  transparent 2px,
                  rgba(34, 211, 238, 0.1) 2px,
                  rgba(34, 211, 238, 0.1) 4px
                )`
              }}
            />
            
            <pre className="p-4 text-[11px] text-white/70 leading-relaxed whitespace-pre-wrap break-all font-mono relative z-[1]">
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                {displayedContent}
              </motion.span>
            </pre>

            {/* Glitch effect on edges */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-r from-cyan-400/20 to-transparent" />
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-l from-purple-400/20 to-transparent" />
          </motion.div>
        )}
      </AnimatePresence>

      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center py-1 cursor-ns-resize hover:bg-white/10 transition-colors border-t border-white/5 relative z-[5]"
          onMouseDown={onDragStart}
        >
          <motion.div
            className="w-12 h-0.5 rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent"
            animate={{ scaleX: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>
      )}
    </div>
  );
});

export default CollapsibleOCRMessage;
