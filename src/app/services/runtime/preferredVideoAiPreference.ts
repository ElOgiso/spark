import type {
  AIProviderId,
  AISettings,
  ProductionFormatSettings,
} from "../../domain/types";
import { getModelsForProviderAndCapability, getRecommendedModel } from "./modelCatalog";

export const VIDEO_AI_PROVIDER_OPTIONS: Array<{
  id: AIProviderId | "auto";
  label: string;
}> = [
  { id: "auto", label: "Best Available (Auto)" },
  { id: "gemini", label: "Google Veo / Gemini" },
  { id: "grok", label: "xAI Grok Imagine Video" },
  { id: "kling", label: "Kling" },
  { id: "seedance", label: "Seedance" },
  { id: "runway", label: "Runway" },
  { id: "luma", label: "Luma Ray 2" },
  { id: "higgsfield", label: "Higgsfield" },
];

/**
 * Builds format + AI routing patches for My Spark generator AI preference.
 * Production reads preferredVideoProvider / preferredVideoModel from formatSettings
 * (and the production settings snapshot); ModelRouter videoGeneration stays aligned.
 */
export function buildPreferredVideoAiPreferenceUpdate(params: {
  providerId: AIProviderId | "auto";
  modelId?: string;
  currentAiSettings?: Partial<AISettings> | null;
}): {
  formatPatch: Pick<ProductionFormatSettings, "preferredVideoProvider" | "preferredVideoModel">;
  aiSettings: AISettings;
} {
  const providerId = params.providerId || "auto";
  const routing = {
    ...(params.currentAiSettings?.routing || {}),
    videoGeneration: providerId,
  } as AISettings["routing"];

  let preferredVideoModel = "";
  if (providerId !== "auto") {
    const models = getModelsForProviderAndCapability(providerId, "Video Generation");
    const requested = params.modelId?.trim() || "";
    if (requested && models.some((m) => m.id === requested)) {
      preferredVideoModel = requested;
    } else if (requested && models.length === 0) {
      // Provider may not be in MODEL_CATALOG yet — preserve explicit model string.
      preferredVideoModel = requested;
    } else {
      preferredVideoModel = getRecommendedModel(providerId, "Video Generation")?.id || "";
    }
  }

  const models = {
    ...(params.currentAiSettings?.models || {}),
    videoGeneration: preferredVideoModel,
  } as AISettings["models"];

  return {
    formatPatch: {
      preferredVideoProvider: providerId,
      preferredVideoModel: preferredVideoModel || undefined,
    },
    aiSettings: {
      routing,
      models,
    },
  };
}

export function listVideoModelsForProvider(providerId: AIProviderId | "auto") {
  if (!providerId || providerId === "auto") return [];
  return getModelsForProviderAndCapability(providerId, "Video Generation");
}
