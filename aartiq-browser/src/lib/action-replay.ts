// ---------------------------------------------------------------------------
// Action Replay — replay saved action sequences with retry logic and
// element index remapping. Handles page state changes between replays.
// Inspired by veto-browse's dom/history/service.ts.
// ---------------------------------------------------------------------------

export interface RecordedAction {
  id: string;
  type: string;
  target: string;
  value?: string;
  selector?: string;
  elementHash?: string;
  coordinates?: { x: number; y: number };
  timestamp: number;
  url: string;
  metadata?: Record<string, unknown>;
}

export interface ReplaySession {
  id: string;
  actions: RecordedAction[];
  startUrl: string;
  createdAt: number;
  replayCount: number;
}

export type ActionExecutorFn = (
  action: RecordedAction,
  match?: ElementMatch
) => Promise<ReplayActionResult>;

export interface ReplayActionResult {
  success: boolean;
  error?: string;
  durationMs: number;
  retryAttempt: number;
}

export interface ReplayOptions {
  maxRetries: number;
  baseDelayMs: number;
  requireElementMatch: boolean;
}

export interface ElementMatch {
  confidence: 'exact' | 'similar' | 'fuzzy' | 'none';
  matchedSelector?: string;
  matchedBy?: string;
}

const DEFAULT_OPTIONS: ReplayOptions = {
  maxRetries: 3,
  baseDelayMs: 500,
  requireElementMatch: true,
};

// ---------------------------------------------------------------------------
// Element hash generation (for remapping across page state changes)
// ---------------------------------------------------------------------------

export function generateElementHash(
  tagName: string,
  textContent: string,
  attributes: Record<string, string>,
  parentSelectors: string[] = []
): string {
  const parts = [
    tagName.toLowerCase(),
    textContent?.slice(0, 100).trim() || '',
    Object.entries(attributes || {})
      .filter(([k]) => ['id', 'class', 'name', 'type', 'href', 'src', 'aria-label', 'data-testid', 'role'].includes(k))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('|'),
    parentSelectors.slice(-3).join(' > '),
  ];
  return parts.filter(Boolean).join('::');
}

// ---------------------------------------------------------------------------
// Element matching (find the best match for a recorded element)
// ---------------------------------------------------------------------------

export function matchElement(
  recordedHash: string,
  currentElements: Array<{ hash: string; selector: string; matchBy: string }>
): ElementMatch {
  // 1. Exact match
  const exact = currentElements.find(e => e.hash === recordedHash);
  if (exact) {
    return {
      confidence: 'exact',
      matchedSelector: exact.selector,
      matchedBy: 'full hash',
    };
  }

  // 2. Similar match (tag + id match)
  const [tag] = recordedHash.split('::');
  const similar = currentElements.find(e => {
    const [eTag] = e.hash.split('::');
    return eTag === tag && e.hash.includes('id=');
  });
  if (similar) {
    return {
      confidence: 'similar',
      matchedSelector: similar.selector,
      matchedBy: 'tag + id',
    };
  }

  // 3. Fuzzy match (tag + text match)
  if (tag) {
    const fuzzy = currentElements.find(e => {
      const [eTag] = e.hash.split('::');
      const eText = e.hash.split('::')[1] || '';
      const text = recordedHash.split('::')[1] || '';
      return eTag === tag && text && eText && (
        text.includes(eText) || eText.includes(text)
      );
    });
    if (fuzzy) {
      return {
        confidence: 'fuzzy',
        matchedSelector: fuzzy.selector,
        matchedBy: 'tag + text',
      };
    }
  }

  return { confidence: 'none' };
}

// ---------------------------------------------------------------------------
// Replay engine
// ---------------------------------------------------------------------------

export class ActionReplayEngine {
  private options: ReplayOptions;
  private sessions: Map<string, ReplaySession>;
  private actionExecutors: Map<string, ActionExecutorFn>;

  constructor(options: Partial<ReplayOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.sessions = new Map();
    this.actionExecutors = new Map();
  }

  registerExecutor(actionType: string, executor: ActionExecutorFn): void {
    this.actionExecutors.set(actionType, executor);
  }

  createSession(actions: RecordedAction[], startUrl: string): string {
    const id = `replay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const session: ReplaySession = {
      id,
      actions,
      startUrl,
      createdAt: Date.now(),
      replayCount: 0,
    };
    this.sessions.set(id, session);
    return id;
  }

  getSession(sessionId: string): ReplaySession | undefined {
    return this.sessions.get(sessionId);
  }

  async replaySession(
    sessionId: string,
    currentElements?: Array<{ hash: string; selector: string; matchBy: string }>
  ): Promise<ReplayActionResult[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Replay session not found: ${sessionId}`);
    }

    session.replayCount++;
    const results: ReplayActionResult[] = [];

    for (const action of session.actions) {
      let elementMatch: ElementMatch | undefined;

      if (currentElements && action.elementHash) {
        elementMatch = matchElement(action.elementHash, currentElements);
      }

      const executor = this.actionExecutors.get(action.type);
      if (!executor) {
        results.push({
          success: false,
          error: `No executor registered for action type: ${action.type}`,
          durationMs: 0,
          retryAttempt: 0,
        });
        continue;
      }

      let lastError: string | undefined;
      for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
        if (attempt > 0) {
          await this.delay(this.options.baseDelayMs * Math.pow(2, attempt - 1));
        }

        try {
          const result = await executor(action, elementMatch);
          result.retryAttempt = attempt;
          results.push(result);

          if (result.success) break;

          lastError = result.error;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);

          if (attempt >= this.options.maxRetries) {
            results.push({
              success: false,
              error: lastError,
              durationMs: 0,
              retryAttempt: attempt,
            });
          }
        }
      }
    }

    return results;
  }

  async replayActions(
    actions: RecordedAction[],
    startUrl: string,
    currentElements?: Array<{ hash: string; selector: string; matchBy: string }>
  ): Promise<{ sessionId: string; results: ReplayActionResult[] }> {
    const sessionId = this.createSession(actions, startUrl);
    const results = await this.replaySession(sessionId, currentElements);
    return { sessionId, results };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
