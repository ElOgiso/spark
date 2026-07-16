import { AutomationMode } from "../../domain/types";

export type MessageIntent =
  | 'conversation'
  | 'question'
  | 'workspace_execution'
  | 'approval'
  | 'cancellation'
  | 'configuration';

export interface ExecutionRequest {
  prompt: string;
  isWorkspaceTask: boolean;
  timestamp: string;
}

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

  public classifyIntent(prompt: string): MessageIntent {
    const lower = prompt.toLowerCase().trim();

    // Configuration intents
    if (lower.startsWith("set mode") || lower.startsWith("configure") || lower.includes("change settings") || lower.includes("automation mode")) {
      return 'configuration';
    }

    // Cancellation intents
    if (lower === "cancel" || lower === "stop" || lower === "abort" || lower === "exit") {
      return 'cancellation';
    }

    // Approval intents
    if (lower === "approve" || lower === "yes" || lower === "proceed" || lower === "yep" || lower === "go ahead") {
      return 'approval';
    }

    // Greetings / Conversation
    const greetings = ["hello", "hi", "hey", "thanks", "thank you", "good morning", "good afternoon", "good evening", "how are you"];
    if (greetings.some(g => lower === g || lower.startsWith(g + " ") || lower.startsWith("hey "))) {
      return 'conversation';
    }

    // Workspace Execution verbs & nouns (Checked BEFORE questions to capture conversational work requests)
    const executionVerbs = ["create", "generate", "build", "analyze", "make", "produce", "run", "start", "initialize", "new project", "edit", "publish"];
    const executionNouns = ["tiktok", "video", "campaign", "storyboard", "carousel", "reel", "documentary", "shorts", "script"];
    if (executionVerbs.some(verb => lower.includes(verb)) || executionNouns.some(noun => lower.includes(noun))) {
      return 'workspace_execution';
    }

    // Questions / Explanations
    const questions = ["what is", "how do i", "explain", "tell me about", "why did", "what can you", "who are you", "who is", "what does", "how can"];
    if (questions.some(q => lower.startsWith(q) || lower.includes(q)) || lower.endsWith("?")) {
      return 'question';
    }

    // Fallback to conversation
    return 'conversation';
  }

  public async route(
    prompt: string,
    mode: AutomationMode,
    pendingTaskPrompt: string | null
  ): Promise<RouterResult> {
    const intent = this.classifyIntent(prompt);

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
    // Notion automation model:
    // - manual: review before production/publish
    // - balanced (approval required): drafts OK, execution needs approval
    // - autonomous: create/run within rules without per-prompt approval
    if (intent === "workspace_execution") {
      if ((mode === "manual" || mode === "balanced") && !pendingTaskPrompt) {
        const modeLabel = mode === "manual" ? "Manual Review Required" : "Approval Required";
        return {
          intent: "pending_approval",
          output: `Mode is ${modeLabel}.\n\nI prepared a production request for: "${prompt}".\n\nSay "Approve" or click Proceed to start the runtime pipeline. Say "Cancel" to abort.`,
          pendingTaskPrompt: prompt
        };
      }

      // Autonomous mode runs on explicit workspace commands
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
