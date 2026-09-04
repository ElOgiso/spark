/**
 * Structured routing weight configuration.
 * Heuristic only — not objective truth. Tunable without scattering constants.
 */

import type { GenerationCapability } from "./capabilityMatrix";

export interface RoutingWeightConfig {
  capabilityFit: number;
  durationFit: number;
  speedBonus: number;
  costBonus: number;
  /** Soft penalty per missing required capability */
  missingCapabilityPenalty: number;
  /** Hard-disqualify if any of these required caps are missing */
  criticalCapabilities: GenerationCapability[];
}

export const DEFAULT_ROUTING_WEIGHTS: RoutingWeightConfig = {
  capabilityFit: 1,
  durationFit: 0.8,
  speedBonus: 0.5,
  costBonus: 0.5,
  missingCapabilityPenalty: 0.15,
  criticalCapabilities: [
    "image_to_video",
    "text_to_image",
    "text_to_video",
    "first_frame_conditioning",
    "last_frame_conditioning",
    "voice",
  ],
};

export type RoutingFailureReason =
  | "provider_unavailable"
  | "capability_missing"
  | "credential_missing"
  | "timeout"
  | "rate_limited"
  | "generation_failure"
  | "output_validation_failure"
  | "identity_drift"
  | "unknown";

export function classifyRoutingFailure(raw: string): RoutingFailureReason {
  const t = (raw || "").toLowerCase();
  if (/unavailable|offline|disabled/.test(t)) return "provider_unavailable";
  if (/credential|api.?key|auth|unauthorized/.test(t)) return "credential_missing";
  if (/timeout|timed.?out/.test(t)) return "timeout";
  if (/rate.?limit|429|quota/.test(t)) return "rate_limited";
  if (/identity|character|drift|face/.test(t)) return "identity_drift";
  if (/validat|qc|quality|policy/.test(t)) return "output_validation_failure";
  if (/capabilit|unsupported|missing/.test(t)) return "capability_missing";
  if (/fail|error|crash/.test(t)) return "generation_failure";
  return "unknown";
}
