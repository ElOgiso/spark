export interface MessageBusEnvelope {
  id: string;
  type: "request" | "response" | "event" | "broadcast";
  sender: string;
  recipient?: string;
  topic: string;
  payload: any;
  timestamp: string;
}

type MessageBusListener = (envelope: MessageBusEnvelope) => void;

export class AgentMessageBus {
  private static instance: AgentMessageBus;
  private listeners: Set<MessageBusListener> = new Set();
  private pendingRequests: Map<string, (response: any) => void> = new Map();

  private constructor() {}

  public static getInstance(): AgentMessageBus {
    if (!AgentMessageBus.instance) {
      AgentMessageBus.instance = new AgentMessageBus();
    }
    return AgentMessageBus.instance;
  }

  public registerListener(listener: MessageBusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public publish(envelope: Omit<MessageBusEnvelope, "id" | "timestamp">): void {
    const fullEnvelope: MessageBusEnvelope = {
      ...envelope,
      id: `msg-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString()
    };

    console.log(`[Message Bus] [${fullEnvelope.type}] ${fullEnvelope.sender} -> ${fullEnvelope.recipient || "broadcast"} (Topic: ${fullEnvelope.topic})`);

    // Auto-resolve request listeners if response arrives
    if (fullEnvelope.type === "response" && fullEnvelope.payload && fullEnvelope.payload.requestId) {
      this.resolveRequest(fullEnvelope.payload.requestId, fullEnvelope.payload);
    }

    this.listeners.forEach(listener => {
      try {
        listener(fullEnvelope);
      } catch (e) {
        console.error(`[Message Bus] Listener processing failure:`, e);
      }
    });
  }

  /**
   * Initiates an async request/response interaction over the message bus.
   */
  public async request(sender: string, recipient: string, topic: string, payload: any): Promise<any> {
    const requestId = `req-${Math.random().toString(36).substring(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Timeout waiting for response from ${recipient} on request: ${requestId}`));
      }, 15000);

      this.pendingRequests.set(requestId, (responsePayload) => {
        clearTimeout(timeout);
        resolve(responsePayload);
      });

      this.publish({
        type: "request",
        sender,
        recipient,
        topic,
        payload: { ...payload, requestId }
      });
    });
  }

  public respond(sender: string, recipient: string, requestId: string, payload: any): void {
    this.publish({
      type: "response",
      sender,
      recipient,
      topic: "response",
      payload: { ...payload, requestId }
    });
  }

  private resolveRequest(requestId: string, payload: any): void {
    const resolver = this.pendingRequests.get(requestId);
    if (resolver) {
      resolver(payload);
      this.pendingRequests.delete(requestId);
    }
  }
}
