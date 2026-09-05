/**
 * Shot generation risk scoring — deterministic, no network.
 * Recommends candidate count / stronger provider / more references.
 */

import type { ShotSpec } from "../specification/shotSpec";
import type { ShotGenerationRisk } from "./types";
import type { ReferenceManifest } from "./types";

export function scoreShotGenerationRisk(params: {
  shot: ShotSpec;
  referenceManifest?: ReferenceManifest;
  hasLockedCharacterContracts?: boolean;
  hasLocationContract?: boolean;
  dialogueHeavy?: boolean;
}): ShotGenerationRisk {
  const { shot } = params;
  const factors: string[] = [];
  let score = 0.15;

  if ((shot.characterIds?.length || 0) >= 2) {
    score += 0.18;
    factors.push("multi_character");
  } else if ((shot.characterIds?.length || 0) === 1) {
    score += 0.08;
    factors.push("single_character");
  }

  if (!params.hasLockedCharacterContracts && (shot.characterIds?.length || 0) > 0) {
    score += 0.12;
    factors.push("unlocked_character_identity");
  }

  if (!params.hasLocationContract && shot.environment) {
    score += 0.06;
    factors.push("unlocked_location");
  }

  const movement = String(shot.camera.cameraMovement || "static");
  if (movement !== "static" && movement !== "none") {
    score += 0.1;
    factors.push(`camera_motion:${movement}`);
  }

  if (
    shot.motion.subjectMovement &&
    !/still|static|hold|idle/i.test(shot.motion.subjectMovement)
  ) {
    score += 0.1;
    factors.push("subject_motion");
  }

  if ((shot.durationSec || 0) > 8) {
    score += 0.1;
    factors.push("long_duration");
  }

  if (shot.dialogue || params.dialogueHeavy) {
    score += 0.12;
    factors.push("dialogue");
  }

  if ((shot.continuityRequirements?.length || 0) >= 3) {
    score += 0.08;
    factors.push("heavy_continuity");
  }

  const refCount = params.referenceManifest?.references.length ?? 0;
  const mandatory = params.referenceManifest?.references.filter((r) => r.priority === "mandatory")
    .length;
  if (refCount === 0 && (shot.characterIds?.length || 0) > 0) {
    score += 0.15;
    factors.push("missing_references");
  } else if (mandatory != null && mandatory === 0 && (shot.characterIds?.length || 0) > 0) {
    score += 0.08;
    factors.push("no_mandatory_identity_refs");
  }

  if ((params.referenceManifest?.conflicts.length || 0) > 0) {
    score += 0.1;
    factors.push("reference_conflicts");
  }

  if (/macro|extreme_closeup|aerial|tracking/i.test(String(shot.camera.shotType))) {
    score += 0.06;
    factors.push(`demanding_shot_type:${shot.camera.shotType}`);
  }

  score = Math.max(0, Math.min(1, score));
  const level: ShotGenerationRisk["level"] =
    score >= 0.65 ? "high" : score >= 0.4 ? "medium" : "low";

  const recommendedCandidates = level === "high" ? 3 : level === "medium" ? 2 : 1;
  const recommendStrongerProvider = level !== "low" || factors.includes("dialogue");
  const recommendMoreReferences =
    factors.includes("missing_references") ||
    factors.includes("unlocked_character_identity") ||
    factors.includes("reference_conflicts") ||
    level === "high";

  return {
    shotId: shot.id,
    score: Math.round(score * 100) / 100,
    level,
    factors,
    recommendedCandidates,
    recommendStrongerProvider,
    recommendMoreReferences,
  };
}
