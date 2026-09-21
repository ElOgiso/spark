/**
 * SPARK Phase 7 — Canonical Cost Engine.
 *
 * Single authoritative source for provider/model/configuration pre-flight cost estimation,
 * post-flight actual usage cost accounting, retry accumulation, and budget compliance evaluation.
 *
 * Invariants:
 * 1. Unknown economics must NEVER look free (status="UNKNOWN", amount=null).
 * 2. Pure determinism — no Math.random(), no Date.now() in calculations.
 * 3. Preserves distinction between estimated and actual costs.
 * 4. Accumulates multi-attempt costs safely without false zeroes.
 * 5. Strict separation from Spark Credits (Phase 8).
 */

import type {
  CostEstimationRequest,
  CostEstimate,
  ActualCostCalculationRequest,
  ActualProviderCost,
  AttemptCostRecord,
  BudgetEvaluationResult,
  CostStatus,
  CostBreakdown,
  PricingRule,
} from "./types";
import { PricingRegistry } from "./pricingRegistry";

export class CostEngine {
  /**
   * Pre-flight cost estimation.
   * Calculates the expected provider cost based on request configuration and pricing registry rules.
   */
  static estimateCost(req: CostEstimationRequest): CostEstimate {
    const rule = PricingRegistry.getPricingRule(req.providerId, req.modelId);

    if (!rule) {
      return {
        providerId: req.providerId,
        modelId: req.modelId,
        modality: req.modality,
        currency: "USD",
        amount: null,
        unit: "per_generation",
        quantity: 1,
        status: "UNKNOWN",
        pricingVersion: "unknown",
        pricingSource: {
          source: "unknown",
          sourceType: "UNKNOWN",
          confidence: 0,
          notes: `No authoritative pricing rule found for provider="${req.providerId}" model="${req.modelId}"`,
        },
      };
    }

    return CostEngine.computeFromRule(rule, req);
  }

  /**
   * Post-execution actual cost calculation.
   * Derives actual provider cost based on reported usage and execution outcome.
   */
  static calculateActualCost(req: ActualCostCalculationRequest): ActualProviderCost {
    // Unknown or timeout submission: preserve fail-safe unknown status.
    // Provider might have billed, so amount cannot safely be assumed $0.00.
    if (req.submissionState === "timeout" || req.submissionState === "unknown") {
      const rule = PricingRegistry.getPricingRule(req.providerId, req.modelId);
      return {
        providerId: req.providerId,
        modelId: req.modelId,
        modality: req.modality,
        currency: "USD",
        amount: null,
        status: "UNKNOWN",
        pricingVersion: rule?.pricingVersion ?? "unknown",
        pricingSource: rule?.provenance ?? {
          source: "unknown",
          sourceType: "UNKNOWN",
          confidence: 0,
          notes: "Provider submission outcome unknown or timed out",
        },
        estimateId: req.estimateId,
      };
    }

    // Explicitly failed without provider execution / billable units
    if (req.submissionState === "failed") {
      const billedUnits =
        req.usage?.billedDurationSeconds ??
        req.usage?.inputTokens ??
        req.usage?.outputTokens ??
        0;

      if (billedUnits === 0) {
        const rule = PricingRegistry.getPricingRule(req.providerId, req.modelId);
        return {
          providerId: req.providerId,
          modelId: req.modelId,
          modality: req.modality,
          currency: "USD",
          amount: 0,
          status: "EXACT",
          pricingVersion: rule?.pricingVersion ?? "unknown",
          pricingSource: rule?.provenance ?? {
            source: "execution_failure",
            sourceType: "OFFICIAL_PROVIDER",
            confidence: 1.0,
            notes: "Zero provider charges due to pre-execution failure",
          },
          breakdown: { baseAmount: 0 },
          usage: req.usage,
          estimateId: req.estimateId,
        };
      }
    }

    // Succeeded or billed failure: evaluate actual usage
    const rule = PricingRegistry.getPricingRule(req.providerId, req.modelId);
    if (!rule) {
      return {
        providerId: req.providerId,
        modelId: req.modelId,
        modality: req.modality,
        currency: "USD",
        amount: null,
        status: "UNKNOWN",
        pricingVersion: "unknown",
        pricingSource: {
          source: "unknown",
          sourceType: "UNKNOWN",
          confidence: 0,
          notes: `No pricing rule found for actual usage calculation (${req.providerId}/${req.modelId})`,
        },
        usage: req.usage,
        estimateId: req.estimateId,
      };
    }

    const config: CostEstimationRequest = {
      providerId: req.providerId,
      modelId: req.modelId,
      modality: req.modality,
      durationSeconds: req.usage?.billedDurationSeconds ?? req.usage?.durationSeconds ?? req.requestConfig?.durationSeconds,
      resolution: req.usage?.resolution ?? req.requestConfig?.resolution,
      aspectRatio: req.requestConfig?.aspectRatio,
      includeAudio: req.requestConfig?.includeAudio,
      characterCount: req.usage?.characterCount ?? req.requestConfig?.characterCount,
      imageCount: req.usage?.imageCount ?? req.requestConfig?.imageCount,
      configuration: req.requestConfig?.configuration,
    };

    const estimate = CostEngine.computeFromRule(rule, config);

    return {
      providerId: req.providerId,
      modelId: req.modelId,
      modality: req.modality,
      currency: "USD",
      amount: estimate.amount,
      status: estimate.status,
      pricingVersion: estimate.pricingVersion,
      pricingSource: estimate.pricingSource,
      breakdown: estimate.breakdown,
      usage: req.usage,
      estimateId: req.estimateId,
    };
  }

