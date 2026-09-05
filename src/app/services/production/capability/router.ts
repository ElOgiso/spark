/**
 * Capability-aware media routing — extends production routing; does NOT replace ModelRouter.
 *
 * Pipeline:
 *   requirements
 *     → hard capability filter (effective profiles)
 *     → preference / health / cost / latency scoring
 *     → explainable decision + capability-compatible fallbacks
 */

import type {
  CapabilityRequirements,
  MediaRoutingDecision,
  ProviderModelCandidate,
  RoutingObjective,
  RoutingScoreBreakdown,
  CandidateRejection,
  FallbackPlanEntry,
  FallbackQuality,
  RoutingReasonCode,
} from "./types";
import { listProviderModelCandidates } from "./registry";
import { validateCapabilityRequirements } from "./validate";

export interface RouteMediaOptions {
  candidates?: ProviderModelCandidate[];
  requireAdapter?: boolean;
  /** When set, validate this manual choice instead of auto-selecting. */
  manualProviderId?: string;
  manualModelId?: string;
}

const OBJECTIVES: Record<
  RoutingObjective,
  { quality: number; reliability: number; latency: number; cost: number; preference: number; health: number }
> = {
  quality_first: { quality: 1.2, reliability: 0.8, latency: 0.3, cost: 0.2, preference: 0.5, health: 0.9 },
  balanced: { quality: 0.8, reliability: 0.8, latency: 0.6, cost: 0.6, preference: 0.5, health: 0.9 },
  cost_first: { quality: 0.4, reliability: 0.6, latency: 0.4, cost: 1.3, preference: 0.4, health: 0.8 },
  speed_first: { quality: 0.4, reliability: 0.7, latency: 1.3, cost: 0.3, preference: 0.4, health: 0.9 },
  reliability_first: { quality: 0.5, reliability: 1.3, latency: 0.4, cost: 0.3, preference: 0.4, health: 1.2 },
};

function healthScore(c: ProviderModelCandidate): number {
  const s = c.health?.status;
  if (s === "healthy") return 1;
  if (s === "degraded") return 0.45;
  if (s === "unknown") return 0.7;
  return 0; // error / disabled
}

function costScore(c: ProviderModelCandidate): number {
  const e = c.economics;
  if (!e?.known) return 0.5; // neutral — do not invent prices
  // Lower cost → higher score; only when known
  const usd = e.estimatedUsdPerGeneration ?? e.costPerSecond ?? e.estimatedCreditsPerGeneration;
  if (usd == null) return 0.5;
  return 1 / (1 + usd);
}

function latencyScore(c: ProviderModelCandidate): number {
  const ms = c.health?.latencyMs ?? c.performance?.averageLatencyMs;
  if (ms == null) return 0.5;
  return Math.max(0, 1 - ms / 120_000);
}

function qualityScore(c: ProviderModelCandidate): number {
  if (c.performance?.known && c.performance.qualityScore != null) {
    return Math.max(0, Math.min(1, c.performance.qualityScore));
  }
  // Mild prior from modality richness — not claimed objective quality
  return 0.55 + Math.min(0.3, c.effective.generationModes.length * 0.05);
}

function reliabilityScore(c: ProviderModelCandidate): number {
  if (c.performance?.known && c.performance.successRate != null) {
    return c.performance.successRate;
  }
  return healthScore(c) * 0.9 + 0.1;
}

function preferenceScore(c: ProviderModelCandidate, req: CapabilityRequirements): number {
  let s = 0.5;
  if (req.preferences?.preferredProviderId === c.providerId) s += 0.35;
  if (req.preferences?.preferredModelId === c.modelId) s += 0.15;
  return Math.min(1, s);
}

function capabilityFitScore(
  c: ProviderModelCandidate,
  req: CapabilityRequirements
): { fit: number; match: ReturnType<typeof validateCapabilityRequirements> } {
  const match = validateCapabilityRequirements(req, c.effective);
  if (!match.hardRequirementsSatisfied) return { fit: 0, match };
  const softPenalties = match.warnings.length * 0.05;
  return { fit: Math.max(0, 1 - softPenalties), match };
}

