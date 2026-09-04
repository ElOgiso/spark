/**
 * Phase 6 — Editorial timeline, assembly & mastering tests (mocks only — no FFmpeg/credentials).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createProductionPlan } from "./intelligence/productionOrchestrator";
import type { ProductionAsset } from "../../domain/types";
import {
  assembleEditorialTimeline,
  validateEditorialTimeline,
  decideEditorialAction,
  buildEditorialTimeline,
  planTransitions,
  secToFrames,
  framesToSec,
  normalizeTransition,
  buildAudioMixInstructions,
  buildCaptionsFromSpec,
  captionsToSrtPreview,
  createDefaultVariants,
  planReframe,
  runEditorialPipeline,
  createMasteringService,
  createMockMasteringAdapter,
  createFfmpegAdapter,
  buildFfmpegRenderPlan,
  validateMasterOutput,
  transitionMastering,
  canTransitionMastering,
  masteringIdempotencyKey,
  cancelMasteringJob,
  userFacingEditorialStatus,
  evaluateShotEligibility,
} from "./editorial";

function baseSpec() {
  const { spec } = createProductionPlan({
    idea: "Documentary short about a coastal town with narration and score",
  });
  assert.ok(spec);
  return spec!;
}

function approvedAssetsForSpec(spec: ReturnType<typeof baseSpec>): ProductionAsset[] {
  const assets: ProductionAsset[] = [];
  for (const scene of spec.scenes) {
    for (const shot of scene.shots) {
      assets.push({
        id: `asset_${shot.id}`,
        productionId: spec.project.id,
        shotId: shot.id,
        sceneId: scene.id,
        taskId: `task_${shot.id}`,
        assetType: "video",
        publicUrl: `https://cdn.example.test/${shot.id}.mp4`,
        mimeType: "video/mp4",
        duration: String(shot.durationSec || 4),
        status: "completed",
        createdAt: new Date().toISOString(),
      });
    }
  }
  if (spec.audio.hasNarration) {
    assets.push({
      id: "asset_voice",
      productionId: spec.project.id,
      assetType: "audio",
      publicUrl: "https://cdn.example.test/voice.mp3",
      mimeType: "audio/mpeg",
      status: "completed",
      createdAt: new Date().toISOString(),
    });
  }
  return assets;
}

describe("timebase", () => {
  it("converts seconds and frames deterministically", () => {
    assert.equal(secToFrames(1, 30), 30);
    assert.equal(framesToSec(90, 30), 3);
    assert.equal(secToFrames(1.5, 30), 45);
  });
});

describe("timeline placement", () => {
  it("preserves scene and shot order with deterministic durations", () => {
    const spec = baseSpec();
    const assets = approvedAssetsForSpec(spec);
    // Mark shots approved
    for (const scene of spec.scenes) {
      for (const shot of scene.shots) {
        shot.qcStatus = "pass";
        shot.generationStatus = "approved";
      }
    }
    const tl = assembleEditorialTimeline(spec, {
      assets,
      qcVerdict: "production_ready",
    });
    const video = tl.tracks.find((t) => t.kind === "video");
    assert.ok(video);
    assert.ok(video!.clips.length > 0);

    const planned = spec.scenes.flatMap((s) => s.shots.map((sh) => sh.id));
    const assembled = video!.clips.map((c) => c.shotId);
    assert.deepEqual(assembled, planned.slice(0, assembled.length));

    // Contiguous placement
    for (let i = 1; i < video!.clips.length; i++) {
      assert.equal(video!.clips[i].timelineStartFrames, video!.clips[i - 1].timelineEndFrames);
    }

    // Duration equals sum of clip lengths
    const sum = video!.clips.reduce(
      (n, c) => n + (c.timelineEndFrames - c.timelineStartFrames),
      0
    );
    assert.equal(tl.durationFrames, sum);
  });

  it("legacy buildEditorialTimeline still works", () => {
    const spec = baseSpec();
    const legacy = buildEditorialTimeline(spec);
    assert.ok(legacy.durationSec > 0);
    assert.ok(legacy.tracks.some((t) => t.kind === "video_primary"));
    assert.ok(legacy.canonical);
    const transitions = planTransitions(legacy);
    assert.ok(Array.isArray(transitions));
  });

  it("normalizes transitions without baking into assets", () => {
    assert.equal(normalizeTransition("crossfade"), "dissolve");
    assert.equal(normalizeTransition("fade in"), "fade_in");
    const spec = baseSpec();
    for (const scene of spec.scenes) {
      for (const shot of scene.shots) {
        shot.qcStatus = "pass";
        shot.generationStatus = "approved";
        shot.transitionOut = "dissolve";
      }
    }
    const tl = assembleEditorialTimeline(spec, {
      assets: approvedAssetsForSpec(spec),
      qcVerdict: "production_ready",
    });
    assert.ok(tl.transitions.some((t) => t.type === "dissolve"));
  });
});

describe("asset assembly + provenance", () => {
  it("uses approved assets and preserves provenance chain", () => {
    const spec = baseSpec();
    for (const scene of spec.scenes) {
      for (const shot of scene.shots) {
        shot.qcStatus = "pass";
        shot.generationStatus = "approved";
      }
    }
    const assets = approvedAssetsForSpec(spec);
    const tl = assembleEditorialTimeline(spec, { assets, qcVerdict: "production_ready" });
    const clip = tl.tracks.find((t) => t.kind === "video")!.clips[0];
    assert.ok(clip.assetId);
    assert.equal(clip.provenance.shotId, clip.shotId);
    assert.equal(clip.provenance.assetId, clip.assetId);
    assert.ok(tl.provenance.assembledFromAssetIds.includes(clip.assetId!));
  });

  it("excludes rejected assets and surfaces missing dependencies", () => {
    const spec = baseSpec();
    const shot = spec.scenes[0].shots[0];
    shot.qcStatus = "fail";
    shot.generationStatus = "qc_failed";
    const assets = approvedAssetsForSpec(spec);
    const tl = assembleEditorialTimeline(spec, { assets, qcVerdict: "production_ready" });
    assert.ok(tl.unresolvedDependencies.some((d) => d.shotId === shot.id));
    const video = tl.tracks.find((t) => t.kind === "video")!;
    assert.equal(video.clips.some((c) => c.shotId === shot.id), false);
  });

  it("does not silently substitute unrelated media", () => {
    const spec = baseSpec();
    const assets: ProductionAsset[] = [
      {
        id: "unrelated",
        productionId: "other",
        shotId: "not_a_real_shot",
        assetType: "video",
        publicUrl: "https://cdn.example.test/wrong.mp4",
        status: "completed",
      },
    ];
    const tl = assembleEditorialTimeline(spec, { assets, qcVerdict: "production_ready" });
    const video = tl.tracks.find((t) => t.kind === "video");
    assert.ok(!video?.clips.length || video.clips.every((c) => c.assetId !== "unrelated"));
    assert.ok(tl.unresolvedDependencies.length > 0);
  });

  it("prefers newer regenerated asset version", () => {
    const spec = baseSpec();
    const shot = spec.scenes[0].shots[0];
    shot.qcStatus = "pass";
    shot.generationStatus = "approved";
    const older: ProductionAsset = {
      id: "old",
      productionId: spec.project.id,
      shotId: shot.id,
      assetType: "video",
      publicUrl: "https://cdn.example.test/old.mp4",
      status: "completed",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const newer: ProductionAsset = {
      ...older,
      id: "new",
      publicUrl: "https://cdn.example.test/new.mp4",
      createdAt: "2026-09-01T00:00:00.000Z",
    };
    const el = evaluateShotEligibility({ shot, assets: [older, newer] });
    assert.equal(el.asset?.id, "new");
  });
});

describe("editorial validation", () => {
  it("flags missing dependencies and invalid source ranges", () => {
    const spec = baseSpec();
    const tl = assembleEditorialTimeline(spec, {
      assets: [],
      qcVerdict: "production_ready",
    });
    const v = validateEditorialTimeline(tl, spec);
    assert.equal(v.status, "invalid");
    assert.ok(v.unresolvedDependencies.length > 0 || v.errors.length > 0);

    // Corrupt a planned timeline
    const planned = assembleEditorialTimeline(spec, { allowPlannedWithoutAssets: true });
    const clip = planned.tracks.find((t) => t.kind === "video")!.clips[0];
    clip.sourceEndFrames = clip.sourceStartFrames;
    const bad = validateEditorialTimeline(planned, spec);
    assert.ok(bad.errors.some((e) => e.code === "invalid_source_range"));
  });

  it("detects overlapping video clips", () => {
    const spec = baseSpec();
    const tl = assembleEditorialTimeline(spec, { allowPlannedWithoutAssets: true });
    const video = tl.tracks.find((t) => t.kind === "video")!;
    if (video.clips.length >= 2) {
      video.clips[1].timelineStartFrames = video.clips[0].timelineStartFrames;
      const v = validateEditorialTimeline(tl, spec);
      assert.ok(v.errors.some((e) => e.code === "overlapping_clips"));
    }
  });
});

describe("audio editorial", () => {
  it("builds ducking, fades, and gain instructions", () => {
    const spec = baseSpec();
    for (const scene of spec.scenes) {
      for (const shot of scene.shots) {
        shot.qcStatus = "pass";
        shot.generationStatus = "approved";
        shot.narration = shot.narration || "Narration line";
      }
    }
    spec.audio.hasMusic = true;
    spec.audio.hasNarration = true;
    const tl = assembleEditorialTimeline(spec, {
      assets: approvedAssetsForSpec(spec),
      qcVerdict: "production_ready",
    });
    const mix = buildAudioMixInstructions({ timeline: tl, hasMusic: true });
    assert.ok(mix.some((m) => m.kind === "fade_in"));
    assert.ok(mix.some((m) => m.kind === "fade_out"));
    assert.ok(mix.some((m) => m.kind === "gain"));
    assert.ok(mix.some((m) => m.kind === "duck"));
  });
});

describe("captions", () => {
  it("represents timing, language, and sidecar output", () => {
    const cues = buildCaptionsFromSpec({
      spec: baseSpec(),
      frameRate: 30,
      language: "en",
      renderMode: "sidecar",
      shotPlacements: [
        {
          shotId: "s1",
          sceneId: "sc1",
          startFrames: 0,
          endFrames: 90,
          dialogue: "Hello world",
        },
      ],
    });
    assert.equal(cues[0].language, "en");
    assert.equal(cues[0].startFrames, 0);
    const srt = captionsToSrtPreview(cues, 30);
    assert.match(srt, /Hello world/);
    assert.match(srt, /-->/);
  });
});

describe("variants + reframe", () => {
  it("creates delivery variants and crop strategy", () => {
    const variants = createDefaultVariants({
      masterAspect: "16:9",
      masterWidth: 1920,
      masterHeight: 1080,
      frameRate: 30,
    });
    assert.ok(variants.some((v) => v.aspectRatio === "9:16"));
    assert.ok(variants.some((v) => v.aspectRatio === "1:1"));
    const crop = planReframe({
      sourceWidth: 1920,
      sourceHeight: 1080,
      targetWidth: 1080,
      targetHeight: 1920,
      strategy: "center",
    });
    assert.ok(crop.width < 1 || crop.height < 1);
    assert.equal(crop.strategy, "center");
  });
});

describe("decision engine + automation", () => {
  it("blocks master on hard failures; respects modes", () => {
    const spec = baseSpec();
    const incomplete = assembleEditorialTimeline(spec, { assets: [], qcVerdict: "production_ready" });
    const validation = validateEditorialTimeline(incomplete, spec);
    const manual = decideEditorialAction({
      timeline: incomplete,
      validation,
      automationMode: "manual",
    });
    assert.equal(manual.allowMaster, false);

    // Valid planned
    const planned = assembleEditorialTimeline(spec, { allowPlannedWithoutAssets: true });
    const okVal = validateEditorialTimeline(planned, spec);
    const autonomous = decideEditorialAction({
      timeline: { ...planned, status: "ready_for_master", unresolvedDependencies: [] },
      validation: { ...okVal, status: "valid", errors: [], unresolvedDependencies: [] },
      automationMode: "autonomous",
    });
    assert.equal(autonomous.allowMaster, true);
    assert.equal(autonomous.requireReview, false);

    const balanced = decideEditorialAction({
      timeline: { ...planned, status: "ready_for_master", unresolvedDependencies: [] },
      validation: { ...okVal, status: "warning", errors: [], warnings: [{ code: "timeline_gap", severity: "warning", message: "gap" }], unresolvedDependencies: [] },
      automationMode: "balanced",
    });
    assert.equal(balanced.action, "assemble_with_warnings");
    assert.equal(balanced.requireReview, true);
  });
});

describe("mastering lifecycle", () => {
  it("supports job lifecycle, idempotency, success, failure, retry, cancel", async () => {
    assert.equal(canTransitionMastering("planned", "queued"), true);
    assert.equal(canTransitionMastering("running", "succeeded"), true);
    assert.equal(transitionMastering("succeeded", "running").ok, false);

    const spec = baseSpec();
    for (const scene of spec.scenes) {
      for (const shot of scene.shots) {
        shot.qcStatus = "pass";
        shot.generationStatus = "approved";
      }
    }
    const tl = assembleEditorialTimeline(spec, {
      assets: approvedAssetsForSpec(spec),
      qcVerdict: "production_ready",
    });
    const variant = tl.variants[0];
    const store = new Map();
    const results = new Map();
    const service = createMasteringService({
      adapter: createMockMasteringAdapter(),
      jobStore: store,
      resultStore: results,
    });

    const key = masteringIdempotencyKey(tl.id, variant.id, tl.version);
    const job1 = await service.createJob({
      timeline: tl,
      variant,
      productionId: spec.project.id,
      idempotencyKey: key,
    });
    const job2 = await service.createJob({
      timeline: tl,
      variant,
      productionId: spec.project.id,
      idempotencyKey: key,
    });
    assert.equal(job1.id, job2.id);

    const ok = await service.executeJob(job1, {
      timeline: tl,
      variant,
      productionId: spec.project.id,
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.job.status, "succeeded");
    assert.ok(ok.output?.productionAsset);
    assert.ok(ok.output?.provenance.clipIds.length);

    // Idempotent re-execute returns cached success
    const again = await service.executeJob(ok.job, {
      timeline: tl,
      variant,
      productionId: spec.project.id,
    });
    assert.equal(again.ok, true);

    // Failure + retry
    const failService = createMasteringService({
      adapter: createMockMasteringAdapter({ fail: true }),
      maxAttempts: 2,
    });
    const failJob = await failService.createJob({
      timeline: tl,
      variant,
      productionId: spec.project.id,
      idempotencyKey: key + ":fail",
    });
    const fail1 = await failService.executeJob(failJob, {
      timeline: tl,
      variant,
      productionId: spec.project.id,
    });
    assert.equal(fail1.ok, false);
    assert.ok(fail1.job.status === "retrying" || fail1.job.status === "failed" || fail1.job.status === "exhausted");

    const cancelled = await cancelMasteringJob({
      ...failJob,
      status: "queued",
    });
    assert.equal(cancelled.status, "cancelled");
  });

  it("ffmpeg adapter builds plan and defers when unavailable", async () => {
    const spec = baseSpec();
    for (const scene of spec.scenes) {
      for (const shot of scene.shots) {
        shot.qcStatus = "pass";
        shot.generationStatus = "approved";
      }
    }
    const tl = assembleEditorialTimeline(spec, {
      assets: approvedAssetsForSpec(spec),
      qcVerdict: "production_ready",
    });
    const plan = buildFfmpegRenderPlan(tl, tl.variants[0]);
    assert.equal(plan.adapterId, "ffmpeg");
    assert.ok(plan.concatInputs.length > 0);

    const adapter = createFfmpegAdapter();
    assert.equal(await adapter.available(), false);
    const service = createMasteringService({ adapter });
    const job = await service.createJob({
      timeline: tl,
      variant: tl.variants[0],
      productionId: spec.project.id,
    });
    const result = await service.executeJob(job, {
      timeline: tl,
      variant: tl.variants[0],
      productionId: spec.project.id,
    });
    assert.equal(result.deferred, true);
  });
});

describe("final master QC", () => {
  it("passes valid master and fails invalid output", () => {
    const variant = createDefaultVariants({
      masterAspect: "16:9",
      masterWidth: 1920,
      masterHeight: 1080,
      frameRate: 30,
    })[0];
    const good = validateMasterOutput({
      output: {
        masterId: "m1",
        timelineId: "t1",
        variantId: variant.id,
        productionId: "p1",
        masteringJobId: "j1",
        mediaUrl: "https://cdn.example.test/m.mp4",
        mimeType: "video/mp4",
        durationSec: 12,
        resolution: { width: 1920, height: 1080 },
        aspectRatio: "16:9",
        codec: "h264",
        sourceAssetIds: ["a1"],
        provenance: { timelineVersion: 1, clipIds: ["c1"] },
      },
      variant,
      captionCount: 1,
    });
    assert.equal(good.ok, true);

    const bad = validateMasterOutput({
      output: {
        masterId: "m2",
        timelineId: "t1",
        variantId: variant.id,
        productionId: "p1",
        masteringJobId: "j1",
        mimeType: "video/mp4",
        durationSec: 0,
        resolution: { width: 100, height: 100 },
        aspectRatio: "1:1",
        sourceAssetIds: [],
        provenance: { timelineVersion: 1, clipIds: [] },
      },
      variant,
    });
    assert.equal(bad.ok, false);
    assert.ok(bad.reasons.includes("output_missing") || bad.reasons.includes("duration_invalid"));
  });
});

describe("pipeline + user language", () => {
  it("runs assemble → validate → decide → master without exposing FFmpeg to users", async () => {
    const spec = baseSpec();
    for (const scene of spec.scenes) {
      for (const shot of scene.shots) {
        shot.qcStatus = "pass";
        shot.generationStatus = "approved";
      }
    }
    const result = await runEditorialPipeline(spec, {
      assets: approvedAssetsForSpec(spec),
      qcVerdict: "production_ready",
      automationMode: "autonomous",
      master: true,
      mastering: { adapter: createMockMasteringAdapter() },
    });
    assert.equal(result.ok, true);
    assert.equal(result.mastering?.ok, true);
    assert.match(result.timeline.userMessage, /SPARK/i);
    assert.equal(result.timeline.userMessage.toLowerCase().includes("ffmpeg"), false);
    assert.match(userFacingEditorialStatus("mastered"), /SPARK/i);
  });
});
