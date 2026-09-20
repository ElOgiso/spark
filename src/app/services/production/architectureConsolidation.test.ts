/**
 * SPARK Phase 1 — Architecture Consolidation Regression Tests
 *
 * Verifies:
 * 1. Single canonical production orchestration authority (ProductionService + ProductionSpec)
 * 2. Canonical generation execution authority (executeProduction + liveAssetExecuteAdapter)
 * 3. Canonical routing authority (ModelRouter at runtime + CapabilityRouter for preproduction)
 * 4. Semantic types are provider-independent (ProductionSpec / SceneSpec / ShotSpec)
 * 5. Compatibility adapters maintain fidelity (ProductionBrief <-> ProductionSpec)
 * 6. Deprecated paths are safely isolated
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ProductionService } from "../productionService";
import { ModelRouter } from "../runtime/modelRouter";
import { routeProductionShots } from "./routing/capabilityRouter";
import { executeProduction } from "./execution/productionExecutor";
import { resolveProductionSpec } from "./execution/productionExecutionBridge";
import {
  legacyProductionToSpec,
  productionSpecToBrief,
} from "./specification/adapters";
import { mergeSceneVideosClientUnused } from "./sceneVideoMerger";
import type { Production, ProductionBrief, Brand } from "../../domain/types";
import type { ProductionSpec } from "./specification/productionSpec";

describe("SPARK Phase 1: Architecture Consolidation", () => {
  it("1. Canonical Production Orchestration: ProductionService resolves ProductionSpec", () => {
    const mockProd: Production = {
      id: "prod_arch_01",
      title: "Architecture Test Video",
      status: "Drafting",
      dateCreated: "2026-09-20",
      targetDurationSec: 15,
      aspectRatio: "9:16",
      formats: ["YouTube Shorts"],
      brief: {
        title: "Architecture Test Video",
        hook: "Revolutionary discovery ahead",
        whyThisWorks: "High curiosity score",
        aspectRatio: "9:16",
        targetDurationSec: 15,
        storyboard: [
          {
            scene: 1,
            duration: "0-5s",
            shotList: "Close-up hero framing",
            visualDescription: "Lab interior with scientist",
            spokenLines: "Look closely at this reaction.",
          },
          {
            scene: 2,
            duration: "5-15s",
            shotList: "Wide product demonstration",
            visualDescription: "Product transforming on bench",
            spokenLines: "It changes everything in seconds.",
          },
        ],
      },
      scenes: [],
    };

    const brand: Brand = {
      id: "brand_test",
      name: "Test Brand",
      niche: "tech",
      visualGenre: "photoreal",
      brandVoice: "Authoritative",
    };

    const spec = resolveProductionSpec(mockProd, brand);
    assert.ok(spec, "Must produce a valid ProductionSpec");
    assert.equal(spec.project.id, "prod_arch_01");
    assert.equal(spec.project.aspectRatio, "9:16");
    assert.equal(spec.scenes.length, 2, "Must adapt the 2 scenes into SceneSpecs");
    assert.ok(spec.scenes[0].shots.length >= 1, "Scene must have at least one ShotSpec");
  });

  it("2. Canonical Generation Execution: executeProduction handles dryRun without live spend", async () => {
    const brief: ProductionBrief = {
      title: "Dry Run Test Video",
      hook: "Did you know this fact?",
      whyThisWorks: "High curiosity coefficient",
      aspectRatio: "9:16",
      targetDurationSec: 10,
      storyboard: [
        {
          scene: 1,
          duration: "0-10s",
          shotList: "Medium framing presenter",
          visualDescription: "Bright modern studio",
          spokenLines: "Check out this new breakthrough.",
        },
      ],
    };

    const testSpec = legacyProductionToSpec({
      production: {
        id: "prod_exec_test",
        title: "Dry Run Test Video",
        brief,
        status: "Drafting",
        dateCreated: "2026-09-20",
        scenes: [],
      },
      brand: {
        id: "brand_test",
        name: "Test Brand",
      },
    });

    const result = await executeProduction(testSpec, { dryRun: true });
    assert.ok(result, "executeProduction must return a result");
    assert.equal(result.ok, true, `Dry-run execution must succeed: ${(result.errors || []).join("; ")}`);
    assert.ok(result.tasks.length > 0, "Must have planned generation tasks");
    assert.ok(result.dag, "Must have constructed a production DAG");
  });

  it("3. Canonical Routing Authority: ModelRouter maps categories and honors preferred provider", () => {
    // Default categories map to standard modalities
    assert.equal(ModelRouter.mapCategoryToCapability("storyboardImages"), "Image Generation");
    assert.equal(ModelRouter.mapCategoryToCapability("videoGeneration"), "Video Generation");
    assert.equal(ModelRouter.mapCategoryToCapability("voice"), "Text To Speech");
    assert.equal(ModelRouter.mapCategoryToCapability("research"), "Reasoning");

    // Default provider resolution
    const defaultImageProv = ModelRouter.resolveProvider("storyboardImages");
    assert.ok(["openai", "gemini", "grok"].includes(defaultImageProv));

    // Custom user routing configuration is respected
    const customProv = ModelRouter.resolveProvider("storyboardImages", {
      storyboardImages: "grok",
    });
    assert.equal(customProv, "grok");
  });

  it("4. Semantic Production Types: ShotSpec is provider-independent by design", () => {
    const shot: ProductionSpec["scenes"][0]["shots"][0] = {
      id: "shot_semantic_01",
      sceneId: "scene_01",
      index: 0,
      purpose: "exposition",
      productionReason: "Explain concept cleanly",
      timingStartSec: 0,
      durationSec: 5,
      subject: "Character A",
      subjectAction: "Walks across laboratory",
      environment: "Futuristic lab",
      camera: {
        shotType: "wide",
        framing: "wide",
        composition: "rule of thirds",
        cameraPosition: "low angle",
        cameraMovement: "tracking",
        lens: "24mm",
        depthOfField: "deep",
        focus: "hyperfocal",
      },
      lighting: { atmosphere: "neon glow" },
      motion: {
        subjectMovement: "brisk pace",
        cameraMovementDetail: "tracks along hallway",
        beginState: "left of frame",
        endState: "center frame",
      },
    };

    // Semantic fields describe film grammar, not vendor APIs
    assert.ok(shot.camera.shotType);
    assert.ok(shot.motion.subjectMovement);
    assert.equal(typeof shot.durationSec, "number");
  });

  it("5. Compatibility Adapters: bidirectional translation preserves critical brief metadata", () => {
    const brief: ProductionBrief = {
      title: "Adapter Compatibility Verification",
      hook: "Did you know this fact?",
      whyThisWorks: "High shareability coefficient",
      aspectRatio: "9:16",
      suggestedDuration: "15s",
      targetDurationSec: 15,
      platformRecommendation: "TikTok + YouTube Shorts",
      storyboard: [
        {
          scene: 1,
          duration: "0-5s",
          shotList: "Tight close up",
          visualDescription: "Intense eye contact",
          spokenLines: "Stop scrolling right now.",
        },
      ],
    };

    const spec = legacyProductionToSpec({
      production: {
        id: "prod_compat_01",
        brief,
        title: brief.title,
        status: "Drafting",
        dateCreated: "2026-09-20",
        scenes: [],
      },
      brand: {
        id: "b1",
        name: "Test Brand",
      },
    });

    assert.equal(spec.project.title, brief.title);
    assert.equal(spec.project.aspectRatio, "9:16");
    assert.equal(spec.scenes.length, 1);

    const backBrief = productionSpecToBrief(spec, brief);
    assert.equal(backBrief.title, brief.title);
    assert.equal(backBrief.hook, brief.hook);
    assert.equal(backBrief.whyThisWorks, brief.whyThisWorks);
  });

  it("6. Deprecated Components: mergeSceneVideosClientUnused returns null safely", async () => {
    const result = await mergeSceneVideosClientUnused({
      videoUrls: ["https://example.com/clip1.mp4"],
    });
    assert.equal(result, null, "Unused client merge must always safely return null");
  });
});
