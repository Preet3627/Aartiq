// ---------------------------------------------------------------------------
// Event Bus — typed pub/sub event system for decoupled state change
// notifications across components.
// Inspired by veto-browse's event/manager.ts.
// ---------------------------------------------------------------------------

export interface AgentEvent {
  actor: string;
  state: string;
  data?: unknown;
  timestamp: number;
  type: string;
}

export type EventListener = (event: AgentEvent) => void | Promise<void>;

// ---------------------------------------------------------------------------
// EventBus class
// ---------------------------------------------------------------------------

export class EventBus {
  private listeners: Map<string, Set<EventListener>>;
  private wildcardListeners: Set<EventListener>;
  private history: AgentEvent[];
  private maxHistory: number;

  constructor(maxHistory: number = 100) {
    this.listeners = new Map();
    this.wildcardListeners = new Set();
    this.history = [];
    this.maxHistory = maxHistory;
  }

  /**
   * Subscribe to a specific event type.
   */
  on(eventType: string, listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * Subscribe to all events (wildcard).
   */
  onAny(listener: EventListener): () => void {
    this.wildcardListeners.add(listener);
    return () => {
      this.wildcardListeners.delete(listener);
    };
  }

  /**
   * Subscribe to an event, but only fire once.
   */
  once(eventType: string, listener: EventListener): void {
    const wrapped: EventListener = (event) => {
      listener(event);
      this.off(eventType, wrapped);
    };
    this.on(eventType, wrapped);
  }

  /**
   * Remove a specific listener from an event type.
   */
  off(eventType: string, listener: EventListener): void {
    this.listeners.get(eventType)?.delete(listener);
  }

  /**
   * Emit an event to all subscribers.
   */
  async emit(type: string, actor: string, state: string, data?: unknown): Promise<void> {
    const event: AgentEvent = {
      type,
      actor,
      state,
      data,
      timestamp: Date.now(),
    };

    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    const typeListeners = this.listeners.get(type);
    const promises: Promise<void>[] = [];

    if (typeListeners) {
      for (const listener of typeListeners) {
        const result = listener(event);
        if (result instanceof Promise) {
          promises.push(result);
        }
      }
    }

    for (const listener of this.wildcardListeners) {
      const result = listener(event);
      if (result instanceof Promise) {
        promises.push(result);
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /**
   * Emit a synchronous event (fire-and-forget, no awaiting).
   */
  emitSync(type: string, actor: string, state: string, data?: unknown): void {
    const event: AgentEvent = {
      type,
      actor,
      state,
      data,
      timestamp: Date.now(),
    };

    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        listener(event);
      }
    }

    for (const listener of this.wildcardListeners) {
      listener(event);
    }
  }

  /**
   * Remove all listeners for a given event type.
   */
  clearListeners(eventType?: string): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
      this.wildcardListeners.clear();
    }
  }

  /**
   * Get the event history.
   */
  getHistory(eventType?: string): AgentEvent[] {
    if (eventType) {
      return this.history.filter(e => e.type === eventType);
    }
    return [...this.history];
  }

  /**
   * Get the count of listeners per event type.
   */
  listenerCount(eventType?: string): number {
    if (eventType) {
      return this.listeners.get(eventType)?.size || 0;
    }
    let count = this.wildcardListeners.size;
    for (const listeners of this.listeners.values()) {
      count += listeners.size;
    }
    return count;
  }

  /**
   * Clear all state (listeners + history).
   */
  reset(): void {
    this.listeners.clear();
    this.wildcardListeners.clear();
    this.history = [];
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

const globalEventBus = new EventBus();

export function getEventBus(): EventBus {
  return globalEventBus;
}
