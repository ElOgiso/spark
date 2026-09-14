/**
 * SPARK Stage 3 — ShotDirectionSpec & Stage-3 Director Envelope Tests
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { compileLiveMotionPrompt } from "./compileLiveMotionPrompt";
import {
  deriveShotDirectionSpec,
  sanitizeMotionText,
  type ShotDirectionSpec,
} from "./shotDirectionSpec";
import {
  isForbiddenI2vStartFrame,
  resolveOfficialI2vClipFrames,
} from "./officialI2vFrames";
import {
  snapGrokDuration,
  snapKlingDuration,
  snapSeedanceDuration,
  snapVeoDuration,
} from "../../../../api/runtime/_videoContract";
import type { ProductionElement } from "./elements/productionElements";

test("deriveShotDirectionSpec hydrates reliably from thin scene without hard failure", () => {
  const thinScene: any = {
    action: "Scientist activates holographic display with an upward gesture",
    cameraDirection: "Slow arc right",
    spokenLines: "The data is conclusive.",
  };

  const spec = deriveShotDirectionSpec({
    scene: thinScene,
    sceneIndex: 2,
    totalScenes: 4,
    durationSec: 5,
    environment: "Quantum Lab",
    characterName: "Dr. Vance",
  });

  assert.equal(spec.formatMode, "segment_of_multishot");
  assert.match(spec.sceneContext, /Dr\. Vance/);
  assert.match(spec.sceneContext, /Quantum Lab/);
  assert.equal(spec.action, "Scientist activates holographic display with an upward gesture");
  assert.equal(spec.camera, "Slow arc right");
  assert.equal(spec.performance, "The data is conclusive.");
  assert.match(spec.audioDiegetic!, /diegetic/i);
  assert.equal(spec.positiveLocks.length, 6);
  assert.ok(spec.positiveLocks.some((l) => l.includes("Headcount")));
  assert.ok(spec.positiveLocks.some((l) => l.includes("First Frame Lock")));
  assert.ok(spec.positiveLocks.some((l) => l.includes("Clean Frame")));
});

test("sanitizeMotionText strips subjective marketing buzzwords", () => {
  const raw = "Photorealistic 8K stunning masterpiece with ultra-realistic lighting";
  const cleaned = sanitizeMotionText(raw);
  assert.ok(!/photorealistic|8k|stunning|masterpiece|ultra-realistic/i.test(cleaned));
  assert.equal(cleaned, "with lighting");
});

test("compileLiveMotionPrompt outputs exact Stage-3 envelope with ELEMENT BINDING and POSITIVE LOCKS", () => {
  const elements: ProductionElement[] = [
    {
      tag: "@main_character",
      role: "character_main",
      label: "Alex Vance",
      url: "https://cdn.example/alex-sheet.png",
      description: "lead researcher identity sheet (face/wardrobe lock)",
    },
    {
      tag: "@loc_lab",
      role: "location",
      label: "Quantum Laboratory",
      url: "https://cdn.example/lab-plate.png",
      description: "cleanroom set plate (environment lock)",
    },
  ];

  const result = compileLiveMotionPrompt({
    mode: "deep",
    aspectRatio: "16:9",
    sceneIndex: 1,
    totalScenes: 1,
    durationSec: 5,
    scene: {
      physicalAction: "Subject keys data into terminal and leans forward",
      cameraDirection: "Smooth dolly forward",
      spokenLines: "System online.",
      locationMap: "Subject stands center foreground, terminal console right, server bank background.",
    },
    refLabels: ["INPUT REF [1]: First Frame Keyframe (Scene 1 shot still)"],
    isInsertOrSet: false,
    characterName: "Alex Vance",
    environment: "Quantum Laboratory",
    elements,
  });

  const { prompt, shotDirection } = result;

  // 1. Element Binding block
  assert.match(prompt, /ELEMENT BINDING:/);
  assert.match(prompt, /@main_character = lead researcher identity sheet/);
  assert.match(prompt, /@loc_lab = cleanroom set plate/);
  assert.match(
    prompt,
    /IMAGE 1 = this shot’s storyboard still \(first frame\)\. Animate only\. Do not restyle\./
  );

  // 2. Stage 3 Envelope sections in stable order
  assert.match(prompt, /SCENE CONTEXT:/);
  assert.match(prompt, /LOCATION MAP: Subject stands center foreground/);
  assert.match(prompt, /FORMAT: single continuous clip; no internal cuts\./);
  assert.match(prompt, /ACTION: Subject keys data into terminal and leans forward/);
  assert.match(prompt, /CAMERA: Smooth dolly forward/);
  assert.match(prompt, /PERFORMANCE \(AUDIO ONLY — never draw text\): natural lip\/body sync/);
  assert.match(prompt, /AUDIO: Diegetic natural sound/);
  assert.match(prompt, /POSITIVE LOCKS:/);
  assert.match(prompt, /Headcount: exactly 1 primary subject in frame/);
  assert.match(prompt, /Direction Axis: maintain continuous spatial screen direction/);
  assert.match(prompt, /Identity Lock: facial features, skin tone, hairstyle/);
  assert.match(prompt, /First Frame Lock: preserve IMAGE 1 framing/);
  assert.match(prompt, /Clean Frame: no borders, no sheet edges/);
  assert.match(prompt, /Mouth Clean: no unnatural jaw morphing/);

  // 3. Visual Lock Law & Still Authority
  assert.match(prompt, /VISUAL LOCK LAW:/);
  assert.match(prompt, /STORYBOARD STILL AUTHORITY \(IMAGE 1\):/);

  // 4. Forbid panel grid timeline substitution
  assert.ok(!/0[-–]2\.5s panel 1/i.test(prompt));
  assert.ok(!/panel grid timing/i.test(prompt));

  // 5. ShotDirection spec returned on compiler output
  assert.equal(shotDirection.formatMode, "single_continuous");
  assert.equal(shotDirection.elementTags.length, 2);
  assert.equal(shotDirection.elementTags[0], "@main_character");
  assert.equal(shotDirection.elementTags[1], "@loc_lab");
});

test("compileLiveMotionPrompt adapts format for multishot segments", () => {
  const result = compileLiveMotionPrompt({
    mode: "standard",
    aspectRatio: "9:16",
    sceneIndex: 2,
    totalScenes: 4,
    durationSec: 5,
    scene: {
      physicalAction: "Actor turns sharply toward corridor",
      cameraDirection: "Pan left following subject",
    },
    refLabels: ["INPUT REF [1]: Scene 2 Still"],
    isInsertOrSet: false,
    environment: "Corridor",
  });

  assert.match(result.prompt, /FORMAT: this clip is one segment of a multishot; no internal cuts\./);
});

test("Duration snapping remains strictly compliant across all video providers", () => {
  // Grok: 1–15 seconds
  assert.equal(snapGrokDuration(0), 1);
  assert.equal(snapGrokDuration(5), 5);
  assert.equal(snapGrokDuration(15), 15);
  assert.equal(snapGrokDuration(30), 15);

  // Kling: "5" or "10"
  assert.equal(snapKlingDuration(3), "5");
  assert.equal(snapKlingDuration(5), "5");
  assert.equal(snapKlingDuration(6), "10");
  assert.equal(snapKlingDuration(10), "10");

  // Veo: 4 | 6 | 8, forced to 8 with lastFrame or identity refs
  assert.equal(snapVeoDuration(4), 4);
  assert.equal(snapVeoDuration(5), 6);
  assert.equal(snapVeoDuration(7), 8);
  assert.equal(snapVeoDuration(4, { hasLastFrame: true }), 8);
  assert.equal(snapVeoDuration(4, { hasIdentityRefs: true }), 8);

  // Seedance: 4–15 seconds
  assert.equal(snapSeedanceDuration(2), 4);
  assert.equal(snapSeedanceDuration(5), 5);
  assert.equal(snapSeedanceDuration(15), 15);
  assert.equal(snapSeedanceDuration(30), 15);
});

test("officialI2vFrames strictly forbids character sheets, location plates, or grids as frame 1", () => {
  const sheetUrl = "https://storage.example.com/character-sheet-dr-vance.png";
  const plateUrl = "https://storage.example.com/location-plate-lab.png";
  const gridUrl = "https://storage.example.com/storyboard-grid-take-1.png";
  const validStillUrl = "https://storage.example.com/shot-1-still.png";

  assert.equal(isForbiddenI2vStartFrame(sheetUrl, { sheetUrls: [sheetUrl] }), true);
  assert.equal(isForbiddenI2vStartFrame(plateUrl, { plateUrl }), true);
  assert.equal(isForbiddenI2vStartFrame(gridUrl, { gridUrl }), true);
  assert.equal(
    isForbiddenI2vStartFrame(validStillUrl, {
      sheetUrls: [sheetUrl],
      plateUrl,
      gridUrl,
    }),
    false
  );

  // resolveOfficialI2vClipFrames throws if only forbidden assets are available
  assert.throws(() => {
    resolveOfficialI2vClipFrames({
      sceneImage: sheetUrl,
      forbidden: { sheetUrls: [sheetUrl] },
      sceneLabel: "Scene 1",
    });
  }, /I2V requires this shot's still as frame 1/);

  // resolveOfficialI2vClipFrames passes when real shot still is provided
  const resolved = resolveOfficialI2vClipFrames({
    sceneImage: validStillUrl,
    forbidden: { sheetUrls: [sheetUrl] },
  });
  assert.equal(resolved.firstFrameUrl, validStillUrl);
});
