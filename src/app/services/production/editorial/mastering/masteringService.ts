/**
 * Provider-neutral mastering service — Phase 4-style lifecycle + idempotency.
 */

import type { ProductionAsset } from "../../../../domain/types";
import type { EditorialTimeline, DeliveryVariant } from "../types";
import type {
  MasteringCreateInput,
  MasteringJob,
  MasteringResult,
  MasteringRuntimeAdapter,
  MasteringService,
  MasterOutput,
} from "./types";
import { transitionMastering, isTerminalMastering } from "./jobStateMachine";
import { validateMasterOutput } from "./finalQc";
import { createFfmpegAdapter } from "./ffmpegAdapter";
import { framesToSec } from "../timebase";
import { userFacingMasteringMessage } from "../userMessages";

function newJobId(): string {
  return `mjob_${Math.random().toString(36).slice(2, 10)}`;
}

function newMasterId(): string {
  return `master_${Math.random().toString(36).slice(2, 10)}`;
}

export function masteringIdempotencyKey(
  timelineId: string,
  variantId: string,
  version: number
): string {
  return `master:${timelineId}:${variantId}:v${version}`;
}

export interface MasteringServiceOptions {
  adapter?: MasteringRuntimeAdapter;
  maxAttempts?: number;
  /** In-memory idempotency store */
  jobStore?: Map<string, MasteringJob>;
  resultStore?: Map<string, MasteringResult>;
}

export function createMasteringService(options: MasteringServiceOptions = {}): MasteringService {
  const adapter = options.adapter || createFfmpegAdapter();
  const maxAttempts = options.maxAttempts ?? 3;
  const jobStore = options.jobStore || new Map<string, MasteringJob>();
  const resultStore = options.resultStore || new Map<string, MasteringResult>();

  return {
    async createJob(input: MasteringCreateInput): Promise<MasteringJob> {
      const key =
        input.idempotencyKey ||
        masteringIdempotencyKey(input.timeline.id, input.variant.id, input.timeline.version);
      const existing = jobStore.get(key);
      if (existing) {
        if (existing.status === "succeeded" || !isTerminalMastering(existing.status)) {
          return existing;
        }
      }

      const job: MasteringJob = {
        id: newJobId(),
        timelineId: input.timeline.id,
        productionId: input.productionId,
        variantId: input.variant.id,
        status: "planned",
        attempt: 0,
        maxAttempts,
        idempotencyKey: key,
        createdAt: new Date().toISOString(),
      };
      jobStore.set(key, job);
      return job;
    },

    async executeJob(job: MasteringJob, input: MasteringCreateInput): Promise<MasteringResult> {
      const cached = resultStore.get(job.idempotencyKey);
      if (cached?.ok && cached.job.status === "succeeded") {
        return cached;
      }

      let current = { ...job };
      const q = transitionMastering(current.status, "queued");
      if (!q.ok && current.status !== "queued" && current.status !== "retrying") {
        if (current.status === "planned") {
          current = { ...current, status: "queued" };
        } else if (current.status === "failed") {
          const r = transitionMastering("failed", "retrying");
          if (!r.ok) {
            return fail(current, { code: "invalid_state", message: r.error, retryable: false });
          }
          current = { ...current, status: "retrying" };
          current = { ...current, status: "queued" };
        }
      } else if (q.ok) {
        current = { ...current, status: q.status };
      } else if (current.status === "retrying") {
        current = { ...current, status: "queued" };
      }

      current = {
        ...current,
        status: "running",
        attempt: current.attempt + 1,
        startedAt: new Date().toISOString(),
      };
      jobStore.set(current.idempotencyKey, current);

      const rendered = await adapter.render({
        job: current,
        timeline: input.timeline,
        variant: input.variant,
      });

      if (rendered.deferred) {
        const result: MasteringResult = {
          ok: false,
          deferred: true,
          job: { ...current, status: "failed", error: rendered.error, completedAt: new Date().toISOString() },
          userMessage: "SPARK is preparing the final version",
        };
        jobStore.set(current.idempotencyKey, result.job);
        return result;
      }

      if (!rendered.ok) {
        const retryable = rendered.error?.retryable !== false;
        if (retryable && current.attempt < current.maxAttempts) {
          const next: MasteringJob = {
            ...current,
            status: "retrying",
            error: rendered.error,
          };
          jobStore.set(current.idempotencyKey, next);
          return {
            ok: false,
            job: next,
            userMessage: userFacingMasteringMessage("retrying"),
          };
        }
        const exhausted: MasteringJob = {
          ...current,
          status: current.attempt >= current.maxAttempts ? "exhausted" : "failed",
          error: rendered.error,
          completedAt: new Date().toISOString(),
        };
        jobStore.set(current.idempotencyKey, exhausted);
        return {
          ok: false,
          job: exhausted,
          userMessage: userFacingMasteringMessage("failed"),
        };
      }

      const output = buildMasterOutput({
        job: current,
        timeline: input.timeline,
        variant: input.variant,
        mediaUrl: rendered.mediaUrl,
        mimeType: rendered.mimeType || "video/mp4",
        durationSec:
          rendered.durationSec ??
          framesToSec(input.timeline.durationFrames, input.timeline.frameRate),
        fileSizeBytes: rendered.fileSizeBytes,
        codec: rendered.codec,
        container: rendered.container,
        brandId: input.brandId,
      });

      const qc = validateMasterOutput({
        output,
        variant: input.variant,
        expectCaptions: input.variant.captionPolicy !== "none",
        captionCount: input.timeline.captions.length,
      });

      if (!qc.ok) {
        const failed: MasteringJob = {
          ...current,
          status: "failed",
          error: {
            code: "final_qc_failed",
            message: qc.reasons.join(", "),
            retryable: qc.technical.retryable,
          },
          completedAt: new Date().toISOString(),
        };
        jobStore.set(current.idempotencyKey, failed);
        return {
          ok: false,
          job: failed,
          output,
          userMessage: userFacingMasteringMessage("failed"),
        };
      }

      const succeeded: MasteringJob = {
        ...current,
        status: "succeeded",
        completedAt: new Date().toISOString(),
      };
      const result: MasteringResult = {
        ok: true,
        job: succeeded,
        output,
        userMessage: userFacingMasteringMessage("succeeded"),
      };
      jobStore.set(current.idempotencyKey, succeeded);
      resultStore.set(current.idempotencyKey, result);
      return result;
    },
  };
}

