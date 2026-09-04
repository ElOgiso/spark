/**
 * Automation-mode policy for QC repair / regeneration.
 * Maps domain AutomationMode: manual | balanced | autonomous.
 */

import type { SparkAutomationMode, QcRecommendedAction, ProductionQCResult } from "./types";
import type { RepairDecision } from "./types";

export interface AutomationPolicyResult {
  /** Whether the system may auto-apply the repair (regenerate) */
  autoRepair: boolean;
  /** Whether production should pause for user review */
  requireReview: boolean;
  /** Whether production may continue after accept/warn */
  continueProduction: boolean;
  /** Override repair to manual_review when policy forbids auto action */
  effectiveAction: QcRecommendedAction;
  userMessage: string;
}

export function applyAutomationPolicy(params: {
  mode: SparkAutomationMode;
  qc: ProductionQCResult;
  repair: RepairDecision;
}): AutomationPolicyResult {
  const { mode, qc, repair } = params;

  if (qc.status === "pass" || repair.action === "accept") {
    return {
      autoRepair: false,
      requireReview: mode === "manual" ? false : mode === "balanced",
      continueProduction: true,
      effectiveAction: "accept",
      userMessage:
        mode === "balanced"
          ? "SPARK approved this and recommends review"
          : "SPARK checked this and it looks good",
    };
  }

  if (mode === "manual") {
    return {
      autoRepair: false,
      requireReview: true,
      continueProduction: false,
      effectiveAction: "manual_review",
      userMessage: "SPARK recommends review",
    };
  }

  if (mode === "balanced") {
    // Auto-repair within budget, then surface for approval
    if (repair.withinBudget && repair.action !== "manual_review") {
      return {
        autoRepair: true,
        requireReview: true,
        continueProduction: false,
        effectiveAction: repair.action,
        userMessage: "SPARK is improving this shot",
      };
    }
    return {
      autoRepair: false,
      requireReview: true,
      continueProduction: false,
      effectiveAction: "manual_review",
      userMessage: "SPARK recommends review",
    };
  }

  // autonomous
  if (repair.withinBudget && repair.action !== "manual_review") {
    return {
      autoRepair: true,
      requireReview: false,
      continueProduction: true,
      effectiveAction: repair.action,
      userMessage: "SPARK is regenerating this shot",
    };
  }

  return {
    autoRepair: false,
    requireReview: true,
    continueProduction: false,
    effectiveAction: "manual_review",
    userMessage: "SPARK recommends review",
  };
}
