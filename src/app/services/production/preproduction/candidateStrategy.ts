/**
 * Candidate ranking using QC-like dimensions — deterministic, no network.
 * Reuses the same quality vocabulary as Phase 5 QC without spawning a second QC system.
 */

import type { CandidateScore, ShotGenerationRisk } from "./types";

export type CandidateObservation = {
  candidateId: string;
  shotId: string;
  /** 0–100 dimension scores (QC-like) */
  scores: Partial<CandidateScore["scores"]>;
  notes?: string[];
};

const DIMENSION_WEIGHTS: Record<keyof CandidateScore["scores"], number> = {
  characterConsistency: 1.15,
  locationConsistency: 1.05,
  composition: 1.0,
  motionQuality: 1.0,
  cameraExecution: 1.0,
  storyAccuracy: 1.2,
  continuity: 1.1,
  visualTreatment: 0.85,
  artifactSeverity: 1.25,
  editorialUsefulness: 0.9,
};

function clampScore(n: number | undefined, fallback = 50): number {
  if (typeof n !== "number" || Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

export function scoreCandidate(obs: CandidateObservation): CandidateScore {
  const scores: CandidateScore["scores"] = {
    characterConsistency: clampScore(obs.scores.characterConsistency),
    locationConsistency: clampScore(obs.scores.locationConsistency),
    composition: clampScore(obs.scores.composition),
    motionQuality: clampScore(obs.scores.motionQuality),
    cameraExecution: clampScore(obs.scores.cameraExecution),
    storyAccuracy: clampScore(obs.scores.storyAccuracy),
    continuity: clampScore(obs.scores.continuity),
    visualTreatment: clampScore(obs.scores.visualTreatment),
    /** Higher artifactSeverity score = fewer/worse artifacts suppressed → invert for overall */
    artifactSeverity: clampScore(obs.scores.artifactSeverity, 70),
    editorialUsefulness: clampScore(obs.scores.editorialUsefulness),
  };

  let weighted = 0;
  let weightSum = 0;
  for (const key of Object.keys(DIMENSION_WEIGHTS) as Array<keyof typeof DIMENSION_WEIGHTS>) {
    const w = DIMENSION_WEIGHTS[key];
    // artifactSeverity: high = clean (good). Treat as-is.
    weighted += scores[key] * w;
    weightSum += w;
  }
  const overall = weightSum ? Math.round(weighted / weightSum) : 0;

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  for (const [k, v] of Object.entries(scores)) {
    if (v >= 80) strengths.push(k);
    if (v < 55) weaknesses.push(k);
  }

  return {
    candidateId: obs.candidateId,
    shotId: obs.shotId,
    scores,
    overall,
    strengths,
    weaknesses,
  };
}

export function rankCandidates(observations: CandidateObservation[]): CandidateScore[] {
  return observations
    .map(scoreCandidate)
    .sort((a, b) => b.overall - a.overall || a.candidateId.localeCompare(b.candidateId));
}

export function selectBestCandidate(
  observations: CandidateObservation[]
): CandidateScore | null {
  const ranked = rankCandidates(observations);
  return ranked[0] ?? null;
}

/** How many candidates to generate given risk — shared with shotRisk recommendations */
export function candidateCountForRisk(risk: ShotGenerationRisk): number {
  return Math.max(1, Math.min(5, risk.recommendedCandidates));
}
