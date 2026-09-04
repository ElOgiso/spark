/**
 * Editorial decision engine — assemble / block / review per automation mode.
 * Never bypasses hard technical failures.
 */

import type { SparkAutomationMode } from "../qc/types";
import type { EditorialTimeline } from "./types";
import type { EditorialValidationResult } from "./validation";

export type EditorialDecisionAction =
  | "assemble"
  | "assemble_with_warnings"
  | "block_master"
  | "request_missing_asset"
  | "request_regeneration"
  | "request_review";

export interface EditorialDecision {
  action: EditorialDecisionAction;
  allowMaster: boolean;
  requireReview: boolean;
  reason: string;
  userMessage: string;
}

const HARD_CODES = new Set([
  "invalid_duration",
  "invalid_source_range",
  "overlapping_clips",
  "invalid_timebase",
  "invalid_resolution",
  "failed_asset",
  "qc_blocked",
]);

export function decideEditorialAction(params: {
  timeline: EditorialTimeline;
  validation: EditorialValidationResult;
  automationMode?: SparkAutomationMode;
}): EditorialDecision {
  const mode = params.automationMode || "balanced";
  const { validation, timeline } = params;

  const hard = validation.errors.filter((e) => HARD_CODES.has(e.code));
  const missing = validation.errors.filter(
    (e) => e.code === "missing_asset" || e.code === "missing_shots" || e.code === "missing_narration"
  );
  const qcBlocked = validation.errors.some((e) => e.code === "qc_blocked");

  if (hard.length) {
    return {
      action: "block_master",
      allowMaster: false,
      requireReview: true,
      reason: hard.map((e) => e.code).join(", "),
      userMessage: "SPARK found an issue before export",
    };
  }

  if (qcBlocked) {
    return {
      action: "request_regeneration",
      allowMaster: false,
      requireReview: true,
      reason: "qc_blocked",
      userMessage: "SPARK found an issue before export",
    };
  }

  if (missing.length) {
    const action: EditorialDecisionAction =
      mode === "autonomous" ? "request_missing_asset" : "request_missing_asset";
    return {
      action,
      allowMaster: false,
      requireReview: mode !== "autonomous",
      reason: missing.map((e) => e.code).join(", "),
      userMessage: "SPARK needs a few more pieces before the final version",
    };
  }

  if (validation.status === "invalid") {
    return {
      action: mode === "manual" ? "request_review" : "block_master",
      allowMaster: false,
      requireReview: true,
      reason: validation.errors.map((e) => e.code).join(", ") || "invalid",
      userMessage: "SPARK found an issue before export",
    };
  }

  if (validation.status === "warning") {
    if (mode === "manual") {
      return {
        action: "request_review",
        allowMaster: false,
        requireReview: true,
        reason: "warnings_require_manual_review",
        userMessage: "SPARK recommends review before export",
      };
    }
    if (mode === "balanced") {
      return {
        action: "assemble_with_warnings",
        allowMaster: true,
        requireReview: true,
        reason: validation.warnings.map((w) => w.code).join(", "),
        userMessage: "SPARK assembled your production",
      };
    }
    // autonomous — continue with warnings
    return {
      action: "assemble_with_warnings",
      allowMaster: true,
      requireReview: false,
      reason: validation.warnings.map((w) => w.code).join(", "),
      userMessage: "SPARK assembled your production",
    };
  }

  // valid
  if (timeline.status === "incomplete") {
    return {
      action: "request_missing_asset",
      allowMaster: false,
      requireReview: true,
      reason: "incomplete_timeline",
      userMessage: "SPARK needs a few more pieces before the final version",
    };
  }

  return {
    action: mode === "manual" ? "request_review" : "assemble",
    allowMaster: mode !== "manual",
    requireReview: mode !== "autonomous",
    reason: "timeline_valid",
    userMessage:
      mode === "manual"
        ? "SPARK assembled your production"
        : "SPARK assembled your production",
  };
}
