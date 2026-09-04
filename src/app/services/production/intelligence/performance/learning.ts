/**
 * Creative learning — evidence accumulation, confidence, decay, scope.
 * Reuses MemoryItem bridge; does not create a separate memory store.
 */

import type {
  CreativeLearning,
  LearningConfidence,
  LearningPatternKind,
  LearningScope,
  LearningProvenance,
  PerformanceAnalysis,
  PerformanceSnapshot,
  CreativeDNA,
  SeriesPattern,
  EvidenceStrength,
} from "./types";

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface DecayPolicy {
  halfLifeDays: number;
  reviewAfterDays: number;
  minConfidenceFloor: number;
}

export const DEFAULT_DECAY_POLICY: DecayPolicy = {
  halfLifeDays: 90,
  reviewAfterDays: 45,
  minConfidenceFloor: 0.15,
};

export function computeLearningConfidence(params: {
  evidenceCount: number;
  timestamps: string[];
  consistency: number;
  scope: LearningScope;
  now?: Date;
  policy?: DecayPolicy;
}): LearningConfidence {
  const policy = params.policy || DEFAULT_DECAY_POLICY;
  const now = params.now || new Date();
  const evidenceCount = Math.max(0, params.evidenceCount);

  let recency = 0.5;
  if (params.timestamps.length) {
    const latest = Math.max(...params.timestamps.map((t) => Date.parse(t) || 0));
    const ageDays = Math.max(0, (now.getTime() - latest) / (24 * 60 * 60 * 1000));
    recency = Math.pow(0.5, ageDays / policy.halfLifeDays);
  }

  const evidenceFactor = Math.min(1, evidenceCount / 10);
  const scopeBoost =
    params.scope === "account" || params.scope === "brand"
      ? 1
      : params.scope === "platform"
        ? 0.9
        : params.scope === "series"
          ? 0.95
          : 0.75;

  const score = Math.max(
    policy.minConfidenceFloor,
    Math.min(1, evidenceFactor * 0.45 + recency * 0.3 + params.consistency * 0.25) * scopeBoost
  );

  return {
    score,
    evidenceCount,
    recency,
    consistency: params.consistency,
    scope: params.scope,
  };
}

export function applyDecay(
  learning: CreativeLearning,
  now: Date = new Date(),
  policy: DecayPolicy = DEFAULT_DECAY_POLICY
): CreativeLearning {
  const conf = computeLearningConfidence({
    evidenceCount: learning.evidenceCount,
    timestamps: [learning.updatedAt, learning.createdAt],
    consistency: learning.confidence.consistency,
    scope: learning.scope,
    now,
    policy,
  });

  const reviewMs = policy.reviewAfterDays * 24 * 60 * 60 * 1000;
  const updatedAt = Date.parse(learning.updatedAt) || 0;
  const stale = now.getTime() - updatedAt > reviewMs || conf.score <= policy.minConfidenceFloor;

  return {
    ...learning,
    confidence: conf,
    stale,
    reviewAfterAt: new Date(updatedAt + reviewMs).toISOString(),
  };
}

export function supersedeLearning(
  prior: CreativeLearning,
  replacement: CreativeLearning
): { prior: CreativeLearning; current: CreativeLearning } {
  return {
    prior: { ...prior, supersededBy: replacement.id, stale: true },
    current: replacement,
  };
}

export function createLearning(params: {
  kind: LearningPatternKind;
  scope: LearningScope;
  scopeKey?: string;
  claim: string;
  recommendation?: string;
  evidenceCount: number;
  supportingObservationIds?: string[];
  supportingSnapshotIds?: string[];
  productionIds?: string[];
  provenance: LearningProvenance;
  consistency?: number;
  timestamps?: string[];
  explorationHint?: boolean;
  now?: Date;
}): CreativeLearning {
  const now = params.now || new Date();
  const iso = now.toISOString();
  const confidence = computeLearningConfidence({
    evidenceCount: params.evidenceCount,
    timestamps: params.timestamps || [iso],
    consistency: params.consistency ?? 0.6,
    scope: params.scope,
    now,
  });

  return {
    id: newId("clearn"),
    kind: params.kind,
    scope: params.scope,
    scopeKey: params.scopeKey,
    claim: params.claim,
    recommendation: params.recommendation,
    confidence,
    evidenceCount: params.evidenceCount,
    supportingObservationIds: params.supportingObservationIds || [],
    supportingSnapshotIds: params.supportingSnapshotIds || [],
    productionIds: params.productionIds,
    provenance: params.provenance,
    createdAt: iso,
    updatedAt: iso,
    explorationHint: params.explorationHint,
  };
}

