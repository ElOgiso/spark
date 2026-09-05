/**
 * Media Capability / Provider Intelligence — public API (Phase 3).
 * Facts about what SPARK can execute; not a second ModelRouter.
 */

export type {
  MediaModality,
  GenerationMode,
  ReferenceType,
  CameraControlLevel,
  MotionControlLevel,
  CapabilityProvenanceSource,
  CapabilityConfidence,
  RoutingObjective,
  FallbackQuality,
  RoutingReasonCode,
  CapabilityProvenance,
  ReferenceCapabilitySet,
  TemporalCapabilitySet,
  CameraCapabilitySet,
  MotionCapabilitySet,
  OutputCapabilitySet,
  AudioCapabilitySet,
  ExecutionCapabilitySet,
  ControlCapabilitySet,
  CapabilityLimits,
  CapabilityEconomics,
  MediaCapabilityProfile,
  CapabilityRequirements,
  CapabilityMismatch,
  CapabilityMatchItem,
  CapabilityWarning,
  CapabilityMatchResult,
  ProviderHealthSnapshot,
  ProviderPerformanceSnapshot,
  ProviderModelCandidate,
  RoutingScoreBreakdown,
  CandidateRejection,
  FallbackPlanEntry,
  MediaRoutingDecision,
} from "./types";

export { provenance, andBool, minControlLevel, isStale } from "./provenance";
export { MEDIA_CAPABILITY_PROFILES, findProfiles } from "./profiles";
export {
  listAdapterCapabilityClaims,
  getAdapterClaim,
  adapterReferenceTypes,
  adapterProvenanceNote,
  type AdapterCapabilityClaim,
} from "./adapterSupport";
export { resolveEffectiveCapability, type EffectiveCapabilityResult } from "./effective";
export { validateCapabilityRequirements } from "./validate";
export {
  capabilityRequirementsFromShot,
  buildCapabilityRequirements,
  type RequirementsFromShotOptions,
} from "./requirements";
export {
  ensureCapabilityRegistry,
  registerCapabilityProfile,
  getCapabilityProfile,
  listCapabilityProfiles,
  listProviderModelCandidates,
  resetCapabilityRegistryForTests,
  resolveHealthSnapshot,
} from "./registry";
export {
  routeMediaCapability,
  assertExecutableCapability,
  type RouteMediaOptions,
} from "./router";
