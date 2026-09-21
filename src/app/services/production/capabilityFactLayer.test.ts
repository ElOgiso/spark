/**
 * Phase 5 Canonical Test Suite: Capability Fact Layer + Model Catalog Alignment
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  getCapabilityProfile,
  listCapabilityProfiles,
  registerCapabilityProfile,
  findProfileForCatalogModel,
} from "./capability/registry";
import {
  validateCapabilityRequirements,
} from "./capability/validate";
import {
  assertExecutableCapability,
} from "./capability/router";
import {
  capabilityRequirementsFromShot,
  capabilityRequirementsFromTask,
  buildCapabilityRequirements,
} from "./capability/requirements";
import type { CapabilityRequirements, MediaCapabilityProfile } from "./capability/types";
import { MODEL_CATALOG, type ModelCapability } from "../runtime/modelCatalog";
import { PROVIDER_GENERATION_SCORECARDS, resolveScorecardLimits } from "./routing/capabilityMatrix";
import { GenerationExecutionEngine } from "./execution/executionEngine";
import { createProductionPlan } from "./intelligence/productionOrchestrator";
import { planGenerationTasks } from "./generation/generationPlanner";
import { CapabilityRegistry as ResearchCapabilityRegistry } from "../capabilityRegistry";

describe("Phase 5: Capability Fact Layer & Model Catalog Alignment", () => {
  describe("1. Capability Profile Registry & Alias Resolution", () => {
    it("retrieves primary active profiles by providerId", () => {
      const kling = getCapabilityProfile("kling");
      assert.ok(kling, "Kling profile should exist");
      assert.equal(kling?.providerId, "kling");
      assert.equal(kling?.modalities.includes("video"), true);

      const grok = getCapabilityProfile("grok");
      assert.ok(grok, "Grok profile should exist");
      assert.equal(grok?.providerId, "grok");

      const seedance = getCapabilityProfile("seedance");
      assert.ok(seedance, "Seedance profile should exist");

      const openai = getCapabilityProfile("openai");
      assert.ok(openai, "OpenAI profile should exist");
      assert.equal(openai?.modalities.includes("image"), true);

      const elevenlabs = getCapabilityProfile("elevenlabs");
      assert.ok(elevenlabs, "ElevenLabs profile should exist");
      assert.equal(elevenlabs?.modalities.includes("audio"), true);
    });

    it("resolves exact model IDs and registered aliases case-insensitively", () => {
      // Kling
      const klingV26 = getCapabilityProfile("kling", "kling-v2-6");
      const klingAlias = getCapabilityProfile("kling", "kling-2.6");
      assert.ok(klingV26);
      assert.ok(klingAlias);
      assert.equal(klingV26.modelId, klingAlias.modelId);

      // Gemini / Veo
      const veoCanonical = getCapabilityProfile("gemini", "veo-3.1-generate-preview");
      const veoAlias = getCapabilityProfile("gemini", "veo");
      assert.ok(veoCanonical);
      assert.ok(veoAlias);
      assert.equal(veoCanonical.modelId, veoAlias.modelId);

      // OpenAI
      const gptImage = getCapabilityProfile("openai", "gpt-image-1.5");
      const gptAlias = getCapabilityProfile("openai", "gpt-image");
      assert.ok(gptImage);
      assert.ok(gptAlias);
      assert.equal(gptImage.modelId, gptAlias.modelId);

      // ElevenLabs
      const eleven = getCapabilityProfile("elevenlabs", "eleven_multilingual_v2");
      const elevenAlias = getCapabilityProfile("elevenlabs", "eleven-multilingual-v2");
      assert.ok(eleven);
      assert.ok(elevenAlias);
      assert.equal(eleven.modelId, elevenAlias.modelId);
    });

    it("returns undefined for unknown providers or non-existent models", () => {
      assert.equal(getCapabilityProfile("non_existent_provider"), undefined);
      assert.equal(getCapabilityProfile("kling", "unknown-fantasy-model-v99"), undefined);
    });

    it("supports custom profile registration and overrides", () => {
      const dummyProfile: MediaCapabilityProfile = {
        providerId: "test-vendor",
        modelId: "test-model-1",
        displayName: "Test Vendor Model 1",
        modalities: ["video"],
        generationModes: ["text_to_video"],
        adapterSupported: true,
        references: { supportedTypes: ["image"], maxReferences: 1, provenance: { source: "manual" } },
        temporal: {
          supportsStartFrame: true,
          supportsEndFrame: false,
          supportsStartAndEndFrame: false,
          supportsTailFrame: false,
          supportsPreviousShotFrame: false,
          supportsVideoContinuation: false,
          supportsVideoExtension: false,
          supportsPreviousVideoAsInput: false,
          supportsLastFrameContinuation: false,
          provenance: { source: "manual" },
        },
        camera: { controlLevel: "none", provenance: { source: "manual" } },
        motion: { controlLevel: "none", provenance: { source: "manual" } },
        output: { aspectRatios: ["16:9"], provenance: { source: "manual" } },
        audio: { nativeAudioGeneration: false, provenance: { source: "manual" } },
        execution: {
          mode: "async",
          supportsPolling: true,
          supportsWebhooks: false,
          returnsTemporaryUrl: false,
          requiresDownloadBeforePersistence: false,
          provenance: { source: "manual" },
        },
        controls: { provenance: { source: "manual" } },
        limits: {},
        economics: { known: false },
      };

      registerCapabilityProfile(dummyProfile);
      const found = getCapabilityProfile("test-vendor", "test-model-1");
      assert.ok(found);
      assert.equal(found.displayName, "Test Vendor Model 1");
    });
  });

  describe("2. Runtime Model Catalog Alignment", () => {
    it("maps 100% of production media models in modelCatalog.ts to a MediaCapabilityProfile", () => {
      const mediaCapabilities = new Set<ModelCapability>(["Image Generation", "Video Generation", "Text To Speech"]);
      const mediaModels = MODEL_CATALOG.flatMap((cat) =>
        cat.models
          .filter((m) => m.capabilities.some((c) => mediaCapabilities.has(c)))
          .map((m) => ({ provider: cat.provider, ...m }))
      );

      assert.ok(mediaModels.length >= 10, "Should have production media models in catalog");

      const unmapped: string[] = [];
      for (const m of mediaModels) {
        const profile = findProfileForCatalogModel(m.provider, m.id);
        if (!profile) {
          unmapped.push(`${m.provider}::${m.id} (${m.label})`);
        }
      }

      assert.deepEqual(unmapped, [], `All production media models in catalog must have capability profiles. Unmapped: ${unmapped.join(", ")}`);
    });
  });

  describe("3. Capability Validation Rules", () => {
    it("validates duration constraints against profile supported values", () => {
      const kling = getCapabilityProfile("kling", "kling-v2-6")!;

      const validReq = buildCapabilityRequirements({
        modality: "video",
        generationMode: "image_to_video",
        output: { durationSeconds: 5 },
      });
      const validMatch = validateCapabilityRequirements(validReq, kling);
      assert.equal(validMatch.compatible, true);

      const invalidReq = buildCapabilityRequirements({
        modality: "video",
        generationMode: "image_to_video",
        output: { durationSeconds: 30 }, // Kling v2.6 max native is 10s
      });
      const invalidMatch = validateCapabilityRequirements(invalidReq, kling);
      assert.equal(invalidMatch.compatible, false);
      assert.ok(invalidMatch.reasonCodes.includes("REJECTED_UNSUPPORTED_DURATION"));
    });

    it("validates start/end frame temporal constraints", () => {
      const veo = getCapabilityProfile("gemini", "veo-3.1-generate-preview")!;

      // Veo does not support end-frame
      const endFrameReq = buildCapabilityRequirements({
        modality: "video",
        generationMode: "image_to_video",
        temporal: {
          requiresStartFrame: true,
          requiresEndFrame: true,
          requiresStartAndEnd: true,
          requiresContinuation: false,
          requiresExtension: false,
        },
      });
      const match = validateCapabilityRequirements(endFrameReq, veo);
      assert.equal(match.compatible, false);
      assert.ok(match.reasonCodes.includes("REJECTED_MISSING_END_FRAME") || match.reasonCodes.includes("REJECTED_MISSING_START_AND_END"));
    });

    it("validates reference types compatibility", () => {
      const openai = getCapabilityProfile("openai", "gpt-image-1.5")!;

      const characterRefReq = buildCapabilityRequirements({
        modality: "image",
        generationMode: "text_to_image",
        references: {
          types: ["character"],
          minimumCount: 1,
        },
      });
      const match = validateCapabilityRequirements(characterRefReq, openai);
      assert.equal(match.compatible, false);
      assert.ok(match.reasonCodes.includes("REJECTED_MISSING_REFERENCE_SUPPORT"));
    });
  });

  describe("4. Scorecard Subordination", () => {
    it("derives scorecard limits dynamically from capability profiles", () => {
      for (const scorecard of PROVIDER_GENERATION_SCORECARDS) {
        const resolved = resolveScorecardLimits(scorecard.providerId);
        if (scorecard.providerId !== "openai" && scorecard.providerId !== "elevenlabs") {
          assert.ok(resolved.maxNativeSec > 0, `Provider ${scorecard.providerId} should have positive maxNativeSec`);
          assert.ok(resolved.allowedDurationsSec.length > 0, `Provider ${scorecard.providerId} should have allowed durations`);
        }
        assert.ok(resolved.maxMultimodalReferences >= 0, `Provider ${scorecard.providerId} should have non-negative maxMultimodalReferences`);
      }
    });
  });

  describe("5. Pre-Execution Validation Guard", () => {
    it("assertExecutableCapability fails closed on impossible requests", () => {
      // 1. Impossible duration
      const badDurationReq: CapabilityRequirements = {
        modality: "video",
        generationMode: "image_to_video",
        output: { durationSeconds: 45 },
      };
      const durationCheck = assertExecutableCapability(badDurationReq, "kling");
      assert.equal(durationCheck.ok, false);
      if (!durationCheck.ok) {
        assert.ok(durationCheck.decision.reasonCodes.some((r) => r.startsWith("REJECTED")));
      }

      // 2. Impossible modality (OpenAI does not generate video)
      const badModalityReq: CapabilityRequirements = {
        modality: "video",
        generationMode: "text_to_video",
      };
      const modalityCheck = assertExecutableCapability(badModalityReq, "openai");
      assert.equal(modalityCheck.ok, false);
      if (!modalityCheck.ok) {
        assert.ok(modalityCheck.decision.reasonCodes.includes("REJECTED_UNSUPPORTED_MODE"));
      }

      // 3. Disabled provider (Runway adapterSupported: false)
      const disabledReq: CapabilityRequirements = {
        modality: "video",
        generationMode: "text_to_video",
      };
      const disabledCheck = assertExecutableCapability(disabledReq, "runway");
      assert.equal(disabledCheck.ok, false);
    });

    it("fails closed inside GenerationExecutionEngine before calling adapter for impossible task", async () => {
      const plan = createProductionPlan({ idea: "Fast sports clip", targetDurationSec: 10 });
      const tasks = planGenerationTasks(plan.spec!);
      const videoTask = tasks.find((t) => t.kind === "video")!;

      // Deliberately configure an impossible request: 60-second video on kling
      const impossibleTask = {
        ...videoTask,
        durationSec: 60,
        maxRetries: 1,
        fallbackProviders: [],
        dependsOn: [],
        dependencies: [],
      };

      let submitCalled = false;
      const ports = {
        submitVideo: async () => {
          submitCalled = true;
          return { videoUrl: "https://example.com/test.mp4", providerJobId: "job_1", provider: "kling" };
        },
      };

      const engine = new GenerationExecutionEngine({
        ports,
        sleep: async () => undefined,
      });

      const result = await engine.executePlan({
        spec: plan.spec!,
        tasks: [{ ...impossibleTask, status: "ready" as any }],
        dag: {
          productionId: plan.spec!.project.id,
          nodes: [{ id: impossibleTask.id, kind: "video", dependsOn: [], status: "ready" }],
        },
      });

      assert.equal(submitCalled, false, "Remote adapter submit must NEVER be called when capability validation fails");
      assert.equal(result.tasks[0].status, "failed");
      assert.ok(result.tasks[0].lastError?.includes("Capability validation failed"));
    });
  });

  describe("6. Research Registry Isolation", () => {
    it("ensures Research CapabilityRegistry remains independent and functional", () => {
      ResearchCapabilityRegistry.initialize();
      const cap = ResearchCapabilityRegistry.getCapability("video-understanding-provider");
      assert.ok(cap, "Research capability should exist in research registry");
      assert.equal(cap?.category, "Research");
    });
  });

  describe("7. Provenance & Invariants", () => {
    it("verifies all registered capability profiles preserve audit provenance", () => {
      const profiles = listCapabilityProfiles();
      assert.ok(profiles.length >= 10);
      for (const p of profiles) {
        assert.ok(p.providerId, "Profile must have providerId");
        assert.ok(p.modelId, "Profile must have modelId");
        assert.ok(p.references.provenance, `Profile ${p.providerId}::${p.modelId} must have references provenance`);
        assert.ok(p.temporal.provenance, `Profile ${p.providerId}::${p.modelId} must have temporal provenance`);
        assert.ok(p.output.provenance, `Profile ${p.providerId}::${p.modelId} must have output provenance`);
      }
    });
  });
});
