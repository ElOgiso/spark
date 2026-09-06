/**
 * Autonomous production planning — Creative Director remains the decision layer.
 */

import { createProductionPlan, type CreateProductionPlanInput } from "../productionOrchestrator";
import type { CreativeLearning } from "../performance";
import { evaluateAutonomyGate, shouldExecuteAutonomously } from "./autonomyPolicy";
import { filterLearningsByHardConstraints } from "./constraintGuard";
import { captureLearningSnapshot, recordDecision } from "./lineage";
import { getRelevantLearningForDirector } from "./learningUpdatePipeline";
import type {
  AutonomousPlan,
  AutonomyPolicy,
  HardConstraintSet,
  DecisionRecord,
} from "./types";

export function buildAutonomousPlan(input: {
  objective: string;
  learnings?: CreativeLearning[];
  policy?: Partial<AutonomyPolicy>;
  estimatedCostUsd?: number;
  generationsToday?: number;
  predictedQualityRisk?: number;
  confidence?: number;
  platform?: string;
  seriesId?: string;
  accountId?: string;
  brandId?: string;
  hardConstraints?: HardConstraintSet;
  explicitUserInstructions?: string[];
  explorationDraw?: number;
  conflictingLearning?: boolean;
}): AutonomousPlan {
  const decisions: DecisionRecord[] = [];
  const raw = input.learnings || [];
  const { allowed, blocked } = filterLearningsByHardConstraints(raw, {
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
        decision: "blocked_hard_constraint",
        reason: b.reasons.join("; "),
        evidenceIds: [b.learning.id],
      })
    );
  }

  const advice = getRelevantLearningForDirector({
    learnings: allowed,
    platform: input.platform,
    seriesId: input.seriesId,
    accountId: input.accountId,
    brandId: input.brandId,
    hardConstraints: input.hardConstraints,
    explicitUserInstructions: input.explicitUserInstructions,
  });

  const snapshot = captureLearningSnapshot(allowed, {
    notes: [`objective=${input.objective}`],
  });

  const gate = evaluateAutonomyGate({
    policy: input.policy,
    estimatedCostUsd: input.estimatedCostUsd,
    generationsToday: input.generationsToday,
    predictedQualityRisk: input.predictedQualityRisk,
    confidence: input.confidence ?? advice.confidenceFloor,
    conflictingLearning: input.conflictingLearning || blocked.length > 0,
    explorationDraw: input.explorationDraw,
  });

  decisions.push(
    recordDecision({
      kind: "autonomy_gate",
      decision: gate.decision,
      reason: gate.reasons.join("; "),
      confidence: gate.confidence,
      policy: gate.policy.level,
      learningSnapshotId: snapshot.id,
      alternatives: ["proceed", "explore", "escalate_human_review", "pause_budget", "pause_quality"],
      selectedAction: gate.decision,
    })
  );

  decisions.push(
    recordDecision({
      kind: "adaptive_advice",
      decision: advice.recommendations[0] || "no_recommendation",
      reason: advice.notes[0] || "adaptive advice",
      evidenceIds: advice.evidence.map((e) => e.id),
      confidence: advice.confidenceFloor,
      learningSnapshotId: snapshot.id,
    })
  );

  const risks: string[] = [...gate.reasons];
  if (advice.explorationSuggestions.length) {
    risks.push(`exploration_candidates=${advice.explorationSuggestions.length}`);
  }

  return {
    objective: input.objective,
    strategySummary: advice.recommendations.slice(0, 3).join(" · ") || "baseline strategy",
    relevantLearning: allowed,
    advice,
    experiments: advice.explorationSuggestions.slice(0, 3),
    expectedCostUsd: input.estimatedCostUsd,
    risks,
    confidence: input.confidence ?? advice.confidenceFloor,
    learningSnapshot: snapshot,
    gate,
    decisions,
  };
}

/** Plan production with learning influence via Creative Director (no media execution). */
export function planProductionWithLearning(
  input: CreateProductionPlanInput & {
    creativeLearnings?: CreativeLearning[];
    hardConstraints?: HardConstraintSet;
    autonomyPolicy?: Partial<AutonomyPolicy>;
    estimatedCostUsd?: number;
    generationsToday?: number;
    explorationDraw?: number;
  }
) {
  const plan = buildAutonomousPlan({
    objective: input.idea,
    learnings: input.creativeLearnings,
    policy: input.autonomyPolicy || {
      level:
        input.automationMode === "autonomous"
          ? "autonomous"
          : input.automationMode === "manual"
            ? "manual"
            : "balanced",
    },
    estimatedCostUsd: input.estimatedCostUsd,
    generationsToday: input.generationsToday,
    platform: input.preferredPlatforms?.[0],
    accountId: input.brand?.id,
    brandId: input.brand?.id,
    hardConstraints: input.hardConstraints,
    explicitUserInstructions: [
      ...(input.hardConstraints?.explicitUserInstructions || []),
      input.explicitObjective || "",
    ].filter(Boolean),
    explorationDraw: input.explorationDraw,
  });

  const orchestrated = createProductionPlan({
    ...input,
    creativeLearnings: plan.relevantLearning,
  });

  return {
    autonomous: plan,
    canExecute: shouldExecuteAutonomously(plan.gate),
    orchestrated,
  };
}
