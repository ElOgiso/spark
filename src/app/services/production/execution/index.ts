export type {
  GenerationExecution,
  ExecutionStatus,
  ExecutionError,
  ExecutionErrorCode,
  NormalizedMediaOutput,
  ProductionExecutionState,
  ProviderGenerationRequest,
  ProviderJob,
  ProviderJobStatus,
  ProviderCapabilitySnapshot,
  TechnicalValidationResult,
  UsageCostMetadata,
} from "./types";


export {
  executeProductionViaAssetBridge,
  resolveProductionSpec,
  buildSpecLinkedStoryboard,
  buildSpecDrivenBrief,
  ensureGenerationTasks,
  markShotRetry,
  applyTaskDependencyFailures,
  projectAssetsOntoSpec,
  isSpecLinkedStoryboard,
  collectSpecShots,
} from "./productionExecutionBridge";
export type {
  ProductionExecutionBridgeParams,
  ProductionExecutionBridgeResult,
  BridgeLogEvent,
  BridgeLogger,
} from "./productionExecutionBridge";
