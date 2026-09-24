import assert from "node:assert/strict";
import test from "node:test";
import type { Production, ProductionAsset } from "../../domain/types";
import { legacyProductionToSpec } from "./specification/adapters";
import { assembleEditorialTimeline } from "./editorial/assembly";
import { validateEditorialTimeline } from "./editorial/validation";
import { buildAudioMixInstructions } from "./editorial/audioMix";
import { buildFfmpegRenderPlan, createFfmpegAdapter } from "./editorial/mastering/ffmpegAdapter";
import { createMasteringService } from "./editorial/mastering/masteringService";

function fixture() {
  const spec = legacyProductionToSpec({ production: {
    id: "audio-production", title: "Audio", mode: "hybrid", scenes: [], status: "Drafting", dateCreated: "2026-09-24", formats: [],
    brief: { title: "Audio", storyboard: [
      { sceneNumber: 1, duration: "4s", audio: "talent", spokenLines: "Hook", visualDescription: "Host" },
      { sceneNumber: 2, duration: "6s", audio: "vo", spokenLines: "Explanation", visualDescription: "Evidence" },
    ] },
  } as Production });
  for (const scene of spec.scenes) for (const shot of scene.shots) { shot.qcStatus = "pass"; shot.generationStatus = "approved"; }
  const assets: ProductionAsset[] = spec.scenes.flatMap(scene => scene.shots.map(shot => ({
    id: `asset_${shot.id}`, productionId: spec.project.id, sceneId: scene.id, shotId: shot.id,
    assetType: "video", publicUrl: `https://example.test/${shot.id}.mp4`, duration: String(shot.durationSec), status: "completed", generationSettings: { hasAudio: true },
  })));
  const voice: ProductionAsset = { id: "voice", productionId: spec.project.id, assetType: "audio", publicUrl: "https://example.test/voice.mp3", duration: "6s", role: "narration", status: "completed" };
  assets.push(voice);
  return { spec, assets, voice };
}
const assemble = (f: ReturnType<typeof fixture>) => assembleEditorialTimeline(f.spec, { assets: f.assets, qcVerdict: "production_ready" });

test("Phase 15: measured narration begins after Hybrid dialogue with independent source trim", () => {
  const f = fixture();
  const timeline = assemble(f);
  const narration = timeline.tracks.find(t => t.kind === "narration")!.clips;
  assert.equal(narration.length, 1);
  assert.equal(narration[0].timelineStartFrames, 120);
  assert.equal(narration[0].sourceStartFrames, 0);
  assert.equal(narration[0].sourceEndFrames, 180);
  assert.equal(narration[0].timingBasis, "measured");
  assert.ok(timeline.provenance.assembledFromAssetIds.includes("voice"));
  assert.equal(validateEditorialTimeline(timeline, f.spec).errors.length, 0);
  const plan = buildFfmpegRenderPlan(timeline, timeline.variants[0]);
  assert.equal(plan.audioInputs.find(input => input.role === "dialogue")?.embedded, true);
  assert.equal(plan.audioInputs.find(input => input.role === "narration")?.timelineStartSec, 4);
});

test("Phase 15: unrelated, failed, ambiguous and cross-production audio cannot satisfy narration", () => {
  for (const variant of ["music", "failed", "foreign", "ambiguous"]) {
    const f = fixture();
    if (variant === "music") f.voice.role = "music";
    if (variant === "failed") f.voice.status = "failed";
    if (variant === "foreign") f.voice.productionId = "other";
    if (variant === "ambiguous") f.assets.push({ ...f.voice, id: "voice-other" });
    const timeline = assemble(f);
    assert.equal(timeline.status, "incomplete", variant);
    assert.ok(validateEditorialTimeline(timeline, f.spec).errors.some(error => error.code === "missing_audio"), variant);
  }
});

test("Phase 15: soundtrack carries all lanes, source offsets, loop, gain and mastering targets", () => {
  const f = fixture();
  f.spec.audio.mastering = { targetLufs: -16, truePeakDbtp: -1 };
  for (const kind of ["music", "sfx", "ambience"] as const) {
    f.assets.push({ ...f.voice, id: kind, role: kind, publicUrl: `https://example.test/${kind}.mp3`, duration: "2s" });
  }
  f.spec.audio.tracks = [
    { id: "nar", kind: "narration", description: "Voice", mandatory: true, assetId: "voice", startSec: 4 },
    { id: "dlg", kind: "dialogue", description: "Host", mandatory: true, sceneId: f.spec.scenes[0].id },
    { id: "music", kind: "music", description: "Bed", mandatory: true, assetId: "music", loop: true, volume: 0.6 },
    { id: "amb", kind: "ambience", description: "Room", mandatory: false, assetId: "ambience", loop: true },
    { id: "sfx", kind: "sfx", description: "Hit", mandatory: false, assetId: "sfx", startSec: 5, endSec: 6, sourceStartSec: 1 },
  ];
  const timeline = assemble(f);
  const plan = buildFfmpegRenderPlan(timeline, timeline.variants[0]);
  assert.equal(plan.audioInputs.length, 5);
  assert.equal(plan.audioInputs.find(input => input.role === "music")?.loop, true);
  assert.equal(plan.audioInputs.find(input => input.role === "music")?.sourceEndSec, 2);
  assert.equal(plan.audioInputs.find(input => input.role === "music")?.timelineEndSec, 10);
  assert.equal(plan.audioInputs.find(input => input.role === "sfx")?.sourceStartSec, 1);
  assert.equal(plan.audioMix.find(mix => mix.kind === "duck")?.duckDb, -8);
  assert.ok(plan.audioMix.every(mix => mix.targetTrackId));
  assert.equal(plan.audioMastering?.targetLufs, -16);
  assert.equal(plan.audioTarget.sampleRateHz, timeline.variants[0].audioTarget.sampleRateHz);
});

