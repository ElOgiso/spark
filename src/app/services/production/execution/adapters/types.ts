/**
 * Media provider adapter boundary — provider-specific behavior lives here only.
 */

import type {
  NormalizedMediaOutput,
  ProviderCapabilitySnapshot,
  ProviderGenerationRequest,
  ProviderJob,
  ProviderJobStatus,
} from "../types";

import type { CostEstimate, ActualProviderCost, ProviderUsageReport } from "../../economics/types";
import type { ExecutionError, NormalizedProviderStatus } from "../types";

export interface NormalizedProviderOutput {
  type: "image" | "video" | "audio";
  url: string;
  mimeType: string;
  width?: number;
  height?: number;
  durationSec?: number;
}

export interface NormalizedProviderResult {
  provider: string;
  model?: string;
  providerJobId: string;
  status: NormalizedProviderStatus;
  outputs: NormalizedProviderOutput[];
  usage?: ProviderUsageReport;
  metadata?: Record<string, unknown>;
  rawStatus?: string;
}

export interface ProviderError extends ExecutionError {
  provider: string;
  providerErrorCode?: string;
  rawStatus?: string;
  rawMetadata?: Record<string, unknown>;
}

export interface MediaProviderAdapter {
  providerId: string;
  capabilities(): ProviderCapabilitySnapshot;
  submit(request: ProviderGenerationRequest): Promise<ProviderJob>;
  getStatus(jobId: string): Promise<ProviderJobStatus>;
  cancel?(jobId: string): Promise<{ cancelled: boolean; reason?: string }>;
  normalizeOutput(job: ProviderJobStatus): Promise<NormalizedMediaOutput>;
  /** Canonical provider-specific status normalizer */
  normalizeStatus?(rawStatus: unknown): NormalizedProviderStatus;
  /** Phase 11 canonical normalized result builder */
  normalizeResult?(job: ProviderJobStatus): Promise<NormalizedProviderResult> | NormalizedProviderResult;
  /** Phase 11 canonical error normalizer */
  normalizeError?(error: unknown): ProviderError;
  /** Phase 11 canonical usage facts extractor (reports facts to CostEngine) */
  extractUsage?(job: ProviderJobStatus): ProviderUsageReport | undefined;
  /** Optional provider-specific reconciliation lookup */
  reconcileJob?(requestId?: string, idempotencyKey?: string): Promise<ProviderJobStatus | null>;
  /** Legacy compatibility hook — CostEngine remains the single authoritative economics authority */
  estimateCost?(request: ProviderGenerationRequest): Promise<CostEstimate> | CostEstimate;
  /** Legacy compatibility hook — CostEngine remains the single authoritative economics authority */
  resolveActualCost?(job: ProviderJobStatus): Promise<ActualProviderCost> | ActualProviderCost;
}

export function normalizeProviderStatus(
  providerId: string,
  rawStatus: unknown
): NormalizedProviderStatus {
  if (typeof rawStatus === "number") {
    // Kling numeric codes: 99=processing, 200=success, 500=failed
    if (rawStatus === 200) return "SUCCEEDED";
    if (rawStatus === 99) return "RUNNING";
    if (rawStatus >= 400) return "FAILED";
  }

  const s = String(rawStatus || "").trim().toLowerCase();
  if (
    s === "succeeded" ||
    s === "success" ||
    s === "completed" ||
    s === "done" ||
    s === "ready" ||
    s === "200"
  ) {
    return "SUCCEEDED";
  }
  if (
    s === "running" ||
    s === "processing" ||
    s === "in_progress" ||
    s === "generating" ||
    s === "99"
  ) {
    return "RUNNING";
  }
  if (
    s === "queued" ||
    s === "pending" ||
    s === "submitted" ||
    s === "waiting" ||
    s === "preparing"
  ) {
    return "QUEUED";
  }
  if (s === "cancelled" || s === "canceled" || s === "aborted") {
    return "CANCELLED";
  }
  if (s === "expired" || s === "timeout" || s === "timed_out") {
    return "EXPIRED";
  }
  if (
    s === "failed" ||
    s === "error" ||
    s === "rejected" ||
    s === "errored" ||
    (!Number.isNaN(Number(s)) && Number(s) >= 400)
  ) {
    return "FAILED";
  }
  return "UNKNOWN";
}

export interface AdapterPorts {
  /** Injectable transport for tests — defaults to real runtime wrappers */
  submitVideo?: (req: ProviderGenerationRequest) => Promise<{
    videoUrl: string;
    lastFrameDataUrl?: string;
    providerJobId: string;
    provider: string;
  }>;
  submitImage?: (req: ProviderGenerationRequest) => Promise<{
    imageUrl: string;
    providerJobId: string;
    provider: string;
  }>;
  submitVoice?: (req: ProviderGenerationRequest) => Promise<{
    audioUrl: string;
    providerJobId: string;
    durationSec?: number;
    provider: string;
  }>;
  submitMerge?: (req: ProviderGenerationRequest) => Promise<{
    videoUrl: string;
    mimeType?: string;
    durationSec?: number;
    providerJobId: string;
    provider: string;
  }>;
  /** Optional status poller for async jobs */
  pollJob?: (providerId: string, jobId: string) => Promise<ProviderJobStatus>;
  cancelJob?: (providerId: string, jobId: string) => Promise<{ cancelled: boolean; reason?: string }>;
}
