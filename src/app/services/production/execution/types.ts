/**
 * Phase 4 — provider-neutral media execution contracts.
 * Planner decides WHAT; execution decides HOW for already-planned GenerationTasks.
 */

export type ExecutionStatus =
  | "pending"
  | "queued"
  | "running"
  | "polling"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "retrying"
  | "exhausted";

export type ExecutionErrorCode =
  | "provider_unavailable"
  | "rate_limited"
  | "authentication_failed"
  | "invalid_request"
  | "unsupported_capability"
  | "timeout"
  | "generation_failed"
  | "output_unavailable"
  | "output_invalid"
  | "output_mismatch"
  | "storage_failed"
  | "cancelled"
  | "dependency_failed"
  | "idempotent_reuse"
  | "unknown";

export interface ExecutionError {
  code: ExecutionErrorCode;
  message: string;
  retryable: boolean;
  reasons?: string[];
  /** Sanitized provider diagnostics — never secrets */
  providerDiagnostics?: Record<string, unknown>;
}

export interface ExecutionInputAsset {
  role: "first_frame" | "last_frame" | "reference" | "character" | "audio" | "source_video" | "mask" | "other";
  assetRef?: string;
  url?: string;
  mimeType?: string;
}

export interface ExecutionOutputAsset {
  mediaType: "image" | "video" | "audio";
  productionAssetId?: string;
  sourceUrl?: string;
  persistentUrl?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  durationSec?: number;
}

export interface UsageCostMetadata {
  estimatedCost?: number;
  actualCost?: number;
  currency?: string;
  inputUnits?: number;
  outputUnits?: number;
}

export interface GenerationExecution {
  id: string;
  taskId: string;
  productionId: string;
  sceneId?: string;
  shotId?: string;
  provider: string;
  model?: string;
  status: ExecutionStatus;
  attempt: number;
  maxAttempts: number;
  startedAt?: string;
  completedAt?: string;
  providerJobId?: string;
  inputAssets: ExecutionInputAsset[];
  outputAssets: ExecutionOutputAsset[];
  error?: ExecutionError;
  inputHash?: string;
  usage?: UsageCostMetadata;
  metadata?: Record<string, unknown>;
}

export interface NormalizedMediaOutput {
  mediaType: "image" | "video" | "audio";
  sourceUrl?: string;
  localPath?: string;
  mimeType: string;
  width?: number;
  height?: number;
  durationSec?: number;
  providerJobId: string;
  fileSizeBytes?: number;
  metadata: Record<string, unknown>;
  usage?: UsageCostMetadata;
}

export type ProductionExecutionState =
  | "planned"
  | "queued"
  | "running"
  | "partially_complete"
  | "completed"
  | "failed"
  | "cancelled";

export interface TechnicalValidationResult {
  ok: boolean;
  code?: ExecutionErrorCode;
  reasons: string[];
  retryable: boolean;
}

export interface ProviderJob {
  providerJobId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  progress?: number;
  raw?: Record<string, unknown>;
}

export interface ProviderJobStatus {
  providerJobId: string;
  status: ProviderJob["status"];
  outputUrl?: string;
  errorMessage?: string;
  retryAfterMs?: number;
  raw?: Record<string, unknown>;
}

export interface ProviderGenerationRequest {
  providerId: string;
  model?: string;
  modality: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  durationSec?: number;
  resolution?: string;
  productionId: string;
  brandId?: string;
  taskId: string;
  executionId: string;
  inputs: ExecutionInputAsset[];
  metadata?: Record<string, unknown>;
}

export interface ProviderCapabilitySnapshot {
  providerId: string;
  mediaTypes: Array<"image" | "video" | "audio" | "merge">;
  strategies: string[];
  capabilities: string[];
  requiresCredentials: string[];
  statusMechanism: "sync" | "poll" | "webhook" | "hybrid";
  knownLimitations: string[];
}
