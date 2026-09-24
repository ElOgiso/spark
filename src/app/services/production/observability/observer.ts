/**
 * SPARK Phase 17 — Production Observer & Event Writer.
 * Single observability boundary: local logger + durable repository.
 * Enforces critical vs diagnostic fail-closed rules.
 */

import type {
  ProductionObservationEvent,
  ProductionEventType,
  EventCriticality,
} from "./types";
import type { IProductionObservabilityRepository } from "./repository";
import { getProductionObservabilityRepository } from "./repository";
import { sanitizeEvidence } from "./sanitizer";

export interface ProductionObserverOptions {
  repository?: IProductionObservabilityRepository;
  onLocalEvent?: (event: ProductionObservationEvent) => void;
}

export class ProductionObserver {
  private repository: IProductionObservabilityRepository;
  private onLocalEvent?: (event: ProductionObservationEvent) => void;

  constructor(options?: ProductionObserverOptions) {
    this.repository = options?.repository || getProductionObservabilityRepository();
    this.onLocalEvent = options?.onLocalEvent;
  }

  async record(
    event: Omit<ProductionObservationEvent, "id" | "occurredAt"> & {
      id?: string;
      occurredAt?: string;
    }
  ): Promise<ProductionObservationEvent> {
    const fullEvent: ProductionObservationEvent = {
      ...event,
      id: event.id || `ev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      occurredAt: event.occurredAt || new Date().toISOString(),
      criticality: event.criticality || "diagnostic",
      evidence: sanitizeEvidence(event.evidence || {}),
    };

    // Emit to local listener / memory logger first
    try {
      this.onLocalEvent?.(fullEvent);
    } catch (err) {
      console.warn("[SPARK Observability] Local event handler threw:", err);
    }

    // Persist to durable repository
    try {
      await this.repository.append(fullEvent);
    } catch (err) {
      if (fullEvent.criticality === "critical") {
        // Critical financial or execution identity failure: FAIL CLOSED
        throw new Error(
          `[SPARK Observability] Critical event persistence failed: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      } else {
        // Diagnostic event: do not destroy already-produced media
        console.warn(
          `[SPARK Observability] Non-critical event persistence failed: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }

    return fullEvent;
  }

  recordPlanning(
    productionId: string,
    eventType: ProductionEventType,
    evidence: Record<string, unknown>,
    extras?: Partial<ProductionObservationEvent>
  ): Promise<ProductionObservationEvent> {
    return this.record({
      productionId,
      eventType,
      evidence,
      criticality: "diagnostic",
      provenance: { source: "planner", measured: true },
      ...extras,
    });
  }

  recordRouting(
    productionId: string,
    taskId: string,
    providerId: string,
    evidence: Record<string, unknown>,
    extras?: Partial<ProductionObservationEvent>
  ): Promise<ProductionObservationEvent> {
    return this.record({
      productionId,
      taskId,
      providerId,
      eventType: "routing_selected",
      evidence,
      criticality: "diagnostic",
      provenance: { source: "canonical_router", measured: true },
      ...extras,
    });
  }

  recordEconomics(
    productionId: string,
    eventType: ProductionEventType,
    evidence: Record<string, unknown>,
    critical: boolean = true,
    extras?: Partial<ProductionObservationEvent>
  ): Promise<ProductionObservationEvent> {
    return this.record({
      productionId,
      eventType,
      evidence,
      criticality: critical ? "critical" : "diagnostic",
      provenance: { source: "credit_service", measured: true },
      ...extras,
    });
  }

  recordExecution(
    productionId: string,
    taskId: string,
    executionId: string,
    eventType: ProductionEventType,
    evidence: Record<string, unknown>,
    critical: boolean = false,
    extras?: Partial<ProductionObservationEvent>
  ): Promise<ProductionObservationEvent> {
    return this.record({
      productionId,
      taskId,
      executionId,
      eventType,
      evidence,
      criticality: critical ? "critical" : "diagnostic",
      provenance: { source: "execution_engine", measured: true },
      ...extras,
    });
  }

  recordQc(
    productionId: string,
    assetId: string,
    eventType: ProductionEventType,
    evidence: Record<string, unknown>,
    extras?: Partial<ProductionObservationEvent>
  ): Promise<ProductionObservationEvent> {
    return this.record({
      productionId,
      assetId,
      eventType,
      evidence,
      criticality: "diagnostic",
      provenance: { source: "qc_orchestrator", measured: true },
      ...extras,
    });
  }

  recordRepair(
    productionId: string,
    eventType: ProductionEventType,
    evidence: Record<string, unknown>,
    extras?: Partial<ProductionObservationEvent>
  ): Promise<ProductionObservationEvent> {
    return this.record({
      productionId,
      eventType,
      evidence,
      criticality: "diagnostic",
      provenance: { source: "repair_orchestrator", measured: true },
      ...extras,
    });
  }

  recordEditorial(
    productionId: string,
    eventType: ProductionEventType,
    evidence: Record<string, unknown>,
    extras?: Partial<ProductionObservationEvent>
  ): Promise<ProductionObservationEvent> {
    return this.record({
      productionId,
      eventType,
      evidence,
      criticality: "diagnostic",
      provenance: { source: "editorial_pipeline", measured: true },
      ...extras,
    });
  }

  recordPublish(
    productionId: string,
    eventType: ProductionEventType,
    evidence: Record<string, unknown>,
    extras?: Partial<ProductionObservationEvent>
  ): Promise<ProductionObservationEvent> {
    return this.record({
      productionId,
      eventType,
      evidence,
      criticality: "diagnostic",
      provenance: { source: "publish_service", measured: true },
      ...extras,
    });
  }

  recordPerformance(
    productionId: string,
    evidence: Record<string, unknown>,
    extras?: Partial<ProductionObservationEvent>
  ): Promise<ProductionObservationEvent> {
    return this.record({
      productionId,
      eventType: "analytics_captured",
      evidence,
      criticality: "diagnostic",
      provenance: { source: "analytics_service", measured: true },
      ...extras,
    });
  }
}

let activeObserver: ProductionObserver | null = null;

export function getProductionObserver(): ProductionObserver {
  if (!activeObserver) {
    activeObserver = new ProductionObserver();
  }
  return activeObserver;
}

export function setProductionObserver(observer: ProductionObserver | null): void {
  activeObserver = observer;
}
