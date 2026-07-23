'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ResearchSource {
  name: string;
  title?: string;
  favicon?: string;
  url: string;
  articleCount: number;
  avgScore: number;
  used: boolean;
  qualityReasons?: string[];
  domainScore?: number;
  extractionQuality?: number;
  publicationDate?: string;
  updatedDate?: string;
}

interface ResearchSourceCardProps {
  source: ResearchSource;
  index: number;
}

function displayText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object') {
    const maybeLink = value as { title?: unknown; url?: unknown; name?: unknown };
    return displayText(maybeLink.title || maybeLink.name || maybeLink.url, fallback);
  }
  return fallback;
}

function displayUrl(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    return displayText((value as { url?: unknown; title?: unknown }).url || (value as { title?: unknown }).title);
  }
  return '';
}

function sourceKey(source: ResearchSource, index: number): string {
  return ['research-source', displayText(source.name), displayUrl(source.url), index].filter(Boolean).join('-');
}

export function ResearchSourceCard({ source, index }: ResearchSourceCardProps) {
  const sourceName = displayText(source.name, 'Source');
  const sourceTitle = displayText(source.title, sourceName);
  const sourceUrl = displayUrl(source.url);
  const host = sourceUrl ? new URL(sourceUrl).hostname.replace(/^www\./, '') : sourceName;
  const scoreColor = source.avgScore >= 90 ? 'border-emerald-400/70' : source.avgScore >= 70 ? 'border-sky-400/70' : source.avgScore >= 50 ? 'border-amber-400/70' : 'border-zinc-500/70';
  const reasons = (source.qualityReasons || []).slice(0, 3);
  const title = `${sourceTitle}\n${sourceUrl}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={`group relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border bg-white/[0.035] transition-colors hover:bg-white/[0.07] ${scoreColor}`}
      onClick={() => sourceUrl && window.open(sourceUrl, '_blank')}
      title={title}
      role="link"
      tabIndex={0}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && sourceUrl) {
          event.preventDefault();
          window.open(sourceUrl, '_blank');
        }
      }}
    >
      <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded bg-white/10">
        {source.favicon ? (
          <img
            src={source.favicon}
            alt=""
            className="w-4 h-4 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <span className="text-[10px] text-zinc-400 font-medium">{sourceName.charAt(0)}</span>
        )}
      </div>
      {source.used && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-64 -translate-x-1/2 rounded-lg border border-white/10 bg-zinc-950/95 p-3 text-left shadow-2xl shadow-black/40 backdrop-blur group-hover:block">
        <div className="truncate text-xs font-semibold text-zinc-100">{sourceTitle}</div>
        <div className="mt-1 truncate text-[10px] text-zinc-500">{host}</div>
        <div className="mt-2 flex items-center gap-2 text-[10px] text-zinc-400">
          <span>{source.articleCount} {source.articleCount === 1 ? 'article' : 'articles'}</span>
          <span>Score {source.avgScore}</span>
          {source.publicationDate && <span>{source.publicationDate}</span>}
        </div>
        {reasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {reasons.map((reason, reasonIndex) => (
              <span key={`${sourceName}-reason-${reasonIndex}`} className="rounded bg-white/8 px-1.5 py-0.5 text-[9px] text-zinc-400">
                {displayText(reason)}
              </span>
            ))}
          </div>
        )}
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
    <div className="mb-3 min-w-0">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Sources</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-zinc-300">{sources.length}</span>
      </div>
      <div className="flex min-w-0 flex-wrap gap-2">
        {sources.map((source, i) => (
          <ResearchSourceCard key={sourceKey(source, i)} source={source} index={i} />
        ))}
      </div>
    </div>
  );
}
