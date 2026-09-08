/**
 * Client-side Veo i2v helpers: fetch stills as data URIs (never { uri: https }).
 */
import { buildVeoVideoPayload, snapVeoDuration, veoImagePartFromDataUri } from "../../../../api/runtime/_videoContract";

function guessImageMime(urlOrHeader?: string): string {
  const v = (urlOrHeader || "").toLowerCase();
  if (v.includes("png")) return "image/png";
  if (v.includes("webp")) return "image/webp";
  if (v.includes("gif")) return "image/gif";
  return "image/jpeg";
}

export async function fetchImageAsDataUri(url?: string): Promise<string | undefined> {
  if (!url || typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("data:")) return trimmed;
  if (trimmed.startsWith("gs://")) return undefined;
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return undefined;

  const res = await fetch(trimmed);
  if (!res.ok) {
    throw new Error(`Veo still download failed (${res.status}): ${trimmed.slice(0, 120)}`);
  }
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize) as any);
  }
  const mime = guessImageMime(res.headers.get("content-type") || trimmed);
  return `data:${mime};base64,${btoa(binary)}`;
}

export async function buildOfficialVeoPayload(params: {
  prompt: string;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  aspectRatio?: string;
  durationSec?: number;
}): Promise<{
  instances: Array<Record<string, unknown>>;
  parameters: { aspectRatio: "16:9" | "9:16"; sampleCount: 1; durationSeconds: 4 | 6 | 8 };
  firstFrameDataUri: string;
  lastFrameDataUri?: string;
}> {
  const first = params.firstFrameUrl?.trim() || "";
  if (!first) {
    throw new Error("Veo i2v requires this shot's still as frame 1.");
  }

  let lastFrameDataUri: string | undefined;
  if (params.lastFrameUrl?.startsWith("data:")) {
    lastFrameDataUri = params.lastFrameUrl;
  } else if (params.lastFrameUrl) {
    lastFrameDataUri = await fetchImageAsDataUri(params.lastFrameUrl);
  }

  if (first.startsWith("gs://")) {
    const instance: Record<string, unknown> = {
      prompt: params.prompt,
      image: { gcsUri: first },
    };
    if (lastFrameDataUri) instance.lastFrame = veoImagePartFromDataUri(lastFrameDataUri);
    return {
      instances: [instance],
      parameters: {
        aspectRatio: params.aspectRatio === "16:9" ? "16:9" : "9:16",
        sampleCount: 1,
        durationSeconds: snapVeoDuration(params.durationSec, { hasLastFrame: Boolean(lastFrameDataUri) }),
      },
      firstFrameDataUri: first,
      lastFrameDataUri,
    };
  }

  const firstFrameDataUri = first.startsWith("data:") ? first : await fetchImageAsDataUri(first);
  if (!firstFrameDataUri) {
    throw new Error("Veo i2v could not load this shot's still as image bytes.");
  }

  const payload = buildVeoVideoPayload({
    prompt: params.prompt,
    firstFrameDataUri,
    lastFrameDataUri,
    aspectRatio: params.aspectRatio,
    durationSec: params.durationSec,
  });
  return { ...payload, firstFrameDataUri, lastFrameDataUri };
}
