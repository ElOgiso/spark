/**
 * Scores providers against shot requirements.
 * Returns explainable heuristic scores — not claimed objective quality.
 */

import type { ShotSpec } from "../specification/shotSpec";
import {
  PROVIDER_GENERATION_SCORECARDS,
  strategyToRequiredCapabilities,
  type ProviderCapabilityScorecard,
  type GenerationCapability,
} from "./capabilityMatrix";
import type { RoutingSpec } from "../specification/routingSpec";
import { DEFAULT_ROUTING_WEIGHTS, type RoutingWeightConfig } from "./routingWeights";

export interface ModelScore {
  providerId: string;
  displayName: string;
  score: number;
  reasons: string[];
  matchedCapabilities: GenerationCapability[];
  missingCapabilities: GenerationCapability[];
  /** @deprecated use missingCapabilities */
  unsupported: GenerationCapability[];
  disqualified: boolean;
  disqualifyReason?: string;
}

export function scoreProvidersForShot(
  shot: ShotSpec,
  policy: RoutingSpec["capabilityPolicy"],
  availableProviderIds?: string[],
  weights: RoutingWeightConfig = DEFAULT_ROUTING_WEIGHTS
): ModelScore[] {
  const required = strategyToRequiredCapabilities(shot.generationStrategy, shot);
  const cards = PROVIDER_GENERATION_SCORECARDS.filter((c) => {
    if (availableProviderIds?.length) return availableProviderIds.includes(c.providerId);
    if (shot.generationStrategy === "slideshow_still" || shot.generationStrategy === "text_to_image") {
      return (c.capabilities.text_to_image || 0) > 0.5;
    }
    if (shot.generationStrategy === "voice" || shot.generationStrategy === "audio") {
      return (c.capabilities.voice || 0) > 0.5;
    }
    return (c.capabilities.image_to_video || 0) > 0.4 || (c.capabilities.text_to_video || 0) > 0.4;
  });

  return cards
    .map((card) => scoreCard(card, required, policy, shot, weights))
    .filter((s) => !s.disqualified)
    .sort((a, b) => b.score - a.score);
}

function scoreCard(
  card: ProviderCapabilityScorecard,
  required: GenerationCapability[],
  policy: RoutingSpec["capabilityPolicy"],
  shot: ShotSpec,
  weights: RoutingWeightConfig
): ModelScore {
  const reasons: string[] = [];
  const matched: GenerationCapability[] = [];
  const missing: GenerationCapability[] = [];
  let total = 0;
  let weightSum = 0;

  for (const cap of required) {
    const w = weightFor(cap, policy) * weights.capabilityFit;
    const v = card.capabilities[cap] ?? 0;
    if (v <= 0.05) {
      missing.push(cap);
    } else {
      matched.push(cap);
      if (v >= 0.75) reasons.push(`strong ${cap}`);
    }
    total += v * w;
    weightSum += w;
  }

  // Hard disqualify if critical required capability missing
  const criticalMissing = missing.filter((c) => weights.criticalCapabilities.includes(c));
  if (criticalMissing.length > 0) {
    return {
      providerId: card.providerId,
      displayName: card.displayName,
      score: 0,
      reasons: [`missing critical: ${criticalMissing.join(", ")}`],
      matchedCapabilities: matched,
      missingCapabilities: missing,
      unsupported: missing,
      disqualified: true,
      disqualifyReason: `capability_missing:${criticalMissing.join(",")}`,
    };
  }

  // Soft penalty for non-critical gaps
  if (missing.length) {
    total -= missing.length * weights.missingCapabilityPenalty;
    reasons.push(`gaps: ${missing.join(", ")}`);
  }

  // Duration fit
  if (card.maxNativeSec > 0) {
    const durFit =
      shot.durationSec <= card.maxNativeSec
        ? 1
        : Math.max(0, 1 - (shot.durationSec - card.maxNativeSec) / Math.max(1, shot.durationSec));
    total += durFit * weights.durationFit;
    weightSum += weights.durationFit;
    if (durFit === 1) reasons.push(`duration fit ≤${card.maxNativeSec}s`);
    else reasons.push(`duration stretch beyond ${card.maxNativeSec}s`);
  }

  if (policy.preferSpeed) {
    total += (card.capabilities.speed || 0.5) * weights.speedBonus;
    weightSum += weights.speedBonus;
  }
  if (policy.preferCost) {
    total += (card.capabilities.cost_efficiency || 0.5) * weights.costBonus;
    weightSum += weights.costBonus;
  }

  const score = weightSum > 0 ? Math.max(0, total / weightSum) : 0;

  return {
    providerId: card.providerId,
    displayName: card.displayName,
    score: Number(score.toFixed(3)),
    reasons,
    matchedCapabilities: matched,
    missingCapabilities: missing,
    unsupported: missing,
    disqualified: false,
  };
}

function weightFor(cap: GenerationCapability, policy: RoutingSpec["capabilityPolicy"]): number {
  if (cap === "character_consistency" && policy.preferCharacterConsistency) return 1.4;
  if (
    (cap === "first_frame_conditioning" || cap === "last_frame_conditioning") &&
    policy.preferFirstLastFrame
  ) {
    return 1.3;
  }
  if (cap === "audio_generation" && policy.preferNativeAudio) return 1.2;
  if (cap === "motion_quality") return 1.1;
  if (cap === "animation") return 1.15;
  return 1;
}