  /**
   * Accumulate costs across multiple attempts (e.g. retries).
   * E.g. attempt 1 $1.00 + attempt 2 $1.00 = total $2.00.
   * If any attempt outcome is UNKNOWN, total status is UNKNOWN and amount is null.
   */
  static accumulateAttemptCosts(attempts: AttemptCostRecord[]): {
    totalCostUsd: number | null;
    costStatus: CostStatus;
    attempts: AttemptCostRecord[];
  } {
    if (!attempts.length) {
      return { totalCostUsd: 0, costStatus: "EXACT", attempts: [] };
    }

    let hasUnknown = false;
    let sum = 0;

    for (const attempt of attempts) {
      if (
        attempt.costStatus === "UNKNOWN" ||
        attempt.status === "unknown" ||
        attempt.status === "timeout" ||
        attempt.amount == null
      ) {
        hasUnknown = true;
      } else {
        sum += attempt.amount;
      }
    }

    if (hasUnknown) {
      return {
        totalCostUsd: null,
        costStatus: "UNKNOWN",
        attempts,
      };
    }

    return {
      totalCostUsd: Number(sum.toFixed(4)),
      costStatus: "EXACT",
      attempts,
    };
  }

  /**
   * Evaluates whether a cost estimate complies with budget constraints.
   * Fails safe: unknown cost is never treated as under budget.
   */
  static evaluateBudget(estimate: CostEstimate, maxProviderCost?: number): BudgetEvaluationResult {
    if (maxProviderCost == null) {
      return {
        approved: true,
        reason: "UNDER_BUDGET",
        maxProviderCost: undefined,
        estimatedCost: estimate.amount,
        costStatus: estimate.status,
        detail: "No budget constraint specified",
      };
    }

    if (estimate.status === "UNKNOWN" || estimate.amount == null) {
      return {
        approved: false,
        reason: "UNKNOWN_COST",
        maxProviderCost,
        estimatedCost: null,
        costStatus: "UNKNOWN",
        detail: "Cannot verify budget compliance: estimated cost is UNKNOWN",
      };
    }

    if (estimate.amount <= maxProviderCost) {
      return {
        approved: true,
        reason: "UNDER_BUDGET",
        maxProviderCost,
        estimatedCost: estimate.amount,
        costStatus: estimate.status,
        detail: `Estimated cost $${estimate.amount} is within budget $${maxProviderCost}`,
      };
    }

    return {
      approved: false,
      reason: "EXCEEDS_BUDGET",
      maxProviderCost,
      estimatedCost: estimate.amount,
      costStatus: estimate.status,
      detail: `Estimated cost $${estimate.amount} exceeds maxProviderCost $${maxProviderCost}`,
    };
  }

