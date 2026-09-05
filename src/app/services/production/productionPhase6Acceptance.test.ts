/**
 * Phase 6 acceptance — John / coffee shop end-to-end structural pipeline.
 * Deterministic unit test — no live provider calls.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createCharacterMaster,
  createLocationMaster,
  createPropMaster,
  makeAssetRef,
  type ProductMaster,
} from "./specification/assetSpec";
import type { ShotSpec } from "./specification/shotSpec";
import type { SceneSpec } from "./specification/sceneSpec";
import type {
  CreativeSpec,
  ProjectSpec,
  VisualStyleSpec,
  ProductionSpec,
} from "./specification/productionSpec";
import { createDefaultRoutingSpec } from "./specification/routingSpec";
import {
  developVisualTreatment,
  buildCharacterVisualContract,
  buildLocationVisualContract,
  buildProductVisualContract,
  buildPropVisualContract,
  buildStoryboardPanelFromShot,
  buildStoryboardBlueprint,
  chooseStoryboardLayout,
  packStoryboardSheets,
  buildReferenceManifest,
  selectBestCandidate,
  createVisualLock,
  changeLockedVersion,
  analyzeVisualLockImpact,
} from "./preproduction";
import {
  planOperationalShotGeneration,
  selectAndRecordCandidate,
  planShotLocalRegeneration,
} from "./generation";

const STORY_BEATS = [
  "John enters coffee shop",
  "John orders latte",
  "Barista prepares latte",
  "John receives drink",
  "John sits by window",
  "John drinks",
] as const;

const creative: CreativeSpec = {
  intent: "John buys a latte at a neighborhood coffee shop",
  genre: "narrative_short",
  grammarTags: ["cinematic"],
  tone: "warm observational",
  audience: "general",
  narrativeStructure: "sequential beats",
  visualLanguage: "naturalistic commercial",
  pacing: "unhurried",
  emotionalArc: "arrival→comfort",
  requiresHost: false,
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
  estimatedShotCount: 6,
  confidence: 0.85,
  rationale: ["coffee shop continuity demo"],
};

const project: ProjectSpec = {
  id: "prod_john_coffee_p6",
  title: "John Coffee Shop — Phase 6 Acceptance",
  idea: STORY_BEATS.join(". ") + ".",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  productionMode: "standard",
  creativeControl: "auto",
  targetDurationSec: 36,
  platforms: ["youtube"],
  aspectRatio: "16:9",
  formats: ["mp4"],
  status: "planning",
};

const visualStyle: VisualStyleSpec = {
  look: "warm daylight café",
  colorLanguage: "amber wood + soft cream",
  cameraLanguage: "motivated observational",
  lightingLanguage: "window key practical lamps",
  references: [],
  antiSlopLaws: ["no unmotivated crane", "no identity reset between shots"],
};

function makeLatteProduct(): ProductMaster {
  const now = new Date(0).toISOString();
  return {
    identity: { baseId: "product_latte", version: 1, ref: makeAssetRef("product_latte", 1) },
    kind: "product",
    name: "Latte",
    description: "Ceramic cup of latte with microfoam",
    approvedReferenceUrls: ["https://cdn.example/latte.png"],
    tags: ["hero_drink"],
    status: "approved",
    createdAt: now,
    updatedAt: now,
    brandName: "Corner Café",
    heroAngle: "three_quarter",
    mustShowFeatures: ["foam art", "cup silhouette"],
  };
}

function makeShot(index: number, beat: string, extras?: Partial<ShotSpec>): ShotSpec {
  const id = `shot_${String(index + 1).padStart(2, "0")}`;
  const begin =
    index === 0
      ? "John outside door; cup not yet held"
      : `Continuity after: ${STORY_BEATS[index - 1]}`;
  return {
    id,
    sceneId: "scene_cafe_01",
    index,
    purpose: beat,
    productionReason: `Story beat ${index + 1}: ${beat}`,
    timingStartSec: index * 6,
    durationSec: 6,
    camera: {
      shotType: index === 0 ? "wide" : index === 2 ? "closeup" : "medium",
      framing: index === 0 ? "storefront establishing" : "waist-up coverage",
      composition: "rule-of-thirds subject left, café depth right",
      cameraPosition: "eye-level",
      cameraMovement: index % 2 === 0 ? "dolly" : "static",
      lens: index === 2 ? "50mm" : "35mm",
      depthOfField: "moderate",
      focus: "John eyes / hands on cup",
    },
    subject: index === 2 ? "Barista" : "John",
    subjectAction: beat,
    blocking: beat,
    environment: "Corner Café interior — wood counter, window seats",
    lighting: {
      direction: "window key from camera-left",
      intensity: "soft",
      color: "warm daylight",
      atmosphere: "gentle café haze",
      timeOfDay: "morning",
    },
    motion: {
      subjectMovement: beat,
      cameraMovementDetail: index % 2 === 0 ? "Slow motivated dolly" : "Locked-off coverage",
      environmentalMovement: "Steam from espresso machine",
      beginState: begin,
      endState: `Completed: ${beat}`,
      timingNotes: "hold beat clarity",
    },
    references: {
      characterRefs: ["character_john:v1", "character_barista:v1"],
      locationRefs: ["location_corner_cafe:v1"],
      styleRefs: [],
    },
    continuityRequirements: [
      "character_john_identity",
      "location_corner_cafe",
      "prop_latte_cup_when_present",
      "screen_direction_left_to_right",
    ],
    characterIds: index === 2 ? ["character_barista", "character_john"] : ["character_john"],
    propIds: index >= 3 ? ["prop_latte_cup", "product_latte"] : index >= 1 ? ["product_latte"] : [],
    assetIds: index >= 3 ? ["prop_latte_cup", "product_latte"] : [],
    generationStrategy: "image_to_video",
    generationStatus: "planned",
    qcStatus: "pending",
    dialogue: index === 1 ? "One latte, please." : undefined,
    aspectRatio: "16:9",
    ...extras,
  };
}

function makeScene(shots: ShotSpec[]): SceneSpec {
  return {
    id: "scene_cafe_01",
    index: 0,
    title: "Corner Café",
    purpose: "John's latte visit",
    narrativeFunction: "story",
    environment: "Corner Café",
    durationSec: shots.reduce((n, s) => n + s.durationSec, 0),
    characterIds: ["character_john", "character_barista"],
    propIds: ["prop_latte_cup", "product_latte"],
    emotionalObjective: "everyday warmth",
    continuity: {
      entranceState: "John at entrance",
      exitState: "John drinking by window",
      identityLocks: ["character_john", "character_barista"],
      wardrobeLocks: ["john_coat", "barista_apron"],
      propLocks: ["prop_latte_cup"],
      lightingLock: "window key camera-left",
    },
    shots,
  };
}

function minimalSpec(scene: SceneSpec): ProductionSpec {
  const shots = scene.shots.map((s) => ({
    ...s,
    generationTasks: [
      {
        id: `${s.id}_video`,
        kind: "video" as const,
        productionId: project.id,
        sceneId: scene.id,
        shotId: s.id,
        status: "completed" as const,
      },
    ],
  }));
  return {
    id: project.id,
    version: 1,
    scenes: [{ ...scene, shots }],
    continuity: { lastFrameChainEnabled: false },
    routing: { shotDecisions: [] },
  } as unknown as ProductionSpec;
}

describe("Phase 6 acceptance — John coffee shop pipeline", () => {
  it("runs story → contracts → shots → storyboard sheets → intent → tasks → cherry-pick → local regen", () => {
    const john = createCharacterMaster({
      baseId: "character_john",
      name: "John",
      description: "30s man, short brown hair, olive coat",
      referenceUrls: ["https://cdn.example/john.png"],
    });
    john.wardrobeState = {
      description: "olive coat over cream sweater",
      colors: ["olive", "cream"],
    };
    const barista = createCharacterMaster({
      baseId: "character_barista",
      name: "Barista",
      description: "Barista in apron",
      referenceUrls: ["https://cdn.example/barista.png"],
    });
    const cafe = createLocationMaster({
      baseId: "location_corner_cafe",
      name: "Corner Café",
      description: "Warm wood café with street windows",
      environment: "Café interior",
      referenceUrls: ["https://cdn.example/cafe.png"],
    });
    const cup = createPropMaster({
      baseId: "prop_latte_cup",
      name: "Latte cup",
      description: "White ceramic latte cup",
      objectState: "full with foam",
      handheld: true,
      referenceUrls: ["https://cdn.example/cup.png"],
    });
    const latte = makeLatteProduct();

    const cvcJohn = buildCharacterVisualContract({ character: john });
    const cvcBarista = buildCharacterVisualContract({ character: barista });
    const lvc = buildLocationVisualContract({ location: cafe });
    const propContract = buildPropVisualContract({ prop: cup });
    const productContract = buildProductVisualContract({ product: latte });
    const treatment = developVisualTreatment({
      productionId: project.id,
      creative,
      project,
      visualStyle,
    });

    assert.equal(cvcJohn.characterId, "character_john");
    assert.equal(lvc.locationId, "location_corner_cafe");
    assert.equal(propContract.propId, "prop_latte_cup");
    assert.equal(productContract.productId, "product_latte");
    assert.ok(treatment.lookLabel);
    assert.ok(treatment.id);
    assert.equal(propContract.handheld, true);
    assert.ok(propContract.objectState);
    assert.ok(propContract.approvedReferenceUrls.length >= 1);

    const shots = STORY_BEATS.map((beat, i) => makeShot(i, beat));
    const scene = makeScene(shots);
    assert.equal(scene.shots.length, 6);

    assert.equal(chooseStoryboardLayout(5, "16:9"), "1x5");
    assert.equal(chooseStoryboardLayout(8, "16:9"), "2x4");
    assert.equal(chooseStoryboardLayout(20, "16:9"), "4x5");

    const packed = packStoryboardSheets({
      panels: Array.from({ length: 20 }, (_, i) => ({
        panelId: `panel_${String(i + 1).padStart(2, "0")}`,
        shotId: `shot_${String(i + 1).padStart(2, "0")}`,
        sequenceIndex: i,
      })),
      aspectRatio: "16:9",
    });
    assert.equal(packed.length, 2);
    assert.equal(packed[0].panelIds.length, 12);
    assert.equal(packed[1].panelIds.length, 8);
    assert.match(packed[0].rangeLabel, /01/);
    assert.match(packed[1].rangeLabel, /13/);

    const blueprint = buildStoryboardBlueprint({
      productionId: project.id,
      scene,
      aspectRatio: "16:9",
      visualTreatment: treatment,
      characterContracts: [cvcJohn, cvcBarista],
      locationContract: lvc,
      productContracts: [productContract],
    });
    assert.equal(blueprint.panels.length, 6);
    assert.ok(blueprint.sheets && blueprint.sheets.length >= 1);
    for (const panel of blueprint.panels) {
      assert.ok(panel.shotId);
      assert.equal(blueprint.panelToShotMap[panel.panelId], panel.shotId);
    }
    const ordered = [...blueprint.panels].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
    assert.deepEqual(
      ordered.map((p) => p.shotId),
      shots.map((s) => s.id)
    );

    const shot = shots[3];
    assert.equal(shot.purpose, "John receives drink");
    const panel =
      blueprint.panels.find((p) => p.shotId === shot.id) ??
      buildStoryboardPanelFromShot({
        shot,
        sequenceIndex: 3,
        visualTreatmentId: treatment.id,
        characterContracts: [cvcJohn, cvcBarista],
        locationContract: lvc,
        productContracts: [productContract],
      });
    assert.equal(panel.shotId, shot.id);

    const manifest = buildReferenceManifest({
      productionId: project.id,
      shotId: shot.id,
      treatment,
      characters: [cvcJohn, cvcBarista],
      locations: [lvc],
      products: [productContract],
      panel,
    });
    assert.ok(manifest.references.length >= 1);

    const routing = createDefaultRoutingSpec();
    const result = planOperationalShotGeneration({
      productionId: project.id,
      scene,
      shot,
      routing,
      storyboard: blueprint,
      panel,
      treatment,
      characters: [cvcJohn, cvcBarista],
      location: lvc,
      products: [productContract],
      previousShot: shots[2],
      availableProviderIds: ["seedance", "kling"],
      candidateCounts: { low: 1, medium: 2, high: 3 },
    });

    assert.equal(result.intent.shotId, shot.id);
    assert.equal(result.intent.panelId, panel.panelId);
    assert.ok(result.intent.appearanceIntent.visualState);
    assert.ok(result.intent.motionIntent.subjectMotion);
    assert.notEqual(
      result.intent.appearanceIntent.visualState,
      result.intent.motionIntent.subjectMotion
    );
    assert.ok(result.intent.startState.subjectPosition);
    assert.ok(result.intent.endState.subjectPosition);
    assert.ok(result.intent.continuityRequirements.length >= 1);
    assert.ok(result.intent.referenceManifest);
    assert.equal(result.plan.blocked, false);
    assert.ok(result.plan.tasks.length >= 1);
    const video = result.plan.tasks.find((t) => t.kind === "video");
    assert.ok(video);
    assert.equal(video!.intentId, result.intent.id);
    assert.equal(video!.panelId, panel.panelId);
    assert.equal(video!.shotId, shot.id);
    assert.ok((video!.candidateCount || 0) >= 1);
    assert.ok(result.intent.trace.generationTaskIds?.length);

    assert.ok(shot.characterIds.includes("character_john"));
    assert.ok(shot.propIds.includes("prop_latte_cup") || shot.propIds.includes("product_latte"));
    assert.ok(shot.camera.cameraPosition);
    assert.ok(panel.visualObjective || panel.purpose);

    const recorded = selectAndRecordCandidate({
      intent: result.intent,
      observations: [
        {
          candidateId: "cand_a",
          shotId: shot.id,
          scores: { storyAccuracy: 60, composition: 55, characterConsistency: 50 },
        },
        {
          candidateId: "cand_b",
          shotId: shot.id,
          scores: { storyAccuracy: 90, composition: 88, characterConsistency: 92 },
        },
      ],
      assetId: "asset_shot04_cand_b",
    });
    assert.ok(recorded);
    assert.equal(recorded!.selected.candidateId, "cand_b");
    assert.equal(recorded!.intent.trace.candidateId, "cand_b");
    assert.equal(recorded!.intent.trace.assetId, "asset_shot04_cand_b");
    assert.equal(
      selectBestCandidate([
        {
          candidateId: "cand_a",
          shotId: shot.id,
          scores: { storyAccuracy: 60, composition: 55, characterConsistency: 50 },
        },
        {
          candidateId: "cand_b",
          shotId: shot.id,
          scores: { storyAccuracy: 90, composition: 88, characterConsistency: 92 },
        },
      ])?.candidateId,
      "cand_b"
    );

    const spec = minimalSpec(scene);
    const failedId = shots[4].id;
    const local = planShotLocalRegeneration({
      spec,
      shotId: failedId,
      failure: "generation_failure",
    });
    assert.deepEqual(local.regenerateShotIds, [failedId]);
    assert.ok(local.preserveShotIds.includes(shots[0].id));
    assert.ok(local.preserveShotIds.includes(shots[3].id));
    assert.ok(!local.preserveShotIds.includes(failedId));
    assert.ok(local.preserveShotIds.length >= 5);

    const lock = createVisualLock({
      target: "character",
      subjectId: "character_john",
      version: 1,
      reason: "Approved John look",
    });
    const impacted = shots.filter((s) => s.characterIds.includes("character_john")).map((s) => s.id);
    const bumped = changeLockedVersion({
      lock,
      nextVersion: 2,
      reason: "Wardrobe update to winter coat",
      affectedShotIds: impacted,
    });
    assert.equal(bumped.version, 2);
    assert.ok(bumped.impactAnalysis?.some((line) => /shot/i.test(line)));
    const impact = analyzeVisualLockImpact({
      lock: bumped,
      nextVersion: 3,
      affectedShotIds: impacted,
    });
    assert.ok(impact.some((line) => /character_john|shot/i.test(line)));
  });
});
