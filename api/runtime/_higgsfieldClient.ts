/**
 * Official Higgsfield AI REST Client (Server-side runtime only)
 * Auth: Authorization: Key {api_key_id}:{api_key_secret}
 * API Base: https://api.higgsfield.ai
 */

export const HIGGSFIELD_API_BASE = "https://api.higgsfield.ai";
export const HIGGSFIELD_POLL_INTERVAL_MS = 2500;
export const HIGGSFIELD_POLL_TIMEOUT_MS = 240000; // 4 minutes (fits within serverless 300s budget)

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

export function resolveHiggsfieldCredentials(customKey?: string): HiggsfieldCredentials | null {
  // 1. Direct custom key passed
  if (customKey) {
    const parsed = parseHiggsfieldKeyString(customKey);
    if (parsed) return parsed;
  }

  // 2. Combined environment variables
  const envKey =
    process.env.HIGGSFIELD_API_KEY ||
    process.env.HF_CREDENTIALS ||
    process.env.HF_KEY ||
    process.env.VITE_HIGGSFIELD_API_KEY;

  if (envKey) {
    const parsed = parseHiggsfieldKeyString(envKey);
    if (parsed) return parsed;
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

export function firstImageUrl(result: any): string {
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

export function videoUrl(result: any): string {
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

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function submitHiggsfield(
  endpointPath: string,
  body: Record<string, unknown>,
  customKey?: string
): Promise<any> {
  const creds = resolveHiggsfieldCredentials(customKey);
  if (!creds) {
    throw new Error(
      "Higgsfield credentials not configured. Please set HIGGSFIELD_API_KEY in 'key_id:key_secret' form or set HF_API_KEY_ID and HF_API_KEY_SECRET."
    );
  }

  const url = endpointPath.startsWith("http")
    ? endpointPath
    : `${HIGGSFIELD_API_BASE}${endpointPath.startsWith("/") ? "" : "/"}${endpointPath}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: buildHiggsfieldAuthHeader(creds),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Higgsfield request failed (${res.status}): ${errText.slice(0, 400)}`);
  }

  return res.json();
}

export async function pollHiggsfieldStatus(
  requestIdOrStatusUrl: string,
  customKey?: string,
  timeoutMs: number = HIGGSFIELD_POLL_TIMEOUT_MS
): Promise<any> {
  const creds = resolveHiggsfieldCredentials(customKey);
  if (!creds) {
    throw new Error("Higgsfield credentials not configured.");
  }

  let pollUrl = requestIdOrStatusUrl;
  if (!pollUrl.startsWith("http")) {
    const cleanId = requestIdOrStatusUrl.replace(/^\/requests\//, "").replace(/\/status$/, "");
    pollUrl = `${HIGGSFIELD_API_BASE}/requests/${cleanId}/status`;
  }

  const started = Date.now();
  let lastStatus = "";

  while (Date.now() - started < timeoutMs) {
    await sleep(HIGGSFIELD_POLL_INTERVAL_MS);

    const res = await fetch(pollUrl, {
      method: "GET",
      headers: {
        Authorization: buildHiggsfieldAuthHeader(creds),
      },
    });

    if (!res.ok) {
      console.warn(`[Higgsfield] Poll request returned ${res.status}`);
      continue;
    }

    const data = await res.json();
    lastStatus = String(data.status || data.state || "").toLowerCase();

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
}

export async function cancelHiggsfieldRequest(
  requestId: string,
  customKey?: string
): Promise<boolean> {
  try {
    const creds = resolveHiggsfieldCredentials(customKey);
    if (!creds) return false;

    const cleanId = requestId.replace(/^\/requests\//, "").replace(/\/status$/, "");
    const res = await fetch(`${HIGGSFIELD_API_BASE}/requests/${cleanId}/cancel`, {
      method: "POST",
      headers: {
        Authorization: buildHiggsfieldAuthHeader(creds),
      },
    });
    return res.ok;
  } catch (err) {
    console.warn("[Higgsfield] Cancel request notice:", err);
    return false;
  }
}

export interface GenerateSoulImageOptions {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  resolution?: string;
  seed?: number;
  enhancePrompt?: boolean;
}

export async function generateSoulImage(
  options: GenerateSoulImageOptions,
  customKey?: string
): Promise<string> {
  const isCinema = options.model?.toLowerCase().includes("cinema");
  const endpoint = isCinema ? "/higgsfield-ai/soul/cinema" : "/higgsfield-ai/soul/v2/standard";

  const body = {
    prompt: options.prompt,
    aspect_ratio: mapHiggsfieldAspectRatio(options.aspectRatio),
    resolution: options.resolution === "720p" ? "720p" : "1080p",
    batch_size: 1,
    enhance_prompt: options.enhancePrompt !== false,
    ...(options.seed !== undefined ? { seed: options.seed } : {}),
  };

  const initial = await submitHiggsfield(endpoint, body, customKey);

  // If endpoint immediately returned images
  const immediateUrl = firstImageUrl(initial);
  if (immediateUrl) return immediateUrl;

  const target = initial.status_url || initial.request_id || initial.id;
  if (!target) {
    throw new Error(
      `Higgsfield image generation returned no image and no request_id: ${JSON.stringify(initial).slice(0, 300)}`
    );
  }

  const completed = await pollHiggsfieldStatus(target, customKey);
  const finalUrl = firstImageUrl(completed);
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
}

export async function generateSeedanceVideo(
  options: GenerateSeedanceVideoOptions,
  customKey?: string
): Promise<string> {
  if (!options.firstFrameUrl || !options.firstFrameUrl.trim()) {
    throw new Error("Higgsfield Seedance I2V requires a valid firstFrameUrl.");
  }

  const is20 = options.model?.toLowerCase().includes("2.0");
  const endpoint = is20
    ? "/bytedance/seedance-2.0/image-to-video"
    : "/bytedance/seedance-2.5/image-to-video";

  const dur = typeof options.durationSec === "number" && options.durationSec > 0
    ? Math.max(1, Math.min(15, Math.round(options.durationSec)))
    : 5;

  const res = options.resolution === "1080p" ? "1080p" : "720p";

  const body: Record<string, unknown> = {
    prompt: options.prompt || "",
    image_url: options.firstFrameUrl,
    duration: dur,
    resolution: res,
    generate_audio: options.generateAudio !== false,
    output_format: "mp4",
  };

  if (options.endFrameUrl && options.endFrameUrl.trim()) {
    body.end_image_url = options.endFrameUrl.trim();
  }

  const initial = await submitHiggsfield(endpoint, body, customKey);

  const immediateUrl = videoUrl(initial);
  if (immediateUrl) return immediateUrl;

  const target = initial.status_url || initial.request_id || initial.id;
  if (!target) {
    throw new Error(
      `Higgsfield video generation returned no video and no request_id: ${JSON.stringify(initial).slice(0, 300)}`
    );
  }

  const completed = await pollHiggsfieldStatus(target, customKey);
  const finalUrl = videoUrl(completed);
  if (!finalUrl) {
    throw new Error("Higgsfield completed video generation but video.url was empty.");
  }
  return finalUrl;
}
