"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Check, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { getWebSearchSettings, type WebSearchSettings } from '@/lib/web-search-settings';

interface SettingsChange {
  category: string;
  key: string;
  oldValue: any;
  newValue: any;
  description?: string;
}

interface SettingsApprovalPanelProps {
  changes: SettingsChange[];
  onApprove: () => void;
  onDeny: () => void;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  webSearch: 'Web Search',
  ai: 'AI Behavior',
  ui: 'Interface',
};

const SETTING_DESCRIPTIONS: Record<string, Record<string, string>> = {
  webSearch: {
    maxPages: 'Number of websites to scrape from search results',
    maxCharsPerResult: 'Max characters extracted per page',
    totalBudget: 'Total character budget across all results',
    defaultDepth: 'Content extraction depth per page',
    autoSummarize: 'Pre-summarize content before returning',
    deduplicateContent: 'Remove duplicate sentences from content',
    enableQueryRelevance: 'Score paragraphs by relevance to query',
    searchEngine: 'Default search engine',
  },
  ai: {
    maxTokens: 'Max tokens for AI responses',
    temperature: 'AI creativity level (0-1)',
    autoApproveLowRisk: 'Auto-approve low-risk actions',
  },
  ui: {
    theme: 'App theme',
    compactMode: 'Compact UI mode',
  },
};

function formatValue(val: any): string {
  if (typeof val === 'boolean') return val ? 'Enabled' : 'Disabled';
  if (typeof val === 'number') return val.toLocaleString();
  return String(val);
}

function getRiskLevel(change: SettingsChange): 'low' | 'medium' | 'high' {
  if (change.category === 'ai' && change.key === 'autoApproveLowRisk' && change.newValue === true) return 'high';
  if (change.category === 'webSearch' && change.key === 'maxPages' && typeof change.newValue === 'number' && change.newValue > 15) return 'medium';
  if (change.category === 'webSearch' && change.key === 'totalBudget' && typeof change.newValue === 'number' && change.newValue > 50000) return 'medium';
  return 'low';
}

const RISK_COLORS = {
  low: 'text-green-400 bg-green-400/10 border-green-400/20',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  high: 'text-red-400 bg-red-400/10 border-red-400/20',
};

export default function SettingsApprovalPanel({ changes, onApprove, onDeny, onClose }: SettingsApprovalPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const maxRisk = changes.reduce((max, c) => {
    const r = getRiskLevel(c);
    if (r === 'high') return 'high';
    if (r === 'medium' && max !== 'high') return 'medium';
    return max;
  }, 'low' as string);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="rounded-xl border border-zinc-700/50 bg-zinc-900/95 backdrop-blur-xl shadow-2xl overflow-hidden max-w-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/50">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-zinc-100">Settings Change Request</span>
        </div>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Risk Banner */}
      <div className={`mx-4 mt-3 px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-2 ${RISK_COLORS[maxRisk as keyof typeof RISK_COLORS]}`}>
        <AlertTriangle className="w-3.5 h-3.5" />
        {maxRisk === 'high' && 'High-risk change — requires careful review'}
        {maxRisk === 'medium' && 'Medium-risk change — may affect performance'}
        {maxRisk === 'low' && 'Low-risk change — safe to approve'}
      </div>

      {/* Changes List */}
      <div className="px-4 py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors mb-2"
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {changes.length} change{changes.length !== 1 ? 's' : ''} proposed
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-2 overflow-hidden"
            >
              {changes.map((change, i) => (
                <div key={i} className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-500 mb-0.5">
                        {CATEGORY_LABELS[change.category] || change.category}
                      </div>
                      <div className="text-sm font-medium text-zinc-200 truncate">
                        {SETTING_DESCRIPTIONS[change.category]?.[change.key] || change.key}
                      </div>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${RISK_COLORS[getRiskLevel(change)]}`}>
                      {getRiskLevel(change).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <span className="text-zinc-500 bg-zinc-800 rounded px-2 py-0.5 line-through">
                      {formatValue(change.oldValue)}
                    </span>
                    <span className="text-zinc-400">→</span>
                    <span className="text-blue-400 bg-blue-400/10 rounded px-2 py-0.5 font-medium">
                      {formatValue(change.newValue)}
                    </span>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-zinc-700/50 bg-zinc-900/50">
        <button
          onClick={onDeny}
          className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors"
        >
          Deny
        </button>
        <button
          onClick={onApprove}
          className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center justify-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          Approve
        </button>
      </div>
    </motion.div>
  );
}
