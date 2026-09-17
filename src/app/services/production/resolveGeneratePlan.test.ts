import assert from "node:assert/strict";
import test from "node:test";
import { resolveGeneratePlan } from "./resolveGeneratePlan";
import type { ProductionBrief, CreditSettings } from "../../domain/types";

test("resolveGeneratePlan: express/narrator mode", () => {
  const brief: ProductionBrief = {
    title: "Express Test",
    beats: [
      { scene: 1, duration: "0-5s", audio: "vo", visualDescription: "Slide 1" },
      { scene: 2, duration: "5-10s", audio: "vo", visualDescription: "Slide 2" },
    ],
  };

  const plan = resolveGeneratePlan("narrator", brief);
  assert.equal(plan.normalizedMode, "express");
  assert.equal(plan.skipExternalVoice, false);
  assert.equal(plan.skipSfx, false);
  assert.equal(plan.skipI2V, true);
  assert.equal(plan.videoStageLabel, "Narrator Slideshow Compilation");
  assert.equal(plan.voiceStageLabel, "Voiceover synthesis");

  const voiceStage = plan.stages.find((s) => s.id === "voice");
  assert.equal(voiceStage?.status, "pending");

  const videoStage = plan.stages.find((s) => s.id === "video");
  assert.equal(videoStage?.status, "pending");
  assert.equal(videoStage?.label, "Narrator Slideshow Compilation");
});

test("resolveGeneratePlan: deep/cinematic mode", () => {
  const brief: ProductionBrief = {
    title: "Cinematic Test",
    beats: [
      { scene: 1, duration: "0-5s", audio: "talent", visualDescription: "Scene 1" },
      { scene: 2, duration: "5-10s", audio: "talent", visualDescription: "Scene 2" },
    ],
  };

  const plan = resolveGeneratePlan("cinematic", brief);
  assert.equal(plan.normalizedMode, "deep");
  assert.equal(plan.skipExternalVoice, true);
  assert.equal(plan.skipSfx, true);
  assert.equal(plan.skipI2V, false);
  assert.equal(plan.videoStageLabel, "Motion synthesis (Image-to-video)");
  assert.equal(plan.voiceStageLabel, "Voiceover synthesis (skipped — cinematic)");
  assert.equal(plan.sfxStageLabel, "Sound FX (skipped — cinematic)");

  const voiceStage = plan.stages.find((s) => s.id === "voice");
  assert.equal(voiceStage?.status, "skipped");
  assert.equal(voiceStage?.label, "Voiceover synthesis (skipped — cinematic)");

  const sfxStage = plan.stages.find((s) => s.id === "sfx");
  assert.equal(sfxStage?.status, "skipped");

  const videoStage = plan.stages.find((s) => s.id === "video");
  assert.equal(videoStage?.status, "pending");
});

test("resolveGeneratePlan: standard/hybrid mode with mixed beats", () => {
  const brief: ProductionBrief = {
    title: "Hybrid Mixed Test",
    beats: [
      { scene: 1, duration: "0-5s", audio: "talent", visualDescription: "Hook scene with talent motion" },
      { scene: 2, duration: "5-15s", audio: "vo", visualDescription: "Explainer scene with VO" },
    ],
  };

  const plan = resolveGeneratePlan("hybrid", brief);
  assert.equal(plan.normalizedMode, "standard");
  assert.equal(plan.skipExternalVoice, false);
  assert.equal(plan.skipSfx, false);
  assert.equal(plan.skipI2V, false);
  assert.equal(plan.voiceStageLabel, "Voiceover synthesis");

  const voiceStage = plan.stages.find((s) => s.id === "voice");
  assert.equal(voiceStage?.status, "pending");

  const videoStage = plan.stages.find((s) => s.id === "video");
  assert.equal(videoStage?.status, "pending");
});

test("resolveGeneratePlan: standard/hybrid mode with talent-only beats", () => {
  const brief: ProductionBrief = {
    title: "Hybrid Talent Only Test",
    beats: [
      { scene: 1, duration: "0-5s", audio: "talent", visualDescription: "Dialogue 1" },
      { scene: 2, duration: "5-10s", audio: "talent", visualDescription: "Dialogue 2" },
    ],
  };

  const plan = resolveGeneratePlan("standard", brief);
  assert.equal(plan.normalizedMode, "standard");
  assert.equal(plan.skipExternalVoice, true);
  assert.equal(plan.skipSfx, false);
  assert.equal(plan.skipI2V, false);
  assert.equal(plan.voiceStageLabel, "Voiceover synthesis (skipped — talent dialogue)");

  const voiceStage = plan.stages.find((s) => s.id === "voice");
  assert.equal(voiceStage?.status, "skipped");
  assert.equal(voiceStage?.label, "Voiceover synthesis (skipped — talent dialogue)");
});

test("resolveGeneratePlan: credit settings thumbnail count 0 skips thumbnails", () => {
  const creditSettings: CreditSettings = {
    thumbnailCount: 0,
    keyframeCount: 3,
    shortsDurationSec: 8,
    cinematicDurationSec: 12,
  };

  const plan = resolveGeneratePlan("standard", undefined, creditSettings);
  const thumbStage = plan.stages.find((s) => s.id === "thumbnails");
  assert.equal(thumbStage?.status, "skipped");
  assert.equal(thumbStage?.label, "Thumbnail variants (skipped — count 0)");
});
