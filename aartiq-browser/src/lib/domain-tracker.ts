// ---------------------------------------------------------------------------
// Domain Time Tracker — per-domain cumulative agent time tracking.
// Enables time-based rules like "block social media after 20 minutes".
// Inspired by veto-browse's domain-time-tracker.ts.
// ---------------------------------------------------------------------------

export interface DomainTimeEntry {
  domain: string;
  totalMs: number;
  currentSessionMs: number;
  sessionStart: number | null;
  lastUpdated: number;
}

const STORAGE_KEY = 'aartiq_domain_time_tracker';
const MAX_DOMAINS = 100;

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function loadEntries(): Map<string, DomainTimeEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Map();
    return new Map(parsed.map((e: DomainTimeEntry) => [e.domain, e]));
  } catch {
    return new Map();
  }
}

function saveEntries(entries: Map<string, DomainTimeEntry>): void {
  try {
    const arr = Array.from(entries.values());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    console.warn('[DomainTracker] Failed to save entries');
  }
}

// ---------------------------------------------------------------------------
// Session tracking (in-memory, scoped to current automation task)
// ---------------------------------------------------------------------------

const sessionStartTimes = new Map<string, number>();

// ---------------------------------------------------------------------------
// DomainTracker class
// ---------------------------------------------------------------------------

export class DomainTracker {
  private entries: Map<string, DomainTimeEntry>;
  private taskId: string;

  constructor(taskId?: string) {
    this.entries = loadEntries();
    this.taskId = taskId || `task-${Date.now()}`;
  }

  // Start tracking time on a domain
  startDomain(domain: string): void {
    const cleaned = cleanDomain(domain);
    if (!cleaned) return;

    const now = Date.now();

    // Track session start (in-memory, resets per task)
    sessionStartTimes.set(cleaned, now);

    let entry = this.entries.get(cleaned);
    if (!entry) {
      entry = {
        domain: cleaned,
        totalMs: 0,
        currentSessionMs: 0,
        sessionStart: now,
        lastUpdated: now,
      };
      this.entries.set(cleaned, entry);
    } else {
      entry.sessionStart = now;
      entry.lastUpdated = now;
    }

    // Enforce max domains
    if (this.entries.size > MAX_DOMAINS) {
      const oldest = Array.from(this.entries.entries())
        .sort(([, a], [, b]) => a.lastUpdated - b.lastUpdated)[0];
      if (oldest) this.entries.delete(oldest[0]);
    }

    saveEntries(this.entries);
  }

  // Stop tracking time on a domain (call when navigating away)
  stopDomain(domain: string): void {
    const cleaned = cleanDomain(domain);
    if (!cleaned) return;

    const entry = this.entries.get(cleaned);
    if (!entry || !entry.sessionStart) return;

    const elapsed = Date.now() - entry.sessionStart;
    entry.totalMs += elapsed;
    entry.currentSessionMs += elapsed;
    entry.sessionStart = null;
    entry.lastUpdated = Date.now();

    sessionStartTimes.delete(cleaned);
    saveEntries(this.entries);
  }

  // Get cumulative time for a domain (including live session)
  getDomainTimeMs(domain: string): number {
    const cleaned = cleanDomain(domain);
    if (!cleaned) return 0;

    const entry = this.entries.get(cleaned);
    if (!entry) return 0;

    let total = entry.totalMs;
    if (entry.sessionStart) {
      total += Date.now() - entry.sessionStart;
    }
    return total;
  }

  getDomainTimeMinutes(domain: string): number {
    return Math.round(this.getDomainTimeMs(domain) / 60000 * 10) / 10;
  }

  // Get current session time for a domain
  getSessionTimeMs(domain: string): number {
    const cleaned = cleanDomain(domain);
    if (!cleaned) return 0;

    const start = sessionStartTimes.get(cleaned);
    if (!start) {
      const entry = this.entries.get(cleaned);
      return entry?.currentSessionMs || 0;
    }
    return Date.now() - start;
  }

  // Get all tracked domains sorted by total time (descending)
  getAllDomains(): DomainTimeEntry[] {
    // Update live session times
    for (const entry of this.entries.values()) {
      if (entry.sessionStart) {
        entry.currentSessionMs = Date.now() - entry.sessionStart;
      }
    }
    return Array.from(this.entries.values())
      .sort((a, b) => b.totalMs + b.currentSessionMs - a.totalMs - a.currentSessionMs);
  }

  // Reset session times (call at start of each automation task)
  resetSession(): void {
    sessionStartTimes.clear();
    for (const entry of this.entries.values()) {
      entry.currentSessionMs = 0;
      entry.sessionStart = null;
    }
    saveEntries(this.entries);
  }

  // Clear all tracked data
  clearAll(): void {
    this.entries.clear();
    sessionStartTimes.clear();
    saveEntries(this.entries);
  }

  // Remove a specific domain
  removeDomain(domain: string): void {
    const cleaned = cleanDomain(domain);
    this.entries.delete(cleaned);
    sessionStartTimes.delete(cleaned);
    saveEntries(this.entries);
  }

  // Get summary for policy engine
  getPolicyContext(domain: string): { timeElapsedMinutes: number; timeElapsedMs: number } {
    const minutes = this.getDomainTimeMinutes(domain);
    return {
      timeElapsedMinutes: minutes,
      timeElapsedMs: this.getDomainTimeMs(domain),
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cleanDomain(domain: string): string {
  if (!domain) return '';
  return domain
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .trim();
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let globalTracker: DomainTracker | null = null;

export function getDomainTracker(taskId?: string): DomainTracker {
  if (!globalTracker || taskId) {
    globalTracker = new DomainTracker(taskId);
  }
  return globalTracker;
}

export function resetDomainTracker(): void {
  globalTracker = null;
}

export { cleanDomain };
