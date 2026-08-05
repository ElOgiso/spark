export type IntegrationCategory =
  | 'LLM'
  | 'MediaGeneration'
  | 'Voice'
  | 'Productivity'
  | 'Developer'
  | 'Publishing'
  | 'Analytics'
  | 'Storage'
  | 'Local';

export type IntegrationType =
  | 'CloudAPI'
  | 'MCP'
  | 'Publishing'
  | 'Analytics'
  | 'LocalBinary';

export type ExecutionStrategy = 'sync' | 'polling' | 'streaming' | 'webhook';

export interface IntegrationManifest {
  id: string;
  provider: string;
  category: IntegrationCategory;
  type: IntegrationType;
  version: string;
  capabilities: string[];
  executionStrategy: ExecutionStrategy;
  fallbackPolicy: {
    retryCount: number;
    allowFallback: boolean;
  };
  permissions: {
    read: boolean;
    write: boolean;
    execute: boolean;
    destructive: boolean;
  };
  endpoint?: string;
  apiKey?: string;
}
