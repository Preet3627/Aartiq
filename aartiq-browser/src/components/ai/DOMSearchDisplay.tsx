import React, { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ChevronDown, ChevronUp, FileText, Shield, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

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
      case 'ocr': return <FileText size={14} />;
      case 'web': return <Search size={14} />;
      default: return <Shield size={14} />;
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
      case 'ocr': return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
      case 'web': return 'text-sky-400 border-sky-500/30 bg-sky-500/10';
      default: return 'text-violet-400 border-violet-500/30 bg-violet-500/10';
    }
  };

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const highlightMatch = (text: string) => {
    const parts = text.split(/\[\[|\]\]/);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return (
          <mark key={i} className="bg-yellow-500/30 text-yellow-300 px-1 rounded font-bold">
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
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-sky-500/10 to-violet-500/10 border border-white/10"
      >
        <div className="flex items-center gap-3">
          <Loader2 size={16} className="text-sky-400 animate-spin" />
          <span className="text-sm text-white/60">Searching {getTypeLabel().toLowerCase()}...</span>
        </div>
        {query && (
          <div className="mt-2 text-xs text-white/40">
            Query: <span className="text-sky-400 font-mono">"{query}"</span>
          </div>
        )}
      </motion.div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 p-4 rounded-2xl bg-white/5 border border-white/10"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getTypeIcon()}
            <span className="text-sm font-bold text-white/60">{getTypeLabel()}</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="mt-3 text-center text-sm text-white/40">
          No results found for "{query}"
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 rounded-2xl bg-gradient-to-r from-sky-500/5 to-violet-500/5 border border-white/10 overflow-hidden"
    >
      <div className={`flex items-center justify-between p-4 border-b border-white/5 ${getTypeColor()}`}>
        <div className="flex items-center gap-2">
          {getTypeIcon()}
          <span className="text-sm font-bold">{getTypeLabel()}</span>
          <span className="text-xs text-white/40">({results.length} found)</span>
        </div>
        <div className="flex items-center gap-2">
          {timestamp && (
            <span className="text-[10px] text-white/30">{formatTimestamp(timestamp)}</span>
          )}
          {onClose && (
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
        {displayResults.map((result, index) => (
          <motion.div
            key={`${result.xpath}-${index}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`group rounded-xl p-3 transition-all cursor-pointer ${
              expandedIndex === index
                ? 'bg-white/10 border border-white/20'
                : 'bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10'
            }`}
            onClick={() => {
              if (onResultClick) {
                onResultClick(result);
              } else {
                setExpandedIndex(expandedIndex === index ? null : index);
              }
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 bg-white/10 px-2 py-0.5 rounded">
                    {result.tag || 'element'}
                  </span>
                  {result.score >= 30 && (
                    <span className="text-[10px] text-yellow-400 flex items-center gap-1">
                      <span>⭐</span> High Match
                    </span>
                  )}
                </div>
                <div className="text-sm text-white/80 font-mono leading-relaxed">
                  {highlightMatch(result.text)}
                </div>
              </div>
              {expandedIndex !== index && (
                <ChevronDown size={14} className="text-white/30 flex-shrink-0 mt-1" />
              )}
              {expandedIndex === index && (
                <ChevronUp size={14} className="text-white/30 flex-shrink-0 mt-1" />
              )}
            </div>

            <AnimatePresence>
              {expandedIndex === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-3 pt-3 border-t border-white/10"
                >
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-white/40">Context: </span>
                      <span className="text-white/70 font-mono">{result.context}</span>
                    </div>
                    <div>
                      <span className="text-white/40">XPath: </span>
                      <span className="text-sky-400 font-mono select-all">{result.xpath}</span>
                    </div>
                    <div>
                      <span className="text-white/40">Relevance: </span>
                      <span className="text-emerald-400">{result.score}</span>
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
            className="w-full py-2 text-xs text-sky-400 hover:text-sky-300 transition-colors flex items-center justify-center gap-1"
          >
            <ChevronDown size={12} />
            Show {results.length - 5} more results
          </button>
        )}

        {showAll && hasMore && (
          <button
            onClick={() => setShowAll(false)}
            className="w-full py-2 text-xs text-white/40 hover:text-white/60 transition-colors flex items-center justify-center gap-1"
          >
            <ChevronUp size={12} />
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
    safe: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    danger: 'bg-red-500/10 border-red-500/30 text-red-400'
  };

  const icons = {
    safe: <CheckCircle2 size={12} />,
    warning: <AlertTriangle size={12} />,
    danger: <AlertTriangle size={12} />
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${colors[type]}`}
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
  const formatUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '');
    } catch {
      return url;
    }
  };

  return (
    <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-violet-500/5 to-sky-500/5 border border-white/5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-violet-400" />
          <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Secure DOM Read</span>
        </div>
        <SecurityBadge
          type={injectionDetected ? 'warning' : 'safe'}
          message={injectionDetected ? 'Patterns Detected' : 'Filtered & Safe'}
        />
      </div>

      <div className="space-y-2">
        {title && (
          <div className="text-sm font-medium text-white/80 truncate">
            {title}
          </div>
        )}
        {url && (
          <div className="text-xs text-white/40 font-mono truncate">
            {formatUrl(url)}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {filterStats.piiRemoved > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              {filterStats.piiRemoved} PII blocked
            </span>
          )}
          {filterStats.scriptsRemoved > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
              {filterStats.scriptsRemoved} scripts blocked
            </span>
          )}
          {filterStats.stylesRemoved > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
              {filterStats.stylesRemoved} styles blocked
            </span>
          )}
          {filterStats.navRemoved > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {filterStats.navRemoved} nav filtered
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(DOMSearchDisplay);
export { DOMSearchDisplay, SecurityBadge, DOMMetaDisplay };
