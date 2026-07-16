import { AutomationMode } from "../domain/types";
import { Capability } from "../domain/runtime/Capability";

export interface DecisionPlan {
  objective: string;
  department: "research" | "creative" | "production" | "review" | "publishing" | "analytics" | "learning";
  priority: "high" | "medium" | "low";
  requiredCapabilities: Capability[];
  automationMode: AutomationMode;
}

export type MessageIntent =
  | 'conversation'
  | 'question'
  | 'workspace_execution'
  | 'approval'
  | 'cancellation'
  | 'configuration';

export class ExecutiveDecisionEngine {
  public static classifyIntent(prompt: string): MessageIntent {
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

    // Questions / Explanations
    const questions = ["what is", "how do i", "explain", "tell me about", "why did", "what can you"];
    if (questions.some(q => lower.startsWith(q))) {
      return 'question';
    }

    // Workspace Execution verbs
    const executionVerbs = ["create", "generate", "build", "analyze", "make", "produce", "run", "start", "initialize", "new project"];
    if (executionVerbs.some(verb => lower.includes(verb)) || lower.includes("tiktok") || lower.includes("video") || lower.includes("campaign") || lower.includes("storyboard")) {
      return 'workspace_execution';
    }

    // Fallback to conversation
    return 'conversation';
  }
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
