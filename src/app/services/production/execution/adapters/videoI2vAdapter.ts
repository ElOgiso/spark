/**
 * I2V adapter — wraps existing requestProductionVideoClip /api/runtime/video path.
 * Supports: kling, seedance, grok (and ark/xai aliases).
 * Does NOT invent APIs. Higgsfield/runway/luma are not claimed here unless wired.
 */

import { isI2vApiProvider, requestProductionVideoClip } from "../../productionVideoRequest";
import type { MediaProviderAdapter, AdapterPorts, NormalizedProviderResult } from "./types";
import { normalizeProviderStatus } from "./types";
import type {
  NormalizedMediaOutput,
  ProviderCapabilitySnapshot,
  ProviderGenerationRequest,
  ProviderJob,
  ProviderJobStatus,
} from "../types";
import { classifyProviderFailure, makeExecutionError, normalizeProviderError, sanitizeDiagnostics } from "../errors";

const I2V_PROVIDERS = ["kling", "seedance", "grok", "higgsfield"] as const;

function snap(providerId: string): ProviderCapabilitySnapshot {
  return {
    providerId,
    mediaTypes: ["video"],
    strategies: ["image_to_video", "first_last_frame", "multi_reference"],
    capabilities: [
      "image_to_video",
      "first_frame_conditioning",
      providerId === "kling" || providerId === "seedance" || providerId === "higgsfield" ? "last_frame_conditioning" : "",
      "motion_quality",
    ].filter(Boolean),
    requiresCredentials:
      providerId === "grok"
        ? ["XAI_API_KEY"]
        : providerId === "kling"
        ? ["KLING_ACCESS_KEY", "KLING_SECRET_KEY"]
        : providerId === "higgsfield"
        ? ["HIGGSFIELD_API_KEY"]
        : ["ARK_API_KEY"],
    statusMechanism: "hybrid",
    knownLimitations: [
      "Requires first-frame still",
      "Duration snapped to provider-native values by runtime",
      "Polling performed inside /api/runtime/video",
    ],
  };
}

