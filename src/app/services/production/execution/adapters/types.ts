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

import type { CostEstimate, ActualProviderCost } from "../../economics/types";

export interface MediaProviderAdapter {
  providerId: string;
  capabilities(): ProviderCapabilitySnapshot;
  submit(request: ProviderGenerationRequest): Promise<ProviderJob>;
  getStatus(jobId: string): Promise<ProviderJobStatus>;
  cancel?(jobId: string): Promise<{ cancelled: boolean; reason?: string }>;
  normalizeOutput(job: ProviderJobStatus): Promise<NormalizedMediaOutput>;
  /** Optional provider-specific status normalizer */
  normalizeStatus?(rawStatus: unknown): import("../types").NormalizedProviderStatus;
  /** Optional provider-specific reconciliation lookup */
  reconcileJob?(requestId?: string, idempotencyKey?: string): Promise<ProviderJobStatus | null>;
  /** Optional provider-specific pre-flight cost estimation */
  estimateCost?(request: ProviderGenerationRequest): Promise<CostEstimate> | CostEstimate;
  /** Optional provider-specific post-execution actual cost resolution */
  resolveActualCost?(job: ProviderJobStatus): Promise<ActualProviderCost> | ActualProviderCost;
}

export function normalizeProviderStatus(
  providerId: string,
  rawStatus: unknown
): import("../types").NormalizedProviderStatus {
  if (typeof rawStatus === "number") {
    // Kling codes: 99=processing, 200=success, 500=failed
    if (rawStatus === 200) return "SUCCEEDED";
    if (rawStatus === 99) return "RUNNING";
    if (rawStatus >= 400) return "FAILED";
  }

  const s = String(rawStatus || "").trim().toLowerCase();
  if (s === "succeeded" || s === "success" || s === "completed" || s === "done" || s === "200") {
    return "SUCCEEDED";
  }
  if (s === "running" || s === "processing" || s === "in_progress" || s === "generating" || s === "99") {
    return "RUNNING";
  }
  if (s === "queued" || s === "pending" || s === "submitted" || s === "waiting") {
    return "QUEUED";
  }
  if (s === "cancelled" || s === "canceled" || s === "aborted") {
    return "CANCELLED";
  }
  if (s === "expired" || s === "timeout") {
    return "EXPIRED";
  }
  if (s === "failed" || s === "error" || s === "rejected" || s >= "400") {
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
    providerJobId: string;
    provider: string;
  }>;
  /** Optional status poller for async jobs */
  pollJob?: (providerId: string, jobId: string) => Promise<ProviderJobStatus>;
  cancelJob?: (providerId: string, jobId: string) => Promise<{ cancelled: boolean; reason?: string }>;
}
