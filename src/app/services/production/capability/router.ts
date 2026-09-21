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
  RoutingIntent,
  ResolvedModelRouting,
  ResolvedModelSummary,
  RoutingProductionMode,
  RoutingPriority,
} from "./types";
import { listProviderModelCandidates } from "./registry";
import { validateCapabilityRequirements } from "./validate";
import { CostEngine } from "../economics/costEngine";

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

export function normalizeRoutingIntentToRequirements(
  input: CapabilityRequirements | RoutingIntent
): CapabilityRequirements {
  if ("capabilityRequirements" in input && input.capabilityRequirements) {
    const base = input.capabilityRequirements;
    const obj =
      typeof input.objective === "string"
        ? (input.objective as RoutingObjective)
        : base.preferences?.objective || "balanced";
    return {
      ...base,
      preferences: {
        ...base.preferences,
        objective: obj,
        preferredProviderId: input.preferredProviderId || base.preferences?.preferredProviderId,
        preferredModelId: input.preferredModelId || base.preferences?.preferredModelId,
        productionMode: input.productionMode || base.preferences?.productionMode,
        priority: input.priority || base.preferences?.priority,
        budget: input.budget || base.preferences?.budget,
        excludedProviderIds: input.excludedProviderIds || base.preferences?.excludedProviderIds,
        excludedModelIds: input.excludedModelIds || base.preferences?.excludedModelIds,
        manualOverride: input.manualOverride ?? base.preferences?.manualOverride,
      },
    };
  }

  const req = input as CapabilityRequirements;
  const intent = input as RoutingIntent;
  const obj =
    typeof intent.objective === "string"
      ? (intent.objective as RoutingObjective)
      : req.preferences?.objective || "balanced";

  return {
    modality: intent.modality,
    generationMode: intent.generationMode || req.generationMode,
    references: intent.references || req.references,
    temporal: intent.temporal || req.temporal,
    camera: intent.camera || req.camera,
    motion: intent.motion || req.motion,
    output: intent.output || req.output,
    audio: intent.audio || req.audio,
    execution: intent.execution || req.execution,
    preferences: {
      ...req.preferences,
      objective: obj,
      preferredProviderId: intent.preferredProviderId || req.preferences?.preferredProviderId,
      preferredModelId: intent.preferredModelId || req.preferences?.preferredModelId,
      productionMode: intent.productionMode || req.preferences?.productionMode,
      priority: intent.priority || req.preferences?.priority,
      budget: intent.budget || req.preferences?.budget,
      excludedProviderIds: intent.excludedProviderIds || req.preferences?.excludedProviderIds,
      excludedModelIds: intent.excludedModelIds || req.preferences?.excludedModelIds,
      manualOverride: intent.manualOverride ?? req.preferences?.manualOverride,
    },
  };
}

function computeWeights(
  objective: RoutingObjective,
  preferences?: CapabilityRequirements["preferences"]
): { quality: number; reliability: number; latency: number; cost: number; preference: number; health: number } {
  const base = { ...(OBJECTIVES[objective] || OBJECTIVES.balanced) };

  // Production Mode bias
  const mode = preferences?.productionMode;
  if (mode === "Economy" || mode === "express") {
    base.cost += 0.5;
    base.reliability += 0.1;
    base.quality = Math.max(0.2, base.quality - 0.2);
  } else if (mode === "Cinematic" || mode === "deep") {
    base.quality += 0.4;
    base.reliability += 0.2;
    base.cost = Math.max(0.1, base.cost - 0.3);
    base.latency = Math.max(0.1, base.latency - 0.2);
  } else if (mode === "Maximum") {
    base.quality += 0.6;
    base.reliability += 0.3;
    base.cost = Math.max(0.05, base.cost - 0.4);
    base.latency = Math.max(0.05, base.latency - 0.3);
  }

  // Priority adjustment
  const prio = preferences?.priority;
  if (prio === "hero") {
    base.quality += 0.3;
    base.cost = Math.max(0.1, base.cost - 0.2);
    base.reliability += 0.1;
  } else if (prio === "supporting") {
    base.cost += 0.3;
    base.latency += 0.2;
    base.quality = Math.max(0.2, base.quality - 0.2);
  } else if (prio === "important") {
    base.quality += 0.15;
  }

  return base;
}

