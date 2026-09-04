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
  makeExecutionError,
  classifyProviderFailure,
  sanitizeDiagnostics,
  userFacingExecutionMessage,
} from "./errors";

export { canTransition, transitionStatus, isTerminalStatus, isActiveStatus } from "./jobStateMachine";
export { computeBackoffDelayMs, DEFAULT_BACKOFF_POLICY } from "./backoff";
export {
  buildTaskInputHash,
  createMemoryIdempotencyStore,
  findReusableExecution,
  idempotencyKey,
} from "./idempotency";
export { prepareTaskInputs } from "./inputPreparation";
export { validateNormalizedOutput, expectationsFromPrepared } from "./outputValidation";
export {
  persistNormalizedOutput,
  createMemoryAssetPersistPort,
  enrichOutputMetadata,
} from "./outputNormalization";
export { createMemoryLogger, logExecutionTransition } from "./observability";
export {
  selectReadyBatch,
  deriveProductionState,
  DEFAULT_SCHEDULER_CONFIG,
} from "./scheduler";
export { GenerationExecutionEngine } from "./executionEngine";
export { executeProduction } from "./productionExecutor";
export {
  createDefaultAdapterRegistry,
  listRegisteredAdapterCapabilities,
  resolveAdapter,
  resolveAdapterForTask,
  createKlingAdapter,
  createSeedanceAdapter,
  createGrokVideoAdapter,
  createImageAdapter,
  createVoiceAdapter,
  createMergeAdapter,
} from "./adapters/registry";
export type { MediaProviderAdapter, AdapterPorts } from "./adapters/registry";
export { createRuntimeAdapterPorts } from "./runtimePorts";
