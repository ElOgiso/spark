import { providerEndpoint } from './_providerEndpoint.js';
/**
 * Official Higgsfield AI REST Client (Server-side runtime only)
 * Auth: Authorization: Key {api_key_id}:{api_key_secret}
 * API Base: https://api.higgsfield.ai
 */

export const HIGGSFIELD_API_BASE = "https://api.higgsfield.ai";
export const HIGGSFIELD_POLL_INTERVAL_MS = 2500;
export const HIGGSFIELD_POLL_TIMEOUT_MS = 240000; // 4 minutes (fits within serverless 300s budget)

import { looksLikeStoryboardGridUrl } from "./_videoContract.js";

export interface HiggsfieldCredentials {
  keyId: string;
  keySecret: string;
}

export function parseHiggsfieldKeyString(combined?: string): HiggsfieldCredentials | null {
  if (!combined || typeof combined !== "string") return null;
  const trimmed = combined.trim();
  if (!trimmed) return null;

  // Support id:secret or id|secret
  if (trimmed.includes(":") || trimmed.includes("|")) {
    const sep = trimmed.includes("|") ? "|" : ":";
    const [id, ...rest] = trimmed.split(sep);
    const secret = rest.join(sep);
    if (id?.trim() && secret?.trim()) {
      return { keyId: id.trim(), keySecret: secret.trim() };
    }
  }
  return null;
}

/**
 * Phase 0: Resolve Higgsfield credentials from process.env (first non-empty wins):
 * - HIGGSFIELD_API_KEY
 * - VITE_HIGGSFIELD_API_KEY
 * - Higgsfield_API
 * - HIGGSFIELD_API
 * - HF_CREDENTIALS
 * - HF_KEY
 * - If HF_API_KEY_ID and HF_API_KEY_SECRET both set, return { keyId, keySecret }
 */
export function resolveHiggsfieldCredentials(customKey?: string): HiggsfieldCredentials | null {
  // 1. Direct custom key passed
  if (customKey) {
    const parsed = parseHiggsfieldKeyString(customKey);
    if (parsed) return parsed;
  }

  // 2. Candidate list in exact Phase 0 priority order
  const candidates: (string | undefined)[] = [
    process.env.HIGGSFIELD_API_KEY,
    process.env.VITE_HIGGSFIELD_API_KEY,
    (process.env as any).Higgsfield_API,
    process.env.HIGGSFIELD_API,
    process.env.HF_CREDENTIALS,
    process.env.HF_KEY,
  ];

  for (const c of candidates) {
    if (c && typeof c === "string" && c.trim()) {
      const parsed = parseHiggsfieldKeyString(c.trim());
      if (parsed) return parsed;
    }
  }

  // 3. Separated key id and key secret environment variables
  const keyId = (
    process.env.HF_API_KEY_ID ||
    process.env.HIGGSFIELD_API_KEY_ID ||
    process.env.HIGGSFIELD_KEY_ID ||
    ""
  ).trim();

  const keySecret = (
    process.env.HF_API_KEY_SECRET ||
    process.env.HIGGSFIELD_API_KEY_SECRET ||
    process.env.HIGGSFIELD_KEY_SECRET ||
    ""
  ).trim();

  if (keyId && keySecret) {
    return { keyId, keySecret };
  }

  return null;
}

/**
 * Phase 1: resolveHiggsfieldAuth() -> { authorization: Key {id}:{secret} }
 */
export function resolveHiggsfieldAuth(customKey?: string): { authorization: string } | null {
  const creds = resolveHiggsfieldCredentials(customKey);
  if (!creds) return null;
  return { authorization: `Key ${creds.keyId}:${creds.keySecret}` };
}

export function buildHiggsfieldAuthHeader(creds: HiggsfieldCredentials): string {
  return `Key ${creds.keyId}:${creds.keySecret}`;
}

export function mapHiggsfieldAspectRatio(aspectRatio?: string): string {
  const norm = String(aspectRatio || "").trim().toLowerCase();
  if (norm === "9:16" || norm === "vertical" || norm === "portrait") return "9:16";
  if (norm === "16:9" || norm === "horizontal" || norm === "landscape") return "16:9";
  if (norm === "1:1" || norm === "square") return "1:1";
  if (norm === "4:3") return "4:3";
  if (norm === "3:4") return "3:4";
  if (norm === "3:2") return "3:2";
  if (norm === "2:3") return "2:3";
  return "9:16";
}

/**
 * Phase 1: extractImageUrl(result) -> images[0].url
 */
