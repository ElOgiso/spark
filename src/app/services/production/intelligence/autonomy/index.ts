/**
 * Phase 11 — Autonomous Production + Learning
 * Extends Phase 8 performance learning; preserves Creative Director / router / QC.
 */

export type * from "./types";
export { DEFAULT_AUTONOMY_POLICY } from "./types";
export {
  resolveAutonomyPolicy,
  evaluateAutonomyGate,
  shouldExecuteAutonomously,
} from "./autonomyPolicy";
export {
  learningViolatesHardConstraints,
  filterLearningsByHardConstraints,
  preferExplicitUserPreferences,
} from "./constraintGuard";
export {
  captureLearningSnapshot,
  recordDecision,
  adviceFingerprint,
} from "./lineage";
export {
  runLearningUpdatePipeline,
  getRelevantLearningForDirector,
  buildOutcomeFromLifecycle,
} from "./learningUpdatePipeline";
export {
  deriveProviderPreferences,
  applyProviderPreferenceBonuses,
} from "./providerLearningBridge";
export {
  deriveRepairPreferences,
  preferRepairStrategy,
} from "./repairLearningBridge";
export {
  buildAutonomousPlan,
  planProductionWithLearning,
} from "./autonomousLoop";
export {
  learnRetentionPolicy,
  quarantineNoiseAndOutliers,
  calculateObservationWeight,
  getStoredRetentionObservations,
  saveStoredRetentionObservations,
  recordRetentionObservation,
  DEFAULT_RETENTION_POLICY,
  MIN_RETENTION_SAMPLE_SIZE,
  DEFAULT_OPEN_LOOP_INTERVAL_SEC,
  MIN_OPEN_LOOP_INTERVAL_SEC,
  MAX_OPEN_LOOP_INTERVAL_SEC,
  RETENTION_DECAY_HALF_LIFE_DAYS,
} from "./retentionPolicy";
export type {
  RetentionObservation,
  RetentionPolicy,
  LearnRetentionPolicyResult,
} from "./retentionPolicy";
