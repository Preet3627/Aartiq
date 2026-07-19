import React, { memo, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ChevronDown, ChevronUp, FileText, Shield, AlertTriangle, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';

interface DOMSearchResult {
  text: string;
  context: string;
  xpath: string;
  score: number;
  tag?: string;
}

interface DOMSearchDisplayProps {
  results: DOMSearchResult[];
  query: string;
  isLoading?: boolean;
  onClose?: () => void;
  onResultClick?: (result: DOMSearchResult) => void;
  type: 'dom' | 'ocr' | 'web';
  timestamp?: number;
}

const DOMSearchDisplay: React.FC<DOMSearchDisplayProps> = ({
  results,
  query,
  isLoading = false,
  onClose,
  onResultClick,
  type,
  timestamp
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const displayResults = showAll ? results : results.slice(0, 5);
  const hasMore = results.length > 5;

  const getTypeIcon = () => {
    switch (type) {
      case 'ocr': return <FileText size={13} />;
      case 'web': return <Search size={13} />;
      default: return <Shield size={13} />;
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'ocr': return 'OCR Results';
      case 'web': return 'Web Search';
      default: return 'DOM Search';
    }
  };

  const getTypeColor = () => {
    switch (type) {
      case 'ocr': return 'text-emerald-400';
      case 'web': return 'text-sky-400';
      default: return 'text-violet-400';
    }
  };

  const getTypeBg = () => {
    switch (type) {
      case 'ocr': return 'border-emerald-500/10 bg-emerald-500/[0.03]';
      case 'web': return 'border-sky-500/10 bg-sky-500/[0.03]';
      default: return 'border-violet-500/10 bg-violet-500/[0.03]';
    }
  };

  const highlightMatch = (text: string) => {
    const parts = text.split(/\[\[|\]\]/);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return (
          <mark key={i} className="bg-yellow-500/25 text-yellow-300 px-0.5 rounded font-bold">
            {part}
          </mark>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-2 px-3.5 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02]"
      >
        <div className="flex items-center gap-2.5">
          <Loader2 size={13} className="text-sky-400 animate-spin" />
          <span className="text-[12px] text-white/50">Searching {getTypeLabel().toLowerCase()}...</span>
        </div>
        {query && (
          <div className="mt-1.5 text-[10px] text-white/30 ml-5.5">
            &ldquo;{query}&rdquo;
          </div>
        )}
      </motion.div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-2 px-3.5 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02]"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={getTypeColor()}>{getTypeIcon()}</span>
            <span className="text-[12px] text-white/50">{getTypeLabel()}</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
              <X size={12} />
            </button>
          )}
        </div>
        <div className="mt-2 text-[11px] text-white/30 text-center">
          No results for &ldquo;{query}&rdquo;
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-2 rounded-xl border overflow-hidden ${getTypeBg()}`}
    >
      {/* Header - minimal */}
      <div className="flex items-center justify-between px-3.5 py-2">
        <div className="flex items-center gap-2">
          <span className={getTypeColor()}>{getTypeIcon()}</span>
          <span className="text-[12px] font-medium text-white/60">{getTypeLabel()}</span>
          <span className="text-[10px] text-white/25">({results.length})</span>
          {query && (
            <span className="text-[10px] text-white/20 truncate max-w-[150px]">&ldquo;{query}&rdquo;</span>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Results */}
      <div className="px-3 pb-2.5 space-y-1 max-h-[350px] overflow-y-auto modern-scrollbar">
        {displayResults.map((result, index) => (
          <motion.div
            key={`${result.xpath}-${index}`}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            className={`group rounded-lg border transition-all ${
              expandedIndex === index
                ? 'bg-white/[0.04] border-white/[0.08]'
                : 'bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/[0.05]'
            }`}
          >
            <button
              onClick={() => {
                if (onResultClick) {
                  onResultClick(result);
                } else {
                  setExpandedIndex(expandedIndex === index ? null : index);
                }
              }}
              className="w-full text-left px-2.5 py-2"
            >
              <div className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-white/[0.06] text-[9px] text-white/30 font-bold flex items-center justify-center">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {result.tag && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-white/30 bg-white/[0.06] px-1.5 py-0.5 rounded">
                        {result.tag}
                      </span>
                    )}
                    {result.score >= 30 && (
                      <span className="text-[9px] text-yellow-400/60">&#9733; High</span>
                    )}
                  </div>
                  <div className="text-[12px] text-white/70 leading-relaxed line-clamp-2">
                    {highlightMatch(result.text)}
                  </div>
                </div>
                <ChevronDown
                  size={12}
                  className={`text-white/20 shrink-0 mt-1 transition-transform duration-200 ${expandedIndex === index ? 'rotate-180' : ''}`}
                />
              </div>
            </button>

            <AnimatePresence>
              {expandedIndex === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="px-2.5 pb-2.5 pt-1 ml-6 space-y-1.5">
                    {result.context && (
                      <div className="text-[10px]">
                        <span className="text-white/25">Context: </span>
                        <span className="text-white/45">{result.context}</span>
                      </div>
                    )}
                    {result.xpath && (
                      <div className="text-[10px]">
                        <span className="text-white/25">XPath: </span>
                        <span className="text-sky-400/60 font-mono select-all">{result.xpath}</span>
                      </div>
                    )}
                    <div className="text-[10px]">
                      <span className="text-white/25">Relevance: </span>
                      <span className="text-emerald-400/60">{result.score}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}

        {hasMore && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full py-1.5 text-[10px] text-sky-400/60 hover:text-sky-300 transition-colors flex items-center justify-center gap-1"
          >
            <ChevronDown size={10} />
            Show {results.length - 5} more
          </button>
        )}

        {showAll && hasMore && (
          <button
            onClick={() => setShowAll(false)}
            className="w-full py-1.5 text-[10px] text-white/30 hover:text-white/50 transition-colors flex items-center justify-center gap-1"
          >
            <ChevronUp size={10} />
            Show less
          </button>
        )}
      </div>
    </motion.div>
  );
};

interface SecurityBadgeProps {
  type: 'safe' | 'warning' | 'danger';
  message: string;
}

const SecurityBadge: React.FC<SecurityBadgeProps> = ({ type, message }) => {
  const colors = {
    safe: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    danger: 'bg-red-500/10 border-red-500/20 text-red-400'
  };

  const icons = {
    safe: <CheckCircle2 size={11} />,
    warning: <AlertTriangle size={11} />,
    danger: <AlertTriangle size={11} />
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border ${colors[type]}`}
    >
      {icons[type]}
      {message}
    </motion.div>
  );
};

