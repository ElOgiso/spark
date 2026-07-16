import { AutomationMode } from "../domain/types";

export class ExecutivePolicyEngine {
  /**
   * Determine if a specific step/action requires human approval.
   */
  public static requiresApproval(step: string, mode: AutomationMode): boolean {
    const normalized = step.toLowerCase();
    
    if (mode === "manual") return true;

    const criticalActions = [
      "publishing",
      "publish",
      "post_social",
      "delete",
      "send_email",
      "spend_credits",
      "wallet_transaction",
      "account_connection"
    ];

    if (criticalActions.includes(normalized)) {
      return true;
    }

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
