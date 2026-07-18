import React, { useState, memo } from 'react';
import { ChevronRight, Search, FileText, Globe, Camera, Terminal } from 'lucide-react';

interface CollapsibleOCRMessageProps {
  label: string;
  content: string;
}

const LABEL_CONFIG: Record<string, { icon: React.ReactNode; color: string; text: string }> = {
  SEARCH_PAGE_DOM:       { icon: <Search size={11} />,   color: 'text-sky-400',    text: 'Search Results' },
  WEB_SEARCH_FALLBACK_OCR: { icon: <Search size={11} />, color: 'text-sky-400',    text: 'Search (OCR)' },
  PAGE_CONTENT:          { icon: <FileText size={11} />,  color: 'text-emerald-400', text: 'Page Content' },
  SCREENSHOT_ANALYSIS:   { icon: <Camera size={11} />,    color: 'text-purple-400', text: 'Screenshot' },
  DOM_EXTRACTED:         { icon: <Terminal size={11} />,  color: 'text-amber-400',  text: 'DOM Content' },
  DOM_SEARCH:            { icon: <Search size={11} />,    color: 'text-sky-400',    text: 'DOM Search' },
};

const CollapsibleOCRMessage = memo(function CollapsibleOCRMessage({
  label,
  content,
}: CollapsibleOCRMessageProps) {
  const [open, setOpen] = useState(false);
  const config = LABEL_CONFIG[label] || { icon: <Globe size={11} />, color: 'text-white/50', text: label };
  const preview = content.substring(0, 120).replace(/\n/g, ' ').trim();

  return (
    <div className="w-full mt-1 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-white/[0.03] transition-colors"
      >
        <ChevronRight
          size={12}
          className={`text-white/30 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
        <span className={config.color}>{config.icon}</span>
        <span className="text-white/50 font-medium">{config.text}</span>
        {!open && (
          <span className="text-white/20 truncate ml-1 flex-1 text-left">{preview}</span>
        )}
        <span className="text-white/20 ml-auto shrink-0">{content.length.toLocaleString()} chars</span>
      </button>

      {open && (
        <div className="px-3 pb-3 max-h-[400px] overflow-y-auto modern-scrollbar">
          <pre className="text-[11px] text-white/50 leading-relaxed whitespace-pre-wrap break-words font-mono">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
});

export default CollapsibleOCRMessage;