function fail(
  job: MasteringJob,
  error: { code: string; message: string; retryable: boolean }
): MasteringResult {
  return {
    ok: false,
    job: { ...job, status: "failed", error },
    userMessage: userFacingMasteringMessage("failed"),
  };
}

function buildMasterOutput(params: {
  job: MasteringJob;
  timeline: EditorialTimeline;
  variant: DeliveryVariant;
  mediaUrl?: string;
  mimeType: string;
  durationSec: number;
  fileSizeBytes?: number;
  codec?: string;
  container?: string;
  brandId?: string;
}): MasterOutput {
  const videoClips = params.timeline.tracks.find((t) => t.kind === "video")?.clips || [];
  const sourceAssetIds = [
    ...new Set(
      [
        ...params.timeline.provenance.assembledFromAssetIds,
        ...videoClips.map((c) => c.assetId).filter(Boolean),
      ].filter(Boolean) as string[]
    ),
  ];

  const masterId = newMasterId();
  const productionAsset: ProductionAsset = {
    id: `asset_${masterId}`,
    brandId: params.brandId,
    productionId: params.job.productionId,
    assetType: "video",
    publicUrl: params.mediaUrl,
    mimeType: params.mimeType,
    duration: String(params.durationSec),
    status: "completed",
    createdAt: new Date().toISOString(),
    generationSettings: {
      kind: "editorial_master",
      timelineId: params.timeline.id,
      variantId: params.variant.id,
      masteringJobId: params.job.id,
      codec: params.codec,
      container: params.container,
      resolution: params.variant.resolution,
      aspectRatio: params.variant.aspectRatio,
      sourceAssetIds,
    },
  };

  return {
    masterId,
    timelineId: params.timeline.id,
    variantId: params.variant.id,
    productionId: params.job.productionId,
    masteringJobId: params.job.id,
    mediaUrl: params.mediaUrl,
    mimeType: params.mimeType,
    durationSec: params.durationSec,
    resolution: { ...params.variant.resolution },
    aspectRatio: params.variant.aspectRatio,
    codec: params.codec,
    container: params.container,
    fileSizeBytes: params.fileSizeBytes,
    sourceAssetIds,
    provenance: {
      timelineVersion: params.timeline.version,
      clipIds: videoClips.map((c) => c.id),
    },
    productionAsset,
  };
}

export async function cancelMasteringJob(
  job: MasteringJob,
  adapter?: MasteringRuntimeAdapter
): Promise<MasteringJob> {
  if (isTerminalMastering(job.status)) return job;
  if (adapter?.cancel) {
    try {
      await adapter.cancel(job.id);
    } catch {
      // record request even if remote cancel unsupported
    }
  }
  const from = job.status === "queued" || job.status === "planned" ? job.status : "running";
  const t = transitionMastering(from === "planned" ? "queued" : from, "cancelled");
  if (!t.ok && job.status === "planned") {
    return { ...job, status: "cancelled", completedAt: new Date().toISOString() };
  }
  if (!t.ok) {
    return { ...job, status: "cancelled", completedAt: new Date().toISOString(), metadata: { cancelRequested: true } };
  }
  return { ...job, status: "cancelled", completedAt: new Date().toISOString() };
}