function scoreCandidate(
  c: ProviderModelCandidate,
  req: CapabilityRequirements,
  objective: RoutingObjective
): { breakdown: RoutingScoreBreakdown; match: ReturnType<typeof validateCapabilityRequirements>; rejected?: CandidateRejection } {
  const weights = OBJECTIVES[objective];
  const { fit, match } = capabilityFitScore(c, req);

  if (!match.hardRequirementsSatisfied) {
    return {
      breakdown: {
        capabilityFit: 0,
        quality: 0,
        reliability: 0,
        latency: 0,
        cost: 0,
        preference: 0,
        health: 0,
        finalScore: 0,
      },
      match,
      rejected: {
        candidate: { providerId: c.providerId, modelId: c.modelId },
        reasonCodes: match.reasonCodes.filter((r) => r.startsWith("REJECTED")) as RoutingReasonCode[],
        mismatches: match.missing,
      },
    };
  }

  // Hard reject unhealthy when healthier alternatives may exist — still score 0 if error/disabled
  const health = healthScore(c);
  if (c.health?.status === "error" || c.health?.status === "disabled") {
    return {
      breakdown: {
        capabilityFit: fit,
        quality: 0,
        reliability: 0,
        latency: 0,
        cost: 0,
        preference: 0,
        health: 0,
        finalScore: 0,
      },
      match,
      rejected: {
        candidate: { providerId: c.providerId, modelId: c.modelId },
        reasonCodes: ["REJECTED_PROVIDER_UNHEALTHY"],
        mismatches: [
          {
            code: "REJECTED_PROVIDER_UNHEALTHY",
            requirement: "health",
            detail: `Provider status=${c.health.status}`,
            hard: true,
          },
        ],
      },
    };
  }

  const quality = qualityScore(c);
  const reliability = reliabilityScore(c);
  const latency = latencyScore(c);
  const cost = costScore(c);
  const preference = preferenceScore(c, req);

  const finalScore =
    fit * 1.0 +
    quality * weights.quality +
    reliability * weights.reliability +
    latency * weights.latency +
    cost * weights.cost +
    preference * weights.preference +
    health * weights.health;

  return {
    breakdown: {
      capabilityFit: Number(fit.toFixed(3)),
      quality: Number(quality.toFixed(3)),
      reliability: Number(reliability.toFixed(3)),
      latency: Number(latency.toFixed(3)),
      cost: Number(cost.toFixed(3)),
      preference: Number(preference.toFixed(3)),
      health: Number(health.toFixed(3)),
      finalScore: Number(finalScore.toFixed(3)),
    },
    match,
  };
}

function fallbackQuality(
  primary: CapabilityRequirements,
  candidate: ProviderModelCandidate
): FallbackQuality {
  const match = validateCapabilityRequirements(primary, candidate.effective);
  if (!match.hardRequirementsSatisfied) return "unavailable";
  if (match.warnings.length === 0 && match.missing.length === 0) return "exact";
  if (match.warnings.length && match.hardRequirementsSatisfied) return "compatible";
  return "degraded";
}

/**
 * Route a media generation requirement to an executable provider/model.
 */
