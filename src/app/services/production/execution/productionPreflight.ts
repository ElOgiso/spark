/**
 * Deterministic production preflight — actionable blockers before generation.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import { validateProductionSpec } from "../specification";
import { preflightGate } from "../qc/legacyGates";
import { planGenerationTasks } from "../generation/generationPlanner";
import { buildProductionDag, validateProductionDag } from "../dag/productionDag";
import type { PreflightIssue, PreflightReport } from "./lifecycleTypes";

export interface RunProductionPreflightOptions {
  includeDag?: boolean;
}

export function runProductionPreflight(
  spec: ProductionSpec,
  options: RunProductionPreflightOptions = {}
): PreflightReport {
  const checkedAt = new Date().toISOString();
  const issues: PreflightIssue[] = [];

  const validation = validateProductionSpec(spec);
  for (const err of validation.errors) {
    issues.push({
      code: "SPEC_INVALID",
      severity: "blocker",
      message: err,
      remediation: "Fix the ProductionSpec field referenced in the message, then re-run preflight.",
    });
  }
  for (const warn of validation.warnings) {
    issues.push({ code: "SPEC_WARNING", severity: "warning", message: warn });
  }

  if (!spec.project?.id) {
    issues.push({
      code: "PROJECT_ID_MISSING",
      severity: "blocker",
      message: "ProductionSpec.project.id is required",
      path: "project.id",
      remediation: "Assign a stable project id before execution.",
    });
  }

  if (!spec.scenes?.length) {
    issues.push({
      code: "NO_SCENES",
      severity: "blocker",
      message: "Production has no scenes",
      path: "scenes",
      remediation: "Run createProductionPlan before execution.",
    });
  }

  const shotCount = (spec.scenes || []).reduce((n, s) => n + (s.shots?.length || 0), 0);
  if (shotCount === 0) {
    issues.push({
      code: "NO_SHOTS",
      severity: "blocker",
      message: "Production has no shots to generate",
      path: "scenes[].shots",
      remediation: "Ensure planning produced at least one shot.",
    });
  }

  for (const scene of spec.scenes || []) {
    for (const shot of scene.shots || []) {
      if (!shot.productionReason?.trim() && !shot.purpose?.trim()) {
        issues.push({
          code: "SHOT_PURPOSE_MISSING",
          severity: "warning",
          message: `Shot ${shot.id} is missing a production reason/purpose`,
          path: `shot:${shot.id}`,
          remediation: "Add productionReason so QC and routing can evaluate intent.",
        });
      }
      if (!(shot.durationSec > 0)) {
        issues.push({
          code: "SHOT_DURATION_INVALID",
          severity: "blocker",
          message: `Shot ${shot.id} has invalid durationSec`,
          path: `shot:${shot.id}.durationSec`,
          remediation: "Set durationSec > 0.",
        });
      }
    }
  }

  const gate = preflightGate(spec);
  for (const failure of gate.failures) {
    const blocker = failure === "no_scenes" || failure === "no_shots";
    issues.push({
      code: `PREFLIGHT_GATE_${failure.toUpperCase()}`,
      severity: blocker ? "blocker" : "warning",
      message: `Preflight gate: ${failure}`,
      remediation: blocker
        ? "Complete planning before execution."
        : "Review creative/research requirements before generation.",
    });
  }

  if (options.includeDag !== false && shotCount > 0 && validation.ok) {
    try {
      const tasks = planGenerationTasks(spec);
      if (!tasks.length) {
        issues.push({
          code: "NO_GENERATION_TASKS",
          severity: "blocker",
          message: "Generation planner produced zero tasks",
          remediation: "Check shot generationStrategy / routing before execution.",
        });
      } else {
        const dag = buildProductionDag(spec, tasks);
        const dagResult = validateProductionDag(dag);
        for (const issue of dagResult.issues) {
          issues.push({
            code: `DAG_${String(issue.code).toUpperCase()}`,
            severity: issue.code === "cycle" ? "blocker" : "warning",
            message: issue.message,
            path: issue.nodeId,
            remediation:
              issue.code === "cycle"
                ? "Remove cyclic task dependencies before generation."
                : "Inspect DAG node and dependency edges.",
          });
        }
      }
    } catch (err) {
      issues.push({
        code: "DAG_BUILD_FAILED",
        severity: "blocker",
        message: err instanceof Error ? err.message : "Failed to build production DAG",
        remediation: "Fix generation task planning inputs and retry preflight.",
      });
    }
  }

  const seen = new Set<string>();
  const deduped = issues.filter((i) => {
    const key = `${i.code}:${i.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const blockers = deduped.filter((i) => i.severity === "blocker");
  const warnings = deduped.filter((i) => i.severity === "warning");

  return {
    ok: blockers.length === 0,
    checkedAt,
    issues: deduped,
    blockers,
    warnings,
    summary:
      blockers.length === 0
        ? `Preflight passed with ${warnings.length} warning(s)`
        : `PRODUCTION BLOCKED — ${blockers.length} blocker(s): ${blockers
            .map((b) => b.code)
            .join(", ")}`,
  };
}