/**
 * Accumulate hook/format/duration patterns from multiple analyses.
 * Requires sufficient observations — never promotes a single viral into a rule.
 */
export function accumulateLearnings(params: {
  analyses: PerformanceAnalysis[];
  snapshots: PerformanceSnapshot[];
  dnaBySnapshotId?: Record<string, CreativeDNA>;
  scope: LearningScope;
  scopeKey?: string;
  minEvidence?: number;
}): CreativeLearning[] {
  const minEvidence = params.minEvidence ?? 3;
  const learnings: CreativeLearning[] = [];
  const dnaMap = params.dnaBySnapshotId || {};

  const hookBuckets = new Map<string, { strong: number; weak: number; ids: string[]; snapIds: string[] }>();
  const formatBuckets = new Map<string, { strong: number; weak: number; ids: string[]; snapIds: string[] }>();
  const durationBuckets = new Map<string, { strong: number; weak: number; ids: string[]; snapIds: string[] }>();

  for (const a of params.analyses) {
    const dna = dnaMap[a.snapshotId];
    const label = a.audiencePerformance.label;
    if (label === "unknown") continue;

    const bump = (
      map: Map<string, { strong: number; weak: number; ids: string[]; snapIds: string[] }>,
      key: string
    ) => {
      const cur = map.get(key) || { strong: 0, weak: 0, ids: [], snapIds: [] };
      if (label === "strong") cur.strong++;
      else if (label === "weak") cur.weak++;
      cur.ids.push(a.id);
      cur.snapIds.push(a.snapshotId);
      map.set(key, cur);
    };

    if (dna?.hookType) bump(hookBuckets, dna.hookType);
    if (dna?.format) bump(formatBuckets, dna.format);
    if (dna?.durationSec != null) {
      const bucket =
        dna.durationSec <= 30 ? "0-30s" : dna.durationSec <= 60 ? "31-60s" : dna.durationSec <= 180 ? "61-180s" : "180s+";
      bump(durationBuckets, bucket);
    }
  }

  const emitPattern = (
    kind: LearningPatternKind,
    buckets: Map<string, { strong: number; weak: number; ids: string[]; snapIds: string[] }>,
    labelOf: (key: string, winner: "strong" | "weak") => { claim: string; recommendation?: string }
  ) => {
    for (const [key, b] of buckets) {
      const total = b.strong + b.weak;
      if (total < minEvidence) continue;
      const winner: "strong" | "weak" = b.strong >= b.weak ? "strong" : "weak";
      if (winner === "strong" && b.strong < Math.ceil(minEvidence * 0.6)) continue;
      const consistency = Math.max(b.strong, b.weak) / total;
      const text = labelOf(key, winner);
      learnings.push(
        createLearning({
          kind,
          scope: params.scope,
          scopeKey: params.scopeKey,
          claim: text.claim,
          recommendation: text.recommendation,
          evidenceCount: total,
          supportingObservationIds: b.ids,
          supportingSnapshotIds: b.snapIds,
          consistency,
          provenance: {
            evidenceType:
              params.scope === "account" || params.scope === "brand"
                ? "account_specific"
                : params.scope === "platform"
                  ? "platform"
                  : "mixed",
            observationIds: b.ids,
            snapshotIds: b.snapIds,
            notes: [`pattern_key=${key}`, `strong=${b.strong}`, `weak=${b.weak}`],
          },
        })
      );
    }
  };

  emitPattern("hook_pattern", hookBuckets, (key, winner) =>
    winner === "strong"
      ? {
          claim: `Hook type "${key}" correlates with stronger audience response in this ${params.scope} scope`,
          recommendation: `Prefer testing "${key}" openings when objectives align`,
        }
      : {
          claim: `Hook type "${key}" correlates with weaker audience response in this ${params.scope} scope`,
          recommendation: `Consider alternatives to "${key}" in controlled experiments`,
        }
  );

  emitPattern("format_pattern", formatBuckets, (key, winner) =>
    winner === "strong"
      ? {
          claim: `Format "${key}" correlates with stronger outcomes for this ${params.scope}`,
          recommendation: `Weight "${key}" higher among credible formats`,
        }
      : {
          claim: `Format "${key}" correlates with weaker outcomes for this ${params.scope}`,
          recommendation: `Explore alternate formats with the same topic`,
        }
  );

  emitPattern("duration_pattern", durationBuckets, (key, winner) =>
    winner === "strong"
      ? {
          claim: `Duration band ${key} correlates with stronger completion/engagement here`,
          recommendation: `Duration band ${key} is worth exploiting — still allow longer/shorter tests`,
        }
      : {
          claim: `Duration band ${key} correlates with weaker outcomes here`,
          recommendation: `Do not assume shorter is always better — test adjacent bands`,
        }
  );

  return learnings;
}

