/**
 * FFmpeg mastering adapter — clean runtime boundary.
 * Does not claim execution when FFmpeg is unavailable.
 * Authoritative mux remains server-side (/api/runtime/video); this adapter
 * builds a portable render plan and optionally invokes a provided executor.
 */

import type { EditorialTimeline, DeliveryVariant } from "../types";
import type { MasteringJob, MasteringRuntimeAdapter } from "./types";
import { framesToSec } from "../timebase";

export interface FfmpegRenderPlan {
  adapterId: "ffmpeg";
  concatInputs: Array<{ url: string; clipId: string; startSec: number; endSec: number }>;
  audioUrl?: string;
  output: {
    width: number;
    height: number;
    frameRate: number;
    codec: string;
    container: string;
    aspectRatio: string;
  };
  transitions: Array<{ type: string; atSec: number; durationSec: number }>;
  captions: Array<{ text: string; startSec: number; endSec: number; burnIn: boolean }>;
  audioMix: Array<{ kind: string; gainDb: number; startSec: number; endSec: number }>;
  reframe?: DeliveryVariant["reframe"];
  /** Suggested argv sketch — not executed in browser */
  suggestedFilterGraphNotes: string[];
}

export function buildFfmpegRenderPlan(
  timeline: EditorialTimeline,
  variant: DeliveryVariant
): FfmpegRenderPlan {
  const video = timeline.tracks.find((t) => t.kind === "video");
  const narration = timeline.tracks.find((t) => t.kind === "narration");
  const concatInputs = (video?.clips || [])
    .filter((c) => c.sourceUrl)
    .map((c) => ({
      url: c.sourceUrl!,
      clipId: c.id,
      startSec: framesToSec(c.sourceStartFrames, timeline.frameRate),
      endSec: framesToSec(c.sourceEndFrames, timeline.frameRate),
    }));

  const audioUrl = narration?.clips.find((c) => c.sourceUrl)?.sourceUrl;

  return {
    adapterId: "ffmpeg",
    concatInputs,
    audioUrl,
    output: {
      width: variant.resolution.width,
      height: variant.resolution.height,
      frameRate: variant.frameRate,
      codec: variant.codec,
      container: variant.container,
      aspectRatio: variant.aspectRatio,
    },
    transitions: timeline.transitions.map((t) => ({
      type: t.type,
      atSec: framesToSec(t.atFrames, timeline.frameRate),
      durationSec: framesToSec(t.durationFrames, timeline.frameRate),
    })),
    captions: timeline.captions.map((c) => ({
      text: c.text,
      startSec: framesToSec(c.startFrames, timeline.frameRate),
      endSec: framesToSec(c.endFrames, timeline.frameRate),
      burnIn: c.renderMode === "burn_in" || c.renderMode === "both" || variant.captionPolicy === "burn_in",
    })),
    audioMix: timeline.audioMix.map((m) => ({
      kind: m.kind,
      gainDb: m.gainDb,
      startSec: framesToSec(m.startFrames, timeline.frameRate),
      endSec: framesToSec(m.endFrames, timeline.frameRate),
    })),
    reframe: variant.reframe,
    suggestedFilterGraphNotes: [
      "concat demuxer for cut transitions",
      "xfade filter for dissolve when duration > 0",
      "scale+crop for variant reframe",
      "sidechaincompress / volume for ducking",
      "subtitles filter for burn-in; write .srt for sidecar",
    ],
  };
}

export type FfmpegExecutor = (plan: FfmpegRenderPlan, job: MasteringJob) => Promise<{
  ok: boolean;
  mediaUrl?: string;
  mimeType?: string;
  durationSec?: number;
  fileSizeBytes?: number;
  codec?: string;
  container?: string;
  error?: { code: string; message: string; retryable: boolean };
}>;

/**
 * Create FFmpeg adapter. Without an executor, reports deferred (safe contract).
 */
export function createFfmpegAdapter(options?: {
  executor?: FfmpegExecutor;
  probeAvailable?: () => Promise<boolean>;
}): MasteringRuntimeAdapter {
  return {
    id: "ffmpeg",
    async available() {
      if (options?.probeAvailable) return options.probeAvailable();
      // Browser / unit-test environments: not available unless executor provided
      return Boolean(options?.executor);
    },
    async render({ job, timeline, variant }) {
      const plan = buildFfmpegRenderPlan(timeline, variant);
      if (!plan.concatInputs.length) {
        return {
          ok: false,
          error: {
            code: "no_inputs",
            message: "No source URLs available for mastering",
            retryable: false,
          },
        };
      }
      if (!options?.executor) {
        return {
          ok: false,
          deferred: true,
          error: {
            code: "ffmpeg_unavailable",
            message:
              "FFmpeg runtime not available in this environment — render plan prepared; use server mastering path",
            retryable: true,
          },
          diagnostics: { planSummary: { inputs: plan.concatInputs.length, variant: variant.id } },
        };
      }
      const result = await options.executor(plan, job);
      return {
        ...result,
        codec: result.codec || variant.codec,
        container: result.container || variant.container,
        mimeType: result.mimeType || `video/${variant.container === "webm" ? "webm" : "mp4"}`,
      };
    },
  };
}

/**
 * Mock adapter for unit tests — deterministic success without FFmpeg.
 */
export function createMockMasteringAdapter(overrides?: {
  fail?: boolean;
  deferred?: boolean;
}): MasteringRuntimeAdapter {
  return {
    id: "mock",
    async available() {
      return !overrides?.deferred;
    },
    async render({ job, variant, timeline }) {
      if (overrides?.deferred) {
        return {
          ok: false,
          deferred: true,
          error: { code: "deferred", message: "deferred", retryable: true },
        };
      }
      if (overrides?.fail) {
        return {
          ok: false,
          error: { code: "render_failed", message: "mock failure", retryable: true },
        };
      }
      return {
        ok: true,
        mediaUrl: `https://cdn.example.test/masters/${job.id}.${variant.container}`,
        mimeType: "video/mp4",
        durationSec: framesToSec(timeline.durationFrames, timeline.frameRate),
        fileSizeBytes: 1_024_000,
        codec: variant.codec,
        container: variant.container,
      };
    },
  };
}
