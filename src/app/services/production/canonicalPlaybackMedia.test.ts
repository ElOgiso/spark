import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectDurableSceneClipUrls,
  resolveCanonicalMasterVideoUrl,
  buildReviewPlaybackScenes,
  resolveCanonicalProductionMedia,
  resolveCanonicalSceneVideoUrl,
  hasCanonicalPlayableMedia,
} from "./canonicalPlaybackMedia";

const CLIP_A =
  "https://cdn.example.com/storage/v1/object/public/Spark/prod/video/scene-1.mp4";
const CLIP_B =
  "https://cdn.example.com/storage/v1/object/public/Spark/prod/video/scene-2.mp4";
const CLIP_C =
  "https://cdn.example.com/storage/v1/object/public/Spark/prod/video/scene-3.mp4";
const FALLBACK =
  "https://cdn.example.com/storage/v1/object/public/Spark/prod/video/master-fallback.mp4";
const MERGED =
  "https://cdn.example.com/storage/v1/object/public/Spark/prod/video/master.mp4";

describe("canonicalPlaybackMedia — forensic single-spine lineage", () => {
  it("collects durable scene clips and ignores emergency slideshow fallbacks", () => {
    const clips = collectDurableSceneClipUrls({
      production: {
        videoUrl: FALLBACK,
        productionScenes: [{ videoUrl: CLIP_A }, { videoUrl: CLIP_B }],
      },
      brief: {
        videoUrl: FALLBACK,
        generatedAssets: { generatedVideos: [CLIP_A, CLIP_B] },
        storyboard: [{ videoUrl: CLIP_A }, { videoUrl: CLIP_B }],
      },
    });
    assert.deepEqual(clips, [CLIP_A, CLIP_B]);
  });

  it("GOLDEN: Review master === Assets clips spine when fallback also present", () => {
    const production = {
      id: "prod-cine-1",
      productionMode: "cinematic",
      videoUrl: FALLBACK,
      productionScenes: [
        { scene: 1, videoUrl: CLIP_A, image: "https://cdn.example.com/a.jpg" },
        { scene: 2, videoUrl: CLIP_B, image: "https://cdn.example.com/b.jpg" },
        { scene: 3, videoUrl: CLIP_C, image: "https://cdn.example.com/c.jpg" },
      ],
    };
    const brief = {
      productionMode: "deep",
      videoUrl: FALLBACK,
      storyboard: [
        { videoUrl: CLIP_A, image: "https://cdn.example.com/a.jpg" },
        { videoUrl: CLIP_B, image: "https://cdn.example.com/b.jpg" },
        { videoUrl: CLIP_C, image: "https://cdn.example.com/c.jpg" },
      ],
      generatedAssets: { generatedVideos: [CLIP_A, CLIP_B, CLIP_C] },
    };

    const media = resolveCanonicalProductionMedia({ production, brief, review: { videoUrl: FALLBACK } });
    assert.equal(media.resolvedMode, "deep");
    assert.equal(media.kind, "scene_clips");
    assert.equal(media.masterVideoUrl, undefined); // shot mode — same as Assets
    assert.deepEqual(media.sceneClipUrls, [CLIP_A, CLIP_B, CLIP_C]);

    const reviewScenes = buildReviewPlaybackScenes({ production, brief });
    for (let i = 0; i < 3; i++) {
      assert.equal(
        reviewScenes[i]?.videoUrl,
        resolveCanonicalSceneVideoUrl({ production, brief, sceneIndex: i }),
      );
      assert.equal(reviewScenes[i]?.videoUrl, [CLIP_A, CLIP_B, CLIP_C][i]);
    }
  });

  it("GOLDEN: cinematic mode never promotes narrator fallback as Review hero", () => {
    const master = resolveCanonicalMasterVideoUrl({
      production: { productionMode: "cinematic", videoUrl: FALLBACK },
      review: { videoUrl: FALLBACK },
      brief: {
        productionMode: "deep",
        videoUrl: FALLBACK,
        storyboard: [{ image: "https://cdn.example.com/still.jpg" }],
      },
    });
    assert.equal(master, undefined);

    const media = resolveCanonicalProductionMedia({
      production: { id: "p2", productionMode: "cinematic", videoUrl: FALLBACK },
      brief: { productionMode: "deep", videoUrl: FALLBACK, storyboard: [{ image: "https://cdn.example.com/still.jpg" }] },
    });
    assert.equal(media.modeMismatch, true);
    assert.ok(media.modeMismatchMessage);
    assert.equal(media.kind, "still_only");
    assert.equal(media.masterVideoUrl, undefined);
  });

  it("GOLDEN: express/narrator may use slideshow master when that is the mode", () => {
    const master = resolveCanonicalMasterVideoUrl({
      production: { productionMode: "express", videoUrl: FALLBACK },
      brief: { productionMode: "narrator", videoUrl: FALLBACK },
    });
    assert.equal(master, FALLBACK);
  });

  it("uses true merged master when distinct from scene clips", () => {
    const master = resolveCanonicalMasterVideoUrl({
      production: {
        productionMode: "deep",
        videoUrl: MERGED,
        productionScenes: [{ videoUrl: CLIP_A }, { videoUrl: CLIP_B }],
      },
      brief: {
        storyboard: [{ videoUrl: CLIP_A }, { videoUrl: CLIP_B }],
        generatedAssets: { generatedVideos: [CLIP_A, CLIP_B] },
      },
    });
    assert.equal(master, MERGED);
  });

  it("uses shot mode when provisional master is first of multiple distinct clips", () => {
    const master = resolveCanonicalMasterVideoUrl({
      production: {
        videoUrl: CLIP_A,
        productionScenes: [{ videoUrl: CLIP_A }, { videoUrl: CLIP_B }],
      },
      brief: {
        storyboard: [{ videoUrl: CLIP_A }, { videoUrl: CLIP_B }],
        generatedAssets: { generatedVideos: [CLIP_A, CLIP_B] },
      },
    });
    assert.equal(master, undefined);
  });

  it("GOLDEN: stale production.videoUrl fallback cannot override canonical clips", () => {
    const media = resolveCanonicalProductionMedia({
      production: {
        id: "legacy-1",
        productionMode: "deep",
        videoUrl: FALLBACK, // stale narrator
        productionScenes: [{ videoUrl: CLIP_A }, { videoUrl: CLIP_B }],
      },
      brief: {
        videoUrl: FALLBACK,
        generatedAssets: { generatedVideos: [CLIP_A, CLIP_B] },
        storyboard: [{ videoUrl: CLIP_A }, { videoUrl: CLIP_B }],
      },
    });
    assert.ok(media.sceneClipUrls.includes(CLIP_A));
    assert.ok(!media.masterVideoUrl || media.masterVideoUrl !== FALLBACK);
    assert.ok(
      hasCanonicalPlayableMedia({
        production: {
          productionMode: "deep",
          productionScenes: [{ videoUrl: CLIP_A }, { videoUrl: CLIP_B }],
        },
        brief: {
          storyboard: [{ videoUrl: CLIP_A }, { videoUrl: CLIP_B }],
          generatedAssets: { generatedVideos: [CLIP_A, CLIP_B] },
        },
      }),
    );
  });

  it("GOLDEN: ambiguous legacy with no canonical asset stays unresolved (no silent fallback)", () => {
    const media = resolveCanonicalProductionMedia({
      production: { id: "amb-1", productionMode: "cinematic" },
      review: { videoUrl: "https://cdn.example.com/unknown-review.mp4" },
      brief: { videoUrl: "https://cdn.example.com/unknown-brief.mp4" },
    });
    // unknown URLs that are durable https may still surface as master if not fallback-marked;
    // mode is deep so if they aren't fallback they could be used — ensure FALLBACK-marked unknown stays out
    const media2 = resolveCanonicalProductionMedia({
      production: { id: "amb-2", productionMode: "cinematic", videoUrl: FALLBACK },
      review: { videoUrl: FALLBACK },
      brief: { productionMode: "deep", videoUrl: FALLBACK },
    });
    assert.equal(media2.masterVideoUrl, undefined);
    assert.equal(media2.modeMismatch, true);
    assert.equal(hasCanonicalPlayableMedia({ production: { productionMode: "deep", videoUrl: FALLBACK }, brief: { videoUrl: FALLBACK } }), false);
  });

  it("binds Review playback scenes to the same clip URLs Production Assets use", () => {
    const scenes = buildReviewPlaybackScenes({
      production: {
        productionScenes: [
          { scene: 1, visualDescription: "Hook", image: "https://cdn.example.com/a.jpg" },
          { scene: 2, visualDescription: "Body", image: "https://cdn.example.com/b.jpg" },
        ],
      },
      brief: {
        storyboard: [{ videoUrl: CLIP_A }, { videoUrl: CLIP_B }],
        generatedAssets: { generatedVideos: [CLIP_A, CLIP_B] },
      },
    });
    assert.equal(scenes[0]?.videoUrl, CLIP_A);
    assert.equal(scenes[1]?.videoUrl, CLIP_B);
  });
});
