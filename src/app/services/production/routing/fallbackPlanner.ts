import type { ShotRoutingDecision } from "../specification/routingSpec";

export interface FallbackPlan {
  nextProvider: string;
  reason: string;
  changeStrategy?: string;
}

export function buildFallbackPlan(
  decision: ShotRoutingDecision,
  failureReasons: string[] = []
): FallbackPlan | null {
  const next = decision.fallbacks[0];
  if (!next) return null;
  const identity = failureReasons.some((r) => /identity|character|drift/i.test(r));
  return {
    nextProvider: next.provider,
    reason: identity
      ? `Identity issue — switching to ${next.provider} for stronger consistency`
      : next.reason || `Fallback after ${decision.provider} failure`,
    changeStrategy: identity ? "multi_reference" : undefined,
  };
}
