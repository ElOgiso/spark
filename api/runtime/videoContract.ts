/**
 * Locked video-provider payloads for SPARK production I2V.
 * Contracts from working studios (Toonflow Volcengine / ArcReel ark,kling,grok).
 * Pure builders — no network — so unit tests can assert the wire format.
 */

export const SEEDANCE_MODEL_15_PRO = "doubao-seedance-1-5-pro-251215";
export const SEEDANCE_MODEL_20 = "doubao-seedance-2-0-260128";
export const GROK_VIDEO_MODEL = "grok-imagine-video";
export const KLING_DEFAULT_MODEL = "kling-v1-6";

export const SEEDANCE_POLL_INTERVAL_MS = 10_000;
export const SEEDANCE_POLL_TIMEOUT_MS = 20 * 60 * 1000;
export const KLING_POLL_INTERVAL_MS = 10_000;
export const KLING_POLL_TIMEOUT_MS = 15 * 60_000;
export const KLING_JWT_MAX_AGE_MS = 60_000;

export type SeedanceImageRole = "first_frame" | "last_frame" | "reference_image";

export interface SeedanceContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
  role?: SeedanceImageRole;
}

export interface VideoClipRequest {
  prompt: string;
  firstFrameDataUri?: string;
  lastFrameDataUri?: string;
  referenceDataUris?: string[];
  aspectRatio?: string;
  durationSec?: number;
  resolution?: string;
  model?: string;
  generateAudio?: boolean;
  klingMode?: "std" | "pro";
  klingSound?: "on" | "off";
}

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function snapSeedanceDuration(sec?: number): number {
  return clampInt(typeof sec === "number" ? sec : 5, 4, 15);
}

export function snapGrokDuration(sec?: number): number {
  return clampInt(typeof sec === "number" ? sec : 5, 1, 15);
}

/** Kling duration must be the number-string "5" or "10", never "5s". */
export function snapKlingDuration(sec?: number): "5" | "10" {
  const n = typeof sec === "number" && Number.isFinite(sec) ? sec : 5;
  return n > 5 ? "10" : "5";
}

export function normalizeAspectRatio(ratio?: string): "9:16" | "16:9" | "1:1" {
  const r = (ratio || "9:16").trim();
  if (r === "16:9" || r === "1:1") return r;
  return "9:16";
}

export function normalizeResolution(res?: string): "720p" | "1080p" {
  const r = (res || "").toLowerCase();
  if (r.includes("1080")) return "1080p";
  return "720p";
}

export function isSeedance20(model?: string): boolean {
  return Boolean(model && /seedance-2|doubao-seedance-2/i.test(model));
}

export function isKlingV3Omni(model?: string): boolean {
  return Boolean(model && /v3-omni|kling-v3/i.test(model));
}

/** image_tail is accepted on turbo / v2.6, and only in pro mode. */
export function klingSupportsImageTail(model?: string, mode?: string): boolean {
  if ((mode || "std") !== "pro") return false;
  const m = (model || "").toLowerCase();
  return /turbo|v2\.?6|v2-6|v2_6/.test(m);
}

export function klingModeForRequest(model?: string, requested?: "std" | "pro", hasTail?: boolean): "std" | "pro" {
  if (requested === "pro" || requested === "std") return requested;
  if (hasTail && klingSupportsImageTail(model, "pro")) return "pro";
  if (hasTail && /turbo|v2\.?6|v2-6|v2_6/i.test(model || "")) return "pro";
  return "std";
}

export function dataUriToRawBase64(dataUri: string): string {
  const trimmed = (dataUri || "").trim();
  const comma = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && comma >= 0) return trimmed.slice(comma + 1);
  return trimmed;
}

export function buildSeedanceContent(req: VideoClipRequest): SeedanceContentPart[] {
  const content: SeedanceContentPart[] = [{ type: "text", text: req.prompt || "" }];
  if (req.firstFrameDataUri) {
    content.push({
      type: "image_url",
      image_url: { url: req.firstFrameDataUri },
      role: "first_frame",
    });
  }
  if (req.lastFrameDataUri) {
    content.push({
      type: "image_url",
      image_url: { url: req.lastFrameDataUri },
      role: "last_frame",
    });
  }

  const model = req.model || SEEDANCE_MODEL_15_PRO;
  const hasFramePair = Boolean(req.firstFrameDataUri || req.lastFrameDataUri);
  // Seedance 2.0: first/last frame cannot mix with reference media.
  if (isSeedance20(model) && hasFramePair) {
    return content;
  }

  const refs = (req.referenceDataUris || []).filter(Boolean).slice(0, 9);
  for (const url of refs) {
    if (url === req.firstFrameDataUri || url === req.lastFrameDataUri) continue;
    content.push({
      type: "image_url",
      image_url: { url },
      role: "reference_image",
    });
  }
  return content;
}

export function buildSeedanceTaskBody(req: VideoClipRequest): Record<string, unknown> {
  const model = req.model || SEEDANCE_MODEL_15_PRO;
  return {
    model,
    content: buildSeedanceContent(req),
    ratio: normalizeAspectRatio(req.aspectRatio),
    duration: snapSeedanceDuration(req.durationSec),
    resolution: normalizeResolution(req.resolution),
    generate_audio: req.generateAudio !== false,
    watermark: false,
  };
}

