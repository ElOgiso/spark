/**
 * Repair decision engine — cheapest reliable fix, integrated with Phase 3/4 retry planner.
 * Does NOT create a parallel retry system.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { ShotSpec } from "../specification/shotSpec";
import type { QcRemediation } from "../specification/qualitySpec";
import { planShotRetry, planPartialRegeneration } from "../generation/retryPlanner";
import type {
  ProductionQCResult,
  RepairDecision,
  QcBudgetState,
  QcRecommendedAction,
  QCFailure,
} from "./types";
import { canChangeProvider, canRetryQc } from "./budgets";
import { prefersProviderChange, prefersReferenceStrengthening } from "./failureTaxonomy";

function mapActionToRemediation(action: QcRecommendedAction): QcRemediation | "continue" | "manual_review" {
  switch (action) {
    case "accept":
      return "continue";
    case "repair_prompt":
    case "repair":
      return "modify_prompt";
    case "change_reference":
    case "strengthen_continuity":
      return "rerender_same_model";
    case "change_generation_strategy":
      return "change_generation_strategy";
    case "reroute":
    case "reroute_provider":
      return "rerender_different_model";
    case "rerender":
    case "regenerate_shot":
      return "rerender_same_model";
    case "regenerate_dependent_shots":
      return "rerender_same_model";
    case "manual_review":
      return "manual_review";
    default:
      return "modify_prompt";
  }
}

export function planRepairFromQc(params: {
  qc: ProductionQCResult;
  spec: ProductionSpec;
  shot?: ShotSpec;
  budget: QcBudgetState;
  forceManualReview?: boolean;
}): RepairDecision {
  const { qc, spec, shot, budget, forceManualReview } = params;

  if (qc.recommendedAction === "accept" || qc.status === "pass") {
    return {
      action: "accept",
      remediation: "continue",
      providerChange: false,
      changedInputs: [],
      strengthenReferences: false,
      regenerateShotIds: [],
      regenerateTaskIds: [],
      preserveShotIds: spec.scenes.flatMap((s) => s.shots.map((sh) => sh.id)),
      reason: "QC passed",
      withinBudget: true,
    };
  }

  if (forceManualReview || !canRetryQc(budget)) {
    return {
      action: "manual_review",
      remediation: "manual_review",
      providerChange: false,
      changedInputs: [],
      strengthenReferences: false,
      regenerateShotIds: [],
      regenerateTaskIds: [],
      preserveShotIds: spec.scenes.flatMap((s) => s.shots.map((sh) => sh.id)),
      reason: forceManualReview ? "automation requires manual review" : "QC regeneration budget exhausted",
      withinBudget: false,
    };
  }

  const failures = qc.failures;
  let action: QcRecommendedAction = qc.recommendedAction;

  if (failures.some((f) => prefersReferenceStrengthening(f.code))) {
    action = "change_reference";
  } else if (failures.some((f) => prefersProviderChange(f.code))) {
    action = canChangeProvider(budget) ? "reroute_provider" : "regenerate_shot";
  } else if (failures.some((f) => f.code === "camera_mismatch" || f.code === "composition_mismatch" || f.code === "prompt_mismatch")) {
    action = "repair_prompt";
  } else if (failures.some((f) => /continuity|location|prop|spatial|screen|lighting|time/.test(f.code))) {
    action = "strengthen_continuity";
  } else if (qc.status === "fail") {
    action = "regenerate_shot";
  } else {
    action = "repair_prompt";
  }

  const providerChange = action === "reroute_provider";
  if (providerChange && !canChangeProvider(budget)) {
    action = "regenerate_shot";
  }

  const failureStrings = failures.map((f) => f.code);
  const routingDecision = shot
    ? spec.routing.shotDecisions.find((d) => d.shotId === shot.id)
    : undefined;

  const retry = shot
    ? planShotRetry({
        shot,
        failures: failureStrings.length ? failureStrings : [action],
        routingDecision,
        maxAttempts: budget.maxQcRetries,
      })
    : null;

  const wantsDependents = failures.some((f) => f.code === "continuity_break");

  const partial = shot
    ? planPartialRegeneration({
        spec,
        scope: "shot",
        targetId: shot.id,
        failure: failureStrings[0],
      })
    : null;

  // Expand to dependent continuity chain when continuity breaks
  if (wantsDependents) {
    action = "regenerate_dependent_shots";
  }

  const finalProviderChange = Boolean(
    action === "reroute_provider" || retry?.providerChange || partial?.providerChange
  );

  const strengthenReferences = action === "change_reference" || action === "strengthen_continuity";
  const modifyPromptHint =
    retry?.modifyPromptHint ||
    hintForFailures(failures) ||
    "Clarify planned subject, action, camera, and continuity locks";

  return {
    action,
    remediation: mapActionToRemediation(action),
    providerChange: finalProviderChange,
    nextProvider: retry?.nextProvider || partial?.nextProvider,
    strategyChange: retry?.strategyChange || partial?.strategyChange,
    modifyPromptHint,
    changedInputs:
      retry?.changedInputs ||
      partial?.changedInputs ||
      (strengthenReferences ? ["characterRefs", "referenceStrength"] : ["compiledPrompt"]),
    strengthenReferences,
    regenerateShotIds: partial?.regenerateShotIds || (shot ? [shot.id] : []),
    regenerateTaskIds: partial?.regenerateTaskIds || [],
    preserveShotIds: partial?.preserveShotIds || [],
    reason: `QC ${qc.status}: ${failureStrings.join(", ") || action}`,
    withinBudget: true,
  };
}

function hintForFailures(failures: QCFailure[]): string | undefined {
  if (!failures.length) return undefined;
  const c = failures[0].code;
  if (c === "identity_drift") return "Strengthen character reference lock and identity descriptors";
  if (c === "camera_mismatch") return "Make camera move and framing explicit; reduce conflicting motion";
  if (c === "action_missing") return "State a single primary action clearly in the prompt";
  if (c === "continuity_break" || c === "location_drift") {
    return "Reinforce continuity locks for location, wardrobe, and screen direction";
  }
  return undefined;
}
