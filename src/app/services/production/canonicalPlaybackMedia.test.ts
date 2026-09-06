import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectDurableSceneClipUrls,
  resolveCanonicalMasterVideoUrl,
  buildReviewPlaybackScenes,
} from "./canonicalPlaybackMedia";

const CLIP_A =
  "https://cdn.example.com/storage/v1/object/public/Spark/prod/video/scene-1.mp4";
const CLIP_B =
  "https://cdn.example.com/storage/v1/object/public/Spark/prod/video/scene-2.mp4";
const FALLBACK =
  "https://cdn.example.com/storage/v1/object/public/Spark/prod/video/master-fallback.mp4";
const MERGED =
  "https://cdn.example.com/storage/v1/object/public/Spark/prod/video/master.mp4";

describe("canonicalPlaybackMedia — single spine Review ↔ Assets", () => {
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

  it("does not promote narrator fallback master when cinematic clips exist", () => {
    const master = resolveCanonicalMasterVideoUrl({
      production: { videoUrl: FALLBACK },
      review: { videoUrl: FALLBACK },
      brief: {
        videoUrl: FALLBACK,
        storyboard: [{ videoUrl: CLIP_A }, { videoUrl: CLIP_B }],
        generatedAssets: { generatedVideos: [CLIP_A, CLIP_B] },
      },
    });
    assert.equal(master, undefined);
  });

  it("uses true merged master when it is distinct from scene clips", () => {
    const master = resolveCanonicalMasterVideoUrl({
      production: {
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

  it("allows slideshow fallback only when no scene clips exist", () => {
    const master = resolveCanonicalMasterVideoUrl({
      production: { videoUrl: FALLBACK },
      brief: {
        videoUrl: FALLBACK,
        storyboard: [{ image: "https://cdn.example.com/still.jpg" }],
      },
    });
    assert.equal(master, FALLBACK);
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
