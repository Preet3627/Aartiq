'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ResearchSource {
  name: string;
  favicon?: string;
  url: string;
  articleCount: number;
  avgScore: number;
  used: boolean;
}

interface ResearchSourceCardProps {
  source: ResearchSource;
  index: number;
}

export function ResearchSourceCard({ source, index }: ResearchSourceCardProps) {
  const scoreColor = source.avgScore >= 90 ? 'text-emerald-400' : source.avgScore >= 70 ? 'text-sky-400' : source.avgScore >= 50 ? 'text-amber-400' : 'text-zinc-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/8 transition-colors cursor-pointer group min-w-[160px] max-w-[220px] shrink-0"
      onClick={() => window.open(source.url, '_blank')}
    >
      <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
        {source.favicon ? (
          <img
            src={source.favicon}
            alt=""
            className="w-4 h-4 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <span className="text-[10px] text-zinc-400 font-medium">{source.name.charAt(0)}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-zinc-200 truncate">{source.name}</div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-500">{source.articleCount} {source.articleCount === 1 ? 'article' : 'articles'}</span>
          {source.used && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">Used</span>
          )}
        </div>
      </div>
      <div className={`text-[10px] font-mono font-bold ${scoreColor} shrink-0`}>
        {source.avgScore}
      </div>
    </motion.div>
  );
}

interface ResearchSourceCarouselProps {
  sources: ResearchSource[];
}

export function ResearchSourceCarousel({ sources }: ResearchSourceCarouselProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Sources</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-zinc-300">{sources.length}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent" style={{ scrollbarWidth: 'thin' }}>
        {sources.map((source, i) => (
          <ResearchSourceCard key={`${source.name}-${i}`} source={source} index={i} />
        ))}
      </div>
    </div>
  );
}
