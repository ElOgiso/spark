export interface ToolCallResult {
  toolId: string;
  toolName: string;
  arguments: Record<string, any>;
  output?: any;
}

export interface AgentResult {
  id: string;
  taskId: string;
  output: string;
  structuredData?: Record<string, any>;
  citations?: string[];
  rawResponse: any;
  metrics: {
    latencyMs: number;
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
  };
  provider?: string;
  model?: string;
  toolCalls?: ToolCallResult[];
  confidence?: number;
  risk?: 'Low' | 'Moderate' | 'High';
  uncertainty?: string;
  recommendedAction?: string;
  reviewNeeded?: boolean;
  warnings?: string[];
  status: "success" | "failure";
}
