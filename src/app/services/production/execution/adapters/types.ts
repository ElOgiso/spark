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

export interface MediaProviderAdapter {
  providerId: string;
  capabilities(): ProviderCapabilitySnapshot;
  submit(request: ProviderGenerationRequest): Promise<ProviderJob>;
  getStatus(jobId: string): Promise<ProviderJobStatus>;
  cancel?(jobId: string): Promise<{ cancelled: boolean; reason?: string }>;
  normalizeOutput(job: ProviderJobStatus): Promise<NormalizedMediaOutput>;
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
