/**
 * Director script authority — physical action vs spoken (audio-only) for live gen.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  isPlannerMetaText,
  mergeSpecBeatsWithBriefBeats,
  mergeSpecStoryboardWithBriefScript,
  resolveDirectorSceneScript,
  directorVisualSpeechLaw,
  assertDirectorScriptReadyForMotion,
} from "./directorScriptAuthority";
import { compileLiveMotionPrompt } from "./compileLiveMotionPrompt";
import { buildSceneMotionPrompt } from "./productionPromptPacks";

test("isPlannerMetaText catches Host presents / hook templates", () => {
  assert.equal(isPlannerMetaText("Host presents key insight with authoritative gestures"), true);
  assert.equal(isPlannerMetaText("Open with a strong hook about: AI tools"), true);
  assert.equal(isPlannerMetaText("SAVE THIS NOW"), true);
  assert.equal(
    isPlannerMetaText("Subject leans forward and points at the whiteboard with left hand"),
    false
  );
});

test("resolveDirectorSceneScript rejects meta primaryChange for physicalAction", () => {
  const script = resolveDirectorSceneScript({
    scene: {
      primaryChange: "Host presents key insight with authoritative gestures",
      spokenLines: "Stop wasting mornings on broken workflows.",
      cameraDirection: "Medium close-up push-in",
      // no usable visualDescription — must repair away from Host presents
    },
    sceneIndexZeroBased: 0,
  });
  assert.equal(script.repaired, true);
  assert.ok(!/host presents key/i.test(script.physicalAction));
  assert.match(script.spokenLines, /Stop wasting mornings/);
});

test("resolveDirectorSceneScript prefers concrete visualDescription over meta primaryChange", () => {
  const script = resolveDirectorSceneScript({
    scene: {
      primaryChange: "Host presents key insight with authoritative gestures",
      visualDescription: "Subject leans forward at the desk and points at a notebook",
      spokenLines: "Stop wasting mornings on broken workflows.",
    },
  });
  assert.equal(script.wasMeta, false);
  assert.match(script.physicalAction, /leans forward|points at a notebook/i);
});

test("mergeSpecStoryboardWithBriefScript keeps LLM spoken over Spec template", () => {
  const merged = mergeSpecStoryboardWithBriefScript({
    specStoryboard: [
      {
        scene: 1,
        primaryChange: "Open with a strong hook about: AI",
        spokenLines: "What if AI?",
        cameraDirection: "Wide",
      },
    ],
    briefStoryboard: [
      {
        scene: 1,
        spokenLines: "Your calendar is lying to you about deep work.",
        visualDescription: "Host at desk, morning light",
      },
    ],
    briefBeats: [{ spokenLines: "Your calendar is lying to you about deep work." }],
    hook: "Your calendar is lying to you about deep work.",
  });
  assert.match(merged[0].spokenLines, /calendar is lying/);
  assert.ok(merged[0].physicalAction);
  assert.ok(!/host presents key/i.test(merged[0].physicalAction));
});

test("mergeSpecBeatsWithBriefBeats prefers brief spokenLines", () => {
  const beats = mergeSpecBeatsWithBriefBeats({
    specBeats: [{ spokenLines: "Here's the key takeaway.", valueJob: "proof" }],
    briefBeats: [{ spokenLines: "Batch your decisions into one afternoon block.", valueJob: "proof" }],
  });
  assert.match(beats[0].spokenLines, /Batch your decisions/);
});

test("buildSceneMotionPrompt never emits Dialogue glyph bait", () => {
  const prompt = buildSceneMotionPrompt({
    mode: "deep",
    aspectRatio: "9:16",
    sceneIndex: 1,
    totalScenes: 3,
    durationSec: 5,
    action: "Subject turns toward camera and raises a notebook",
    performanceSpeech: "This is the line that must not appear as text",
  });
  assert.ok(!/Dialogue:\s*"/i.test(prompt));
  assert.ok(/AUDIO ONLY|never draw/i.test(prompt));
  assert.ok(/PHYSICAL ONLY/i.test(prompt));
  assert.ok(!/Host presents key insight/i.test(prompt));
});

test("compileLiveMotionPrompt uses physicalAction and audio-only speech law", () => {
  const { prompt, directorScript } = compileLiveMotionPrompt({
    mode: "deep",
    aspectRatio: "9:16",
    sceneIndex: 1,
    totalScenes: 2,
    durationSec: 6,
    scene: {
      primaryChange: "Host presents key insight with authoritative gestures",
      spokenLines: "Cut three meetings and protect a 90-minute maker block.",
      cameraDirection: "Medium shot",
      visualDescription: "Bright studio desk",
    },
    refLabels: ["INPUT REF [1]: First Frame"],
    isInsertOrSet: false,
    environment: "Studio",
    brief: {
      hook: "Cut three meetings and protect a 90-minute maker block.",
      beats: [{ spokenLines: "Cut three meetings and protect a 90-minute maker block." }],
    } as any,
  });
  assert.ok(!/Dialogue:\s*"/i.test(prompt));
  assert.ok(/never draw|AUDIO ONLY|Performance \(AUDIO ONLY/i.test(prompt));
  assert.ok(!/Host presents key insight with authoritative gestures/i.test(prompt));
  assert.ok(directorScript.physicalAction.length > 10);
  assert.match(prompt, /STORYBOARD STILL AUTHORITY|Bring IMAGE 1 to life/i);
});

test("directorVisualSpeechLaw forbids glyphs", () => {
  const law = directorVisualSpeechLaw("Hello world");
  assert.match(law, /NEVER burn|never draw|do NOT draw/i);
});

test("assertDirectorScriptReadyForMotion rejects Host presents", () => {
  assert.throws(() =>
    assertDirectorScriptReadyForMotion(
      {
        physicalAction: "Host presents key insight with authoritative gestures",
        spokenLines: "",
        onScreenText: "",
        repaired: false,
        wasMeta: true,
        source: "scene",
      },
      "Scene 1"
    )
  );
});
