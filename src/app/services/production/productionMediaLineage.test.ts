/**
 * Golden lineage tests — Review / Assets / Spec shelves must agree.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveProductionMediaView,
  syncProductionMediaStores,
  toOneBasedSceneIndex,
  findReusableStill,
} from "./productionMediaLineage";

test("resolveProductionMediaView prefers Spec shot media when present", () => {
  const production = {
    id: "p1",
    status: "Ready for Review",
    reasoning: {
      productionSpec: {
        scenes: [
          {
            id: "sc1",
            shots: [
              {
                id: "shot-a",
                keyframeUrl: "https://cdn.example/still-a.png",
                mediaUrl: "https://cdn.example/clip-a.mp4",
                lastFrameUrl: "https://cdn.example/last-a.png",
                action: "Hook",
              },
              {
                id: "shot-b",
                keyframeUrl: "https://cdn.example/still-b.png",
                action: "Body",
              },
            ],
          },
        ],
      },
    },
    // Rival shelves intentionally wrong — resolver must ignore them when Spec has media
    productionScenes: [
      { scene: 1, image: "https://cdn.example/WRONG-ps.png" },
    ],
    brief: {
      storyboard: [{ scene: 1, image: "https://cdn.example/WRONG-brief.png" }],
    },
  };

  const view = resolveProductionMediaView({ production });
  assert.equal(view.lineageSource, "spec");
  assert.equal(view.scenes.length, 2);
  assert.equal(view.stillByScene[1], "https://cdn.example/still-a.png");
  assert.equal(view.stillByScene[2], "https://cdn.example/still-b.png");
  assert.equal(view.videoByScene[1], "https://cdn.example/clip-a.mp4");
  assert.equal(view.scenes[0].scene, 1);
  assert.equal(view.scenes[1].scene, 2);
});

test("resolveProductionMediaView falls back to productionScenes then brief.storyboard with same URLs", () => {
  const production = {
    id: "p2",
    productionScenes: [
      { scene: 1, image: "https://cdn.example/ps1.png", videoUrl: "https://cdn.example/ps1.mp4" },
      { index: 2, image: "https://cdn.example/ps2.png" },
    ],
    brief: {
      storyboard: [
        { scene: 1, image: "https://cdn.example/brief1.png" },
        { scene: 2, image: "https://cdn.example/brief2.png" },
      ],
    },
  };
  const view = resolveProductionMediaView({ production });
  assert.equal(view.lineageSource, "productionScenes");
  assert.equal(view.stillByScene[1], "https://cdn.example/ps1.png");
  assert.equal(view.stillByScene[2], "https://cdn.example/ps2.png");
});

test("syncProductionMediaStores projects one write onto brief + productionScenes + Spec", () => {
  const production = {
    id: "p3",
    brief: { storyboard: [{ scene: 1, shotId: "shot-a" }] },
    productionScenes: [],
    reasoning: {
      productionSpec: {
        scenes: [{ id: "sc1", shots: [{ id: "shot-a", keyframeUrl: "" }] }],
      },
    },
  };
  const synced = syncProductionMediaStores({
    production,
    scenes: [
      {
        scene: 1,
        shotId: "shot-a",
        image: "https://cdn.example/fixed.png",
        videoUrl: "https://cdn.example/fixed.mp4",
      },
    ],
    masterVideoUrl: "https://cdn.example/master.mp4",
  });
  assert.equal(synced.brief.storyboard[0].image, "https://cdn.example/fixed.png");
  assert.equal(synced.productionScenes[0].image, "https://cdn.example/fixed.png");
  assert.equal(synced.brief.generatedAssets.generatedFrames[0], "https://cdn.example/fixed.png");
  assert.equal(
    synced.reasoning.productionSpec.scenes[0].shots[0].keyframeUrl,
    "https://cdn.example/fixed.png"
  );
  assert.equal(synced.canonicalMasterUrl, "https://cdn.example/master.mp4");
  assert.equal(synced.brief.storyboardGridUrl, "https://cdn.example/fixed.png");
});

test("toOneBasedSceneIndex keeps 1-based gallery indexes", () => {
  assert.equal(toOneBasedSceneIndex(1, 3), 1);
  assert.equal(toOneBasedSceneIndex(3, 3), 3);
  assert.equal(toOneBasedSceneIndex(0, 3), 1);
});

test("findReusableStill binds by shotId not array index", () => {
  const url = findReusableStill({
    shotId: "shot-b",
    scene: 1,
    storyboard: [
      { shotId: "shot-a", image: "https://cdn.example/a.png" },
      { shotId: "shot-b", image: "https://cdn.example/b.png" },
    ],
    generatedFrames: ["https://cdn.example/WRONG-index.png", "https://cdn.example/b-index.png"],
  });
  assert.equal(url, "https://cdn.example/b.png");
});

test("golden: Review still === Assets still === Spec shot still; master === Review hero", () => {
  const master = "https://cdn.example/master.mp4";
  const still1 = "https://cdn.example/still-1.png";
  const still2 = "https://cdn.example/still-2.png";
  const production = {
    id: "p-golden",
    status: "Ready for Review",
    videoUrl: master,
    canonicalMasterUrl: master,
    reasoning: {
      productionSpec: {
        scenes: [
          {
            id: "sc1",
            shots: [
              { id: "shot-1", keyframeUrl: still1, mediaUrl: "https://cdn.example/clip-1.mp4" },
              { id: "shot-2", keyframeUrl: still2 },
            ],
          },
        ],
      },
    },
    // Intentionally divergent rival shelves — resolver must prefer Spec
    productionScenes: [{ scene: 1, image: "https://cdn.example/WRONG.png" }],
    brief: {
      storyboard: [{ scene: 1, image: "https://cdn.example/WRONG-brief.png" }],
      videoUrl: "https://cdn.example/WRONG-video.mp4",
      generatedAssets: {
        generatedFrames: ["https://cdn.example/WRONG-frame.png"],
        generatedVideos: ["https://cdn.example/WRONG-clip.mp4"],
        canonicalMasterUrl: master,
      },
    },
  };

  const reviewView = resolveProductionMediaView({ production, review: { productionId: "p-golden" } });
  const assetsView = resolveProductionMediaView({ production, brief: production.brief });

  assert.equal(reviewView.stillByScene[1], still1);
  assert.equal(assetsView.stillByScene[1], still1);
  assert.equal(reviewView.stillByScene[2], still2);
  assert.equal(assetsView.stillByScene[2], still2);
  assert.equal(reviewView.canonical.canonicalMasterUrl, master);
  assert.equal(assetsView.canonical.canonicalMasterUrl, master);
  assert.equal(reviewView.lineageSource, "spec");
  assert.equal(assetsView.lineageSource, "spec");
});

test("sync after scene fix keeps Review/Assets/Spec URLs identical", () => {
  const production = {
    id: "p-fix",
    brief: { storyboard: [{ scene: 1, shotId: "shot-b", image: "https://cdn.example/old.png" }] },
    productionScenes: [{ scene: 1, shotId: "shot-b", image: "https://cdn.example/old.png" }],
    reasoning: {
      productionSpec: {
        scenes: [{ id: "sc1", shots: [{ id: "shot-b", keyframeUrl: "https://cdn.example/old.png" }] }],
      },
    },
  };
  const fixed = "https://cdn.example/fixed-scene1.png";
  const synced = syncProductionMediaStores({
    production,
    scenes: [{ scene: 1, shotId: "shot-b", image: fixed, videoUrl: "https://cdn.example/s1.mp4" }],
  });
  const view = resolveProductionMediaView({ production: synced });
  assert.equal(view.stillByScene[1], fixed);
  assert.equal(synced.brief.storyboard.find((s: any) => s.scene === 1).image, fixed);
  assert.equal(synced.productionScenes.find((s: any) => s.scene === 1).image, fixed);
  assert.equal(synced.reasoning.productionSpec.scenes[0].shots[0].keyframeUrl, fixed);
});

test("reviewReady is false while Generating even if placeholder scenes exist", () => {
  const view = resolveProductionMediaView({
    production: {
      id: "p-gen",
      status: "Generating",
      isGeneratingAssets: true,
      generationProgress: { percent: 40, stage: "Keyframes" },
      productionScenes: [{ scene: 1, image: undefined }],
    },
  });
  assert.equal(view.isGenerating, true);
  assert.equal(view.reviewReady, false);
});
