/**
 * Tests for the per-scene motion prompt used by EVERY video provider path
 * (Grok/Kling/Seedance via /api/runtime/video, and Gemini Veo via ModelRouter,
 * which passes this prompt verbatim with no negative-prompt field).
 * Run: tsx --test src/app/services/production/productionPromptPacks.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { buildSceneMotionPrompt, VIDEO_NEGATIVE_LAWS } from "./productionPromptPacks";

test("motion prompt carries identity lock + shared anti-slop negative laws (Veo has no negative_prompt field)", () => {
  const p = buildSceneMotionPrompt({
    mode: "standard",
    aspectRatio: "9:16",
    sceneIndex: 1,
    totalScenes: 4,
    durationSec: 6,
    action: "host gestures toward the chart",
    spokenLines: 'This changes everything.',
    characterName: "Ava",
  });
  // Identity / no-restyle lock so the clip stays faithful to the approved keyframe.
  assert.match(p, /Do NOT restyle/i);
  assert.match(p, /Animate the first frame only/i);
  // Anti-slop negative constraints appended as plain text (the only channel Veo respects).
  assert.ok(p.includes(VIDEO_NEGATIVE_LAWS));
  assert.match(p, /face morphing/i);
  // Scene content is present.
  assert.match(p, /host gestures toward the chart/);
  assert.match(p, /This changes everything\./);
});

test("deep mode is diegetic-only (no external voiceover); standard vo leaves acoustic space", () => {
  const deep = buildSceneMotionPrompt({
    mode: "deep",
    aspectRatio: "16:9",
    sceneIndex: 1,
    totalScenes: 3,
    durationSec: 8,
    audio: "vo",
  });
  assert.match(deep, /No voiceover narration/i);

  const standardVo = buildSceneMotionPrompt({
    mode: "standard",
    aspectRatio: "9:16",
    sceneIndex: 2,
    totalScenes: 3,
    durationSec: 5,
    audio: "vo",
  });
  assert.match(standardVo, /external voiceover bed/i);
});
