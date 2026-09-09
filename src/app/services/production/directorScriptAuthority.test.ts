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

test("isPlannerMetaText catches Host presents / hook templates / brackets / spoken address", () => {
  assert.equal(isPlannerMetaText("Host presents key insight with authoritative gestures"), true);
  assert.equal(isPlannerMetaText("Open with a strong hook about: AI tools"), true);
  assert.equal(isPlannerMetaText("SAVE THIS NOW"), true);
  assert.equal(isPlannerMetaText("[HOOK] [MAIN] Stop wasting mornings on broken workflows."), true);
  assert.equal(isPlannerMetaText("[PROBLEM] [INSERT] Most teams suffer from communication debt."), true);
  assert.equal(isPlannerMetaText("If you're still doing manual reviews, stop scrolling right now."), true);
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

test("resolveDirectorSceneScript rejects [HOOK] [MAIN] visualDescription and repairs to physical action", () => {
  const script = resolveDirectorSceneScript({
    scene: {
      visualDescription: "[HOOK] [MAIN] Stop wasting mornings on broken workflows.",
      spokenLines: "Stop wasting mornings on broken workflows.",
      cameraDirection: "Push-in medium shot",
    },
    sceneIndexZeroBased: 0,
  });
  assert.equal(script.repaired, true);
  assert.ok(!script.physicalAction.includes("[HOOK]"));
  assert.ok(!script.physicalAction.includes("Stop wasting mornings"));
  assert.match(script.physicalAction, /performs a clear, continuous physical action/i);
  assert.equal(script.spokenLines, "Stop wasting mornings on broken workflows.");
});

test("storyboard frame prompt compiler does NOT emit compile notes", async () => {
  const { compileIndividualStoryboardFramePrompt } = await import("./preproduction/storyboardFrame");
  const prompt = compileIndividualStoryboardFramePrompt({
    panel: {
      panelId: "p-1",
      shotId: "s-1",
      sequenceIndex: 1,
      purpose: "Open with a strong hook",
      dramaticBeat: "Hook",
      visualObjective: "Grab audience attention",
      editorialRole: "hook",
      composition: "Presenter centered",
      framing: "Medium shot",
      camera: {
        shotType: "Medium shot",
        position: "eye-level",
        movement: "static",
        lensIntent: "cinematic prime",
        depthOfField: "shallow",
      },
      characters: [],
      locations: [],
      props: [],
      products: [],
      blocking: "Presenter gestures toward lens",
      subjectAction: "Presenter gestures toward lens",
      environmentAction: "High-contrast studio set",
      lightingIntent: "Cinematic key light",
      temporalBeat: { startSec: 0, endSec: 5, pace: "fast" },
      startState: "Host established in framing",
      endState: "Host gestures outward",
      incomingState: { wardrobe: [], propsHeld: [], lighting: "", subjectPosition: "", notes: [] },
      outgoingState: { wardrobe: [], propsHeld: [], lighting: "", subjectPosition: "", notes: [] },
      referenceRequirements: [],
      referenceAssignments: [],
      continuityRequirements: [],
      generationIntent: { complexity: "standard", priority: "critical", requiresMultiPass: false },
    },
    aspectRatio: "9:16",
  });

  assert.ok(!prompt.includes("Shot purpose:"));
  assert.ok(!prompt.includes("Dramatic beat:"));
  assert.ok(!prompt.includes("Visual objective:"));
  assert.ok(!prompt.includes("Start state:"));
  assert.ok(!prompt.includes("End state:"));
  assert.match(prompt, /Subject action: Presenter gestures toward lens/);
  assert.match(prompt, /NO TEXT, NO LOGOS, NO WATERMARKS/);
});

test("compileLiveStillPrompt does NOT dump BRAND LAWS into image prompt", async () => {
  const { compileLiveStillPrompt } = await import("./compileLiveStillPrompt");
  const res = compileLiveStillPrompt({
    scene: {
      scene: 1,
      physicalAction: "Host stands at desk pointing at tablet screen",
      spokenLines: "Never waste your time with manual process.",
      cameraDirection: "Medium shot",
    },
    sceneIndexZeroBased: 0,
    aspectRatio: "9:16",
    memoryItems: [
      {
        id: "mem-1",
        brandId: "b-1",
        rule: "Always emphasize 10x ROI and clear pipeline velocity",
        category: "brand_voice",
        confidence: 0.95,
        source: "manual",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ] as any,
  });

  assert.ok(!res.prompt.includes("BRAND LAWS:"));
  assert.ok(!res.prompt.includes("Always emphasize 10x ROI"));
  assert.match(res.prompt, /Host stands at desk pointing at tablet screen/);
});

