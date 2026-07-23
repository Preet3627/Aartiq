'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ReportSection {
  id: string;
  title: string;
  icon: string;
  content: React.ReactNode;
  isCollapsible?: boolean;
}

interface ResearchReportProps {
  title: string;
  subtitle?: string;
  executiveSummary?: string;
  keyTakeaways?: string[];
  sections: ReportSection[];
  sources?: Array<{ name: string; url: string; favicon?: string; score?: number; articleCount?: number }>;
  contradictions?: Array<{ type: string; claim1: { source: string; text: string }; claim2: { source: string; text: string }; ratio?: string }>;
  methodology?: string[];
}

function displayText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (React.isValidElement(value)) return fallback;
  if (value && typeof value === 'object') {
    const maybeLink = value as { title?: unknown; url?: unknown; name?: unknown; text?: unknown };
    return displayText(maybeLink.title || maybeLink.name || maybeLink.text || maybeLink.url, fallback);
  }
  return fallback;
}

function displayNode(value: React.ReactNode): React.ReactNode {
  if (React.isValidElement(value) || Array.isArray(value)) return value;
  if (value && typeof value === 'object') return displayText(value);
  return value;
}

function displayUrl(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    return displayText((value as { url?: unknown; title?: unknown }).url || (value as { title?: unknown }).title);
  }
  return '';
}

function sectionKey(section: ReportSection, index: number): string {
  return ['report-section', displayText(section.id), displayText(section.title), index].filter(Boolean).join('-');
}

function sourceKey(source: NonNullable<ResearchReportProps['sources']>[0], index: number): string {
  return ['report-source', displayText(source.name), displayUrl(source.url), index].filter(Boolean).join('-');
}

function TOCItem({ section, onClick }: { section: ReportSection; onClick: () => void }) {
  const icon = displayText(section.icon);
  const title = displayText(section.title, 'Section');

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-left hover:bg-white/5 transition-colors w-full text-xs text-zinc-400 hover:text-zinc-200"
    >
      <span className="text-sm">{icon}</span>
      <span className="truncate">{title}</span>
    </button>
  );
}

