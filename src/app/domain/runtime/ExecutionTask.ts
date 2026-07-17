import { AutomationMode } from "../types";
import { Capability } from "./Capability";
import { TaskState } from "./TaskState";

export interface ExecutionTask {
  id: string;
  objective: string;
  department: "research" | "creative" | "production" | "review" | "publishing" | "analytics" | "learning" | "editor" | "storyboard" | "media-intelligence" | "editing-decision" | "creative-decision";
  priority: "high" | "medium" | "low";
  capabilities: Capability[];
  automationMode: AutomationMode;
  workspaceId: string;
  brandId: string;
  createdAt: string;
  status: TaskState;
  
  // Scheduling & Dependencies
  dependencies?: string[];
  scheduledTime?: string;
  delayMs?: number;

  // Link to Production
  productionId?: string;
  existingReasoning?: any;
}
