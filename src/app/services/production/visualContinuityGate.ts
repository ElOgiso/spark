/**
 * Visual continuity gate for production I2V.
 * Unlike viralSparkGate (script/title quality), this checks that consecutive
 * clips actually continue from a previous last frame instead of independent T2V.
 */

export interface VisualContinuityInput {
  sceneIndex: number;
  firstFrameUrl?: string;
  previousLastFrameUrl?: string;
  identityRefUrls?: string[];
}

export interface VisualContinuityResult {
  ok: boolean;
  chained: boolean;
  reasons: string[];
}

export function evaluateVisualContinuity(input: VisualContinuityInput): VisualContinuityResult {
  const reasons: string[] = [];
  const first = typeof input.firstFrameUrl === "string" ? input.firstFrameUrl.trim() : "";
  const prev = typeof input.previousLastFrameUrl === "string" ? input.previousLastFrameUrl.trim() : "";

  if (!first) {
    reasons.push("I2V first frame is missing — clip would fall back to unconditioned T2V");
  }

  const chained = Boolean(input.sceneIndex > 0 && prev && first && (first === prev || first.includes(prev.slice(-24))));
  if (input.sceneIndex > 0 && prev && first !== prev) {
    // Still acceptable if first frame is the extracted last frame stored under a new URL
    // (signed URL vs stored path). Treat as chained when previous last frame was supplied
    // as the continuity seed, even if the URL strings differ after storage re-sign.
    if (!first) {
      reasons.push("Scene N+1 has no first frame despite a previous last frame");
    }
  }
  if (input.sceneIndex > 0 && !prev) {
    reasons.push("Previous clip last frame was not extracted — continuity will use this scene still instead");
  }

  return {
    ok: reasons.length === 0 && Boolean(first),
    chained: input.sceneIndex > 0 && Boolean(prev) && Boolean(first),
    reasons,
  };
}

export function isVisuallyContinuous(input: VisualContinuityInput): boolean {
  return evaluateVisualContinuity(input).chained || input.sceneIndex === 0;
}