export function extractImageUrl(result: any): string {
  if (!result) return "";
  if (Array.isArray(result.images) && result.images.length > 0) {
    const first = result.images[0];
    return typeof first === "string" ? first : first?.url || "";
  }
  if (typeof result.image === "string") return result.image;
  if (result.image?.url) return result.image.url;
  if (Array.isArray(result.output) && result.output.length > 0) {
    const first = result.output[0];
    return typeof first === "string" ? first : first?.url || "";
  }
  if (typeof result.url === "string") return result.url;
  return "";
}
export const firstImageUrl = extractImageUrl;

/**
 * Phase 1: extractVideoUrl(result) -> video.url
 */
export function extractVideoUrl(result: any): string {
  if (!result) return "";
  if (typeof result.video?.url === "string") return result.video.url;
  if (typeof result.video === "string") return result.video;
  if (Array.isArray(result.videos) && result.videos.length > 0) {
    const first = result.videos[0];
    return typeof first === "string" ? first : first?.url || "";
  }
  if (typeof result.output?.video?.url === "string") return result.output.video.url;
  if (typeof result.output?.url === "string") return result.output.url;
  if (Array.isArray(result.output) && result.output.length > 0) {
    const first = result.output[0];
    return typeof first === "string" ? first : first?.url || "";
  }
  if (typeof result.video_url === "string") return result.video_url;
  if (typeof result.url === "string") return result.url;
  return "";
}
export const videoUrl = extractVideoUrl;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Phase 1: submit(path, body) -> POST https://api.higgsfield.ai[object Object]
 */