function createI2vAdapter(providerId: string, ports: AdapterPorts = {}): MediaProviderAdapter {
  const jobs = new Map<string, ProviderJobStatus>();

  return {
    providerId,
    capabilities: () => snap(providerId),

    async submit(request: ProviderGenerationRequest): Promise<ProviderJob> {
      if (!isI2vApiProvider(providerId) && providerId !== "grok") {
        throw makeExecutionError("unsupported_capability", `${providerId} is not an I2V API provider`, {
          retryable: false,
        });
      }
      const first = request.inputs.find((i) => i.role === "first_frame")?.url;
      const end = request.inputs.find((i) => i.role === "last_frame")?.url;
      const refs = request.inputs.filter((i) => i.role === "reference" || i.role === "character").map((i) => i.url!).filter(Boolean);

      try {
        const result = ports.submitVideo
          ? await ports.submitVideo(request)
          : await requestProductionVideoClip({
              provider: providerId,
              prompt: request.prompt,
              firstFrameUrl: first,
              endFrameUrl: end,
              referenceImageUrls: refs,
              aspectRatio: request.aspectRatio,
              durationSec: request.durationSec,
              model: request.model,
              resolution: request.resolution,
              productionId: request.productionId,
              brandId: request.brandId,
            }).then((r) => ({
              videoUrl: r.videoUrl,
              lastFrameDataUrl: r.lastFrameDataUrl,
              providerJobId: `i2v_${providerId}_${request.executionId}`,
              provider: r.provider,
            }));

        const status: ProviderJobStatus = {
          providerJobId: result.providerJobId,
          status: "succeeded",
          outputUrl: result.videoUrl,
          raw: {
            lastFrameDataUrl: result.lastFrameDataUrl,
            provider: result.provider,
            model: request.model,
            durationSec: request.durationSec,
            resolution: request.resolution,
          },
        };
        jobs.set(result.providerJobId, status);
        return { providerJobId: result.providerJobId, status: "succeeded", raw: status.raw };
      } catch (err: any) {
        const msg = String(err?.message || err || "I2V submit failed");
        throw makeExecutionError(classifyProviderFailure(msg), msg, { diagnostics: { providerId } });
      }
    },

    async getStatus(jobId: string): Promise<ProviderJobStatus> {
      if (ports.pollJob) return ports.pollJob(providerId, jobId);
      const cached = jobs.get(jobId);
      if (cached) return cached;
      return { providerJobId: jobId, status: "failed", errorMessage: "unknown_job" };
    },

    async cancel(jobId: string) {
      if (ports.cancelJob) return ports.cancelJob(providerId, jobId);
      // Remote cancel not exposed by /api/runtime/video — record intent only
      const cached = jobs.get(jobId);
      if (cached && cached.status !== "succeeded") {
        jobs.set(jobId, { ...cached, status: "cancelled" });
        return { cancelled: true, reason: "local_cancel_recorded" };
      }
      return { cancelled: false, reason: "provider_cancel_unsupported" };
    },

    async normalizeOutput(job: ProviderJobStatus): Promise<NormalizedMediaOutput> {
      if (!job.outputUrl) {
        throw makeExecutionError("output_unavailable", "I2V job returned no output URL");
      }
      return {
        mediaType: "video",
        sourceUrl: job.outputUrl,
        mimeType: "video/mp4",
        providerJobId: job.providerJobId,
        metadata: {
          provider: providerId,
          lastFrameDataUrl: job.raw?.lastFrameDataUrl,
        },
      };
    },

    normalizeStatus(rawStatus: unknown) {
      return normalizeProviderStatus(providerId, rawStatus);
    },

    normalizeResult(job: ProviderJobStatus): NormalizedProviderResult {
      const url = job.outputUrl || (job.raw?.videoUrl as string) || (job.raw?.url as string) || "";
      const normStatus = normalizeProviderStatus(providerId, job.status);
      const usage = this.extractUsage ? this.extractUsage(job) : undefined;
      return {
        provider: providerId,
        model: (job.raw?.model as string) || undefined,
        providerJobId: job.providerJobId,
        status: normStatus,
        outputs: url
          ? [
              {
                type: "video",
                url,
                mimeType: "video/mp4",
                durationSec: typeof job.raw?.durationSec === "number" ? job.raw.durationSec : undefined,
                width: typeof job.raw?.width === "number" ? job.raw.width : undefined,
                height: typeof job.raw?.height === "number" ? job.raw.height : undefined,
              },
            ]
          : [],
        usage,
        metadata:
          sanitizeDiagnostics({
            provider: providerId,
            ...(job.raw?.lastFrameDataUrl ? { lastFrameDataUrl: job.raw.lastFrameDataUrl } : {}),
            ...job.raw,
          }) || { provider: providerId },
        rawStatus: typeof job.status === "string" ? job.status : String(job.status || ""),
      };
    },

    extractUsage(job: ProviderJobStatus): import("../../economics/types").ProviderUsageReport | undefined {
      const raw = job.raw || {};
      const durationSec = typeof raw.durationSec === "number" ? raw.durationSec : typeof raw.duration === "number" ? raw.duration : undefined;
      const resolution = typeof raw.resolution === "string" ? raw.resolution : undefined;
      const billedDuration = typeof raw.billedDurationSeconds === "number" ? raw.billedDurationSeconds : durationSec;

      if (durationSec === undefined && resolution === undefined && billedDuration === undefined && raw.computeUnits === undefined) {
        return undefined;
      }

      return {
        durationSeconds: durationSec,
        resolution,
        billedDurationSeconds: billedDuration,
        computeUnits: typeof raw.computeUnits === "number" ? raw.computeUnits : undefined,
        raw,
      };
    },

    normalizeError(err: unknown): import("./types").ProviderError {
      return normalizeProviderError(err, providerId);
    },
  };
}

export function createKlingAdapter(ports?: AdapterPorts): MediaProviderAdapter {
  return createI2vAdapter("kling", ports);
}
export function createSeedanceAdapter(ports?: AdapterPorts): MediaProviderAdapter {
  return createI2vAdapter("seedance", ports);
}
export function createGrokVideoAdapter(ports?: AdapterPorts): MediaProviderAdapter {
  return createI2vAdapter("grok", ports);
}
export function createHiggsfieldVideoAdapter(ports?: AdapterPorts): MediaProviderAdapter {
  return createI2vAdapter("higgsfield", ports);
}

export { I2V_PROVIDERS };
