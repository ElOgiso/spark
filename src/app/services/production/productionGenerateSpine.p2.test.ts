/**
 * Phase 2 — Single Generate Spine bridge tests.
 * Spec → Shot → Task → AssetService bridge (mocked providers).
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { GenerationTask } from "./specification/generationTask";
import type { ProductionSpec } from "./specification/productionSpec";
import { planGenerationTasks, resolveGenerationTasks } from "./generation/generationPlanner";
import { orchestrateIdeaToProductionSpec } from "./intelligence/productionOrchestrator";
import { ProductionAssetService } from "./productionAssetService";
import {
  applyTaskDependencyFailures,
  buildSpecDrivenBrief,
  buildSpecLinkedStoryboard,
  collectSpecShots,
  ensureGenerationTasks,
  executeProductionViaAssetBridge,
  isSpecLinkedStoryboard,
  markShotRetry,
  projectAssetsOntoSpec,
  resolveProductionSpec,
} from "./execution/productionExecutionBridge";
import type { Production } from "../../domain/types";

function makeTinySpec(): ProductionSpec {
  const { ok, spec, validation } = orchestrateIdeaToProductionSpec({
    idea: "Create a 20-second product explainer short about saving time with AI workflows",
    targetDurationSec: 20,
    productionMode: "standard",
  });
  assert.equal(ok, true, (validation?.errors || []).join("; "));
  assert.ok(spec);
  assert.ok(spec!.scenes.length >= 2, "orchestrator must return at least 2 scenes");

  // Build a deterministic 2-scene / 3-shot fixture from the orchestrated Spec.
  // Clear generationTasks so renamed shot ids do not keep stale task references.
  const sourceShots = spec!.scenes.flatMap((scene) => scene.shots);
  assert.ok(sourceShots.length >= 3, "orchestrator must return at least 3 shots");

  const mkShot = (sourceIndex: number, id: string, sceneId: string, index: number) => {
    const src = sourceShots[sourceIndex];
    return {
      ...src,
      id,
      sceneId,
      index,
      generationTasks: undefined,
    };
  };

  const trimmed: ProductionSpec = {
    ...spec!,
    scenes: [
      {
        ...spec!.scenes[0],
        id: "scene_01",
        index: 0,
        shots: [mkShot(0, "shot_01", "scene_01", 0)],
      },
      {
        ...spec!.scenes[1],
        id: "scene_02",
        index: 1,
        shots: [
          mkShot(1, "shot_02", "scene_02", 0),
          mkShot(2, "shot_03", "scene_02", 1),
        ],
      },
    ],
  };

  assert.equal(collectSpecShots(trimmed).length, 3);
  assert.deepEqual(
    collectSpecShots(trimmed).map((s) => s.id),
    ["shot_01", "shot_02", "shot_03"]
  );
  return trimmed;
}

describe("Phase 2 generate spine bridge", () => {
  it("stamps stable shotIds onto Spec-linked storyboard panels", () => {
    const spec = makeTinySpec();
    const storyboard = buildSpecLinkedStoryboard(spec);
    assert.equal(storyboard.length, 3, `expected 3 panels, got ${storyboard.length}`);
    assert.deepEqual(
      storyboard.map((s) => s.shotId),
      ["shot_01", "shot_02", "shot_03"]
    );
    assert.equal(isSpecLinkedStoryboard(storyboard), true);
    const brief = buildSpecDrivenBrief(spec);
    assert.ok(brief.productionMode);
    assert.equal(brief.storyboard?.length, 3);
    assert.equal(brief.storyboard?.[0].shotId, "shot_01");
  });

  it("plans GenerationTasks with stable shot identity", () => {
    const spec = makeTinySpec();
    const { tasks } = ensureGenerationTasks(spec);
    const shotTasks = tasks.filter((t) => t.shotId);
    assert.ok(shotTasks.length >= 3, `expected >=3 shot tasks, got ${shotTasks.length}`);
    const unexpected = shotTasks.filter(
      (t) => !["shot_01", "shot_02", "shot_03"].includes(String(t.shotId))
    );
    assert.equal(
      unexpected.length,
      0,
      `unexpected shot ids: ${unexpected.map((t) => t.shotId).join(",")}`
    );
    assert.ok(tasks.some((t) => t.kind === "keyframe"));
  });

  it("preserves shot id across retry metadata updates", () => {
    const spec = makeTinySpec();
    const retried = markShotRetry(spec, "shot_01", "provider timeout");
    const shot = collectSpecShots(retried).find((s) => s.id === "shot_01");
    assert.ok(shot);
    assert.equal(shot!.id, "shot_01");
    assert.equal(shot!.retry?.attempt, 1);
    assert.equal(collectSpecShots(retried).length, 3);
  });

  it("blocks dependents when a required dependency fails", () => {
    const tasks: GenerationTask[] = [
      {
        id: "shot_02_keyframe",
        kind: "keyframe",
        productionId: "prod_phase2_tiny",
        sceneId: "scene_02",
        shotId: "shot_02",
        strategy: { modality: "image" },
        requiredCapabilities: ["text_to_image"],
        dependsOn: [],
        status: "failed",
        lastError: "image provider 500",
      },
      {
        id: "shot_02_video",
        kind: "video",
        productionId: "prod_phase2_tiny",
        sceneId: "scene_02",
        shotId: "shot_02",
        strategy: { modality: "video" },
        requiredCapabilities: ["image_to_video"],
        dependsOn: ["shot_02_keyframe"],
        status: "queued",
      },
      {
        id: "shot_03_video",
        kind: "video",
        productionId: "prod_phase2_tiny",
        sceneId: "scene_02",
        shotId: "shot_03",
        strategy: { modality: "video" },
        requiredCapabilities: ["image_to_video"],
        dependsOn: ["shot_02_video"],
        status: "queued",
      },
    ];
    const next = applyTaskDependencyFailures(tasks);
    assert.equal(next.find((t) => t.id === "shot_02_keyframe")?.status, "failed");
    assert.equal(
      next.find((t) => t.id === "shot_02_video")?.status,
      "blocked",
      JSON.stringify(next.find((t) => t.id === "shot_02_video"))
    );
    assert.equal(next.find((t) => t.id === "shot_03_video")?.status, "blocked");
  });

  it("round-trips ProductionSpec through production.reasoning without changing shot ids", () => {
    const spec = makeTinySpec();
    const production = {
      id: "prod_phase2_tiny",
      title: "Phase 2 Tiny Production",
      status: "Drafting",
      mode: "standard",
      dateCreated: "2026-09-05",
      aspectRatio: "9:16",
      formats: ["YouTube Shorts"],
      scenes: [],
      reasoning: { productionSpec: spec },
      brief: buildSpecDrivenBrief(spec),
    } as Production;

    const restored = resolveProductionSpec(production);
    assert.deepEqual(
      collectSpecShots(restored).map((s) => s.id),
      ["shot_01", "shot_02", "shot_03"]
    );
    assert.equal(restored.scenes[0].id, "scene_01");
    assert.equal(restored.scenes[1].id, "scene_02");
  });

  it("executes Spec → AssetService bridge with mocked provider success", async () => {
    const spec = makeTinySpec();
    const production = {
      id: "prod_phase2_tiny",
      title: "Phase 2 Tiny Production",
      status: "Drafting",
      mode: "standard",
      dateCreated: "2026-09-05",
      aspectRatio: "9:16",
      formats: ["YouTube Shorts"],
      scenes: [],
      reasoning: { productionSpec: spec },
      brief: buildSpecDrivenBrief(spec),
    } as Production;

    const generateMock = mock.method(ProductionAssetService, "generateAssets", async (params: any) => {
      assert.equal(isSpecLinkedStoryboard(params.brief.storyboard), true);
      assert.equal(params.brief.storyboard[0].shotId, "shot_01");
      const productionScenes = params.brief.storyboard.map((panel: any, idx: number) => ({
        ...panel,
        image: `https://cdn.example.com/shot_${idx + 1}.jpg`,
        keyframeImageUrl: `https://cdn.example.com/shot_${idx + 1}.jpg`,
        videoUrl: `https://cdn.example.com/shot_${idx + 1}.mp4`,
      }));
      return {
        brief: {
          ...params.brief,
          storyboard: productionScenes,
          videoUrl: "https://cdn.example.com/master.mp4",
          audioUrl: "https://cdn.example.com/voice.mp3",
        },
        scenes: productionScenes.map((s: any, i: number) => ({
          scene: i + 1,
          description: s.visualDescription,
          duration: s.duration,
          image: s.image,
          videoUrl: s.videoUrl,
        })),
        productionScenes,
        audioUrl: "https://cdn.example.com/voice.mp3",
        videoUrl: "https://cdn.example.com/master.mp4",
      };
    });

    try {
      const result = await executeProductionViaAssetBridge({
        production,
        brand: { id: "brand_1", name: "Acme", niche: "saas" } as any,
      });
      assert.equal(result.usedSpecBridge, true);
      assert.equal(generateMock.mock.callCount(), 1);
      assert.equal(result.production.videoUrl, "https://cdn.example.com/master.mp4");
      assert.equal(result.production.status, "Ready for Review");
      const restoredShots = collectSpecShots(result.spec);
      assert.deepEqual(
        restoredShots.map((s) => s.id),
        ["shot_01", "shot_02", "shot_03"]
      );
      assert.ok(restoredShots.every((s) => s.keyframeUrl || s.mediaUrl));
      assert.ok(result.tasks.some((t) => t.kind === "keyframe" && t.status === "succeeded"));
    } finally {
      generateMock.mock.restore();
    }
  });

  it("does not mark production successful when mocked provider returns no master video", async () => {
    const spec = makeTinySpec();
    const production = {
      id: "prod_phase2_tiny_fail",
      title: "Phase 2 Fail Fixture",
      status: "Drafting",
      mode: "standard",
      dateCreated: "2026-09-05",
      aspectRatio: "9:16",
      formats: ["YouTube Shorts"],
      scenes: [],
      reasoning: { productionSpec: spec },
      brief: buildSpecDrivenBrief(spec),
    } as Production;

    const generateMock = mock.method(ProductionAssetService, "generateAssets", async (params: any) => {
      return {
        brief: {
          ...params.brief,
          lastError: "provider unavailable",
        },
        scenes: [],
        productionScenes: params.brief.storyboard,
        audioUrl: undefined,
        videoUrl: undefined,
      };
    });

    try {
      const result = await executeProductionViaAssetBridge({
        production,
        brand: { id: "brand_1", name: "Acme", niche: "saas" } as any,
      });
      assert.equal(result.production.status, "Failed");
      assert.equal(Boolean(result.production.videoUrl), false);
      assert.ok(result.tasks.some((t) => t.kind === "merge" && t.status === "failed"));
    } finally {
      generateMock.mock.restore();
    }
  });

  it("preserves express / standard / deep productionMode from Spec into brief", () => {
    for (const mode of ["express", "standard", "deep"] as const) {
      const { ok, spec } = orchestrateIdeaToProductionSpec({
        idea: "Short vertical tip about calendar hygiene",
        targetDurationSec: 15,
        productionMode: mode,
      });
      assert.equal(ok, true);
      assert.ok(spec);
      const brief = buildSpecDrivenBrief(spec!);
      assert.equal(String(brief.productionMode), mode);
    }
  });

  it("projects provider failure onto shot tasks without inventing success", () => {
    const spec = makeTinySpec();
    const tasks = planGenerationTasks(spec);
    const projected = projectAssetsOntoSpec({
      spec,
      tasks,
      productionId: spec.project.id,
      logger: () => undefined,
      assetResult: {
        brief: buildSpecDrivenBrief(spec),
        scenes: [],
        productionScenes: buildSpecLinkedStoryboard(spec).map((p, idx) =>
          idx === 1
            ? { ...p, lastError: "shot video failed" }
            : {
                ...p,
                image: `https://cdn.example.com/${p.shotId}.jpg`,
                videoUrl: `https://cdn.example.com/${p.shotId}.mp4`,
              }
        ),
        videoUrl: "https://cdn.example.com/master.mp4",
        audioUrl: "https://cdn.example.com/voice.mp3",
      },
    });
    const failedShotTasks = projected.tasks.filter((t) => t.shotId === "shot_02");
    assert.ok(failedShotTasks.some((t) => t.status === "failed" || t.status === "blocked"));
    assert.equal(collectSpecShots(projected.spec).find((s) => s.id === "shot_02")?.id, "shot_02");
  });

  it("preserves valid multi-scene clips and reports Ready for Review with assembly_pending when merge is unavailable", async () => {
    const spec = makeTinySpec();
    const production = {
      id: "prod_phase18_multi_scene",
      title: "Phase 18 Multi-Scene Test",
      status: "Drafting",
      mode: "deep",
      dateCreated: "2026-09-14",
      aspectRatio: "9:16",
      formats: ["YouTube Shorts"],
      scenes: [],
      reasoning: { productionSpec: spec },
      brief: buildSpecDrivenBrief(spec),
    } as Production;

    const clips = [
      "https://example-supabase.co/storage/v1/object/public/Spark/brands/brand_1/prod_1/video/shot-01.mp4",
      "https://example-supabase.co/storage/v1/object/public/Spark/brands/brand_1/prod_1/video/shot-02.mp4",
      "https://example-supabase.co/storage/v1/object/public/Spark/brands/brand_1/prod_1/video/shot-03.mp4",
    ];

    const generateMock = mock.method(ProductionAssetService, "generateAssets", async (params: any) => {
      const brief = {
        ...params.brief,
        assemblyStatus: "assembly_pending" as const,
        assemblyError: "FFMPEG concatenation unavailable on serverless image; retaining individual scene clips.",
        playablePreviewUrl: clips[0],
        generatedAssets: {
          generatedVideos: clips,
          sceneClips: clips,
        },
      };
      return {
        brief,
        scenes: clips.map((c, i) => ({
          scene: i + 1,
          description: `Scene ${i + 1}`,
          duration: "5s",
          videoUrl: c,
        })),
        productionScenes: clips.map((c, i) => ({
          scene: i + 1,
          id: `shot_0${i + 1}`,
          shotId: `shot_0${i + 1}`,
          description: `Scene ${i + 1}`,
          duration: "5s",
          image: `https://example-supabase.co/storage/v1/object/public/Spark/scenes/scene-0${i + 1}.png`,
          videoUrl: c,
        })),
        audioUrl: undefined,
        videoUrl: undefined,
        playablePreviewUrl: clips[0],
        assemblyStatus: "assembly_pending" as const,
        assemblyError: "FFMPEG concatenation unavailable on serverless image; retaining individual scene clips.",
      };
    });

    try {
      const result = await executeProductionViaAssetBridge({
        production,
        brand: { id: "brand_1", name: "Acme", niche: "saas" } as any,
      });
      assert.equal(result.production.status, "Ready for Review");
      assert.equal(result.production.lastError, undefined);
      assert.equal(result.production.playablePreviewUrl, clips[0]);
      assert.equal((result.production as any).assemblyStatus, "assembly_pending");
      assert.equal(Boolean(result.production.videoUrl), false);
      const mergeTask = result.tasks.find((t) => t.kind === "merge");
      assert.ok(mergeTask);
      assert.equal(mergeTask?.status, "skipped");
      assert.ok(
        mergeTask?.lastError?.includes("FFMPEG concatenation unavailable") ||
        mergeTask?.lastError?.includes("Master video assembly pending")
      );
      const videoTasks = result.tasks.filter((t) => t.kind === "video");
      assert.ok(videoTasks.length >= 2);
      assert.ok(videoTasks.every((t) => t.status === "succeeded"));
    } finally {
      generateMock.mock.restore();
    }
  });
});

describe("shared generation task selection", () => {
  it("preserves one attached task and fills missing production tasks in both paths", () => {
    const spec = makeTinySpec();
    spec.audio.hasNarration = true;
    const planned = planGenerationTasks(spec);
    const shot = spec.scenes[0].shots[0];
    const saved = { ...planned.find(t => t.shotId === shot.id)!, retryCount: 2, selectedModel: "saved-model" };
    shot.generationTasks = [saved];
    const bridge = ensureGenerationTasks(spec);
    const canonical = resolveGenerationTasks(spec);
    assert.deepEqual(bridge.tasks, canonical.tasks);
    assert.equal(canonical.tasks.find(t => t.id === saved.id)?.selectedModel, "saved-model");
    assert.equal(canonical.tasks.find(t => t.id === saved.id)?.retryCount, 2);
    assert.ok(canonical.tasks.some(t => t.kind === "voice"));
    assert.ok(canonical.tasks.some(t => t.kind === "merge"));
    for (const s of canonical.spec.scenes.flatMap(scene => scene.shots)) {
      assert.deepEqual(s.generationTasks, canonical.tasks.filter(t => t.shotId === s.id));
    }
    assert.deepEqual(shot.generationTasks, [saved], "input spec must not be mutated");
  });

  it("rejects stale and cross-production attachments and deduplicates repeated IDs", () => {
    const spec = makeTinySpec();
    const planned = planGenerationTasks(spec);
    const shot = spec.scenes[0].shots[0];
    const saved = planned.find(t => t.shotId === shot.id)!;
    shot.generationTasks = [saved, saved, { ...saved, id: "stale", shotId: "deleted-shot" }, { ...saved, id: "foreign", productionId: "other-production" }];
    const { tasks } = resolveGenerationTasks(spec);
    assert.equal(tasks.filter(t => t.id === saved.id).length, 1);
    assert.ok(!tasks.some(t => t.id === "stale" || t.id === "foreign"));
  });

  it("explicit replanning ignores attached task overrides", () => {
    const spec = makeTinySpec();
    const planned = planGenerationTasks(spec);
    const shot = spec.scenes[0].shots[0];
    shot.generationTasks = [{ ...planned.find(t => t.shotId === shot.id)!, selectedModel: "saved-model" }];
    assert.deepEqual(resolveGenerationTasks(spec, false).tasks, planGenerationTasks(spec));
  });
});
