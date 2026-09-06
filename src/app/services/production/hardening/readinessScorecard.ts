/**
 * Production readiness scorecard — honest gate evaluation for Phase 12.
 */

import type {
  HardGateResult,
  ProductionReadinessReport,
  ReadinessCategoryResult,
  ReadinessStatus,
} from "./types";

function worst(statuses: ReadinessStatus[]): ReadinessStatus {
  if (statuses.includes("BLOCKED")) return "BLOCKED";
  if (statuses.includes("DEGRADED")) return "DEGRADED";
  if (statuses.includes("PASS_WITH_LIMITATIONS")) return "PASS_WITH_LIMITATIONS";
  return "PASS";
}

export function buildProductionReadinessReport(input: {
  gates: HardGateResult[];
  categories?: ReadinessCategoryResult[];
  knownLimitations?: string[];
  architectureIntegrity?: ProductionReadinessReport["architectureIntegrity"];
}): ProductionReadinessReport {
  const gates = input.gates;
  const remainingBlockers = gates.flatMap((g) => g.blockers);
  const overall = worst(gates.map((g) => g.status));
  const architectureIntegrity = input.architectureIntegrity || {
    singleOrchestrator: true,
    singleProductionSpec: true,
    singleShotModel: true,
    singleContinuityEngine: true,
    singleDag: true,
    singleQcSystem: true,
    singleProviderRouter: true,
    singleLearningSystem: true,
  };

  const archBroken = Object.values(architectureIntegrity).some((v) => !v);
  const finalOverall = archBroken ? "BLOCKED" : overall;

  const verdict =
    finalOverall === "PASS"
      ? "PRODUCTION_READY"
      : finalOverall === "PASS_WITH_LIMITATIONS" || finalOverall === "DEGRADED"
        ? "PRODUCTION_READY_WITH_LIMITATIONS"
        : "NOT_PRODUCTION_READY";

  return {
    generatedAt: new Date().toISOString(),
    overall: finalOverall,
    gates,
    categories: input.categories || [],
    knownLimitations: input.knownLimitations || [],
    remainingBlockers: archBroken
      ? [...remainingBlockers, "Architecture integrity gate failed"]
      : remainingBlockers,
    architectureIntegrity,
    verdict,
  };
}

export function gate(
  id: HardGateResult["id"],
  status: ReadinessStatus,
  evidence: string[],
  blockers: string[] = []
): HardGateResult {
  return { id, status, evidence, blockers };
}
