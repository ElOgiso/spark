/**
 * Contract tests for SPARK production I2V payloads.
 * Run: node --experimental-strip-types --test api/runtime/videoContract.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  snapKlingDuration,
  snapSeedanceDuration,
  snapGrokDuration,
  buildSeedanceTaskBody,
  buildKlingImage2VideoBody,
  buildGrokVideoGenerateBody,
  resolveClipFrames,
  grokMotionPrompt,
  i2vMotionLock,
  I2V_MOTION_LOCK,
  I2V_NEGATIVE_PROMPT,
  isSeedance20,
  klingSupportsImageTail,
  resolveKlingModel,
  klingModeForRequest,
  SEEDANCE_MODEL_20,
  SEEDANCE_MODEL_15_PRO,
  KLING_DEFAULT_MODEL,
} from "./_videoContract.js";

test("Kling duration is a number-string, never 5s", () => {
  assert.equal(snapKlingDuration(5), "5");
  assert.equal(snapKlingDuration(8), "10");
  assert.equal(snapKlingDuration(4), "5");
  const body = buildKlingImage2VideoBody({
    prompt: "camera dollies in",
    firstFrameDataUri: "data:image/jpeg;base64,AAA",
    lastFrameDataUri: "data:image/jpeg;base64,BBB",
    durationSec: 5,
    model: "kling-v2-6",
    klingMode: "pro",
  });
  assert.equal(body.duration, "5");
  assert.notEqual(body.duration, "5s");
  assert.equal(body.image, "AAA");
  assert.equal(body.image_tail, "BBB");
  assert.equal(body.sound, "on");
  assert.equal(body.mode, "pro");
});

test("Kling carries the director prompt with identity lock + anti-slop negative prompt", () => {
  const body = buildKlingImage2VideoBody({
    prompt: "slow dolly-in as the host raises one hand",
    firstFrameDataUri: "data:image/jpeg;base64,AAA",
    durationSec: 5,
  });
  // Previously Kling received NO prompt at all — the scene brief was silently dropped.
  assert.equal(typeof body.prompt, "string");
  assert.match(String(body.prompt), /do not restyle/i);
  assert.match(String(body.prompt), /slow dolly-in as the host raises one hand/);
  assert.equal(body.negative_prompt, I2V_NEGATIVE_PROMPT);
  assert.match(String(body.negative_prompt), /face morphing/i);
});

test("Seedance text content carries the shared identity/motion lock", () => {
  const body = buildSeedanceTaskBody({
    prompt: "camera pushes in on the product reveal",
    firstFrameDataUri: "data:image/jpeg;base64,FF",
    durationSec: 6,
  });
  const content = body.content as any[];
  assert.equal(content[0].type, "text");
  assert.match(String(content[0].text), /do not restyle/i);
  assert.match(String(content[0].text), /camera pushes in on the product reveal/);
});

test("i2vMotionLock is idempotent and shared by grokMotionPrompt", () => {
  const once = i2vMotionLock("camera pans left");
  assert.match(once, /do not restyle/i);
  assert.match(once, /camera pans left/);
  // Applying the lock twice must not stack duplicate lock headers.
  assert.equal(i2vMotionLock(once), once);
  // Empty prompt still yields the bare lock.
  assert.equal(i2vMotionLock(""), I2V_MOTION_LOCK);
  // grokMotionPrompt now delegates to the shared lock (behavior preserved).
  assert.equal(grokMotionPrompt("camera pans left"), once);
});

test("Kling defaults to v2-6 pro and sends image_tail when a last-frame is present", () => {
  assert.equal(KLING_DEFAULT_MODEL, "kling-v2-6");
  const body = buildKlingImage2VideoBody({
    prompt: "motion",
    firstFrameDataUri: "data:image/jpeg;base64,AAA",
    lastFrameDataUri: "data:image/jpeg;base64,BBB",
    durationSec: 5,
  });
  assert.equal(body.model_name, "kling-v2-6");
  assert.equal(body.mode, "pro");
  assert.equal(body.image_tail, "BBB");
  assert.equal(klingSupportsImageTail("kling-v2-6", "pro"), true);
  assert.equal(klingSupportsImageTail("kling-v2-6", "std"), false);
  assert.equal(klingModeForRequest("kling-v2-6", "std", true), "pro");
  assert.equal(klingModeForRequest("kling-v2-6", undefined, false), "std");
});

test("Kling keeps std and omits image_tail when no last-frame is present", () => {
  const body = buildKlingImage2VideoBody({
    prompt: "motion",
    firstFrameDataUri: "data:image/jpeg;base64,AAA",
    durationSec: 5,
  });
  assert.equal(body.mode, "std");
  assert.equal(body.image_tail, undefined);
});

test("Kling v1-6 + forced pro omits image_tail", () => {
  assert.equal(klingSupportsImageTail("kling-v1-6", "pro"), false);
  assert.equal(resolveKlingModel("kling-v1-6"), "kling-v1-6");
  const body = buildKlingImage2VideoBody({
    prompt: "motion",
    firstFrameDataUri: "data:image/jpeg;base64,AAA",
    lastFrameDataUri: "data:image/jpeg;base64,BBB",
    durationSec: 5,
    model: "kling-v1-6",
    klingMode: "pro",
  });
  assert.equal(body.model_name, "kling-v1-6");
  assert.equal(body.mode, "pro");
  assert.equal(body.image_tail, undefined);
});

test("Kling v3-omni identity is image_list max 4", () => {
  const refs = ["data:image/jpeg;base64,R1", "data:image/jpeg;base64,R2", "data:image/jpeg;base64,R3", "data:image/jpeg;base64,R4", "data:image/jpeg;base64,R5"];
  const body = buildKlingImage2VideoBody({
    prompt: "motion",
    firstFrameDataUri: "data:image/jpeg;base64,FF",
    referenceDataUris: refs,
    model: "kling-v3-omni",
    durationSec: 5,
  });
  const imageList = body.image_list as Array<{ image: string }>;
  assert.ok(Array.isArray(imageList));
  assert.equal(imageList.length, 4);
  // Kling multi-image2video wire format: array of { image } objects (raw base64), not strings.
  assert.equal(typeof imageList[0].image, "string");
  assert.equal(imageList[0].image, "R1");
});

test("Seedance uses first_frame + last_frame roles and int duration", () => {
  const body = buildSeedanceTaskBody({
    prompt: "slow push in",
    firstFrameDataUri: "data:image/jpeg;base64,FF",
    lastFrameDataUri: "data:image/jpeg;base64,LF",
    referenceDataUris: ["data:image/jpeg;base64,FACE"],
    durationSec: 8,
    aspectRatio: "9:16",
    resolution: "1080p",
    model: SEEDANCE_MODEL_15_PRO,
  });
  assert.equal(body.duration, 8);
  assert.equal(typeof body.duration, "number");
  assert.equal(body.watermark, false);
  assert.equal(body.resolution, "1080p");
  const content = body.content as any[];
  assert.equal(content[0].type, "text");
  assert.equal(content[1].role, "first_frame");
  assert.equal(content[2].role, "last_frame");
  assert.equal(content[3].role, "reference_image");
  assert.equal(snapSeedanceDuration(3), 4);
  assert.equal(snapSeedanceDuration(20), 15);
});

test("Seedance 2.0 cannot mix first/last frame with reference media", () => {
  assert.equal(isSeedance20(SEEDANCE_MODEL_20), true);
  const body = buildSeedanceTaskBody({
    prompt: "motion",
    firstFrameDataUri: "data:image/jpeg;base64,FF",
    lastFrameDataUri: "data:image/jpeg;base64,LF",
    referenceDataUris: ["data:image/jpeg;base64,FACE"],
    model: SEEDANCE_MODEL_20,
    durationSec: 6,
  });
  const roles = (body.content as any[]).map((p) => p.role).filter(Boolean);
  assert.deepEqual(roles, ["first_frame", "last_frame"]);
});

test("Grok sends image_url dataUri plus up to 7 reference faces", () => {
  const refs = Array.from({ length: 9 }, (_, i) => `data:image/jpeg;base64,F${i}`);
  const body = buildGrokVideoGenerateBody({
    prompt: "camera pans left",
    firstFrameDataUri: "data:image/jpeg;base64,START",
    referenceDataUris: refs,
    durationSec: 7,
    aspectRatio: "9:16",
  });
  assert.equal(body.image_url, "data:image/jpeg;base64,START");
  assert.equal((body.reference_image_urls as string[]).length, 7);
  assert.equal(body.duration, 7);
  assert.match(String(body.prompt), /do not restyle/i);
  assert.equal(snapGrokDuration(0), 1);
  assert.equal(snapGrokDuration(99), 15);
});

test("Grok motion prompt does not restyle the start frame", () => {
  const p = grokMotionPrompt("slow dolly in, host raises hand");
  assert.match(p, /motion and camera only/i);
  assert.match(p, /slow dolly in/i);
});

test("resolveClipFrames treats lastFrameUrl as continuity first-frame, not image_tail", () => {
  const frames = resolveClipFrames({
    imageUrl: "https://cdn/prev-last.jpg",
    lastFrameUrl: "https://cdn/prev-last.jpg",
    endFrameUrl: "https://cdn/next-still.jpg",
    referenceImageUrls: ["https://cdn/face.png", "https://cdn/prev-last.jpg"],
  });
  assert.equal(frames.firstFrameUrl, "https://cdn/prev-last.jpg");
  assert.equal(frames.endFrameUrl, "https://cdn/next-still.jpg");
  assert.deepEqual(frames.referenceImageUrls, ["https://cdn/face.png"]);
});

test("resolveClipFrames uses lastFrameUrl as first frame when imageUrl is omitted", () => {
  const frames = resolveClipFrames({
    lastFrameUrl: "https://cdn/extracted-last.jpg",
    endFrameUrl: "https://cdn/next-still.jpg",
  });
  assert.equal(frames.firstFrameUrl, "https://cdn/extracted-last.jpg");
  assert.equal(frames.endFrameUrl, "https://cdn/next-still.jpg");
});
