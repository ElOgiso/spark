/**
 * Structured QC — Phase 0 gates + Phase 5 intelligent production quality control.
 */

export type { QcGateStatus, QcGateResult } from "./legacyGates";
export {
  preflightGate,
  shotQualityGate,
  continuityGate,
  audioGate,
  editorialGate,
  finalMasterGate,
} from "./legacyGates";

export type {
  ProductionQCResult,
  QCDimensionResult,
  QCFailure,
  QCWarning,
  QcFailureCode,
  QcRecommendedAction,
  QcResultStatus,
  QcDimensionId,
  ObservedVisualState,
  VisualFrameSample,
  SparkAutomationMode,
  ProductionQcVerdict,
  QcBudgetState,
  RepairDecision,
  QcEvidence,
  QcScoreBreakdown,
} from "./types";

export { QC_FAILURE_CODES, isRetryableFailureCode, prefersProviderChange, prefersReferenceStrengthening } from "./failureTaxonomy";
export {
  DEFAULT_QC_THRESHOLDS,
  thresholdsForQualityTarget,
  statusFromScore,
  type QcThresholdConfig,
} from "./thresholds";
export {
  createDefaultQcBudget,
  createBudgetState,
  canRetryQc,
  canChangeProvider,
  recordQcRetry,
  markBudgetExhausted,
  type QcBudgetConfig,
} from "./budgets";
export { userFacingQcStatus, userFacingQcAction, userFacingFailureSummary } from "./userMessages";
export {
  createStructuralVisualAnalyzer,
  createMockVisualAnalyzer,
  type VisualAnalysisService,
  type VisualAnalysisRequest,
  type VisualAnalysisResult,
} from "./visualAnalysis/service";
export { evaluateShotQc, evaluateAssetQc } from "./shotQc";
export { evaluateSceneQc } from "./sceneQc";
export { evaluateProductionQc } from "./productionQc";
export { planRepairFromQc } from "./repairPlanner";
export { applyAutomationPolicy } from "./automationPolicy";
export {
  runProductionQcHierarchy,
  runQcWithRepairLoop,
  executeProductionWithQc,
  applyRepairToSpec,
  applyQcStatusesToSpec,
  type ShotObservationInput,
  type ProductionQcReport,
  type QcRepairLoopOptions,
  type QcRepairLoopResult,
  type RunProductionQcOptions,
} from "./qcOrchestrator";
