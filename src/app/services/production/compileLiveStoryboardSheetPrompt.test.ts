/**
 * Live multi-panel storyboard sheet compiler tests.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  compileLiveStoryboardSheetPrompt,
  isRealStoryboardSheetUrl,
  LIVE_STORYBOARD_SHEET_MAX_PANELS,
} from "./compileLiveStoryboardSheetPrompt";
import { chooseStoryboardLayout } from "./preproduction/storyboardBlueprint";

test("compileLiveStoryboardSheetPrompt emits multi-panel sheet laws + layout", () => {
  const scenes = Array.from({ length: 8 }, (_, i) => ({
    scene: i + 1,
    visualDescription: `Beat ${i + 1} action`,
    cameraDirection: i % 2 === 0 ? "Wide establishing" : "Medium close-up",
    spokenLines: `Line ${i + 1}`,
    shotId: `shot_${i + 1}`,
  }));
  const result = compileLiveStoryboardSheetPrompt({
    scenes,
    aspectRatio: "16:9",
    productionId: "prod-1",
    brandName: "Acme",
    environment: "Executive studio",
  });
  assert.equal(result.compiler, "live_storyboard_sheet");
  assert.equal(result.panelCount, 8);
  assert.equal(result.layout, "2x4");
  assert.ok(/multi-panel storyboard SHEET/i.test(result.prompt));
  assert.ok(/Panel 01/i.test(result.prompt));
  assert.ok(/Panel 08/i.test(result.prompt));
  assert.ok(!/SINGLE clean cinematic still/i.test(result.prompt));
  assert.equal(chooseStoryboardLayout(5, "16:9"), "1x5");
  assert.equal(chooseStoryboardLayout(16, "16:9"), "4x4");
});

test("compileLiveStoryboardSheetPrompt caps at LIVE_STORYBOARD_SHEET_MAX_PANELS", () => {
  const scenes = Array.from({ length: 24 }, (_, i) => ({
    scene: i + 1,
    visualDescription: `Beat ${i + 1}`,
    shotId: `s${i + 1}`,
  }));
  const result = compileLiveStoryboardSheetPrompt({
    scenes,
    aspectRatio: "9:16",
  });
  assert.equal(result.panelCount, LIVE_STORYBOARD_SHEET_MAX_PANELS);
});

test("isRealStoryboardSheetUrl rejects first-still mislabel", () => {
  const still = "https://cdn.example.com/scene-01.png";
  assert.equal(
    isRealStoryboardSheetUrl({ storyboardGridUrl: still, firstStillUrl: still }),
    false
  );
  assert.equal(
    isRealStoryboardSheetUrl({
      storyboardGridUrl: "https://cdn.example.com/storyboard/sheet-01.png",
      firstStillUrl: still,
    }),
    true
  );
  assert.equal(isRealStoryboardSheetUrl({ storyboardGridUrl: "" }), false);
});

test("buildVisualLockRefs includes master storyboard grid after character sheet", async () => {
  const { buildVisualLockRefs } = await import("./productionAssetService");
  const grid = "https://cdn.example.com/storyboard/sheet-01.png";
  const charSheet = "https://cdn.example.com/character/sheet.png";
  const refs = buildVisualLockRefs({
    character: { name: "Host", characterSheetUrl: charSheet } as any,
    storyboardGridUrl: grid,
    subjectType: "main",
  });
  assert.ok(refs.imageUrls.includes(grid));
  assert.ok(refs.imageUrls.includes(charSheet));
  assert.ok(refs.imageUrls.indexOf(charSheet) < refs.imageUrls.indexOf(grid));
  assert.ok(/Master Storyboard Grid/i.test(refs.refPromptHeader));
});
