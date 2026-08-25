import type {
  AICapabilityType,
  AIModelRoutingConfig,
  AIModelSelectionConfig,
  AIProviderId,
  AIRoutingCategory,
} from "../../domain/types";
import { AIProviderOrchestrator, type AIExecutionOptions } from "./AIProviderOrchestrator";
import { getRecommendedModel } from "./modelCatalog";

import { PROVIDER_CAPABILITY_MAP } from "./providerCapabilities";

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
      storyboardImages: "openai",
      videoGeneration: "gemini",
      voice: "auto",
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
      case "storyboardImages":
        return "Image Generation";
      case "videoGeneration":
        return "Video Generation";
      case "voice":
        return "Text To Speech";
      default:
        return "Chat";
    }
  }

  /**
   * Resolves target provider ID dynamically for a given category & user routing config.
   * If user preferences exist and support the capability, override routing. Otherwise, use Category Best Available defaults.
   */
  static resolveProvider(
    category: AIRoutingCategory,
    userRoutingConfig?: Partial<AIModelRoutingConfig>
  ): AIProviderId {
    const preferred = userRoutingConfig?.[category];
    const capability = this.mapCategoryToCapability(category);

    if (preferred && preferred !== "auto") {
      const profile = PROVIDER_CAPABILITY_MAP[preferred as import("./providerCapabilities").ConcreteAIProviderId];
      if (profile && profile.capabilities.includes(capability)) {
        return preferred;
      }
      console.warn(`[ModelRouter] Preferred provider "${preferred}" does not support capability "${capability}" for category "${category}". Falling back to Best Available.`);
    }

    // Category Best Available Default Table
    switch (category) {
      case "storyboardImages":
        return "openai"; // Default: OpenAI -> Gemini -> Grok -> Kling
      case "videoGeneration":
        return "gemini"; // Default: Gemini -> Grok -> Kling -> Runway -> Luma -> Higgsfield
      case "voice":
        return "elevenlabs"; // Default: ElevenLabs -> Grok -> OpenAI -> Gemini
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
   * Resolves target model ID for a given category and provider.
   * Priority:
   * 1. Exact user model selection if configured
   * 2. Recommended model from catalog for this provider & capability
   * 3. Empty string (falls back to provider plugin default)
   */
  static resolveModel(
    category: AIRoutingCategory,
    provider: AIProviderId,
    capability?: AICapabilityType,
    userSelectionConfig?: AIModelSelectionConfig
  ): string {
    const activeSelections = userSelectionConfig || this.getUserModelSelectionConfig();
    const explicitModel = activeSelections[category];
    if (explicitModel && explicitModel.trim().length > 0) {
      return explicitModel.trim();
    }

    const cap = capability || this.mapCategoryToCapability(category);
    const recommended = getRecommendedModel(provider, cap);
    return recommended?.id || "";
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
   * Reads persisted user model selection config from localStorage
   */
  static getUserModelSelectionConfig(): AIModelSelectionConfig {
    if (typeof localStorage === "undefined") return {};
    try {
      const saved = localStorage.getItem("spark_ai_model_selection");
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.warn("[ModelRouter] Model selection parse notice:", err);
    }
    return {};
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
   * Updates and persists user model selection preferences across sessions
   */
  static setUserModelSelectionConfig(config: Partial<AIModelSelectionConfig>): AIModelSelectionConfig {
    const current = this.getUserModelSelectionConfig();
    const updated = { ...current, ...config };
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("spark_ai_model_selection", JSON.stringify(updated));
      } catch (err) {
        console.warn("[ModelRouter] Model selection save notice:", err);
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
    userRoutingConfig?: Partial<AIModelRoutingConfig>,
    userModelSelectionConfig?: AIModelSelectionConfig
  ): Promise<string> {
    const activeConfig = userRoutingConfig || this.getUserRoutingConfig();
    const preferredProvider = this.resolveProvider(category, activeConfig);
    const capability = options.capability || this.mapCategoryToCapability(category);
    const resolvedModel = options.model || this.resolveModel(category, preferredProvider, capability, userModelSelectionConfig);

    return AIProviderOrchestrator.execute({
      ...options,
      preferredProvider,
      capability,
      model: resolvedModel || options.model,
    });
  }
}
