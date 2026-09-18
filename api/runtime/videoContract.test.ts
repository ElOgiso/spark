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
  buildHiggsfieldSeedanceI2vBody,
  buildHiggsfieldSeedanceR2vBody,
  resolveClipFrames,
  grokMotionPrompt,
  clampGrokVideoPrompt,
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

test("Grok i2v: 1. still only -> image only (keeps requested 1080p resolution)", () => {
  const body = buildGrokVideoGenerateBody({
    prompt: "camera pans left",
    firstFrameDataUri: "data:image/jpeg;base64,START",
    durationSec: 5,
    aspectRatio: "16:9",
    resolution: "1080p",
  });
  assert.equal(body.model, "grok-imagine-video-1.5");
  assert.equal((body.image as any)?.url, "data:image/jpeg;base64,START");
  assert.equal(body.aspect_ratio, "16:9");
  assert.equal(body.resolution, "1080p");
  assert.equal(body.last_frame, undefined);
  assert.equal((body as any).last_frame_url, undefined);
  assert.equal(body.reference_images, undefined);
});

test("Grok i2v: 2. still + end -> sends structured last_frame object", () => {
  const body = buildGrokVideoGenerateBody({
    prompt: "camera pans left",
    firstFrameDataUri: "data:image/jpeg;base64,START",
    lastFrameDataUri: "data:image/jpeg;base64,END",
    durationSec: 5,
    aspectRatio: "16:9",
    resolution: "1080p",
  });
  assert.equal((body.image as any)?.url, "data:image/jpeg;base64,START");
  assert.deepEqual(body.last_frame, { url: "data:image/jpeg;base64,END" });
  assert.equal(body.aspect_ratio, "16:9");
  assert.equal(body.resolution, "1080p");
  assert.equal(body.reference_images, undefined);
});

test("Grok i2v: 3. still + refs -> image + reference_images (max 7, [{ url }]) and forces 720p", () => {
  const refs = Array.from({ length: 9 }, (_, i) => `data:image/jpeg;base64,F${i}`);
  const body = buildGrokVideoGenerateBody({
    prompt: "camera pans left",
    firstFrameDataUri: "data:image/jpeg;base64,START",
    referenceDataUris: refs,
    durationSec: 6,
    aspectRatio: "9:16",
  });
  assert.equal((body.image as any)?.url, "data:image/jpeg;base64,START");
  assert.equal(body.aspect_ratio, "9:16");
  assert.equal(body.resolution, "720p");
  assert.equal(body.last_frame, undefined);
  assert.ok(Array.isArray(body.reference_images));
  assert.equal((body.reference_images as any[]).length, 7);
  assert.equal((body.reference_images as any[])[0]?.url, "data:image/jpeg;base64,F0");
  assert.equal((body.reference_images as any[])[6]?.url, "data:image/jpeg;base64,F6");
});

test("Grok i2v: characterSheetUrl is placed at index 0 of reference_images", () => {
  const body = buildGrokVideoGenerateBody({
    prompt: "camera pans left",
    firstFrameUrl: "https://cdn.supabase.co/storage/v1/object/public/Spark/brands/b1/shot1.jpg",
    characterSheetUrl: "https://cdn.supabase.co/storage/v1/object/public/Spark/brands/b1/character-sheet.jpg",
    referenceImageUrls: [
      "https://cdn.supabase.co/storage/v1/object/public/Spark/brands/b1/location.jpg",
      "https://cdn.supabase.co/storage/v1/object/public/Spark/brands/b1/character-sheet.jpg", // Duplicate should be deduped
    ],
    durationSec: 5,
  });
  assert.equal((body.image as any)?.url, "https://cdn.supabase.co/storage/v1/object/public/Spark/brands/b1/shot1.jpg");
  assert.ok(Array.isArray(body.reference_images));
  assert.equal((body.reference_images as any[]).length, 2);
  assert.equal((body.reference_images as any[])[0]?.url, "https://cdn.supabase.co/storage/v1/object/public/Spark/brands/b1/character-sheet.jpg");
  assert.equal((body.reference_images as any[])[1]?.url, "https://cdn.supabase.co/storage/v1/object/public/Spark/brands/b1/location.jpg");
});

