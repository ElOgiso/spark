import { AutomationMode } from "../domain/types";

export class ExecutivePolicyEngine {
  /**
   * Determine if a specific step/action requires human approval.
   */
  public static requiresApproval(step: string, mode: AutomationMode): boolean {
    const normalized = step.toLowerCase();
    
    // In manual mode, everything requires approval.
    if (mode === "manual") return true;

    // In balanced mode, content creation, production, and publishing require approval.
    if (mode === "balanced") {
      return ["creative", "production", "review", "publishing"].includes(normalized);
    }

    // In autonomous mode, only final publishing or critical overrides might require approval.
    return false;
  }

  /**
   * Determine if an action can proceed automatically without holding for approval.
   */
  public static canProceed(step: string, mode: AutomationMode): boolean {
    return !this.requiresApproval(step, mode);
  }

  /**
   * Determine if the system should publish automatically.
   */
  public static shouldPublish(mode: AutomationMode): boolean {
    return mode === "autonomous";
  }

  /**
   * Determine if the system is allowed to run learning loops.
   */
  public static canLearn(mode: AutomationMode): boolean {
    return mode !== "manual";
  }

  /**
   * Determine if the system is allowed to write updates to brand memory.
   */
  public static canUpdateMemory(mode: AutomationMode): boolean {
    return mode !== "manual";
  }

  /**
   * Determine if a department is permitted to execute in this automation mode.
   */
  public static canExecuteDepartment(department: string, mode: AutomationMode): boolean {
    // All departments can execute, though their output states are governed by requiresApproval.
    return true;
  }
}
