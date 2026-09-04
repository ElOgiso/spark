/**
 * Phase 8 — Performance Learning & Adaptive Content Intelligence
 */

export type * from "./types";
export {
  CANONICAL_METRIC_KEYS,
  CROSS_PLATFORM_COMPARABLE,
  makeMetric,
  getMetric,
  availableValue,
  completenessScore,
  normalizeForComparison,
  metricKindFor,
} from "./metrics";
export {
  PERFORMANCE_WINDOWS,
  windowDef,
  inferWindowFromAge,
  ageMs,
  resolveWindow,
  windowsAreComparable,
} from "./windows";
export {
  metricsFromPlatformRecord,
  metricsFromContentRow,
  snapshotFromPlatformRecord,
  snapshotFromContentRow,
  observationsFromSnapshot,
  buildSeries,
  padCanonicalMetrics,
} from "./normalize";
export {
  creativeDnaFromStrategy,
  contextFromDna,
  associateSnapshotContext,
} from "./creativeDna";
export { analyzePerformance, type AnalyzePerformanceInput } from "./analyzer";
export { makeDiagnosis, KNOWN_DIAGNOSIS_CODES } from "./diagnoses";
export { analyzeRetention, type RetentionCurvePoint } from "./retention";
export {
  computeLearningConfidence,
  applyDecay,
  supersedeLearning,
  createLearning,
  accumulateLearnings,
  detectSeriesPattern,
  selectLearningsForContext,
  strengthLabel,
  DEFAULT_DECAY_POLICY,
} from "./learning";
export { defineExperiment, evaluateExperiment } from "./experiments";
export {
  learningToMemoryItem,
  memoryItemsFromLearnings,
  parseLearningHintsFromMemory,
} from "./memoryBridge";
export {
  buildAdaptiveAdvice,
  applyLearningsToStrategy,
  mergeConflictingEvidence,
  DEFAULT_EXPLORATION_POLICY,
} from "./adaptiveStrategy";
export {
  summarizeReliability,
  reliabilityToLearning,
  relateProductionIssueToPerformance,
} from "./reliability";
export { explainAnalysis, explainLearning, learningSummariesForUi } from "./explanations";
export { createPerformanceFeedbackPort, persistLearningsAsMemory } from "./feedbackPort";
export { opportunityBoostFromLearning } from "./opportunityInfluence";
