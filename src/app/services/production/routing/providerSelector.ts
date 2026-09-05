/**
 * Selects provider for a shot and plans capability-compatible fallbacks.
 * Soft preferences never override hard capability rejections from Phase 3.
 */

import type { ShotSpec } from "../specification/shotSpec";
import type { RoutingSpec, ShotRoutingDecision } from "../specification/routingSpec";
import { scoreProvidersForShot } from "./modelScorer";
import { strategyToRequiredCapabilities } from "./capabilityMatrix";

export function selectProviderForShot(
  shot: ShotSpec,
  routing: RoutingSpec,
  availableProviderIds?: string[]
): ShotRoutingDecision {
  const required = strategyToRequiredCapabilities(shot.generationStrategy, shot);
  const scores = scoreProvidersForShot(shot, routing.capabilityPolicy, availableProviderIds);
  const preferred = routing.preferredVideoProvider;

  let ranked = scores;
  if (preferred && preferred !== "auto") {
    const preferredScore = scores.find((s) => s.providerId === preferred);
    // Only honor preference if the provider actually passed capability filter
    if (preferredScore) {
      ranked = [preferredScore, ...scores.filter((s) => s.providerId !== preferred)];
    }
  }

  const best = ranked[0];
  if (!best) {
    return {
      shotId: shot.id,
      provider: "unavailable",
      strategy: shot.generationStrategy,
      score: 0,
      reasons: ["no_compatible_provider", "NO_COMPATIBLE_CANDIDATE"],
      matchedCapabilities: [],
      missingCapabilities: required,
      fallbacks: [],
    };
  }

  // Fallbacks must also be capability-compatible (already filtered by scorer)
  const fallbacks = ranked.slice(1, 4).map((s) => ({
    provider: s.providerId,
    reason: s.reasons.slice(0, 2).join("; ") || `score ${s.score}`,
    matchedCapabilities: s.matchedCapabilities,
    missingCapabilities: s.missingCapabilities,
  }));

  const capabilityReasons = best.capabilityReasonCodes || [];
  const reasons = Array.from(
    new Set([
      ...best.reasons,
      ...capabilityReasons,
      ...(preferred && preferred === best.providerId ? ["PREFERRED_PROVIDER"] : []),
    ])
  );

  return {
    shotId: shot.id,
    provider: best.providerId,
    strategy: shot.generationStrategy,
    score: best.score,
    reasons,
    matchedCapabilities: best.matchedCapabilities,
    missingCapabilities: best.missingCapabilities,
    fallbacks,
  };
}

export function planFallback(decision: ShotRoutingDecision): ShotRoutingDecision["fallbacks"][0] | null {
  return decision.fallbacks[0] || null;
}
