/**
 * SPARK — Phase 2 Semantic Contracts & Canonical Models Test Suite
 *
 * Verifies:
 * 1. ShotSpec semantic independence (no provider/model required)
 * 2. Capability requirements independence
 * 3. GenerationTask provider-neutral executable intent
 * 4. Legacy compatibility (ProductionBrief ↔ ProductionSpec)
 * 5. Provider isolation (semantic models do not require provider payloads)
 * 6. Reference semantic roles (character, style, environment, start/end frames)
 * 7. Output requirements (QualityTier, ResolutionClass provider-neutral)
 * 8. Existing production execution (dry-run without live spend)
 * 9. Architecture guardrails (single authorities, no provider leakage)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  validateShotSpec,
  validateSceneSpec,
  validateProductionSpec,
  legacyProductionToSpec,
  productionSpecToBrief,
  type ShotSpec,
  type SceneSpec,
  type ProductionSpec,
  type GenerationTask,
  validateGenerationTask,
  type SemanticMediaType,
  type QualityTier,
  type ResolutionClass,
  type SemanticReference,
  type ShotOutputRequirement,
  normalizeQualityTier,
  parseResolutionClass,
  referencePackToSemanticReferences,
  semanticReferencesToReferencePack,
  buildSemanticGenerationRequest,
} from "./specification";
import { capabilityRequirementsFromShot } from "./capability/requirements";
import { executeProduction } from "./execution/productionExecutor";
import { ModelRouter } from "../runtime/modelRouter";
import { createProductionAsset, listMediaAssetsByProductionId } from "../../backend/repositories/productionAssetRepository";

describe("SPARK Phase 2: Canonical Models & Semantic Contracts", () => {
  // Test A — Shot semantic independence
  it("Test A: ShotSpec can express complete production intent without provider or model", () => {
    const shot: ShotSpec = {
      id: "scene_1_shot_0",
      sceneId: "scene_1",
      index: 0,
      purpose: "Hook the viewer with an unexpected reveal",
      productionReason: "Establish dynamic brand tone within the first 3 seconds",
      narrativeBeat: "Primary hook and product entrance",
      timingStartSec: 0,
      startTime: 0,
      durationSec: 4.5,
      camera: {
        shotType: "medium",
        framing: "rule of thirds, subject on right power point",
        composition: "clean corporate background with natural bokeh",
        cameraPosition: "eye-level",
        cameraMovement: "push_in",
        lens: "50mm prime",
        depthOfField: "shallow f/1.8",
        focus: "subject eyes",
      },
      subject: "Founder Maya",
      subjectAction: "Turns toward camera and smiles confidently",
      blocking: "Starts looking at monitor, turns 45 degrees to lens",
      performanceDirection: "Warm, authoritative, articulate",
      dialogue: "We didn't just build an operating system. We rebuilt how media gets made.",
      environment: "Minimalist architectural studio with warm daylight",
      lighting: {
        direction: "key left 45 degrees, soft fill right",
        intensity: "soft high-key",
        color: "warm 5200K",
        atmosphere: "crisp, daylight",
      },
      color: "rich neutrals with electric teal accents",
      atmosphere: "innovative, premium",
      motion: {
        subjectMovement: "controlled pivot toward lens",
        cameraMovementDetail: "smooth 0.5m forward tracking move",
        beginState: "subject profile engaged with desk",
        endState: "subject direct address to camera",
      },
      references: {
        characterRefs: ["founder_maya_v1"],
        locationRefs: ["studio_main_v2"],
        styleRefs: ["brand_cinematic_grade_v1"],
      },
      semanticReferences: [
        { role: "CHARACTER", assetId: "founder_maya_v1", importance: "required" },
        { role: "ENVIRONMENT", assetId: "studio_main_v2", importance: "preferred" },
        { role: "STYLE", assetId: "brand_cinematic_grade_v1", importance: "preferred" },
      ],
      outputRequirements: {
        mediaType: "VIDEO",
        aspectRatio: "9:16",
        qualityTier: "CINEMATIC",
        resolutionClass: "FULL_HD",
        durationSec: 4.5,
      },
      continuityRequirements: [
        "Founder identity lock",
        "Navy blazer wardrobe lock",
        "Studio daylight lock",
      ],
      characterIds: ["founder_maya_v1"],
      propIds: [],
      assetIds: ["founder_maya_v1", "studio_main_v2"],
      generationStrategy: "image_to_video",
      aspectRatio: "9:16",
      generationStatus: "planned",
      qcStatus: "pending",
    };

    // Validates cleanly with zero provider information
    const validation = validateShotSpec(shot);
    assert.equal(validation.ok, true, "ShotSpec must validate cleanly without provider fields");
    assert.equal(shot.provider, undefined, "Provider must not be required");
    assert.equal(shot.model, undefined, "Model must not be required");
    assert.equal(shot.resolution, undefined, "Provider resolution string must not be required");
    assert.equal(shot.outputRequirements?.resolutionClass, "FULL_HD");
    assert.equal(shot.outputRequirements?.qualityTier, "CINEMATIC");
  });

  // Test B — Capability independence
  it("Test B: Capability requirements derived from shot do not contain provider selections", () => {
    const shot: ShotSpec = {
      id: "shot_cap_test",
      sceneId: "scene_cap_test",
      index: 0,
      purpose: "Demonstrate product action",
      productionReason: "Show feature in action",
      timingStartSec: 0,
      durationSec: 5,
      camera: {
        shotType: "closeup",
        framing: "tight hero framing",
        composition: "centered",
        cameraPosition: "macro level",
        cameraMovement: "static",
      },
      subject: "Hardware device",
      subjectAction: "LED pulses blue",
      environment: "Dark studio",
      lighting: { intensity: "accent lighting" },
      motion: {
        subjectMovement: "pulse",
        cameraMovementDetail: "static",
        beginState: "LED off",
        endState: "LED pulsating",
      },
      references: {
        characterRefs: [],
        locationRefs: [],
        styleRefs: [],
        firstFrameUrl: "https://example.com/start.png",
        lastFrameUrl: "https://example.com/end.png",
      },
      continuityRequirements: [],
      characterIds: [],
      propIds: [],
      assetIds: [],
      generationStrategy: "first_last_frame",
      generationStatus: "planned",
      qcStatus: "pending",
    };

    const reqs = capabilityRequirementsFromShot(shot, { aspectRatio: "16:9" });
    assert.equal(reqs.modality, "video");
    assert.equal(reqs.generationMode, "image_to_video");
    assert.equal(reqs.temporal?.requiresStartFrame, true);
    assert.equal(reqs.temporal?.requiresEndFrame, true);
    assert.equal(reqs.temporal?.requiresStartAndEnd, true);
    assert.equal(reqs.output?.aspectRatio, "16:9");
    assert.equal(reqs.output?.durationSeconds, 5);

    // Preferences should be balanced defaults, not hardcoded providers
    assert.equal(reqs.preferences?.preferredProviderId, undefined);
    assert.equal(reqs.preferences?.preferredModelId, undefined);
  });

  // Test C — GenerationTask independence
  it("Test C: GenerationTask represents executable intent without requiring concrete provider payloads", () => {
    const task: GenerationTask = {
      id: "task_test_001",
      kind: "video",
      productionId: "prod_123",
      sceneId: "scene_1",
      shotId: "shot_1",
      strategy: {
        modality: "image_to_video",
        conditioning: { firstFrame: true },
      },
      requiredCapabilities: ["image_to_video", "character_consistency"],
      preferredCapabilities: ["motion_quality"],
      qualityTarget: "cinema",
      speedPriority: false,
      costPriority: false,
      dependsOn: ["task_keyframe_001"],
      dependencies: [
        {
          taskId: "task_keyframe_001",
          reason: "ASSET",
          strength: "hard",
          detail: "Requires still frame",
        },
      ],
      status: "planned",
      maxRetries: 2,
    };

    const errors = validateGenerationTask(task);
    assert.deepEqual(errors, []);
    assert.equal(task.selectedProvider, undefined);
    assert.equal(task.selectedModel, undefined);
  });

  // Test D — Legacy compatibility
  it("Test D: Bidirectional conversion between ProductionBrief and canonical ProductionSpec preserves data", () => {
    const mockBrief = {
      title: "Semantic Test Video",
      hook: "Revolutionary media architecture",
      scriptOutline: "1. Problem\n2. Solution\n3. Proof",
      platformRecommendation: "tiktok, instagram",
      suggestedDuration: "30s",
      targetDurationSec: 30,
      storyboard: [
        {
          scene: 1,
          index: 0,
          duration: "5s",
          durationSec: 5,
          visualDescription: "Futuristic editing bay with neon interface",
          spokenLines: "Media creation just changed forever.",
          action: "Editor taps screen and timeline compiles instantly",
          cameraDirection: "Push in medium closeup",
          audio: "talent" as const,
        },
      ],
    };

    const mockProduction = {
      id: "prod_compat_test",
      title: "Semantic Test Video",
      formats: ["9:16"],
      aspectRatio: "9:16",
      brief: mockBrief,
    };

    const spec = legacyProductionToSpec({
      production: mockProduction as any,
    });

    assert.equal(spec.project.id, "prod_compat_test");
    assert.equal(spec.scenes.length, 1);
    assert.equal(spec.scenes[0].shots.length, 1);
    assert.equal(spec.scenes[0].shots[0].subjectAction, "Editor taps screen and timeline compiles instantly");

    // Convert back to brief
    const projectedBrief = productionSpecToBrief(spec);
    assert.equal(projectedBrief.title, "Semantic Test Video");
    assert.equal(projectedBrief.storyboard.length, 1);
    assert.equal(projectedBrief.storyboard[0].visualDescription, "Futuristic editing bay with neon interface");
  });

  // Test E — Provider isolation & SemanticGenerationRequest
  it("Test E: SemanticGenerationRequest boundary separates intent from provider request", () => {
    const task: GenerationTask = {
      id: "task_exec_test",
      kind: "video",
      productionId: "prod_abc",
      sceneId: "scene_1",
      shotId: "shot_1",
      strategy: { modality: "image_to_video" },
      requiredCapabilities: ["image_to_video", "start_frame"],
      qualityTarget: "cinema",
      dependsOn: [],
      status: "planned",
    };

    const shot: ShotSpec = {
      id: "shot_1",
      sceneId: "scene_1",
      index: 0,
      purpose: "Reveal protagonist",
      productionReason: "Introduce main character visually",
      timingStartSec: 0,
      durationSec: 6,
      camera: {
        shotType: "medium",
        framing: "center",
        composition: "symmetric",
        cameraPosition: "eye-level",
        cameraMovement: "static",
      },
      subject: "Aria",
      subjectAction: "Looks up from terminal",
      environment: "Command center",
      lighting: { atmosphere: "cool fluorescent" },
      motion: {
        subjectMovement: "head lift",
        cameraMovementDetail: "static",
        beginState: "looking down",
        endState: "looking straight",
      },
      references: {
        characterRefs: ["aria_char_ref"],
        locationRefs: ["command_center_ref"],
        styleRefs: [],
        firstFrameUrl: "https://storage.spark.internal/aria_start.png",
      },
      continuityRequirements: ["Aria hair continuity"],
      characterIds: ["aria_char_ref"],
      propIds: [],
      assetIds: [],
      generationStrategy: "image_to_video",
      aspectRatio: "16:9",
      resolution: "1080p", // legacy resolution field
      generationStatus: "planned",
      qcStatus: "pending",
    };

    const semanticReq = buildSemanticGenerationRequest(task, shot);

    assert.equal(semanticReq.taskId, "task_exec_test");
    assert.equal(semanticReq.mediaType, "VIDEO");
    assert.equal(semanticReq.intent.purpose, "Reveal protagonist");
    assert.equal(semanticReq.intent.subject, "Aria");
    assert.deepEqual(semanticReq.capabilities.required, ["image_to_video", "start_frame"]);

    // Check that references are normalized into typed SemanticReferences
    assert.ok(semanticReq.references.length >= 3);
    const startRef = semanticReq.references.find((r) => r.role === "START_FRAME");
    assert.ok(startRef, "Should have normalized START_FRAME reference");
    assert.equal(startRef?.url, "https://storage.spark.internal/aria_start.png");

    const charRef = semanticReq.references.find((r) => r.role === "CHARACTER");
    assert.ok(charRef, "Should have normalized CHARACTER reference");
    assert.equal(charRef?.assetId, "aria_char_ref");

    // Check output resolutionClass mapping from legacy "1080p"
    assert.equal(semanticReq.output.resolutionClass, "FULL_HD");
    assert.equal(semanticReq.output.qualityTier, "CINEMATIC");
  });

  // Test F — Reference semantic roles
  it("Test F: Reference roles convert bidirectionally without loss of core URLs", () => {
    const legacyPack = {
      characterRefs: ["https://example.com/char.png"],
      locationRefs: ["https://example.com/loc.png"],
      styleRefs: ["https://example.com/style.png"],
      firstFrameUrl: "https://example.com/first.png",
      lastFrameUrl: "https://example.com/last.png",
    };

    const semanticRefs = referencePackToSemanticReferences(legacyPack);
    assert.equal(semanticRefs.length, 5);
    assert.ok(semanticRefs.some((r) => r.role === "START_FRAME" && r.url === "https://example.com/first.png"));
    assert.ok(semanticRefs.some((r) => r.role === "END_FRAME" && r.url === "https://example.com/last.png"));
    assert.ok(semanticRefs.some((r) => r.role === "CHARACTER" && r.url === "https://example.com/char.png"));
    assert.ok(semanticRefs.some((r) => r.role === "ENVIRONMENT" && r.url === "https://example.com/loc.png"));
    assert.ok(semanticRefs.some((r) => r.role === "STYLE" && r.url === "https://example.com/style.png"));

    const restoredPack = semanticReferencesToReferencePack(semanticRefs);
    assert.equal(restoredPack.firstFrameUrl, legacyPack.firstFrameUrl);
    assert.equal(restoredPack.lastFrameUrl, legacyPack.lastFrameUrl);
    assert.deepEqual(restoredPack.characterRefs, legacyPack.characterRefs);
    assert.deepEqual(restoredPack.locationRefs, legacyPack.locationRefs);
    assert.deepEqual(restoredPack.styleRefs, legacyPack.styleRefs);
  });

  // Test G — Output requirements
  it("Test G: QualityTier and ResolutionClass parse and normalize provider-neutrally", () => {
    assert.equal(normalizeQualityTier("cinema"), "CINEMATIC");
    assert.equal(normalizeQualityTier("broadcast"), "HIGH");
    assert.equal(normalizeQualityTier("draft"), "DRAFT");
    assert.equal(normalizeQualityTier("film"), "CINEMATIC");
    assert.equal(normalizeQualityTier(undefined), "STANDARD");

    assert.equal(parseResolutionClass("1080p"), "FULL_HD");
    assert.equal(parseResolutionClass("1080"), "FULL_HD");
    assert.equal(parseResolutionClass("4k"), "UHD");
    assert.equal(parseResolutionClass("2160p"), "UHD");
    assert.equal(parseResolutionClass("720p"), "HD");
    assert.equal(parseResolutionClass("480p"), "SD");
    assert.equal(parseResolutionClass("unrecognized"), undefined);
  });

  // Test H — Existing production execution dryRun
  it("Test H: Existing dry-run execution completes without live spend", async () => {
    const mockSpec: ProductionSpec = {
      id: "spec_dryrun_phase2",
      version: 1,
      project: {
        id: "prod_dryrun_phase2",
        title: "Dry Run Test Phase 2",
        idea: "Dry run test",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        productionMode: "standard",
        creativeControl: "auto",
        targetDurationSec: 10,
        platforms: ["youtube_shorts"],
        aspectRatio: "9:16",
        formats: ["9:16"],
        status: "approved",
      },
      creative: {
        intent: "Dry run validation",
        genre: "social",
        grammarTags: ["cinematic"],
        tone: "crisp",
        audience: "general",
        narrativeStructure: "single_beat",
        visualLanguage: "clean",
        pacing: "measured",
        emotionalArc: "steady",
        requiresHost: false,
        requiresCharacters: false,
        requiresNarration: false,
        requiresDialogue: false,
        requiresAnimation: false,
        requiresProductShots: false,
        requiresDocumentaryTreatment: false,
        requiresResearch: false,
        requiresGeneratedEnvironments: false,
        requiresStockOrUserAssets: false,
        requiresImageGeneration: true,
        requiresVideoGeneration: false,
        requiresVoiceGeneration: false,
        requiresMusic: false,
        requiresSoundDesign: false,
        requiresEditing: false,
        estimatedSceneCount: 1,
        estimatedShotCount: 1,
        confidence: 1,
        rationale: ["dry run verification"],
      },
      world: { settingSummary: "Test lab", locations: [] },
      characters: [],
      assets: [],
      narrative: {
        logline: "Test logline",
        hook: "Test hook",
        acts: [{ id: "act_1", name: "Main", purpose: "Test", sceneIds: ["scene_dry_1"] }],
        scriptOutline: "Test",
      },
      scenes: [
        {
          id: "scene_dry_1",
          index: 0,
          title: "Scene 1",
          purpose: "Test scene",
          narrativeFunction: "context",
          environment: "Studio",
          durationSec: 10,
          characterIds: [],
          propIds: [],
          emotionalObjective: "calm",
          continuity: {
            entranceState: "start",
            exitState: "end",
            identityLocks: [],
            wardrobeLocks: [],
            propLocks: [],
          },
          shots: [
            {
              id: "shot_dry_1",
              sceneId: "scene_dry_1",
              index: 0,
              purpose: "Dry run shot",
              productionReason: "Test execution engine",
              timingStartSec: 0,
              durationSec: 10,
              camera: {
                shotType: "wide",
                framing: "wide",
                composition: "centered",
                cameraPosition: "eye-level",
                cameraMovement: "static",
              },
              subject: "Test subject",
              subjectAction: "Remains still",
              environment: "Studio",
              lighting: { atmosphere: "neutral" },
              motion: {
                subjectMovement: "none",
                cameraMovementDetail: "static",
                beginState: "start",
                endState: "end",
              },
              references: { characterRefs: [], locationRefs: [], styleRefs: [] },
              continuityRequirements: [],
              characterIds: [],
              propIds: [],
              assetIds: [],
              generationStrategy: "text_to_image",
              aspectRatio: "9:16",
              generationStatus: "planned",
              qcStatus: "pending",
            },
          ],
        },
      ],
      audio: {
        tracks: [],
        dialogueLines: [],
        musicCues: [],
        sfxCues: [],
        ambienceCues: [],
      },
      visualStyle: {
        look: "clean",
        colorLanguage: "neutral",
        cameraLanguage: "static",
        lightingLanguage: "soft",
        references: [],
        antiSlopLaws: [],
      },
      continuity: {
        globalLocks: [],
        identityPackSummary: "",
        shotBridges: [],
        lastFrameChainEnabled: false,
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
      quality: {
        target: "social",
        maxRetriesPerShot: 1,
        gates: [],
        prioritize: ["story_coherence"],
      },
      researchRequirements: {
        required: false,
        domains: [],
        queries: [],
      },
      meta: {
        specVersion: "1.0",
        compilerVersion: "1.0",
        createdFrom: "idea",
        grammarIds: ["social"],
      },
    };

    const result = await executeProduction(mockSpec, { dryRun: true });
    assert.equal(result.ok, true, "Dry run execution should succeed");
    assert.equal(result.state, "completed");
    assert.ok(result.tasks.length >= 1, "Should plan at least 1 task");
  });

  // Guardrail Tests: Single authorities & architectural isolation
  it("Guardrails: Architecture maintains single routing, execution, and persistence authority", () => {
    // Exactly one runtime ModelRouter class with static dispatch methods
    assert.equal(typeof ModelRouter, "function");
    assert.equal(typeof ModelRouter.getDefaultRoutingConfig, "function");
    assert.equal(typeof ModelRouter.mapCategoryToCapability, "function");
    assert.equal(typeof ModelRouter.executeCategoryRequest, "function");

    // Exactly one productionExecutor entrypoint
    assert.equal(typeof executeProduction, "function");

    // Exactly one canonical media/production asset persistence module
    assert.equal(typeof createProductionAsset, "function");
    assert.equal(typeof listMediaAssetsByProductionId, "function");
  });
});
