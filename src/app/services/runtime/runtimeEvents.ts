export type RuntimeEventType =
  | "TaskQueued"
  | "TaskStarted"
  | "TaskPaused"
  | "TaskCompleted"
  | "TaskFailed"
  | "AgentStarted"
  | "AgentCompleted"
  | "RetryStarted"
  | "RetrySucceeded"
  | "RetryFailed"
  | "ModelSelected"
  | "ProviderChanged"
  | "ProviderSelected"
  | "ProviderStarted"
  | "ProviderCompleted"
  | "ProviderFailed"
  | "ProviderFallback"
  | "ApprovalRequested"
  | "PublishingStarted"
  | "PublishingCompleted"
  | "LearningCompleted";

export interface RuntimeEvent {
  type: RuntimeEventType;
  timestamp: string;
  payload: any;
}

type RuntimeEventListener = (event: RuntimeEvent) => void;

export class RuntimeEvents {
  private static instance: RuntimeEvents;
  private listeners: Map<RuntimeEventType, Set<RuntimeEventListener>> = new Map();

  private constructor() {}

  public static getInstance(): RuntimeEvents {
    if (!RuntimeEvents.instance) {
      RuntimeEvents.instance = new RuntimeEvents();
    }
    return RuntimeEvents.instance;
  }

  public subscribe(type: RuntimeEventType, listener: RuntimeEventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  public emit(type: RuntimeEventType, payload: any): void {
    const event: RuntimeEvent = {
      type,
      timestamp: new Date().toISOString(),
      payload
    };

    console.log(`[Runtime Event] ${type}: ${JSON.stringify(payload)}`);

    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach(listener => {
        try {
          listener(event);
        } catch (e) {
          console.error(`[Runtime Events] Error in listener for event ${type}:`, e);
        }
      });
    }
  }
}