export async function submit(
  endpointPath: string,
  body: Record<string, unknown>,
  customKey?: string,
  signal?: AbortSignal
): Promise<any> {
  const auth = resolveHiggsfieldAuth(customKey);
  if (!auth) {
    throw new Error(
      "Higgsfield credentials not configured. Please set HIGGSFIELD_API_KEY in 'key_id:key_secret' form or set HF_API_KEY_ID and HF_API_KEY_SECRET."
    );
  }

  const url = endpointPath.startsWith("http")
    ? endpointPath
    : `${HIGGSFIELD_API_BASE}${endpointPath.startsWith("/") ? "" : "/"}${endpointPath}`;

  const res = await fetch(providerEndpoint("higgsfield", url), {
    redirect: "error",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth.authorization,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Higgsfield request failed (${res.status}): ${errText.slice(0, 400)}`);
  }

  return res.json();
}
export const submitHiggsfield = submit;

/**
 * Phase 1: pollRequest(request_id | status_url) -> GET until status in completed|failed|nsfw|canceled
 * Phase 5A: best-effort cancel on AbortSignal
 * Phase 5D: coarse progress callback (queued -> in_progress -> completed)
 */
export async function pollRequest(
  requestIdOrStatusUrl: string,
  customKey?: string,
  timeoutMs: number = HIGGSFIELD_POLL_TIMEOUT_MS,
  signal?: AbortSignal,
  onProgress?: (status: string, data?: any) => void
): Promise<any> {
  const auth = resolveHiggsfieldAuth(customKey);
  if (!auth) {
    throw new Error("Higgsfield credentials not configured.");
  }

  let pollUrl = requestIdOrStatusUrl;
  let cleanId = "";
  if (!pollUrl.startsWith("http")) {
    cleanId = requestIdOrStatusUrl.replace(/^\/requests\//, "").replace(/\/status$/, "");
    pollUrl = `${HIGGSFIELD_API_BASE}/requests/${cleanId}/status`;
  } else {
    const match = pollUrl.match(/\/requests\/([^/]+)/);
    if (match) cleanId = match[1];
  }

  const started = Date.now();
  let lastStatus = "";
  let pollInterval = HIGGSFIELD_POLL_INTERVAL_MS;

  // Best-effort cancel when signal aborts during queued/in_progress state
  const performCancel = () => {
    if (cleanId && (lastStatus === "queued" || lastStatus === "in_progress" || !lastStatus)) {
      cancel(cleanId, customKey).catch((err) => {
        console.warn("[Higgsfield] Best-effort cancel on abort failed:", err);
      });
    }
  };

  if (signal?.aborted) {
    performCancel();
    throw new Error("Higgsfield polling aborted by client signal.");
  }

  const abortListener = () => {
    performCancel();
  };

  if (signal) {
    signal.addEventListener("abort", abortListener, { once: true });
  }

  try {
    while (Date.now() - started < timeoutMs) {
      if (signal?.aborted) {
        performCancel();
        throw new Error("Higgsfield polling aborted by client signal.");
      }

      await sleep(pollInterval);
      pollInterval = Math.min(5000, Math.round(pollInterval * 1.25));

      const res = await fetch(providerEndpoint("higgsfield", pollUrl), {
        redirect: "error",
        method: "GET",
        headers: {
          Authorization: auth.authorization,
        },
        signal,
      });

      if (!res.ok) {
        console.warn(`[Higgsfield] Poll request returned ${res.status}`);
        continue;
      }

      const data = await res.json();
      lastStatus = String(data.status || data.state || "").toLowerCase();

      if (onProgress && lastStatus) {
        try {
          onProgress(lastStatus, data);
        } catch {}
      }

      if (lastStatus === "completed" || lastStatus === "succeeded" || lastStatus === "success") {
        return data;
      }

      if (
        lastStatus === "failed" ||
        lastStatus === "error" ||
        lastStatus === "nsfw" ||
        lastStatus === "canceled" ||
        lastStatus === "cancelled"
      ) {
        const detail = data.error || data.message || data.detail || JSON.stringify(data);
        throw new Error(`Higgsfield job ${lastStatus}: ${detail}`);
      }
    }

    throw new Error(
      `Higgsfield poll timed out after ${Math.round(timeoutMs / 1000)}s (last status: ${lastStatus || "unknown"}).`
    );
  } catch (err: any) {
    if (signal?.aborted || err?.name === "AbortError") {
      performCancel();
    }
    throw err;
  } finally {
    if (signal) {
      signal.removeEventListener("abort", abortListener);
    }
  }
}
export const pollHiggsfieldStatus = pollRequest;

/**
 * Phase 1: cancel(request_id) -> POST /requests/{id}/cancel
 */
export async function cancel(
  requestId: string,
  customKey?: string,
  signal?: AbortSignal
): Promise<boolean> {
  try {
    const auth = resolveHiggsfieldAuth(customKey);
    if (!auth) return false;

    const cleanId = requestId.replace(/^\/requests\//, "").replace(/\/status$/, "");
    const res = await fetch(`${HIGGSFIELD_API_BASE}/requests/${cleanId}/cancel`, {
      method: "POST",
      headers: {
        Authorization: auth.authorization,
      },
      signal,
    });
    return res.ok;
  } catch (err) {
    console.warn("[Higgsfield] Cancel request notice:", err);
    return false;
  }
}
export const cancelHiggsfieldRequest = cancel;

export interface GenerateSoulImageOptions {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  resolution?: string;
  seed?: number;
  enhancePrompt?: boolean;
  onProgress?: (status: string) => void;
}

/**
 * Upload non-public inputs via official Higgsfield Files API:
 * POST /files/generate-upload-url -> PUT upload_url -> returns public_url
 */
export async function uploadHiggsfieldFile(
  buffer: Buffer,
  contentType: string = "image/png",
  customKey?: string
): Promise<string> {
  const auth = resolveHiggsfieldAuth(customKey);
  if (!auth) {
    throw new Error(
      "Higgsfield credentials not configured. Please set HIGGSFIELD_API_KEY in 'key_id:key_secret' form or set HF_API_KEY_ID and HF_API_KEY_SECRET."
    );
  }

  const initRes = await fetch(`${HIGGSFIELD_API_BASE}/files/generate-upload-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth.authorization,
    },
    body: JSON.stringify({ content_type: contentType }),
  });

  if (!initRes.ok) {
    const errText = await initRes.text().catch(() => "");
    throw new Error(`Higgsfield generate-upload-url failed (${initRes.status}): ${errText.slice(0, 300)}`);
  }

  const initData = await initRes.json();
  const uploadUrl = initData.upload_url || initData.url;
  const publicUrl = initData.public_url || initData.file_url || initData.url;
  if (!uploadUrl || !publicUrl) {
    throw new Error("Higgsfield generate-upload-url did not return upload_url or public_url.");
  }

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: buffer,
  });

  if (!putRes.ok) {
    const errText = await putRes.text().catch(() => "");
    throw new Error(`Higgsfield upload failed (${putRes.status}): ${errText.slice(0, 300)}`);
  }

  return publicUrl;
}

/**
 * Phase 2: Soul Image Generation
 * default model (soul-2) -> /higgsfield-ai/soul/v2/standard
 * soul-cinema / cinema -> /higgsfield-ai/soul/cinema
 * soul-standard -> /higgsfield-ai/soul/standard
 */
