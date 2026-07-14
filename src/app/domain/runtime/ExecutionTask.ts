import { AutomationMode } from "../types";
import { Capability } from "./Capability";

export interface ExecutionTask {
  id: string;
  objective: string;
  department: "research" | "creative" | "production" | "review" | "publishing" | "analytics" | "learning";
  priority: "high" | "medium" | "low";
  capabilities: Capability[];
  automationMode: AutomationMode;
  workspaceId: string;
  brandId: string;
  createdAt: string;
  status: "pending" | "running" | "completed" | "failed";
}
