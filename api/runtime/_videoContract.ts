/**
 * Locked video-provider payloads for SPARK production I2V.
 * Contracts from working studios (Toonflow Volcengine / ArcReel ark,kling,grok).
 * Pure builders — no network — so unit tests can assert the wire format.
 */

export const SEEDANCE_MODEL_15_PRO = "doubao-seedance-1-5-pro-251215";
export const SEEDANCE_MODEL_20 = "doubao-seedance-2-0-260128";
export const GROK_VIDEO_MODEL = "grok-imagine-video";
export const KLING_DEFAULT_MODEL = "kling-v2-6";

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

/** Veo durationSeconds ∈ {4, 6, 8}. Must be 8 when lastFrame or identity refs are present. */
export function snapVeoDuration(
  sec?: number,
  opts?: { hasLastFrame?: boolean; hasIdentityRefs?: boolean }
): 4 | 6 | 8 {
  if (opts?.hasLastFrame || opts?.hasIdentityRefs) return 8;
  if (sec === 4 || sec === 6 || sec === 8) return sec;
  const n = typeof sec === "number" && Number.isFinite(sec) ? sec : 8;
  if (n <= 4) return 4;
  if (n <= 6) return 6;
  return 8;
}

export function veoImagePartFromDataUri(dataUri: string): {
  bytesBase64Encoded: string;
  mimeType: string;
  imageBytes: string;
} {
  const trimmed = (dataUri || "").trim();
  const mimeMatch = trimmed.match(/^data:([^;,]+)/);
  const mimeType = mimeMatch?.[1] || "image/jpeg";
  const bytes = dataUriToRawBase64(trimmed);
  return { bytesBase64Encoded: bytes, mimeType, imageBytes: bytes };
}

/**
 * Official Veo 3.1 i2v instance: shot still as image, previous last frame as lastFrame.
 * No referenceImages (i2v ≠ reference-to-video). No { uri: https }.
 */
export function buildVeoVideoPayload(params: {
  prompt: string;
  firstFrameDataUri: string;
  lastFrameDataUri?: string;
  aspectRatio?: string;
  durationSec?: number;
}): {
  instances: Array<Record<string, unknown>>;
  parameters: { aspectRatio: "16:9" | "9:16"; sampleCount: 1; durationSeconds: 4 | 6 | 8 };
} {
  const image = veoImagePartFromDataUri(params.firstFrameDataUri);
  const instance: Record<string, unknown> = {
    prompt: i2vMotionLock(params.prompt),
    image,
  };
  if (params.lastFrameDataUri) {
    instance.lastFrame = veoImagePartFromDataUri(params.lastFrameDataUri);
  }
  const durationSeconds = snapVeoDuration(params.durationSec, {
    hasLastFrame: Boolean(params.lastFrameDataUri),
  });
  return {
    instances: [instance],
    parameters: {
      aspectRatio: normalizeAspectRatio(params.aspectRatio) === "16:9" ? "16:9" : "9:16",
      sampleCount: 1,
      durationSeconds,
    },
  };
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
  return klingModelSupportsImageTail(model);
}

export function klingModelSupportsImageTail(model?: string): boolean {
  return /turbo|v2\.?6|v2-6|v2_6/i.test(model || "");
}

export function resolveKlingModel(model?: string): string {
  return model || KLING_DEFAULT_MODEL;
}

/** Last-frame/end pose forces pro. image_tail is still gated by klingSupportsImageTail (turbo/v2.6 + pro only). */
export function klingModeForRequest(_model?: string, requested?: "std" | "pro", hasTail?: boolean): "std" | "pro" {
  if (hasTail) return "pro";
  if (requested === "pro") return "pro";
  return "std";
}

export function dataUriToRawBase64(dataUri: string): string {
  const trimmed = (dataUri || "").trim();
  const comma = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && comma >= 0) return trimmed.slice(comma + 1);
  return trimmed;
}

