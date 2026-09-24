/**
 * FFmpeg mastering adapter — clean runtime boundary.
 * Does not claim execution when FFmpeg is unavailable.
 * Authoritative mux remains server-side (/api/runtime/video); this adapter
 * builds a portable render plan and optionally invokes a provided executor.
 */

import type { EditorialTimeline, DeliveryVariant, EditorialClip } from "../types";
import type { MasteringJob, MasteringRuntimeAdapter } from "./types";
import { validateEditorialTimeline } from "../validation";
import { framesToSec } from "../timebase";

export interface FfmpegRenderPlan {
  adapterId: "ffmpeg";
  concatInputs: Array<{ url: string; clipId: string; mediaType: EditorialClip["mediaType"]; timelineStartSec: number; timelineEndSec: number; playbackRate: number; startSec: number; endSec: number; volume: number; muted: boolean; volumeAutomation: Array<{ atSec: number; gainDb: number }> }>;
  /** Legacy convenience only; audioInputs is authoritative. */
  audioUrl?: string;
  audioInputs: Array<{
    url: string; clipId: string; trackId: string; role: string;
    assetId?: string; sourceStartSec: number; sourceEndSec: number;
    timelineStartSec: number; timelineEndSec: number; volume: number;
    muted: boolean; loop: boolean; embedded: boolean; playbackRate: number;
    timingBasis?: EditorialClip["timingBasis"];
    volumeAutomation: Array<{ atSec: number; gainDb: number }>;
    voiceConversion?: EditorialClip["voiceConversion"];
  }>;
  audioMastering?: EditorialTimeline["audioMastering"];
  audioTarget: DeliveryVariant["audioTarget"];
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
  audioMix: Array<{ kind: string; gainDb: number; startSec: number; endSec: number; targetTrackId: string; triggerTrackId?: string; duckDb?: number; priority: number }>;
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
      mediaType: c.mediaType,
      timelineStartSec: framesToSec(c.timelineStartFrames, timeline.frameRate),
      timelineEndSec: framesToSec(c.timelineEndFrames, timeline.frameRate),
      playbackRate: c.playbackRate,
      volume: c.volume,
      muted: c.muted || Boolean(video?.muted),
      volumeAutomation: c.volumeAutomation.map(point => ({ atSec: framesToSec(point.atFrames, timeline.frameRate), gainDb: point.gainDb })),
      startSec: framesToSec(c.sourceStartFrames, timeline.frameRate),
      endSec: framesToSec(c.sourceEndFrames, timeline.frameRate),
    }));

  const audioUrl = narration?.clips.find((c) => c.sourceUrl)?.sourceUrl;
  const audioInputs = timeline.tracks.filter(track => ["narration", "dialogue", "music", "sfx", "ambience"].includes(track.kind))
    .flatMap(track => track.clips.filter(clip => clip.sourceUrl).map(clip => ({
      url: clip.sourceUrl!, clipId: clip.id, trackId: track.id, role: track.kind, assetId: clip.assetId,
      sourceStartSec: framesToSec(clip.sourceStartFrames, timeline.frameRate), sourceEndSec: framesToSec(clip.sourceEndFrames, timeline.frameRate),
      timelineStartSec: framesToSec(clip.timelineStartFrames, timeline.frameRate), timelineEndSec: framesToSec(clip.timelineEndFrames, timeline.frameRate),
      volume: clip.volume, muted: clip.muted || Boolean(track.muted) || (timeline.tracks.some(item => item.solo) && !track.solo),
      loop: clip.loop === true, embedded: clip.audioSource === "embedded", playbackRate: clip.playbackRate,
      timingBasis: clip.timingBasis, voiceConversion: clip.voiceConversion,
      volumeAutomation: clip.volumeAutomation.map(point => ({ atSec: framesToSec(point.atFrames, timeline.frameRate), gainDb: point.gainDb })),
    })));

  return {
    adapterId: "ffmpeg",
    concatInputs,
    audioUrl,
    audioInputs,
    audioMastering: timeline.audioMastering,
    audioTarget: variant.audioTarget,
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
      targetTrackId: m.targetTrackId,
      triggerTrackId: m.triggerTrackId,
      duckDb: m.duckDb,
      priority: m.priority,
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
      const validation = validateEditorialTimeline(timeline);
      if (validation.errors.some(issue => issue.code === "missing_audio" || issue.code === "invalid_audio_timing")) {
        return { ok: false, error: { code: "audio_not_ready", message: "Required audio sources or timing are unresolved", retryable: false } };
      }
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
 * Live mastering port: reuse AssetService (or prior) master URL — do not invent CDN masters.
 * Editorial still assembles timeline; this adapter only certifies the existing deliverable.
 */
export function createExistingMasterPassthroughAdapter(
  getMasterUrl: () => string | undefined | null
): MasteringRuntimeAdapter {
  return {
    id: "existing_master_passthrough",
    async available() {
      return Boolean(String(getMasterUrl() || "").trim());
    },
    async render({ job, variant }) {
      const mediaUrl = String(getMasterUrl() || "").trim();
      if (!mediaUrl) {
        return {
          ok: false,
          deferred: true,
          error: {
            code: "no_existing_master",
            message: "No AssetService master URL available for passthrough mastering",
            retryable: true,
          },
        };
      }
      return {
        ok: true,
        mediaUrl,
        mimeType: "video/mp4",
        codec: variant.codec,
        container: variant.container,
        diagnostics: {
          source: "asset_service_master",
          jobId: job.id,
        },
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
