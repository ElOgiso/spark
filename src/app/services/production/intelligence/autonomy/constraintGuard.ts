/**
 * Hard-constraint guard — learning may influence soft strategy only.
 */

import type { CreativeLearning } from "../performance";
import type { HardConstraintSet } from "./types";

const IDENTITY_RE =
  /character (appearance|look|face|wardrobe|outfit|identity)|change (the )?character|different (face|wardrobe|appearance)|alter (approved )?appearance|replace character/i;
const CONTINUITY_RE =
  /break continuity|ignore continuity|unlock continuity|override continuity|drop continuity lock/i;
const STORY_RE =
  /change (the )?story|rewrite (the )?plot|ignore (the )?script|skip (the )?beat|alter narrative requirement/i;
const LEGAL_RE = /ignore (brand|legal|policy|copyright)|bypass (policy|safety)/i;
const USER_INSTR_RE = /ignore (user|creator|explicit) (instruction|preference|request)/i;

export function learningViolatesHardConstraints(
  learning: CreativeLearning,
  constraints?: HardConstraintSet
): { blocked: boolean; reasons: string[] } {
  const text = `${learning.claim} ${learning.recommendation || ""}`;
  const reasons: string[] = [];

  if (constraints?.lockedCharacterAppearance || (constraints?.lockedCharacterIds || []).length) {
    if (IDENTITY_RE.test(text)) reasons.push("Learning would alter locked character visual identity");
  }
  if ((constraints?.continuityLocks || []).length && CONTINUITY_RE.test(text)) {
    reasons.push("Learning would override continuity locks");
  }
  if ((constraints?.storyRequirements || []).length && STORY_RE.test(text)) {
    reasons.push("Learning would rewrite story requirements");
  }
  if ((constraints?.legalConstraints || []).length && LEGAL_RE.test(text)) {
    reasons.push("Learning would bypass legal/policy constraints");
  }
  const explicit = constraints?.explicitUserInstructions || [];
  if (explicit.length) {
    if (USER_INSTR_RE.test(text)) {
      reasons.push("Learning attempts to override explicit user instruction");
    }
    for (const instr of explicit) {
      const locked = instr.match(/prefer(?:s)?\s+([a-z0-9_\- ]{3,40})/i);
      if (!locked) continue;
      const pref = locked[1].trim().toLowerCase();
      if (new RegExp(`avoid ${pref}|not ${pref}|instead of ${pref}|opposite of ${pref}`, "i").test(text)) {
        reasons.push(`Learning conflicts with explicit preference: ${instr}`);
      }
    }
  }
  return { blocked: reasons.length > 0, reasons };
}

export function filterLearningsByHardConstraints(
  learnings: CreativeLearning[],
  constraints?: HardConstraintSet
): { allowed: CreativeLearning[]; blocked: Array<{ learning: CreativeLearning; reasons: string[] }> } {
  const allowed: CreativeLearning[] = [];
  const blocked: Array<{ learning: CreativeLearning; reasons: string[] }> = [];
  for (const l of learnings) {
    const v = learningViolatesHardConstraints(l, constraints);
    if (v.blocked) blocked.push({ learning: l, reasons: v.reasons });
    else allowed.push(l);
  }
  return { allowed, blocked };
}

export function preferExplicitUserPreferences(params: {
  explicitPreferences: string[];
  inferredRecommendations: string[];
}): string[] {
  if (!params.explicitPreferences.length) return params.inferredRecommendations;
  return [
    ...params.explicitPreferences,
    ...params.inferredRecommendations.filter((r) => {
      const lower = r.toLowerCase();
      return !params.explicitPreferences.some((e) => {
        const m = e.match(/prefer(?:s)?\s+([a-z0-9_\- ]{3,40})/i);
        if (!m) return false;
        const pref = m[1].trim().toLowerCase();
        return new RegExp(`avoid ${pref}|not ${pref}|instead of ${pref}`, "i").test(lower);
      });
    }),
  ];
}
