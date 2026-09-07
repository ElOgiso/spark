/**
 * Stage 2 — live generate always uses full Production OS lifecycle.
 * AssetService remains the sole media executor via Spec bridge.
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createProductionPlan } from "./intelligence/productionOrchestrator";
import { runProductionLifecycle } from "./execution/productionLifecycleRunner";
import { createLiveAssetExecuteAdapter } from "./execution/liveAssetExecuteAdapter";
import { createExistingMasterPassthroughAdapter } from "./editorial/mastering/ffmpegAdapter";
import { ProductionAssetService } from "./productionAssetService";
import type { ProductionSpec } from "./specification/productionSpec";
import type { Brand, Production, ProductionBrief } from "../../domain/types";
import { applyVisualPlanningPipeline } from "./generation/visualPlanningPipeline";

function makeSpec(): ProductionSpec {
  const plan = createProductionPlan({
    idea: "A creator explains a 30-second AI workflow tip for busy founders",
    targetDurationSec: 30,
    productionMode: "standard",
  });
  assert.equal(plan.ok, true, (plan.errors || []).join("; "));
  assert.ok(plan.spec);
  return plan.spec!;
}

describe("Stage 2 live full pipeline", () => {
  it("planning enables operational GenerationIntent tasks by default", () => {
    const plan = createProductionPlan({
      idea: "Host walks through a morning coffee routine for creators",
      targetDurationSec: 40,
    });
    assert.equal(plan.ok, true);
    assert.ok(plan.spec);
    const visual = applyVisualPlanningPipeline(plan.spec!, {
      grammar: plan.grammar!,
      preferI2V: true,
    });
    assert.ok((visual.stats.operationalShots || 0) >= 1, "operational shots must run by default");
    assert.ok(visual.generationTasks.some((t) => t.kind === "video" || t.kind === "keyframe"));
  });

  it("lifecycle conductor uses AssetBridge execute + real master passthrough", async () => {
    const spec = makeSpec();
    const brand = { id: "brand_test", name: "Test Brand" } as Brand;
    const brief: ProductionBrief = {
      title: "Pipeline tip",
      hook: "Stop wasting mornings",
      storyboard: [],
      targetDurationSec: 30,
      productionMode: "standard",
    } as ProductionBrief;
    const production = {
      id: spec.project.id,
      brandId: brand.id,
      title: "Pipeline tip",
      status: "Generating",
      brief,
      reasoning: { productionSpec: spec },
    } as Production;

    const masterUrl = "https://cdn.example.test/live/master.mp4";
    const generateMock = mock.method(ProductionAssetService, "generateAssets", async (params: any) => {
      const storyboard = (params.brief?.storyboard || []).map((panel: any, i: number) => ({
        ...panel,
        image: `https://cdn.example.test/live/kf_${i}.png`,
        keyframeImageUrl: `https://cdn.example.test/live/kf_${i}.png`,
        videoUrl: `https://cdn.example.test/live/clip_${i}.mp4`,
      }));
      return {
        brief: {
          ...brief,
          ...params.brief,
          storyboard,
          generationProgress: { stage: "Complete", message: "done", percent: 100 },
        },
        scenes: storyboard.map((s: any, i: number) => ({
          scene: i + 1,
          description: s.visualDescription || `Scene ${i + 1}`,
          duration: "5s",
          image: s.image,
          videoUrl: s.videoUrl,
        })),
        productionScenes: storyboard,
        videoUrl: masterUrl,
        audioUrl: "https://cdn.example.test/live/voice.mp3",
      };
    });

    const liveExecute = createLiveAssetExecuteAdapter({
      production,
      brand,
      forceRegenerate: true,
    });

    const events: string[] = [];
    const report = await runProductionLifecycle({
      spec,
      options: {
        brandId: brand.id,
        automationMode: "balanced",
        enableQc: true,
        enableEditorial: true,
        enableMaster: true,
        allowCompleteWithoutMaster: true,
        masteringAdapter: createExistingMasterPassthroughAdapter(
          () => liveExecute.getLastBridgeResult()?.assetResult.videoUrl
        ),
        onEvent: (e) => events.push(e.type),
        deps: {
          executeProduction: liveExecute.executeProduction,
        },
      },
    });

    assert.equal(generateMock.mock.callCount() >= 1, true, "AssetService must be the executor");
    assert.equal(report.execution?.ok, true);
    assert.ok(events.includes("preflight_passed"));
    assert.ok(events.includes("generation_completed"));
    assert.ok(events.includes("qc_completed"));
    assert.ok(
      report.phase === "completed" || report.phase === "awaiting_review",
      `expected completed or awaiting_review, got ${report.phase}: ${report.summary}`
    );
    if (report.phase === "completed") {
      assert.equal(report.editorial?.mastering?.ok, true);
      assert.equal(report.editorial?.mastering?.output?.mediaUrl, masterUrl);
    }
    assert.ok(liveExecute.getLastBridgeResult()?.usedSpecBridge);

    generateMock.mock.restore();
  });

  it("createProductionPlan ops opt-out still works for legacy tests", () => {
    const plan = createProductionPlan({
      idea: "Legacy opt-out path",
      enableOperationalGeneration: false,
    });
    assert.equal(plan.ok, true);
    const visual = applyVisualPlanningPipeline(plan.spec!, {
      grammar: plan.grammar!,
      enableOperationalGeneration: false,
    });
    assert.equal(visual.stats.operationalShots, undefined);
  });
});
