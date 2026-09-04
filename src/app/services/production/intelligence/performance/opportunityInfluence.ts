/**
 * Optional influence on Viral Sparks opportunity scoring — no second engine.
 * Market evidence vs account-specific evidence remain distinct.
 */

import type { CreativeLearning } from "./types";

export interface OpportunityLearningBoost {
  scoreDelta: number;
  reasons: string[];
  evidenceSource: "account_specific" | "market" | "none";
}

/**
 * Soft boost/penalty for an opportunity given account learnings.
 * Does not treat general market trends as proof for a specific account.
 */
export function opportunityBoostFromLearning(params: {
  opportunityFormat?: string;
  opportunityHookHint?: string;
  accountLearnings: CreativeLearning[];
  marketNotes?: string[];
}): OpportunityLearningBoost {
  const reasons: string[] = [];
  let delta = 0;
  const account = params.accountLearnings.filter(
    (l) => !l.stale && l.provenance.evidenceType === "account_specific" && l.confidence.evidenceCount >= 3
  );

  for (const l of account) {
    if (params.opportunityFormat && l.kind === "format_pattern" && l.claim.includes(`"${params.opportunityFormat}"`)) {
      if (/stronger/i.test(l.claim)) {
        delta += 0.08 * l.confidence.score;
        reasons.push(`Account learning favors format ${params.opportunityFormat}`);
      } else if (/weaker/i.test(l.claim)) {
        delta -= 0.06 * l.confidence.score;
        reasons.push(`Account learning cautions format ${params.opportunityFormat}`);
      }
    }
    if (params.opportunityHookHint && l.kind === "hook_pattern" && l.claim.includes(`"${params.opportunityHookHint}"`)) {
      if (/stronger/i.test(l.claim)) {
        delta += 0.07 * l.confidence.score;
        reasons.push(`Account learning favors hook ${params.opportunityHookHint}`);
      }
    }
  }

  // Market notes never masquerade as account proof
  if (params.marketNotes?.length && !account.length) {
    reasons.push("Market evidence noted separately — not treated as account proof");
    return { scoreDelta: 0, reasons, evidenceSource: "market" };
  }

  return {
    scoreDelta: Math.max(-0.2, Math.min(0.2, delta)),
    reasons,
    evidenceSource: account.length ? "account_specific" : "none",
  };
}
