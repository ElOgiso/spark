import type {
  AICapabilityType,
  AIModelRoutingConfig,
  AIProviderId,
  AIRoutingCategory,
} from "../../domain/types";
import { AIProviderOrchestrator, type AIExecutionOptions } from "./AIProviderOrchestrator";

export class ModelRouter {
  /**
   * Default routing table when user preferences are unconfigured (all set to 'auto')
   */
  static getDefaultRoutingConfig(): AIModelRoutingConfig {
    return {
      superSpark: "auto",
      research: "auto",
      videoUnderstanding: "auto",
      production: "auto",
      automation: "auto",
      executive: "auto",
      analytics: "auto",
      publishing: "auto",
      scheduling: "auto",
      memory: "auto",
      review: "auto",
    };
  }

  /**
   * Maps a SPARK category to the appropriate capability requirement
   */
  static mapCategoryToCapability(category: AIRoutingCategory): AICapabilityType {
    switch (category) {
      case "superSpark":
      case "executive":
      case "production":
        return "Chat";
      case "research":
      case "memory":
      case "analytics":
      case "publishing":
      case "scheduling":
      case "automation":
        return "Reasoning";
      case "videoUnderstanding":
        return "Video Understanding";
      default:
        return "Chat";
    }
  }

  /**
   * Resolves target provider ID dynamically for a given category & user routing config.
   * If user preferences exist, override routing. Otherwise, use Category Best Available defaults.
   */
  static resolveProvider(
    category: AIRoutingCategory,
    userRoutingConfig?: Partial<AIModelRoutingConfig>
  ): AIProviderId {
    const preferred = userRoutingConfig?.[category];
    if (preferred && preferred !== "auto") {
      return preferred;
    }

    // Category Best Available Default Table (Phase 19B.2 Routing Spec)
    switch (category) {
      case "superSpark":
      case "executive":
      case "automation":
      case "scheduling":
      case "publishing":
      case "analytics":
      case "memory":
        return "openai"; // Default: OpenAI -> Claude -> Grok -> Gemini
      case "research":
      case "videoUnderstanding":
        return "grok";   // Default: Grok Vision -> Gemini Vision -> OpenAI Vision
      case "production":
      case "review":
        return "claude"; // Default: Claude -> OpenAI -> Gemini -> Grok
      default:
        return "openai";
    }
  }

  /**
   * Main Router Request Execution Point
   */
  static async executeCategoryRequest(
    category: AIRoutingCategory,
    options: AIExecutionOptions,
    userRoutingConfig?: Partial<AIModelRoutingConfig>
  ): Promise<string> {
    const preferredProvider = this.resolveProvider(category, userRoutingConfig);
    const capability = options.capability || this.mapCategoryToCapability(category);

    return AIProviderOrchestrator.execute({
      ...options,
      preferredProvider,
      capability,
    });
  }
}
