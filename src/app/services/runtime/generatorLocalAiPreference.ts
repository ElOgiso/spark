import type { AIProviderId } from "../../domain/types";
import { getModelsForProviderAndCapability, getRecommendedModel } from "./modelCatalog";

/**
 * Per-studio AI preference for My Spark asset generators (Character Studio,
 * Supporting Cast, Locked Set Plate). Stored in localStorage only — never
 * writes formatSettings.preferredVideoProvider, aiSettings.routing, or the
 * production settings snapshot / ModelRouter global routing table.
 */

export type GeneratorAiPreferenceId =
  | "characterStudio"
  | "supportingCast"
  | "locationPlate";

export interface GeneratorLocalAiPreference {
  providerId: AIProviderId | "auto";
  modelId?: string;
}

export const IMAGE_AI_PROVIDER_OPTIONS: Array<{
  id: AIProviderId | "auto";
  label: string;
}> = [
  { id: "auto", label: "Best Available (Auto)" },
  { id: "gemini", label: "Google Imagen / Gemini" },
  { id: "openai", label: "OpenAI GPT Image" },
  { id: "grok", label: "xAI Grok Imagine" },
];

const STORAGE_PREFIX = "spark.generatorLocalAiPref.v1";

/** In-memory fallback when localStorage is unavailable (SSR / unit tests). */
const memoryStore = new Map<string, string>();

function storageKey(generatorId: GeneratorAiPreferenceId, brandId?: string | null): string {
  const scope = brandId && brandId.trim() ? brandId.trim() : "anonymous";
  return `${STORAGE_PREFIX}.${scope}.${generatorId}`;
}

function readRaw(key: string): string | null {
  if (typeof localStorage !== "undefined") {
    try {
      return localStorage.getItem(key);
    } catch {
      // fall through to memory
    }
  }
  return memoryStore.get(key) ?? null;
}

function writeRaw(key: string, value: string): void {
  memoryStore.set(key, value);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(key, value);
    } catch {
      // memory store still holds the value
    }
  }
}

export function loadGeneratorLocalAiPreference(
  generatorId: GeneratorAiPreferenceId,
  brandId?: string | null
): GeneratorLocalAiPreference {
  try {
    const raw = readRaw(storageKey(generatorId, brandId));
    if (!raw) return { providerId: "auto" };
    const parsed = JSON.parse(raw) as Partial<GeneratorLocalAiPreference>;
    const providerId = (parsed.providerId || "auto") as AIProviderId | "auto";
    const modelId = typeof parsed.modelId === "string" ? parsed.modelId : undefined;
    return { providerId, modelId };
  } catch {
    return { providerId: "auto" };
  }
}

export function saveGeneratorLocalAiPreference(
  generatorId: GeneratorAiPreferenceId,
  brandId: string | null | undefined,
  preference: GeneratorLocalAiPreference
): GeneratorLocalAiPreference {
  const providerId = preference.providerId || "auto";
  let modelId = preference.modelId?.trim() || "";

  if (providerId === "auto") {
    modelId = "";
  } else if (modelId) {
    const models = getModelsForProviderAndCapability(providerId, "Image Generation");
    if (models.length > 0 && !models.some((m) => m.id === modelId)) {
      modelId = getRecommendedModel(providerId, "Image Generation")?.id || "";
    }
  } else {
    modelId = getRecommendedModel(providerId, "Image Generation")?.id || "";
  }

  const next: GeneratorLocalAiPreference = {
    providerId,
    modelId: modelId || undefined,
  };

  writeRaw(storageKey(generatorId, brandId), JSON.stringify(next));
  return next;
}

export function listImageModelsForProvider(providerId: AIProviderId | "auto") {
  if (!providerId || providerId === "auto") return [];
  return getModelsForProviderAndCapability(providerId, "Image Generation");
}

/**
 * Options for a single ModelRouter.executeCategoryRequest call.
 * Does not mutate global routing / format settings.
 */
export function toGeneratorExecutionOverrides(
  preference: GeneratorLocalAiPreference
): { preferredProvider?: AIProviderId; model?: string } {
  const providerId = preference.providerId || "auto";
  if (!providerId || providerId === "auto") {
    return {};
  }
  const model = preference.modelId?.trim();
  return {
    preferredProvider: providerId,
    ...(model ? { model } : {}),
  };
}
