import { AutomationMode } from "../domain/types";
import { Capability } from "../domain/runtime/Capability";

export interface DecisionPlan {
  objective: string;
  department: "research" | "creative" | "production" | "review" | "publishing" | "analytics" | "learning";
  priority: "high" | "medium" | "low";
  requiredCapabilities: Capability[];
  automationMode: AutomationMode;
}

export class ExecutiveDecisionEngine {
  /**
   * TODO: Lightweight keyword matching for Sprint 1.
   * This logic will later be replaced by the Capability Analyzer in Sprint 2.
   */
  public static generatePlan(intent: string, mode: AutomationMode): DecisionPlan {
    const lower = intent.toLowerCase();
    
    let department: DecisionPlan["department"] = "research";
    let requiredCapabilities: Capability[] = [Capability.WEB_SEARCH, Capability.LONG_CONTEXT];
    let priority: DecisionPlan["priority"] = "medium";
    let objective = "Gather signals from intent";

    if (lower.includes("write") || lower.includes("script") || lower.includes("concept") || lower.includes("creative")) {
      department = "creative";
      requiredCapabilities = [Capability.WRITING, Capability.STYLE_CONSISTENCY, Capability.TONE_ADAPTATION];
      objective = "Draft content script and hooks";
    } else if (lower.includes("render") || lower.includes("video") || lower.includes("produce") || lower.includes("production")) {
      department = "production";
      requiredCapabilities = [Capability.IMAGE_GENERATION, Capability.VIDEO_GENERATION];
      objective = "Assemble storyboard scenes";
    } else if (lower.includes("publish") || lower.includes("schedule")) {
      department = "publishing";
      requiredCapabilities = [Capability.PUBLISHING];
      objective = "Schedule social packages";
    } else if (lower.includes("views") || lower.includes("ctr") || lower.includes("analytics")) {
      department = "analytics";
      requiredCapabilities = [Capability.ANALYTICS];
      objective = "Audit platform performance";
    } else if (lower.includes("learn") || lower.includes("memory") || lower.includes("feedback")) {
      department = "learning";
      requiredCapabilities = [Capability.LEARNING];
      objective = "Extract and store performance insights";
    }

    if (lower.includes("urgent") || lower.includes("asap") || lower.includes("critical")) {
      priority = "high";
    }

    return {
      objective,
      department,
      priority,
      requiredCapabilities,
      automationMode: mode
    };
  }
}