function SourceCard({ source, index }: { source: NonNullable<ResearchReportProps['sources']>[0]; index: number }) {
  const sourceName = displayText(source.name, 'Source');
  const sourceUrl = displayUrl(source.url);
  const domain = (() => { try { return new URL(sourceUrl).hostname.replace('www.', ''); } catch { return sourceName; } })();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors cursor-pointer"
      onClick={() => sourceUrl && window.open(sourceUrl, '_blank')}
    >
      <div className="w-6 h-6 rounded bg-white/8 flex items-center justify-center overflow-hidden shrink-0">
        {source.favicon ? (
          <img src={source.favicon} alt="" className="w-4 h-4 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <span className="text-[10px] text-zinc-400">{sourceName.charAt(0)}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-zinc-200 truncate">{sourceName}</div>
        <div className="text-[10px] text-zinc-600 truncate">{domain}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {source.articleCount && source.articleCount > 1 && (
          <span className="text-[10px] text-zinc-500">{source.articleCount} articles</span>
        )}
        {source.score !== undefined && (
          <span className={`text-[10px] font-mono font-bold ${
            source.score >= 90 ? 'text-emerald-400' : source.score >= 70 ? 'text-sky-400' : 'text-zinc-400'
          }`}>{source.score}</span>
        )}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-zinc-600">
          <path d="M3 7L7 3M7 3H4M7 3V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </motion.div>
  );
}

export function ResearchReport({
  title, subtitle, executiveSummary, keyTakeaways, sections, sources, contradictions, methodology
}: ResearchReportProps) {
  const [showTOC, setShowTOC] = useState(false);
  const reportTitle = displayText(title, 'Research Report');
  const reportSubtitle = displayText(subtitle);
  const summary = displayText(executiveSummary);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-lg font-bold text-zinc-100 leading-tight">{reportTitle}</h1>
        {reportSubtitle && <p className="text-xs text-zinc-500">{reportSubtitle}</p>}
      </div>

      {/* Executive Summary */}
      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-sky-500/5 border border-sky-500/15 px-4 py-3"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm">📋</span>
            <span className="text-xs font-semibold text-sky-300 uppercase tracking-wider">Executive Summary</span>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">{summary}</p>
        </motion.div>
      )}

      {/* Key Takeaways */}
      {keyTakeaways && keyTakeaways.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 px-4 py-3"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">🎯</span>
            <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Key Takeaways</span>
          </div>
          <ol className="space-y-1.5">
            {keyTakeaways.map((t, i) => (
              <li key={i} className="flex gap-2 text-xs text-zinc-300">
                <span className="text-emerald-400/60 font-mono shrink-0">{i + 1}.</span>
                <span className="leading-relaxed">{displayText(t)}</span>
              </li>
            ))}
          </ol>
        </motion.div>
      )}

      {/* Table of Contents */}
      {sections.length > 3 && (
        <div className="rounded-xl border border-white/5 overflow-hidden">
          <button
            onClick={() => setShowTOC(!showTOC)}
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.03] transition-colors"
          >
            <span className="text-xs font-medium text-zinc-400">Table of Contents</span>
            <motion.div animate={{ rotate: showTOC ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-zinc-500">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>
          </button>
          <AnimatePresence>
            {showTOC && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="px-2 pb-2 space-y-0.5">
                  {sections.map((s, i) => (
                    <TOCItem key={sectionKey(s, i)} section={s} onClick={() => { setShowTOC(false); }} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Content Sections */}
      {sections.map((section, i) => (
        <motion.div
          key={sectionKey(section, i)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="rounded-xl border border-white/5 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-sm">{displayText(section.icon)}</span>
              <span className="text-sm font-semibold text-zinc-200">{displayText(section.title, 'Section')}</span>
            </div>
          </div>
          <div className="px-4 py-3 text-xs text-zinc-300 leading-relaxed space-y-2">
            {displayNode(section.content)}
          </div>
        </motion.div>
      ))}

      {/* Contradictions */}
      {contradictions && contradictions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-amber-500/15 bg-amber-500/5 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-amber-500/10">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚠️</span>
              <span className="text-sm font-semibold text-amber-300">Contradictions Detected</span>
            </div>
          </div>
          <div className="px-4 py-3 space-y-3">
            {contradictions.map((c, i) => (
              <div key={i} className="space-y-1">
                <div className="text-[10px] font-medium text-amber-400/80 uppercase tracking-wider">{displayText(c.type).replace(/_/g, ' ')}</div>
                <div className="text-xs text-zinc-400">
                  <span className="text-zinc-300">{displayText(c.claim1.source)}</span>: &ldquo;{displayText(c.claim1.text)}&rdquo;
                </div>
                <div className="text-xs text-zinc-400">
                  <span className="text-zinc-300">{displayText(c.claim2.source)}</span>: &ldquo;{displayText(c.claim2.text)}&rdquo;
                </div>
                {c.ratio && <div className="text-[10px] text-amber-400/60">Discrepancy: {displayText(c.ratio)}x</div>}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Sources */}
      {sources && sources.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/5 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-sm">📚</span>
              <span className="text-sm font-semibold text-zinc-200">Sources</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-zinc-400">{sources.length}</span>
            </div>
          </div>
          <div className="px-3 py-2 space-y-1">
            {sources.map((source, i) => (
              <SourceCard key={sourceKey(source, i)} source={source} index={i} />
            ))}
          </div>
        </motion.div>
      )}

      {/* Methodology */}
      {methodology && methodology.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/5 px-4 py-3"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">📊</span>
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Methodology</span>
          </div>
          <ul className="space-y-1">
            {methodology.map((m, i) => (
              <li key={i} className="text-[11px] text-zinc-500 flex items-start gap-1.5">
                <span className="text-zinc-600 mt-0.5">·</span>
                <span>{displayText(m)}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </motion.div>
  );
}
