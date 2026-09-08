/**
 * Storyboard sheet panels ARE scene stills — crop geometry + extract contract.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  computePanelCropRects,
  extractStoryboardSheetPanels,
  storyboardLayoutToGrid,
  DEFAULT_PANEL_GUTTER_RATIO,
} from "./extractStoryboardSheetPanels";
import { chooseStoryboardLayout } from "./preproduction/storyboardBlueprint";
import { compileLiveStoryboardSheetPrompt } from "./compileLiveStoryboardSheetPrompt";

test("storyboardLayoutToGrid maps named layouts to rows×cols capacity", () => {
  assert.deepEqual(storyboardLayoutToGrid("single-panel", 1), { cols: 1, rows: 1 });
  assert.deepEqual(storyboardLayoutToGrid("2x2", 4), { cols: 2, rows: 2 });
  assert.deepEqual(storyboardLayoutToGrid("1x5", 5), { cols: 5, rows: 1 });
  assert.deepEqual(storyboardLayoutToGrid("2x4", 8), { cols: 4, rows: 2 });
  assert.deepEqual(storyboardLayoutToGrid("3x3", 9), { cols: 3, rows: 3 });
  assert.deepEqual(storyboardLayoutToGrid("3x4", 12), { cols: 4, rows: 3 });
  assert.deepEqual(storyboardLayoutToGrid("4x4", 16), { cols: 4, rows: 4 });
  assert.deepEqual(storyboardLayoutToGrid("4x5", 20), { cols: 5, rows: 4 });
  assert.deepEqual(storyboardLayoutToGrid("horizontal-sequence", 7), { cols: 7, rows: 1 });
  assert.deepEqual(storyboardLayoutToGrid("vertical-sequence", 6), { cols: 1, rows: 6 });
});

test("chooseStoryboardLayout + grid capacity covers live panel counts", () => {
  for (const n of [1, 2, 4, 5, 8, 9, 12, 16]) {
    const layout = chooseStoryboardLayout(n, "16:9");
    const grid = storyboardLayoutToGrid(layout, n);
    assert.ok(grid.cols * grid.rows >= n, `${layout} must fit ${n} panels`);
  }
});

test("computePanelCropRects is row-major and insets gutter", () => {
  const rects = computePanelCropRects({
    imageWidth: 400,
    imageHeight: 400,
    layout: "2x2",
    panelCount: 4,
    gutterRatio: 0.1,
  });
  assert.equal(rects.length, 4);
  // Cell is 200×200; 10% gutter → inset 20 each side → 160×160
  assert.equal(rects[0].x, 20);
  assert.equal(rects[0].y, 20);
  assert.equal(rects[0].width, 160);
  assert.equal(rects[0].height, 160);
  // Panel 1 = top-right
  assert.equal(rects[1].x, 220);
  assert.equal(rects[1].y, 20);
  // Panel 2 = bottom-left
  assert.equal(rects[2].x, 20);
  assert.equal(rects[2].y, 220);
  // Panel 3 = bottom-right
  assert.equal(rects[3].x, 220);
  assert.equal(rects[3].y, 220);
  assert.equal(DEFAULT_PANEL_GUTTER_RATIO, 0.04);
});

test("computePanelCropRects stops at panelCount even if grid is larger", () => {
  const rects = computePanelCropRects({
    imageWidth: 300,
    imageHeight: 300,
    layout: "3x3",
    panelCount: 5,
  });
  assert.equal(rects.length, 5);
  assert.equal(rects[4].panelIndex, 4);
});

test("geometry miss still crops — source never returns empty panels before crop", () => {
  const src = fs.readFileSync(new URL("./extractStoryboardSheetPanels.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /if \(!geo\.ok\)[\s\S]{0,220}panels:\s*\[\]/);
  assert.match(src, /keeping best-effort panel crops/);
  assert.match(src, /never invent a second full-bleed/);
});

test("extractStoryboardSheetPanels returns [] without browser canvas", async () => {
  const out = await extractStoryboardSheetPanels({
    sheetUrl: "https://cdn.example.com/sheet.png",
    layout: "2x2",
    panelCount: 4,
  });
  assert.deepEqual(out, []);
});

test("sheet compiler law requires native Frame-Locked panels", () => {
  const result = compileLiveStoryboardSheetPrompt({
    scenes: Array.from({ length: 4 }, (_, i) => ({
      scene: i + 1,
      visualDescription: `Beat ${i + 1}`,
      shotId: `shot_${i + 1}`,
    })),
    aspectRatio: "9:16",
  });
  assert.ok(/FRAME LOCK/i.test(result.prompt));
  assert.ok(/native 9:16/i.test(result.prompt));
  assert.ok(/extractable for motion\/I2V/i.test(result.prompt));
  assert.ok(!/blueprint for downstream AI stills/i.test(result.prompt));
});
