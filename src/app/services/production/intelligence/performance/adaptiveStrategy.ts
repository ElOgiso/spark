/**
 * Adaptive Creative Strategy — learning influences Phase 7 without overriding explicit intent.
 */

import type { CreativeStrategy, HookStrategy } from "../strategy/types";
import type {
  AdaptiveStrategyAdvice,
  CreativeLearning,
  ExplorationPolicy,
} from "./types";
import { selectLearningsForContext } from "./learning";

export const DEFAULT_EXPLORATION_POLICY: ExplorationPolicy = {
  exploitationWeight: 0.75,
  explorationWeight: 0.25,
  minEvidenceForExploit: 3,
  preferProvenWhenConfidenceAbove: 0.55,
};

export function buildAdaptiveAdvice(params: {
  learnings: CreativeLearning[];
  accountId?: string;
  platform?: string;
  brandId?: string;
  seriesId?: string;
  explicitUserInstructions?: string[];
  policy?: ExplorationPolicy;
}): AdaptiveStrategyAdvice {
  const policy = params.policy || DEFAULT_EXPLORATION_POLICY;
  const selected = selectLearningsForContext(params.learnings, {
    accountId: params.accountId,
    platform: params.platform,
    brandId: params.brandId,
    seriesId: params.seriesId,
  });

  const explicit = (params.explicitUserInstructions || []).filter(Boolean);
  const overriddenByExplicitUserIntent = explicit.length > 0;

  const recommendations: string[] = [];
  const explorationSuggestions: string[] = [];
  const notes: string[] = [];

  for (const l of selected) {
    if (l.confidence.evidenceCount < policy.minEvidenceForExploit) {
      notes.push(`Weak evidence skipped for exploit: ${l.claim.slice(0, 80)}`);
      continue;
    }
    if (l.confidence.score < policy.preferProvenWhenConfidenceAbove) {
      notes.push(`Low confidence learning retained as exploration only: ${l.kind}`);
      if (l.recommendation) explorationSuggestions.push(l.recommendation);
      continue;
    }
    if (l.recommendation) recommendations.push(l.recommendation);
    else recommendations.push(l.claim);
    if (l.explorationHint && l.recommendation) {
      explorationSuggestions.push(`Also test an alternative near: ${l.recommendation}`);
    }
  }

  // Always keep a small exploration budget when we have proven strategies
  if (recommendations.length && explorationSuggestions.length === 0) {
    explorationSuggestions.push(
      "Keep a small controlled experiment budget — do not only repeat the last successful post"
    );
  }

  if (overriddenByExplicitUserIntent) {
    notes.push("Explicit user instructions take precedence over learned recommendations");
  }

  if (!selected.length) {
    notes.push("SPARK does not have enough evidence to recommend a change yet.");
  }

  return {
    evidence: selected,
    recommendations: overriddenByExplicitUserIntent ? [] : recommendations,
    explorationSuggestions: overriddenByExplicitUserIntent
      ? explorationSuggestions.slice(0, 1)
      : explorationSuggestions,
    confidenceFloor: policy.preferProvenWhenConfidenceAbove,
    overriddenByExplicitUserIntent,
    notes,
  };
}

/**
 * Apply adaptive advice onto an existing CreativeStrategy (immutable return).
 * Does not create creativeDirectorV2 — extends Phase 7 strategy objects.
 */
export function applyLearningsToStrategy(
  strategy: CreativeStrategy,
  advice: AdaptiveStrategyAdvice
): CreativeStrategy {
  if (advice.overriddenByExplicitUserIntent) {
    return {
      ...strategy,
      rationale: [
        ...strategy.rationale,
        "Historical creative learning deferred due to explicit user instructions",
      ],
      explanations: [
        ...strategy.explanations,
        {
          decision: "performance_learning",
          reasons: advice.notes,
          evidence: advice.evidence.map((e) => e.id),
          confidence: 0,
          alternatives: [],
        },
      ],
    };
  }

  let hook: HookStrategy = strategy.hook;
  let format = strategy.format;
  const rationale = [...strategy.rationale];
  const nextTests: string[] = [];

  for (const rec of advice.recommendations) {
    const hookPref = rec.match(/Prefer testing "([^"]+)" openings/i) || rec.match(/Hook type "([^"]+)"/i);
    if (hookPref && hook.confidence < 0.95) {
      hook = {
        ...hook,
        type: hookPref[1],
        rationale: `${hook.rationale}; adjusted from creative learning`,
        confidence: Math.min(0.92, hook.confidence + 0.05),
      };
      rationale.push(`Learning influenced hook toward ${hookPref[1]}`);
    }
    const formatPref = rec.match(/Weight "([^"]+)" higher/i) || rec.match(/Format "([^"]+)"/i);
    if (formatPref && !advice.overriddenByExplicitUserIntent) {
      // Only nudge when learning is strong — keep as alternative if conflicting
      if (format !== formatPref[1]) {
        rationale.push(`Learning suggests format weight toward ${formatPref[1]} (kept primary unless already matching)`);
      }
    }
  }

  for (const ex of advice.explorationSuggestions.slice(0, 2)) {
    nextTests.push(ex);
  }

  return {
    ...strategy,
    hook,
    format,
    rationale,
    explanations: [
      ...strategy.explanations,
      {
        decision: "performance_learning",
        reasons: [...advice.recommendations.slice(0, 3), ...advice.notes.slice(0, 2)],
        evidence: advice.evidence.map((e) => `${e.id}:${e.kind}`),
        confidence: advice.evidence[0]?.confidence.score ?? 0,
        alternatives: advice.explorationSuggestions.slice(0, 3),
      },
    ],
    originalityRequirements: [
      ...strategy.originalityRequirements,
      ...(nextTests.length
        ? ["Maintain exploration: " + nextTests[0]]
        : ["Maintain exploration budget alongside proven patterns"]),
    ],
  };
}

export function mergeConflictingEvidence(learnings: CreativeLearning[]): {
  resolved: CreativeLearning[];
  conflicts: string[];
} {
  const byKindKey = new Map<string, CreativeLearning[]>();
  for (const l of learnings) {
    const k = `${l.kind}:${l.scope}:${l.scopeKey || ""}`;
    const arr = byKindKey.get(k) || [];
    arr.push(l);
    byKindKey.set(k, arr);
  }

  const resolved: CreativeLearning[] = [];
  const conflicts: string[] = [];

  for (const [, group] of byKindKey) {
    if (group.length === 1) {
      resolved.push(group[0]);
      continue;
    }
    // Prefer higher confidence + more evidence; mark conflict
    const sorted = [...group].sort(
      (a, b) =>
        b.confidence.score * 10 + b.evidenceCount - (a.confidence.score * 10 + a.evidenceCount)
    );
    resolved.push(sorted[0]);
    if (sorted.length > 1) {
      conflicts.push(
        `Conflicting ${sorted[0].kind} evidence — kept higher-confidence learning ${sorted[0].id}`
      );
    }
  }

  return { resolved, conflicts };
}
