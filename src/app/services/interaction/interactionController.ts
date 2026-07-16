import { IntentRouter, ExecutionRequest } from "./intentRouter";
import { ConversationController } from "./conversationController";
import { AutomationMode } from "../../domain/types";

export type { ExecutionRequest };

export class InteractionController {
  private static instance: InteractionController;
  private onStateUpdate?: (updates: {
    isExecuting?: boolean;
    pendingTaskPrompt?: string | null;
  }) => void;
  private onTriggerWorkspace?: (request: ExecutionRequest) => Promise<string>;

  public static getInstance(): InteractionController {
    if (!InteractionController.instance) {
      InteractionController.instance = new InteractionController();
    }
    return InteractionController.instance;
  }

  public registerCallbacks(callbacks: {
    onStateUpdate: (updates: { isExecuting?: boolean; pendingTaskPrompt?: string | null }) => void;
    onTriggerWorkspace: (request: ExecutionRequest) => Promise<string>;
  }) {
    this.onStateUpdate = callbacks.onStateUpdate;
    this.onTriggerWorkspace = callbacks.onTriggerWorkspace;
  }

  public async sendMessage(
    prompt: string,
    mode: AutomationMode,
    pendingTaskPrompt: string | null,
    onUpdate?: (text: string) => void
  ): Promise<string> {
    const routeResult = await IntentRouter.getInstance().route(
      prompt,
      mode,
      pendingTaskPrompt
    );

    // Sync pending prompt back to the UI state
    if (this.onStateUpdate) {
      this.onStateUpdate({
        pendingTaskPrompt: routeResult.pendingTaskPrompt
      });
    }

    if (routeResult.intent === "cancellation") {
      if (this.onStateUpdate) {
        this.onStateUpdate({ isExecuting: false });
      }
      return routeResult.output;
    }

    if (routeResult.intent === "conversation" || routeResult.intent === "question") {
      if (this.onStateUpdate) {
        this.onStateUpdate({ isExecuting: false });
      }
      return ConversationController.getInstance().handleConversation(prompt);
    }

    if (routeResult.intent === "pending_approval") {
      if (this.onStateUpdate) {
        this.onStateUpdate({ isExecuting: false });
      }
      return routeResult.output;
    }

    // Trigger workspace layer execution using the standard contract
    if (routeResult.intent === "workspace_execution") {
      if (this.onTriggerWorkspace) {
        const request: ExecutionRequest = {
          prompt: routeResult.output,
          isWorkspaceTask: true,
          timestamp: new Date().toISOString()
        };
        return this.onTriggerWorkspace(request);
      }
    }

    return "Workspace request submitted.";
  }
}
