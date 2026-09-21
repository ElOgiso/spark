/**
 * SPARK — PHASE 7
 * Cost Engine & Economic Optimization Tests
 *
 * Verifies:
 * 1. Exact pricing for known models/configurations
 * 2. Configuration-sensitive pricing (duration, resolution, audio)
 * 3. Unknown pricing fails safely (status="UNKNOWN", amount=null, never 0)
 * 4. Budget rejection when cost > maxProviderCost
 * 5. Budget acceptance when cost <= maxProviderCost
 * 6. Unknown budget behavior fails safe (never assumes free)
 * 7. Estimate vs actual cost separation
 * 8. Retry accumulation (multiple attempts sum correctly)
 * 9. Unknown submission handling (timeout/unknown preserves unknown cost)
 * 10. Deterministic calculation
 * 11. Pricing provenance tracking
 * 12. Canonical router integration
 * 13. Legacy ModelRouter facade compatibility
 * 14. No credit mutation (Phase 8 boundary strictly preserved)
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  CostEngine,
  PricingRegistry,
  type CostEstimationRequest,
  type ActualCostCalculationRequest,
  type AttemptCostRecord,
} from "./economics";
import {
  routeMediaCapability,
  resolveCanonicalModel,
  type CapabilityRequirements,
} from "./capability";
import { ModelRouter } from "../runtime/modelRouter";

describe("SPARK Phase 7 — Cost Engine & Economic Optimization", () => {
  beforeEach(() => {
    PricingRegistry.reset();
  });

  describe("1. Exact Pricing", () => {
    it("returns exact expected cost for known provider/model configuration", () => {
      // Kling 1.6 video: $0.07/sec * 5s = $0.35
      const req: CostEstimationRequest = {
        providerId: "kling",
        modelId: "kling-v1-6",
        modality: "video",
        durationSeconds: 5,
        resolution: "720p",
      };

      const est = CostEngine.estimateCost(req);
      assert.equal(est.status, "EXACT");
      assert.equal(est.amount, 0.35);
      assert.equal(est.currency, "USD");
      assert.equal(est.unit, "per_second");
      assert.equal(est.quantity, 5);
      assert.equal(est.breakdown?.baseAmount, 0.35);
    });

    it("returns exact expected cost for image generation", () => {
      // Grok imagine: $0.05 per image * 2 images = $0.10
      const req: CostEstimationRequest = {
        providerId: "grok",
        modelId: "grok-imagine",
        modality: "image",
        imageCount: 2,
      };

      const est = CostEngine.estimateCost(req);
      assert.equal(est.status, "EXACT");
      assert.equal(est.amount, 0.10);
      assert.equal(est.unit, "per_image");
      assert.equal(est.quantity, 2);
    });

    it("returns exact expected cost for audio generation", () => {
      // OpenAI tts-1: $0.015 / 1k chars * 2,000 chars = $0.03
      const req: CostEstimationRequest = {
        providerId: "openai",
        modelId: "tts-1",
        modality: "audio",
        characterCount: 2000,
      };

      const est = CostEngine.estimateCost(req);
      assert.equal(est.status, "EXACT");
      assert.equal(est.amount, 0.03);
      assert.equal(est.unit, "per_character");
      assert.equal(est.quantity, 2000);
    });
  });

  describe("2. Configuration-Sensitive Pricing", () => {
    it("scales cost based on duration", () => {
      const est5s = CostEngine.estimateCost({
        providerId: "kling",
        modelId: "kling-v1-6",
        modality: "video",
        durationSeconds: 5,
      });
      const est10s = CostEngine.estimateCost({
        providerId: "kling",
        modelId: "kling-v1-6",
        modality: "video",
        durationSeconds: 10,
      });

      assert.equal(est5s.amount, 0.35);
      assert.equal(est10s.amount, 0.70);
      assert.ok(est10s.amount! > est5s.amount!);
    });

    it("applies resolution multiplier for higher definition", () => {
      const est720p = CostEngine.estimateCost({
        providerId: "kling",
        modelId: "kling-v1-6",
        modality: "video",
        durationSeconds: 5,
        resolution: "720p",
      });
      const est1080p = CostEngine.estimateCost({
        providerId: "kling",
        modelId: "kling-v1-6",
        modality: "video",
        durationSeconds: 5,
        resolution: "1080p",
      });

      // 720p = $0.35, 1080p = 1.5x = $0.525
      assert.equal(est720p.amount, 0.35);
      assert.equal(est1080p.amount, 0.525);
      assert.equal(est1080p.breakdown?.resolutionModifier, 0.175);
    });

    it("applies audio add-on when requested", () => {
      const withoutAudio = CostEngine.estimateCost({
        providerId: "kling",
        modelId: "kling-v1-6",
        modality: "video",
        durationSeconds: 5,
        includeAudio: false,
      });
      const withAudio = CostEngine.estimateCost({
        providerId: "kling",
        modelId: "kling-v1-6",
        modality: "video",
        durationSeconds: 5,
        includeAudio: true,
      });

      // base $0.35 + audio $0.05 = $0.40
      assert.equal(withoutAudio.amount, 0.35);
      assert.equal(withAudio.amount, 0.40);
      assert.equal(withAudio.breakdown?.audioCost, 0.05);
    });
  });

  describe("3. Unknown Pricing", () => {
    it("returns status UNKNOWN and amount null for uncataloged provider/model", () => {
      const est = CostEngine.estimateCost({
        providerId: "unknown_vendor",
        modelId: "fantasy-ai-9000",
        modality: "video",
      });

      assert.equal(est.status, "UNKNOWN");
      assert.equal(est.amount, null);
      assert.notEqual(est.amount, 0, "Unknown cost must NEVER be zero");
      assert.equal(est.pricingSource.sourceType, "UNKNOWN");
    });
  });

  describe("4. Budget Rejection", () => {
    it("rejects candidate whose cost exceeds maxProviderCost", () => {
      const est = CostEngine.estimateCost({
        providerId: "kling",
        modelId: "kling-v1-6",
        modality: "video",
        durationSeconds: 10, // $0.70
      });

      const budget = CostEngine.evaluateBudget(est, 0.50);
      assert.equal(budget.approved, false);
      assert.equal(budget.reason, "EXCEEDS_BUDGET");
      assert.equal(budget.estimatedCost, 0.70);
    });
  });

  describe("5. Budget Acceptance", () => {
    it("approves candidate whose cost is within maxProviderCost", () => {
      const est = CostEngine.estimateCost({
        providerId: "kling",
        modelId: "kling-v1-6",
        modality: "video",
        durationSeconds: 5, // $0.35
      });

      const budget = CostEngine.evaluateBudget(est, 0.50);
      assert.equal(budget.approved, true);
      assert.equal(budget.reason, "UNDER_BUDGET");
      assert.equal(budget.estimatedCost, 0.35);
    });
  });

  describe("6. Unknown Budget Behavior", () => {
    it("unknown cost is rejected from budget check and never treated as free", () => {
      const est = CostEngine.estimateCost({
        providerId: "unregistered_provider",
        modelId: "unregistered_model",
        modality: "video",
      });

      const budget = CostEngine.evaluateBudget(est, 1.00);
      assert.equal(budget.approved, false, "Unknown cost must fail budget check");
      assert.equal(budget.reason, "UNKNOWN_COST");
      assert.equal(budget.costStatus, "UNKNOWN");
      assert.equal(budget.estimatedCost, null);
    });
  });

  describe("7. Estimate vs Actual Cost Separation", () => {
    it("maintains distinct estimate and actual cost structures with reported usage", () => {
      // Pre-flight estimate for 5s video
      const est = CostEngine.estimateCost({
        providerId: "kling",
        modelId: "kling-v1-6",
        modality: "video",
        durationSeconds: 5,
      });

      // Actual post-flight job returned 6 seconds billed
      const actualReq: ActualCostCalculationRequest = {
        providerId: "kling",
        modelId: "kling-v1-6",
        modality: "video",
        submissionState: "succeeded",
        usage: { billedDurationSeconds: 6 },
        estimateId: "est-12345",
      };
      const actual = CostEngine.calculateActualCost(actualReq);

      assert.equal(est.amount, 0.35);
      assert.equal(actual.amount, 0.42); // $0.07 * 6s
      assert.equal(actual.estimateId, "est-12345");
      assert.notEqual(est.amount, actual.amount, "Estimate and actual must reflect reality separately");
    });
  });

  describe("8. Retry Accumulation", () => {
    it("accumulates costs across multiple paid attempts", () => {
      const attempts: AttemptCostRecord[] = [
        {
          attemptIndex: 1,
          providerJobId: "job-1",
          status: "failed",
          amount: 0.35,
          costStatus: "EXACT",
          currency: "USD",
          timestamp: new Date().toISOString(),
        },
        {
          attemptIndex: 2,
          providerJobId: "job-2",
          status: "succeeded",
          amount: 0.35,
          costStatus: "EXACT",
          currency: "USD",
          timestamp: new Date().toISOString(),
        },
      ];

      const acc = CostEngine.accumulateAttemptCosts(attempts);
      assert.equal(acc.costStatus, "EXACT");
      assert.equal(acc.totalCostUsd, 0.70, "Attempt 1 ($0.35) + Attempt 2 ($0.35) = $0.70");
      assert.equal(acc.attempts.length, 2);
    });
  });

  describe("9. Unknown Submission Handling", () => {
    it("unknown or timed out submission does not produce false zero cost", () => {
      const req: ActualCostCalculationRequest = {
        providerId: "kling",
        modelId: "kling-v1-6",
        modality: "video",
        submissionState: "timeout",
      };

      const actual = CostEngine.calculateActualCost(req);
      assert.equal(actual.status, "UNKNOWN");
      assert.equal(actual.amount, null);
      assert.notEqual(actual.amount, 0, "Timed out submission must not assume $0.00");
    });

    it("attempt accumulation reflects UNKNOWN if any attempt timed out or outcome is unconfirmed", () => {
      const attempts: AttemptCostRecord[] = [
        {
          attemptIndex: 1,
          status: "timeout",
          amount: null,
          costStatus: "UNKNOWN",
          currency: "USD",
          timestamp: new Date().toISOString(),
        },
        {
          attemptIndex: 2,
          status: "succeeded",
          amount: 0.35,
          costStatus: "EXACT",
          currency: "USD",
          timestamp: new Date().toISOString(),
        },
      ];

      const acc = CostEngine.accumulateAttemptCosts(attempts);
      assert.equal(acc.costStatus, "UNKNOWN");
      assert.equal(acc.totalCostUsd, null, "Total cost cannot be definitively known when an attempt is unconfirmed");
    });
  });

  describe("10. Deterministic Calculation", () => {
    it("produces identical estimates across 20 iterations without randomness", () => {
      const req: CostEstimationRequest = {
        providerId: "kling",
        modelId: "kling-v1-6",
        modality: "video",
        durationSeconds: 5,
        resolution: "1080p",
        includeAudio: true,
      };

      const first = CostEngine.estimateCost(req);
      for (let i = 0; i < 20; i++) {
        const est = CostEngine.estimateCost(req);
        assert.deepEqual(est, first, "Cost estimation must be strictly deterministic");
      }
    });
  });

  describe("11. Pricing Provenance Tracking", () => {
    it("preserves provenance data on pricing rule and estimate", () => {
      const est = CostEngine.estimateCost({
        providerId: "openai",
        modelId: "dall-e-3",
        modality: "image",
      });

      assert.equal(est.pricingSource.source, "OpenAI Pricing Page");
      assert.equal(est.pricingSource.sourceType, "OFFICIAL_PROVIDER");
      assert.equal(est.pricingSource.confidence, 1.0);
      assert.ok(est.pricingSource.verifiedAt);
    });
  });

  describe("12. Router Integration", () => {
    it("canonical router attaches estimatedCost without owning pricing tables", () => {
      const intent = {
        modality: "video" as const,
        generationMode: "image_to_video" as const,
        temporal: { requiresStartFrame: true },
        output: { durationSeconds: 5, aspectRatio: "16:9" },
        preferences: { preferredProviderId: "kling", preferredModelId: "kling-v1-6" },
      };

      const resolved = resolveCanonicalModel(intent);
      assert.equal(resolved.providerId, "kling");
      assert.equal(resolved.modelId, "kling-v1-6");
      // CostEngine was consulted and estimatedCost attached
      assert.equal(resolved.estimatedCost, 0.35);
    });

    it("router enforces budget.maxProviderCost rejection using CostEngine", () => {
      // kling-v1-6 10s costs $0.70. With budget 0.50, candidate exceeding budget is rejected.
      const decision = routeMediaCapability({
        modality: "video",
        generationMode: "image_to_video",
        temporal: { requiresStartFrame: true, durationSeconds: 10 },
        output: { durationSeconds: 10, aspectRatio: "16:9" },
        preferences: {
          preferredProviderId: "kling",
          preferredModelId: "kling-v1-6",
          budget: { maxProviderCost: 0.50 },
        },
      });

      // Either another candidate is selected or kling-v1-6 is rejected for budget
      const rejectedForBudget = decision.rejected.find(
        (r) => r.candidate.modelId === "kling-v1-6" && r.reasonCodes.includes("REJECTED_BUDGET_EXCEEDED")
      );
      assert.ok(rejectedForBudget, "kling-v1-6 must be rejected when duration=10s exceeds budget=$0.50");
    });
  });

  describe("13. Legacy Facade Compatibility", () => {
    it("ModelRouter facade resolves media without mutating or owning pricing", () => {
      const videoConfig = ModelRouter.getDefaultRoutingConfig();
      assert.equal(videoConfig.storyboardImages, "openai");
      assert.equal(videoConfig.videoGeneration, "gemini");
      assert.equal(videoConfig.voice, "auto");

      // Verify ModelRouter does not expose pricing calculations
      assert.equal(typeof (ModelRouter as any).estimateCost, "undefined");
      assert.equal(typeof (ModelRouter as any).pricingTable, "undefined");
    });
  });

  describe("14. No Credit Mutation (Phase 8 Boundary)", () => {
    it("CostEngine operations never deduct or mutate user credit balances or ledgers", () => {
      // Pure cost estimation
      const est = CostEngine.estimateCost({
        providerId: "kling",
        modelId: "kling-v1-6",
        modality: "video",
        durationSeconds: 5,
      });
      assert.ok(est.amount);

      // Actual cost calculation
      const actual = CostEngine.calculateActualCost({
        providerId: "kling",
        modelId: "kling-v1-6",
        modality: "video",
        submissionState: "succeeded",
        usage: { durationSeconds: 5 },
      });
      assert.ok(actual.amount);

      // Verification: CostEngine contains zero credit balance or ledger methods
      assert.equal(typeof (CostEngine as any).deductCredits, "undefined");
      assert.equal(typeof (CostEngine as any).reserveCredits, "undefined");
      assert.equal(typeof (CostEngine as any).settleCredits, "undefined");
      assert.equal(typeof (CostEngine as any).updateUserBalance, "undefined");
    });
  });
});
