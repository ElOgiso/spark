/**
 * Bounded autonomy gates — budget, quality, exploration, policy.
 */

import { DEFAULT_AUTONOMY_POLICY, type AutonomyGateResult, type AutonomyPolicy } from "./types";

export function resolveAutonomyPolicy(partial?: Partial<AutonomyPolicy>): AutonomyPolicy {
  return { ...DEFAULT_AUTONOMY_POLICY, ...(partial || {}) };
}

export function evaluateAutonomyGate(input: {
  policy?: Partial<AutonomyPolicy>;
  estimatedCostUsd?: number;
  generationsToday?: number;
  predictedQualityRisk?: number;
  confidence?: number;
  conflictingLearning?: boolean;
  unknownCapability?: boolean;
  explorationDraw?: number;
}): AutonomyGateResult {
  const policy = resolveAutonomyPolicy(input.policy);
  const reasons: string[] = [];
  const estimatedCostUsd = input.estimatedCostUsd;
  const confidence = input.confidence;

  if (policy.level === "manual") {
    return {
      decision: "escalate_human_review",
      reasons: ["Autonomy level is manual — human approval required"],
      policy,
      estimatedCostUsd,
      confidence,
    };
  }

  if (
    estimatedCostUsd != null &&
    policy.maxEstimatedCostUsd != null &&
    estimatedCostUsd > policy.maxEstimatedCostUsd
  ) {
    return {
      decision: "pause_budget",
      reasons: [
        `Estimated cost $${estimatedCostUsd.toFixed(2)} exceeds max $${policy.maxEstimatedCostUsd.toFixed(2)}`,
      ],
      policy,
      estimatedCostUsd,
      confidence,
    };
  }

  if (
    estimatedCostUsd != null &&
    policy.requireApprovalAboveCostUsd != null &&
    estimatedCostUsd > policy.requireApprovalAboveCostUsd &&
    policy.level !== "autonomous"
  ) {
    return {
      decision: "escalate_human_review",
      reasons: [
        `Estimated cost $${estimatedCostUsd.toFixed(2)} requires approval above $${policy.requireApprovalAboveCostUsd.toFixed(2)}`,
      ],
      policy,
      estimatedCostUsd,
      confidence,
    };
  }

  if (
    input.generationsToday != null &&
    policy.maxGenerationsPerDay != null &&
    input.generationsToday >= policy.maxGenerationsPerDay
  ) {
    return {
      decision: "pause_budget",
      reasons: [`Daily generation limit reached (${policy.maxGenerationsPerDay})`],
      policy,
      estimatedCostUsd,
      confidence,
    };
  }

  if (
    input.predictedQualityRisk != null &&
    policy.minQualityConfidence != null &&
    1 - input.predictedQualityRisk < policy.minQualityConfidence &&
    (policy.level === "autonomous" || policy.level === "balanced")
  ) {
    return {
      decision: "pause_quality",
      reasons: [`Predicted quality confidence below threshold (${policy.minQualityConfidence})`],
      policy,
      estimatedCostUsd,
      confidence,
    };
  }

  if (
    (input.conflictingLearning || input.unknownCapability) &&
    (policy.level === "autonomous" || policy.level === "balanced")
  ) {
    reasons.push(
      input.conflictingLearning ? "Conflicting learning signals" : "Unknown capability profile"
    );
    if (confidence == null || confidence < 0.55) {
      return {
        decision: "escalate_human_review",
        reasons: [...reasons, "Confidence too low for autonomous continuation"],
        policy,
        estimatedCostUsd,
        confidence,
      };
    }
  }

  const draw = input.explorationDraw ?? Math.random();
  if (policy.level !== "assisted" && draw < policy.explorationRatio) {
    return {
      decision: "explore",
      reasons: [`Controlled exploration draw ${draw.toFixed(3)} < ratio ${policy.explorationRatio}`],
      policy,
      estimatedCostUsd,
      confidence,
    };
  }

  if (policy.level === "assisted") {
    return {
      decision: "escalate_human_review",
      reasons: ["Assisted mode — SPARK recommends but does not auto-execute"],
      policy,
      estimatedCostUsd,
      confidence,
    };
  }

  return {
    decision: "proceed",
    reasons: reasons.length ? reasons : ["Within autonomy bounds"],
    policy,
    estimatedCostUsd,
    confidence,
  };
}

export function shouldExecuteAutonomously(gate: AutonomyGateResult): boolean {
  return gate.decision === "proceed" || gate.decision === "explore";
}
