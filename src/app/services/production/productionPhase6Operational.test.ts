/**
 * Phase 6 — Operational storyboard → GenerationIntent → GenerationTask tests.
 * Deterministic unit tests — no live provider calls.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createCharacterMaster,
  createLocationMaster,
  makeAssetRef,
  type ProductMaster,
} from "./specification/assetSpec";
import type { ShotSpec } from "./specification/shotSpec";
import type { SceneSpec } from "./specification/sceneSpec";
import type { CreativeSpec, ProjectSpec, VisualStyleSpec } from "./specification/productionSpec";
import { createDefaultRoutingSpec } from "./specification/routingSpec";
import {
  developVisualTreatment,
  buildCharacterVisualContract,
  buildLocationVisualContract,
  buildProductVisualContract,
  buildReferenceManifest,
  buildStoryboardPanelFromShot,
  detectReferenceConflicts,
  defaultReferencePriorityOrder,
} from "./preproduction";
import {
  buildGenerationIntent,
  buildCandidatePolicy,
  resolveGenerationCapabilities,
  compileGenerationIntentToTasks,
  buildHeuristicCandidateRanking,
  classifyGenerationFailure,
  planOperationalShotGeneration,
  planGenerationTasks,
} from "./generation";
import { composeGrammars } from "./grammar";
import { applyVisualPlanningPipeline } from "./generation/visualPlanningPipeline";
import { createProductionPlan } from "./intelligence/productionOrchestrator";
import type { GenerationIntent } from "./generation/generationIntent";
import type { ReferenceManifest } from "./preproduction/types";

function makeShot(partial?: Partial<ShotSpec>): ShotSpec {
  return {
    id: "shot_1",
    sceneId: "scene_1",
    index: 0,
    purpose: "Establish host in workspace",
    productionReason: "Audience needs geography and host identity before proof beat",
    timingStartSec: 0,
    durationSec: 5,
    camera: {
      shotType: "medium",
      framing: "waist-up host centered",
      composition: "rule-of-thirds host left, product right",
      cameraPosition: "eye-level",
      cameraMovement: "dolly",
      lens: "35mm",
      depthOfField: "moderate",
      focus: "host eyes",
    },
    subject: "Host Maya",
    subjectAction: "Walks into frame and turns to camera",
    blocking: "Enter from left, stop at mark",
    environment: "Sunlit loft studio",
    lighting: {
      direction: "window key from camera-left",
      intensity: "soft",
      color: "warm daylight",
      atmosphere: "clear air",
      timeOfDay: "late morning",
    },
    motion: {
      subjectMovement: "Host walks in and settles facing camera",
      cameraMovementDetail: "Slow dolly-in toward host",
      environmentalMovement: "Dust motes in window light",
      beginState: "Host off-frame left; empty mark",
      endState: "Host settled on mark; product visible",
      timingNotes: "arrive by 2.5s",
    },
    references: {
      characterRefs: ["character_maya:v1"],
      locationRefs: ["location_loft:v1"],
      styleRefs: [],
    },
    continuityRequirements: ["wardrobe_lock", "location_lock", "lighting_direction"],
    characterIds: ["character_maya"],
    propIds: ["product_widget"],
    assetIds: ["product_widget"],
    generationStrategy: "image_to_video",
    generationStatus: "planned",
    qcStatus: "pending",
    dialogue: "Here's the idea.",
    aspectRatio: "16:9",
    ...partial,
  };
}

function makeScene(shots: ShotSpec[]): SceneSpec {
  return {
    id: "scene_1",
    index: 0,
    title: "Hook loft",
    purpose: "Open on host and product",
    narrativeFunction: "hook",
    environment: "Sunlit loft studio",
    durationSec: 10,
    characterIds: ["character_maya"],
    propIds: ["product_widget"],
    emotionalObjective: "curiosity",
    continuity: {
      entranceState: "Cold open empty loft",
      exitState: "Host settled with product",
      identityLocks: ["character_maya"],
      wardrobeLocks: ["navy jacket"],
      propLocks: ["product_widget"],
      lightingLock: "window key camera-left",
    },
    shots,
  };
}

function makeProduct(): ProductMaster {
  const now = new Date(0).toISOString();
  return {
    identity: { baseId: "product_widget", version: 1, ref: makeAssetRef("product_widget", 1) },
    kind: "product",
    name: "Widget Pro",
    description: "Matte black handheld widget",
    approvedReferenceUrls: ["https://cdn.example/product_hero.png"],
    tags: ["hero"],
    status: "approved",
    createdAt: now,
    updatedAt: now,
    brandName: "Acme",
    heroAngle: "three_quarter",
    mustShowFeatures: ["status LED", "grip texture"],
  };
}

const creative: CreativeSpec = {
  intent: "Host explains a product in a loft",
  genre: "product_demo",
  grammarTags: ["cinematic"],
  tone: "confident",
  audience: "creators",
  narrativeStructure: "hook-proof-cta",
  visualLanguage: "clean commercial",
  pacing: "measured",
  emotionalArc: "curiosity→clarity",
  requiresHost: true,
  requiresCharacters: true,
  requiresNarration: false,
  requiresDialogue: true,
  requiresAnimation: false,
  requiresProductShots: true,
  requiresDocumentaryTreatment: false,
  requiresResearch: false,
  requiresGeneratedEnvironments: true,
  requiresStockOrUserAssets: false,
  requiresImageGeneration: true,
  requiresVideoGeneration: true,
  requiresVoiceGeneration: false,
  requiresMusic: false,
  requiresSoundDesign: false,
  requiresEditing: true,
  estimatedSceneCount: 1,
  estimatedShotCount: 2,
  confidence: 0.8,
  rationale: ["product demo with host"],
};

const project: ProjectSpec = {
  id: "prod_p6",
  title: "Phase 6 Op Pipeline",
  idea: "Host loft product demo",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  productionMode: "standard",
  creativeControl: "auto",
  targetDurationSec: 30,
  platforms: ["youtube"],
  aspectRatio: "16:9",
  formats: ["mp4"],
  status: "planning",
};

const visualStyle: VisualStyleSpec = {
  look: "high-key commercial",
  colorLanguage: "neutral warm",
  cameraLanguage: "restrained motivated",
  lightingLanguage: "window key soft fill",
  references: [],
  antiSlopLaws: ["no random crane"],
};

function fixtures() {
  const character = createCharacterMaster({
    baseId: "character_maya",
    name: "Maya",
    description: "Host",
    referenceUrls: ["https://cdn.example/maya.png"],
  });
  character.wardrobeState = { description: "navy jacket", colors: ["navy"] };
  const cvc = buildCharacterVisualContract({ character });
  const location = createLocationMaster({
    baseId: "location_loft",
    name: "Loft",
    description: "Loft",
    environment: "Sunlit loft",
    referenceUrls: ["https://cdn.example/loft.png"],
  });
  const lvc = buildLocationVisualContract({ location });
  const pvc = buildProductVisualContract({ product: makeProduct() });
  const treatment = developVisualTreatment({
    productionId: project.id,
    creative,
    project,
    visualStyle,
  });
  const shot = makeShot();
  const scene = makeScene([shot]);
  const panel = buildStoryboardPanelFromShot({
    shot,
    sequenceIndex: 0,
    visualTreatmentId: treatment.id,
    characterContracts: [cvc],
    locationContract: lvc,
    productContracts: [pvc],
  });
  const routing = createDefaultRoutingSpec();
  return { cvc, lvc, pvc, treatment, shot, scene, panel, routing };
}

describe("Phase 6 — ShotSpec → storyboard panel mapping", () => {
  it("maps panel.shotId to ShotSpec.id", () => {
    const { shot, panel } = fixtures();
    assert.equal(panel.shotId, shot.id);
    assert.ok(panel.dramaticBeat);
    assert.ok(panel.visualObjective);
    assert.ok(panel.rationale.length >= 1);
    assert.ok(panel.incomingState.subjectPosition || panel.startState);
    assert.ok(panel.outgoingState.subjectPosition || panel.endState);
  });
});

describe("Phase 6 — reference role / priority / blocking conflict", () => {
  it("classifies roles/priorities and blocks on wardrobe conflict", () => {
    const { cvc, lvc, pvc, treatment, shot, panel } = fixtures();
    panel.blocking = "red jacket entrance from left";
    const manifest = buildReferenceManifest({
      productionId: project.id,
      shotId: shot.id,
      panelId: panel.panelId,
      treatment,
      characters: [cvc],
      locations: [lvc],
      products: [pvc],
      panel,
      priorityOrder: defaultReferencePriorityOrder(),
    });
    assert.ok(manifest.references.some((r) => r.referenceRole === "identity"));
    assert.ok(manifest.references.some((r) => r.priority === "mandatory"));
    const conflicts = detectReferenceConflicts(manifest.references);
    assert.ok(conflicts.some((c) => c.severity === "blocking"));
  });
});

describe("Phase 6 — GenerationIntent appearance vs motion + handoff", () => {
  it("separates appearance from motion and preserves start/end state", () => {
    const { cvc, lvc, pvc, treatment, shot, scene, panel } = fixtures();
    const intent = buildGenerationIntent({
      productionId: project.id,
      scene,
      shot,
      panel,
      treatment,
      characters: [cvc],
      location: lvc,
      products: [pvc],
    });
    assert.equal(intent.shotId, shot.id);
    assert.equal(intent.panelId, panel.panelId);
    assert.ok(intent.appearanceIntent.visualState);
    assert.ok(intent.appearanceIntent.treatmentSummary !== undefined);
    assert.equal(intent.motionIntent.subjectMotion, shot.motion.subjectMovement);
    assert.ok(intent.motionIntent.temporalOrder.includes("→"));
    assert.ok(intent.startState.subjectPosition);
    assert.ok(intent.endState.subjectPosition);
    assert.notEqual(intent.appearanceIntent.visualState, intent.motionIntent.subjectMotion);
    assert.ok(intent.hardConstraints.some((c) => c.kind === "hard"));
    assert.ok(intent.softPreferences.some((c) => c.kind === "soft"));
    assert.equal(intent.trace.shotId, shot.id);
    assert.equal(intent.trace.panelId, panel.panelId);
  });
});

describe("Phase 6 — capability resolution", () => {
  it("supports a compatible provider", () => {
    const { shot, scene, panel, routing, cvc, lvc, pvc, treatment } = fixtures();
    const intent = buildGenerationIntent({
      productionId: project.id,
      scene,
      shot,
      panel,
      treatment,
      characters: [cvc],
      location: lvc,
      products: [pvc],
    });
    const resolution = resolveGenerationCapabilities({
      intent,
      shot,
      routing,
      availableProviderIds: ["seedance", "kling", "grok"],
    });
    assert.equal(resolution.ok, true);
    assert.ok(resolution.providerId);
    assert.equal(resolution.degradation.action === "block", false);
  });

  it("blocks on unsupported / no compatible provider", () => {
    const { shot, scene, panel, routing } = fixtures();
    const intent = buildGenerationIntent({
      productionId: project.id,
      scene,
      shot,
      panel,
    });
    const resolution = resolveGenerationCapabilities({
      intent,
      shot,
      routing,
      availableProviderIds: ["elevenlabs"],
    });
    assert.equal(resolution.ok, false);
    assert.equal(resolution.degradation.action, "block");
  });

  it("falls back when preferred provider misses hard capability", () => {
    const { scene, panel, routing, cvc, lvc, pvc, treatment } = fixtures();
    // multi_reference requires multi_reference (non-critical) — runway lacks it, kling has it
    const shot = makeShot({ generationStrategy: "multi_reference" });
    const intent = buildGenerationIntent({
      productionId: project.id,
      scene,
      shot,
      panel: { ...panel, shotId: shot.id },
      treatment,
      characters: [cvc],
      location: lvc,
      products: [pvc],
    });
    const resolution = resolveGenerationCapabilities({
      intent,
      shot,
      routing,
      availableProviderIds: ["runway", "kling", "seedance"],
      preferredProviderId: "runway",
    });
    assert.equal(resolution.ok, true);
    assert.notEqual(resolution.providerId, "runway");
    assert.equal(resolution.degradation.action, "fallback_provider");
  });

  it("explicitly degrades soft preferences", () => {
    const { scene, panel, routing } = fixtures();
    const softShot = makeShot({
      generationStrategy: "text_to_video",
      characterIds: [],
      propIds: [],
      assetIds: [],
      dialogue: undefined,
      continuityRequirements: [],
    });
    const intent = buildGenerationIntent({
      productionId: project.id,
      scene,
      shot: softShot,
      panel: { ...panel, shotId: softShot.id },
      qualityMode: "high_quality",
    });
    const softIntent: GenerationIntent = {
      ...intent,
      capabilityRequirements: ["text_to_video", "motion_quality"],
      hardConstraints: intent.hardConstraints.filter((c) => !c.capability),
      softPreferences: [
        {
          id: "soft_high_res",
          kind: "soft",
          category: "delivery",
          description: "Prefer higher resolution",
          capability: "high_resolution",
        },
      ],
    };
    const softRes = resolveGenerationCapabilities({
      intent: softIntent,
      shot: softShot,
      routing,
      availableProviderIds: ["runway"],
      preferredProviderId: "runway",
    });
    assert.equal(softRes.ok, true);
    assert.equal(softRes.degradation.action, "drop_soft_preference");
    assert.ok(softRes.degradation.droppedSoftPreferences.includes("soft_high_res"));
  });

  it("blocks on blocking reference conflict", () => {
    const { shot, scene, panel, routing, cvc, lvc, pvc, treatment } = fixtures();
    panel.blocking = "red jacket entrance";
    const manifest: ReferenceManifest = buildReferenceManifest({
      productionId: project.id,
      shotId: shot.id,
      panelId: panel.panelId,
      treatment,
      characters: [cvc],
      locations: [lvc],
      products: [pvc],
      panel,
    });
    assert.ok(manifest.conflicts.some((c) => c.severity === "blocking"));
    const intent = buildGenerationIntent({
      productionId: project.id,
      scene,
      shot,
      panel,
      treatment,
      characters: [cvc],
      location: lvc,
      products: [pvc],
      referenceManifest: manifest,
    });
    const resolution = resolveGenerationCapabilities({
      intent,
      shot,
      routing,
      availableProviderIds: ["seedance", "kling"],
    });
    assert.equal(resolution.ok, false);
    assert.equal(resolution.degradation.action, "block");
  });
});

describe("Phase 6 — candidate policy risk → count", () => {
  it("maps risk level to recommended candidate count", () => {
    const lowShot = makeShot({
      characterIds: [],
      propIds: [],
      assetIds: [],
      dialogue: undefined,
      camera: {
        shotType: "wide",
        framing: "wide",
        composition: "centered",
        cameraPosition: "eye-level",
        cameraMovement: "static",
      },
      motion: {
        subjectMovement: "still hold",
        cameraMovementDetail: "static",
        beginState: "hold",
        endState: "hold",
      },
      continuityRequirements: [],
      durationSec: 3,
    });
    const low = buildCandidatePolicy({ shot: lowShot, candidateCounts: { low: 1, medium: 2, high: 3 } });
    assert.equal(low.riskLevel, "low");
    assert.equal(low.recommendedCandidateCount, 1);

    const highShot = makeShot({
      characterIds: ["a", "b"],
      durationSec: 12,
      dialogue: "Long dialogue line that raises risk",
      continuityRequirements: ["a", "b", "c", "d"],
    });
    const high = buildCandidatePolicy({
      shot: highShot,
      candidateCounts: { low: 1, medium: 2, high: 4 },
    });
    assert.equal(high.riskLevel, "high");
    assert.equal(high.recommendedCandidateCount, 4);
  });
});

describe("Phase 6 — compile to GenerationTask with traceability", () => {
  it("emits tasks with Phase 6 fields and multimodal request", () => {
    const { shot, scene, panel, routing, cvc, lvc, pvc, treatment } = fixtures();
    const result = planOperationalShotGeneration({
      productionId: project.id,
      scene,
      shot,
      routing,
      panel,
      treatment,
      characters: [cvc],
      location: lvc,
      products: [pvc],
      availableProviderIds: ["seedance", "kling"],
      candidateCounts: { low: 1, medium: 2, high: 3 },
    });
    assert.equal(result.plan.blocked, false);
    assert.ok(result.plan.tasks.length >= 2);
    const video = result.plan.tasks.find((t) => t.kind === "video");
    assert.ok(video);
    assert.equal(video!.intentId, result.intent.id);
    assert.equal(video!.panelId, panel.panelId);
    assert.ok(video!.referenceManifestId);
    assert.ok(video!.appearanceBrief);
    assert.ok(video!.motionBrief);
    assert.ok((video!.hardConstraintIds || []).length >= 1);
    assert.equal(typeof video!.candidateIndex, "number");
    assert.ok((video!.candidateCount || 0) >= 1);
    assert.ok(video!.traceJson);
    const trace = JSON.parse(video!.traceJson!);
    assert.equal(trace.shotId, shot.id);
    assert.ok(result.plan.multimodalRequest);
    assert.ok(result.intent.trace.generationTaskIds?.length);
  });
});

describe("Phase 6 — failure classification", () => {
  it("classifies common failure modes to resolutions", () => {
    assert.equal(
      classifyGenerationFailure({ errorCode: "REFERENCE_CONFLICT" }).classification,
      "reference_conflict"
    );
    assert.equal(
      classifyGenerationFailure({ message: "missing reference asset" }).resolution,
      "request_missing_prerequisite"
    );
    assert.equal(
      classifyGenerationFailure({ message: "unsupported capability lip_sync" }).resolution,
      "fallback_provider"
    );
    assert.equal(classifyGenerationFailure({ httpStatus: 429 }).classification, "provider_rate_limit");
    assert.equal(classifyGenerationFailure({ message: "ETIMEDOUT" }).classification, "provider_timeout");
    assert.equal(
      classifyGenerationFailure({ httpStatus: 503 }).classification,
      "provider_unavailable"
    );
    assert.equal(
      classifyGenerationFailure({ message: "invalid duration out of range" }).classification,
      "invalid_duration"
    );
    assert.equal(
      classifyGenerationFailure({ message: "previous shot missing for continuity" }).classification,
      "continuity_dependency_unavailable"
    );
  });
});

describe("Phase 6 — heuristic ranking contract", () => {
  it("returns GenerationCandidateRankingContract shape", () => {
    const ranking = buildHeuristicCandidateRanking({
      candidateId: "cand_1",
      shotId: "shot_1",
      generationTaskId: "shot_1_video",
      identityFidelity: 0.9,
      motionQuality: 0.8,
      continuity: 0.85,
      composition: 0.7,
    });
    assert.equal(ranking.source, "heuristic");
    assert.equal(ranking.shotId, "shot_1");
    assert.ok(ranking.overall > 0);
    assert.ok(ranking.scores.identityFidelity === 0.9);
    assert.ok(ranking.scores.temporalStability === 0.8);
    assert.ok(Array.isArray(ranking.strengths));
    assert.ok(Array.isArray(ranking.weaknesses));
  });
});

describe("Phase 6 — regression: planGenerationTasks still works", () => {
  it("keeps Phase 3 planGenerationTasks path intact", () => {
    const plan = createProductionPlan({
      idea: "A host demos a widget in a loft",
    });
    const tasks = planGenerationTasks(plan.spec);
    assert.ok(tasks.length >= 1);
    assert.ok(tasks.some((t) => t.kind === "keyframe" || t.kind === "video" || t.kind === "voice"));

    const visual = applyVisualPlanningPipeline(plan.spec, {
      grammar: composeGrammars("product_demo", [], ["cinematic"]),
      preferI2V: true,
      maxShotsPerScene: 2,
      // operational flag OFF by default
    });
    assert.ok(visual.generationTasks.length >= 1);
    assert.equal(visual.stats.operationalShots, undefined);
  });

  it("compileGenerationIntentToTasks blocks cleanly when resolution fails", () => {
    const { shot, scene, panel, routing } = fixtures();
    const intent = buildGenerationIntent({ productionId: project.id, scene, shot, panel });
    const resolution = resolveGenerationCapabilities({
      intent,
      shot,
      routing,
      availableProviderIds: ["elevenlabs"],
    });
    const plan = compileGenerationIntentToTasks({ intent, resolution });
    assert.equal(plan.blocked, true);
    assert.equal(plan.tasks.length, 0);
    assert.ok(plan.blockReasons.length >= 1);
  });
});
