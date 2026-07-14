import { Capability } from "./Capability";

export interface AgentPerformanceMetrics {
  avgLatencyMs: number;
  avgCostUsd: number;
  successRate: number;
  qualityScore: number;
}

export interface AgentDefinition {
  id: string;
  name: string;
  department: "research" | "creative" | "production" | "review" | "publishing" | "analytics" | "learning";
  capabilities: Capability[];
  status: "healthy" | "unhealthy";
  version: string;
  performanceMetrics: AgentPerformanceMetrics;
}
