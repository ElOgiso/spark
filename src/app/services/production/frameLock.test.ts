/**
 * Frame Lock + native panel geometry correctness tests.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  aspectRatiosMatch,
  chooseNativePanelStoryboardLayout,
  computeEqualGridCellAspect,
  computeSheetAspectForNativePanels,
  createProductionFrameLock,
  frameLockPanelPromptLaws,
  parseAspectRatioValue,
  validateSheetPanelGeometry,
} from "./frameLock";
import { storyboardLayoutToGrid } from "./extractStoryboardSheetPanels";
import { compileLiveStoryboardSheetPrompt } from "./compileLiveStoryboardSheetPrompt";

test("createProductionFrameLock locks TikTok-like portrait to 9:16", () => {
  const lock = createProductionFrameLock({
    aspectMode: "portrait",
    platformFit: "TikTok",
    contentFormat: "host",
  });
  assert.equal(lock.aspectRatio, "9:16");
  assert.equal(lock.panelAspectRatio, "9:16");
  assert.equal(lock.orientation, "portrait");
  assert.equal(lock.targetWidth, 1080);
  assert.equal(lock.targetHeight, 1920);
  assert.equal(lock.cropLater, false);
  assert.equal(lock.letterboxPolicy, "prohibited");
  assert.match(lock.platformHint || "", /TikTok|Vertical|Short/i);
});

test("createProductionFrameLock locks cinematic YouTube to 16:9", () => {
  const lock = createProductionFrameLock({
    aspectRatio: "16:9",
    platformFit: "YouTube Long-form",
  });
  assert.equal(lock.aspectRatio, "16:9");
  assert.equal(lock.orientation, "landscape");
  assert.equal(lock.targetWidth, 1920);
  assert.equal(lock.targetHeight, 1080);
});

test("createProductionFrameLock supports square", () => {
  const lock = createProductionFrameLock({ aspectRatio: "1:1" });
  assert.equal(lock.aspectRatio, "1:1");
  assert.equal(lock.orientation, "square");
  assert.equal(lock.targetWidth, 1080);
  assert.equal(lock.targetHeight, 1080);
});

test("chooseNativePanelStoryboardLayout prefers square grids", () => {
  assert.equal(chooseNativePanelStoryboardLayout(1), "single-panel");
  assert.equal(chooseNativePanelStoryboardLayout(4), "2x2");
  assert.equal(chooseNativePanelStoryboardLayout(5), "3x3");
  assert.equal(chooseNativePanelStoryboardLayout(8), "3x3");
  assert.equal(chooseNativePanelStoryboardLayout(12), "4x4");
  assert.equal(chooseNativePanelStoryboardLayout(16), "4x4");
});

test("square grid on production-AR sheet yields matching cell AR", () => {
  // 9:16 sheet 1080×1920, 3×3 grid
  const cell = computeEqualGridCellAspect({
    sheetWidth: 1080,
    sheetHeight: 1920,
    cols: 3,
    rows: 3,
  });
  assert.ok(cell != null);
  assert.ok(aspectRatiosMatch(cell!, "9:16"));

  const lock = createProductionFrameLock({ aspectRatio: "9:16" });
  const geo = validateSheetPanelGeometry({
    frameLock: lock,
    sheetWidth: 1080,
    sheetHeight: 1920,
    cols: 3,
    rows: 3,
  });
  assert.equal(geo.ok, true);
  assert.equal(geo.extractionReady, true);
});

test("non-square 2x4 grid on 16:9 sheet FAILS geometry gate", () => {
  const lock = createProductionFrameLock({ aspectRatio: "16:9" });
  const grid = storyboardLayoutToGrid("2x4", 8);
  assert.deepEqual(grid, { cols: 4, rows: 2 });
  const geo = validateSheetPanelGeometry({
    frameLock: lock,
    sheetWidth: 1920,
    sheetHeight: 1080,
    cols: grid.cols,
    rows: grid.rows,
  });
  assert.equal(geo.ok, false);
  assert.equal(geo.cropRisk, "aspect_mismatch");
  assert.equal(geo.extractionReady, false);
});

test("computeSheetAspectForNativePanels makes cells match panel AR", () => {
  // 16:9 panels in 2 rows × 4 cols → sheet AR = 16/9 * 4/2 = 32/9
  const sheetAR = computeSheetAspectForNativePanels({
    panelAspectRatio: "16:9",
    cols: 4,
    rows: 2,
  });
  assert.ok(sheetAR != null);
  assert.ok(Math.abs(sheetAR! - 32 / 9) < 1e-9);
  // Cell on that sheet: sheetAR * (rows/cols) = panel AR
  const cellAR = sheetAR! * (2 / 4);
  assert.ok(aspectRatiosMatch(cellAR, "16:9", 1e-9));
});

test("compileLiveStoryboardSheetPrompt uses native layout + Frame Lock laws", () => {
  const scenes = Array.from({ length: 8 }, (_, i) => ({
    scene: i + 1,
    visualDescription: `Beat ${i + 1}`,
    shotId: `shot_${i + 1}`,
  }));
  const result = compileLiveStoryboardSheetPrompt({
    scenes,
    aspectRatio: "16:9",
    preferNativePanelGeometry: true,
  });
  assert.equal(result.layout, "3x3"); // not classic 2x4
  assert.equal(result.frameLock.aspectRatio, "16:9");
  assert.ok(/FRAME LOCK/i.test(result.prompt));
  assert.ok(/native 16:9/i.test(result.prompt));
  assert.ok(/do NOT distort panels to fill/i.test(result.prompt));
});

test("frameLockPanelPromptLaws mentions no crop/stretch/letterbox", () => {
  const lock = createProductionFrameLock({ aspectRatio: "9:16", platformFit: "YouTube Shorts" });
  const laws = frameLockPanelPromptLaws(lock);
  assert.ok(/9:16/.test(laws));
  assert.ok(/cropping/i.test(laws));
  assert.ok(/letterbox/i.test(laws));
});

test("parseAspectRatioValue covers common forms", () => {
  assert.equal(parseAspectRatioValue("16:9"), 16 / 9);
  assert.equal(parseAspectRatioValue("9:16"), 9 / 16);
  assert.equal(parseAspectRatioValue("1:1"), 1);
  assert.equal(parseAspectRatioValue("portrait"), 9 / 16);
});