  /**
   * Internal deterministic calculation from a validated PricingRule and request parameters.
   */
  private static computeFromRule(rule: PricingRule, req: CostEstimationRequest): CostEstimate {
    let baseAmount = 0;
    let unit: CostEstimate["unit"] = "per_generation";
    let quantity = 1;

    switch (rule.billingScheme) {
      case "per_second": {
        unit = "per_second";
        quantity = req.durationSeconds ?? 5; // standard baseline 5s
        const baseRate = rule.ratePerSecondUsd ?? 0;
        const durationMultiplier = rule.durationMultipliers?.[quantity] ?? 1.0;
        baseAmount = quantity * baseRate * durationMultiplier;
        break;
      }
      case "per_image": {
        unit = "per_image";
        quantity = req.imageCount ?? 1;
        const rate = rule.ratePerImageUsd ?? rule.baseRateUsd ?? 0;
        baseAmount = quantity * rate;
        break;
      }
      case "per_character": {
        unit = "per_character";
        quantity = req.characterCount ?? 0;
        const ratePerChar = (rule.ratePer1kCharactersUsd ?? 0) / 1000;
        baseAmount = quantity * ratePerChar;
        break;
      }
      case "flat_per_generation":
      case "configuration_tiered":
      default: {
        unit = "per_generation";
        quantity = 1;
        baseAmount = rule.baseRateUsd ?? 0;
        break;
      }
    }

    // Resolution modifier
    let resolutionModifier = 0;
    if (req.resolution && rule.resolutionMultipliers) {
      const normRes = req.resolution.toLowerCase();
      // Match exact or prefix (e.g. "1080p", "1024x1792")
      const matchedKey = Object.keys(rule.resolutionMultipliers).find(
        (k) => k.toLowerCase() === normRes || normRes.includes(k.toLowerCase())
      );
      if (matchedKey) {
        const mult = rule.resolutionMultipliers[matchedKey];
        if (mult !== 1.0) {
          resolutionModifier = baseAmount * (mult - 1.0);
        }
      }
    }

    // Audio add-on
    let audioCost = 0;
    if (req.includeAudio && rule.audioAddOnUsd) {
      audioCost = rule.audioAddOnUsd;
    }

    const total = baseAmount + resolutionModifier + audioCost;

    let status: CostStatus = "EXACT";
    if (rule.provenance.sourceType === "INTERNAL_ESTIMATE") {
      status = "ESTIMATED";
    } else if (rule.provenance.sourceType === "UNKNOWN") {
      status = "UNKNOWN";
    }

    const breakdown: CostBreakdown = {
      baseAmount: Number(baseAmount.toFixed(4)),
      resolutionModifier: resolutionModifier > 0 ? Number(resolutionModifier.toFixed(4)) : undefined,
      audioCost: audioCost > 0 ? Number(audioCost.toFixed(4)) : undefined,
    };

    return {
      providerId: req.providerId,
      modelId: req.modelId,
      modality: req.modality,
      currency: "USD",
      amount: status === "UNKNOWN" ? null : Number(total.toFixed(4)),
      unit,
      quantity,
      status,
      pricingVersion: rule.pricingVersion,
      pricingSource: rule.provenance,
      breakdown,
      minAmount: Number(total.toFixed(4)),
      maxAmount: Number(total.toFixed(4)),
    };
  }
}
