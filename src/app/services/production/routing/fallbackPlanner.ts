import type { ShotRoutingDecision } from "../specification/routingSpec";
import { classifyRoutingFailure, type RoutingFailureReason } from "./routingWeights";

export interface FallbackPlan {
  nextProvider: string;
  reason: string;
  failureReason: RoutingFailureReason;
  changeStrategy?: string;
  /** Inputs to adjust on retry */
  changedInputs?: string[];
}

/**
 * Task-specific fallback — only uses capability-compatible fallbacks already on the decision.
 * Never falls back to an incompatible provider merely because it exists.
 */
export function buildFallbackPlan(
  decision: ShotRoutingDecision,
  failureReasons: string[] = []
): FallbackPlan | null {
  const next = decision.fallbacks[0];
  if (!next) return null;

  const classified = classifyRoutingFailure(failureReasons.join(" ") || "unknown");
  const identity = classified === "identity_drift";
  const capability = classified === "capability_missing";

  // If the listed fallback still has missing caps that caused failure, skip to next
  let chosen = next;
  if (capability && next.missingCapabilities?.length) {
    const alt = decision.fallbacks.find((f) => !(f.missingCapabilities || []).length) || next;
    chosen = alt;
  }

  return {
    nextProvider: chosen.provider,
    reason: identity
      ? `Identity issue — switching to ${chosen.provider} for stronger consistency`
      : capability
        ? `Capability gap — switching to ${chosen.provider}`
        : chosen.reason || `Fallback after ${decision.provider} failure (${classified})`,
    failureReason: classified,
    changeStrategy: identity ? "multi_reference" : undefined,
    changedInputs: identity
      ? ["referenceStrength", "characterRefs"]
      : classified === "output_validation_failure"
        ? ["compiledPrompt"]
        : undefined,
  };
}
