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
   * Reads persisted user routing config from localStorage or defaults
   */
  static getUserRoutingConfig(): AIModelRoutingConfig {
    if (typeof localStorage === "undefined") return this.getDefaultRoutingConfig();
    try {
      const saved = localStorage.getItem("spark_ai_model_routing");
      if (saved) return { ...this.getDefaultRoutingConfig(), ...JSON.parse(saved) };
    } catch (err) {
      console.warn("[ModelRouter] Parse notice:", err);
    }
    return this.getDefaultRoutingConfig();
  }

  /**
   * Updates and persists user routing preferences across sessions
   */
  static setUserRoutingConfig(config: Partial<AIModelRoutingConfig>): AIModelRoutingConfig {
    const current = this.getUserRoutingConfig();
    const updated = { ...current, ...config };
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("spark_ai_model_routing", JSON.stringify(updated));
      } catch (err) {
        console.warn("[ModelRouter] Save notice:", err);
      }
    }
    return updated;
  }

  /**
   * Main Router Request Execution Point
   */
  static async executeCategoryRequest(
    category: AIRoutingCategory,
    options: AIExecutionOptions,
    userRoutingConfig?: Partial<AIModelRoutingConfig>
  ): Promise<string> {
    const activeConfig = userRoutingConfig || this.getUserRoutingConfig();
    const preferredProvider = this.resolveProvider(category, activeConfig);
    const capability = options.capability || this.mapCategoryToCapability(category);

    return AIProviderOrchestrator.execute({
      ...options,
      preferredProvider,
      capability,
    });
  }
}
