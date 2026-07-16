import { ExecutiveDecisionEngine, MessageIntent } from "../executiveDecisionEngine";
import { AutomationMode } from "../../domain/types";

export interface RouterResult {
  intent: MessageIntent | 'pending_approval';
  output: string;
  pendingTaskPrompt: string | null;
}

export class IntentRouter {
  private static instance: IntentRouter;

  public static getInstance(): IntentRouter {
    if (!IntentRouter.instance) {
      IntentRouter.instance = new IntentRouter();
    }
    return IntentRouter.instance;
  }

  public async route(
    prompt: string,
    mode: AutomationMode,
    pendingTaskPrompt: string | null
  ): Promise<RouterResult> {
    const intent = ExecutiveDecisionEngine.classifyIntent(prompt);

    // 1. Handle Cancellation
    if (intent === "cancellation" && pendingTaskPrompt) {
      return {
        intent: "cancellation",
        output: "Workspace task aborted successfully.",
        pendingTaskPrompt: null
      };
    }

    // 2. Handle Approval for Balanced Mode
    if (intent === "approval" && pendingTaskPrompt) {
      return {
        intent: "workspace_execution",
        output: pendingTaskPrompt,
        pendingTaskPrompt: null
      };
    }

    // 3. Handle Workspace Intent
    if (intent === "workspace_execution") {
      // Respect operating modes: Manual vs Balanced vs Autonomous
      if (mode === "balanced" && !pendingTaskPrompt) {
        return {
          intent: "pending_approval",
          output: `I have formulated a campaign blueprint for: "${prompt}".\n\nWould you like me to initialize the runtime pipeline? Please say "Approve" or click Proceed to start.`,
          pendingTaskPrompt: prompt
        };
      }
      
      // Autonomous and Manual modes run directly on explicit workspace commands
      return {
        intent: "workspace_execution",
        output: prompt,
        pendingTaskPrompt: null
      };
    }

    // 4. Default Conversation & Question intents
    return {
      intent,
      output: prompt,
      pendingTaskPrompt: pendingTaskPrompt
    };
  }
}
