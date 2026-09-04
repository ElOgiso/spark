/**
 * Production complexity estimator — adaptive shot/scene counts, not fixed templates.
 */

import type { ProductionComplexity, DecisionExplanation, CreativeFormatId, OptimizationProfile } from "./types";

export function estimateProductionComplexity(params: {
  durationSec?: number;
  format: CreativeFormatId;
  requiresCharacters: boolean;
  characterCount?: number;
  locationCount?: number;
  wardrobeChanges?: number;
  hasDialogue: boolean;
  hasAction: boolean;
  hasVfx: boolean;
  continuitySensitive?: boolean;
  optimizationProfile: OptimizationProfile;
}): { complexity: ProductionComplexity; explanation: DecisionExplanation } {
  const duration = params.durationSec ?? 60;
  let score = 0;
  const notes: string[] = [];

  if (duration <= 30) score += 1;
  else if (duration <= 90) score += 2;
  else if (duration <= 180) score += 3;
  else score += 4;

  const chars = params.characterCount ?? (params.requiresCharacters ? 1 : 0);
  score += Math.min(3, chars);
  if (chars > 1) notes.push("multi-character continuity");

  const locs = params.locationCount ?? 1;
  score += Math.min(3, Math.max(0, locs - 1));
  if (locs > 2) notes.push("multi-location");

  const wardrobe = params.wardrobeChanges ?? 0;
  score += Math.min(2, wardrobe);
  if (wardrobe > 0) notes.push("wardrobe changes");

  if (params.hasDialogue) score += 1;
  if (params.hasAction) score += 1;
  if (params.hasVfx) {
    score += 2;
    notes.push("VFX increases generation risk");
  }
  if (params.continuitySensitive) {
    score += 2;
    notes.push("high continuity sensitivity");
  }
  if (/cinematic|narrative|documentary|music/.test(params.format)) score += 1;

  let level: ProductionComplexity["level"] = "simple";
  if (score >= 12) level = "high_complexity";
  else if (score >= 8) level = "complex";
  else if (score >= 5) level = "moderate";

  // Adaptive scene/shot estimates
  const maxClip = level === "simple" ? 8 : level === "moderate" ? 7 : 6;
  let estimatedScenes = Math.max(2, Math.min(24, Math.ceil(duration / maxClip)));
  let shotsPerScene =
    level === "simple" ? 1 : level === "moderate" ? 2 : level === "complex" ? 2.5 : 3;
  if (/montage|music/.test(params.format)) shotsPerScene = Math.max(shotsPerScene, 2);
  if (/talking_head|explainer|educational/.test(params.format) && level === "simple") {
    shotsPerScene = 1;
  }

  let simplificationApplied = false;
  const simplificationNotes: string[] = [];

  // Cost/speed profiles simplify when complexity is not creatively required
  if (
    (params.optimizationProfile === "cost_sensitive" || params.optimizationProfile === "speed_first") &&
    level !== "simple" &&
    !params.continuitySensitive &&
    locs <= 2 &&
    wardrobe <= 1
  ) {
    simplificationApplied = true;
    if (level === "high_complexity") level = "complex";
    else if (level === "complex") level = "moderate";
    else level = "simple";
    shotsPerScene = Math.max(1, shotsPerScene - 0.5);
    estimatedScenes = Math.max(2, estimatedScenes - 1);
    simplificationNotes.push("Reduced complexity for optimization profile without harming core objective");
  }

  // Unnecessary complexity reduction: long duration but talking-head / explainer
  if (
    /talking_head|explainer|educational_short/.test(params.format) &&
    estimatedScenes > 8 &&
    chars <= 1 &&
    locs <= 1
  ) {
    simplificationApplied = true;
    estimatedScenes = Math.min(estimatedScenes, 6);
    shotsPerScene = 1;
    simplificationNotes.push("Single-location talking/explainer — fewer scenes/shots suffice");
    if (level === "complex" || level === "high_complexity") level = "moderate";
  }

  const estimatedShots = Math.max(estimatedScenes, Math.round(estimatedScenes * shotsPerScene));
  const estimatedAssets = estimatedShots + (params.hasDialogue || params.requiresCharacters ? 2 : 1);

  const continuityRisk: ProductionComplexity["continuityRisk"] =
    chars + locs + wardrobe >= 5 ? "high" : chars + locs + wardrobe >= 3 ? "medium" : "low";
  const generationRisk: ProductionComplexity["generationRisk"] =
    level === "high_complexity" || params.hasVfx
      ? "high"
      : level === "complex" || continuityRisk === "medium"
        ? "medium"
        : "low";

  const complexity: ProductionComplexity = {
    level,
    estimatedScenes,
    estimatedShots,
    estimatedAssets,
    continuityRisk,
    generationRisk,
    rationale: `Score=${score}; format=${params.format}; duration=${duration}s`,
    simplificationApplied,
    simplificationNotes,
  };

  return {
    complexity,
    explanation: {
      decision: "production_complexity",
      reasons: [
        complexity.rationale,
        ...notes,
        ...simplificationNotes,
        `Scenes≈${estimatedScenes}, shots≈${estimatedShots}`,
      ],
      evidence: [`score:${score}`, `level:${level}`],
      confidence: 0.75,
      alternatives: [],
    },
  };
}