test("Grok i2v: refuses storyboard grid / sheet as motion source", () => {
  assert.throws(
    () =>
      buildGrokVideoGenerateBody({
        prompt: "animate grid",
        firstFrameUrl: "https://cdn.supabase.co/storage/v1/object/public/Spark/brands/b1/storyboard-grid.png",
      }),
    /Still required before motion/
  );
  assert.throws(
    () =>
      buildGrokVideoGenerateBody({
        prompt: "animate sheet",
        firstFrameUrl: "https://cdn.supabase.co/storage/v1/object/public/Spark/brands/b1/character-sheet.png",
      }),
    /Still required before motion/
  );
});

test("Grok i2v: 4. durations clamp 1-15 and refuses T2V without image", () => {
  const refs = Array.from({ length: 2 }, (_, i) => `data:image/jpeg;base64,F${i}`);
  const body = buildGrokVideoGenerateBody({
    prompt: "camera pans left",
    firstFrameDataUri: "data:image/jpeg;base64,START",
    referenceDataUris: refs,
    durationSec: 7,
    aspectRatio: "9:16",
  });
  assert.equal(body.model, "grok-imagine-video-1.5");
  assert.equal((body.image as any)?.url, "data:image/jpeg;base64,START");
  assert.equal(body.aspect_ratio, "9:16");
  assert.equal(body.resolution, "720p");
  assert.equal(body.last_frame, undefined);
  assert.ok(Array.isArray(body.reference_images));
  assert.equal((body.reference_images as any[]).length, 2);
  assert.equal(snapGrokDuration(0), 1);
  assert.equal(snapGrokDuration(99), 15);
  assert.throws(
    () =>
      buildGrokVideoGenerateBody({
        prompt: "camera pans left",
      }),
    /numInputImages=0 forbidden/
  );
});

test("Grok motion prompt does not restyle the start frame", () => {
  const p = grokMotionPrompt("slow dolly in, host raises hand");
  assert.match(p, /motion and camera only/i);
  assert.match(p, /slow dolly in/i);
});

test("resolveClipFrames treats lastFrameUrl as official last/end frame, not start", () => {
  const frames = resolveClipFrames({
    imageUrl: "https://cdn/shot-still.jpg",
    lastFrameUrl: "https://cdn/prev-last.jpg",
    endFrameUrl: "https://cdn/next-still.jpg",
    referenceImageUrls: ["https://cdn/face.png", "https://cdn/prev-last.jpg"],
  });
  assert.equal(frames.firstFrameUrl, "https://cdn/shot-still.jpg");
  assert.equal(frames.endFrameUrl, "https://cdn/next-still.jpg");
  assert.deepEqual(frames.referenceImageUrls, ["https://cdn/face.png"]);
});

test("resolveClipFrames does not promote lastFrameUrl to first frame", () => {
  const frames = resolveClipFrames({
    lastFrameUrl: "https://cdn/extracted-last.jpg",
    endFrameUrl: "https://cdn/next-still.jpg",
  });
  assert.equal(frames.firstFrameUrl, undefined);
  assert.equal(frames.endFrameUrl, "https://cdn/next-still.jpg");
});

test("clampGrokVideoPrompt leaves short prompt unchanged", () => {
  const shortPrompt = "ACTION: Host turns and gestures to the screen. CAMERA: Slow push-in.";
  const clamped = clampGrokVideoPrompt(shortPrompt);
  assert.equal(clamped, shortPrompt);
});

test("clampGrokVideoPrompt clamps 6000 character prompt to <= 4096 and preserves motion lock + action", () => {
  const giantEssay = "GENRE DIRECTIVE: Extensive essay about cinematic lighting and format history. ".repeat(60);
  const actionLine = "ACTION: Detective opens the briefcase and reveals glowing artifact.";
  const cameraLine = "CAMERA: Low angle slow dolly forward.";
  const prompt6000 = `${I2V_MOTION_LOCK}\n\n${giantEssay}\n\n${actionLine}\n\n${cameraLine}\n\n${"EXTRA COMMENTARY: filler words ".repeat(80)}`;

  assert.ok(prompt6000.length > 6000, `Expected prompt > 6000, got ${prompt6000.length}`);

  const clamped = clampGrokVideoPrompt(prompt6000);
  assert.ok(clamped.length <= 4096, `Expected <= 4096, got ${clamped.length}`);
  assert.ok(clamped.length <= 4000, `Expected <= 4000, got ${clamped.length}`);
  assert.ok(clamped.includes("Animate the provided start frame"), "Must keep leading I2V_MOTION_LOCK");
  assert.ok(clamped.includes(actionLine), "Must prioritize action line");
  assert.ok(clamped.includes(cameraLine), "Must prioritize camera line");
});

