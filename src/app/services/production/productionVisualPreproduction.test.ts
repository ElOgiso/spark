/**
 * Visual preproduction + storyboard bridge — deterministic unit tests (no network).
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
import {
  developVisualTreatment,
  buildCharacterVisualContract,
  buildLocationVisualContract,
  buildProductVisualContract,
  buildReferenceManifest,
  classifyUserReference,
  detectReferenceConflicts,
  optimizeReferenceBudget,
  defaultReferencePriorityOrder,
  buildStoryboardBlueprint,
  buildStoryboardPanelFromShot,
  validateStoryboardBlueprint,
  repairStoryboardPanel,
  recordStoryboardVersion,
  compileVideoGenerationIntent,
  buildMultimodalVideoGenerationRequest,
  assertMotionSeparatedFromAppearance,
  scoreShotGenerationRisk,
  rankCandidates,
  selectBestCandidate,
  createVisualLock,
  changeLockedVersion,
  lockStoryboard,
  analyzeVisualLockImpact,
  getFilmmakingPrinciples,
  filmmakingPrincipleIds,
} from "./preproduction";
import {
  getMaxMultimodalReferences,
  setMaxMultimodalReferences,
  PROVIDER_VIDEO_CAPABILITIES,
} from "../runtime/providerCapabilities";

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
  id: "proj_1",
  title: "Widget demo",
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

describe("visual contracts (character / location / product)", () => {
  it("builds character contract from CharacterMaster fields", () => {
    const character = createCharacterMaster({
      baseId: "character_maya",
      name: "Maya",
      description: "Host with short dark hair",
      definingCharacteristics: ["sharp jaw"],
      referenceUrls: ["https://cdn.example/maya_front.png"],
    });
    character.visualAttributes.face = "oval face, brown eyes";
    character.visualAttributes.hair = "short dark hair";
    character.wardrobeState = { description: "navy jacket over white tee", colors: ["navy", "white"] };

    const treatment = developVisualTreatment({
      productionId: "prod_1",
      creative,
      project,
      visualStyle,
    });
    const cvc = buildCharacterVisualContract({ character, visualTreatment: treatment });

    assert.equal(cvc.characterId, "character_maya");
    assert.equal(cvc.assetRef, character.identity.ref);
    assert.equal(cvc.face, "oval face, brown eyes");
    assert.equal(cvc.wardrobe, "navy jacket over white tee");
    assert.ok(cvc.referenceImageUrls.includes("https://cdn.example/maya_front.png"));
    assert.ok(cvc.views.some((v) => v.view === "front" && v.required));
  });

  it("builds location and product contracts from masters", () => {
    const location = createLocationMaster({
      baseId: "location_loft",
      name: "Loft",
      description: "Brick loft with tall windows",
      environment: "Sunlit loft studio",
      referenceUrls: ["https://cdn.example/loft.png"],
    });
    location.architecture = "exposed brick + steel beams";
    location.defaultLighting = "window key";
    location.defaultTimeOfDay = "late morning";

    const lvc = buildLocationVisualContract({ location });
    assert.equal(lvc.locationId, "location_loft");
    assert.equal(lvc.environmentIdentity, "Sunlit loft studio");
    assert.equal(lvc.architecture, "exposed brick + steel beams");
    assert.equal(lvc.timeOfDay, "late morning");

    const pvc = buildProductVisualContract({ product: makeProduct() });
    assert.equal(pvc.productId, "product_widget");
    assert.equal(pvc.branding, "Acme");
    assert.ok(pvc.surfaceDetails.includes("status LED"));
    assert.equal(pvc.canonicalReferenceUrl, "https://cdn.example/product_hero.png");
  });
});

describe("reference manifest / priority / conflict / budget", () => {
  it("classifies, prioritizes, detects wardrobe conflicts, and budgets from registry", () => {
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
    const treatment = developVisualTreatment({ productionId: "prod_1", creative, project, visualStyle });

    const shot = makeShot();
    const panel = buildStoryboardPanelFromShot({
      shot,
      sequenceIndex: 0,
      characterContracts: [cvc],
      locationContract: lvc,
      productContracts: [pvc],
    });
    // Force wardrobe conflict between identity and panel blocking hint
    panel.blocking = "red jacket entrance from left";

    const userRef = classifyUserReference({
      referenceId: "user_face_1",
      url: "https://cdn.example/upload.png",
      hint: "face identity portrait",
      subjectId: "character_maya",
    });
    assert.equal(userRef.referenceRole, "identity");
    assert.equal(userRef.priority, "mandatory");

    const manifest = buildReferenceManifest({
      productionId: "prod_1",
      shotId: shot.id,
      treatment,
      characters: [cvc],
      locations: [lvc],
      products: [pvc],
      panel,
      userReferences: [userRef],
      priorityOrder: defaultReferencePriorityOrder(),
    });

    assert.ok(manifest.references.some((r) => r.referenceRole === "identity"));
    assert.ok(manifest.references.some((r) => r.referenceRole === "environment"));
    assert.ok(manifest.references.some((r) => r.referenceRole === "product"));
    assert.ok(manifest.priorityOrder.length > 0);

    const conflicts = detectReferenceConflicts(manifest.references);
    assert.ok(
      conflicts.some((c) => c.conflictingAttributes.includes("wardrobe_color")),
      "expected wardrobe color conflict between contract and panel"
    );

    assert.equal(getMaxMultimodalReferences("seedance"), 12);
    const budget = optimizeReferenceBudget({
      manifest,
      providerId: "seedance",
    });
    assert.equal(budget.maxSlots, 12);
    assert.ok(budget.selected.length <= 12);
    assert.ok(budget.selected.some((r) => r.priority === "mandatory"));

    const prev = PROVIDER_VIDEO_CAPABILITIES.seedance.maxMultimodalReferences;
    setMaxMultimodalReferences("seedance", 2);
    try {
      const tight = optimizeReferenceBudget({ manifest, providerId: "seedance" });
      assert.equal(tight.maxSlots, 2);
      assert.ok(tight.selected.length <= 2);
      assert.ok(tight.omitted.length >= 1);
    } finally {
      setMaxMultimodalReferences("seedance", prev);
    }
  });
});

describe("storyboard from ShotSpec (no cinematic info loss)", () => {
  it("maps panels 1:1 with camera/composition/motion preserved", () => {
    const shotA = makeShot({ id: "shot_a", index: 0 });
    const shotB = makeShot({
      id: "shot_b",
      index: 1,
      timingStartSec: 5,
      purpose: "Product insert",
      productionReason: "Show product detail for proof",
      camera: {
        shotType: "macro",
        framing: "product fill",
        composition: "centered hero product",
        cameraPosition: "overhead",
        cameraMovement: "orbit",
        lens: "macro",
        depthOfField: "shallow",
      },
      motion: {
        subjectMovement: "Hand rotates product",
        cameraMovementDetail: "Slow orbit",
        beginState: "Product static",
        endState: "LED facing camera",
      },
      characterIds: [],
      propIds: ["product_widget"],
      assetIds: ["product_widget"],
    });
    const scene = makeScene([shotA, shotB]);
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
      environment: "Sunlit loft studio",
    });
    const lvc = buildLocationVisualContract({ location });
    const pvc = buildProductVisualContract({ product: makeProduct() });
    const treatment = developVisualTreatment({ productionId: "prod_1", creative, project, visualStyle });

    const blueprint = buildStoryboardBlueprint({
      productionId: "prod_1",
      scene,
      aspectRatio: "16:9",
      visualTreatment: treatment,
      characterContracts: [cvc],
      locationContract: lvc,
      productContracts: [pvc],
    });

    assert.equal(blueprint.panels.length, 2);
    assert.equal(blueprint.panelToShotMap.panel_01, "shot_a");
    assert.equal(blueprint.panelToShotMap.panel_02, "shot_b");

    const p0 = blueprint.panels[0];
    assert.equal(p0.shotId, shotA.id);
    assert.equal(p0.composition, shotA.camera.composition);
    assert.equal(p0.framing, shotA.camera.framing);
    assert.equal(p0.camera.shotType, shotA.camera.shotType);
    assert.equal(p0.camera.movement, String(shotA.camera.cameraMovement));
    assert.equal(p0.camera.lensIntent, shotA.camera.lens);
    assert.equal(p0.subjectAction, shotA.motion.subjectMovement);
    assert.equal(p0.startState, shotA.motion.beginState);
    assert.equal(p0.endState, shotA.motion.endState);
    assert.equal(p0.generationIntent.motionFromShotSpec, true);
    // Panel must not embed a full ShotSpec duplicate
    assert.equal("motion" in (p0 as object), false);
    assert.equal("productionReason" in (p0 as object), false);

    const validation = validateStoryboardBlueprint({ blueprint, shots: scene.shots });
    assert.equal(validation.ok, true);
    assert.equal(validation.issues.filter((i) => i.severity === "error").length, 0);
  });

  it("repairs a single panel and records versioning", () => {
    const shot = makeShot();
    const scene = makeScene([shot]);
    const blueprint = buildStoryboardBlueprint({
      productionId: "prod_1",
      scene,
      aspectRatio: "16:9",
    });
    const repaired = repairStoryboardPanel(
      blueprint,
      { panelId: "panel_01", repairReason: "composition unreadable", notes: "tighten framing" },
      shot
    );
    assert.equal(repaired.version, blueprint.version + 1);
    assert.equal(repaired.status, "revised");
    assert.ok(repaired.panels[0].rationale.some((r) => /Localized repair/.test(r)));

    const record = recordStoryboardVersion(blueprint, repaired, "panel repair");
    assert.equal(record.previousVersion, blueprint.version);
    assert.equal(record.version, repaired.version);
    assert.ok(record.changedPanels.includes("panel_01"));
    assert.equal(record.reason, "panel repair");
  });
});

describe("motion separation + video intent compilation", () => {
  it("keeps motion separate and preserves character/location/composition/camera/temporal/continuity", () => {
    const shot = makeShot();
    const character = createCharacterMaster({
      baseId: "character_maya",
      name: "Maya",
      description: "Host Maya",
      referenceUrls: ["https://cdn.example/maya.png"],
    });
    character.wardrobeState = { description: "navy jacket", colors: ["navy"] };
    character.visualAttributes.face = "oval face";
    const cvc = buildCharacterVisualContract({ character });
    const location = createLocationMaster({
      baseId: "location_loft",
      name: "Loft",
      description: "Loft",
      environment: "Sunlit loft studio",
      referenceUrls: ["https://cdn.example/loft.png"],
    });
    const lvc = buildLocationVisualContract({ location });
    const pvc = buildProductVisualContract({ product: makeProduct() });
    const treatment = developVisualTreatment({ productionId: "prod_1", creative, project, visualStyle });
    const panel = buildStoryboardPanelFromShot({
      shot,
      sequenceIndex: 0,
      visualTreatmentId: treatment.id,
      characterContracts: [cvc],
      locationContract: lvc,
      productContracts: [pvc],
    });

    const intent = compileVideoGenerationIntent({
      productionId: "prod_1",
      shot,
      panel,
      treatment,
      characters: [cvc],
      location: lvc,
      products: [pvc],
      aspectRatio: "16:9",
      sceneId: "scene_1",
      sequenceId: "scene_1",
    });

    assert.equal(assertMotionSeparatedFromAppearance(intent), true);
    assert.equal(intent.motion.subjectMotion, shot.motion.subjectMovement);
    assert.equal(intent.motion.cameraMotion, shot.motion.cameraMovementDetail);
    assert.equal(intent.temporal.startState, shot.motion.beginState);
    assert.equal(intent.temporal.endState, shot.motion.endState);
    assert.equal(intent.temporal.durationSec, shot.durationSec);
    assert.equal(intent.appearance.composition, shot.camera.composition);
    assert.equal(intent.camera.position, shot.camera.cameraPosition);
    assert.equal(intent.camera.movement, String(shot.camera.cameraMovement));
    assert.ok(intent.appearance.visualState.includes("navy jacket"));
    assert.equal(intent.environment.locationId, "location_loft");
    assert.ok(intent.environment.description.includes("Sunlit loft"));
    assert.ok(intent.continuity.requirements.includes("wardrobe_lock"));
    assert.equal(intent.trace.shotId, shot.id);
    assert.equal(intent.trace.panelId, panel.panelId);
    assert.ok(intent.trace.referenceManifestId);

    const request = buildMultimodalVideoGenerationRequest({
      intent,
      providerId: "seedance",
    });
    assert.equal(request.shotId, shot.id);
    assert.ok(request.characterReferences.length >= 1);
    assert.ok(request.locationReferences.length >= 1);
    assert.ok(request.productReferences.length >= 1);
    assert.ok(request.motionIntent.includes(shot.motion.subjectMovement));
    assert.ok(!request.textIntent.includes("→") || request.motionIntent.includes("→"));
    assert.equal(request.budget?.maxSlots, getMaxMultimodalReferences("seedance"));
    assert.ok(request.packedReferences.length <= request.budget!.maxSlots);
    assert.equal(request.cameraIntent.includes(shot.camera.cameraPosition), true);
    assert.equal(request.durationSec, shot.durationSec);
  });
});

describe("shot risk + candidate strategy", () => {
  it("scores risk and ranks candidates with QC-like dimensions", () => {
    const shot = makeShot({ durationSec: 12, characterIds: ["a", "b"] });
    const risk = scoreShotGenerationRisk({
      shot,
      hasLockedCharacterContracts: false,
      dialogueHeavy: true,
    });
    assert.ok(risk.score > 0.4);
    assert.ok(["medium", "high"].includes(risk.level));
    assert.ok(risk.recommendedCandidates >= 2);
    assert.equal(risk.recommendStrongerProvider, true);
    assert.equal(risk.recommendMoreReferences, true);

    const ranked = rankCandidates([
      {
        candidateId: "c_weak",
        shotId: shot.id,
        scores: {
          characterConsistency: 40,
          locationConsistency: 50,
          composition: 45,
          motionQuality: 40,
          cameraExecution: 50,
          storyAccuracy: 40,
          continuity: 35,
          visualTreatment: 50,
          artifactSeverity: 40,
          editorialUsefulness: 40,
        },
      },
      {
        candidateId: "c_strong",
        shotId: shot.id,
        scores: {
          characterConsistency: 90,
          locationConsistency: 88,
          composition: 85,
          motionQuality: 80,
          cameraExecution: 82,
          storyAccuracy: 90,
          continuity: 86,
          visualTreatment: 78,
          artifactSeverity: 88,
          editorialUsefulness: 84,
        },
      },
    ]);
    assert.equal(ranked[0].candidateId, "c_strong");
    assert.ok(ranked[0].overall > ranked[1].overall);
    assert.equal(selectBestCandidate(ranked.map((r) => ({
      candidateId: r.candidateId,
      shotId: r.shotId,
      scores: r.scores,
    })))?.candidateId, "c_strong");
  });
});

describe("visual lock + versioning + continuity handoff + principles + traceability", () => {
  it("requires reason and impact analysis for locked version changes", () => {
    const lock = createVisualLock({
      target: "character",
      subjectId: "character_maya",
      version: 1,
      reason: "approved sheet",
    });
    assert.throws(() =>
      changeLockedVersion({ lock, nextVersion: 2, reason: "   " })
    );
    const impact = analyzeVisualLockImpact({
      lock,
      nextVersion: 2,
      affectedShotIds: ["shot_1"],
      affectedPanelIds: ["panel_01"],
    });
    assert.ok(impact.some((i) => /shot_1/.test(i)));

    const next = changeLockedVersion({
      lock,
      nextVersion: 2,
      reason: "wardrobe season update",
      affectedShotIds: ["shot_1"],
      affectedPanelIds: ["panel_01"],
      dependentContracts: ["cvc_character_maya_v1"],
    });
    assert.equal(next.version, 2);
    assert.equal(next.previousVersion, 1);
    assert.equal(next.reason, "wardrobe season update");
    assert.ok((next.impactAnalysis || []).length >= 2);
  });

  it("locks storyboard and preserves continuity handoffs across panels", () => {
    const shotA = makeShot({ id: "shot_a" });
    const shotB = makeShot({
      id: "shot_b",
      index: 1,
      timingStartSec: 5,
      motion: {
        subjectMovement: "Host gestures to product",
        cameraMovementDetail: "static hold",
        beginState: "Host settled on mark; product visible",
        endState: "Host presents product to camera",
      },
    });
    const character = createCharacterMaster({
      baseId: "character_maya",
      name: "Maya",
      description: "Host",
    });
    character.wardrobeState = { description: "navy jacket", colors: ["navy"] };
    const cvc = buildCharacterVisualContract({ character });
    const blueprint = buildStoryboardBlueprint({
      productionId: "prod_1",
      scene: makeScene([shotA, shotB]),
      aspectRatio: "16:9",
      characterContracts: [cvc],
    });

    assert.equal(blueprint.continuityState.handoffs.length, 2);
    assert.ok(blueprint.panels[0].outgoingState.wardrobe.join("|").includes("navy jacket"));
    // Continuity handoff: next panel incoming mirrors prior outgoing wardrobe
    assert.deepEqual(
      blueprint.panels[1].incomingState.wardrobe,
      blueprint.panels[0].outgoingState.wardrobe
    );

    const { blueprint: locked, lock } = lockStoryboard(blueprint, "director approved");
    assert.equal(locked.visualLock, true);
    assert.equal(locked.status, "locked");
    assert.equal(lock.target, "storyboard");
  });

  it("exposes three research-derived filmmaking principles", () => {
    const principles = getFilmmakingPrinciples();
    assert.equal(principles.length, 3);
    assert.deepEqual(filmmakingPrincipleIds().sort(), [
      "assets_before_shots",
      "look_before_generation",
      "purpose_before_camera",
    ]);
    for (const p of principles) {
      assert.ok(p.tags.includes("research-supported"));
      assert.ok(p.tags.includes("ai-filmmaking"));
      assert.equal(p.certainty, "supported");
    }
  });

  it("traceability links production → scene → shot → panel → manifest → intent", () => {
    const shot = makeShot();
    const panel = buildStoryboardPanelFromShot({ shot, sequenceIndex: 0 });
    const intent = compileVideoGenerationIntent({
      productionId: "prod_trace",
      shot,
      panel,
      sceneId: "scene_1",
      sequenceId: "seq_1",
    });
    assert.equal(intent.trace.productionId, "prod_trace");
    assert.equal(intent.trace.sceneId, "scene_1");
    assert.equal(intent.trace.sequenceId, "seq_1");
    assert.equal(intent.trace.shotId, shot.id);
    assert.equal(intent.trace.panelId, panel.panelId);
    assert.equal(intent.trace.referenceManifestId, intent.referenceManifest.id);
    assert.ok(intent.panelId);
  });
});
