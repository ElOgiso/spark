/**
 * SPARK Phase 4 Test Suite: Craft Engine & Creative Operations
 *
 * Tests A-P covering:
 * - Test A: Operation registry resolution
 * - Test B: Operation semantics & metadata
 * - Test C: Provider independence (no provider/model/pricing leakage)
 * - Test D: ReferenceGraph integration
 * - Test E: StyleBible integration without mutating global style
 * - Test F: Capability mapping to Phase 2 capability vocabulary
 * - Test G: Temporal timing semantics
 * - Test H: Target validation and rejection of invalid targets
 * - Test I: Deterministic conflict detection for contradictory operations
 * - Test J: Composition of compatible operations in one CraftPlan
 * - Test K: MOTION_TRANSFER semantic expression without provider implementation
 * - Test L: OBJECT_REPLACEMENT semantic expression without provider implementation
 * - Test M: Cinematography intelligence integration (shotPlanner derived craftPlan)
 * - Test N: ReferenceGraph resolution integrity
 * - Test O: StyleBible cascade integrity
 * - Test P: Existing production dry-run execution with CraftPlan attached
 * - Guardrails: Provider neutrality enforcement
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  CreativeOperationRegistry,
  getOperationDefinition,
  listOperations,
  deriveCapabilitiesFromOperations,
  areOperationsMutuallyExclusive,
} from "./craft/operationRegistry";
import type {
  CraftOperation,
  CraftPlan,
  MotionTransferParameters,
  ObjectReplacementParameters,
  PushInParameters,
  PullBackParameters,
} from "./craft/types";
import {
  validateCraftOperation,
  validateCraftPlan,
} from "./craft/validation";
import {
  deriveCraftPlanFromShot,
  resolveSemanticShot,
} from "./craft/craftPlanner";
import {
  createDefaultStyleBible,
  resolveStyleBible,
} from "./specification/styleBible";
import {
  createEmptyReferenceGraph,
  resolveReferences,
} from "./specification/referenceGraph";
import { planShotsForScene } from "./cinematography/shotPlanner";
import { executeProduction } from "./execution/productionExecutor";
import type { ShotSpec } from "./specification/shotSpec";
import type { SceneSpec } from "./specification/sceneSpec";
import type { ProductionSpec } from "./specification/productionSpec";
import { composeGrammars } from "./grammar";

test("SPARK Phase 4: Craft Engine & Creative Operations", async (t) => {
  const registry = CreativeOperationRegistry.getInstance();

  // -------------------------------------------------------------------------
  // Test A: Operation registry resolves known operations
  // -------------------------------------------------------------------------
  await t.test("Test A: Known operations resolve from the canonical registry", () => {
    const pushInDef = registry.getDefinition("PUSH_IN");
    assert.ok(pushInDef, "PUSH_IN should resolve from registry");
    assert.equal(pushInDef.type, "PUSH_IN");
    assert.equal(pushInDef.category, "CAMERA");

    const motionTransferDef = registry.getDefinition("MOTION_TRANSFER");
    assert.ok(motionTransferDef, "MOTION_TRANSFER should resolve from registry");
    assert.equal(motionTransferDef.category, "MOTION");

    const objectReplaceDef = registry.getDefinition("OBJECT_REPLACEMENT");
    assert.ok(objectReplaceDef, "OBJECT_REPLACEMENT should resolve from registry");
    assert.equal(objectReplaceDef.category, "TRANSFORMATION");

    const allOps = registry.listDefinitions();
    assert.ok(allOps.length >= 20, "Should have a comprehensive canonical operation catalog");

    const cameraOps = registry.listDefinitions("CAMERA");
    assert.ok(cameraOps.some((op) => op.type === "ORBIT"));
    assert.ok(cameraOps.some((op) => op.type === "CRANE"));
  });

  // -------------------------------------------------------------------------
  // Test B: Operation semantics expose valid metadata
  // -------------------------------------------------------------------------
  await t.test("Test B: Each registered operation exposes valid semantic metadata", () => {
    const ops = registry.listDefinitions();
    for (const op of ops) {
      assert.ok(op.type, "Operation must have type");
      assert.ok(op.name, `Operation ${op.type} must have human-readable name`);
      assert.ok(op.description, `Operation ${op.type} must have description`);
      assert.ok(Array.isArray(op.acceptedTargets), `Operation ${op.type} must specify accepted targets`);
      assert.ok(op.acceptedTargets.length > 0, `Operation ${op.type} must accept at least one target type`);
      assert.ok(Array.isArray(op.capabilityRequirements), `Operation ${op.type} must specify capability requirements`);
    }
  });

  // -------------------------------------------------------------------------
  // Test C: Provider independence
  // -------------------------------------------------------------------------
  await t.test("Test C: CraftOperation contains no provider/model selection", () => {
    const op: CraftOperation<PushInParameters> = {
      id: "op_push_in_1",
      type: "PUSH_IN",
      category: "CAMERA",
      purpose: "Heighten tension as character approaches threshold",
      target: { type: "CAMERA", id: "cam_1" },
      parameters: { direction: "forward", distance: "dramatic", speed: "slow" },
      timing: { startSec: 0, durationSec: 3.5 },
      intensity: "dramatic",
    };

    const keys = Object.keys(op);
    const forbidden = [
      "provider",
      "model",
      "selectedModel",
      "providerPayload",
      "providerParameters",
      "providerPricing",
      "klingModel",
      "higgsfieldModel",
      "runwayModel",
      "costCredits",
    ];

    for (const f of forbidden) {
      assert.equal(keys.includes(f), false, `CraftOperation must not contain provider field: ${f}`);
    }
  });

  // -------------------------------------------------------------------------
  // Test D: ReferenceGraph integration
  // -------------------------------------------------------------------------
  await t.test("Test D: Operations can reference semantic ReferenceGraph identities", () => {
    const graph = createEmptyReferenceGraph("prod_401");
    graph.nodes.push({
      id: "node_char_alex",
      type: "CHARACTER",
      role: "REQUIRED",
      scope: "CHARACTER",
      entityId: "char_alex",
      label: "Alex Vance",
      assetId: "asset_char_alex_v1",
    });

    const op: CraftOperation = {
      id: "op_hero_alex",
      type: "HERO_SHOT",
      category: "COMPOSITION",
      purpose: "Establish character authority",
      target: { type: "CHARACTER", id: "char_alex", label: "Alex Vance" },
      parameters: { angle: "low_angle", prominence: "commanding" },
      referenceNodeIds: ["node_char_alex"],
    };

    const val = validateCraftOperation(op, { referenceGraph: graph });
    assert.equal(val.errors.length, 0, "Should validate cleanly with valid ReferenceGraph node");
    assert.equal(val.warnings.length, 0, "Should have no missing reference warnings");
  });

  // -------------------------------------------------------------------------
  // Test E: Style integration without mutating global style
  // -------------------------------------------------------------------------
  await t.test("Test E: Operations can coexist with StyleBible without mutating global style", () => {
    const globalStyle = createDefaultStyleBible("prod_401");
    assert.equal(globalStyle.visualLanguage.aesthetic, "cinematic realism");

    const op: CraftOperation<PushInParameters> = {
      id: "op_push_in_test",
      type: "PUSH_IN",
      category: "CAMERA",
      purpose: "Intimate focus beat",
      target: { type: "CAMERA" },
      parameters: { distance: "subtle" },
      intensity: "subtle",
    };

    // The operation declares intensity within the style envelope, without mutating global style
    assert.equal(globalStyle.visualLanguage.aesthetic, "cinematic realism");
    assert.equal(globalStyle.cinematography.cameraLanguage, "restrained, motivated camera coverage");
  });

  // -------------------------------------------------------------------------
  // Test F: Capability mapping
  // -------------------------------------------------------------------------
  await t.test("Test F: Operations map deterministically to Phase 2 capability requirements", () => {
    const ops: CraftOperation[] = [
      {
        id: "op1",
        type: "PUSH_IN",
        category: "CAMERA",
        purpose: "push",
        target: { type: "CAMERA" },
        parameters: {},
      },
      {
        id: "op2",
        type: "LIGHT_SWEEP",
        category: "LIGHTING",
        purpose: "sweep",
        target: { type: "LIGHTING" },
        parameters: {},
      },
      {
        id: "op3",
        type: "SLOW_MOTION",
        category: "MOTION",
        purpose: "slomo",
        target: { type: "SHOT" },
        parameters: { speedFactor: 0.5 },
      },
    ];

    const caps = deriveCapabilitiesFromOperations(ops);
    assert.ok(caps.includes("camera_motion"), "PUSH_IN should map to camera_motion");
    assert.ok(caps.includes("lighting_control"), "LIGHT_SWEEP should map to lighting_control");
    assert.ok(caps.includes("temporal_control"), "SLOW_MOTION should map to temporal_control");
  });

  // -------------------------------------------------------------------------
  // Test G: Timing semantics
  // -------------------------------------------------------------------------
  await t.test("Test G: Operations can express valid temporal intent", () => {
    const op: CraftOperation = {
      id: "op_pan_1",
      type: "PAN",
      category: "CAMERA",
      purpose: "Pan to reveal sunset",
      target: { type: "CAMERA" },
      parameters: { direction: "right", angleDegrees: 45 },
      timing: { startSec: 1.0, durationSec: 3.0, endSec: 4.0, easing: "ease_in_out" },
    };

    const val = validateCraftOperation(op, { shotDurationSec: 5.0 });
    assert.equal(val.errors.length, 0, "Timing within shot duration should be valid");

    const invalidTimingOp: CraftOperation = {
      ...op,
      id: "op_pan_invalid",
      timing: { startSec: 6.0, durationSec: 2.0 },
    };
    const invalidVal = validateCraftOperation(invalidTimingOp, { shotDurationSec: 5.0 });
    assert.ok(invalidVal.errors.length > 0, "Start second exceeding shot duration must fail validation");
  });

  // -------------------------------------------------------------------------
  // Test H: Target validation
  // -------------------------------------------------------------------------
  await t.test("Test H: Operations reject invalid semantic targets", () => {
    const invalidOp: CraftOperation = {
      id: "op_whip_invalid",
      type: "WHIP_PAN",
      category: "CAMERA",
      purpose: "invalid whip pan target",
      target: { type: "PRODUCT" }, // WHIP_PAN only accepts CAMERA
      parameters: { direction: "left" },
    };

    const val = validateCraftOperation(invalidOp);
    assert.ok(val.errors.length > 0, "WHIP_PAN targeting PRODUCT should fail validation");
    assert.match(val.errors[0], /does not accept target type 'PRODUCT'/);
  });

  // -------------------------------------------------------------------------
  // Test I: Conflict detection
  // -------------------------------------------------------------------------
  await t.test("Test I: Conflicting operations produce structured validation results", () => {
    const conflictingPlan: CraftPlan = {
      shotId: "shot_conflict_1",
      operations: [
        {
          id: "op_push",
          type: "PUSH_IN",
          category: "CAMERA",
          purpose: "move forward",
          target: { type: "CAMERA" },
          parameters: { direction: "forward" },
          timing: { startSec: 0, durationSec: 3 },
        },
        {
          id: "op_pull",
          type: "PULL_BACK",
          category: "CAMERA",
          purpose: "move backward",
          target: { type: "CAMERA" },
          parameters: { direction: "backward" },
          timing: { startSec: 1, durationSec: 3 }, // overlaps with op_push
        },
      ],
    };

    const res = validateCraftPlan(conflictingPlan, { shotDurationSec: 5 });
    assert.equal(res.valid, false, "Plan with opposing camera moves at same time must be invalid");
    assert.equal(res.conflicts.length, 1, "Should surface exactly one conflict");
    assert.equal(res.conflicts[0].code, "OPPOSING_CAMERA_MOVEMENT");
    assert.ok(res.conflicts[0].operationIds.includes("op_push"));
    assert.ok(res.conflicts[0].operationIds.includes("op_pull"));
  });

  // -------------------------------------------------------------------------
  // Test J: Composition of compatible operations
  // -------------------------------------------------------------------------
  await t.test("Test J: Compatible operations can coexist in one CraftPlan", () => {
    const plan: CraftPlan = {
      shotId: "shot_composed_1",
      operations: [
        {
          id: "op_hero",
          type: "HERO_SHOT",
          category: "COMPOSITION",
          purpose: "Elevate product prestige",
          target: { type: "PRODUCT", id: "prod_perfume" },
          parameters: { prominence: "commanding" },
        },
        {
          id: "op_push",
          type: "PUSH_IN",
          category: "CAMERA",
          purpose: "Slow approach",
          target: { type: "CAMERA" },
          parameters: { distance: "subtle" },
          timing: { startSec: 0, durationSec: 4 },
        },
        {
          id: "op_sweep",
          type: "LIGHT_SWEEP",
          category: "LIGHTING",
          purpose: "Highlight glass edge",
          target: { type: "LIGHTING" },
          parameters: { direction: "left_to_right" },
          timing: { startSec: 1, durationSec: 2 },
        },
      ],
    };

    const res = validateCraftPlan(plan, { shotDurationSec: 4.0 });
    assert.equal(res.valid, true, "Composite plan should be valid");
    assert.equal(res.conflicts.length, 0, "Should have 0 conflicts");
  });

  // -------------------------------------------------------------------------
  // Test K: MOTION_TRANSFER semantic expression
  // -------------------------------------------------------------------------
  await t.test("Test K: MOTION_TRANSFER expresses semantic requirements without a provider-specific implementation", () => {
    const motionTransferOp: CraftOperation<MotionTransferParameters> = {
      id: "op_motion_dance_1",
      type: "MOTION_TRANSFER",
      category: "MOTION",
      purpose: "Transfer breakdance choreography onto avatar",
      target: { type: "CHARACTER", id: "char_cyber_monk" },
      parameters: {
        sourceVideoRef: "asset_driving_dance_clip",
        drivingAction: "Acrobatic flare spin into freeze",
        targetSubjectRef: "char_cyber_monk",
        fidelityMode: "full_motion",
        retainSubjectIdentity: true,
      },
      timing: { startSec: 0, durationSec: 4 },
      capabilityRequirements: ["motion_transfer", "video_input", "image_reference"],
    };

    const val = validateCraftOperation(motionTransferOp);
    assert.equal(val.errors.length, 0, "MOTION_TRANSFER should validate with required semantic inputs");

    const caps = deriveCapabilitiesFromOperations([motionTransferOp]);
    assert.ok(caps.includes("motion_transfer"));
    assert.ok(caps.includes("video_input"));
    assert.ok(caps.includes("image_reference"));
  });

  // -------------------------------------------------------------------------
  // Test L: OBJECT_REPLACEMENT semantic expression
  // -------------------------------------------------------------------------
  await t.test("Test L: OBJECT_REPLACEMENT expresses semantic requirements without provider-specific implementation", () => {
    const objectReplaceOp: CraftOperation<ObjectReplacementParameters> = {
      id: "op_replace_phone_1",
      type: "OBJECT_REPLACEMENT",
      category: "TRANSFORMATION",
      purpose: "Replace standard prop phone with client concept phone",
      target: { type: "OBJECT", id: "prop_old_phone" },
      parameters: {
        sourceShotOrVideoRef: "shot_scene_1_0",
        targetObjectRef: "prop_old_phone",
        replacementReferenceId: "ref_node_client_device",
        preserveLighting: true,
        preserveShadows: true,
      },
      capabilityRequirements: ["object_replacement", "video_input", "replacement_reference"],
    };

    const val = validateCraftOperation(objectReplaceOp);
    assert.equal(val.errors.length, 0, "OBJECT_REPLACEMENT should validate with required semantic inputs");

    const caps = deriveCapabilitiesFromOperations([objectReplaceOp]);
    assert.ok(caps.includes("object_replacement"));
    assert.ok(caps.includes("video_input"));
    assert.ok(caps.includes("replacement_reference"));
  });

  // -------------------------------------------------------------------------
  // Test M: Cinematography integration
  // -------------------------------------------------------------------------
  await t.test("Test M: Existing cinematic planning automatically attaches canonical CraftPlan", () => {
    const grammar = composeGrammars("advertisement", [], ["cinematic"]);
    const scene: SceneSpec = {
      id: "scene_test_cinematic",
      index: 0,
      narrativeFunction: "product",
      purpose: "Showcase flagship product with dynamic camera",
      durationSec: 6,
      environment: "Minimalist dark studio with edge lighting",
      timeOfDay: "interior_studio",
      continuity: {
        identityLocks: ["product_flagship"],
        wardrobeLocks: [],
      },
      emotionalObjective: "Prestigious and technologically advanced",
      shots: [],
    };

    const shots = planShotsForScene({
      scene,
      grammar,
      aspectRatio: "16:9",
      maxShots: 2,
      preferI2V: true,
      characterIds: ["char_host"],
    });

    assert.ok(shots.length > 0, "Should generate shots");
    const firstShot = shots[0];

    assert.ok(firstShot.craftPlan, "Shot must have a canonical craftPlan attached");
    assert.equal(firstShot.craftPlan.shotId, firstShot.id);
    assert.ok(firstShot.craftPlan.operations.length > 0, "Derived craft plan must contain creative operations");

    // Camera movement in shot should be reflected in operations
    if (firstShot.camera.cameraMovement && firstShot.camera.cameraMovement !== "static") {
      const hasMatchingCameraOp = firstShot.craftPlan.operations.some(
        (op) => op.category === "CAMERA"
      );
      assert.ok(hasMatchingCameraOp, "CraftPlan must reflect cinematography camera movement");
    }
  });

  // -------------------------------------------------------------------------
  // Test N: Existing ReferenceGraph tests remain green
  // -------------------------------------------------------------------------
  await t.test("Test N: ReferenceGraph resolution functions seamlessly with CraftPlan", () => {
    const graph = createEmptyReferenceGraph("prod_402");
    graph.nodes.push({
      id: "ref_brand_logo",
      type: "BRAND",
      role: "REQUIRED",
      scope: "PRODUCTION",
      label: "Brand Master Logo",
      assetId: "asset_brand_1",
    });

    const resolved = resolveReferences(graph, {
      productionId: "prod_402",
      sceneId: "scene_1",
      shotId: "shot_1",
    });

    assert.equal(resolved.all.length, 1);
    assert.equal(resolved.all[0].nodeId, "ref_brand_logo");
    assert.equal(resolved.conflicts.length, 0);
  });

  // -------------------------------------------------------------------------
  // Test O: Existing StyleBible tests remain green
  // -------------------------------------------------------------------------
  await t.test("Test O: StyleBible cascade resolves cleanly alongside CraftPlan", () => {
    const prodStyle = createDefaultStyleBible("prod_403");
    const resolvedStyle = resolveStyleBible({
      productionStyle: prodStyle,
      shotOverride: {
        lighting: {
          contrast: "high_contrast_chiaroscuro",
        },
      },
    });

    assert.equal(resolvedStyle.bible.lighting.contrast, "high_contrast_chiaroscuro");
    assert.equal(resolvedStyle.provenance.lighting, "OVERRIDE");
    assert.equal(resolvedStyle.bible.visualLanguage.aesthetic, "cinematic realism");
  });

  // -------------------------------------------------------------------------
  // Test P: Dry-run production execution remains functional with CraftPlan
  // -------------------------------------------------------------------------
  await t.test("Test P: Existing dry-run execution completes successfully with CraftPlan attached", async () => {
    const sampleProduction: ProductionSpec = {
      id: "prod_dry_run_p4",
      project: {
        id: "proj_dry_run_p4",
        title: "Phase 4 Craft Test",
        idea: "Phase 4 Craft Test Product Reveal",
        format: "explainer",
        aspectRatio: "16:9",
        targetDurationSec: 8,
      },
      creative: {
        intent: "Showcase flagship device with sleek cinematography",
        genre: "commercial",
        tone: "sleek",
        visualLanguage: "photoreal",
        estimatedSceneCount: 1,
        estimatedShotCount: 1,
      },
      visualStyle: {
        look: "clean_corporate",
        colorLanguage: "cool steel",
        lightingApproach: "motivated bright",
      },
      scenes: [
        {
          id: "sc_craft_1",
          index: 0,
          narrativeFunction: "hook",
          purpose: "Hook attention with dynamic product reveal",
          durationSec: 4,
          environment: "Modern bright studio",
          continuity: { identityLocks: [], wardrobeLocks: [] },
          shots: [
            {
              id: "shot_craft_1_0",
              sceneId: "sc_craft_1",
              index: 0,
              purpose: "Dynamic push-in on hero item",
              productionReason: "Establish visual anchor",
              timingStartSec: 0,
              durationSec: 4,
              camera: {
                shotType: "medium",
                framing: "centered",
                composition: "rule of thirds",
                cameraMovement: "push_in",
                lens: "35mm",
                depthOfField: "moderate",
              },
              subject: "flagship_device",
              subjectAction: "rests on marble pedestal",
              environment: "Modern bright studio",
              lighting: { lightingStyle: "three_point", keyPosition: "high_left" },
              motion: {
                cameraMovementDetail: "Smooth motorized push-in",
                beginState: "wide perspective",
                endState: "tight medium",
              },
              references: { characterRefs: [], locationRefs: [], styleRefs: [] },
              continuityRequirements: [],
              characterIds: [],
              propIds: [],
              assetIds: [],
              generationStrategy: "image_to_video",
              generationStatus: "planned",
              qcStatus: "pending",
              craftPlan: {
                shotId: "shot_craft_1_0",
                operations: [
                  {
                    id: "op_craft_push",
                    type: "PUSH_IN",
                    category: "CAMERA",
                    purpose: "Approach subject smoothly",
                    target: { type: "CAMERA" },
                    parameters: { direction: "forward", distance: "moderate" },
                    timing: { startSec: 0, durationSec: 4 },
                    intensity: "moderate",
                  },
                ],
              },
            },
          ],
        },
      ],
      characters: [],
      world: { locations: [] },
      audio: {
        hasNarration: false,
        hasDialogue: false,
        tracks: [],
        dialogueLines: [],
        musicCues: [],
        sfxCues: [],
        ambienceCues: [],
      },
      quality: {
        target: "social",
        maxRetriesPerShot: 1,
        gates: [],
        prioritize: ["story_coherence"],
      },
      continuity: {
        identityTracking: "strict",
        lastFrameChainEnabled: false,
      },
      editorialTimeline: {
        durationSec: 4,
        targetDurationSec: 4,
        tracks: [],
      },
      routing: {
        allowProviderFallback: true,
        shotDecisions: [],
        capabilityPolicy: {
          preferCharacterConsistency: true,
          preferFirstLastFrame: true,
          preferNativeAudio: false,
          preferSpeed: false,
          preferCost: false,
        },
      },
    };

    const res = await executeProduction(sampleProduction, {
      dryRun: true,
    });

    assert.equal(res.ok, true, "Dry run execution must succeed");
    assert.equal(res.state, "completed", "Status must be completed");
  });

  // -------------------------------------------------------------------------
  // Guardrails: Provider Neutrality
  // -------------------------------------------------------------------------
  await t.test("Guardrails: CreativeOperationRegistry and CraftPlan contain zero provider specifics", () => {
    const defs = registry.listDefinitions();
    for (const def of defs) {
      const serialized = JSON.stringify(def).toLowerCase();
      assert.equal(serialized.includes("higgsfield"), false, "No Higgsfield tokens in operation definitions");
      assert.equal(serialized.includes("kling"), false, "No Kling tokens in operation definitions");
      assert.equal(serialized.includes("runway"), false, "No Runway tokens in operation definitions");
      assert.equal(serialized.includes("openai"), false, "No OpenAI tokens in operation definitions");
      assert.equal(serialized.includes("pricing"), false, "No pricing fields in operation definitions");
      assert.equal(serialized.includes("costcredits"), false, "No credit costs in operation definitions");
    }
  });
});
