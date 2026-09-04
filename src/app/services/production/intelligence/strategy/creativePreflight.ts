/**
 * Creative quality preflight — before generation pipeline entry.
 */

import type {
  CreativeStrategy,
  CreativePreflightResult,
  ClarificationRequest,
  DecisionExplanation,
} from "./types";

export function runCreativePreflight(strategy: CreativeStrategy): CreativePreflightResult {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];
  const clarificationRequests: ClarificationRequest[] = [...strategy.clarificationRequests];
  let score = 70;

  if (strategy.objective.confidence >= 0.6) {
    strengths.push("Objective is clear enough to produce");
    score += 8;
  } else {
    weaknesses.push("Objective confidence is low");
    recommendations.push("Infer stronger objective from brand/creator context or ask one clarifying question");
    score -= 10;
  }

  if (strategy.audience.confidence >= 0.5) {
    strengths.push("Audience profile available");
    score += 5;
  } else {
    weaknesses.push("Audience is under-specified");
    score -= 5;
  }

  if (strategy.hook.type && strategy.hook.expectedPayoff) {
    strengths.push("Hook connected to payoff");
    score += 8;
  } else {
    weaknesses.push("Weak or disconnected hook");
    score -= 12;
  }

  if (strategy.payoff?.trim()) {
    strengths.push("Payoff defined");
    score += 5;
  } else {
    weaknesses.push("Missing payoff");
    score -= 10;
  }

  if (strategy.format) {
    strengths.push(`Format strategy: ${strategy.format}`);
    score += 4;
  }

  if (strategy.complexity.simplificationApplied) {
    strengths.push("Unnecessary complexity reduced");
    score += 4;
  }

  if (strategy.complexity.continuityRisk === "high" && strategy.complexity.level === "high_complexity") {
    weaknesses.push("Continuity requirements may be unrealistic for budget");
    recommendations.push("Simplify locations/wardrobe or strengthen master references");
    score -= 8;
  }

  if (strategy.complexity.estimatedShots > strategy.complexity.estimatedScenes * 4) {
    weaknesses.push("Shot count may be unnecessarily high");
    recommendations.push("Prefer editorial coverage over extra generations where possible");
    score -= 6;
  }

  if (strategy.brandRequirements.length) {
    strengths.push("Brand constraints incorporated");
    score += 3;
  }

  // Platform mismatch soft check
  if (
    strategy.aspectRatio === "16:9" &&
    strategy.platform.some((p) => /tiktok|shorts|reels/i.test(p))
  ) {
    weaknesses.push("Landscape aspect may mismatch short-form platforms");
    recommendations.push("Prefer 9:16 for short-form delivery or produce a vertical variant");
    score -= 4;
  }

  score = Math.max(0, Math.min(100, score));

  let status: CreativePreflightResult["status"] = "ready";
  if (strategy.objective.subjectProvenance === "unknown" || !strategy.objective.subject.trim()) {
    status = "blocked";
    clarificationRequests.push({
      id: "blocked_empty_subject",
      field: "subject",
      question: "What should this production be about?",
      whyNeeded: "Cannot plan without a subject",
      blocking: true,
    });
  } else if (clarificationRequests.some((c) => c.blocking)) {
    status = "clarify";
  } else if (score < 55 || clarificationRequests.length > 0) {
    status = clarificationRequests.length ? "clarify" : "improve";
  } else if (score < 70) {
    status = "improve";
  }

  const explanations: DecisionExplanation[] = [
    {
      decision: "creative_preflight",
      reasons: [`status=${status}`, `score=${score}`, ...recommendations.slice(0, 2)],
      evidence: strengths.slice(0, 3),
      confidence: score / 100,
      alternatives: [],
    },
  ];

  return {
    status,
    score,
    strengths,
    weaknesses,
    recommendations,
    clarificationRequests,
    explanations,
  };
}
