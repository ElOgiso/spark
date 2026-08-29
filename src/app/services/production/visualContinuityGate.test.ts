import assert from "node:assert/strict";
import test from "node:test";
import { evaluateVisualContinuity, isVisuallyContinuous } from "./visualContinuityGate.ts";

test("scene 0 is continuous when a first frame exists", () => {
  const result = evaluateVisualContinuity({
    sceneIndex: 0,
    firstFrameUrl: "https://cdn/scene-1.jpg",
  });
  assert.equal(result.ok, true);
  assert.equal(isVisuallyContinuous({ sceneIndex: 0, firstFrameUrl: "https://cdn/scene-1.jpg" }), true);
});

test("scene N+1 is chained when previous last frame is the first frame", () => {
  const prev = "https://cdn/scene-1-last.jpg";
  const result = evaluateVisualContinuity({
    sceneIndex: 1,
    firstFrameUrl: prev,
    previousLastFrameUrl: prev,
  });
  assert.equal(result.chained, true);
  assert.equal(result.ok, true);
});

test("missing first frame fails the visual continuity gate", () => {
  const result = evaluateVisualContinuity({
    sceneIndex: 1,
    previousLastFrameUrl: "https://cdn/scene-1-last.jpg",
  });
  assert.equal(result.ok, false);
  assert.ok(result.reasons.length > 0);
});
