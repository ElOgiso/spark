import { Capability } from "./Capability";

export interface AgentDefinition {
  id: string;
  name: string;
  department: "research" | "creative" | "production" | "review" | "publishing" | "analytics" | "learning";
  capabilities: Capability[];
  status: "healthy" | "unhealthy";
  performanceScore: number;
}
