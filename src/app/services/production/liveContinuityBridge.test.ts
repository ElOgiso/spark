/**
 * Live continuity bridge — CONTINUATION spine + shared master assemble.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveLiveSceneContinuity,
  stampSceneGeneratedStateFrame,
  collectSceneCaptionLines,
} from "./liveContinuityBridge";
import { resolveGenerationFrameStrategy } from "./generation/frameStrategy";

test("scene 2 CONTINUATION uses scene 1 LAST as first frame", () => {
  const plan = resolveLiveSceneContinuity({
    productionId: "prod_1",
    sceneIndexZeroBased: 1,
    shotId: "shot_02",
    sceneStillUrl: "https://cdn.example.com/scene-02-still.png",
    previousLastFrameUrl: "https://cdn.example.com/scene-01-last.jpg",
    previousShotId: "shot_01",
    nextSceneStillUrl: "https://cdn.example.com/scene-03-still.png",
    preferContinuation: true,
  });
  assert.equal(plan.chained, true);
  assert.equal(plan.firstFrameUrl, "https://cdn.example.com/scene-01-last.jpg");
  assert.equal(plan.continuityGap, false);
  assert.ok(plan.mode === "CONTINUATION" || plan.mode === "REFERENCE_PLUS_CONTINUATION");
  assert.notEqual(plan.firstFrameUrl, "https://cdn.example.com/scene-02-still.png");
});

test("scene 3 CONTINUATION uses scene 2 LAST (not scene 1)", () => {
  const plan = resolveLiveSceneContinuity({
    productionId: "prod_1",
    sceneIndexZeroBased: 2,
    shotId: "shot_03",
    sceneStillUrl: "https://cdn.example.com/scene-03.png",
    previousLastFrameUrl: "https://cdn.example.com/scene-02-last.jpg",
    previousShotId: "shot_02",
    preferContinuation: true,
  });
  assert.equal(plan.firstFrameUrl, "https://cdn.example.com/scene-02-last.jpg");
  assert.equal(plan.chained, true);
});

test("scene 1 without prev uses scene still as FIRST_FRAME", () => {
  const plan = resolveLiveSceneContinuity({
    productionId: "prod_1",
    sceneIndexZeroBased: 0,
    shotId: "shot_01",
    sceneStillUrl: "https://cdn.example.com/scene-01.png",
    preferContinuation: false,
  });
  assert.equal(plan.firstFrameUrl, "https://cdn.example.com/scene-01.png");
  assert.equal(plan.chained, false);
  assert.equal(plan.continuityGap, false);
});

test("missing prev LAST marks continuityGap and falls back to still", () => {
  const plan = resolveLiveSceneContinuity({
    productionId: "prod_1",
    sceneIndexZeroBased: 1,
    shotId: "shot_02",
    sceneStillUrl: "https://cdn.example.com/scene-02.png",
    previousLastFrameUrl: undefined,
    preferContinuation: true,
  });
  assert.equal(plan.chained, false);
  assert.equal(plan.continuityGap, true);
  assert.equal(plan.firstFrameUrl, "https://cdn.example.com/scene-02.png");
  assert.ok(plan.gapReason);
});

test("stampSceneGeneratedStateFrame registers LAST lineage", () => {
  const gsf = stampSceneGeneratedStateFrame({
    productionId: "prod_1",
    shotId: "shot_01",
    videoUrl: "https://cdn.example.com/scene-01.mp4",
    lastFrameUrl: "https://cdn.example.com/scene-01-last.jpg",
    sceneIndexZeroBased: 0,
  });
  assert.equal(gsf.kind, "generated_state_frame");
  assert.equal(gsf.position, "LAST");
  assert.equal(gsf.url, "https://cdn.example.com/scene-01-last.jpg");
  assert.equal(gsf.sourceShotId, "shot_01");
});

test("collectSceneCaptionLines shared by auto-merge and UI merge", () => {
  const lines = collectSceneCaptionLines(
    [{ onScreenText: "HOOK LINE HERE" }, { onScreenText: "" }, {}],
    [{}, { onScreenText: "Beat two text" }],
    "Fallback Hook",
    (t) => t.trim().slice(0, 60)
  );
  assert.equal(lines[0], "HOOK LINE HERE");
  assert.equal(lines[1], "Beat two text");
});

test("OS frameStrategy CONTINUATION when prev state + start frame", () => {
  const strategy = resolveGenerationFrameStrategy({
    storyboardFrame: {
      id: "sb1",
      url: "https://cdn.example.com/still.png",
    } as any,
    previousGeneratedState: {
      id: "gs1",
      url: "https://cdn.example.com/last.jpg",
      position: "LAST",
      sourceVideoAssetId: "v1",
      sourceShotId: "shot_01",
    },
    preferContinuation: true,
    capabilities: {
      supportsStartFrame: true,
      supportsLastFrameContinuation: true,
      supportsReferenceImages: true,
    },
  });
  assert.ok(strategy.mode === "CONTINUATION" || strategy.mode === "REFERENCE_PLUS_CONTINUATION");
  assert.equal(strategy.firstFrameUrl, "https://cdn.example.com/last.jpg");
});
