/**
 * Selects provider for a shot and plans fallbacks.
 */

import type { ShotSpec } from "../specification/shotSpec";
import type { RoutingSpec, ShotRoutingDecision } from "../specification/routingSpec";
import { scoreProvidersForShot } from "./modelScorer";

export function selectProviderForShot(
  shot: ShotSpec,
  routing: RoutingSpec,
  availableProviderIds?: string[]
): ShotRoutingDecision {
  const scores = scoreProvidersForShot(shot, routing.capabilityPolicy, availableProviderIds);
  const preferred = routing.preferredVideoProvider;
  let ranked = scores;
  if (preferred && preferred !== "auto") {
    ranked = [...scores].sort((a, b) => {
      if (a.providerId === preferred) return -1;
      if (b.providerId === preferred) return 1;
      return b.score - a.score;
    });
  }

  const best = ranked[0] || {
    providerId: "gemini",
    displayName: "Google Gemini / Veo",
    score: 0.5,
    reasons: ["default fallback"],
    unsupported: [],
  };

  const fallbacks = ranked.slice(1, 4).map((s) => ({
    provider: s.providerId,
    reason: s.reasons.slice(0, 2).join("; ") || `score ${s.score}`,
  }));

  return {
    shotId: shot.id,
    provider: best.providerId,
    strategy: shot.generationStrategy,
    score: best.score,
    reasons: best.reasons,
    fallbacks,
  };
}

export function planFallback(decision: ShotRoutingDecision): ShotRoutingDecision["fallbacks"][0] | null {
  return decision.fallbacks[0] || null;
}