test("buildGrokVideoGenerateBody clamps prompt to <= 4096 and refuses T2V without image", () => {
  const longPrompt = `${"GENRE DIRECTIVE: long essay ".repeat(150)}\n\nACTION: Character smiles and nods.`;
  const body = buildGrokVideoGenerateBody({
    prompt: longPrompt,
    firstFrameUrl: "https://cdn.supabase.co/storage/v1/object/public/Spark/brands/b1/p1/still.png",
  });
  const promptStr = body.prompt as string;
  assert.ok(promptStr.length <= 4096, `Prompt length ${promptStr.length} must be <= 4096`);
  assert.ok(promptStr.includes("Animate the provided start frame"));
  assert.ok(promptStr.includes("ACTION: Character smiles and nods."));

  // Still refuses T2V when firstFrame is missing
  assert.throws(
    () =>
      buildGrokVideoGenerateBody({
        prompt: "any text",
      }),
    /numInputImages=0 forbidden/
  );
});

test("Per-provider contracts: Grok has reference_images, HF I2V has image_url only, HF R2V has image_urls", () => {
  const still = "https://cdn.supabase.co/storage/v1/object/public/Spark/brands/b1/still.png";
  const end = "https://cdn.supabase.co/storage/v1/object/public/Spark/brands/b1/end.png";
  const ref1 = "https://cdn.supabase.co/storage/v1/object/public/Spark/brands/b1/ref1.png";
  const ref2 = "https://cdn.supabase.co/storage/v1/object/public/Spark/brands/b1/ref2.png";

  // 1. Grok: image + last_frame + reference_images <= 7
  const grokBody = buildGrokVideoGenerateBody({
    prompt: "Grok cinematic movement",
    firstFrameUrl: still,
    lastFrameUrl: end,
    referenceImageUrls: [ref1, ref2],
    durationSec: 10,
    aspectRatio: "16:9",
  });
  assert.equal((grokBody.image as any)?.url, still);
  assert.equal((grokBody.last_frame as any)?.url, end);
  assert.ok(Array.isArray(grokBody.reference_images));
  assert.equal((grokBody.reference_images as any[]).length, 2);
  assert.deepEqual(grokBody.reference_images, [{ url: ref1 }, { url: ref2 }]);

  // 2. HF Seedance I2V: image_url + optional end_image_url ONLY (never reference_images or image_urls)
  const hfI2vBody = buildHiggsfieldSeedanceI2vBody({
    prompt: "HF I2V motion",
    firstFrameUrl: still,
    lastFrameUrl: end,
    referenceImageUrls: [ref1, ref2], // Must be ignored / omitted by pure I2V builder
    durationSec: 25,
    resolution: "720p",
  });
  assert.equal(hfI2vBody.image_url, still);
  assert.equal(hfI2vBody.end_image_url, end);
  assert.equal(hfI2vBody.duration, 25);
  assert.equal(hfI2vBody.resolution, "720p");
  assert.equal(hfI2vBody.output_format, "mp4");
  assert.equal((hfI2vBody as any).reference_images, undefined, "HF I2V must NEVER have reference_images");
  assert.equal((hfI2vBody as any).image_urls, undefined, "HF I2V must NEVER have image_urls");

  // 3. HF Seedance R2V: image_urls required (refs + still)
  const hfR2vBody = buildHiggsfieldSeedanceR2vBody({
    prompt: "HF R2V reference motion",
    firstFrameUrl: still,
    referenceImageUrls: [ref1, ref2],
    aspectRatio: "9:16",
    durationSec: 15,
  });
  assert.ok(Array.isArray(hfR2vBody.image_urls));
  assert.equal((hfR2vBody.image_urls as string[]).length, 3);
  assert.deepEqual(hfR2vBody.image_urls, [still, ref1, ref2]);
  assert.equal(hfR2vBody.aspect_ratio, "9:16");
  assert.equal(hfR2vBody.duration, 15);
  assert.equal((hfR2vBody as any).image_url, undefined, "HF R2V uses image_urls, not image_url");
  assert.equal((hfR2vBody as any).reference_images, undefined, "HF R2V does not use Grok reference_images format");
});