interface DOMMetaDisplayProps {
  url: string;
  title: string;
  filterStats: {
    piiRemoved: number;
    scriptsRemoved: number;
    stylesRemoved: number;
    navRemoved: number;
    adsRemoved: number;
  };
  injectionDetected?: boolean;
  timestamp?: number;
}

const DOMMetaDisplay: React.FC<DOMMetaDisplayProps> = ({
  url,
  title,
  filterStats,
  injectionDetected = false,
  timestamp
}) => {
  const hostname = useMemo(() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }, [url]);

  const favicon = useMemo(() => {
    try {
      return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;
    } catch {
      return '';
    }
  }, [url]);

  const openURL = () => {
    try {
      window.electronAPI?.createView?.({ tabId: `meta-${Date.now()}`, url });
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const stats = [
    { count: filterStats.piiRemoved, label: 'PII blocked', color: 'text-red-400 border-red-500/20 bg-red-500/[0.06]' },
    { count: filterStats.scriptsRemoved, label: 'scripts blocked', color: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/[0.06]' },
    { count: filterStats.stylesRemoved, label: 'styles blocked', color: 'text-orange-400 border-orange-500/20 bg-orange-500/[0.06]' },
    { count: filterStats.navRemoved, label: 'nav filtered', color: 'text-blue-400 border-blue-500/20 bg-blue-500/[0.06]' },
  ].filter(s => s.count > 0);

  return (
    <div className="mb-2 px-3.5 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Shield size={12} className="text-violet-400/70" />
          <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Secure DOM Read</span>
        </div>
        <SecurityBadge
          type={injectionDetected ? 'warning' : 'safe'}
          message={injectionDetected ? 'Patterns' : 'Safe'}
        />
      </div>

      <div className="space-y-1">
        {title && (
          <div className="text-[12px] text-white/70 truncate">{title}</div>
        )}
        {url && (
          <button
            onClick={openURL}
            className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-sky-400 transition-colors cursor-pointer"
          >
            {favicon && (
              <img src={favicon} alt="" className="h-3 w-3 shrink-0 rounded-sm"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <span className="truncate">{hostname}</span>
            <ExternalLink size={9} className="shrink-0" />
          </button>
        )}

        {stats.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {stats.map((s, i) => (
              <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded-full border ${s.color}`}>
                {s.count} {s.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(DOMSearchDisplay);
export { DOMSearchDisplay, SecurityBadge, DOMMetaDisplay };
