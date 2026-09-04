/**
 * Structured audience reasoning — no unsupported demographic invention.
 */

import type { AudienceProfile, DecisionExplanation } from "./types";
import type { Brand } from "../../../../domain/types";
import type { CreatorProfile } from "../../specification/creatorProfile";
import type { CreativeObjective } from "./types";

export function buildAudienceProfile(params: {
  ideaAudienceHint?: string;
  brand?: Brand;
  creatorProfile?: CreatorProfile;
  platforms?: string[];
  objective: CreativeObjective;
  tone?: string;
}): { audience: AudienceProfile; explanation: DecisionExplanation } {
  const platforms = params.platforms || [];
  let primary = params.ideaAudienceHint || params.brand?.audience?.primary || "general viewers";
  let provenance: AudienceProfile["provenance"] = params.ideaAudienceHint
    ? "inferred"
    : params.brand?.audience?.primary
      ? "brand"
      : "unknown";
  let confidence = params.brand?.audience?.primary ? 0.7 : params.ideaAudienceHint ? 0.55 : 0.35;

  if (params.creatorProfile?.creatorTypes?.includes("education")) {
    primary = params.brand?.audience?.primary || "learners seeking clear takeaways";
    provenance = params.brand?.audience?.primary ? "brand" : "creator";
    confidence = Math.max(confidence, 0.6);
  }

  const shortForm = platforms.some((p) => /short|tiktok|reels|instagram/i.test(p));
  const knowledgeLevel: AudienceProfile["knowledgeLevel"] = /beginner|intro|101|how to/i.test(
    params.objective.subject
  )
    ? "novice"
    : /advanced|pro|expert/i.test(params.objective.subject)
      ? "expert"
      : provenance === "unknown"
        ? "unknown"
        : "intermediate";

  const audience: AudienceProfile = {
    primaryAudience: primary,
    knowledgeLevel,
    intent: params.objective.objective.slice(0, 160),
    emotionalStartingPoint: params.tone === "unknown" ? "neutral curiosity" : `inclined toward ${params.tone}`,
    desiredEmotionalOutcome: inferDesiredEmotion(params.objective.objective, params.tone),
    attentionCharacteristics: shortForm
      ? ["short attention window", "needs early hook", "skips weak openings"]
      : ["can tolerate slower setup", "expects coherence"],
    platformBehaviorNotes: platforms.map((p) => `platform:${p}`),
    confidence,
    provenance,
  };

  return {
    audience,
    explanation: {
      decision: "audience_profile",
      reasons: [
        `Audience provenance: ${provenance}`,
        shortForm ? "Short-form platform behavior applied" : "Standard attention model",
      ],
      evidence: [primary, ...platforms.slice(0, 2)],
      confidence,
      alternatives: [],
    },
  };
}

function inferDesiredEmotion(objective: string, tone?: string): string {
  const o = objective.toLowerCase();
  if (/buy|convert|sign up|consider using/.test(o)) return "curiosity → consideration";
  if (/motivat|inspire/.test(o)) return "doubt → determination";
  if (/learn|understand|explain/.test(o)) return "confusion → clarity";
  if (tone && tone !== "unknown") return `${tone} resolved into a clear takeaway`;
  return "engagement → satisfying resolution";
}