export function routeMediaCapability(
  requirements: CapabilityRequirements,
  options: RouteMediaOptions = {}
): MediaRoutingDecision {
  const objective = requirements.preferences?.objective || "balanced";
  const candidates =
    options.candidates ||
    listProviderModelCandidates({
      requireAdapter: options.requireAdapter !== false,
    });

  const rejected: CandidateRejection[] = [];
  const scored: Array<{
    candidate: ProviderModelCandidate;
    breakdown: RoutingScoreBreakdown;
    match: ReturnType<typeof validateCapabilityRequirements>;
  }> = [];

  // Manual override path
  const manualId = options.manualProviderId || requirements.preferences?.preferredProviderId;
  const manualModel = options.manualModelId || requirements.preferences?.preferredModelId;
  if (requirements.preferences?.manualOverride && manualId) {
    const manual = candidates.find(
      (c) =>
        c.providerId === manualId && (!manualModel || c.modelId === manualModel)
    );
    if (!manual) {
      return {
        rejected: [
          {
            candidate: { providerId: manualId, modelId: manualModel || "*" },
            reasonCodes: ["REJECTED_MANUAL_MISMATCH"],
            mismatches: [
              {
                code: "REJECTED_MANUAL_MISMATCH",
                requirement: "manualOverride",
                detail: "Manual provider/model not in candidate set",
                hard: true,
              },
            ],
          },
        ],
        fallbackPlan: [],
        reasonCodes: ["REJECTED_MANUAL_MISMATCH", "NO_COMPATIBLE_CANDIDATE"],
        objective,
      };
    }
    const { breakdown, match, rejected: rej } = scoreCandidate(manual, requirements, objective);
    if (rej) {
      return {
        rejected: [rej],
        fallbackPlan: [],
        reasonCodes: [...rej.reasonCodes, "REJECTED_MANUAL_MISMATCH"],
        objective,
        capabilityMatch: match,
      };
    }
    return {
      selected: manual,
      rejected: [],
      scoreBreakdown: breakdown,
      capabilityMatch: match,
      fallbackPlan: [],
      reasonCodes: ["MANUAL_OVERRIDE", "CAPABILITY_MATCH", ...match.reasonCodes],
      objective,
    };
  }

  for (const c of candidates) {
    const { breakdown, match, rejected: rej } = scoreCandidate(c, requirements, objective);
    if (rej) {
      rejected.push(rej);
      continue;
    }
    scored.push({ candidate: c, breakdown, match });
  }

  scored.sort((a, b) => b.breakdown.finalScore - a.breakdown.finalScore);

  // Soft preference boost already in score; if preferred exists in scored, optionally pin when not manual
  if (requirements.preferences?.preferredProviderId) {
    const pref = scored.find((s) => s.candidate.providerId === requirements.preferences?.preferredProviderId);
    if (pref) {
      // move to front only if within 15% of best — preference must not override large capability/health gaps
      const best = scored[0];
      if (best && pref.breakdown.finalScore >= best.breakdown.finalScore * 0.85) {
        scored.splice(scored.indexOf(pref), 1);
        scored.unshift(pref);
      }
    }
  }

  const best = scored[0];
  if (!best) {
    return {
      rejected,
      fallbackPlan: [],
      reasonCodes: ["NO_COMPATIBLE_CANDIDATE"],
      objective,
    };
  }

  const fallbackPlan: FallbackPlanEntry[] = scored.slice(1, 4).map((s) => ({
    candidate: { providerId: s.candidate.providerId, modelId: s.candidate.modelId },
    quality: fallbackQuality(requirements, s.candidate),
    reasonCodes: ["FALLBACK_SELECTED", "CAPABILITY_MATCH"] as RoutingReasonCode[],
    score: s.breakdown.finalScore,
  }));

  const reasonCodes = [
    "CAPABILITY_MATCH",
    ...best.match.reasonCodes,
    ...(requirements.preferences?.preferredProviderId === best.candidate.providerId
      ? (["PREFERRED_PROVIDER"] as const)
      : []),
    ...(objective === "cost_first" ? (["LOWER_COST"] as const) : []),
    ...(objective === "speed_first" ? (["LOWER_LATENCY"] as const) : []),
    ...(objective === "quality_first" ? (["HIGHER_QUALITY"] as const) : []),
    ...(best.candidate.health?.status === "healthy" ? (["HEALTHY_PROVIDER"] as const) : []),
  ];

  return {
    selected: best.candidate,
    rejected,
    scoreBreakdown: best.breakdown,
    capabilityMatch: best.match,
    fallbackPlan,
    reasonCodes: Array.from(new Set(reasonCodes)),
    objective,
  };
}

/** Pre-execution guard — fail before provider call when request shape is unsupported. */
export function assertExecutableCapability(
  requirements: CapabilityRequirements,
  providerId: string,
  modelId?: string
): { ok: true } | { ok: false; decision: MediaRoutingDecision } {
  const decision = routeMediaCapability(requirements, {
    manualProviderId: providerId,
    manualModelId: modelId,
    requireAdapter: true,
  });
  // Force validation of this provider specifically
  const candidates = listProviderModelCandidates({ providerIds: [providerId], requireAdapter: false });
  const candidate = candidates.find((c) => !modelId || c.modelId === modelId) || candidates[0];
  if (!candidate) {
    return {
      ok: false,
      decision: {
        rejected: [
          {
            candidate: { providerId, modelId: modelId || "*" },
            reasonCodes: ["REJECTED_ADAPTER_UNSUPPORTED"],
            mismatches: [
              {
                code: "REJECTED_ADAPTER_UNSUPPORTED",
                requirement: "adapter",
                detail: "Provider not in capability registry",
                hard: true,
              },
            ],
          },
        ],
        fallbackPlan: [],
        reasonCodes: ["REJECTED_ADAPTER_UNSUPPORTED"],
        objective: requirements.preferences?.objective || "balanced",
      },
    };
  }
  const match = validateCapabilityRequirements(requirements, candidate.effective);
  if (!match.hardRequirementsSatisfied) {
    return {
      ok: false,
      decision: {
        rejected: [
          {
            candidate: { providerId: candidate.providerId, modelId: candidate.modelId },
            reasonCodes: match.reasonCodes.filter((r) => r.startsWith("REJECTED")) as RoutingReasonCode[],
            mismatches: match.missing,
          },
        ],
        capabilityMatch: match,
        fallbackPlan: [],
        reasonCodes: match.reasonCodes,
        objective: requirements.preferences?.objective || "balanced",
      },
    };
  }
  return { ok: true };
}
