/**
 * Mastering job contracts — provider-neutral.
 */

import type { DeliveryVariant, EditorialTimeline } from "../types";
import type { ProductionAsset } from "../../../../domain/types";
import type { UsageCostMetadata } from "../../execution/types";

export type MasteringJobStatus =
  | "planned"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "retrying"
  | "cancelled"
  | "exhausted";

export interface MasteringJob {
  id: string;
  timelineId: string;
  productionId: string;
  variantId: string;
  status: MasteringJobStatus;
  attempt: number;
  maxAttempts: number;
  idempotencyKey: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: { code: string; message: string; retryable: boolean };
  metadata?: Record<string, unknown>;
}

export interface MasterOutput {
  masterId: string;
  timelineId: string;
  variantId: string;
  productionId: string;
  masteringJobId: string;
  mediaUrl?: string;
  mimeType: string;
  durationSec: number;
  resolution: { width: number; height: number };
  aspectRatio: string;
  codec?: string;
  container?: string;
  fileSizeBytes?: number;
  sourceAssetIds: string[];
  provenance: {
    timelineVersion: number;
    clipIds: string[];
  };
  usage?: UsageCostMetadata;
  productionAsset?: ProductionAsset;
}

export interface MasteringResult {
  ok: boolean;
  job: MasteringJob;
  output?: MasterOutput;
  userMessage: string;
  /** True when runtime cannot execute (e.g. FFmpeg missing) — contract still valid */
  deferred?: boolean;
}

export interface MasteringCreateInput {
  timeline: EditorialTimeline;
  variant: DeliveryVariant;
  productionId: string;
  brandId?: string;
  idempotencyKey?: string;
}

export interface MasteringRuntimeAdapter {
  id: string;
  available(): Promise<boolean>;
  render(params: {
    job: MasteringJob;
    timeline: EditorialTimeline;
    variant: DeliveryVariant;
  }): Promise<{
    ok: boolean;
    mediaUrl?: string;
    mimeType?: string;
    durationSec?: number;
    fileSizeBytes?: number;
    codec?: string;
    container?: string;
    deferred?: boolean;
    error?: { code: string; message: string; retryable: boolean };
    diagnostics?: Record<string, unknown>;
  }>;
  cancel?(jobId: string): Promise<void>;
}

export interface MasteringService {
  createJob(input: MasteringCreateInput): Promise<MasteringJob>;
  executeJob(
    job: MasteringJob,
    input: MasteringCreateInput
  ): Promise<MasteringResult>;
}
