// ── Integration Manifest Contract ─────────────────────────────────────
// The unified representation for all pluggable external tools and APIs.

export type ServiceType =
  | "MCP"
  | "REST"
  | "GraphQL"
  | "CLI"
  | "LocalEngine"
  | "DesktopApp"
  | "CloudAPI"
  | "Storage"
  | "Publishing"
  | "Analytics"
  | "Research"
  | "Memory"
  | "Database"
  | "Custom";

export type IntegrationCategory =
  | "MediaGeneration"
  | "MediaEditing"
  | "Voice"
  | "Research"
  | "Memory"
  | "Publishing"
  | "Analytics"
  | "Storage"
  | "Workflow"
  | "Productivity"
  | "Developer"
  | "Custom";

export interface IntegrationPermissions {
  read: boolean;
  write: boolean;
  execute: boolean;
  destructive: boolean;
}

export type ExecutionStrategyType = "sync" | "async" | "polling" | "streaming" | "webhook";

export interface FallbackPolicy {
  retryCount: number;
  allowFallback: boolean;
  fallbackCapabilities?: string[];
}

export interface IntegrationManifest {
  id: string;
  provider: string;
  category: IntegrationCategory;
  type: ServiceType;
  version: string;
  capabilities: string[];
  executionStrategy: ExecutionStrategyType;
  fallbackPolicy: FallbackPolicy;
  permissions: IntegrationPermissions;
  authentication: {
    type: 'ApiKey' | 'OAuth' | 'None' | 'Custom';
    hasCredentials?: boolean;
  };
  costMetrics?: {
    avgCostPerRequest: number;
    billingType: 'Free' | 'PayAsYouGo' | 'Subscription';
  };
  limits?: {
    rateLimitPerMinute: number;
    quotaLimitDaily?: number;
  };
}
