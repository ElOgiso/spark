import type { SparkScoreBreakdown } from "../../domain/types";

export interface SignalInputs {
  hookStrength?: number; // 0 - 100
  postingCadence?: number; // 0 - 100
  topicConsistency?: number; // 0 - 100
  audienceMatch?: number; // 0 - 100
  engagementRatio?: number; // 0 - 100
}

export function calculateSparkScore(signals: SignalInputs): { totalScore: number; breakdown: SparkScoreBreakdown } | null {
  const weights: Record<keyof SignalInputs, number> = {
    hookStrength: 0.25,
    postingCadence: 0.2,
    topicConsistency: 0.15,
    audienceMatch: 0.2,
    engagementRatio: 0.2,
  };

  const validKeys = (Object.keys(signals) as (keyof SignalInputs)[]).filter(
    (key) => typeof signals[key] === "number" && !isNaN(signals[key]!)
  );

  // Require at least 2 real signal inputs to calculate a score; otherwise hide score (return null)
  if (validKeys.length < 2) {
    return null;
  }

  let totalWeight = 0;
  let weightedSum = 0;
  const subScores: SparkScoreBreakdown["subScores"] = {};
  const explanation: string[] = [];

  for (const key of validKeys) {
    const val = signals[key]!;
    const weight = weights[key];
    weightedSum += val * weight;
    totalWeight += weight;
    subScores[key] = Math.round(val);

    switch (key) {
      case "hookStrength":
        explanation.push(`Hook Strength: ${Math.round(val)}/100 based on initial curiosity & opener structure`);
        break;
      case "postingCadence":
        explanation.push(`Posting Cadence: ${Math.round(val)}/100 based on upload interval regularity`);
        break;
      case "topicConsistency":
        explanation.push(`Topic Consistency: ${Math.round(val)}/100 based on title & category alignment`);
        break;
      case "audienceMatch":
        explanation.push(`Audience Match: ${Math.round(val)}/100 based on target demographic alignment`);
        break;
      case "engagementRatio":
        explanation.push(`Engagement Ratio: ${Math.round(val)}/100 based on public view & reaction metrics`);
        break;
    }
  }

  const normalizedScore = Math.round(weightedSum / totalWeight);

  return {
    totalScore: normalizedScore,
    breakdown: {
      totalScore: normalizedScore,
      subScores,
      explanation,
    },
  };
}
