/**
 * Delivery variants — one editorial master → many platform outputs.
 */

import type { DeliveryVariant, CropReframe } from "./types";
import { planReframe } from "./reframe";

export function createDefaultVariants(params: {
  masterAspect: string;
  masterWidth: number;
  masterHeight: number;
  frameRate: number;
}): DeliveryVariant[] {
  const { masterAspect, masterWidth, masterHeight, frameRate } = params;
  const baseAudio = {
    sampleRateHz: 48000,
    channels: 2,
    codec: "aac",
  };

  const master: DeliveryVariant = {
    id: "variant_master",
    name: "Master",
    resolution: { width: masterWidth, height: masterHeight },
    aspectRatio: masterAspect,
    frameRate,
    qualityTarget: "broadcast",
    codec: "h264",
    container: "mp4",
    captionPolicy: "sidecar",
    audioTarget: baseAudio,
    safeAreas: { top: 0.05, right: 0.05, bottom: 0.08, left: 0.05 },
  };

  const variants: DeliveryVariant[] = [master];

  // Always offer complementary social ratio when master is landscape or portrait
  if (masterAspect === "16:9" || masterWidth > masterHeight) {
    variants.push({
      id: "variant_9x16",
      name: "Vertical Social",
      resolution: { width: 1080, height: 1920 },
      aspectRatio: "9:16",
      frameRate,
      qualityTarget: "social",
      codec: "h264",
      container: "mp4",
      maxDurationSec: 180,
      captionPolicy: "burn_in",
      audioTarget: baseAudio,
      reframe: planReframe({
        sourceWidth: masterWidth,
        sourceHeight: masterHeight,
        targetWidth: 1080,
        targetHeight: 1920,
        strategy: "center",
      }),
      safeAreas: { top: 0.12, right: 0.06, bottom: 0.18, left: 0.06 },
    });
  } else if (masterAspect === "9:16" || masterHeight > masterWidth) {
    variants.push({
      id: "variant_16x9",
      name: "Landscape",
      resolution: { width: 1920, height: 1080 },
      aspectRatio: "16:9",
      frameRate,
      qualityTarget: "social",
      codec: "h264",
      container: "mp4",
      captionPolicy: "sidecar",
      audioTarget: baseAudio,
      reframe: planReframe({
        sourceWidth: masterWidth,
        sourceHeight: masterHeight,
        targetWidth: 1920,
        targetHeight: 1080,
        strategy: "center",
      }),
      safeAreas: { top: 0.05, right: 0.05, bottom: 0.08, left: 0.05 },
    });
  }

  variants.push({
    id: "variant_1x1",
    name: "Square",
    resolution: { width: 1080, height: 1080 },
    aspectRatio: "1:1",
    frameRate,
    qualityTarget: "social",
    codec: "h264",
    container: "mp4",
    captionPolicy: "burn_in",
    audioTarget: baseAudio,
    reframe: planReframe({
      sourceWidth: masterWidth,
      sourceHeight: masterHeight,
      targetWidth: 1080,
      targetHeight: 1080,
      strategy: "center",
    }),
    safeAreas: { top: 0.08, right: 0.08, bottom: 0.1, left: 0.08 },
  });

  return variants;
}

export function resolveAspectDimensions(aspect: string): { width: number; height: number } {
  switch (aspect) {
    case "9:16":
      return { width: 1080, height: 1920 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "4:5":
      return { width: 1080, height: 1350 };
    case "21:9":
      return { width: 2560, height: 1080 };
    case "16:9":
    default:
      return { width: 1920, height: 1080 };
  }
}