export async function generateSoulImage(
  options: GenerateSoulImageOptions,
  customKey?: string,
  signal?: AbortSignal
): Promise<string> {
  const normModel = String(options.model || "").toLowerCase();
  const isCinema = normModel.includes("cinema");
  const isStandard = normModel === "soul-standard" || normModel.includes("soul/standard");
  const endpoint = isCinema
    ? "/higgsfield-ai/soul/cinema"
    : isStandard
    ? "/higgsfield-ai/soul/standard"
    : "/higgsfield-ai/soul/v2/standard";

  const body = {
    prompt: options.prompt,
    aspect_ratio: mapHiggsfieldAspectRatio(options.aspectRatio),
    resolution: options.resolution === "720p" ? "720p" : "1080p",
    batch_size: 1,
    enhance_prompt: options.enhancePrompt !== false,
    ...(options.seed !== undefined ? { seed: options.seed } : {}),
  };

  const initial = await submit(endpoint, body, customKey, signal);

  // If endpoint immediately returned images
  const immediateUrl = extractImageUrl(initial);
  if (immediateUrl) return immediateUrl;

  const target = initial.status_url || initial.request_id || initial.id;
  if (!target) {
    throw new Error(
      `Higgsfield image generation returned no image and no request_id: ${JSON.stringify(initial).slice(0, 300)}`
    );
  }

  const completed = await pollRequest(
    target,
    customKey,
    HIGGSFIELD_POLL_TIMEOUT_MS,
    signal,
    options.onProgress
  );
  const finalUrl = extractImageUrl(completed);
  if (!finalUrl) {
    throw new Error("Higgsfield completed image generation but images[0].url was empty.");
  }
  return finalUrl;
}

export interface GenerateSeedanceVideoOptions {
  prompt: string;
  firstFrameUrl: string;
  endFrameUrl?: string;
  durationSec?: number;
  resolution?: string;
  model?: string;
  generateAudio?: boolean;
  onProgress?: (status: string) => void;
  onSubmit?: (requestId: string) => void;
  shotIndex?: number;
  subclipIndex?: number;
}

function resolveSeedanceResolution(requestedRes?: string, is20?: boolean): string {
  const raw = (requestedRes || "720p").toLowerCase().trim();
  if (is20) {
    if (raw === "4k" || raw === "2160p") return "4k";
    if (raw === "1080p" || raw === "fhd") return "1080p";
    if (raw === "480p" || raw === "sd") return "480p";
    return "720p";
  }
  // Model 2.5: only 480p | 720p (never 1080p/4k)
  return raw === "480p" || raw === "sd" ? "480p" : "720p";
}

function resolveSeedanceDuration(requestedDuration?: number, is20?: boolean): number {
  const maxDur = is20 ? 15 : 30;
  if (typeof requestedDuration === "number" && requestedDuration > 0) {
    return Math.max(4, Math.min(maxDur, Math.round(requestedDuration)));
  }
  return 5;
}

/**
 * Phase 3: Seedance I2V on Higgsfield only
 * default -> /bytedance/seedance-2.5/image-to-video
 * 2.0 -> /bytedance/seedance-2.0/image-to-video
 */
export async function generateSeedanceVideo(
  options: GenerateSeedanceVideoOptions,
  customKey?: string,
  signal?: AbortSignal
): Promise<string> {
  if (!options.firstFrameUrl || !options.firstFrameUrl.trim()) {
    throw new Error("Higgsfield Seedance I2V requires a valid firstFrameUrl.");
  }
  if (options.firstFrameUrl.startsWith("asset://")) {
    throw new Error(
      "Higgsfield Seedance I2V does not support asset:// URI scheme. A public HTTPS image_url is required."
    );
  }
  if (looksLikeStoryboardGridUrl(options.firstFrameUrl)) {
    throw new Error("Higgsfield Seedance I2V requires this shot's still, not a storyboard grid.");
  }

  const is20 = options.model?.toLowerCase().includes("2.0");
  const endpoint = is20
    ? "/bytedance/seedance-2.0/image-to-video"
    : "/bytedance/seedance-2.5/image-to-video";

  const dur = resolveSeedanceDuration(options.durationSec, is20);
  const res = resolveSeedanceResolution(options.resolution, is20);

  const body: Record<string, unknown> = {
    prompt: options.prompt || "",
    image_url: options.firstFrameUrl,
    duration: dur,
    resolution: res,
    generate_audio: options.generateAudio !== false,
    ...(!is20 ? { output_format: "mp4" } : {}),
  };

  if (options.endFrameUrl && options.endFrameUrl.trim()) {
    body.end_image_url = options.endFrameUrl.trim();
  }

  const initial = await submit(endpoint, body, customKey, signal);
  const target = initial.status_url || initial.request_id || initial.id;
  const billableId = initial.request_id || initial.id || target || "hf_sub";
  if (options.onSubmit) {
    try { options.onSubmit(billableId); } catch {}
  }
  console.log(
    `[I2V BILLABLE] provider=higgsfield model=${options.model || (is20 ? "seedance-2.0" : "seedance-2.5")} durationSec=${dur} scene=${options.shotIndex ?? "unknown"} subclipIndex=${options.subclipIndex ?? 1} request_id=${billableId}`
  );

  const immediateUrl = extractVideoUrl(initial);
  if (immediateUrl) return immediateUrl;

  if (!target) {
    throw new Error(
      `Higgsfield video generation returned no video and no request_id: ${JSON.stringify(initial).slice(0, 300)}`
    );
  }

  const completed = await pollRequest(
    target,
    customKey,
    HIGGSFIELD_POLL_TIMEOUT_MS,
    signal,
    options.onProgress
  );
  const finalUrl = extractVideoUrl(completed);
  if (!finalUrl) {
    throw new Error("Higgsfield completed video generation but video.url was empty.");
  }
  return finalUrl;
}

