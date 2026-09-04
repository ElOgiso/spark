export { classifyCreativeIntent, registerGenreClassificationRule, listGenreClassificationRules } from "./genreClassifier";
export { directCreativeIntent } from "./creativeDirector";
export type { CreativeDirection, CreativeDirectorInput, CreativeDirectorResult } from "./creativeDirector";
export { planNarrative, structureForGenre } from "./narrativePlanner";
export { planProductionScenes } from "./productionPlanner";
export {
  createProductionPlan,
  orchestrateIdeaToProductionSpec,
  upgradeProductionWithSpec,
} from "./productionOrchestrator";
export type {
  OrchestrateIdeaResult,
  ProductionIntelligenceTrace,
  OrchestrateIdeaInput,
  CreateProductionPlanInput,
  CreateProductionPlanResult,
} from "./productionOrchestrator";
export {
  validateCreativeDirection,
  validateGenreClassification,
  validateGrammarSelection,
  validateNarrativePlan,
} from "./stageValidation";
export { resolveProductionPreferences } from "./preferenceResolver";
export {
  mapIntelligenceRoleToRoutingCategory,
  resolveIntelligenceRoleProvider,
} from "./intelligenceRoles";
export type { ProductionIntelligenceRole } from "./intelligenceRoles";

/** Phase 7 — Creative Strategy executive layer */
export {
  buildCreativeStrategy,
  understandIntent,
  buildAudienceProfile,
  planHook,
  selectFormat,
  planPacing,
  estimateProductionComplexity,
  planMasterReuse,
  runCreativePreflight,
  recommendCreativeEconomics,
  resolveOptimizationProfile,
  aggregateFailurePatterns,
  diagnoseCreativeFailures,
  applyCreativeDiagnosis,
} from "./strategy";
export type {
  CreativeStrategy,
  CreativePreflightResult,
  CreativeObjective,
  AudienceProfile,
  HookStrategy,
  PacingStrategy,
  ProductionComplexity,
  OptimizationProfile,
  CreativeDiagnosis,
  FailurePatternSummary,
  DecisionExplanation,
  CreativePerformanceFeedbackPort,
  CreativePerformanceHints,
} from "./strategy";

/** Phase 8 — Performance Learning & Adaptive Content Intelligence */
export * from "./performance";
