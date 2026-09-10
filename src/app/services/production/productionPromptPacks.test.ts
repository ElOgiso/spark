/**
 * Tests for the per-scene motion prompt used by EVERY video provider path
 * (Grok/Kling/Seedance via /api/runtime/video, and Gemini Veo via ModelRouter,
 * which passes this prompt verbatim with no negative-prompt field).
 * Run: tsx --test src/app/services/production/productionPromptPacks.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { buildSceneMotionPrompt, VIDEO_NEGATIVE_LAWS, buildViralConceptDirective } from "./productionPromptPacks";
import type { ProductionBrief } from "../../domain/types";

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
  assert.match(p, /Bring IMAGE 1 to life|Animate the first frame only/i);
  // Anti-slop negative constraints appended as plain text (the only channel Veo respects).
  assert.ok(p.includes(VIDEO_NEGATIVE_LAWS));
  assert.match(p, /face morphing/i);
  // Scene content is present.
  assert.match(p, /host gestures toward the chart/);
  assert.match(p, /This changes everything\./);
});

test("viral concept directive renders researched format and threads into the motion prompt", () => {
  const brief = {
    visualDirection: "fast punch-ins on a neon desk setup",
    researchContext: {
      format: "Vertical Short-Form (Shorts)",
      hookPattern: "First-line curiosity opener",
      retentionSignals: ["3s pattern interrupt", "text-free cold open"],
      nicheLanguage: ["alpha", "leverage"],
      viralReasons: ["High completion rate"],
    },
  } as unknown as ProductionBrief;

  const directive = buildViralConceptDirective(brief);
  assert.match(directive, /REFERENCE FORMAT & RETENTION/);
  assert.match(directive, /Vertical Short-Form/);
  assert.match(directive, /do NOT copy the source creator/i);
  assert.match(directive, /fast punch-ins on a neon desk setup/);

  // Empty research yields empty string (safe to inject unconditionally).
  assert.equal(buildViralConceptDirective({ visualDirection: "" } as unknown as ProductionBrief), "");

  // The directive actually appears in the motion prompt when passed.
  const motion = buildSceneMotionPrompt({
    mode: "standard",
    aspectRatio: "9:16",
    sceneIndex: 1,
    totalScenes: 3,
    durationSec: 5,
    viralConcept: directive,
  });
  assert.match(motion, /REFERENCE FORMAT & RETENTION/);
  assert.match(motion, /Vertical Short-Form/);
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

test("motion prompt omits redundant board context leakage when followStoryboardStill is true", () => {
  const promptFollowingStill = buildSceneMotionPrompt({
    mode: "standard",
    aspectRatio: "16:9",
    sceneIndex: 1,
    totalScenes: 3,
    durationSec: 5,
    action: "Subject walks through neon alley",
    characterName: "Elena",
    environment: "a high-end executive studio with refined architectural lighting",
    followStoryboardStill: true,
  });

  assert.ok(!promptFollowingStill.includes("(Locked board context:"));
  assert.ok(!promptFollowingStill.includes("executive studio"));
  assert.match(
    promptFollowingStill,
    /Environment: Exact set, props, products, architecture, lighting, textures, and depth of field as IMAGE 1/
  );
});

test("buildLockedIdentityPack: host format locks set, story and faceless formats use scene-directed set continuity", async () => {
  const { buildLockedIdentityPack } = await import("./productionAssetService");
  const brand = { name: "Acme Corp", locationPlateUrl: "https://example.com/studio.jpg" } as any;
  const character = { name: "Jordan", style: "Presenter", traits: ["Dynamic"] } as any;
  const brief = { visualDirection: "Minimalist executive studio" } as any;

  // Host format
  const hostPack = buildLockedIdentityPack({
    brand,
    character,
    brief,
    formatSettings: { contentFormat: "host" },
  });
  assert.match(hostPack.setBlock, /ENVIRONMENT \(LOCKED SET\)/);
  assert.match(hostPack.setBlock, /Same physical set, backdrop, architectural details/);

  // Story format
  const storyPack = buildLockedIdentityPack({
    brand,
    character,
    brief,
    formatSettings: { contentFormat: "story" },
  });
  assert.match(storyPack.setBlock, /ENVIRONMENT \(SCENE-DIRECTED\)/);
  assert.match(storyPack.setBlock, /Honor each scene's distinct location/);

  // Faceless format
  const facelessPack = buildLockedIdentityPack({
    brand,
    character: null,
    brief,
    formatSettings: { contentFormat: "faceless" },
  });
  assert.match(facelessPack.setBlock, /ENVIRONMENT \(SCENE-DIRECTED\)/);
});

test("Grok capability profile reflects adapter and contract start and end frame support", async () => {
  const { MEDIA_CAPABILITY_PROFILES } = await import("./capability/profiles");
  const grok = MEDIA_CAPABILITY_PROFILES.find((p) => p.providerId === "grok");
  assert.ok(grok, "Grok profile must exist");
  assert.equal(grok.temporal?.supportsStartFrame, true);
  assert.equal(grok.temporal?.supportsEndFrame, true);
  assert.equal(grok.temporal?.supportsStartAndEndFrame, true);
  assert.equal(grok.temporal?.supportsTailFrame, true);
  assert.match(grok.temporal?.provenance?.notes || "", /last_frame_url/i);
});