export interface GenerateSeedanceReferenceVideoOptions {
  prompt: string;
  imageUrls: string[];
  aspectRatio: string; // REQUIRED
  durationSec?: number;
  resolution?: string;
  model?: string;
  generateAudio?: boolean;
  videoUrls?: string[];
  audioUrls?: string[];
  onProgress?: (status: string) => void;
  onSubmit?: (requestId: string) => void;
  shotIndex?: number;
  subclipIndex?: number;
}

/**
 * Phase 5B: Seedance Reference-to-Video (R2V) on Higgsfield only
 * Explicit mode — not default shots.
 * default -> /bytedance/seedance-2.5/reference-to-video
 * 2.0 -> /bytedance/seedance-2.0/reference-to-video
 */
export async function generateSeedanceReferenceVideo(
  options: GenerateSeedanceReferenceVideoOptions,
  customKey?: string,
  signal?: AbortSignal
): Promise<string> {
  const is20 = options.model?.toLowerCase().includes("2.0");
  const endpoint = is20
    ? "/bytedance/seedance-2.0/reference-to-video"
    : "/bytedance/seedance-2.5/reference-to-video";

  const rawRefs = options.imageUrls || [];
  const cleanRefs = rawRefs
    .filter((u) => typeof u === "string" && u.trim().startsWith("http"))
    .filter((u) => !looksLikeStoryboardGridUrl(u));

  if (cleanRefs.length === 0) {
    throw new Error(
      "Higgsfield Seedance R2V requires at least 1 public HTTPS reference image (storyboard grids not allowed)."
    );
  }

  const dur = resolveSeedanceDuration(options.durationSec, is20);
  const res = resolveSeedanceResolution(options.resolution, is20);

  const ar = mapHiggsfieldAspectRatio(options.aspectRatio || "9:16");

  const body: Record<string, unknown> = {
    prompt: options.prompt || "",
    image_urls: cleanRefs,
    aspect_ratio: ar,
    duration: dur,
    resolution: res,
    generate_audio: options.generateAudio !== false,
    ...(!is20 ? { output_format: "mp4" } : {}),
  };

  if (Array.isArray(options.videoUrls) && options.videoUrls.length > 0) {
    body.video_urls = options.videoUrls;
  }
  if (Array.isArray(options.audioUrls) && options.audioUrls.length > 0) {
    body.audio_urls = options.audioUrls;
  }

  const initial = await submit(endpoint, body, customKey, signal);
  const target = initial.status_url || initial.request_id || initial.id;
  const billableId = initial.request_id || initial.id || target || "hf_sub";
  if (options.onSubmit) {
    try { options.onSubmit(billableId); } catch {}
  }
  console.log(
    `[I2V BILLABLE] provider=higgsfield model=${options.model || (is20 ? "seedance-2.0" : "seedance-2.5")} durationSec=${options.durationSec || 5} scene=${options.shotIndex ?? "unknown"} subclipIndex=${options.subclipIndex ?? 1} request_id=${billableId}`
  );

  const immediateUrl = extractVideoUrl(initial);
  if (immediateUrl) return immediateUrl;

  if (!target) {
    throw new Error(
      `Higgsfield R2V returned no video and no request_id: ${JSON.stringify(initial).slice(0, 300)}`
    );
  }

  const completed = await pollRequest(
    target,
    customKey,
    HIGGSFIELD_POLL_TIMEOUT_MS,
    signal,
    options.onProgress
  );
  const finalUrl = extractVideoUrl(completed);
  if (!finalUrl) {
    throw new Error("Higgsfield completed R2V video generation but video.url was empty.");
  }
  return finalUrl;
}
