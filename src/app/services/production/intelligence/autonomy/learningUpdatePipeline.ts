/**
 * Canonical Phase 11 learning update pipeline.
 * Observe → analyze → learn → decay → validate → persist → adaptive advice.
 * Reuses performance/* only — no parallel learning engine.
 */

import {
  analyzePerformance,
  accumulateLearnings,
  applyDecay,
  selectLearningsForContext,
  buildAdaptiveAdvice,
  persistLearningsAsMemory,
  memoryItemsFromLearnings,
  summarizeReliability,
  reliabilityToLearning,
  type CreativeLearning,
  type AdaptiveStrategyAdvice,
} from "../performance";
import { filterLearningsByHardConstraints } from "./constraintGuard";
import { captureLearningSnapshot, recordDecision } from "./lineage";
import { deriveProviderPreferences } from "./providerLearningBridge";
import { deriveRepairPreferences } from "./repairLearningBridge";
import type {
  LearningUpdateInput,
  LearningUpdateResult,
  ProductionOutcomeRecord,
  DecisionRecord,
} from "./types";

const MIN_EVIDENCE_FOR_VALIDATED = 3;

function quarantineWeak(learnings: CreativeLearning[]): {
  validated: CreativeLearning[];
  quarantined: CreativeLearning[];
} {
  const validated: CreativeLearning[] = [];
  const quarantined: CreativeLearning[] = [];
  for (const l of learnings) {
    const n = l.evidenceCount ?? l.confidence?.evidenceCount ?? 0;
    if (n < MIN_EVIDENCE_FOR_VALIDATED) quarantined.push(l);
    else validated.push(l);
  }
  return { validated, quarantined };
}

export function buildOutcomeFromLifecycle(input: {
  productionId: string;
  lifecycle?: {
    ok?: boolean;
    completed?: boolean;
    deliverableReady?: boolean;
    cost?: { estimated?: number; actual?: number };
    timing?: { durationMs?: number };
  };
  qualityScore?: number;
  audiencePerformanceScore?: number;
  qcFailureCodes?: string[];
  repairCount?: number;
  providers?: string[];
  models?: string[];
  platform?: string;
  genre?: string;
  format?: string;
  durationSec?: number;
  hookType?: string;
  creativeStrategyVersion?: string;
  learningSnapshotVersion?: number;
  now?: Date;
}): ProductionOutcomeRecord {
  return {
    productionId: input.productionId,
    creativeStrategyVersion: input.creativeStrategyVersion,
    learningSnapshotVersion: input.learningSnapshotVersion,
    platform: input.platform,
    genre: input.genre,
    format: input.format,
    durationSec: input.durationSec,
    hookType: input.hookType,
    providers: input.providers,
    models: input.models,
    repairCount: input.repairCount,
    qcFailureCodes: input.qcFailureCodes,
    estimatedCost: input.lifecycle?.cost?.estimated,
    actualCost: input.lifecycle?.cost?.actual,
    productionDurationMs: input.lifecycle?.timing?.durationMs,
    qualityScore: input.qualityScore,
    // Missing audience metrics remain undefined (= UNKNOWN), never 0
    audiencePerformanceScore: input.audiencePerformanceScore,
    deliverableReady: input.lifecycle?.deliverableReady,
    completed: input.lifecycle?.completed,
    createdAt: (input.now || new Date()).toISOString(),
  };
}

