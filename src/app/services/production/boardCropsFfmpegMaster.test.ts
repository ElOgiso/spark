/**
 * Board crops only + next-panel end frame + server ffmpeg master.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function read(rel: string) {
  return fs.readFileSync(path.join(__dirname, rel), "utf8");
}

describe("A — no parallel still pipeline when a sheet exists", () => {
  it("needStillRegen is false when hasRealStoryboardSheet; geometry miss retries THE SHEET", () => {
    const pas = read("productionAssetService.ts");
    assert.match(pas, /needStillRegen\s*=\s*\n?\s*!hasRealStoryboardSheet/);
    assert.match(pas, /Regenerating THE SHEET once \(not native stills\)/);
    assert.doesNotMatch(pas, /Regenerating native/);
    assert.match(pas, /storyboard_panel_needs_fix/);
    assert.match(pas, /sheet exists but no panel crop — not inventing a full-bleed still/);
    assert.match(pas, /renderStoryboardSheetOnce\("geometry-retry"\)/);
  });
});

describe("B — official i2v last frame is next panel crop", () => {
  it("PAS plannedEndUrl is next scene image; first frame is not sheet-01", () => {
    const pas = read("productionAssetService.ts");
    const official = read("officialI2vFrames.ts");
    assert.match(pas, /plannedEndUrl:\s*nextScene\?\.image/);
    assert.match(official, /Official last = next panel crop/);
    assert.doesNotMatch(pas, /firstFrameUrl:\s*realGridUrl/);
    assert.match(pas, /storyboard\/sheet-01\.png/);
    assert.match(pas, /scenes\/scene-0\$\{globalSceneNum\}\.png/);
  });
});

describe("C — Approve & merge is server ffmpeg only", () => {
  it("video.ts merge action writes master.mp4 and never fallbackToClient", () => {
    const video = fs.readFileSync(path.join(__dirname, "../../../../api/runtime/video.ts"), "utf8");
    assert.match(video, /action === "merge"/);
    assert.match(video, /collectSparkShotClipUrls/);
    assert.match(video, /filename:\s*"master\.mp4"/);
    assert.match(video, /FFMPEG_UNAVAILABLE/);
    assert.doesNotMatch(video, /fallbackToClient/);
    assert.doesNotMatch(video, /Use client Canvas mux fallback/);
  });

  it("mergeSceneVideos hits action merge and does not succeed via MediaRecorder", () => {
    const merger = read("sceneVideoMerger.ts");
    assert.match(merger, /action:\s*"merge"/);
    assert.match(merger, /collectSparkShotClipUrls/);
    const start = merger.indexOf("export async function mergeSceneVideos(");
    const end = merger.indexOf("export async function mergeSceneVideosClientUnused");
    const fn = merger.slice(start, end);
    assert.doesNotMatch(fn, /new MediaRecorder/);
    assert.doesNotMatch(fn, /captureStream/);
    assert.doesNotMatch(fn, /fallbackToClient/);
    assert.match(merger, /mergeSceneVideosClientUnused/);
  });

  it("mergeProductionScenes fails loud without shot-N clips and does not upload a blob master", () => {
    const pas = read("productionAssetService.ts");
    const mergeFn = pas.slice(pas.indexOf("public static async mergeProductionScenes"));
    assert.match(mergeFn, /collectSparkShotClipUrls/);
    assert.match(mergeFn, /video\/shot-N\.mp4/);
    assert.doesNotMatch(mergeFn, /compileNarratorSlideshowVideo/);
    assert.doesNotMatch(mergeFn, /compileHybridVideo/);
    assert.doesNotMatch(mergeFn, /If client Canvas fallback produced a Blob/);
  });
});
