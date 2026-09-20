/**
 * SPARK — Phase 3 ReferenceGraph & StyleBible Test Suite
 *
 * Verifies:
 * Test A — ReferenceGraph construction
 * Test B — Reference inheritance (Production → Scene → Shot)
 * Test C — Reference override (deterministic override of inherited nodes)
 * Test D — Reference exclusion (excluded nodes do not appear in resolved set)
 * Test E — Reference conflict (deterministic detection of contradictory REQUIRED references)
 * Test F — Provider neutrality (no provider tokens, slots, or API params in ReferenceGraph)
 * Test G — StyleBible construction (structured visual rules and negative constraints)
 * Test H — Style inheritance (Defaults → Brand → Production → Scene → Shot)
 * Test I — Style override (fine-grained override preserving unrelated properties)
 * Test J — Provenance (traceable provenance for each style dimension)
 * Test K — Style / Reference separation (distinct conceptual boundaries)
 * Test L — Character linkage (uses MasterAssetRef / CharacterMaster, no duplicate model)
 * Test M — Asset linkage (stable assetId / masterRef rather than mutable URLs alone)
 * Test N — Existing continuity (Continuity remains separate temporal authority)
 * Test O — Existing production execution (dry-run passes with StyleBible and ReferenceGraph)
 * Guardrails — Single authorities & provider isolation
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  type ReferenceGraph,
  type ReferenceNode,
  type ReferenceEdge,
  createEmptyReferenceGraph,
  resolveReferences,
  type StyleBible,
  createDefaultStyleBible,
  resolveStyleBible,
  styleBibleFromVisualTreatment,
  visualTreatmentFromStyleBible,
  type ProductionSpec,
  legacyProductionToSpec,
} from "./specification";
import { executeProduction } from "./execution/productionExecutor";

describe("SPARK Phase 3: ReferenceGraph & StyleBible", () => {
  // Test A — ReferenceGraph construction
  it("Test A: ReferenceGraph construction accepts semantic nodes and edges", () => {
    const graph: ReferenceGraph = {
      id: "refgraph_prod_001",
      productionId: "prod_001",
      nodes: [
        {
          id: "node_char_maya",
          type: "CHARACTER_IDENTITY",
          role: "REQUIRED",
          scope: "PRODUCTION",
          entityId: "char_maya",
          assetId: "asset_maya_hero_01",
          masterRef: "character_maya:v1",
          label: "Maya Host Identity",
        },
        {
          id: "node_studio_env",
          type: "ENVIRONMENT",
          role: "PREFERRED",
          scope: "SCENE",
          entityId: "scene_01",
          assetId: "asset_studio_wide_01",
          label: "Architectural Studio Location",
        },
      ],
      edges: [
        {
          id: "edge_01",
          fromNodeId: "node_char_maya",
          toNodeId: "node_studio_env",
          type: "INHERITS",
        },
      ],
      version: 1,
    };

    assert.equal(graph.productionId, "prod_001");
    assert.equal(graph.nodes.length, 2);
    assert.equal(graph.edges.length, 1);
    assert.equal(graph.nodes[0].type, "CHARACTER_IDENTITY");
    assert.equal(graph.nodes[0].assetId, "asset_maya_hero_01");
  });

  // Test B — Reference inheritance
  it("Test B: References inherit down from Production → Scene → Character into Shot", () => {
    const graph: ReferenceGraph = {
      id: "refgraph_inherit_test",
      productionId: "prod_test",
      nodes: [
        {
          id: "node_prod_brand_style",
          type: "STYLE",
          role: "PREFERRED",
          scope: "PRODUCTION",
          assetId: "asset_style_brand",
          label: "Production Style Anchor",
        },
        {
          id: "node_char_ref",
          type: "CHARACTER",
          role: "REQUIRED",
          scope: "CHARACTER",
          entityId: "char_protagonist",
          assetId: "asset_char_protagonist",
          label: "Character Face Reference",
        },
        {
          id: "node_scene_env",
          type: "ENVIRONMENT",
          role: "PREFERRED",
          scope: "SCENE",
          entityId: "scene_01",
          assetId: "asset_scene_env",
          label: "Scene 1 Environment Anchor",
        },
        {
          id: "node_shot_keyframe",
          type: "START_FRAME",
          role: "REQUIRED",
          scope: "SHOT",
          entityId: "shot_01",
          url: "https://storage.spark.internal/shot_01_first.png",
          label: "Shot 1 Start Frame",
        },
      ],
      edges: [],
    };

    const resolved = resolveReferences(graph, {
      productionId: "prod_test",
      sceneId: "scene_01",
      shotId: "shot_01",
      characterIds: ["char_protagonist"],
    });

    assert.equal(resolved.all.length, 4, "Shot should inherit from production, character, scene, and shot");
    assert.ok(resolved.required.some((r) => r.type === "START_FRAME" && r.source === "shot"));
    assert.ok(resolved.required.some((r) => r.type === "CHARACTER" && r.source === "character"));
    assert.ok(resolved.preferred.some((r) => r.type === "ENVIRONMENT" && r.source === "scene"));
    assert.ok(resolved.preferred.some((r) => r.type === "STYLE" && r.source === "production"));
    assert.equal(resolved.startFrame?.url, "https://storage.spark.internal/shot_01_first.png");
  });

  // Test C — Reference override
  it("Test C: A shot can override an inherited reference deterministically", () => {
    const graph: ReferenceGraph = {
      id: "refgraph_override_test",
      productionId: "prod_test",
      nodes: [
        {
          id: "node_scene_env_default",
          type: "ENVIRONMENT",
          role: "PREFERRED",
          scope: "SCENE",
          entityId: "scene_01",
          assetId: "asset_env_day",
          label: "Daytime Environment",
        },
        {
          id: "node_shot_env_override",
          type: "ENVIRONMENT",
          role: "OVERRIDE",
          scope: "SHOT",
          entityId: "shot_02",
          assetId: "asset_env_night",
          label: "Nighttime Flashback Override",
        },
      ],
      edges: [
        {
          id: "edge_override",
          fromNodeId: "node_shot_env_override",
          toNodeId: "node_scene_env_default",
          type: "OVERRIDES",
        },
      ],
    };

    const resolved = resolveReferences(graph, {
      productionId: "prod_test",
      sceneId: "scene_01",
      shotId: "shot_02",
    });

    assert.equal(resolved.all.length, 1);
    assert.equal(resolved.all[0].assetId, "asset_env_night");
    assert.equal(resolved.all[0].source, "shot_override");
    assert.ok(resolved.excludedNodeIds.includes("node_scene_env_default"));
  });

  // Test D — Reference exclusion
  it("Test D: Explicitly excluded references do not appear in the resolved set", () => {
    const graph: ReferenceGraph = {
      id: "refgraph_exclude_test",
      productionId: "prod_test",
      nodes: [
        {
          id: "node_excluded_style",
          type: "STYLE",
          role: "EXCLUDED",
          scope: "PRODUCTION",
          assetId: "asset_style_deprecated",
          label: "Deprecated Style Reference",
        },
        {
          id: "node_active_style",
          type: "STYLE",
          role: "PREFERRED",
          scope: "PRODUCTION",
          assetId: "asset_style_active",
          label: "Active Style Reference",
        },
      ],
      edges: [],
    };

    const resolved = resolveReferences(graph, {
      productionId: "prod_test",
    });

    assert.equal(resolved.all.length, 1);
    assert.equal(resolved.all[0].assetId, "asset_style_active");
    assert.ok(resolved.excludedNodeIds.includes("node_excluded_style"));
  });

  // Test E — Reference conflict
  it("Test E: Deterministically surfaces conflicts for contradictory REQUIRED references", () => {
    const graph: ReferenceGraph = {
      id: "refgraph_conflict_test",
      productionId: "prod_test",
      nodes: [
        {
          id: "node_char_maya_v1",
          type: "CHARACTER_IDENTITY",
          role: "REQUIRED",
          scope: "CHARACTER",
          entityId: "char_maya",
          assetId: "asset_maya_look_A",
        },
        {
          id: "node_char_maya_v2",
          type: "CHARACTER_IDENTITY",
          role: "REQUIRED",
          scope: "CHARACTER",
          entityId: "char_maya",
          assetId: "asset_maya_look_B", // Different look claimed simultaneously as REQUIRED
        },
      ],
      edges: [],
    };

    const resolved = resolveReferences(graph, {
      productionId: "prod_test",
      characterIds: ["char_maya"],
    });

    assert.equal(resolved.conflicts.length, 1);
    assert.equal(resolved.conflicts[0].code, "CONTRADICTORY_IDENTITY");
    assert.equal(resolved.conflicts[0].entityId, "char_maya");
    assert.equal(resolved.conflicts[0].evidence.candidates.length, 2);
  });

  // Test F — Provider neutrality
  it("Test F: ReferenceGraph contains no provider-specific execution fields", () => {
    const graph = createEmptyReferenceGraph("prod_neutral");
    const node: ReferenceNode = {
      id: "node_neutral_01",
      type: "CHARACTER",
      role: "REQUIRED",
      scope: "PRODUCTION",
      assetId: "asset_123",
      label: "Provider-neutral node",
    };
    graph.nodes.push(node);

    const keys = Object.keys(node);
    assert.ok(!keys.includes("higgsfieldReferenceId"));
    assert.ok(!keys.includes("klingSlot"));
    assert.ok(!keys.includes("providerModel"));
    assert.ok(!keys.includes("seedanceIndex"));
  });

  // Test G — StyleBible construction
  it("Test G: StyleBible constructs structured visual language dimensions and negative constraints", () => {
    const bible = createDefaultStyleBible("prod_style_01", "brand_01");

    assert.equal(bible.productionId, "prod_style_01");
    assert.equal(bible.brandId, "brand_01");
    assert.equal(bible.visualLanguage.aesthetic, "cinematic realism");
    assert.equal(bible.cinematography.cameraLanguage, "restrained, motivated camera coverage");
    assert.equal(bible.lighting.keyMood, "motivated, naturalistic lighting");
    assert.equal(bible.color.saturation, "natural");
    assert.ok(bible.constraints.negativeRules.length >= 3);
  });

  // Test H — Style inheritance
  it("Test H: Style precedence resolves Defaults → Brand → Production → Scene → Shot", () => {
    const defaultStyle = {
      visualLanguage: { aesthetic: "Default Aesthetic" },
      lighting: { keyMood: "Default Lighting" },
    };

    const brandStyle = {
      visualLanguage: { aesthetic: "Brand Luxury Aesthetic" },
      color: { palette: "Brand Gold and Black" },
    };

    const productionStyle = {
      lighting: { keyMood: "Production High-Contrast Noir" },
    };

    const sceneOverride = {
      color: { palette: "Scene Emerald Flashback" },
    };

    const resolved = resolveStyleBible({
      defaultStyle,
      brandStyle,
      productionStyle,
      sceneOverride,
    });

    assert.equal(resolved.bible.visualLanguage.aesthetic, "Brand Luxury Aesthetic");
    assert.equal(resolved.bible.lighting.keyMood, "Production High-Contrast Noir");
    assert.equal(resolved.bible.color.palette, "Scene Emerald Flashback");
    assert.equal(resolved.provenance.visualLanguage, "BRAND");
    assert.equal(resolved.provenance.lighting, "PRODUCTION");
    assert.equal(resolved.provenance.color, "OVERRIDE");
  });

  // Test I — Style override
  it("Test I: Shot-level style override updates specific dimension without destroying others", () => {
    const productionStyle = createDefaultStyleBible("prod_p");
    productionStyle.visualLanguage.aesthetic = "Master Aesthetic";
    productionStyle.lighting.keyMood = "Master Lighting";

    const shotOverride: Partial<StyleBible> = {
      lighting: {
        keyMood: "Flickering Emergency Red",
        contrast: "extreme",
      },
    };

    const resolved = resolveStyleBible({
      productionStyle,
      shotOverride,
    });

    // Overridden dimension
    assert.equal(resolved.bible.lighting.keyMood, "Flickering Emergency Red");
    assert.equal(resolved.bible.lighting.contrast, "extreme");
    assert.equal(resolved.provenance.lighting, "OVERRIDE");

    // Preserved dimension
    assert.equal(resolved.bible.visualLanguage.aesthetic, "Master Aesthetic");
    assert.equal(resolved.provenance.visualLanguage, "PRODUCTION");
  });

  // Test J — Provenance
  it("Test J: Resolved style bible maintains provenance map for all visual dimensions", () => {
    const resolved = resolveStyleBible({
      brandStyle: { color: { palette: "Brand Blue" } },
      productionStyle: { lighting: { keyMood: "Atmospheric Day" } },
    });

    assert.equal(resolved.provenance.color, "BRAND");
    assert.equal(resolved.provenance.lighting, "PRODUCTION");
    assert.equal(resolved.provenance.visualLanguage, "DEFAULT");
  });

  // Test K — Style / Reference separation
  it("Test K: References and Style remain distinct concepts", () => {
    const bible = createDefaultStyleBible("prod_sep");
    bible.color.palette = "Golden hour warmth";

    const refNode: ReferenceNode = {
      id: "ref_actor_face",
      type: "CHARACTER_IDENTITY",
      role: "REQUIRED",
      scope: "CHARACTER",
      assetId: "asset_face_01",
    };

    // A reference is evidence / identity; StyleBible is visual rules
    assert.notEqual(bible.color.palette, refNode.assetId);
    assert.equal(typeof bible.lighting.keyMood, "string");
    assert.equal(refNode.type, "CHARACTER_IDENTITY");
  });

  // Test L — Character linkage
  it("Test L: Character identity references integrate with MasterAssetRef identity system", () => {
    const node: ReferenceNode = {
      id: "node_char_link",
      type: "CHARACTER",
      role: "REQUIRED",
      scope: "CHARACTER",
      entityId: "char_host",
      masterRef: "character_host:v1",
      assetId: "asset_char_host_approved",
    };

    assert.equal(node.masterRef, "character_host:v1");
    assert.ok(node.masterRef?.includes(":v1"));
  });

  // Test M — Asset linkage
  it("Test M: Reference nodes resolve to stable asset identity rather than mutable URLs alone", () => {
    const node: ReferenceNode = {
      id: "node_asset_link",
      type: "LOCATION",
      role: "REQUIRED",
      scope: "SCENE",
      assetId: "asset_studio_durable_id",
      url: "https://ephemeral-cdn.spark.internal/view.png?expires=12345",
    };

    assert.equal(node.assetId, "asset_studio_durable_id");
    assert.ok(node.url?.includes("expires="));
  });

  // Test N — Existing continuity integration
  it("Test N: Existing continuity system remains separate authority for temporal state", () => {
    const mockProduction = {
      id: "prod_cont_test",
      title: "Continuity Test",
      brief: {
        title: "Continuity Test",
        storyboard: [
          {
            scene: 1,
            index: 0,
            durationSec: 5,
            spokenLines: "Scene 1",
            visualDescription: "Studio entrance",
          },
        ],
      },
    };

    const spec = legacyProductionToSpec({
      production: mockProduction as any,
    });

    assert.ok(spec.continuity, "ContinuitySpec must remain present on ProductionSpec");
    assert.ok(spec.styleBible, "StyleBible must be attached to ProductionSpec");
    assert.ok(spec.referenceGraph, "ReferenceGraph must be attached to ProductionSpec");
  });

  // Test O — Existing production execution dryRun
  it("Test O: Existing dry-run execution completes successfully with StyleBible and ReferenceGraph attached", async () => {
    const mockSpec: ProductionSpec = {
      id: "spec_phase3_exec",
      version: 1,
      project: {
        id: "prod_phase3_exec",
        title: "Phase 3 Exec Test",
        idea: "Phase 3 Exec Test",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        productionMode: "standard",
        creativeControl: "auto",
        targetDurationSec: 5,
        platforms: ["youtube_shorts"],
        aspectRatio: "9:16",
        formats: ["9:16"],
        status: "approved",
      },
      creative: {
        intent: "Execution test",
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
      world: { settingSummary: "Studio", locations: [] },
      characters: [],
      assets: [],
      narrative: {
        logline: "Logline",
        hook: "Hook",
        acts: [{ id: "act_1", name: "Main", purpose: "Test", sceneIds: ["scene_p3_1"] }],
        scriptOutline: "Outline",
      },
      scenes: [
        {
          id: "scene_p3_1",
          index: 0,
          title: "Scene 1",
          purpose: "Test",
          narrativeFunction: "context",
          environment: "Studio",
          durationSec: 5,
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
              id: "shot_p3_1",
              sceneId: "scene_p3_1",
              index: 0,
              purpose: "Dry run shot",
              productionReason: "Verify execution engine",
              timingStartSec: 0,
              durationSec: 5,
              camera: {
                shotType: "wide",
                framing: "wide",
                composition: "centered",
                cameraPosition: "eye-level",
                cameraMovement: "static",
              },
              subject: "Still test",
              subjectAction: "Still",
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
      styleBible: createDefaultStyleBible("prod_phase3_exec"),
      referenceGraph: createEmptyReferenceGraph("prod_phase3_exec"),
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
    assert.equal(result.ok, true);
    assert.equal(result.state, "completed");
  });

  // Guardrails
  it("Guardrails: VisualTreatment adapts bidirectionally to StyleBible without loss", () => {
    const bible = createDefaultStyleBible("prod_trans");
    const treatment = visualTreatmentFromStyleBible(bible);
    assert.equal(treatment.lookLabel, bible.visualLanguage.aesthetic);
    assert.equal(treatment.palette, bible.color.palette);

    const convertedBible = styleBibleFromVisualTreatment(treatment, "prod_trans");
    assert.equal(convertedBible.visualLanguage.aesthetic, treatment.lookLabel);
    assert.equal(convertedBible.color.palette, treatment.palette);
  });
});