function healthScore(c: ProviderModelCandidate): number {
  const s = c.health?.status;
  if (s === "healthy") return 1;
  if (s === "degraded") return 0.45;
  if (s === "unknown") return 0.7;
  return 0; // error / disabled
}

function costScore(c: ProviderModelCandidate, req?: CapabilityRequirements): number {
  const e = c.economics;
  if (e?.known) {
    const usd = e.estimatedUsdPerGeneration ?? e.costPerSecond ?? e.estimatedCreditsPerGeneration;
    if (usd != null) return 1 / (1 + usd);
  }
  if (e && e.known === false) {
    return 0.5; // neutral — unpriced candidate profiles remain strictly 0.5
  }
  if (req) {
    const est = CostEngine.estimateCost({
      providerId: c.providerId,
      modelId: c.modelId,
      modality: req.modality,
      durationSeconds: req.output?.durationSeconds,
      resolution: req.output?.resolution,
      aspectRatio: req.output?.aspectRatio,
      includeAudio: req.output?.requiresNativeAudio || req.audio?.required,
    });
    if ((est.status === "EXACT" || est.status === "ESTIMATED") && est.amount != null) {
      return 1 / (1 + est.amount);
    }
  }
  return 0.5; // neutral — unpriced candidate remains 0.5
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
  // Hard reject excluded providers
  if (req.preferences?.excludedProviderIds?.includes(c.providerId)) {
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
      match: validateCapabilityRequirements(req, c.effective),
      rejected: {
        candidate: { providerId: c.providerId, modelId: c.modelId },
        reasonCodes: ["REJECTED_EXCLUDED_PROVIDER"],
        mismatches: [
          {
            code: "REJECTED_EXCLUDED_PROVIDER",
            requirement: "excludedProvider",
            detail: `Provider "${c.providerId}" is excluded by routing intent`,
            hard: true,
          },
        ],
      },
    };
  }

  // Hard reject excluded models
  if (req.preferences?.excludedModelIds?.includes(c.modelId)) {
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
      match: validateCapabilityRequirements(req, c.effective),
      rejected: {
        candidate: { providerId: c.providerId, modelId: c.modelId },
        reasonCodes: ["REJECTED_EXCLUDED_MODEL"],
        mismatches: [
          {
            code: "REJECTED_EXCLUDED_MODEL",
            requirement: "excludedModel",
            detail: `Model "${c.modelId}" is excluded by routing intent`,
            hard: true,
          },
        ],
      },
    };
  }

  // Hard reject budget exceedance
  const maxBudget = req.preferences?.budget?.maxProviderCost;
  if (maxBudget != null) {
    if (c.economics?.known) {
      const est = c.economics.estimatedUsdPerGeneration ?? c.economics.costPerSecond;
      if (est != null && est > maxBudget) {
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
          match: validateCapabilityRequirements(req, c.effective),
          rejected: {
            candidate: { providerId: c.providerId, modelId: c.modelId },
            reasonCodes: ["REJECTED_BUDGET_EXCEEDED"],
            mismatches: [
              {
                code: "REJECTED_BUDGET_EXCEEDED",
                requirement: "budget",
                detail: `Estimated cost ${est} exceeds maxProviderCost ${maxBudget}`,
                hard: true,
              },
            ],
          },
        };
      }
    } else {
      const costEstimate = CostEngine.estimateCost({
        providerId: c.providerId,
        modelId: c.modelId,
        modality: req.modality,
        durationSeconds: req.output?.durationSeconds,
        resolution: req.output?.resolution,
        aspectRatio: req.output?.aspectRatio,
        includeAudio: req.output?.requiresNativeAudio || req.audio?.required,
      });
      const budgetEval = CostEngine.evaluateBudget(costEstimate, maxBudget);
      if (!budgetEval.approved && budgetEval.reason === "EXCEEDS_BUDGET") {
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
          match: validateCapabilityRequirements(req, c.effective),
          rejected: {
            candidate: { providerId: c.providerId, modelId: c.modelId },
            reasonCodes: ["REJECTED_BUDGET_EXCEEDED"],
            mismatches: [
              {
                code: "REJECTED_BUDGET_EXCEEDED",
                requirement: "budget",
                detail: budgetEval.detail,
                hard: true,
              },
            ],
          },
        };
      }
    }
  }

  const weights = computeWeights(objective, req.preferences);
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
  const cost = costScore(c, req);
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
  requirements: CapabilityRequirements | RoutingIntent,
  options: RouteMediaOptions = {}
): MediaRoutingDecision {
  const req = normalizeRoutingIntentToRequirements(requirements);
  const objective = req.preferences?.objective || "balanced";
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
    canonicalIndex: number;
  }> = [];

  // Manual override path
  const manualId = options.manualProviderId || req.preferences?.preferredProviderId;
  const manualModel = options.manualModelId || req.preferences?.preferredModelId;
  if (req.preferences?.manualOverride && manualId) {
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
    const { breakdown, match, rejected: rej } = scoreCandidate(manual, req, objective);
    if (rej) {
      return {
        rejected: [rej],
        fallbackPlan: [],
        reasonCodes: [...rej.reasonCodes, "REJECTED_MANUAL_MISMATCH"],
        objective,
        capabilityMatch: match,
      };
    }
    const reasonCodes = ["MANUAL_OVERRIDE", "CAPABILITY_MATCH", ...match.reasonCodes];
    const resolvedModel: ResolvedModelSummary = {
      providerId: manual.providerId,
      modelId: manual.modelId,
      score: breakdown.finalScore,
      reasons: {
        capabilityFit: match.matched.map((m) => m.requirement),
        strengths: Array.from(new Set(reasonCodes)).filter((r) => !r.startsWith("REJECTED")),
        tradeoffs: match.warnings.map((w) => w.message),
      },
      estimatedCost:
        manual.economics?.estimatedUsdPerGeneration ??
        CostEngine.estimateCost({
          providerId: manual.providerId,
          modelId: manual.modelId,
          modality: req.modality,
          durationSeconds: req.output?.durationSeconds,
          resolution: req.output?.resolution,
          aspectRatio: req.output?.aspectRatio,
          includeAudio: req.output?.requiresNativeAudio || req.audio?.required,
        }).amount ??
        undefined,
    };
    return {
      selected: manual,
      rejected: [],
      scoreBreakdown: breakdown,
      capabilityMatch: match,
      fallbackPlan: [],
      reasonCodes,
      objective,
      resolvedModel,
    };
  }

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const { breakdown, match, rejected: rej } = scoreCandidate(c, req, objective);
    if (rej) {
      rejected.push(rej);
      continue;
    }
    scored.push({ candidate: c, breakdown, match, canonicalIndex: i });
  }

  // Deterministic tie-breaking:
  // 1. finalScore desc
  // 2. reliability desc
  // 3. quality desc
  // 4. canonical priority index asc (stable catalog order)
  scored.sort((a, b) => {
    const diff = b.breakdown.finalScore - a.breakdown.finalScore;
    if (Math.abs(diff) > 0.0001) return diff;
    const relDiff = b.breakdown.reliability - a.breakdown.reliability;
    if (Math.abs(relDiff) > 0.0001) return relDiff;
    const qualDiff = b.breakdown.quality - a.breakdown.quality;
    if (Math.abs(qualDiff) > 0.0001) return qualDiff;
    return a.canonicalIndex - b.canonicalIndex;
  });

  // Soft preference boost already in score; if preferred exists in scored, optionally pin when not manual
  if (req.preferences?.preferredProviderId) {
    const pref = scored.find((s) => s.candidate.providerId === req.preferences?.preferredProviderId);
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
    quality: fallbackQuality(req, s.candidate),
    reasonCodes: ["FALLBACK_SELECTED", "CAPABILITY_MATCH"] as RoutingReasonCode[],
    score: s.breakdown.finalScore,
  }));

  const reasonCodes = [
    "CAPABILITY_MATCH",
    ...best.match.reasonCodes,
    ...(req.preferences?.preferredProviderId === best.candidate.providerId
      ? (["PREFERRED_PROVIDER"] as const)
      : []),
    ...(req.preferences?.preferredModelId === best.candidate.modelId
      ? (["PREFERRED_MODEL"] as const)
      : []),
    ...(objective === "cost_first" ? (["LOWER_COST"] as const) : []),
    ...(objective === "speed_first" ? (["LOWER_LATENCY"] as const) : []),
    ...(objective === "quality_first" ? (["HIGHER_QUALITY"] as const) : []),
    ...(best.candidate.health?.status === "healthy" ? (["HEALTHY_PROVIDER"] as const) : []),
    ...(req.preferences?.productionMode === "Cinematic" || req.preferences?.productionMode === "deep"
      ? (["PRODUCTION_MODE_CINEMATIC"] as const)
      : []),
    ...(req.preferences?.productionMode === "Economy" || req.preferences?.productionMode === "express"
      ? (["PRODUCTION_MODE_ECONOMY"] as const)
      : []),
    ...(req.preferences?.productionMode === "Maximum"
      ? (["PRODUCTION_MODE_MAXIMUM"] as const)
      : []),
    ...(req.preferences?.productionMode === "Balanced" || req.preferences?.productionMode === "standard"
      ? (["PRODUCTION_MODE_BALANCED"] as const)
      : []),
    ...(req.preferences?.priority === "hero" ? (["PRIORITY_HERO"] as const) : []),
    ...(req.preferences?.priority === "supporting" ? (["PRIORITY_SUPPORTING"] as const) : []),
  ];

  const resolvedModel: ResolvedModelSummary = {
    providerId: best.candidate.providerId,
    modelId: best.candidate.modelId,
    score: best.breakdown.finalScore,
    reasons: {
      capabilityFit: best.match.matched.map((m) => m.requirement),
      strengths: Array.from(new Set(reasonCodes)).filter((r) => !r.startsWith("REJECTED")),
      tradeoffs: best.match.warnings.map((w) => w.message),
    },
    estimatedCost:
      best.candidate.economics?.estimatedUsdPerGeneration ??
      CostEngine.estimateCost({
        providerId: best.candidate.providerId,
        modelId: best.candidate.modelId,
        modality: req.modality,
        durationSeconds: req.output?.durationSeconds,
        resolution: req.output?.resolution,
        aspectRatio: req.output?.aspectRatio,
        includeAudio: req.output?.requiresNativeAudio || req.audio?.required,
      }).amount ??
      undefined,
  };

  return {
    selected: best.candidate,
    rejected,
    scoreBreakdown: best.breakdown,
    capabilityMatch: best.match,
    fallbackPlan,
    reasonCodes: Array.from(new Set(reasonCodes)),
    objective,
    resolvedModel,
  };
}

/**
 * Canonical routing authority entry point.
 * Given a RoutingIntent or CapabilityRequirements, resolves the authoritative
 * providerId + modelId with explanations.
 */
export function resolveCanonicalModel(
  intentOrReq: RoutingIntent | CapabilityRequirements,
  options: RouteMediaOptions = {}
): ResolvedModelRouting {
  const req = normalizeRoutingIntentToRequirements(intentOrReq);
  const decision = routeMediaCapability(req, options);
  if (!decision.selected || !decision.resolvedModel) {
    const rejectReasons = decision.rejected.flatMap((r) => r.reasonCodes);
    const failReason = decision.reasonCodes.join("; ") || rejectReasons.join("; ") || "NO_COMPATIBLE_CANDIDATE";
    throw new Error(`Canonical Model Routing failed: ${failReason}`);
  }
  return {
    providerId: decision.resolvedModel.providerId,
    modelId: decision.resolvedModel.modelId,
    score: decision.resolvedModel.score,
    reasons: decision.resolvedModel.reasons,
    reasonCodes: decision.reasonCodes,
    estimatedCost: decision.resolvedModel.estimatedCost,
    decision,
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
