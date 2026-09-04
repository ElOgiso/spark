/**
 * Image / voice / merge adapters — wrap injectable ports (ModelRouter / existing services).
 * Real calls only when ports or default runtimes are provided; tests inject mocks.
 */

import type { MediaProviderAdapter, AdapterPorts } from "./types";
import type {
  NormalizedMediaOutput,
  ProviderCapabilitySnapshot,
  ProviderGenerationRequest,
  ProviderJob,
  ProviderJobStatus,
} from "../types";
import { classifyProviderFailure, makeExecutionError } from "../errors";

function storeJob(
  map: Map<string, ProviderJobStatus>,
  job: ProviderJobStatus
): ProviderJob {
  map.set(job.providerJobId, job);
  return { providerJobId: job.providerJobId, status: job.status, raw: job.raw };
}

export function createImageAdapter(
  providerId: string = "openai",
  ports: AdapterPorts = {}
): MediaProviderAdapter {
  const jobs = new Map<string, ProviderJobStatus>();
  return {
    providerId,
    capabilities(): ProviderCapabilitySnapshot {
      return {
        providerId,
        mediaTypes: ["image"],
        strategies: ["text_to_image", "slideshow_still", "image_to_image"],
        capabilities: ["text_to_image", "high_resolution"],
        requiresCredentials: providerId === "openai" ? ["OPENAI_API_KEY"] : ["GEMINI_API_KEY"],
        statusMechanism: "sync",
        knownLimitations: ["Keyframe stills only — no motion"],
      };
    },
    async submit(request: ProviderGenerationRequest): Promise<ProviderJob> {
      try {
        if (!ports.submitImage) {
          throw makeExecutionError(
            "provider_unavailable",
            "Image adapter requires an injected submitImage port in this environment",
            { retryable: false }
          );
        }
        const result = await ports.submitImage(request);
        return storeJob(jobs, {
          providerJobId: result.providerJobId,
          status: "succeeded",
          outputUrl: result.imageUrl,
          raw: { provider: result.provider },
        });
      } catch (err: any) {
        if (err?.code) throw err;
        const msg = String(err?.message || err);
        throw makeExecutionError(classifyProviderFailure(msg), msg);
      }
    },
    async getStatus(jobId: string) {
      return jobs.get(jobId) || { providerJobId: jobId, status: "failed", errorMessage: "unknown_job" };
    },
    async cancel(jobId: string) {
      const j = jobs.get(jobId);
      if (j && j.status !== "succeeded") {
        jobs.set(jobId, { ...j, status: "cancelled" });
        return { cancelled: true };
      }
      return { cancelled: false, reason: "provider_cancel_unsupported" };
    },
    async normalizeOutput(job: ProviderJobStatus): Promise<NormalizedMediaOutput> {
      if (!job.outputUrl) throw makeExecutionError("output_unavailable", "No image URL");
      return {
        mediaType: "image",
        sourceUrl: job.outputUrl,
        mimeType: "image/png",
        providerJobId: job.providerJobId,
        metadata: { provider: providerId },
      };
    },
  };
}

export function createVoiceAdapter(
  providerId: string = "elevenlabs",
  ports: AdapterPorts = {}
): MediaProviderAdapter {
  const jobs = new Map<string, ProviderJobStatus>();
  return {
    providerId,
    capabilities(): ProviderCapabilitySnapshot {
      return {
        providerId,
        mediaTypes: ["audio"],
        strategies: ["voice"],
        capabilities: ["voice", "audio_generation"],
        requiresCredentials: ["ELEVENLABS_API_KEY"],
        statusMechanism: "sync",
        knownLimitations: ["TTS only — lip-sync is a separate task"],
      };
    },
    async submit(request: ProviderGenerationRequest): Promise<ProviderJob> {
      try {
        if (!ports.submitVoice) {
          throw makeExecutionError(
            "provider_unavailable",
            "Voice adapter requires an injected submitVoice port in this environment",
            { retryable: false }
          );
        }
        const result = await ports.submitVoice(request);
        return storeJob(jobs, {
          providerJobId: result.providerJobId,
          status: "succeeded",
          outputUrl: result.audioUrl,
          raw: { provider: result.provider, durationSec: result.durationSec },
        });
      } catch (err: any) {
        if (err?.code) throw err;
        const msg = String(err?.message || err);
        throw makeExecutionError(classifyProviderFailure(msg), msg);
      }
    },
    async getStatus(jobId: string) {
      return jobs.get(jobId) || { providerJobId: jobId, status: "failed", errorMessage: "unknown_job" };
    },
    async cancel() {
      return { cancelled: false, reason: "provider_cancel_unsupported" };
    },
    async normalizeOutput(job: ProviderJobStatus): Promise<NormalizedMediaOutput> {
      if (!job.outputUrl) throw makeExecutionError("output_unavailable", "No audio URL");
      return {
        mediaType: "audio",
        sourceUrl: job.outputUrl,
        mimeType: "audio/mpeg",
        durationSec: typeof job.raw?.durationSec === "number" ? job.raw.durationSec : undefined,
        providerJobId: job.providerJobId,
        metadata: { provider: providerId },
      };
    },
  };
}

export function createMergeAdapter(ports: AdapterPorts = {}): MediaProviderAdapter {
  const jobs = new Map<string, ProviderJobStatus>();
  const providerId = "mux";
  return {
    providerId,
    capabilities(): ProviderCapabilitySnapshot {
      return {
        providerId,
        mediaTypes: ["merge", "video"],
        strategies: ["mux_edit", "edit"],
        capabilities: ["editing"],
        requiresCredentials: [],
        statusMechanism: "sync",
        knownLimitations: ["Concat via /api/runtime/video mux action"],
      };
    },
    async submit(request: ProviderGenerationRequest): Promise<ProviderJob> {
      try {
        if (!ports.submitMerge) {
          throw makeExecutionError(
            "provider_unavailable",
            "Merge adapter requires an injected submitMerge port in this environment",
            { retryable: false }
          );
        }
        const result = await ports.submitMerge(request);
        return storeJob(jobs, {
          providerJobId: result.providerJobId,
          status: "succeeded",
          outputUrl: result.videoUrl,
          raw: { provider: result.provider },
        });
      } catch (err: any) {
        if (err?.code) throw err;
        const msg = String(err?.message || err);
        throw makeExecutionError(classifyProviderFailure(msg), msg);
      }
    },
    async getStatus(jobId: string) {
      return jobs.get(jobId) || { providerJobId: jobId, status: "failed", errorMessage: "unknown_job" };
    },
    async cancel() {
      return { cancelled: false, reason: "provider_cancel_unsupported" };
    },
    async normalizeOutput(job: ProviderJobStatus): Promise<NormalizedMediaOutput> {
      if (!job.outputUrl) throw makeExecutionError("output_unavailable", "No merge URL");
      return {
        mediaType: "video",
        sourceUrl: job.outputUrl,
        mimeType: "video/mp4",
        providerJobId: job.providerJobId,
        metadata: { provider: providerId, role: "master_merge" },
      };
    },
  };
}
