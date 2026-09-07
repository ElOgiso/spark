import assert from "node:assert/strict";
import test from "node:test";
import {
  attachSceneMotionLock,
  bindMotionLockStillUrl,
  buildSceneMotionLock,
  isSceneMotionLock,
  resolveSceneMotionLock,
  storyboardStillAnimateLaws,
} from "./sceneMotionLock";
import { compileLiveMotionPrompt } from "./compileLiveMotionPrompt";
import { buildSceneMotionPrompt } from "./productionPromptPacks";

test("buildSceneMotionLock freezes director physicalAction at still time", () => {
  const lock = buildSceneMotionLock({
    scene: {
      physicalAction: "Subject lifts a glass notebook and turns toward window light",
      spokenLines: "Protect a 90-minute maker block.",
      cameraDirection: "Medium push-in",
      endState: "Hold notebook at chest height",
    },
    environment: "Bright loft studio",
    sourceStill: "storyboard_panel",
    stillUrl: "https://cdn.example/panel-1.jpg",
    sceneIndexZeroBased: 0,
  });
  assert.equal(lock.version, 1);
  assert.match(lock.physicalAction, /glass notebook/i);
  assert.equal(lock.cameraDirection, "Medium push-in");
  assert.match(lock.spokenLines, /maker block/);
  assert.equal(lock.sourceStill, "storyboard_panel");
  assert.equal(lock.stillUrl, "https://cdn.example/panel-1.jpg");
  assert.ok(isSceneMotionLock(lock));
});

test("resolveSceneMotionLock prefers persisted lock over later scene rewrite", () => {
  const scene: any = {
    physicalAction: "Subject lifts a glass notebook and turns toward window light",
    spokenLines: "Protect a 90-minute maker block.",
    cameraDirection: "Medium push-in",
  };
  attachSceneMotionLock(scene, { sourceStill: "scene_still", stillUrl: "https://cdn.example/a.jpg" });
  const lockedAction = scene.motionLock.physicalAction;

  // Later planner rewrite must not win at motion time
  scene.primaryChange = "Host presents key insight with authoritative gestures";
  scene.physicalAction = "Completely different invented action for motion rewrite";
  scene.visualDescription = "Totally new set with different props";

  const { lock, fromPersisted } = resolveSceneMotionLock({
    scene,
    attachIfMissing: true,
  });
  assert.equal(fromPersisted, true);
  assert.equal(lock.physicalAction, lockedAction);
  assert.ok(!/Host presents/i.test(lock.physicalAction));
  assert.ok(!/Completely different/i.test(lock.physicalAction));
});

test("bindMotionLockStillUrl updates URL without rebuilding action", () => {
  const scene: any = {
    physicalAction: "Subject points at a whiteboard timeline with deliberate hand motion",
    cameraDirection: "Wide",
  };
  attachSceneMotionLock(scene, { sourceStill: "scene_still" });
  const action = scene.motionLock.physicalAction;
  bindMotionLockStillUrl(scene, "https://cdn.example/still-final.png");
  assert.equal(scene.motionLock.stillUrl, "https://cdn.example/still-final.png");
  assert.equal(scene.motionLock.physicalAction, action);
});

test("compileLiveMotionPrompt follows persisted lock and still-authority laws", () => {
  const scene: any = {
    physicalAction: "Subject steps into a shaft of window light and opens a leather folio",
    spokenLines: "This is the non-obvious bottleneck.",
    cameraDirection: "Slow push-in",
    image: "https://cdn.example/scene-1.png",
    sourceStill: "storyboard_panel",
  };
  attachSceneMotionLock(scene, {
    sourceStill: "storyboard_panel",
    stillUrl: scene.image,
  });

  // Poison free scene fields — motion must ignore these for look/action
  scene.primaryChange = "Host presents key insight with authoritative gestures";
  scene.visualDescription = "Cyberpunk alley with neon signs and flying cars";

  const { prompt, fromPersistedLock, motionLock } = compileLiveMotionPrompt({
    mode: "deep",
    aspectRatio: "9:16",
    sceneIndex: 1,
    totalScenes: 3,
    durationSec: 5,
    scene,
    refLabels: ["INPUT REF [1]: First Frame"],
    isInsertOrSet: false,
    characterName: "Alex",
    environment: "Bright loft studio",
    followStoryboardStill: true,
  });

  assert.equal(fromPersistedLock, true);
  assert.match(motionLock.physicalAction, /leather folio/i);
  assert.match(prompt, /STORYBOARD STILL AUTHORITY/i);
  assert.match(prompt, /leather folio/i);
  assert.ok(!/Host presents key insight/i.test(prompt));
  assert.ok(!/Cyberpunk alley/i.test(prompt));
  assert.match(prompt, /Exact set, props/i);
  assert.match(prompt, /Bring IMAGE 1 to life/i);
});

test("buildSceneMotionPrompt default followStoryboardStill locks look to IMAGE 1", () => {
  const prompt = buildSceneMotionPrompt({
    mode: "standard",
    aspectRatio: "9:16",
    sceneIndex: 2,
    totalScenes: 4,
    durationSec: 6,
    action: "Subject turns and raises both hands",
    characterName: "Alex",
    environment: "Studio A",
  });
  assert.match(prompt, /Locked storyboard/i);
  assert.match(prompt, /Exact facial, hair, body, and wardrobe fidelity to IMAGE 1/i);
  assert.match(prompt, /invent props/i);
});

test("storyboardStillAnimateLaws forbids redesign", () => {
  const laws = storyboardStillAnimateLaws();
  assert.match(laws, /do NOT redesign/i);
  assert.match(laws, /wardrobe must remain identical/i);
  assert.match(laws, /never a new look/i);
});
