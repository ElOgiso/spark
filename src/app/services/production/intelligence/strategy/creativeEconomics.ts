/**
 * Creative economics hints — no fabricated prices; capability-level tradeoffs only.
 */

import type { OptimizationProfile, ProductionComplexity, DecisionExplanation } from "./types";

export interface CreativeEconomicsRecommendation {
  preferredStrategies: string[];
  avoidStrategies: string[];
  retryBudgetHint: "tight" | "standard" | "generous";
  qcStrictnessHint: "lenient" | "standard" | "strict";
  rationale: string[];
  explanation: DecisionExplanation;
}

export function recommendCreativeEconomics(params: {
  optimizationProfile: OptimizationProfile;
  complexity: ProductionComplexity;
}): CreativeEconomicsRecommendation {
  const { optimizationProfile: profile, complexity } = params;
  let preferred = ["image_to_video", "first_last_frame"];
  let avoid = ["multi_reference_heavy", "long_continuous_generation"];
  let retry: CreativeEconomicsRecommendation["retryBudgetHint"] = "standard";
  let qc: CreativeEconomicsRecommendation["qcStrictnessHint"] = "standard";

  if (profile === "quality_first") {
    preferred = ["multi_reference", "first_last_frame", "image_to_video"];
    avoid = ["slideshow_still_only"];
    retry = "generous";
    qc = "strict";
  } else if (profile === "speed_first") {
    preferred = ["image_to_video", "slideshow_still"];
    avoid = ["multi_reference", "complex_continuity_chains"];
    retry = "tight";
    qc = "lenient";
  } else if (profile === "cost_sensitive") {
    preferred = ["slideshow_still", "image_to_video"];
    avoid = ["multi_reference", "repeated_full_regeneration"];
    retry = "tight";
    qc = "standard";
  }

  if (complexity.continuityRisk === "high") {
    preferred = Array.from(new Set(["first_last_frame", ...preferred]));
    avoid = Array.from(new Set([...avoid, "independent_unconnected_shots"]));
  }

  const rationale = [
    `Optimization profile: ${profile}`,
    `Complexity ${complexity.level} / continuity ${complexity.continuityRisk}`,
    "No monetary prices fabricated — routing retains real cost metadata",
  ];

  return {
    preferredStrategies: preferred,
    avoidStrategies: avoid,
    retryBudgetHint: retry,
    qcStrictnessHint: qc,
    rationale,
    explanation: {
      decision: "creative_economics",
      reasons: rationale,
      evidence: preferred,
      confidence: 0.7,
      alternatives: [],
    },
  };
}
