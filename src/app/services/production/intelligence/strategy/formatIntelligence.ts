/**
 * Format + pacing intelligence — extensible descriptors, not a locked genre enum.
 */

import type {
  CreativeFormatId,
  PacingStrategy,
  DecisionExplanation,
  CreativeObjective,
  AudienceProfile,
} from "./types";
import type { ContentGenreId } from "../../specification/productionSpec";

export function selectFormat(params: {
  genre: ContentGenreId | string;
  styleTags?: string[];
  objective: CreativeObjective;
  candidates?: string[];
}): { format: CreativeFormatId; alternatives: CreativeFormatId[]; explanation: DecisionExplanation } {
  const genre = String(params.genre);
  const tags = (params.styleTags || []).map((t) => t.toLowerCase());
  const obj = params.objective.objective.toLowerCase();

  let format: CreativeFormatId = "hybrid";
  if (tags.includes("talking-head") || tags.includes("faceless") === false && /host|monologue/.test(obj)) {
    format = "talking_head";
  }
  if (genre === "documentary" || genre === "news_explainer") format = "documentary";
  else if (genre === "educational") format = "educational_short";
  else if (genre === "advertisement" || genre === "product_demo") format = "advertisement";
  else if (genre === "music_video") format = "music_video";
  else if (genre === "narrative_film" || genre === "anime") format = "cinematic_narrative";
  else if (genre === "social" || genre === "comedy") format = "social_commentary";
  else if (/explain|how to|tutorial/.test(params.objective.subject.toLowerCase())) format = "explainer";
  else if (genre === "travel" || genre === "sports") format = "montage";
  else if (genre === "custom") format = "hybrid";

  const alternatives: CreativeFormatId[] = [];
  if (format !== "documentary") alternatives.push("documentary");
  if (format !== "explainer") alternatives.push("explainer");
  if (format !== "cinematic_narrative") alternatives.push("cinematic_narrative");
  if (format !== "talking_head") alternatives.push("talking_head");

  return {
    format,
    alternatives: alternatives.slice(0, 2),
    explanation: {
      decision: "format_strategy",
      reasons: [`Mapped from genre=${genre}`, tags.length ? `Style tags: ${tags.join(",")}` : "No style tags"],
      evidence: [genre, format],
      confidence: genre === "custom" ? 0.45 : 0.75,
      alternatives: alternatives.slice(0, 2),
    },
  };
}

export function planPacing(params: {
  format: CreativeFormatId;
  durationSec?: number;
  audience: AudienceProfile;
  payoff: string;
}): { pacing: PacingStrategy; explanation: DecisionExplanation } {
  const format = params.format;
  const short = (params.durationSec || 60) <= 60;

  let model = "three_act_compressed";
  let openingBeat = "Hook → orientation";
  let escalation = ["Raise stakes", "Add specificity"];
  let reveals = ["Core insight"];
  let visualChanges = ["Cut on information change"];
  let emotionalTurns = ["Curiosity → investment"];
  let tension = ["Unresolved question mid-piece"];
  let ending = "Payoff + soft landing";

  if (/documentary|interview/.test(format)) {
    model = "observational_escalation";
    openingBeat = "Stakes image";
    escalation = ["Context", "Human detail", "Consequence"];
    reveals = ["Cause", "Contradiction", "Resolution frame"];
    visualChanges = ["Location/time shifts with intention"];
    emotionalTurns = ["Distance → empathy"];
    tension = ["Unresolved tension before final statement"];
    ending = "Reflective payoff tied to opening stakes";
  } else if (/advertisement|product/.test(format)) {
    model = "problem_solution_proof";
    openingBeat = "Friction";
    escalation = ["Cost of problem", "Solution reveal"];
    reveals = ["Benefit", "Proof"];
    visualChanges = ["Before/after contrast"];
    emotionalTurns = ["Frustration → relief"];
    tension = ["Will this actually work?"];
    ending = "CTA / brand lockup";
  } else if (/music|montage/.test(format)) {
    model = "rhythmic_montage";
    openingBeat = "Pattern interrupt on beat";
    escalation = ["Motif variations", "Intensity climb"];
    reveals = ["Thematic image"];
    visualChanges = ["Beat-synced cuts"];
    emotionalTurns = ["Build → release"];
    tension = ["Withheld climax visual"];
    ending = "Final motif resolution";
  } else if (/explainer|educational/.test(format)) {
    model = "promise_map_proof";
    openingBeat = "Promise the takeaway";
    escalation = ["Map", "Example", "Edge case"];
    reveals = ["Key mechanism"];
    visualChanges = ["Diagram → real-world"];
    emotionalTurns = ["Confusion → clarity"];
    tension = ["Common misconception"];
    ending = "Recap + retention cue";
  } else if (short || params.audience.attentionCharacteristics.some((a) => /short attention/.test(a))) {
    model = "hook_value_payoff";
    openingBeat = "Immediate hook";
    escalation = ["One escalation only"];
    reveals = ["Single key reveal"];
    visualChanges = ["Frequent but purposeful cuts"];
    emotionalTurns = ["Curiosity spike"];
    tension = ["Brief unresolved beat"];
    ending = "Fast payoff";
  }

  const pacing: PacingStrategy = {
    model,
    openingBeat,
    escalation,
    informationReveals: reveals,
    visualChangePoints: visualChanges,
    emotionalTurns,
    tensionPoints: tension,
    payoff: params.payoff,
    ending,
    rationale: `Pacing model ${model} for format ${format}`,
    confidence: 0.7,
  };

  return {
    pacing,
    explanation: {
      decision: "pacing_strategy",
      reasons: [`Format-specific model ${model}`, short ? "Short duration compression" : "Standard duration pacing"],
      evidence: [format, String(params.durationSec || "unknown")],
      confidence: pacing.confidence,
      alternatives: ["hook_value_payoff", "three_act_compressed", "observational_escalation"].filter(
        (m) => m !== model
      ),
    },
  };
}
