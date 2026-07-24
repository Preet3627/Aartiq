// ---------------------------------------------------------------------------
// Entity Extractor — regex-based extraction of structured data from page content
// Used as context for policy evaluation and content-aware automation.
// Inspired by veto-browse's content-extractor.ts.
// ---------------------------------------------------------------------------

export type EntityType =
  | 'price'
  | 'email'
  | 'phone'
  | 'salary'
  | 'ssn'
  | 'credit_card'
  | 'api_key'
  | 'crypto_address'
  | 'url'
  | 'ip_address';

export interface ExtractedEntity {
  type: EntityType;
  value: string;
  context?: string;
  confidence: 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// Regex patterns per entity type
// ---------------------------------------------------------------------------

const PATTERNS: Record<EntityType, RegExp> = {
  price: /(?:\$|€|£|¥|₹|₩|₽|₱|₿|USD|EUR|GBP|INR)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  phone: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g,
  salary: /\b(?:salary|pay|compensation|annual|yearly|monthly|hourly|wage|stipend)\s*(?::|is|of)?\s*(?:\$|€|£|₹)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:k|K|(?:\/|\s*per\s*)(?:year|yr|month|hour|hr|annum))?/gi,
  ssn: /\b(?:\d{3}-\d{2}-\d{4}|\d{9})\b/g,
  credit_card: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  api_key: /\b(?:sk-|pk-|api[-_]?key|apikey|secret[-_]?key|access[-_]?token|auth[-_]?token|bearer)\s*[:=]\s*['"]?([A-Za-z0-9_-]{16,64})['"]?\b/gi,
  crypto_address: /\b(?:0x[a-fA-F0-9]{40}|bc1[a-zA-Z0-9]{25,39}|1[a-zA-Z0-9]{24,33}|3[a-zA-Z0-9]{24,33})\b/g,
  url: /\bhttps?:\/\/[^\s<>"']+[^\s<>"',.;:!?)]/g,
  ip_address: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
};

// ---------------------------------------------------------------------------
// LRU cache per URL
// ---------------------------------------------------------------------------

const cache = new Map<string, ExtractedEntity[]>();
const MAX_CACHE_ENTRIES = 20;

function cacheResult(url: string, entities: ExtractedEntity[]): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(url, entities);
}

function getCached(url: string): ExtractedEntity[] | undefined {
  return cache.get(url);
}

export function clearCache(): void {
  cache.clear();
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

export interface ExtractOptions {
  maxInputChars?: number;
  types?: EntityType[];
  deduplicate?: boolean;
}

const DEFAULT_OPTIONS: ExtractOptions = {
  maxInputChars: 200000,
  deduplicate: true,
};

export function extractEntities(
  content: string,
  url?: string,
  options: ExtractOptions = {}
): ExtractedEntity[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Check cache
  if (url) {
    const cached = getCached(url);
    if (cached) return cached;
  }

  const truncated = content.slice(0, opts.maxInputChars);
  const types = opts.types || (Object.keys(PATTERNS) as EntityType[]);

  const results: ExtractedEntity[] = [];

  for (const type of types) {
    const pattern = PATTERNS[type];
    if (!pattern) continue;

    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(truncated)) !== null) {
      const value = match[0].trim();
      if (!value) continue;

      const before = truncated.slice(Math.max(0, match.index - 40), match.index).trim();
      const after = truncated.slice(match.index + match[0].length, match.index + match[0].length + 40).trim();

      results.push({
        type,
        value,
        context: before || after ? `${before ? '...' + before : ''} ${value} ${after ? after + '...' : ''}`.trim() : undefined,
        confidence: getConfidence(type, value),
      });
    }
  }

  const finalResults = opts.deduplicate ? deduplicate(results) : results;

  if (url) {
    cacheResult(url, finalResults);
  }

  return finalResults;
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

function deduplicate(entities: ExtractedEntity[]): ExtractedEntity[] {
  const seen = new Set<string>();
  return entities.filter(e => {
    const key = `${e.type}:${e.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Confidence scoring
// ---------------------------------------------------------------------------

function getConfidence(type: EntityType, value: string): 'high' | 'medium' | 'low' {
  switch (type) {
    case 'email':
      return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,3}$/.test(value) ? 'high' : 'medium';

    case 'credit_card':
      return luhnCheck(value.replace(/[\s-]/g, '')) ? 'high' : 'medium';

    case 'ssn':
      return /^\d{3}-\d{2}-\d{4}$/.test(value) ? 'high' : 'medium';

    case 'api_key':
      return value.length >= 32 ? 'high' : 'medium';

    case 'ip_address':
      return isValidIP(value) ? 'high' : 'low';

    default:
      return 'medium';
  }
}

function luhnCheck(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function isValidIP(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => {
    const n = parseInt(p, 10);
    return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p;
  });
}

// ---------------------------------------------------------------------------
// Summary helpers
// ---------------------------------------------------------------------------

export function summarizeEntities(entities: ExtractedEntity[]): string {
  if (entities.length === 0) return '';

  const byType = new Map<EntityType, ExtractedEntity[]>();
  for (const e of entities) {
    const arr = byType.get(e.type) || [];
    arr.push(e);
    byType.set(e.type, arr);
  }

  const parts: string[] = [];
  for (const [type, items] of byType) {
    parts.push(`${items.length} ${type.replace(/_/g, ' ')}(s)`);
  }

  return `Found ${entities.length} entity(ies): ${parts.join(', ')}`;
}

export function getEntitySummaryForPolicy(entities: ExtractedEntity[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const e of entities) {
    summary[e.type] = (summary[e.type] || 0) + 1;
  }
  return summary;
}