export function runLearningUpdatePipeline(input: LearningUpdateInput): LearningUpdateResult {
  const now = input.now || new Date();
  const decisions: DecisionRecord[] = [];
  const analyses = [];

  for (const snapshot of input.snapshots) {
    analyses.push(
      analyzePerformance({
        snapshot,
        productionQuality:
          input.productionQualityScore != null
            ? {
                score: input.productionQualityScore,
                label:
                  input.productionQualityScore >= 0.75
                    ? "high"
                    : input.productionQualityScore >= 0.45
                      ? "mixed"
                      : "low",
                issueCodes: input.qcFailureCodes || [],
                notes: ["quality_score_distinct_from_audience_performance"],
              }
            : undefined,
      })
    );
  }

  const scope = input.scope || "account";
  const accumulated = accumulateLearnings({
    analyses: analyses as any,
    snapshots: input.snapshots,
    scope: scope as any,
    scopeKey: input.scopeKey || input.accountId || input.brandId,
    minEvidence: MIN_EVIDENCE_FOR_VALIDATED,
  });

  const reliabilitySignals = summarizeReliability(
    (input.reliability || []).map((r) => ({
      strategyKey: r.strategyKey,
      generationStrategy: r.generationStrategy,
      attempts: r.attempts,
      successes: r.successes,
      retries: r.retries,
      qcFailureCodes: r.qcFailureCodes,
    }))
  );
  const reliabilityLearnings = reliabilitySignals.map((s) =>
    reliabilityToLearning(s, input.scopeKey || input.brandId)
  );

  const decayed = [...(input.priorLearnings || []), ...accumulated, ...reliabilityLearnings].map((l) =>
    applyDecay(l, now)
  );

  const { allowed, blocked } = filterLearningsByHardConstraints(decayed, {
    ...input.hardConstraints,
    explicitUserInstructions: [
      ...(input.hardConstraints?.explicitUserInstructions || []),
      ...(input.explicitUserInstructions || []),
    ],
  });

  for (const b of blocked) {
    decisions.push(
      recordDecision({
        kind: "escalation",
        decision: "reject_learning",
        reason: b.reasons.join("; "),
        evidenceIds: [b.learning.id],
        productionId: input.productionId,
      })
    );
  }

  const { validated, quarantined } = quarantineWeak(allowed);

  decisions.push(
    recordDecision({
      kind: "learning_update",
      decision: "pipeline_complete",
      reason: `validated=${validated.length}; quarantined=${quarantined.length}; blocked=${blocked.length}`,
      evidenceIds: validated.map((l) => l.id),
      productionId: input.productionId,
      confidence: validated[0]?.confidence?.score,
    })
  );

  const selected = selectLearningsForContext(validated, {
    accountId: input.accountId,
    platform: input.platform,
    brandId: input.brandId,
    seriesId: input.seriesId,
  });

  const advice: AdaptiveStrategyAdvice = buildAdaptiveAdvice({
    learnings: selected,
    accountId: input.accountId,
    platform: input.platform,
    brandId: input.brandId,
    seriesId: input.seriesId,
    explicitUserInstructions: input.explicitUserInstructions,
  });

  decisions.push(
    recordDecision({
      kind: "adaptive_advice",
      decision: advice.overriddenByExplicitUserIntent
        ? "deferred_to_explicit_intent"
        : "advice_ready",
      reason: advice.notes.slice(0, 3).join(" | ") || "adaptive advice built",
      evidenceIds: advice.evidence.map((e) => e.id),
      productionId: input.productionId,
      confidence: advice.confidenceFloor,
    })
  );

  const snapshot = captureLearningSnapshot(validated, {
    notes: [
      `production=${input.productionId}`,
      `analyses=${analyses.length}`,
      `qualityScore=${input.productionQualityScore ?? "UNKNOWN"}`,
    ],
    now,
  });

  const memoryItems = persistLearningsAsMemory(validated);

  const providerPreferences = deriveProviderPreferences(
    (input.reliability || []).map((r) => ({
      strategyKey: r.strategyKey,
      generationStrategy: r.generationStrategy,
      attempts: r.attempts,
      successes: r.successes,
      retries: r.retries,
      qcFailureCodes: r.qcFailureCodes,
      providerId: r.providerId,
      modelId: r.modelId,
      modelVersion: r.modelVersion,
    }))
  );

  const repairPreferences = deriveRepairPreferences(input.repairOutcomes || []);

  const outcome: ProductionOutcomeRecord = {
    productionId: input.productionId,
    learningSnapshotVersion: snapshot.version,
    platform: input.platform,
    qcFailureCodes: input.qcFailureCodes,
    qualityScore: input.productionQualityScore,
    audiencePerformanceScore: input.outcome?.audiencePerformanceScore,
    createdAt: now.toISOString(),
    ...(input.outcome || {}),
  };

  return {
    analyses,
    learnings: validated,
    advice,
    memoryItems: memoryItems.length ? memoryItems : memoryItemsFromLearnings(validated),
    quarantined,
    snapshot,
    decisions,
    outcome,
    providerPreferences,
    repairPreferences,
  };
}

export function getRelevantLearningForDirector(params: {
  learnings: CreativeLearning[];
  platform?: string;
  seriesId?: string;
  accountId?: string;
  brandId?: string;
  hardConstraints?: LearningUpdateInput["hardConstraints"];
  explicitUserInstructions?: string[];
}): AdaptiveStrategyAdvice {
  const { allowed } = filterLearningsByHardConstraints(params.learnings, {
    ...params.hardConstraints,
    explicitUserInstructions: [
      ...(params.hardConstraints?.explicitUserInstructions || []),
      ...(params.explicitUserInstructions || []),
    ],
  });
  const selected = selectLearningsForContext(allowed, {
    accountId: params.accountId,
    platform: params.platform,
    brandId: params.brandId,
    seriesId: params.seriesId,
  });
  return buildAdaptiveAdvice({
    learnings: selected,
    accountId: params.accountId,
    platform: params.platform,
    brandId: params.brandId,
    seriesId: params.seriesId,
    explicitUserInstructions: params.explicitUserInstructions,
  });
}
