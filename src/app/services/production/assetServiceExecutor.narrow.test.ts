/**
 * AssetService executor narrowness — creative text lives in OS compilers only.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildStillSubjectLine, compileLiveStillPrompt } from "./compileLiveStillPrompt";
import { compileLiveMotionPrompt } from "./compileLiveMotionPrompt";
import { compileThumbnailPrompt } from "./compileThumbnailPrompt";
import {
  compileStoryboardPlanPrompt,
  shouldReuseExistingStoryboard,
} from "./compileStoryboardPlanPrompt";

const here = dirname(fileURLToPath(import.meta.url));

test("AssetService source no longer invents still subject / viral formula / scene motion templates", () => {
  const src = readFileSync(join(here, "productionAssetService.ts"), "utf8");
  assert.equal(src.includes("SUBJECT & COMPOSITION:"), false);
  assert.equal(src.includes("VIRAL FORMULA:"), false);
  assert.equal(src.includes("buildSceneMotionPrompt"), false);
  assert.equal(src.includes("buildViralConceptDirective"), false);
  assert.ok(src.includes("compileLiveStillPrompt"));
  assert.ok(src.includes("compileLiveMotionPrompt"));
  assert.ok(src.includes("compileThumbnailPrompt"));
  assert.ok(src.includes("compileStoryboardPlanPrompt"));
  assert.ok(src.includes("EXECUTOR only") || src.includes("EXECUTOR"));
});

test("buildStillSubjectLine covers set/insert/main", () => {
  assert.match(buildStillSubjectLine({ resolvedSubject: "set" }), /NO people/i);
  assert.match(buildStillSubjectLine({ resolvedSubject: "insert" }), /B-roll/i);
  assert.match(
    buildStillSubjectLine({
      resolvedSubject: "main",
      character: { name: "Alex", style: "Host" } as any,
    }),
    /Alex/
  );
});

test("compileLiveMotionPrompt includes first-frame lock law", () => {
  const { prompt, compiler } = compileLiveMotionPrompt({
    mode: "standard",
    aspectRatio: "9:16",
    sceneIndex: 1,
    totalScenes: 3,
    durationSec: 5,
    scene: {
      physicalAction: "Host gestures toward camera with open palms",
      cameraDirection: "Push-in",
    },
    refLabels: ["INPUT REF [1]: Scene still"],
    isInsertOrSet: false,
    characterName: "Alex",
    environment: "Studio",
  });
  assert.equal(compiler, "scene_motion");
  assert.match(prompt, /first frame|IMAGE 1/i);
  assert.match(prompt, /gestures toward camera/i);
  assert.match(prompt, /STORYBOARD STILL AUTHORITY/i);
});

test("compileThumbnailPrompt emits variant formula", () => {
  const { prompt } = compileThumbnailPrompt({
    variantLetter: "A",
    concept: "Hook face",
    shortHookText: "STOP THIS",
    aspectRatio: "9:16",
    brandName: "Acme",
  });
  assert.match(prompt, /VIRAL FORMULA/);
  assert.match(prompt, /STOP THIS/);
});

test("shouldReuseExistingStoryboard prefers Spec/brief panels", () => {
  assert.equal(
    shouldReuseExistingStoryboard({
      brief: {
        storyboard: [{ shotId: "shot-1", spokenLines: "Hello world spoken line" }],
      } as any,
    }),
    true
  );
  assert.equal(
    shouldReuseExistingStoryboard({
      forceRegenerate: true,
      brief: { storyboard: [{ shotId: "shot-1" }] } as any,
    }),
    false
  );
  assert.equal(
    shouldReuseExistingStoryboard({
      brief: { storyboard: [] } as any,
    }),
    false
  );
});

test("compileStoryboardPlanPrompt returns mode-specific system instruction", () => {
  const deep = compileStoryboardPlanPrompt({
    mode: "deep",
    aspectRatio: "16:9",
    brief: { title: "T", hook: "Spoken hook line here", scriptOutline: "outline" } as any,
    brand: { name: "Acme", niche: "ops" } as any,
  });
  assert.match(deep.systemInstruction, /One-Take|Cinematic/i);
  assert.match(deep.prompt, /Acme/);
});

test("compileLiveStillPrompt still wires subject line", () => {
  const { prompt, compiler } = compileLiveStillPrompt({
    scene: { visualDescription: "Host presents", scene: 1 },
    sceneIndexZeroBased: 0,
    aspectRatio: "9:16",
    subjectLine: buildStillSubjectLine({ resolvedSubject: "main" }),
  });
  assert.ok(compiler === "storyboard_frame" || compiler === "spec_shot");
  assert.match(prompt, /SUBJECT & IDENTITY|Primary host/i);
});
