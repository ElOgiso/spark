/**
 * Phase 3 capability-routing handoff.
 *
 * Phase 3 routing consumes CapabilityReferenceNeed[] without provider-specific
 * mapping (no kling / veo / seedance / grok field names). Providers remain
 * selected downstream by the capability router using modalityHints + roles only.
 */

import type { CapabilityReferenceNeed, ReferenceBundle } from "./types";
import { referenceBundleToCapabilityNeeds } from "./resolve";

/**
 * Alias for referenceBundleToCapabilityNeeds — explicit Phase 3 boundary.
 */
export function toCapabilityReferenceRequirements(
  bundle: ReferenceBundle
): CapabilityReferenceNeed[] {
  return referenceBundleToCapabilityNeeds(bundle);
}

export type { CapabilityReferenceNeed, ReferenceBundle };
