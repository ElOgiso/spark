import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveChapterAudio, normalizeAudioMode } from "./chapterAudio";
import { resolveGeneratePlan } from "../resolveGeneratePlan";
import { compileLiveMotionPrompt } from "../compileLiveMotionPrompt";
import { buildScenesFromNarrativeChapters } from "./chapterToClip";
import type { NarrativeScript, ProductionBrief } from "../../../domain/types";

test("chapterAudio: normalizeAudioMode correctly maps mode aliases", () => {
  assert.equal(normalizeAudioMode("express"), "narrator");
  assert.equal(normalizeAudioMode("narrator"), "narrator");
  assert.equal(normalizeAudioMode("deep"), "cinematic");
  assert.equal(normalizeAudioMode("cinematic"), "cinematic");
  assert.equal(normalizeAudioMode("standard"), "hybrid");
  assert.equal(normalizeAudioMode("hybrid"), "hybrid");
  assert.equal(normalizeAudioMode(undefined), "hybrid");
  assert.equal(normalizeAudioMode("unknown"), "hybrid");
});

test("chapterAudio: narrator mode always routes every chapter to vo and skips I2V", () => {
  // Even if chapter or beat specifies talent or has hook/payoff job, narrator forces vo
  const audio1 = resolveChapterAudio({
    mode: "narrator",
    chapter: { audio: "talent", job: "hook" },
  });
  assert.equal(audio1, "vo");

  const audio2 = resolveChapterAudio({
    mode: "express",
    beat: { audio: "talent", valueJob: "payoff" },
  });
  assert.equal(audio2, "vo");

  // resolveGeneratePlan for narrator skips I2V
  const brief: ProductionBrief = {
    storyboard: [
      { scene: 1, durationSec: 5, audio: "vo", visualDescription: "Still 1" } as any,
      { scene: 2, durationSec: 5, audio: "vo", visualDescription: "Still 2" } as any,
    ],
  };
  const plan = resolveGeneratePlan("narrator", brief);
  assert.equal(plan.skipI2V, true, "Narrator must skip I2V as the film");
  assert.equal(plan.skipExternalVoice, false, "Narrator uses external ElevenLabs VO");
  assert.equal(plan.videoStageLabel, "Narrator Slideshow Compilation");
});

test("chapterAudio: cinematic mode always routes every chapter to talent and skips ElevenLabs", () => {
  // Even if chapter or beat specifies vo or has proof/context job, cinematic forces talent
  const audio1 = resolveChapterAudio({
    mode: "cinematic",
    chapter: { audio: "vo", job: "context" },
  });
  assert.equal(audio1, "talent");

  const audio2 = resolveChapterAudio({
    mode: "deep",
    beat: { audio: "vo", valueJob: "explainer" },
  });
  assert.equal(audio2, "talent");

  // resolveGeneratePlan for cinematic skips ElevenLabs VO and SFX
  const brief: ProductionBrief = {
    storyboard: [
      { scene: 1, durationSec: 5, audio: "talent", visualDescription: "In-world shot 1" } as any,
      { scene: 2, durationSec: 5, audio: "talent", visualDescription: "In-world shot 2" } as any,
    ],
  };
  const plan = resolveGeneratePlan("cinematic", brief);
  assert.equal(plan.skipExternalVoice, true, "Cinematic must skip ElevenLabs external voice");
  assert.equal(plan.skipI2V, false, "Cinematic generates I2V clips");
});

