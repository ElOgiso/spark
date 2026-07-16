import { ExecutionTask } from "./ExecutionTask";
import { AgentResult } from "./AgentResult";

export interface ProviderHealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs: number;
  errorRate: number;
  lastChecked: string;
}

export interface TokenEstimate {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CostEstimate {
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
}

export interface ProviderToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface IProviderAdapter {
  readonly providerName: string;
  readonly supportedModels: string[];

  translateRequest(task: ExecutionTask, tools: ProviderToolDefinition[]): any;
  execute(payload: any, onChunk?: (text: string) => void): Promise<any>;
  normalizeResponse(rawResponse: any, taskId: string): AgentResult;

  estimateTokens(text: string): TokenEstimate;
  estimateCost(task: ExecutionTask, model: string): CostEstimate;

  health(): ProviderHealthStatus;
  supportsStreaming(): boolean;
  supportsToolCalling(): boolean;
  supportsImageGeneration(): boolean;
  supportsEmbeddings(): boolean;
}
