# SPARK Agent Registry Contracts

This document contains the provider-independent TypeScript interface definitions for agent registration, health state tracking, and discovery queries.

---

## 1. Data Contracts

```typescript
export type AgentHealthStatus = "healthy" | "degraded" | "unavailable" | "maintenance";

export type AgentCapabilityType =
  | "research"
  | "writing"
  | "reasoning"
  | "planning"
  | "publishing"
  | "analytics"
  | "memory"
  | "imageGeneration"
  | "videoGeneration"
  | "webSearch"
  | "longContext"
  | "coding";

export interface ExecutionLimits {
  maxCostPerTaskUsd: number;
  maxTokensPerTask: number;
  maxExecutionTimeMs: number;
}

/**
 * 1. AgentDefinition Contract
 * The authoritative metadata schema for registering an agent.
 */
export interface AgentDefinition {
  id: string;                    // Unique identifier (e.g. "spark-research-agent-v1")
  displayName: string;           // Human-readable title
  description: string;           // Clear responsibility summary
  version: string;               // SemVer versioning string
  owner: "spark-core" | "community" | "third-party";
  
  supportedCapabilities: AgentCapabilityType[];
  supportedTaskTypes: string[];  // e.g. ["trend_discovery", "hook_writing"]
  supportedTools: string[];      // List of schema-bound tools (e.g. ["web_search", "assets_reader"])
  
  executionLimits: ExecutionLimits;
  healthStatus: AgentHealthStatus;
}
```

---

## 2. Registry API Interfaces

```typescript
export interface IAgentRegistry {
  /**
   * Appends an agent definition to the catalog.
   */
  registerAgent(definition: AgentDefinition): Promise<void>;

  /**
   * Removes an agent definition from the catalog.
   */
  unregisterAgent(id: string): Promise<void>;

  /**
   * Retrieves all agents capable of executing a specific list of capabilities.
   */
  findByCapability(capabilities: AgentCapabilityType[]): Promise<AgentDefinition[]>;

  /**
   * Retrieves all agents capable of executing a specific task identifier.
   */
  findByTask(taskType: string): Promise<AgentDefinition[]>;

  /**
   * Returns all registered agent configurations.
   */
  listAgents(): Promise<AgentDefinition[]>;

  /**
   * Retrieves metadata details for a specific agent.
   */
  getAgent(id: string): Promise<AgentDefinition | null>;

  /**
   * Validates whether an agent manifest complies with safety and typing standards.
   */
  validateAgent(definition: AgentDefinition): Promise<{ valid: boolean; errors?: string[] }>;

  /**
   * Triggers health probes across registered agents.
   */
  healthCheck(id: string): Promise<AgentHealthStatus>;
}
```