export function buildSeedanceContent(req: VideoClipRequest): SeedanceContentPart[] {
  const content: SeedanceContentPart[] = [{ type: "text", text: i2vMotionLock(req.prompt) }];
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
  const hasTail = Boolean(req.lastFrameDataUri);
  const model = resolveKlingModel(req.model);
  const mode = klingModeForRequest(model, req.klingMode, hasTail);
  const body: Record<string, unknown> = {
    model_name: model,
    mode,
    duration: snapKlingDuration(req.durationSec),
    aspect_ratio: normalizeAspectRatio(req.aspectRatio),
    sound: req.klingSound === "off" ? "off" : "on",
    // Kling image2video accepts prompt/negative_prompt. Previously omitted, so the director's
    // scene action/camera/identity brief was silently dropped on the DEFAULT provider path.
    prompt: i2vMotionLock(req.prompt),
    negative_prompt: I2V_NEGATIVE_PROMPT,
  };

  if (req.firstFrameDataUri) {
    body.image = dataUriToRawBase64(req.firstFrameDataUri);
  }

  if (hasTail && klingSupportsImageTail(model, mode)) {
    body.image_tail = dataUriToRawBase64(req.lastFrameDataUri!);
  }

  if (isKlingV3Omni(model)) {
    // Kling multi-image2video expects image_list as an array of { image } objects
    // (ref: ArcReel lib/video_backends/kling.py `_build_payload`), not raw base64 strings.
    const list = (req.referenceDataUris || [])
      .filter(Boolean)
      .filter((u) => u !== req.firstFrameDataUri && u !== req.lastFrameDataUri)
      .slice(0, 4)
      .map((u) => ({ image: dataUriToRawBase64(u) }));
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

/**
 * Shared image-to-video identity + motion lock applied to EVERY provider (Grok, Kling, Seedance).
 * Keeps the generated clip faithful to the approved keyframe: motion/camera only, never a restyle
 * or identity/wardrobe/set change. This is the primary defense against character drift and
 * "off-concept" clips that ignore the director's scene brief.
 */
export const I2V_MOTION_LOCK =
  "Animate the provided start frame. Do not restyle, recompose, or change identity, wardrobe, or set. Prompt describes motion and camera only.";

/**
 * Shared anti-slop negative prompt for providers that accept one (e.g. Kling `negative_prompt`).
 * Targets the failure modes that read as "AI slop": drifting faces, warped anatomy, duplicated
 * subjects, hard cuts, and burned-in text/watermarks.
 */
export const I2V_NEGATIVE_PROMPT =
  "face morphing, identity drift, different person, wardrobe change, set change, background reset, extra limbs, extra fingers, deformed hands, warped face, duplicated subject, cloned character, jump cut, hard cut, scene reset, burned-in text, caption, subtitle, watermark, logo, glitch, artifacts, low quality, blurry, distorted";

/** Prefix any I2V prompt with the shared identity/motion lock (idempotent). */
export function i2vMotionLock(prompt: string): string {
  const trimmed = (prompt || "").trim();
  if (!trimmed) return I2V_MOTION_LOCK;
  if (/do not restyle/i.test(trimmed)) return trimmed;
  return `${I2V_MOTION_LOCK}\n\n${trimmed}`;
}

/** @deprecated Prefer {@link i2vMotionLock}. Retained for the Grok body and existing callers/tests. */
export function grokMotionPrompt(prompt: string): string {
  return i2vMotionLock(prompt);
}

export function buildGrokVideoGenerateBody(req: VideoClipRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: req.model || GROK_VIDEO_MODEL,
    prompt: grokMotionPrompt(req.prompt),
    duration: snapGrokDuration(req.durationSec),
    aspect_ratio: normalizeAspectRatio(req.aspectRatio),
    resolution: normalizeResolution(req.resolution),
  };

  // Official i2v: image only. xAI forbids image + reference_images on one request.
  if (req.firstFrameDataUri) {
    body.image_url = req.firstFrameDataUri;
    if (req.lastFrameDataUri && req.lastFrameDataUri !== req.firstFrameDataUri) {
      body.last_frame_url = req.lastFrameDataUri;
    }
    return body;
  }

  const refs = (req.referenceDataUris || [])
    .filter(Boolean)
    .filter((u) => u !== req.lastFrameDataUri)
    .slice(0, 7);
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
 * Official I2V frames from a production request.
 * Frame 1 = imageUrl / firstFrameUrl only (this shot's still). Never lastFrameUrl.
 * lastFrameUrl / endFrameUrl = previous clip last frame or planned end pose.
 */
export function resolveClipFrames(body: Record<string, any>): {
  firstFrameUrl?: string;
  endFrameUrl?: string;
  referenceImageUrls: string[];
} {
  const firstRaw = body.imageUrl || body.firstFrameUrl || body.image_url || undefined;
  const first = typeof firstRaw === "string" && firstRaw.trim() ? firstRaw.trim() : undefined;
  const endRaw =
    body.endFrameUrl ||
    body.imageTailUrl ||
    body.nextSceneStillUrl ||
    body.lastFrameUrl ||
    undefined;
  const end = typeof endRaw === "string" && endRaw.trim() && endRaw.trim() !== first ? endRaw.trim() : undefined;
  const refsRaw = body.referenceImageUrls || body.reference_image_urls || [];
  const refs = Array.isArray(refsRaw) ? refsRaw.filter((u: unknown) => typeof u === "string" && u.trim()) : [];
  const lastRaw = typeof body.lastFrameUrl === "string" ? body.lastFrameUrl.trim() : "";
  return {
    firstFrameUrl: first,
    endFrameUrl: end,
    referenceImageUrls: refs
      .map((u: string) => u.trim())
      .filter((u: string) => u && u !== first && u !== end && u !== lastRaw),
  };
}
