/**
 * Concise user-facing explanations — no chain-of-thought.
 */

import type { CreativeLearning, PerformanceAnalysis } from "./types";

export function explainAnalysis(analysis: PerformanceAnalysis): string[] {
  const lines: string[] = [];
  lines.push(analysis.whatHappened);
  if (analysis.performedWell[0]) lines.push(analysis.performedWell[0]);
  if (analysis.underperformed[0]) lines.push(analysis.underperformed[0]);
  if (analysis.evidenceStrength === "insufficient_data") {
    lines.push("SPARK does not have enough evidence to recommend a change yet.");
  }
  if (analysis.nextTests[0]) lines.push(`Next: ${analysis.nextTests[0]}`);
  return lines.slice(0, 5);
}

export function explainLearning(learning: CreativeLearning): string {
  if (learning.confidence.evidenceCount < 3 || learning.confidence.score < 0.35) {
    return "SPARK does not have enough evidence to recommend a change yet.";
  }
  if (learning.kind === "hook_pattern" && /stronger/i.test(learning.claim)) {
    return "This opening pattern has consistently improved retention for this account.";
  }
  if (learning.kind === "format_pattern" || learning.kind === "series_pattern") {
    return "Your strongest videos share a similar narrative structure.";
  }
  if (learning.kind === "duration_pattern" && /0-30s|31-60s/.test(learning.claim)) {
    return "Recent posts suggest shorter openings are performing better.";
  }
  if (learning.stale) {
    return "This result is unusual compared with your recent content.";
  }
  return learning.recommendation || learning.claim;
}

export function learningSummariesForUi(learnings: CreativeLearning[]): Array<{
  title: string;
  body: string;
  confidence: number;
  type: "worked" | "failed" | "learning";
}> {
  return learnings.slice(0, 6).map((l) => ({
    title: l.kind.replace(/_/g, " "),
    body: explainLearning(l),
    confidence: l.confidence.score,
    type: /weak|failure/i.test(l.claim) ? "failed" : l.confidence.score >= 0.55 ? "worked" : "learning",
  }));
}
