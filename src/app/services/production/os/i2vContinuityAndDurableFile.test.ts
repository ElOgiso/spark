import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGrokVideoGenerateBody,
  buildVeoVideoPayload,
  snapVeoDuration,
  snapGrokDuration,
} from "../../../../../api/runtime/_videoContract";
import {
  resolveOfficialShotStill,
  resolveOfficialI2vClipFrames,
  looksLikeSheetOrGridUrl,
  looksLikeStoryboardGridUrl,
} from "../officialI2vFrames";
import {
  isEphemeralMediaUrl,
  isSparkStorageUrl,
  isPersistableSparkMediaUrl,
  resolveFreshPlayableUrl,
  isDurableMasterVideoReady,
} from "../productionAssetService";
import {
  resolveImmediatePlayableVideoUrl,
  resolveCanonicalMasterVideoUrl,
  resolveCanonicalProductionMedia,
} from "../canonicalProductionMedia";

test("SPARK — I2V CONTINUITY + DURABLE FILE", async (t) => {
  await t.test("1. Ref order & forbidden start frame: still required before motion, grids & sheets forbidden as first frame", () => {
    // Missing still throws
    assert.throws(
      () =>
        resolveOfficialI2vClipFrames({
          sceneImage: "",
          keyframeUrl: undefined,
          generatedFrameUrl: undefined,
        }),
      /I2V requires this shot's still as frame 1/
    );

    // Storyboard grid is forbidden as first frame
    assert.equal(looksLikeStoryboardGridUrl("https://spark.storage/storyboard-grid.png"), true);
    assert.equal(looksLikeSheetOrGridUrl("https://spark.storage/character-sheet.png"), true);
    assert.equal(looksLikeSheetOrGridUrl("https://spark.storage/contact-sheet.png"), true);
    assert.equal(looksLikeSheetOrGridUrl("https://spark.storage/thumbnail.png"), true);

    assert.throws(
      () =>
        resolveOfficialI2vClipFrames({
          sceneImage: "https://spark.storage/brands/b1/storyboard-grid.png",
          forbidden: { gridUrl: "https://spark.storage/brands/b1/storyboard-grid.png" },
        }),
      /I2V requires this shot's still as frame 1/
    );

    // Valid shot still passes as first frame
    const frames = resolveOfficialI2vClipFrames({
      sceneImage: "https://spark.storage/brands/b1/p1/scenes/scene-01-still.png",
      previousLastFrameUrl: "https://spark.storage/brands/b1/p1/scenes/scene-00-last.jpg",
    });
    assert.equal(frames.firstFrameUrl, "https://spark.storage/brands/b1/p1/scenes/scene-01-still.png");
    assert.equal(frames.lastFrameUrl, "https://spark.storage/brands/b1/p1/scenes/scene-00-last.jpg");
  });

  await t.test("2. Grok official body: first frame = still, last_frame = continuation, reference_images = sheet (no duplicate still), clamped duration", () => {
    const still = "https://spark.storage/brands/b1/p1/scenes/scene-02-still.png";
    const lastFrame = "https://spark.storage/brands/b1/p1/scenes/scene-01-last.jpg";
    const charSheet = "https://spark.storage/brands/b1/characters/char-sheet.png";
    const locationPlate = "https://spark.storage/brands/b1/locations/studio-plate.png";

    const body = buildGrokVideoGenerateBody({
      prompt: "Cinematic push-in",
      firstFrameUrl: still,
      lastFrameUrl: lastFrame,
      characterSheetUrl: charSheet,
      referenceImageUrls: [charSheet, locationPlate, still], // includes still to test deduplication
      aspectRatio: "16:9",
      durationSec: 15,
      resolution: "720p",
    });

    // 1. Image is still
    assert.deepEqual(body.image, { url: still });
    assert.equal(body.image_url, still);

    // 2. Last frame is continuation object + compatibility alias
    assert.deepEqual(body.last_frame, { url: lastFrame });
    assert.equal((body as any).last_frame_url, lastFrame);

    // 3. Reference images has charSheet & plate, but NEVER duplicates still or lastFrame
    const refUrls = ((body.reference_images as any[]) || []).map((r) => r.url);
    assert.ok(refUrls.includes(charSheet), "Should include charSheet");
    assert.ok(refUrls.includes(locationPlate), "Should include locationPlate");
    assert.ok(!refUrls.includes(still), "Must NOT duplicate still in reference_images");
    assert.ok(!refUrls.includes(lastFrame), "Must NOT duplicate lastFrame in reference_images");

    // 4. Duration is clamped to profile native max (15s)
    assert.equal(body.duration, 15);
    assert.equal(snapGrokDuration(30), 15);
    assert.equal(body.aspect_ratio, "16:9");
  });

  await t.test("3. Veo official body: first frame = still, lastFrame = prior clip end, durationSeconds only 4|6|8 (8 when lastFrame present)", () => {
    const firstDataUri = "data:image/jpeg;base64,AAAA";
    const lastDataUri = "data:image/jpeg;base64,BBBB";

    // Veo duration snaps:
    assert.equal(snapVeoDuration(5), 6);
    assert.equal(snapVeoDuration(3), 4);
    assert.equal(snapVeoDuration(7), 8);
    // Forced to 8 when lastFrame is present
    assert.equal(snapVeoDuration(4, { hasLastFrame: true }), 8);

    const payloadWithLast = buildVeoVideoPayload({
      prompt: "Smooth tracking shot",
      firstFrameDataUri: firstDataUri,
      lastFrameDataUri: lastDataUri,
      aspectRatio: "9:16",
      durationSec: 6,
    });

    assert.equal(payloadWithLast.parameters.durationSeconds, 8);
    assert.equal(payloadWithLast.parameters.aspectRatio, "9:16");
    assert.ok(payloadWithLast.instances[0].image, "Must have image");
    assert.ok(payloadWithLast.instances[0].lastFrame, "Must have lastFrame");

    const payloadWithoutLast = buildVeoVideoPayload({
      prompt: "Opening shot",
      firstFrameDataUri: firstDataUri,
      aspectRatio: "16:9",
      durationSec: 4,
    });
    assert.equal(payloadWithoutLast.parameters.durationSeconds, 4);
    assert.equal(payloadWithoutLast.instances[0].lastFrame, undefined);
  });

  await t.test("4. Ingest & playback: isEphemeralMediaUrl does not wipe the only playable URL pre-ingest", async () => {
    const ephemeralUrl = "https://vidgen.x.ai/video123.mp4";
    assert.equal(isEphemeralMediaUrl(ephemeralUrl), true);
    assert.equal(isPersistableSparkMediaUrl(ephemeralUrl), false);

    // resolveFreshPlayableUrl must NOT return url: undefined for ephemeral URL without storage path
    const resolved = await resolveFreshPlayableUrl({
      url: ephemeralUrl,
      storagePath: null,
      productionId: "prod-test",
      brandId: "brand-test",
      assetType: "video",
    });

    assert.equal(
      resolved.url,
      ephemeralUrl,
      "Must preserve the provider URL pre-ingest so player does not blank in Review"
    );
    assert.equal(resolved.isEphemeralWithoutStorage, true);
  });

  await t.test("5. Ingest & playback: resolveImmediatePlayableVideoUrl plays provider URL immediately", () => {
    const providerClip = "https://vidgen.x.ai/video-shot-1.mp4";
    const prod: any = {
      id: "p1",
      videoUrl: providerClip,
      scenes: [{ scene: 1, videoUrl: providerClip }],
    };

    const immediate = resolveImmediatePlayableVideoUrl(prod);
    assert.equal(immediate, providerClip, "Immediate playable URL must return the provider clip");
  });

  await t.test("6. Ingest & playback: durable master preferred over in-flight preview over scene clips", () => {
    const durableMaster =
      "https://xyz.supabase.co/storage/v1/object/public/Spark/brands/b1/p1/video/master.mp4";
    const providerClip = "https://vidgen.x.ai/video-shot-1.mp4";

    assert.equal(isDurableMasterVideoReady(durableMaster), true);
    assert.equal(isDurableMasterVideoReady(providerClip), false);

    // When both exist, canonical master picks durable master
    const prod: any = {
      id: "p1",
      videoUrl: durableMaster,
      canonicalMasterUrl: durableMaster,
      productionScenes: [{ scene: 1, videoUrl: providerClip }],
    };
    const master = resolveCanonicalMasterVideoUrl({ production: prod });
    assert.equal(master, durableMaster);
  });

  await t.test("7. Review truth: gallery card has its own shot still and shot clip; complete production plays master", () => {
    const shot1Still = "https://spark.storage/brands/b1/p1/scenes/scene-01.png";
    const shot1Clip = "https://spark.storage/brands/b1/p1/scenes/scene-01.mp4";
    const shot2Still = "https://spark.storage/brands/b1/p1/scenes/scene-02.png";
    const shot2Clip = "https://spark.storage/brands/b1/p1/scenes/scene-02.mp4";
    const masterUrl = "https://spark.storage/brands/b1/p1/video/master.mp4";

    const prod: any = {
      id: "prod-truth",
      videoUrl: masterUrl,
      canonicalMasterUrl: masterUrl,
      productionScenes: [
        { scene: 1, image: shot1Still, videoUrl: shot1Clip, visualDescription: "Opening scene" },
        { scene: 2, image: shot2Still, videoUrl: shot2Clip, visualDescription: "Followup scene" },
      ],
    };

    const media = resolveCanonicalProductionMedia({ production: prod });
    assert.equal(media.hasCanonicalMaster, true);
    assert.equal(media.canonicalMasterUrl, masterUrl);

    // Shot 1 has its own still + clip
    assert.equal(media.scenes[0].imageUrl, shot1Still);
    assert.equal(media.scenes[0].videoUrl, shot1Clip);

    // Shot 2 has its own still + clip (never identical to shot 1)
    assert.equal(media.scenes[1].imageUrl, shot2Still);
    assert.equal(media.scenes[1].videoUrl, shot2Clip);
    assert.notEqual(media.scenes[0].videoUrl, media.scenes[1].videoUrl);
  });
});
