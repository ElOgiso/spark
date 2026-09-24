/**
 * SPARK Phase 17 — Production Observability Repository.
 * Dual-mode: In-Memory (tests / offline) & Supabase (durable persistence).
 * Never silently falls back to in-memory on database write failure.
 */

import type {
  ProductionObservationEvent,
  ProductionObservationFilter,
} from "./types";
import { sanitizeEvidence } from "./sanitizer";
import {
  isSupabaseConfigured,
  getSupabaseClient,
} from "../../../backend/supabaseClient";
import type { ProductionEventRow } from "../../../backend/database.types";

export interface IProductionObservabilityRepository {
  append(event: ProductionObservationEvent): Promise<void>;
  appendMany(events: ProductionObservationEvent[]): Promise<void>;
  byProduction(productionId: string): Promise<ProductionObservationEvent[]>;
  byTask(taskId: string): Promise<ProductionObservationEvent[]>;
  byExecution(executionId: string): Promise<ProductionObservationEvent[]>;
  query(filter: ProductionObservationFilter): Promise<ProductionObservationEvent[]>;
  clear?(): Promise<void>;
}

export class InMemoryProductionObservabilityRepository
  implements IProductionObservabilityRepository
{
  private events: ProductionObservationEvent[] = [];

  async append(event: ProductionObservationEvent): Promise<void> {
    const sanitized: ProductionObservationEvent = {
      ...event,
      evidence: sanitizeEvidence(event.evidence),
    };
    this.events.push(JSON.parse(JSON.stringify(sanitized)));
    // Keep strictly sorted chronologically
    this.events.sort(
      (a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt)
    );
  }

  async appendMany(events: ProductionObservationEvent[]): Promise<void> {
    for (const ev of events) {
      await this.append(ev);
    }
  }

  async byProduction(productionId: string): Promise<ProductionObservationEvent[]> {
    return this.query({ productionId });
  }

  async byTask(taskId: string): Promise<ProductionObservationEvent[]> {
    return this.query({ taskId });
  }

  async byExecution(executionId: string): Promise<ProductionObservationEvent[]> {
    return this.query({ executionId });
  }

  async query(
    filter: ProductionObservationFilter
  ): Promise<ProductionObservationEvent[]> {
    return this.events
      .filter((e) => {
        if (filter.productionId && e.productionId !== filter.productionId) {
          return false;
        }
        if (filter.taskId && e.taskId !== filter.taskId) {
          return false;
        }
        if (filter.executionId && e.executionId !== filter.executionId) {
          return false;
        }
        if (filter.brandId && e.brandId !== filter.brandId) {
          return false;
        }
        if (filter.eventType) {
          if (Array.isArray(filter.eventType)) {
            if (!filter.eventType.includes(e.eventType)) return false;
          } else if (e.eventType !== filter.eventType) {
            return false;
          }
        }
        if (filter.since && Date.parse(e.occurredAt) < Date.parse(filter.since)) {
          return false;
        }
        if (filter.until && Date.parse(e.occurredAt) > Date.parse(filter.until)) {
          return false;
        }
        return true;
      })
      .map((e) => JSON.parse(JSON.stringify(e)));
  }

  async clear(): Promise<void> {
    this.events = [];
  }
}