export function extractSeedanceVideoUrl(data: any): string {
  if (!data) return "";
  const candidates = [
    data?.content?.video_url,
    data?.content?.videoUrl,
    data?.video_url,
    data?.output?.video_url,
    data?.data?.content?.video_url,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}

export function buildKlingImage2VideoBody(req: VideoClipRequest): Record<string, unknown> {
  const model = req.model || KLING_DEFAULT_MODEL;
  const hasTail = Boolean(req.lastFrameDataUri);
  const mode = klingModeForRequest(model, req.klingMode, hasTail);
  const body: Record<string, unknown> = {
    model_name: model,
    mode,
    duration: snapKlingDuration(req.durationSec),
    aspect_ratio: normalizeAspectRatio(req.aspectRatio),
    sound: req.klingSound === "off" ? "off" : "on",
  };

  if (req.firstFrameDataUri) {
    body.image = dataUriToRawBase64(req.firstFrameDataUri);
  }

  if (hasTail && (mode === "pro" || klingSupportsImageTail(model, mode))) {
    body.image_tail = dataUriToRawBase64(req.lastFrameDataUri!);
  }

  if (isKlingV3Omni(model)) {
    const list = (req.referenceDataUris || [])
      .filter(Boolean)
      .filter((u) => u !== req.firstFrameDataUri && u !== req.lastFrameDataUri)
      .slice(0, 4)
      .map(dataUriToRawBase64);
    if (list.length > 0) body.image_list = list;
  }

  return body;
}

export function extractKlingTaskId(data: any): string {
  if (!data) return "";
  const id =
    data?.data?.task_id ||
    data?.data?.taskId ||
    data?.task_id ||
    data?.taskId ||
    data?.id ||
    "";
  return typeof id === "string" ? id : String(id || "");
}

export function extractKlingVideoUrl(data: any): string {
  if (!data) return "";
  const url =
    data?.data?.task_result?.videos?.[0]?.url ||
    data?.task_result?.videos?.[0]?.url ||
    data?.data?.videos?.[0]?.url ||
    "";
  return typeof url === "string" ? url.trim() : "";
}

export function klingTaskStatus(data: any): string {
  const status = data?.data?.task_status || data?.task_status || data?.status || "";
  return String(status).toLowerCase();
}

export function grokMotionPrompt(prompt: string): string {
  const trimmed = (prompt || "").trim();
  const lock =
    "Animate the provided start frame. Do not restyle, recompose, or change identity, wardrobe, or set. Prompt describes motion and camera only.";
  if (!trimmed) return lock;
  if (/do not restyle/i.test(trimmed)) return trimmed;
  return `${lock}\n\n${trimmed}`;
}

export function buildGrokVideoGenerateBody(req: VideoClipRequest): Record<string, unknown> {
  const refs = (req.referenceDataUris || [])
    .filter(Boolean)
    .filter((u) => u !== req.firstFrameDataUri)
    .slice(0, 7);

  const body: Record<string, unknown> = {
    model: req.model || GROK_VIDEO_MODEL,
    prompt: grokMotionPrompt(req.prompt),
    duration: snapGrokDuration(req.durationSec),
    aspect_ratio: normalizeAspectRatio(req.aspectRatio),
    resolution: normalizeResolution(req.resolution),
  };

  if (req.firstFrameDataUri) {
    body.image_url = req.firstFrameDataUri;
  }
  if (refs.length > 0) {
    body.reference_image_urls = refs;
  }
  return body;
}

export function extractGrokVideoUrl(data: any): string {
  if (!data) return "";
  const candidates = [
    data?.video?.url,
    data?.response?.video?.url,
    data?.logged?.video?.response?.video?.url,
    data?.video_url,
    data?.url,
    data?.data?.[0]?.url,
    data?.response?.url,
    data?.result?.url,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}

/**
 * Resolve first/end/identity frames from a production request.
 * lastFrameUrl from ProductionAssetService is the *extracted previous last frame*
 * and is a FIRST-frame continuity input, not Kling image_tail.
 * End pose / image_tail comes from endFrameUrl / imageTailUrl / nextSceneStillUrl.
 */
export function resolveClipFrames(body: Record<string, any>): {
  firstFrameUrl?: string;
  endFrameUrl?: string;
  referenceImageUrls: string[];
} {
  const first =
    body.imageUrl ||
    body.firstFrameUrl ||
    body.image_url ||
    body.continuityFrameUrl ||
    body.lastFrameUrl ||
    undefined;
  const end =
    body.endFrameUrl ||
    body.imageTailUrl ||
    body.nextSceneStillUrl ||
    undefined;
  const refsRaw = body.referenceImageUrls || body.reference_image_urls || [];
  const refs = Array.isArray(refsRaw) ? refsRaw.filter((u: unknown) => typeof u === "string" && u.trim()) : [];
  return {
    firstFrameUrl: typeof first === "string" && first.trim() ? first.trim() : undefined,
    endFrameUrl: typeof end === "string" && end.trim() && end.trim() !== first ? end.trim() : undefined,
    referenceImageUrls: refs
      .map((u: string) => u.trim())
      .filter((u: string) => u && u !== first && u !== end),
  };
}
