/**
 * Structured QC results — actionable remediation, not just pass/fail.
 */

import type { QcRemediation } from "../specification/qualitySpec";
import type { ShotSpec } from "../specification/shotSpec";
import type { ProductionSpec } from "../specification/productionSpec";
import { evaluateVisualContinuity } from "../visualContinuityGate";
import { planShotRetry } from "../generation/retryPlanner";

export type QcGateStatus = "pass" | "retry" | "fail" | "waive";

export interface QcGateResult {
  gateId: string;
  status: QcGateStatus;
  score: number;
  failures: string[];
  recommendedAction: QcRemediation | "continue";
  providerChange?: boolean;
  details?: string;
}

export function preflightGate(spec: ProductionSpec): QcGateResult {
  const failures: string[] = [];
  if (!spec.scenes.length) failures.push("no_scenes");
  if (!spec.scenes.some((s) => s.shots.length)) failures.push("no_shots");
  if (!(spec.project.targetDurationSec > 0)) failures.push("invalid_duration");
  if (spec.creative.requiresResearch && !spec.researchContext) {
    failures.push("research_missing");
  }
  const score = Math.max(0, 100 - failures.length * 20);
  return {
    gateId: "preflight",
    status: failures.some((f) => f === "no_scenes" || f === "no_shots") ? "fail" : failures.length ? "retry" : "pass",
    score,
    failures,
    recommendedAction: failures.length ? "modify_prompt" : "continue",
  };
}

export function shotQualityGate(shot: ShotSpec): QcGateResult {
  const failures: string[] = [];
  if (!shot.productionReason?.trim()) failures.push("missing_production_reason");
  if (!shot.compiledPrompt?.trim()) failures.push("missing_compiled_prompt");
  if (!shot.motion.beginState || !shot.motion.endState) failures.push("motion_state_incomplete");
  if (!(shot.durationSec > 0)) failures.push("duration_mismatch");
  if (shot.generationStatus === "failed") failures.push("generation_failed");

  const score = Math.max(0, 100 - failures.length * 18);
  const status: QcGateStatus = failures.length === 0 ? "pass" : score >= 50 ? "retry" : "fail";
  const retry = planShotRetry({ shot, failures });
  return {
    gateId: "shot",
    status,
    score,
    failures,
    recommendedAction: status === "pass" ? "continue" : retry.remediation,
    providerChange: retry.providerChange,
    details: retry.modifyPromptHint,
  };
}

export function continuityGate(params: {
  sceneIndex: number;
  firstFrameUrl?: string;
  previousLastFrameUrl?: string;
  shot?: ShotSpec;
}): QcGateResult {
  const visual = evaluateVisualContinuity({
    sceneIndex: params.sceneIndex,
    firstFrameUrl: params.firstFrameUrl || params.shot?.references.firstFrameUrl,
    previousLastFrameUrl: params.previousLastFrameUrl,
  });
  const failures = [...visual.reasons];
  if (params.shot && !params.shot.continuityRequirements.length) {
    failures.push("continuity_requirements_missing");
  }
  const score = visual.ok ? (visual.chained || params.sceneIndex === 0 ? 92 : 78) : Math.max(40, 70 - failures.length * 10);
  return {
    gateId: "continuity",
    status: failures.length === 0 ? "pass" : "retry",
    score,
    failures: failures.length ? failures.map((f) => f.includes(" ") ? "continuity_warning" : f) : [],
    recommendedAction: failures.length ? "regenerate_keyframe" : "continue",
    details: visual.reasons.join("; "),
  };
}

export function audioGate(spec: ProductionSpec, hasVoiceUrl?: boolean): QcGateResult {
  const failures: string[] = [];
  if (spec.audio.hasNarration && !hasVoiceUrl) failures.push("narration_missing");
  if (spec.audio.lipSyncRequired && spec.audio.hasDialogue) {
    // advisory — cannot verify lips here
  }
  const score = failures.length ? 60 : 90;
  return {
    gateId: "audio",
    status: failures.length ? "retry" : "pass",
    score,
    failures,
    recommendedAction: failures.length ? "remix_audio" : "continue",
  };
}

export function editorialGate(params: { sceneCount: number; readyClipCount: number }): QcGateResult {
  const failures: string[] = [];
  if (params.readyClipCount < params.sceneCount) failures.push("incomplete_clips");
  const score = params.sceneCount === 0 ? 0 : Math.round((params.readyClipCount / params.sceneCount) * 100);
  return {
    gateId: "editorial",
    status: failures.length ? "retry" : "pass",
    score,
    failures,
    recommendedAction: failures.length ? "rerender_same_model" : "continue",
  };
}

export function finalMasterGate(params: { masterUrl?: string; qcScores: number[] }): QcGateResult {
  const failures: string[] = [];
  if (!params.masterUrl) failures.push("master_missing");
  const avg = params.qcScores.length ? params.qcScores.reduce((a, b) => a + b, 0) / params.qcScores.length : 0;
  if (avg < 70) failures.push("quality_below_target");
  return {
    gateId: "final_master",
    status: failures.length ? "fail" : "pass",
    score: params.masterUrl ? Math.round(avg) : 0,
    failures,
    recommendedAction: failures.includes("master_missing") ? "rerender_same_model" : failures.length ? "rerender_different_model" : "continue",
  };
}
