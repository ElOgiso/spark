/**
 * Higgsfield Payload Translator for Provider Payload Compiler.
 *
 * SPARK owns the semantic roles. This translator only maps them onto the
 * official Higgsfield Seedance bodies already used by the runtime:
 * - image-to-video: image_url + optional end_image_url. Never image_urls.
 * - reference-to-video (explicit r2v model only): image_urls, optional
 *   video_urls / audio_urls, aspect_ratio. Never image_url.
 *
 * Seedance on Higgsfield has no text-to-video execution in the live client.
 * A shot with neither a start frame nor an r2v model fails closed.
 * I2V does not silently become R2V when identity references exist.
 */

import type { IProviderPayloadTranslator, ProviderPayloadCompilationRequest, CompiledMediaInput, NormalizedGenerationParameters } from "../types";
import {
  buildHiggsfieldSeedanceI2vBody,
  buildHiggsfieldSeedanceR2vBody,
  isDirectProviderMediaUrl,
} from "../../../../../../api/runtime/_videoContract";

const IMAGE_ROLES = new Set(["reference_image", "character_reference", "style_reference"]);
const VIDEO_ROLES = new Set(["driving_video", "source_video"]);

function isR2vModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return id.includes("r2v") || id.includes("reference-to-video") || id.includes("reference_to_video");
}

function httpsImages(inputs: CompiledMediaInput[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const input of inputs) {
    if (!IMAGE_ROLES.has(input.role)) continue;
    const url = input.url?.trim();
    if (!url || !isDirectProviderMediaUrl(url) || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

function directMedia(inputs: CompiledMediaInput[], roles: Set<string>): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const input of inputs) {
    if (!roles.has(input.role)) continue;
    const url = input.url?.trim();
    if (!url || !isDirectProviderMediaUrl(url) || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

export class HiggsfieldPayloadTranslator implements IProviderPayloadTranslator {
  providerId = "higgsfield";

  supports(modelId: string): boolean {
    return modelId.toLowerCase().includes("higgsfield") || isR2vModel(modelId) || /seedance/i.test(modelId);
  }

  translate(
    request: ProviderPayloadCompilationRequest,
    intermediates: {
      prompt: string;
      negativePrompt?: string;
      mediaInputs: CompiledMediaInput[];
      normalizedParams: NormalizedGenerationParameters;
    }
  ) {
    const { prompt, mediaInputs, normalizedParams } = intermediates;
    const model = request.modelId || "higgsfield-seedance-2-5";
    const firstFrameInput = mediaInputs.find((m) => m.role === "first_frame");
    const lastFrameInput = mediaInputs.find((m) => m.role === "last_frame");
    const imageRefs = httpsImages(mediaInputs);
    const videoRefs = directMedia(mediaInputs, VIDEO_ROLES);
    const audioRefs = directMedia(mediaInputs, new Set(["audio_track"]));
    const errors: string[] = [];
    const warnings: string[] = [];
    const degradedFeatures: string[] = [];

    const clip = {
      prompt,
      model,
      durationSec: normalizedParams.durationSec,
      resolution: normalizedParams.resolution,
      aspectRatio: normalizedParams.aspectRatio,
      generateAudio: normalizedParams.generateAudio !== false,
      firstFrameUrl: firstFrameInput?.url,
      lastFrameUrl: lastFrameInput?.url,
      imageUrls: imageRefs,
      referenceImageUrls: imageRefs,
      videoUrls: videoRefs,
      audioUrls: audioRefs,
    };

    let operation = "image_to_video";
    let rawPayload: Record<string, unknown> = { prompt };

    if (isR2vModel(model)) {
      operation = "reference_to_video";
      try {
        rawPayload = buildHiggsfieldSeedanceR2vBody(clip);
      } catch (err: any) {
        errors.push(String(err?.message || err));
      }
    } else if (firstFrameInput?.url) {
      operation = "image_to_video";
      try {
        rawPayload = buildHiggsfieldSeedanceI2vBody(clip);
      } catch (err: any) {
        errors.push(String(err?.message || err));
      }
      const dropped = imageRefs.length + videoRefs.length + audioRefs.length;
      if (dropped > 0) {
        warnings.push(
          `HF_I2V_REFERENCE_NOT_ON_WIRE: Seedance image-to-video conditions on the start frame only; ${dropped} reference input(s) stay on the shot and are not sent as image_urls.`
        );
        degradedFeatures.push("REFERENCE_IMAGES_DEGRADED");
      }
    } else {
      operation = "image_to_video";
      errors.push(
        "MISSING_REQUIRED_START_FRAME: Higgsfield Seedance image-to-video requires a public start frame. Reference-to-video is a different model and is not substituted."
      );
    }

    if ("image_urls" in rawPayload && operation === "image_to_video") {
      delete rawPayload.image_urls;
    }

    return {
      operation,
      rawPayload,
      parameters: {
        model,
        duration: rawPayload.duration,
        durationSec: rawPayload.duration,
        resolution: rawPayload.resolution,
        aspectRatio: rawPayload.aspect_ratio || normalizedParams.aspectRatio,
        generate_audio: rawPayload.generate_audio,
      },
      validation: {
        valid: errors.length === 0,
        errors,
        warnings,
        degradedFeatures,
      },
    };
  }
}
