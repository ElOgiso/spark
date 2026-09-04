/**
 * Adapter registry — only providers with real integrations are registered.
 * Higgsfield is intentionally NOT registered (stub in runtime).
 * Runway/Luma exist partially in video.ts but are not claimed as fully supported here.
 *
 * Registry keys are `${kind}:${providerId}` so gemini image ≠ gemini video.
 */

import type { MediaProviderAdapter, AdapterPorts } from "./types";
import { createGrokVideoAdapter, createKlingAdapter, createSeedanceAdapter } from "./videoI2vAdapter";
import { createImageAdapter, createMergeAdapter, createVoiceAdapter } from "./mediaAdapters";
import type { ProviderCapabilitySnapshot } from "../types";
import type { GenerationTaskKind } from "../../specification/generationTask";
import { makeExecutionError, classifyProviderFailure } from "../errors";
import type {
  NormalizedMediaOutput,
  ProviderGenerationRequest,
  ProviderJob,
  ProviderJobStatus,
} from "../types";

function key(kind: string, providerId: string): string {
  return `${kind}:${providerId.toLowerCase()}`;
}

/** Gemini/Veo video via injectable submitVideo port (ModelRouter in runtime). */
function createModelRouterVideoAdapter(providerId: string, ports: AdapterPorts = {}): MediaProviderAdapter {
  const jobs = new Map<string, ProviderJobStatus>();
  return {
    providerId,
    capabilities: () => ({
      providerId,
      mediaTypes: ["video"],
      strategies: ["image_to_video", "text_to_video"],
      capabilities: ["image_to_video", "text_to_video", "first_frame_conditioning", "motion_quality"],
      requiresCredentials: providerId === "gemini" ? ["GEMINI_API_KEY"] : [],
      statusMechanism: "hybrid",
      knownLimitations: ["Uses ModelRouter / Veo path via injected submitVideo port"],
    }),
    async submit(request: ProviderGenerationRequest): Promise<ProviderJob> {
      try {
        if (!ports.submitVideo) {
          throw makeExecutionError(
            "provider_unavailable",
            `${providerId} video adapter requires submitVideo port`,
            { retryable: false }
          );
        }
        const result = await ports.submitVideo(request);
        const status: ProviderJobStatus = {
          providerJobId: result.providerJobId,
          status: "succeeded",
          outputUrl: result.videoUrl,
          raw: { lastFrameDataUrl: result.lastFrameDataUrl, provider: result.provider },
        };
        jobs.set(result.providerJobId, status);
        return { providerJobId: result.providerJobId, status: "succeeded", raw: status.raw };
      } catch (err: any) {
        if (err?.code) throw err;
        throw makeExecutionError(classifyProviderFailure(String(err?.message || err)), String(err?.message || err));
      }
    },
    async getStatus(jobId: string) {
      return jobs.get(jobId) || { providerJobId: jobId, status: "failed", errorMessage: "unknown_job" };
    },
    async cancel() {
      return { cancelled: false, reason: "provider_cancel_unsupported" };
    },
    async normalizeOutput(job: ProviderJobStatus): Promise<NormalizedMediaOutput> {
      if (!job.outputUrl) throw makeExecutionError("output_unavailable", "No video URL");
      return {
        mediaType: "video",
        sourceUrl: job.outputUrl,
        mimeType: "video/mp4",
        providerJobId: job.providerJobId,
        metadata: { provider: providerId, lastFrameDataUrl: job.raw?.lastFrameDataUrl },
      };
    },
  };
}

export function createDefaultAdapterRegistry(ports: AdapterPorts = {}): Map<string, MediaProviderAdapter> {
  const map = new Map<string, MediaProviderAdapter>();
  const register = (kind: string, a: MediaProviderAdapter) => map.set(key(kind, a.providerId), a);

  register("video", createKlingAdapter(ports));
  register("video", createSeedanceAdapter(ports));
  register("video", createGrokVideoAdapter(ports));
  register("video", createModelRouterVideoAdapter("gemini", ports));

  register("keyframe", createImageAdapter("openai", ports));
  register("keyframe", createImageAdapter("gemini", ports));

  register("voice", createVoiceAdapter("elevenlabs", ports));
  register("merge", createMergeAdapter(ports));

  // Aliases
  map.set(key("video", "ark"), createSeedanceAdapter(ports));
  map.set(key("video", "xai"), createGrokVideoAdapter(ports));

  // Kind-agnostic fallbacks for resolveAdapter(providerOnly)
  map.set("kling", createKlingAdapter(ports));
  map.set("seedance", createSeedanceAdapter(ports));
  map.set("grok", createGrokVideoAdapter(ports));
  map.set("openai", createImageAdapter("openai", ports));
  map.set("elevenlabs", createVoiceAdapter("elevenlabs", ports));
  map.set("mux", createMergeAdapter(ports));

  return map;
}

export function listRegisteredAdapterCapabilities(
  registry: Map<string, MediaProviderAdapter>
): ProviderCapabilitySnapshot[] {
  const seen = new Set<string>();
  const out: ProviderCapabilitySnapshot[] = [];
  for (const adapter of registry.values()) {
    const sig = `${adapter.providerId}:${adapter.capabilities().mediaTypes.join(",")}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(adapter.capabilities());
  }
  return out;
}

export function resolveAdapter(
  registry: Map<string, MediaProviderAdapter>,
  providerId: string | undefined
): MediaProviderAdapter | undefined {
  if (!providerId) return undefined;
  return registry.get(providerId) || registry.get(providerId.toLowerCase());
}

export function resolveAdapterForTask(
  registry: Map<string, MediaProviderAdapter>,
  providerId: string | undefined,
  kind: GenerationTaskKind
): MediaProviderAdapter | undefined {
  if (!providerId) return undefined;
  const kindKey =
    kind === "keyframe"
      ? "keyframe"
      : kind === "voice" || kind === "sfx" || kind === "music"
        ? "voice"
        : kind === "merge" || kind === "edit"
          ? "merge"
          : "video";
  return (
    registry.get(key(kindKey, providerId)) ||
    registry.get(key(kindKey, providerId.toLowerCase())) ||
    resolveAdapter(registry, providerId)
  );
}

export type { MediaProviderAdapter, AdapterPorts };
export {
  createKlingAdapter,
  createSeedanceAdapter,
  createGrokVideoAdapter,
  createImageAdapter,
  createVoiceAdapter,
  createMergeAdapter,
};