export function detectSeriesPattern(params: {
  seriesId: string;
  episodeIds: string[];
  hookTypes: string[];
  subjects: string[];
  structures: string[];
  performanceLabels: Array<"strong" | "mixed" | "weak" | "unknown">;
}): SeriesPattern | null {
  if (params.episodeIds.length < 3) return null;

  const strongCount = params.performanceLabels.filter((l) => l === "strong").length;
  if (strongCount < 2) return null;

  const freq = (arr: string[]) => {
    const m = new Map<string, number>();
    for (const x of arr.filter(Boolean)) m.set(x, (m.get(x) || 0) + 1);
    return [...m.entries()].filter(([, n]) => n >= 2).map(([k]) => k);
  };

  const recurringHooks = freq(params.hookTypes);
  const recurringSubjects = freq(params.subjects);
  const recurringStructures = freq(params.structures);

  if (!recurringHooks.length && !recurringSubjects.length && !recurringStructures.length) {
    return null;
  }

  const recent = params.performanceLabels.slice(-3);
  const diminishingReturns =
    recent.filter((l) => l === "weak").length >= 2 &&
    params.performanceLabels.slice(0, -3).filter((l) => l === "strong").length >= 2;

  return {
    seriesId: params.seriesId,
    episodeIds: params.episodeIds,
    recurringHookTypes: recurringHooks,
    recurringSubjects,
    recurringStructures,
    progressionNotes: diminishingReturns
      ? ["Early episodes outperformed recent ones — possible diminishing returns"]
      : ["Recurring creative patterns detected across episodes"],
    diminishingReturns,
    continuationOpportunity: strongCount >= 3 && !diminishingReturns,
    evidenceCount: params.episodeIds.length,
    confidence: Math.min(1, strongCount / params.episodeIds.length + 0.2),
  };
}

export function strengthLabel(score: number): EvidenceStrength {
  if (score >= 0.75) return "observed";
  if (score >= 0.55) return "correlated";
  if (score >= 0.4) return "likely";
  if (score >= 0.25) return "uncertain";
  return "insufficient_data";
}

/** Prefer narrowest reliable scope first */
export function selectLearningsForContext(
  learnings: CreativeLearning[],
  ctx: { accountId?: string; platform?: string; brandId?: string; seriesId?: string }
): CreativeLearning[] {
  const active = learnings.filter((l) => !l.stale && !l.supersededBy);
  const scored = active.map((l) => {
    let rank = 0;
    if (l.scope === "account" && l.scopeKey && l.scopeKey === ctx.accountId) rank = 50;
    else if (l.scope === "series" && l.scopeKey === ctx.seriesId) rank = 45;
    else if (l.scope === "brand" && l.scopeKey === ctx.brandId) rank = 40;
    else if (l.scope === "platform" && l.scopeKey === ctx.platform) rank = 30;
    else if (l.scope === "global") rank = 10;
    else rank = 0;
    return { l, rank: rank + l.confidence.score * 10 };
  });
  return scored
    .filter((s) => s.rank > 0)
    .sort((a, b) => b.rank - a.rank)
    .map((s) => s.l);
}
