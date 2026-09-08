import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isForbiddenI2vStartFrame,
  resolveOfficialShotStill,
  resolveOfficialI2vClipFrames,
} from "./officialI2vFrames";
import {
  buildGrokVideoGenerateBody,
  buildVeoVideoPayload,
  snapVeoDuration,
  resolveClipFrames,
} from "../../../../api/runtime/_videoContract";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("official i2v frame 1 contract", () => {
  it("rejects a real storyboard grid as start frame and never falls back to it", () => {
    const grid = "https://cdn.example.com/storyboard/sheet-grid.png";
    const still = "https://cdn.example.com/scenes/scene-02.png";
    assert.equal(isForbiddenI2vStartFrame(grid, { gridUrl: grid }), true);
    assert.equal(
      resolveOfficialShotStill({
        sceneImage: grid,
        generatedFrameUrl: still,
        forbidden: { gridUrl: grid },
      }),
      still
    );
    assert.throws(
      () =>
        resolveOfficialI2vClipFrames({
          sceneImage: grid,
          forbidden: { gridUrl: grid },
          sceneLabel: "Scene 1",
        }),
      /not a grid/i
    );
  });

  it("allows a mislabeled grid URL that is actually this shot's still", () => {
    const still = "https://cdn.example.com/scenes/scene-01.png";
    const frames = resolveOfficialI2vClipFrames({
      sceneImage: still,
      forbidden: { gridUrl: still },
    });
    assert.equal(frames.firstFrameUrl, still);
  });

  it("never uses character sheet or location plate as frame 1", () => {
    const sheet = "https://cdn.example.com/character/sheet.png";
    const plate = "https://cdn.example.com/location/plate.png";
    const still = "https://cdn.example.com/scenes/shot-03.png";
    const frames = resolveOfficialI2vClipFrames({
      sceneImage: still,
      previousLastFrameUrl: "https://cdn.example.com/scenes/shot-02-last.jpg",
      forbidden: { sheetUrls: [sheet], plateUrl: plate },
    });
    assert.equal(frames.firstFrameUrl, still);
    assert.equal(frames.lastFrameUrl, "https://cdn.example.com/scenes/shot-02-last.jpg");
    assert.notEqual(frames.firstFrameUrl, sheet);
    assert.notEqual(frames.firstFrameUrl, plate);
  });

  it("Video Generation option builders never assign storyboardGridUrl to firstFrame/image", () => {
    const pas = fs.readFileSync(path.join(__dirname, "productionAssetService.ts"), "utf8");
    const orch = fs.readFileSync(path.join(__dirname, "../runtime/AIProviderOrchestrator.ts"), "utf8");
    assert.doesNotMatch(pas, /firstFrameUrl:\s*realGridUrl/);
    assert.doesNotMatch(pas, /referenceImageUrl:\s*realGridUrl/);
    assert.doesNotMatch(pas, /firstFrameUrl:\s*continuityPlan\.firstFrameUrl/);
    assert.match(pas, /resolveOfficialI2vClipFrames/);
    assert.match(pas, /video\/shot-\$\{globalSceneNum\}\.mp4/);
    assert.doesNotMatch(orch, /image:\s*\{\s*uri:\s*options\.referenceImageUrl/);
    assert.doesNotMatch(orch, /reference_image_urls\s*=\s*faceRefs/);
    assert.match(orch, /instances:\s*veoBuilt\.instances/);
    assert.match(orch, /lastFrame/);
  });
});

describe("official Veo / Grok wire fields", () => {
  it("Veo payload includes lastFrame and durationSeconds === 8 when previous last frame exists", () => {
    const payload = buildVeoVideoPayload({
      prompt: "slow push in",
      firstFrameDataUri: "data:image/jpeg;base64,START",
      lastFrameDataUri: "data:image/jpeg;base64,PREVLAST",
      aspectRatio: "9:16",
      durationSec: 4,
    });
    const instance = payload.instances[0];
    assert.equal(payload.parameters.durationSeconds, 8);
    assert.equal(payload.parameters.aspectRatio, "9:16");
    assert.ok(instance.image);
    assert.ok(instance.lastFrame);
    const image = instance.image as { bytesBase64Encoded: string; mimeType: string };
    const last = instance.lastFrame as { bytesBase64Encoded: string; mimeType: string };
    assert.equal(image.bytesBase64Encoded, "START");
    assert.equal(last.bytesBase64Encoded, "PREVLAST");
    assert.equal("referenceImages" in instance, false);
    assert.equal(snapVeoDuration(6, { hasLastFrame: true }), 8);
    assert.equal(snapVeoDuration(4), 4);
  });

  it("Grok i2v body has image + optional last frame and no reference_images", () => {
    const body = buildGrokVideoGenerateBody({
      prompt: "camera pans left",
      firstFrameDataUri: "data:image/jpeg;base64,STILL",
      lastFrameDataUri: "data:image/jpeg;base64,END",
      referenceDataUris: ["data:image/jpeg;base64,SHEET", "data:image/jpeg;base64,GRID"],
      durationSec: 6,
      aspectRatio: "9:16",
    });
    assert.equal(body.image_url, "data:image/jpeg;base64,STILL");
    assert.equal(body.last_frame_url, "data:image/jpeg;base64,END");
    assert.equal(body.reference_image_urls, undefined);
    assert.equal("reference_images" in body, false);
  });

  it("resolveClipFrames uses lastFrameUrl as end/continuity, not as frame 1", () => {
    const frames = resolveClipFrames({
      firstFrameUrl: "https://cdn/shot-still.jpg",
      lastFrameUrl: "https://cdn/prev-last.jpg",
      referenceImageUrls: ["https://cdn/sheet.png"],
    });
    assert.equal(frames.firstFrameUrl, "https://cdn/shot-still.jpg");
    assert.equal(frames.endFrameUrl, "https://cdn/prev-last.jpg");
  });
});
