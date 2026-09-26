/**
 * Explicit studio image submit.
 * Canonical router chooses the provider. CreditService reserves before ModelRouter,
 * which is transport only. This is not GenerationExecutionEngine and not a second ledger.
 */

import { routeMediaCapability } from "./capability/router";
import { CostEngine } from "./economics/costEngine";
import { CreditService } from "./credits/creditService";

const STUDIO_AUTH_REQUIRED =
  "Studio image generation requires a signed-in user and credit authorization. No provider submit.";

function promptKey(prompt: string): string {
  let h = 0;
  for (let i = 0; i < prompt.length; i++) h = (h * 31 + prompt.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

export async function submitMeteredStoryboardImage(params: {
  prompt: string;
  userId?: string | null;
  tag: string;
  aspectRatio?: string;
  referenceImageUrl?: string;
  referenceImageUrls?: string[];
  preferredProvider?: string;
  model?: string;
  capability?: string;
  creditService?: CreditService;
}): Promise<string> {
  if (!params.userId) {
    throw new Error(STUDIO_AUTH_REQUIRED);
  }
  const preferred =
    params.preferredProvider && params.preferredProvider !== "auto" ? params.preferredProvider : undefined;
  let decision = routeMediaCapability({
    modality: "image",
    generationMode: "text_to_image",
    preferences: preferred
      ? {
          preferredProviderId: preferred,
          preferredModelId: params.model,
          manualOverride: Boolean(params.model),
        }
      : undefined,
  });
  if (!decision.selected && preferred) {
    decision = routeMediaCapability({
      modality: "image",
      generationMode: "text_to_image",
      preferences: { preferredProviderId: preferred },
    });
  }
  if (!decision.selected) {
    throw new Error("No compatible image provider from the canonical router. No provider submit.");
  }
  const providerId = decision.selected.providerId;
  const modelId = params.model || decision.selected.modelId;
  const est = CostEngine.estimateCost({
    providerId,
    modelId,
    modality: "image",
    aspectRatio: params.aspectRatio,
  });
  if (est.status === "UNKNOWN" || !(typeof est.amount === "number" && est.amount > 0)) {
    throw new Error("Unknown studio image cost — refusing to reserve zero or submit.");
  }
  const creditService = params.creditService || CreditService.getInstance();
  const quote = creditService.quote({
    estimatedCostUsd: est.amount,
    generationId: `studio_${params.tag}_${promptKey(params.prompt)}`,
  });
  const reserved = await creditService.reserve({
    quote,
    userId: params.userId,
    idempotencyKey: `studio_${params.userId}_${params.tag}_${promptKey(params.prompt)}`,
    metadata: { scope: "studio_image", tag: params.tag, providerId, modelId },
  });
  try {
    const { ModelRouter } = await import("../runtime/modelRouter");
    const raw = await ModelRouter.executeCategoryRequest("storyboardImages", {
      prompt: params.prompt,
      aspectRatio: params.aspectRatio,
      capability: (params.capability || "Image Generation") as "Image Generation",
      preferredProvider: providerId as "openai",
      model: modelId,
      referenceImageUrl: params.referenceImageUrl,
      referenceImageUrls: params.referenceImageUrls,
    });
    if (typeof raw !== "string" || !raw.trim()) {
      throw new Error("Image provider returned empty or invalid URL");
    }
    await creditService.settle({
      reservationId: reserved.reservation.id,
      userId: params.userId,
      actualProviderCostUsd: est.amount,
    });
    return raw;
  } catch (err) {
    await creditService
      .release({
        reservationId: reserved.reservation.id,
        userId: params.userId,
        reason: err instanceof Error ? err.message : String(err),
      })
      .catch(() => undefined);
    throw err;
  }
}