export class SupabaseProductionObservabilityRepository
  implements IProductionObservabilityRepository
{
  constructor(private client: any = getSupabaseClient()) {
    if (!this.client) {
      throw new Error(
        "SupabaseProductionObservabilityRepository requires an active Supabase client"
      );
    }
  }

  private toRow(event: ProductionObservationEvent): Partial<ProductionEventRow> {
    const sanitizedEvidence = sanitizeEvidence(event.evidence);
    return {
      id: event.id,
      user_id: event.userId || null,
      brand_id: event.brandId || null,
      production_id: event.productionId,
      event_type: event.eventType,
      occurred_at: event.occurredAt,
      task_id: event.taskId || null,
      scene_id: event.sceneId || null,
      shot_id: event.shotId || null,
      execution_id: event.executionId || null,
      provider_job_id: event.providerJobId || null,
      provider_id: event.providerId || null,
      model_id: event.modelId || null,
      attempt: event.attempt ?? null,
      asset_id: event.assetId || null,
      reservation_id: event.reservationId || null,
      metadata: {
        evidence: sanitizedEvidence,
        provenance: event.provenance,
        criticality: event.criticality,
      } as any,
    };
  }

  private fromRow(row: ProductionEventRow): ProductionObservationEvent {
    const meta = (row.metadata as any) || {};
    return {
      id: row.id,
      productionId: row.production_id,
      brandId: row.brand_id || undefined,
      userId: row.user_id || undefined,
      eventType: row.event_type as any,
      occurredAt: row.occurred_at,
      taskId: row.task_id || undefined,
      sceneId: row.scene_id || undefined,
      shotId: row.shot_id || undefined,
      executionId: row.execution_id || undefined,
      providerJobId: row.provider_job_id || undefined,
      providerId: row.provider_id || undefined,
      modelId: row.model_id || undefined,
      attempt: row.attempt ?? undefined,
      assetId: row.asset_id || undefined,
      reservationId: row.reservation_id || undefined,
      criticality: meta.criticality || "diagnostic",
      evidence: meta.evidence || {},
      provenance: meta.provenance || { source: "supabase", measured: true },
    };
  }

  async append(event: ProductionObservationEvent): Promise<void> {
    const row = this.toRow(event);
    const { error } = await this.client
      .from("production_events")
      .insert(row);

    if (error) {
      throw new Error(`Failed to append production event: ${error.message}`);
    }
  }

  async appendMany(events: ProductionObservationEvent[]): Promise<void> {
    if (events.length === 0) return;
    const rows = events.map((e) => this.toRow(e));
    const { error } = await this.client
      .from("production_events")
      .insert(rows);

    if (error) {
      throw new Error(`Failed to append production events: ${error.message}`);
    }
  }

  async byProduction(productionId: string): Promise<ProductionObservationEvent[]> {
    return this.query({ productionId });
  }

  async byTask(taskId: string): Promise<ProductionObservationEvent[]> {
    return this.query({ taskId });
  }

  async byExecution(executionId: string): Promise<ProductionObservationEvent[]> {
    return this.query({ executionId });
  }

  async query(
    filter: ProductionObservationFilter
  ): Promise<ProductionObservationEvent[]> {
    let q = this.client
      .from("production_events")
      .select("*")
      .order("occurred_at", { ascending: true });

    if (filter.productionId) {
      q = q.eq("production_id", filter.productionId);
    }
    if (filter.taskId) {
      q = q.eq("task_id", filter.taskId);
    }
    if (filter.executionId) {
      q = q.eq("execution_id", filter.executionId);
    }
    if (filter.brandId) {
      q = q.eq("brand_id", filter.brandId);
    }
    if (filter.eventType) {
      if (Array.isArray(filter.eventType)) {
        q = q.in("event_type", filter.eventType);
      } else {
        q = q.eq("event_type", filter.eventType);
      }
    }
    if (filter.since) {
      q = q.gte("occurred_at", filter.since);
    }
    if (filter.until) {
      q = q.lte("occurred_at", filter.until);
    }

    const { data, error } = await q;
    if (error) {
      throw new Error(`Failed to query production events: ${error.message}`);
    }

    return (data || []).map((row: ProductionEventRow) => this.fromRow(row));
  }
}

let activeRepository: IProductionObservabilityRepository | null = null;

export function getProductionObservabilityRepository(): IProductionObservabilityRepository {
  if (!activeRepository) {
    activeRepository = createProductionObservabilityRepository();
  }
  return activeRepository;
}

export function setProductionObservabilityRepository(
  repo: IProductionObservabilityRepository | null
): void {
  activeRepository = repo;
}

export function createProductionObservabilityRepository(
  client?: any,
  options?: { forceMemory?: boolean }
): IProductionObservabilityRepository {
  const isTest =
    typeof process !== "undefined" &&
    (process.env.NODE_ENV === "test" ||
      process.env.npm_lifecycle_event === "test" ||
      process.env.VITE_USE_SUPABASE === "false" ||
      process.execArgv.includes("--test") ||
      process.argv.some((a) => a.includes("--test") || a.includes(".test.")));

  if (
    options?.forceMemory ||
    !isSupabaseConfigured() ||
    (isTest && !process.env.TEST_WITH_SUPABASE)
  ) {
    return new InMemoryProductionObservabilityRepository();
  }
  return new SupabaseProductionObservabilityRepository(client || getSupabaseClient());
}
