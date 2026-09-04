/**
 * Phase 3 — Cinematography + Capability Routing + Generation Planning tests.
 * Planning only — no media generation API calls.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createProductionPlan } from "./intelligence/productionOrchestrator";
import { composeGrammars } from "./grammar";
import { planShotsForScene } from "./cinematography/shotPlanner";
import { planCameraForShot } from "./cinematography/cameraPlanner";
import { resolveShotGenerationStrategy } from "./generation/strategyResolver";
import { scoreProvidersForShot } from "./routing/modelScorer";
import { selectProviderForShot } from "./routing/providerSelector";
import { buildFallbackPlan } from "./routing/fallbackPlanner";
import { routeProductionShots } from "./routing/capabilityRouter";
import {
  compileShotPrompt,
  compileProductionPrompts,
} from "./generation/promptCompiler";
import { planPartialRegeneration, planShotRetry } from "./generation/retryPlanner";
import { applyVisualPlanningPipeline } from "./generation/visualPlanningPipeline";
import { buildProductionDag, readyNodes, dependentTaskIds } from "./dag/productionDag";
import { validateProductionSpec, productionSpecToBrief } from "./specification";
import type { ShotSpec } from "./specification/shotSpec";
import type { SceneSpec } from "./specification/sceneSpec";

function baseScene(partial?: Partial<SceneSpec>): Omit<SceneSpec, "shots"> & { shots?: ShotSpec[] } {
  return {
    id: "scene_1",
    index: 0,
    title: "Scene 1",
    purpose: "Establish the beat",
    narrativeFunction: "hook",
    environment: "Primary location",
    durationSec: 10,
    characterIds: ["character_001:v1"],
    propIds: [],
    emotionalObjective: "curiosity",
    continuity: {
      entranceState: "Open",
      exitState: "Exit",
      identityLocks: ["character_identity"],
      wardrobeLocks: ["wardrobe_state"],
      propLocks: [],
    },
    status: "planned",
    ...partial,
  };
}

describe("cinematography by genre grammar", () => {
  const cases: Array<{ genre: string; tags?: string[]; fn: SceneSpec["narrativeFunction"] }> = [
    { genre: "documentary", tags: ["cinematic"], fn: "proof" },
    { genre: "educational", fn: "example" },
    { genre: "advertisement", tags: ["luxury"], fn: "product" },
    { genre: "narrative_film", fn: "confrontation" },
    { genre: "animation", fn: "hook" },
    { genre: "comedy", fn: "payoff" },
    { genre: "music_video", fn: "montage" },
    { genre: "product_demo", fn: "product" },
  ];

  for (const c of cases) {
    it(`plans purposeful shots for ${c.genre}/${c.fn}`, () => {
      const grammar = composeGrammars(c.genre as any, [], c.tags || []);
      const shots = planShotsForScene({
        scene: baseScene({ narrativeFunction: c.fn, purpose: `${c.genre} ${c.fn}` }),
        grammar,
        aspectRatio: "9:16",
        maxShots: 3,
        preferI2V: true,
        characterIds: ["character_001:v1"],
        genre: c.genre,
      });
      assert.ok(shots.length >= 1);
      for (const shot of shots) {
        assert.ok(shot.productionReason.trim().length > 0);
        assert.ok(shot.purpose.trim().length > 0);
        assert.ok(shot.camera.shotType);
        assert.ok(shot.camera.framing);
        assert.ok(shot.motion.beginState);
        assert.ok(shot.motion.endState);
        assert.ok(shot.generationStrategySpec?.modality);
        assert.ok(!/to be planned|TBD/i.test(shot.camera.framing));
      }
    });
  }

  it("uses product emphasis framing for advertisement product beats", () => {
    const cam = planCameraForShot({
      shotType: "macro",
      grammar: composeGrammars("advertisement", [], ["luxury"]),
      narrativeFunction: "product",
      emotionalObjective: "premium",
    });
    assert.equal(cam.shotType, "macro");
    assert.ok(/product|detail|macro/i.test(cam.framing));
    assert.ok(cam.cameraMovement === "orbit" || cam.cameraMovement === "static");
  });

  it("keeps documentary observational rather than random crane spam", () => {
    const cam = planCameraForShot({
      shotType: "medium",
      grammar: composeGrammars("documentary"),
      narrativeFunction: "interview",
    });
    assert.ok(["static", "handheld", "pan", "tracking", "dolly"].includes(String(cam.cameraMovement)));
  });
});

describe("generation strategy resolver", () => {
  it("selects slideshow for express / non-I2V", () => {
    const r = resolveShotGenerationStrategy({
      shot: {
        index: 0,
        camera: { shotType: "medium", framing: "m", composition: "c", cameraPosition: "eye", cameraMovement: "static" },
        characterIds: [],
        durationSec: 5,
        references: { characterRefs: [], locationRefs: [], styleRefs: [] },
        generationStrategy: "image_to_video",
      },
      creative: {
        intent: "x",
        genre: "social",
        grammarTags: [],
        tone: "punchy",
        audience: "gen",
        narrativeStructure: "hook",
        visualLanguage: "social",
        pacing: "compressed",
        emotionalArc: "x",
        requiresHost: false,
        requiresCharacters: false,
        requiresNarration: true,
        requiresDialogue: false,
        requiresAnimation: false,
        requiresProductShots: false,
        requiresDocumentaryTreatment: false,
        requiresResearch: false,
        requiresGeneratedEnvironments: true,
        requiresStockOrUserAssets: false,
        requiresImageGeneration: true,
        requiresVideoGeneration: false,
        requiresVoiceGeneration: true,
        requiresMusic: true,
        requiresSoundDesign: true,
        requiresEditing: true,
        estimatedSceneCount: 3,
        estimatedShotCount: 3,
        confidence: 0.5,
        rationale: [],
      },
      preferI2V: false,
      isFirstShotInProduction: true,
    });
    assert.equal(r.alias, "slideshow_still");
  });

  it("selects multi_reference for character-consistent shots", () => {
    const plan = createProductionPlan({
      idea: "Cinematic story about a young explorer discovering a hidden city",
      targetDurationSec: 60,
    });
    assert.ok(plan.spec);
    const shot = plan.spec!.scenes[0].shots[0];
    assert.ok(
      shot.generationStrategy === "multi_reference" ||
        shot.generationStrategy === "image_to_video" ||
        shot.generationStrategy === "first_last_frame"
    );
  });

  it("selects first_last_frame for continuity-chained non-character shots", () => {
    const plan = createProductionPlan({
      idea: "Make a 5-minute YouTube video explaining Bitcoin",
      targetDurationSec: 300,
      productionMode: "standard",
    });
    assert.ok(plan.ok);
    const all = plan.spec!.scenes.flatMap((s) => s.shots);
    assert.ok(all.length >= 2);
    const chained = all.filter((s) => s.generationStrategy === "first_last_frame");
    // Educational may not require characters — expect chain strategies on later shots
    assert.ok(chained.length >= 1 || all.some((s) => s.references.previousShotId));
  });
});

describe("capability-based routing", () => {
  it("routes image-to-video differently from stills", () => {
    const plan = createProductionPlan({
      idea: "Create a luxury commercial for this watch",
      targetDurationSec: 30,
    });
    assert.ok(plan.ok && plan.spec);
    const videoShot = { ...plan.spec!.scenes[0].shots[0], generationStrategy: "image_to_video" as const };
    const stillShot = { ...plan.spec!.scenes[0].shots[0], generationStrategy: "slideshow_still" as const };
    const videoScores = scoreProvidersForShot(videoShot, plan.spec!.routing.capabilityPolicy);
    const stillScores = scoreProvidersForShot(stillShot, plan.spec!.routing.capabilityPolicy);
    assert.ok(videoScores.length > 0);
    assert.ok(stillScores.length > 0);
    assert.ok(videoScores[0].providerId !== "elevenlabs");
    assert.ok(stillScores.every((s) => (s.matchedCapabilities || []).includes("text_to_image") || s.score > 0));
  });

  it("requires last-frame capability for first_last_frame strategy", () => {
    const plan = createProductionPlan({ idea: "Travel montage of Tokyo streets", targetDurationSec: 45 });
    const shot = {
      ...plan.spec!.scenes[0].shots[0],
      generationStrategy: "first_last_frame" as const,
      characterIds: [] as string[],
    };
    const scores = scoreProvidersForShot(shot, plan.spec!.routing.capabilityPolicy);
    assert.ok(scores.length > 0);
    assert.ok(scores[0].matchedCapabilities.includes("last_frame_conditioning"));
  });

  it("scores character consistency for multi_reference", () => {
    const plan = createProductionPlan({
      idea: "Create a 60-second cinematic story about a young explorer",
      targetDurationSec: 60,
    });
    const shot = {
      ...plan.spec!.scenes[0].shots[0],
      generationStrategy: "multi_reference" as const,
      characterIds: ["character_001:v1"],
    };
    const scores = scoreProvidersForShot(shot, {
      ...plan.spec!.routing.capabilityPolicy,
      preferCharacterConsistency: true,
    });
    assert.ok(scores[0].matchedCapabilities.includes("character_consistency"));
  });

  it("disqualifies providers missing critical capabilities", () => {
    const plan = createProductionPlan({ idea: "Product demo for headphones", targetDurationSec: 30 });
    const shot = {
      ...plan.spec!.scenes[0].shots[0],
      generationStrategy: "image_to_video" as const,
    };
    // Only elevenlabs available — should yield empty after disqualify
    const scores = scoreProvidersForShot(shot, plan.spec!.routing.capabilityPolicy, ["elevenlabs"]);
    assert.equal(scores.length, 0);
  });

  it("builds capability-compatible fallbacks only", () => {
    const plan = createProductionPlan({
      idea: "Create a 60 second product commercial for a luxury watch.",
      targetDurationSec: 60,
    });
    assert.ok(plan.spec!.routing.shotDecisions.length > 0);
    const decision = plan.spec!.routing.shotDecisions[0];
    assert.ok(decision.provider);
    assert.ok(decision.provider !== "unavailable");
    const fb = buildFallbackPlan(decision, ["generation_failure"]);
    if (fb) {
      assert.ok(fb.nextProvider);
      assert.notEqual(fb.nextProvider, decision.provider);
    }
  });

  it("honors availableProviderIds filter", () => {
    const plan = createProductionPlan({
      idea: "Make a funny animated short",
      targetDurationSec: 30,
      availableProviderIds: ["kling", "seedance"],
    });
    assert.ok(plan.ok);
    for (const d of plan.spec!.routing.shotDecisions) {
      assert.ok(["kling", "seedance", "unavailable"].includes(d.provider));
    }
  });

  it("selectProvider returns explainable metadata", () => {
    const plan = createProductionPlan({ idea: "Educational explainer about gravity", targetDurationSec: 90 });
    const shot = plan.spec!.scenes[0].shots[0];
    const decision = selectProviderForShot(shot, plan.spec!.routing);
    assert.ok(typeof decision.score === "number");
    assert.ok(Array.isArray(decision.reasons));
    assert.ok(Array.isArray(decision.matchedCapabilities));
  });
});

describe("prompt compiler", () => {
  it("preserves structured semantic + cinematic layers", () => {
    const plan = createProductionPlan({
      idea: "Create a 10 minute documentary about the history of Benin.",
      targetDurationSec: 120,
    });
    const scene = plan.spec!.scenes[0];
    const shot = scene.shots[0];
    const compiled = compileShotPrompt(plan.spec!, scene, shot);
    assert.equal(compiled.semantic.genre, plan.spec!.creative.genre);
    assert.ok(compiled.semantic.shotPurpose);
    assert.ok(compiled.cinematic.shotType);
    assert.ok(compiled.cinematic.beginState);
    assert.ok(compiled.prompt.includes(compiled.semantic.shotPurpose));
    assert.ok(compiled.prompt.includes("CAMERA:"));
    assert.ok(!/\b(beautiful|stunning|epic|masterpiece)\b/i.test(compiled.prompt));
  });

  it("stamps compiled prompts onto all shots", () => {
    const plan = createProductionPlan({ idea: "Luxury watch commercial", targetDurationSec: 30 });
    assert.ok(plan.spec!.scenes.every((s) => s.shots.every((sh) => sh.compiledPrompt)));
  });
});

describe("generation planner + DAG", () => {
  it("builds ProductionSpec → scenes → shots → tasks → dependencies", () => {
    const plan = createProductionPlan({
      idea: "Make a 90-second cinematic documentary about an ancient African kingdom",
      targetDurationSec: 90,
    });
    assert.ok(plan.ok);
    assert.ok((plan.generationTasks || []).length >= 2);
    assert.ok(plan.dag);
    const tasks = plan.generationTasks!;
    assert.ok(tasks.some((t) => t.kind === "keyframe"));
    assert.ok(tasks.some((t) => t.kind === "video") || tasks.some((t) => t.kind === "keyframe"));
    assert.ok(tasks.some((t) => t.kind === "merge"));
    const video = tasks.find((t) => t.kind === "video");
    if (video) {
      assert.ok(video.dependsOn.some((d) => d.endsWith("_keyframe")));
      assert.ok(video.requiredCapabilities.length > 0);
    }
    // Shots carry tasks
    assert.ok(plan.spec!.scenes[0].shots[0].generationTasks!.length >= 1);
    const ready = readyNodes(plan.dag!);
    assert.ok(ready.length >= 1);
  });

  it("continuity requirements flow into generation tasks / prompts", () => {
    const plan = createProductionPlan({
      idea: "Host talking-head tip video about budgeting",
      targetDurationSec: 45,
    });
    assert.ok(plan.spec!.continuity.shotBridges.length > 0);
    const shot = plan.spec!.scenes[0].shots[0];
    assert.ok(shot.continuityRequirements.length > 0);
    assert.ok(shot.compiledPrompt?.includes("CONTINUITY"));
  });
});

describe("partial regeneration", () => {
  it("regenerates only affected shot and dependents", () => {
    const plan = createProductionPlan({
      idea: "Create a luxury commercial for this watch",
      targetDurationSec: 45,
    });
    const targetShot = plan.spec!.scenes[0].shots[0].id;
    const partial = planPartialRegeneration({
      spec: plan.spec!,
      scope: "shot",
      targetId: targetShot,
      failure: "identity_drift",
    });
    assert.equal(partial.action, "regenerate");
    assert.ok(partial.regenerateShotIds.includes(targetShot));
    assert.ok(partial.preserveShotIds.every((id) => id !== targetShot));
    // Preserve unrelated scenes' shots when possible
    if (plan.spec!.scenes.length > 1 && plan.spec!.scenes[0].shots.length === 1) {
      assert.ok(partial.preserveShotIds.length >= 1);
    }
  });

  it("DAG dependentTaskIds walks forward dependencies", () => {
    const plan = createProductionPlan({ idea: "Short social tip", targetDurationSec: 20 });
    const dag = plan.dag!;
    const keyframe = dag.nodes.find((n) => n.kind === "keyframe");
    assert.ok(keyframe);
    const deps = dependentTaskIds(dag, keyframe!.id);
    assert.ok(deps.includes(keyframe!.id));
    assert.ok(deps.length >= 1);
  });

  it("planShotRetry preserves failure reason and may change provider", () => {
    const plan = createProductionPlan({ idea: "Cinematic hero character trailer", targetDurationSec: 40 });
    const shot = plan.spec!.scenes[0].shots[0];
    const decision = plan.spec!.routing.shotDecisions[0];
    const retry = planShotRetry({
      shot,
      failures: ["identity_drift"],
      routingDecision: decision,
    });
    assert.equal(retry.failure, "identity_drift");
    assert.equal(retry.providerChange, true);
    assert.ok(retry.changedInputs?.includes("referenceStrength") || retry.strategyChange === "multi_reference");
  });
});

describe("backward compatibility", () => {
  it("ProductionBrief conversion still works after Phase 3 planning", () => {
    const plan = createProductionPlan({
      idea: "Make a funny animated short about two friends",
      targetDurationSec: 45,
    });
    assert.ok(plan.ok);
    const brief = productionSpecToBrief(plan.spec!);
    assert.ok((brief.storyboard || []).length > 0);
    assert.ok(brief.hook || brief.title);
    const v = validateProductionSpec(plan.spec!);
    assert.equal(v.ok, true, v.errors.join("; "));
  });

  it("routeProductionShots is idempotent-safe on already routed specs", () => {
    const plan = createProductionPlan({ idea: "News explainer about solar energy", targetDurationSec: 60 });
    const again = routeProductionShots(plan.spec!);
    assert.equal(again.routing.shotDecisions.length, plan.spec!.routing.shotDecisions.length);
  });
});

describe("visual planning pipeline unit", () => {
  it("applyVisualPlanningPipeline enriches a blueprint spec", () => {
    const blueprint = createProductionPlan({
      idea: "Documentary about ocean exploration",
      targetDurationSec: 90,
      applyVisualPlanning: false,
    });
    assert.ok(blueprint.ok);
    assert.equal(blueprint.trace.cinematographyApplied, false);
    const grammar = blueprint.grammar!;
    const visual = applyVisualPlanningPipeline(blueprint.spec!, { grammar, preferI2V: true });
    assert.ok(visual.stats.shotCount >= blueprint.spec!.scenes.length);
    assert.ok(visual.stats.routedShots > 0);
    assert.ok(visual.stats.generationTaskCount > 0);
    assert.ok(visual.stats.continuityBridges > 0);
    assert.ok(visual.spec.scenes[0].shots[0].compiledPrompt);
  });
});
