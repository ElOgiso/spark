/**
 * Phase 12 — Production hardening / readiness.
 * Extends Phases 0–11; does not create parallel orchestrator/QC/DAG/learning engines.
 */

export type * from "./types";
export {
  validateProductionContracts,
  validateSceneContracts,
  validateShotContracts,
  validateDagContracts,
} from "./contractValidation";
export {
  buildProductionLineageGraph,
  validateLineageIntegrity,
  assertCandidateLineagePreserved,
  assertApprovedAssetsProtected,
} from "./lineageIntegrity";
export {
  normalizeProductionError,
  unknownMetric,
} from "./errorTaxonomy";
export {
  createMemoryIdempotentLifecycleStore,
  productionOperationKey,
  runIdempotentProductionLifecycle,
} from "./idempotentLifecycle";
export {
  createFailureInjector,
  withInjectedFailure,
  expectedPolicyFor,
} from "./failureInjection";
export {
  looksLikeSecretKey,
  isLikelyClientPath,
  findForbiddenClientSecretKeys,
  scrubSecrets,
  assertNoClientSecrets,
} from "./secretsBoundary";
export {
  buildProductionReadinessReport,
  gate,
} from "./readinessScorecard";
export {
  runGoldenProductionScenario,
  runMockedLifecycle,
} from "./goldenScenario";
export {
  evaluateQcEvidence,
  assertNoFakePass,
} from "./qcEvidence";
