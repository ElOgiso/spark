/**
 * Phase 7 creative strategy module exports.
 */

export type * from "./types";
export { understandIntent } from "./intentUnderstanding";
export { buildAudienceProfile } from "./audienceModel";
export { planHook } from "./hookPlanner";
export { selectFormat, planPacing } from "./formatIntelligence";
export { estimateProductionComplexity } from "./complexityEstimator";
export { planMasterReuse } from "./masterReuse";
export {
  extractBrandRequirements,
  resolveOptimizationProfile,
  detailForProductionMode,
} from "./brandIntelligence";
export { recommendCreativeEconomics } from "./creativeEconomics";
export { runCreativePreflight } from "./creativePreflight";
export {
  aggregateFailurePatterns,
  diagnoseCreativeFailures,
  applyCreativeDiagnosis,
} from "./qcFeedback";
export {
  buildCreativeStrategy,
  type BuildCreativeStrategyInput,
  type BuildCreativeStrategyResult,
} from "./strategyBuilder";
