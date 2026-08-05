/**
 * Spark Media OS — Decoupled Event Bus Protocol
 * Manages event-driven communication between Autonomous Department Swarms and Workspace Repositories.
 */

export type SparkEventType =
  | "TREND_FOUND"
  | "OPPORTUNITY_CREATED"
  | "SCRIPT_READY"
  | "STORYBOARD_READY"
  | "VOICE_READY"
  | "RENDER_STARTED"
  | "RENDER_FINISHED"
  | "REVIEW_REQUIRED"
  | "PUBLISH_STARTED"
  | "PUBLISH_FINISHED"
  | "ANALYTICS_UPDATED"
  | "MEMORY_UPDATED"
  | "LIVE_TREND_FOUND"
  | "SEARCH_PATTERN_CHANGED"
  | "COMPETITOR_DISCOVERED"
  | "NEW_PLATFORM_SIGNAL"
  | "MEMORY_LEARNED"
  | "OPPORTUNITY_SCORE_UPDATED"
  | "ACCOUNT_CONNECTED"
  | "ACCOUNT_DISCONNECTED"
  | "TOKEN_REFRESHED"
  | "TOKEN_EXPIRED"
  | "ACCOUNT_RECONNECTED";

export interface SparkEventPayload {
  type: SparkEventType;
  brandId?: string;
  data: Record<string, any>;
  timestamp: string;
}

type EventCallback = (payload: SparkEventPayload) => void;

export class SparkEventBus {
  private static instance: SparkEventBus;
  private listeners: Map<SparkEventType, Set<EventCallback>> = new Map();

  static getInstance(): SparkEventBus {
    if (!SparkEventBus.instance) {
      SparkEventBus.instance = new SparkEventBus();
    }
    return SparkEventBus.instance;
  }

  on(event: SparkEventType, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit(event: SparkEventType, data: Record<string, any>, brandId?: string): void {
    const payload: SparkEventPayload = {
      type: event,
      brandId,
      data,
      timestamp: new Date().toISOString(),
    };

    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(payload);
        } catch (err) {
          console.error(`[EventBus] Error in listener for ${event}:`, err);
        }
      });
    }
  }
}

export const eventBus = SparkEventBus.getInstance();
