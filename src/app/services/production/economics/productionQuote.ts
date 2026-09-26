/**
 * Pre-generate quote. Uses the canonical router and CostEngine.
 * Unknown prices stay UNKNOWN. They are not zero and not free.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import { routeMediaCapability } from "../capability/router";
import { CostEngine } from "./costEngine";
import type { CostEstimate } from "./types";

export interface ProductionQuote {
  amount: number | null;
  status: "EXACT" | "ESTIMATED" | "UNKNOWN";
}

function addEstimate(total: { amount: number; unknown: boolean; estimated: boolean }, est: CostEstimate) {
  if (est.status === "UNKNOWN" || est.status === "FAILED" || est.amount == null || !(est.amount > 0)) {
    total.unknown = true;
    return;
  }
  total.amount += est.amount;
  if (est.status !== "EXACT") total.estimated = true;
}

export function quoteProductionSpec(spec: ProductionSpec): ProductionQuote {
  const imagePref = spec.routing?.preferredImageProvider;
  const videoPref = spec.routing?.preferredVideoProvider;
  const voicePref = spec.routing?.preferredVoiceProvider;
  const imageDecision = routeMediaCapability({
    modality: "image",
    generationMode: "text_to_image",
    preferences: imagePref && imagePref !== "auto" ? { preferredProviderId: imagePref } : undefined,
  });
  const videoDecision = routeMediaCapability({
    modality: "video",
    generationMode: "image_to_video",
    preferences: videoPref && videoPref !== "auto" ? { preferredProviderId: videoPref } : undefined,
  });
  const voiceDecision = routeMediaCapability({
    modality: "audio",
    generationMode: "text_to_speech",
    preferences: voicePref && voicePref !== "auto" ? { preferredProviderId: voicePref } : undefined,
  });

  const total = { amount: 0, unknown: false, estimated: false };
  const shots = spec.scenes?.flatMap((scene) => scene.shots || []) || [];
  if (shots.length === 0) {
    return { amount: null, status: "UNKNOWN" };
  }

  for (const shot of shots) {
    const strategy = String(shot.generationStrategy || "");
    const stillOnly = strategy === "slideshow_still";
    if (imageDecision.selected) {
      addEstimate(
        total,
        CostEngine.estimateCost({
          providerId: imageDecision.selected.providerId,
          modelId: imageDecision.selected.modelId,
          modality: "image",
          aspectRatio: shot.aspectRatio || spec.project?.aspectRatio,
        })
      );
    } else {
      total.unknown = true;
    }
    if (!stillOnly) {
      if (videoDecision.selected) {
        addEstimate(
          total,
          CostEngine.estimateCost({
            providerId: videoDecision.selected.providerId,
            modelId: videoDecision.selected.modelId,
            modality: "video",
            durationSeconds: shot.durationSec || spec.project?.targetDurationSec || 5,
            aspectRatio: shot.aspectRatio || spec.project?.aspectRatio,
          })
        );
      } else {
        total.unknown = true;
      }
    }
  }

  if (spec.audio?.hasNarration) {
    const spoken = shots
      .map((shot) => shot.narration || shot.dialogue || "")
      .join(" ")
      .trim();
    const characterCount = spoken.length > 0 ? spoken.length : 800;
    if (voiceDecision.selected) {
      addEstimate(
        total,
        CostEngine.estimateCost({
          providerId: voiceDecision.selected.providerId,
          modelId: voiceDecision.selected.modelId,
          modality: "audio",
          characterCount,
        })
      );
    } else {
      total.unknown = true;
    }
  }

  if (total.unknown || !(total.amount > 0)) {
    return { amount: null, status: "UNKNOWN" };
  }
  return { amount: Number(total.amount.toFixed(4)), status: total.estimated ? "ESTIMATED" : "EXACT" };
}

/** Quote the spec already stored on a production. Does not invent a spec. */
export function quoteAttachedProduction(
  production: { reasoning?: unknown } | null | undefined
): ProductionQuote | null {
  if (!production || typeof production.reasoning !== "object" || !production.reasoning) return null;
  const spec = (production.reasoning as { productionSpec?: ProductionSpec }).productionSpec;
  if (!spec?.scenes?.length) return null;
  return quoteProductionSpec(spec);
}
