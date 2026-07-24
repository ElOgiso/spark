import {
  ExecutiveConversationMessageRow,
  ExecutiveSessionRow,
  ExecutiveDirectorSummaryRow,
  MemoryItemRow,
  ExecutiveTimelineRow,
} from "../backend/database.types";
import { ExecutiveContext } from "../state/executiveContext";

export enum SparkEvent {
  MessageCreated = "MessageCreated",
  MemoryUpdated = "MemoryUpdated",
  SummaryUpdated = "SummaryUpdated",
  SessionUpdated = "SessionUpdated",
  RuntimeUpdated = "RuntimeUpdated",
  TimelineRecorded = "TimelineRecorded",
}

export type EventPayloads = {
  [SparkEvent.MessageCreated]: ExecutiveConversationMessageRow;
  [SparkEvent.MemoryUpdated]: MemoryItemRow[];
  [SparkEvent.SummaryUpdated]: ExecutiveDirectorSummaryRow;
  [SparkEvent.SessionUpdated]: ExecutiveSessionRow;
  [SparkEvent.RuntimeUpdated]: ExecutiveContext;
  [SparkEvent.TimelineRecorded]: ExecutiveTimelineRow;
};

type EventCallback<E extends SparkEvent> = (payload: EventPayloads[E]) => void;

class TypedEventBus {
  private listeners: Map<SparkEvent, Set<EventCallback<any>>> = new Map();

  public on<E extends SparkEvent>(event: E, handler: EventCallback<E>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  public emit<E extends SparkEvent>(event: E, payload: EventPayloads[E]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[EventBus] Error in event listener for ${event}:`, err);
        }
      });
    }
  }
}

export const eventBus = new TypedEventBus();
export const emit = <E extends SparkEvent>(event: E, payload: EventPayloads[E]) =>
  eventBus.emit(event, payload);
export const on = <E extends SparkEvent>(event: E, handler: EventCallback<E>) =>
  eventBus.on(event, handler);
