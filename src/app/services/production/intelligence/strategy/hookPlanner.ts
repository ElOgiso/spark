/**
 * Hook intelligence — opening must connect to payoff (not empty clickbait).
 */

import type { HookStrategy, DecisionExplanation, CreativeFormatId, CreativeObjective } from "./types";
import type { AudienceProfile } from "./types";

export function planHook(params: {
  objective: CreativeObjective;
  audience: AudienceProfile;
  format: CreativeFormatId;
  tone: string;
}): { hook: HookStrategy; explanation: DecisionExplanation } {
  const format = params.format;
  let type = "curiosity_gap";
  let openingVisual = "Subject enters frame with clear focal action";
  let openingDialogue: string | undefined;
  let curiosityMechanism = "Promise a specific outcome, withhold the method briefly";
  let expectedPayoff = params.objective.objective;

  if (/advertisement|product/.test(format)) {
    type = "problem_agitation";
    openingVisual = "Product-relevant friction shown in first seconds";
    curiosityMechanism = "Show the cost of the status quo before the solution";
    expectedPayoff = "Product resolves the stated friction";
  } else if (/documentary|interview/.test(format)) {
    type = "stakes_reveal";
    openingVisual = "Strong observational detail that implies larger stakes";
    curiosityMechanism = "Open on consequence, then rewind to cause";
  } else if (/explainer|educational/.test(format)) {
    type = "immediate_value";
    openingVisual = "On-screen claim of a concrete takeaway";
    openingDialogue = "One clear promise of what the viewer will understand";
    curiosityMechanism = "Specific promise + incomplete map of how";
  } else if (/music|montage/.test(format)) {
    type = "pattern_interrupt";
    openingVisual = "Unexpected visual rhythm against first beat";
    curiosityMechanism = "Sensory novelty before thematic statement";
  } else if (/cinematic|story|narrative|trailer/.test(format)) {
    type = "conflict_seed";
    openingVisual = "Character in an unresolved situation";
    curiosityMechanism = "Emotional tension without full context";
  } else if (/talking_head|social/.test(format)) {
    type = "direct_address_claim";
    openingVisual = "Host locked, high-contrast framing, assertive presence";
    openingDialogue = "A bold, specific claim tied to the payoff";
    curiosityMechanism = "Authority claim that demands proof";
  }

  if (params.audience.attentionCharacteristics.some((a) => /short attention|early hook/.test(a))) {
    curiosityMechanism += "; compress to first 1–2 seconds";
  }

  const hook: HookStrategy = {
    type,
    rationale: `Selected for format=${format} and objective confidence ${params.objective.confidence}`,
    openingVisual,
    openingDialogue,
    curiosityMechanism,
    expectedPayoff,
    confidence: Math.min(0.9, 0.5 + params.objective.confidence * 0.4),
  };

  return {
    hook,
    explanation: {
      decision: "hook_strategy",
      reasons: [
        `Hook type ${type} matches format ${format}`,
        "Payoff explicitly linked to creative objective",
        "Avoids generic clickbait without delivery path",
      ],
      evidence: [hook.openingVisual, hook.expectedPayoff.slice(0, 80)],
      confidence: hook.confidence,
      alternatives: ["curiosity_gap", "immediate_value", "conflict_seed"].filter((t) => t !== type),
    },
  };
}