test("chapterAudio: hybrid mode resolves per-chapter audio correctly across 6 mixed chapters", () => {
  // 6 chapters with mixed intent and audio
  const chapters = [
    { index: 1, title: "Hook", job: "hook", spoken: "Look at this.", durationSec: 4 }, // job hook -> talent
    { index: 2, title: "Problem", job: "problem", spoken: "Most people struggle with this.", durationSec: 5 }, // job problem -> vo
    { index: 3, title: "Context", job: "context", audio: "vo", spoken: "Here is the data.", durationSec: 6 }, // explicit vo -> vo
    { index: 4, title: "Demo", job: "proof", audio: "talent", spoken: "Watch me do it live.", durationSec: 5 }, // explicit talent overrides job -> talent
    { index: 5, title: "Explainer", job: "b-roll", spoken: "Notice the details here.", durationSec: 4 }, // job b-roll -> vo
    { index: 6, title: "CTA", job: "cta", spoken: "Follow for more.", durationSec: 4 }, // job cta -> talent
  ];

  const resolved = chapters.map((c) => ({
    index: c.index,
    audio: resolveChapterAudio({ mode: "hybrid", chapter: c as any }),
  }));

  assert.deepEqual(resolved, [
    { index: 1, audio: "talent" },
    { index: 2, audio: "vo" },
    { index: 3, audio: "vo" },
    { index: 4, audio: "talent" },
    { index: 5, audio: "vo" },
    { index: 6, audio: "talent" },
  ]);

  // Build scenes from narrative chapters retains the per-chapter audio policy
  const script: NarrativeScript = {
    hook: "Look at this.",
    targetDurationSec: 28,
    fullSpokenScript: chapters.map((c) => c.spoken).join(" "),
    chapters: chapters as any,
  };

  const scenes = buildScenesFromNarrativeChapters(script, "hybrid");

  assert.equal(scenes.length, 6);
  assert.equal(scenes[0].audio, "talent");
  assert.equal(scenes[1].audio, "vo");
  assert.equal(scenes[2].audio, "vo");
  assert.equal(scenes[3].audio, "talent");
  assert.equal(scenes[4].audio, "vo");
  assert.equal(scenes[5].audio, "talent");

  // In hybrid mode, VO synthesis lines extract ONLY scenes with audio === "vo"
  const voScenes = scenes.filter((c) => c.audio === "vo");
  assert.equal(voScenes.length, 3);
  const voLines = voScenes.map((s) => s.spokenLines).join(" ");
  assert.equal(voLines, "Most people struggle with this. Here is the data. Notice the details here.");
  // Notice that talent lines ("Look at this.", "Watch me do it live.", "Follow for more.") are excluded from VO synthesis!
});

test("chapterAudio: fallback behavior in hybrid mode defaults to vo and never blindly defaults to talent", () => {
  // If no job matches and no direct audio is specified, hybrid falls back to "vo"
  const audio = resolveChapterAudio({
    mode: "hybrid",
    chapter: { job: "unknown_custom_job" },
  });
  assert.equal(audio, "vo", "Hybrid must default to vo, never non-express -> talent");
});

test("chapterAudio: compileLiveMotionPrompt handles vo chapters with silent ambient presence", () => {
  const voScene = {
    scene: 2,
    audio: "vo" as const,
    spokenLines: "The data shows exponential growth.",
    visualDescription: "Diagram on screen with presenter sitting quietly beside it.",
    physicalAction: "Points at diagram",
  };

  const resVo = compileLiveMotionPrompt({
    scene: voScene,
    sceneIndex: 2,
    totalScenes: 2,
    durationSec: 5,
    mode: "hybrid",
    refLabels: [],
  } as any);

  assert.match(
    resVo.prompt,
    /PERFORMANCE \(VO CHAPTER — NO DIALOGUE LIP-SYNC\): silent ambient presence; do not animate speech or lip sync\./
  );

  const talentScene = {
    scene: 1,
    audio: "talent" as const,
    spokenLines: "Hey everyone, check this out!",
    visualDescription: "Presenter talking directly to camera.",
    physicalAction: "Gestures excitedly",
  };

  const resTalent = compileLiveMotionPrompt({
    scene: talentScene,
    sceneIndex: 1,
    totalScenes: 2,
    durationSec: 5,
    mode: "hybrid",
    refLabels: [],
  } as any);

  assert.doesNotMatch(
    resTalent.prompt,
    /PERFORMANCE \(VO CHAPTER — NO DIALOGUE LIP-SYNC\)/
  );
});
