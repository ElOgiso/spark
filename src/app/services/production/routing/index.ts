export { routeProductionShots } from "./capabilityRouter";
export { scoreProvidersForShot } from "./modelScorer";
export { selectProviderForShot, planFallback } from "./providerSelector";
export { buildFallbackPlan } from "./fallbackPlanner";
export * from "./capabilityMatrix";
export {
  DEFAULT_ROUTING_WEIGHTS,
  classifyRoutingFailure,
} from "./routingWeights";
export type { RoutingWeightConfig, RoutingFailureReason } from "./routingWeights";
export type { ModelScore } from "./modelScorer";
export type { FallbackPlan } from "./fallbackPlanner";

/** Phase 3 media capability intelligence (hard filter + router) */
export {
  routeMediaCapability,
  assertExecutableCapability,
  capabilityRequirementsFromShot,
  buildCapabilityRequirements,
  validateCapabilityRequirements,
  listProviderModelCandidates,
  listCapabilityProfiles,
  resolveEffectiveCapability,
  MEDIA_CAPABILITY_PROFILES,
} from "../capability";