test("Phase 15: conversion selects only the converted output and preserves its source lineage", () => {
  const f = fixture();
  f.spec.audio.tracks = [{ id: "converted", kind: "narration", description: "Converted voice", mandatory: true, sceneId: f.spec.scenes[1].id, voiceConversion: { sourceAssetId: "voice", targetVoiceRef: "brand-voice", outputAssetId: "converted-voice" } }];
  assert.ok(assemble(f).unresolvedDependencies.some(item => item.message.includes("Converted voice")));
  f.assets.push({ ...f.voice, id: "converted-voice", publicUrl: "https://example.test/converted.mp3" });
  const timeline = assemble(f);
  const clips = timeline.tracks.find(track => track.kind === "narration")!.clips;
  assert.equal(clips.length, 1);
  assert.equal(clips[0].assetId, "converted-voice");
  assert.deepEqual(clips[0].provenance.sourceAssetIds, ["converted-voice", "voice"]);
});

test("Phase 15: measured speech overflow requires retiming; explicit trimming is honored", () => {
  const f = fixture(); f.voice.duration = "8s";
  assert.ok(assemble(f).unresolvedDependencies.some(item => item.message.includes("retime")));
  f.spec.audio.tracks = [{ id: "trim", kind: "narration", description: "Intentional cut", mandatory: true, assetId: "voice", startSec: 4, endSec: 10, sourceStartSec: 2 }];
  const timeline = assemble(f);
  assert.equal(timeline.unresolvedDependencies.length, 0);
  assert.equal(timeline.tracks.find(track => track.kind === "narration")!.clips[0].sourceEndFrames, 240);
});

test("Phase 15: ducking covers every lane, respects mute, and fades stay inside short timelines", () => {
  const f = fixture(); const timeline = assemble(f);
  const music = timeline.tracks.find(track => track.kind === "music")!;
  timeline.tracks.push({ ...music, id: "second-music", lane: 1 });
  timeline.durationFrames = 15;
  const mix = buildAudioMixInstructions({ timeline, hasMusic: true });
  assert.ok(mix.some(item => item.targetTrackId === "second-music"));
  assert.ok(mix.every(item => item.startFrames >= 0 && item.endFrames <= 15));
  music.muted = true;
  assert.ok(!buildAudioMixInstructions({ timeline, hasMusic: true }).some(item => item.targetTrackId === music.id));
});

test("Phase 15: existing mastering executor receives the complete soundtrack", async () => {
  const f = fixture(); const timeline = assemble(f); let calls = 0;
  const adapter = createFfmpegAdapter({ executor: async plan => {
    calls++;
    assert.equal(plan.audioInputs.filter(input => !input.embedded).length, 1);
    assert.equal(plan.audioInputs.find(input => input.role === "narration")?.timelineStartSec, 4);
    return { ok: true, mediaUrl: "https://example.test/master.mp4", durationSec: 10 };
  } });
  const service = createMasteringService({ adapter });
  const input = { timeline, variant: timeline.variants[0], productionId: f.spec.project.id };
  const result = await service.executeJob(await service.createJob(input), input);
  assert.equal(calls, 1);
  assert.equal(result.ok, true);
  assert.ok(result.output?.sourceAssetIds.includes("voice"));
});

test("Phase 15: missing mandatory audio prevents mastering executor submission", async () => {
  const f = fixture(); f.assets = f.assets.filter(asset => asset.id !== "voice");
  const timeline = assemble(f); let called = false;
  const service = createMasteringService({ adapter: createFfmpegAdapter({ executor: async () => { called = true; return { ok: true }; } }) });
  const input = { timeline, variant: timeline.variants[0], productionId: f.spec.project.id };
  const result = await service.executeJob(await service.createJob(input), input);
  assert.equal(called, false);
  assert.equal(result.ok, false);
  assert.equal(result.job.error?.code, "audio_not_ready");
});

test("Phase 15: one scene's narration is not duplicated across multiple coverage shots", () => {
  const f = fixture();
  const scene = f.spec.scenes[1]; const shot = scene.shots[0];
  shot.durationSec = 3;
  scene.shots.push({ ...shot, id: "coverage", index: 1, narration: undefined });
  f.assets.push({ ...f.assets[1], id: "coverage-asset", shotId: "coverage", duration: "3s" });
  const clips = assemble(f).tracks.find(track => track.kind === "narration")!.clips;
  assert.equal(clips.length, 1);
  assert.equal(clips[0].timelineEndFrames - clips[0].timelineStartFrames, 180);
});

test("Phase 15: scene sound cues retain placement and explicit voice masters do not fall back", () => {
  const f = fixture();
  f.spec.scenes[1].ambience = "Quiet office";
  f.spec.scenes[1].soundEffects = ["Keyboard click"];
  let timeline = assemble(f);
  assert.equal(timeline.tracks.find(track => track.kind === "ambience")!.clips[0].timelineStartFrames, 120);
  assert.equal(timeline.tracks.find(track => track.kind === "sfx")!.clips[0].timelineStartFrames, 120);
  f.spec.audio.tracks.find(track => track.kind === "narration")!.voiceMasterRef = "selected-voice";
  assert.ok(assemble(f).unresolvedDependencies.some(item => item.kind === "missing_audio"));
  f.voice.masterRef = "selected-voice";
  timeline = assemble(f);
  assert.equal(timeline.unresolvedDependencies.length, 0);
});
