/**
 * Intent understanding — what was said vs what they are trying to achieve.
 * Clarifies only when ambiguity materially affects production.
 */

import type { CreativeObjective, ClarificationRequest, FieldProvenance, DecisionExplanation } from "./types";
import type { Brand, Character, ViralSpark } from "../../../../domain/types";
import type { CreatorProfile } from "../../specification/creatorProfile";

export interface IntentUnderstandingInput {
  idea: string;
  brand?: Brand;
  character?: Character;
  creatorProfile?: CreatorProfile;
  spark?: ViralSpark;
  platformHints?: string[];
  productionMode?: string;
  explicitObjective?: string;
}

export interface IntentUnderstandingResult {
  objective: CreativeObjective;
  ambiguous: boolean;
  candidateInterpretations: string[];
  clarificationRequests: ClarificationRequest[];
  explanation: DecisionExplanation;
}

export function understandIntent(input: IntentUnderstandingInput): IntentUnderstandingResult {
  const raw = (input.idea || input.spark?.hook || input.spark?.title || "").trim();
  const subject = raw || "unknown subject";
  const lower = subject.toLowerCase();

  const candidates: string[] = [];
  if (/discipline|motivat|mindset|habit/.test(lower)) {
    candidates.push("motivational short", "personal brand monologue", "educational explainer");
  }
  if (/product|buy|launch|offer|saas|app/.test(lower)) {
    candidates.push("advertisement", "product showcase");
  }
  if (/how to|explain|learn|guide|tutorial/.test(lower)) {
    candidates.push("educational short", "explainer");
  }
  if (/story|film|cinematic|narrative/.test(lower)) {
    candidates.push("cinematic narrative", "story-driven short");
  }
  if (/docu|investigate|history|true story/.test(lower)) {
    candidates.push("documentary");
  }
  if (/music|song|lyrics|mv/.test(lower)) {
    candidates.push("music video", "montage");
  }
  if (!candidates.length) {
    candidates.push("social commentary", "educational short", "cinematic narrative");
  }

  let objectiveText: string | undefined = input.explicitObjective?.trim();
  let objectiveProvenance: FieldProvenance = "unknown";
  let confidence = 0.45;

  if (objectiveText) {
    objectiveProvenance = "explicit";
    confidence = 0.95;
  } else if (input.spark?.angle || input.spark?.hook) {
    objectiveText = `Deliver on: ${(input.spark.angle || input.spark.hook || "").slice(0, 200)}`;
    objectiveProvenance = "project";
    confidence = 0.7;
  } else if (input.brand?.niche) {
    objectiveText = `Engage ${input.brand.niche} audience and hold attention through a clear payoff`;
    objectiveProvenance = "brand";
    confidence = 0.6;
  } else if (input.creatorProfile?.creatorTypes?.length) {
    objectiveText = `Deliver a strong ${input.creatorProfile.creatorTypes[0]} piece that retains attention to the end`;
    objectiveProvenance = "creator";
    confidence = 0.55;
  } else if (input.platformHints?.some((p) => /short|tiktok|reels/i.test(p))) {
    objectiveText = "Create curiosity early and deliver a satisfying payoff before drop-off";
    objectiveProvenance = "inferred";
    confidence = 0.5;
  } else {
    objectiveText = "Communicate the subject clearly with a coherent opening and payoff";
    objectiveProvenance = "inferred";
    confidence = 0.4;
  }

  const ambiguous =
    confidence < 0.55 &&
    candidates.length >= 3 &&
    !input.explicitObjective &&
    !input.brand?.niche &&
    !(input.spark?.angle || input.spark?.hook);

  const clarificationRequests: ClarificationRequest[] = [];
  if (ambiguous && materiallyAffectsProduction(candidates)) {
    clarificationRequests.push({
      id: "clarify_format_objective",
      field: "objective_format",
      question: "Which direction fits best for this idea?",
      whyNeeded: "Multiple viable formats would produce very different productions",
      blocking: false,
    });
  }

  const objective: CreativeObjective = {
    subject,
    objective: objectiveText,
    subjectProvenance: raw ? "explicit" : "unknown",
    objectiveProvenance,
    confidence,
  };

  return {
    objective,
    ambiguous,
    candidateInterpretations: candidates.slice(0, 4),
    clarificationRequests,
    explanation: {
      decision: "creative_objective",
      reasons: [
        `Subject taken from ${objective.subjectProvenance} user intent`,
        `Objective provenance: ${objectiveProvenance}`,
        ambiguous ? "Ambiguity retained — clarification optional, not forced" : "Sufficient context to proceed",
      ],
      evidence: [
        raw ? `idea:${raw.slice(0, 80)}` : "empty_idea",
        input.brand?.niche ? `brand_niche:${input.brand.niche}` : "",
        input.creatorProfile?.creatorTypes?.[0] ? `creator_type:${input.creatorProfile.creatorTypes[0]}` : "",
      ].filter(Boolean),
      confidence,
      alternatives: candidates.slice(0, 3),
    },
  };
}

function materiallyAffectsProduction(candidates: string[]): boolean {
  const buckets = new Set(
    candidates.map((c) => {
      if (/ad|product/.test(c)) return "commerce";
      if (/docu|interview/.test(c)) return "doc";
      if (/music|montage/.test(c)) return "music";
      if (/cinematic|story|narrative|film/.test(c)) return "narrative";
      return "social";
    })
  );
  return buckets.size >= 2;
}
