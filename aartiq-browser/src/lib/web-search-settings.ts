/**
 * Web Search Settings — User-configurable defaults for AI web search behavior.
 * Persisted to localStorage. Read by AIChatSidebar, MCP server, and IPC handlers.
 */

export interface WebSearchSettings {
  maxPages: number;
  maxCharsPerResult: number;
  totalBudget: number;
  defaultDepth: 'summary' | 'full' | 'auto';
  autoSummarize: boolean;
  deduplicateContent: boolean;
  enableQueryRelevance: boolean;
  searchEngine: 'duckduckgo' | 'google';
  lastUpdated: number;
}

export const WEB_SEARCH_DEFAULTS: WebSearchSettings = {
  maxPages: 10,
  maxCharsPerResult: 6000,
  totalBudget: 30000,
  defaultDepth: 'auto',
  autoSummarize: false,
  deduplicateContent: true,
  enableQueryRelevance: true,
  searchEngine: 'duckduckgo',
  lastUpdated: Date.now(),
};

const STORAGE_KEY = 'aartiq_web_search_settings';

let _cached: WebSearchSettings | null = null;

export function getWebSearchSettings(): WebSearchSettings {
  if (_cached) return _cached;
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        _cached = { ...WEB_SEARCH_DEFAULTS, ...parsed } as WebSearchSettings;
        return _cached!;
      }
    }
  } catch {}
  _cached = { ...WEB_SEARCH_DEFAULTS };
  return _cached!;
}

export function updateWebSearchSettings(partial: Partial<WebSearchSettings>): WebSearchSettings {
  const current = getWebSearchSettings();
  const updated: WebSearchSettings = {
    ...current,
    ...partial,
    lastUpdated: Date.now(),
  };
  _cached = updated;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {}
  return updated;
}

export function resetWebSearchSettings(): WebSearchSettings {
  _cached = { ...WEB_SEARCH_DEFAULTS, lastUpdated: Date.now() };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_cached));
    }
  } catch {}
  return _cached;
}

/**
 * Apply override from AI command params, falling back to user settings, then defaults.
 */
export function resolveSearchParams(params: {
  pages?: number;
  maxChars?: number;
  budget?: number;
  depth?: string;
  autoSummarize?: boolean;
  engine?: string;
} = {}): {
  maxPages: number;
  maxCharsPerResult: number;
  totalBudget: number;
  depth: 'summary' | 'full' | 'auto';
  autoSummarize: boolean;
  searchEngine: string;
} {
  const settings = getWebSearchSettings();
  const depth = (params.depth as any) || settings.defaultDepth;
  return {
    maxPages: params.pages ?? settings.maxPages,
    maxCharsPerResult: params.maxChars ?? settings.maxCharsPerResult,
    totalBudget: params.budget ?? settings.totalBudget,
    depth: ['summary', 'full', 'auto'].includes(depth) ? depth : 'auto',
    autoSummarize: params.autoSummarize ?? settings.autoSummarize,
    searchEngine: params.engine || settings.searchEngine,
  };
}
