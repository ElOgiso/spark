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
  QcFailureCode,
} from "./types";
import { canChangeProvider, canRetryQc } from "./budgets";
import {
  prefersProviderChange,
  prefersReferenceStrengthening,
  inferRootCause,
  suggestedRepairStrategy,
  failureSeverity,
  failureToCraftOperations,
  isCapabilityDeficiency,
} from "./failureTaxonomy";
import { planDownstreamRevalidation } from "./dagFeedback";
import type { QcRepairScope, QcRepairStrategy, QcRootCause } from "./types";
import type { CraftOperation } from "../craft/types";
import type { MediaRoutingDecision, ProviderModelCandidate } from "../capability/types";
import { capabilityRequirementsFromShot } from "../capability/requirements";
import { routeMediaRequest } from "../capability/router";
import { getCapabilityProfile } from "../capability/registry";
import { CostEngine } from "../economics/costEngine";

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
  attempt?: number;
  maxAttempts?: number;
  failureHistory?: QcFailureCode[];
  candidates?: ProviderModelCandidate[];
}): RepairDecision {
  const { qc, spec, shot, budget, forceManualReview } = params;
  const attempt = params.attempt ?? budget.qcRetries + 1;
  const maxAttempts = params.maxAttempts ?? budget.maxQcRetries;
  const failureHistory = params.failureHistory || [];
  const failures = qc.failures;
  const primaryFailure = failures[0]?.code;

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
      ...buildPhase9RepairMeta({
        qc,
        spec,
        shotId: shot?.id,
        attempt,
        maxAttempts,
        escalate: false,
      }),
      escalate: false,
      scope: "candidate",
      operations: [],
      failureHistory,
    };
  }

  // 1. Check repeated identical failures (anti-oscillation)
  const isRepeatedFailure = Boolean(
    primaryFailure &&
    failureHistory.length > 0 &&
    failureHistory[failureHistory.length - 1] === primaryFailure
  );

  if (isRepeatedFailure) {
    return {
      action: "manual_review",
      remediation: "manual_review",
      providerChange: false,
      changedInputs: [],
      strengthenReferences: false,
      regenerateShotIds: [],
      regenerateTaskIds: [],
      preserveShotIds: spec.scenes.flatMap((s) => s.shots.map((sh) => sh.id)),
      reason: `Repeated identical failure "${primaryFailure}" detected — stopping automated repair loop for human review`,
      withinBudget: true,
      escalate: true,
      strategy: "escalate_human_review",
      failureHistory: primaryFailure ? [...failureHistory, primaryFailure] : failureHistory,
      operations: [],
      ...buildPhase9RepairMeta({
        qc,
        spec,
        shotId: shot?.id,
        attempt,
        maxAttempts,
        escalate: true,
      }),
    };
  }

  // 2. Check budget or forced review
  if (forceManualReview || !canRetryQc(budget) || attempt > maxAttempts) {
    return {
      action: "manual_review",
      remediation: "manual_review",
      providerChange: false,
      changedInputs: [],
      strengthenReferences: false,
      regenerateShotIds: [],
      regenerateTaskIds: [],
      preserveShotIds: spec.scenes.flatMap((s) => s.shots.map((sh) => sh.id)),
      reason: forceManualReview
        ? "automation requires manual review"
        : attempt > maxAttempts
        ? `Max repair attempts (${maxAttempts}) exhausted`
        : "QC regeneration budget exhausted",
      withinBudget: false,
      escalate: true,
      strategy: "escalate_human_review",
      failureHistory: primaryFailure ? [...failureHistory, primaryFailure] : failureHistory,
      operations: [],
      ...buildPhase9RepairMeta({
        qc,
        spec,
        shotId: shot?.id,
        attempt,
        maxAttempts,
        escalate: true,
      }),
    };
  }

  // 3. Determine failure action & check capability deficiency
  let action: QcRecommendedAction = qc.recommendedAction;
  const profile = getCapabilityProfile(shot?.provider || "", shot?.model);
  const deficiency = isCapabilityDeficiency(primaryFailure || "unknown_failure", shot, profile);

  let providerChange = false;
  let rerouteDecision: MediaRoutingDecision | undefined;
  let nextProvider: string | undefined;
  let nextModel: string | undefined;
  let routingReason: string | undefined;

  if (deficiency.deficient && canChangeProvider(budget)) {
    // Genuine capability deficiency -> canonical reroute
    if (shot) {
      const baseReqs = capabilityRequirementsFromShot(shot);
      rerouteDecision = routeMediaRequest(baseReqs, {
        candidates: params.candidates,
        requireAdapter: true,
      });
      if (rerouteDecision.selected) {
        const newProv = rerouteDecision.selected.providerId;
        const newMod = rerouteDecision.selected.modelId;
        if (newProv !== shot.provider || newMod !== shot.model) {
          action = "reroute_provider";
          providerChange = true;
          nextProvider = newProv;
          nextModel = newMod;
          routingReason = `Rerouted to ${nextProvider}/${nextModel}: ${deficiency.reason}`;
        } else {
          action = "regenerate_shot";
          providerChange = false;
          routingReason = `Canonical router retained current provider ${shot.provider}/${shot.model}`;
        }
      } else {
        // Router found no candidate meeting requirements
        action = "manual_review";
        providerChange = false;
        routingReason = `No compatible provider/model found for deficiency: ${deficiency.reason}`;
      }
    }
  } else if (failures.some((f) => prefersReferenceStrengthening(f.code))) {
    action = "change_reference";
  } else if (failures.some((f) => prefersProviderChange(f.code))) {
    if (canChangeProvider(budget) && shot) {
      const baseReqs = capabilityRequirementsFromShot(shot);
      rerouteDecision = routeMediaRequest(baseReqs, {
        candidates: params.candidates,
        requireAdapter: true,
      });
      if (rerouteDecision.selected) {
        const newProv = rerouteDecision.selected.providerId;
        const newMod = rerouteDecision.selected.modelId;
        if (newProv !== shot.provider || newMod !== shot.model) {
          action = "reroute_provider";
          providerChange = true;
          nextProvider = newProv;
          nextModel = newMod;
          routingReason = `Provider change requested by failure code and routed via canonical router to ${nextProvider}/${nextModel}`;
        } else {
          action = "regenerate_shot";
          providerChange = false;
          routingReason = `Canonical router retained current provider ${shot.provider}/${shot.model}`;
        }
      } else {
        action = "manual_review";
        providerChange = false;
        routingReason = "Canonical router found no alternative provider";
      }
    } else {
      action = "regenerate_shot";
      providerChange = false;
    }
  } else if (
    failures.some(
      (f) =>
        f.code === "camera_mismatch" ||
        f.code === "camera_failure" ||
        f.code === "composition_mismatch" ||
        f.code === "composition_failure" ||
        f.code === "prompt_mismatch"
    )
  ) {
    action = "repair";
  } else if (failures.some((f) => /continuity|location|prop|spatial|screen|lighting|time/.test(f.code))) {
    action = "strengthen_continuity";
  } else if (qc.status === "fail") {
    action = "regenerate_shot";
  } else {
    action = "repair";
  }

  // 4. Targeted CraftOperations
  const operations: CraftOperation[] = primaryFailure
    ? failureToCraftOperations(
        primaryFailure,
        failures[0]?.evidence,
        shot,
        shot?.craftPlan,
        shot?.craftPlan?.operations
      )
    : [];

  // If action was generic repair but no concrete craft operations were justified, regenerate shot
  if (action === "repair" && operations.length === 0) {
    action = "regenerate_shot";
  }

  // 5. Cost estimation (delegated to CostEngine single authority)
  const targetProvider = nextProvider || shot?.provider || "kling";
  const targetModel = nextModel || shot?.model || "";
  const costModality = shot?.keyframeUrl && !shot?.mediaUrl ? "image" : "video";
  const costEst = CostEngine.estimateCost({
    providerId: targetProvider,
    modelId: targetModel,
    modality: costModality,
    durationSeconds: shot?.durationSec,
    resolution: shot?.resolution,
  });
  const estimatedCostUsd = costEst.amount;

  const failureStrings = failures.map((f) => f.code);
  const wantsDependents = failures.some(
    (f) => f.code === "continuity_break" || f.code === "continuity_failure"
  );
  if (wantsDependents) {
    action = "regenerate_dependent_shots";
  }

  const strengthenReferences = action === "change_reference" || action === "strengthen_continuity";
  const modifyPromptHint = hintForFailures(failures);

  return {
    action,
    remediation: mapActionToRemediation(action),
    providerChange,
    nextProvider,
    nextModel,
    routingReason,
    rerouteDecision,
    operations,
    estimatedCostUsd,
    failureHistory: primaryFailure ? [...failureHistory, primaryFailure] : failureHistory,
    strategyChange: undefined,
    /** Legacy compatibility hint only — canonical repair is strictly CraftPlan / CraftOperations */
    modifyPromptHint,
    changedInputs: strengthenReferences
      ? ["characterRefs", "referenceStrength"]
      : operations.length > 0
        ? ["craftPlan"]
        : ["generationStrategy"],
    strengthenReferences,
    regenerateShotIds: shot ? [shot.id] : [],
    regenerateTaskIds: [],
    preserveShotIds: spec.scenes.flatMap((s) => s.shots.filter((sh) => sh.id !== shot?.id).map((sh) => sh.id)),
    reason: routingReason || `QC ${qc.status}: ${failureStrings.join(", ") || action}`,
    withinBudget: true,
    ...buildPhase9RepairMeta({
      qc,
      spec,
      shotId: shot?.id,
      attempt,
      maxAttempts,
      escalate: action === "manual_review" ? true : undefined,
    }),
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


function buildPhase9RepairMeta(params: {
  qc: ProductionQCResult;
  spec: ProductionSpec;
  shotId?: string;
  attempt?: number;
  maxAttempts?: number;
  escalate?: boolean;
}): {
  scope: QcRepairScope;
  strategy: QcRepairStrategy;
  rootCauses: QcRootCause[];
  revalidateShotIds: string[];
  attempt: number;
  maxAttempts: number;
  escalate: boolean;
} {
  const failures = params.qc.failures;
  const rootCauses = failures.slice(0, 5).map((f) => inferRootCause(f.code));
  const primary = failures[0]?.code;
  let strategy: QcRepairStrategy = primary ? suggestedRepairStrategy(primary) : "regenerate_same_intent";
  let scope: QcRepairScope = "shot";
  if (!failures.length) scope = "candidate";
  else if (failures.some((f) => f.code === "handoff_failure" || f.code === "end_state_mismatch")) {
    scope = "shot_and_dependents";
  } else if (failures.some((f) => f.code === "coverage_gap" || f.code === "narrative_incoherence")) {
    scope = "scene";
  }

  const revalidate = params.shotId
    ? planDownstreamRevalidation({
        spec: params.spec,
        replacedShotId: params.shotId,
        qc: params.qc,
      })
    : null;

  const maxAttempts = params.maxAttempts ?? 3;
  const attempt = params.attempt ?? 1;
  const escalate =
    Boolean(params.escalate) ||
    attempt >= maxAttempts ||
    failures.some((f) => f.code === "repair_exhausted") ||
    failures.some((f) => failureSeverity(f.code) === "critical" && f.confidence < 0.55);

  if (escalate) {
    strategy = "escalate_human_review";
  }

  return {
    scope,
    strategy,
    rootCauses,
    revalidateShotIds: revalidate?.revalidateShotIds || [],
    attempt,
    maxAttempts,
    escalate,
  };
}
