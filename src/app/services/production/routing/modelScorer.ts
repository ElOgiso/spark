/**
 * Scores providers against shot requirements.
 */

import type { ShotSpec } from "../specification/shotSpec";
import {
  PROVIDER_GENERATION_SCORECARDS,
  strategyToRequiredCapabilities,
  type ProviderCapabilityScorecard,
  type GenerationCapability,
} from "./capabilityMatrix";
import type { RoutingSpec } from "../specification/routingSpec";

export interface ModelScore {
  providerId: string;
  displayName: string;
  score: number;
  reasons: string[];
  unsupported: GenerationCapability[];
}

export function scoreProvidersForShot(
  shot: ShotSpec,
  policy: RoutingSpec["capabilityPolicy"],
  availableProviderIds?: string[]
): ModelScore[] {
  const required = strategyToRequiredCapabilities(shot.generationStrategy, shot);
  const cards = PROVIDER_GENERATION_SCORECARDS.filter((c) => {
    if (availableProviderIds?.length) return availableProviderIds.includes(c.providerId);
    // Video strategies need video-capable providers (or image for slideshow)
    if (shot.generationStrategy === "slideshow_still" || shot.generationStrategy === "text_to_image") {
      return (c.capabilities.text_to_image || 0) > 0.5;
    }
    return (c.capabilities.image_to_video || 0) > 0.4 || (c.capabilities.text_to_video || 0) > 0.4;
  });

  return cards
    .map((card) => scoreCard(card, required, policy, shot))
    .sort((a, b) => b.score - a.score);
}

function scoreCard(
  card: ProviderCapabilityScorecard,
  required: GenerationCapability[],
  policy: RoutingSpec["capabilityPolicy"],
  shot: ShotSpec
): ModelScore {
  const reasons: string[] = [];
  const unsupported: GenerationCapability[] = [];
  let total = 0;
  let weightSum = 0;

  for (const cap of required) {
    const w = weightFor(cap, policy);
    const v = card.capabilities[cap] ?? 0;
    if (v <= 0.05) unsupported.push(cap);
    total += v * w;
    weightSum += w;
    if (v >= 0.75) reasons.push(`strong ${cap}`);
  }

  // Duration fit
  if (card.maxNativeSec > 0) {
    const durFit = shot.durationSec <= card.maxNativeSec ? 1 : Math.max(0, 1 - (shot.durationSec - card.maxNativeSec) / shot.durationSec);
    total += durFit * 0.8;
    weightSum += 0.8;
    if (durFit === 1) reasons.push(`duration fit ≤${card.maxNativeSec}s`);
  }

  if (policy.preferSpeed) {
    total += (card.capabilities.speed || 0.5) * 0.5;
    weightSum += 0.5;
  }
  if (policy.preferCost) {
    total += (card.capabilities.cost_efficiency || 0.5) * 0.5;
    weightSum += 0.5;
  }

  const score = weightSum > 0 ? total / weightSum : 0;
  if (unsupported.length) {
    reasons.push(`gaps: ${unsupported.join(", ")}`);
  }

  return {
    providerId: card.providerId,
    displayName: card.displayName,
    score: Number(score.toFixed(3)),
    reasons,
    unsupported,
  };
}

function weightFor(cap: GenerationCapability, policy: RoutingSpec["capabilityPolicy"]): number {
  if (cap === "character_consistency" && policy.preferCharacterConsistency) return 1.4;
  if ((cap === "first_frame_conditioning" || cap === "last_frame_conditioning") && policy.preferFirstLastFrame) {
    return 1.3;
  }
  if (cap === "audio_generation" && policy.preferNativeAudio) return 1.2;
  if (cap === "motion_quality") return 1.1;
  return 1;
}
