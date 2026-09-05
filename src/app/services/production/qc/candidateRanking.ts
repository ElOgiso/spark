/**
 * Candidate ranking — hard production requirements dominate aesthetic score.
 */

import type { CandidateRankResult, ProductionQCResult, QcFailureCode } from "./types";
import { partitionFailures } from "./scoring";

export function rankCandidates(
  candidates: Array<{ candidateId: string; qc: ProductionQCResult; aestheticScore?: number }>
): CandidateRankResult[] {
  const ranked: CandidateRankResult[] = candidates.map((c) => {
    const { hardFailures, hardFailurePresent } = partitionFailures(c.qc.failures);
    const aestheticScore =
      typeof c.aestheticScore === "number" ? c.aestheticScore : styleAestheticProxy(c.qc);
    const hardRequirementScore = hardFailurePresent
      ? Math.max(0, 40 - hardFailures.length * 15)
      : 100;
    const eligible =
      !hardFailurePresent &&
      c.qc.gateDecision !== "reject" &&
      c.qc.status !== "fail" &&
      c.qc.status !== "retry";
    const rejectionReasons: QcFailureCode[] = hardFailures.map((f) => f.code);
    const rankScore = eligible
      ? hardRequirementScore * 0.7 + aestheticScore * 0.2 + c.qc.score * 0.1
      : hardRequirementScore * 0.9 + aestheticScore * 0.05 + c.qc.score * 0.05 - 100;
    return {
      candidateId: c.candidateId,
      qc: c.qc,
      aestheticScore,
      hardRequirementScore,
      rankScore,
      eligible,
      rejectionReasons,
    };
  });
  return ranked.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return b.rankScore - a.rankScore;
  });
}

function styleAestheticProxy(qc: ProductionQCResult): number {
  const style = qc.scores.dimensions.style;
  const cine = qc.scores.dimensions.cinematography;
  if (style == null && cine == null) return qc.score;
  const vals = [style, cine].filter((v): v is number => typeof v === "number");
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function selectBestValidCandidate(
  candidates: Array<{ candidateId: string; qc: ProductionQCResult; aestheticScore?: number }>
): CandidateRankResult | null {
  const ranked = rankCandidates(candidates);
  return ranked.find((r) => r.eligible) || null;
}
