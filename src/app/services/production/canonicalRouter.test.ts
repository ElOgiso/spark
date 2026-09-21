/**
 * SPARK — PHASE 6
 * Canonical Model Router & Router Consolidation Tests
 *
 * Verifies:
 * 1. Single authoritative canonical routing contract (resolveCanonicalModel & routeMediaCapability)
 * 2. Two-stage architecture: Hard Capability Filtering before Soft Scoring
 * 3. Modalities: I2V, R2V, T2V, Image, Audio/Voice
 * 4. Production Modes: Economy, Balanced, Cinematic, Maximum
 * 5. Priorities: Hero vs Supporting
 * 6. Provider preferences & hard exclusions
 * 7. Determinism: stable tie-breaking with zero randomness
 * 8. Fail-closed: explicit failure when no eligible candidate exists
 * 9. ModelRouter compatibility facade delegation
 * 10. Downstream Phase 5.2 validation boundary execution
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  routeMediaCapability,
  resolveCanonicalModel,
  normalizeRoutingIntentToRequirements,
  assertVideoRequestExecutable,
  MEDIA_CAPABILITY_PROFILES,
  type RoutingIntent,
  type CapabilityRequirements,
} from "./capability";
import { ModelRouter } from "../runtime/modelRouter";

describe("SPARK Phase 6 — Canonical Router Consolidation", () => {
  describe("1. Authoritative Routing Contract", () => {
    it("resolveCanonicalModel returns explicit providerId, modelId, and explanation reasons", () => {
      const intent: RoutingIntent = {
        modality: "video",
        generationMode: "image_to_video",
        temporal: { requiresStartFrame: true },
        output: { durationSeconds: 5, aspectRatio: "16:9" },
      };

      const resolved = resolveCanonicalModel(intent);
      assert.ok(resolved.providerId, "resolved must have providerId");
      assert.ok(resolved.modelId, "resolved must have modelId");
      assert.ok(typeof resolved.score === "number", "resolved must have score");
      assert.ok(resolved.reasons?.capabilityFit, "resolved must have capabilityFit reasons");
      assert.ok(resolved.reasonCodes.includes("CAPABILITY_MATCH"));
      assert.ok(resolved.decision.selected, "decision must include selected candidate");
      assert.equal(resolved.decision.resolvedModel?.modelId, resolved.modelId);
    });

    it("normalizes RoutingIntent to CapabilityRequirements correctly", () => {
      const intent: RoutingIntent = {
        modality: "video",
        productionMode: "Cinematic",
        priority: "hero",
        excludedProviderIds: ["bad_provider"],
        output: { durationSeconds: 6, aspectRatio: "9:16" },
      };
      const req = normalizeRoutingIntentToRequirements(intent);
      assert.equal(req.modality, "video");
      assert.equal(req.preferences?.productionMode, "Cinematic");
      assert.equal(req.preferences?.priority, "hero");
      assert.deepEqual(req.preferences?.excludedProviderIds, ["bad_provider"]);
      assert.equal(req.output?.durationSeconds, 6);
    });
  });

  describe("2. Stage 1 — Hard Capability Filtering", () => {
    it("unsupported model never wins regardless of preference", () => {
      // Grok does not support last-frame (start+end) conditioning
      const req: CapabilityRequirements = {
        modality: "video",
        generationMode: "image_to_video",
        temporal: {
          requiresStartFrame: true,
          requiresEndFrame: true,
          requiresStartAndEnd: true,
        },
        output: { durationSeconds: 5, aspectRatio: "16:9" },
        preferences: {
          preferredProviderId: "grok", // User explicitly prefers Grok
        },
      };

      const decision = routeMediaCapability(req);
      assert.ok(decision.selected, "should select an eligible candidate");
      assert.notEqual(decision.selected?.providerId, "grok", "grok must be filtered out due to end frame requirement");
      // Verify grok was rejected in hard filtering
      const grokRejection = decision.rejected.find((r) => r.candidate.providerId === "grok");
      assert.ok(grokRejection, "grok must be in rejected candidates list");
      assert.ok(
        grokRejection!.reasonCodes.some((code) =>
          ["REJECTED_MISSING_END_FRAME", "REJECTED_MISSING_START_AND_END"].includes(code)
        )
      );
    });

    it("rejects unsupported duration strictly", () => {
      // 100 seconds is beyond any single-shot provider limit
      const intent: RoutingIntent = {
        modality: "video",
        generationMode: "image_to_video",
        temporal: { requiresStartFrame: true },
        output: { durationSeconds: 100, aspectRatio: "16:9" },
      };

      const decision = routeMediaCapability(intent);
      assert.equal(decision.selected, undefined, "no model supports 100s single-shot duration");
      assert.ok(decision.reasonCodes.includes("NO_COMPATIBLE_CANDIDATE"));
      assert.throws(
        () => resolveCanonicalModel(intent),
        /Canonical Model Routing failed/
      );
    });
  });

  describe("3. Modality Routing", () => {
    it("routes I2V (image-to-video)", () => {
      const decision = routeMediaCapability({
        modality: "video",
        generationMode: "image_to_video",
        temporal: { requiresStartFrame: true },
        output: { durationSeconds: 5, aspectRatio: "16:9" },
      });
      assert.ok(decision.selected);
      assert.ok(decision.selected!.effective.generationModes.includes("image_to_video"));
    });

    it("routes R2V (reference-to-video) explicitly", () => {
      const decision = routeMediaCapability({
        modality: "video",
        generationMode: "image_to_video",
        references: {
          types: ["character", "style"],
          minimumCount: 2,
        },
        temporal: { requiresStartFrame: true },
        output: { durationSeconds: 5, aspectRatio: "16:9" },
      });
      assert.ok(decision.selected);
      assert.ok(decision.selected!.effective.references.supportsMultipleReferences);
    });

    it("routes Text-to-Video", () => {
      const decision = routeMediaCapability({
        modality: "video",
        generationMode: "text_to_video",
        output: { durationSeconds: 6, aspectRatio: "16:9" },
      });
      assert.ok(decision.selected);
      assert.ok(decision.selected!.effective.generationModes.includes("text_to_video"));
    });

    it("routes Image Generation", () => {
      const decision = routeMediaCapability({
        modality: "image",
        generationMode: "text_to_image",
        output: { aspectRatio: "1:1" },
      });
      assert.ok(decision.selected);
      assert.ok(decision.selected!.effective.modalities.includes("image"));
    });
  });

  describe("4. Production Modes & Objective Biases", () => {
    it("Economy mode biases toward lower cost and reliability", () => {
      const decision = routeMediaCapability({
        modality: "video",
        generationMode: "image_to_video",
        temporal: { requiresStartFrame: true },
        output: { durationSeconds: 5, aspectRatio: "16:9" },
        productionMode: "Economy",
      });
      assert.ok(decision.selected);
      assert.ok(decision.reasonCodes.includes("PRODUCTION_MODE_ECONOMY"));
    });

    it("Cinematic mode biases toward high quality and consistency", () => {
      const decision = routeMediaCapability({
        modality: "video",
        generationMode: "image_to_video",
        temporal: { requiresStartFrame: true },
        output: { durationSeconds: 5, aspectRatio: "16:9" },
        productionMode: "Cinematic",
      });
      assert.ok(decision.selected);
      assert.ok(decision.reasonCodes.includes("PRODUCTION_MODE_CINEMATIC"));
    });

    it("Maximum mode biases toward highest quality floor", () => {
      const decision = routeMediaCapability({
        modality: "video",
        generationMode: "image_to_video",
        temporal: { requiresStartFrame: true },
        output: { durationSeconds: 5, aspectRatio: "16:9" },
        productionMode: "Maximum",
      });
      assert.ok(decision.selected);
      assert.ok(decision.reasonCodes.includes("PRODUCTION_MODE_MAXIMUM"));
    });
  });

  describe("5. Hero vs Supporting Content Priority", () => {
    it("Hero priority boosts quality weighting", () => {
      const heroDecision = routeMediaCapability({
        modality: "video",
        generationMode: "image_to_video",
        temporal: { requiresStartFrame: true },
        output: { durationSeconds: 5, aspectRatio: "16:9" },
        priority: "hero",
      });
      assert.ok(heroDecision.selected);
      assert.ok(heroDecision.reasonCodes.includes("PRIORITY_HERO"));
    });

    it("Supporting priority applies cost and speed bias", () => {
      const supportingDecision = routeMediaCapability({
        modality: "video",
        generationMode: "image_to_video",
        temporal: { requiresStartFrame: true },
        output: { durationSeconds: 5, aspectRatio: "16:9" },
        priority: "supporting",
      });
      assert.ok(supportingDecision.selected);
      assert.ok(supportingDecision.reasonCodes.includes("PRIORITY_SUPPORTING"));
    });
  });

  describe("6. Exclusions and Constraints", () => {
    it("excludedProviderIds prevents excluded provider from winning", () => {
      const normalDecision = routeMediaCapability({
        modality: "video",
        generationMode: "image_to_video",
        temporal: { requiresStartFrame: true },
        output: { durationSeconds: 5, aspectRatio: "16:9" },
      });
      const topProvider = normalDecision.selected!.providerId;

      // Exclude topProvider
      const excludedDecision = routeMediaCapability({
        modality: "video",
        generationMode: "image_to_video",
        temporal: { requiresStartFrame: true },
        output: { durationSeconds: 5, aspectRatio: "16:9" },
        excludedProviderIds: [topProvider],
      });

      assert.ok(excludedDecision.selected);
      assert.notEqual(excludedDecision.selected!.providerId, topProvider);
      assert.ok(
        excludedDecision.rejected.some(
          (r) => r.candidate.providerId === topProvider && r.reasonCodes.includes("REJECTED_EXCLUDED_PROVIDER")
        )
      );
    });

    it("excludedModelIds prevents excluded model from winning", () => {
      const normalDecision = routeMediaCapability({
        modality: "video",
        generationMode: "image_to_video",
        temporal: { requiresStartFrame: true },
        output: { durationSeconds: 5, aspectRatio: "16:9" },
      });
      const topModel = normalDecision.selected!.modelId;

      const excludedDecision = routeMediaCapability({
        modality: "video",
        generationMode: "image_to_video",
        temporal: { requiresStartFrame: true },
        output: { durationSeconds: 5, aspectRatio: "16:9" },
        excludedModelIds: [topModel],
      });

      assert.ok(excludedDecision.selected);
      assert.notEqual(excludedDecision.selected!.modelId, topModel);
      assert.ok(
        excludedDecision.rejected.some(
          (r) => r.candidate.modelId === topModel && r.reasonCodes.includes("REJECTED_EXCLUDED_MODEL")
        )
      );
    });

    it("budget ceiling rejects models that exceed maxProviderCost", () => {
      // In Phase 6, default catalog profiles have unknown economics (Phase 7 handles authoritative costs).
      // When candidates have known economics exceeding maxProviderCost, router hard rejects them.
      const customCandidate = {
        ...MEDIA_CAPABILITY_PROFILES[0],
        effective: MEDIA_CAPABILITY_PROFILES[0],
        economics: { known: true, estimatedUsdPerGeneration: 1.5 },
      };

      const overBudgetDecision = routeMediaCapability(
        {
          modality: "video",
          generationMode: "image_to_video",
          temporal: { requiresStartFrame: true },
          output: { durationSeconds: 5, aspectRatio: "16:9" },
          budget: { maxProviderCost: 0.1 },
        },
        { candidates: [customCandidate] }
      );

      // Any model with known economics > 0.10 should be rejected with REJECTED_BUDGET_EXCEEDED
      const budgetRejections = overBudgetDecision.rejected.filter((r) =>
        r.reasonCodes.includes("REJECTED_BUDGET_EXCEEDED")
      );
      assert.ok(budgetRejections.length > 0, "must reject models exceeding maxProviderCost");
      assert.equal(overBudgetDecision.selected, undefined);
    });
  });

  describe("7. Determinism & Tie-Breaking", () => {
    it("produces strictly identical results for repeated calls with identical intent", () => {
      const intent: RoutingIntent = {
        modality: "video",
        generationMode: "image_to_video",
        temporal: { requiresStartFrame: true },
        output: { durationSeconds: 5, aspectRatio: "16:9" },
        productionMode: "Balanced",
      };

      const results = Array.from({ length: 10 }, () => resolveCanonicalModel(intent));
      const first = results[0];
      for (let i = 1; i < results.length; i++) {
        assert.equal(results[i].providerId, first.providerId);
        assert.equal(results[i].modelId, first.modelId);
        assert.equal(results[i].score, first.score);
      }
    });
  });

  describe("8. ModelRouter Facade Integration", () => {
    it("ModelRouter.resolveProvider delegates to canonical router for media categories", () => {
      const videoProvider = ModelRouter.resolveProvider("videoGeneration");
      assert.ok(["gemini", "kling", "seedance", "grok", "runway", "luma", "higgsfield"].includes(videoProvider));

      const imgProvider = ModelRouter.resolveProvider("storyboardImages");
      assert.ok(["openai", "gemini", "grok", "kling"].includes(imgProvider));
    });

    it("ModelRouter.resolveModel delegates to canonical router for media categories", () => {
      const klingModel = ModelRouter.resolveModel("videoGeneration", "kling");
      assert.equal(klingModel, "kling-v2-6");

      const seedanceModel = ModelRouter.resolveModel("videoGeneration", "seedance");
      assert.ok(seedanceModel.length > 0);
    });
  });

  describe("9. Phase 5.2 Validation Boundary", () => {
    it("canonical resolved model passes assertVideoRequestExecutable fail-closed check", () => {
      const resolved = resolveCanonicalModel({
        modality: "video",
        generationMode: "image_to_video",
        temporal: { requiresStartFrame: true },
        output: { durationSeconds: 5, aspectRatio: "16:9" },
        preferences: { preferredProviderId: "kling" },
      });

      assert.equal(resolved.providerId, "kling");
      assert.equal(resolved.modelId, "kling-v2-6");

      const validation = assertVideoRequestExecutable({
        provider: resolved.providerId,
        model: resolved.modelId,
        firstFrameUrl: "https://example.com/valid_frame.jpg",
        durationSec: 5,
        aspectRatio: "16:9",
      });

      assert.equal(validation.ok, true);
      assert.equal(validation.profile?.providerId, "kling");
      assert.equal(validation.profile?.modelId, "kling-v2-6");
    });
  });
});
