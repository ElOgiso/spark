import { requireRuntimeUser } from './_requestAuth.js';
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { execFile } from "child_process";
import { promisify } from "util";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";
import { persistVideoBuffer } from "./_sparkStorage.js";
import { handleIngestMedia, isIngestMediaRequest } from "./_ingestMedia.js";
import { collectSparkShotClipUrls } from "./_sparkShotClips.js";
import {
  generateSeedanceVideo,
  generateSeedanceReferenceVideo,
  resolveHiggsfieldCredentials,
} from "./_higgsfieldClient.js";
import {
  SEEDANCE_MODEL_15_PRO,
  SEEDANCE_POLL_INTERVAL_MS,
  SEEDANCE_POLL_TIMEOUT_MS,
  KLING_DEFAULT_MODEL,
  KLING_POLL_INTERVAL_MS,
  KLING_POLL_TIMEOUT_MS,
  KLING_JWT_MAX_AGE_MS,
  GROK_VIDEO_MODEL,
  buildSeedanceTaskBody,
  extractSeedanceVideoUrl,
  buildKlingImage2VideoBody,
  extractKlingTaskId,
  extractKlingVideoUrl,
  klingTaskStatus,
  buildGrokVideoGenerateBody,
  extractGrokVideoUrl,
  resolveClipFrames,
  type VideoClipRequest,
} from "./_videoContract.js";
import { assertVideoRequestExecutable } from "../../src/app/services/production/capability/assertVideoRequest.js";

const execFileAsync = promisify(execFile);

export const YOUTUBE_CAPTION_LANGS = ["en", "en-US", "a.en"] as const;

export function decodeTimedTextXml(xml: string): string {
  const matches = xml.match(/<text[^>]*>([\s\S]*?)<\/text>/g);
  if (!matches || matches.length === 0) return "";
  return matches
    .map((m) =>
      m
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/\\n/g, " ")
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isYoutubeCaptionsRequest(req: VercelRequest): boolean {
  const q = req.query || {};
  const body = (req.body || {}) as Record<string, unknown>;
  const action = String(q.action || body.action || "").toLowerCase();
  if (action === "captions" || action === "timedtext") return true;
  if (typeof q.timedtext !== "undefined") return true;
  return false;
}

export async function fetchYoutubeTimedTextPlain(videoId: string): Promise<string> {
  const id = String(videoId || "").trim();
  if (!id) return "";
  for (const lang of YOUTUBE_CAPTION_LANGS) {
    try {
      const url = `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(id)}&lang=${encodeURIComponent(lang)}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = decodeTimedTextXml(await res.text());
      if (text.length > 20) return text.slice(0, 3000);
    } catch (err) {
      console.warn("[video adapter] timedtext notice:", err);
    }
  }
  return "";
}

async function handleYoutubeCaptions(req: VercelRequest, res: VercelResponse) {
  const q = req.query || {};
  const body = (req.body || {}) as Record<string, unknown>;
  const videoId = String(q.v || body.videoId || body.v || "").trim();
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).send("");
  }
  const text = await fetchYoutubeTimedTextPlain(videoId);
  return res.status(200).send(text);
}

/** Keep in sync with Vercel serverless limit — poll loops must finish before this. */
export const config = {
  maxDuration: 300,
};

/** In-process provider polls must stay under config.maxDuration with headroom for download/persist. */
const GROK_IN_PROCESS_POLL_MS = 4 * 60 * 1000;

let klingJwtCache: { token: string; issuedAt: number } | null = null;

function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function signKlingJwt(accessKey: string, secretKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: accessKey,
      exp: now + 1800,
      nbf: now - 5,
    })
  );
  const data = `${header}.${payload}`;
  const sig = crypto.createHmac("sha256", secretKey).update(data).digest();
  return `${data}.${base64url(sig)}`;
}

function getKlingJwt(accessKey: string, secretKey: string): string {
  const now = Date.now();
  if (klingJwtCache && now - klingJwtCache.issuedAt < KLING_JWT_MAX_AGE_MS) {
    return klingJwtCache.token;
  }
  const token = signKlingJwt(accessKey, secretKey);
  klingJwtCache = { token, issuedAt: now };
  return token;
}

function resolveKlingKeys(): { accessKey: string; secretKey: string } | null {
  const access =
    process.env.KLING_ACCESS_KEY ||
    process.env.KLING_ACCESS_KEY_ID ||
    process.env.VITE_KLING_ACCESS_KEY ||
    "";
  const secret =
    process.env.KLING_SECRET_KEY ||
    process.env.KLING_API_SECRET ||
    process.env.VITE_KLING_SECRET_KEY ||
    "";
  const combined =
    process.env.KLING_API_KEY ||
    process.env.VITE_KLING_API_KEY ||
    "";

  if (access.trim() && secret.trim()) {
    return { accessKey: access.trim(), secretKey: secret.trim() };
  }
  if (combined.includes(":") || combined.includes("|")) {
    const sep = combined.includes("|") ? "|" : ":";
    const [a, s] = combined.split(sep);
    if (a?.trim() && s?.trim()) return { accessKey: a.trim(), secretKey: s.trim() };
  }
  return null;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function guessMime(urlOrHeader?: string): string {
  const v = (urlOrHeader || "").toLowerCase();
  if (v.includes("png")) return "image/png";
  if (v.includes("webp")) return "image/webp";
  if (v.includes("gif")) return "image/gif";
  return "image/jpeg";
}

async function toDataUri(urlOrUri?: string): Promise<string | undefined> {
  if (!urlOrUri || typeof urlOrUri !== "string") return undefined;
  const trimmed = urlOrUri.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("data:")) return trimmed;
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return undefined;

  const res = await fetch(trimmed);
  if (!res.ok) {
    throw new Error(`Failed to fetch media for I2V (${res.status}): ${trimmed.slice(0, 120)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = guessMime(res.headers.get("content-type") || trimmed);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function buildClipRequest(body: any): Promise<VideoClipRequest> {
  const frames = resolveClipFrames(body);
  const firstFrameDataUri = frames.firstFrameUrl ? await toDataUri(frames.firstFrameUrl) : undefined;
  const lastFrameDataUri = frames.endFrameUrl ? await toDataUri(frames.endFrameUrl) : undefined;
  const referenceDataUris: string[] = [];
  for (const url of frames.referenceImageUrls) {
    if (!url || typeof url !== "string" || !url.trim()) continue;
    try {
      const uri = await toDataUri(url);
      if (uri) {
        referenceDataUris.push(uri);
      } else if (url.trim().startsWith("https://")) {
        referenceDataUris.push(url.trim());
      }
    } catch (err: any) {
      throw new Error(`Failed to convert reference image for I2V: ${err?.message || err}`);
    }
  }
  return {
    prompt: body.prompt || "",
    firstFrameDataUri,
    firstFrameUrl: frames.firstFrameUrl,
    lastFrameDataUri,
    lastFrameUrl: frames.endFrameUrl,
    characterSheetUrl: frames.characterSheetUrl || body.characterSheetUrl,
    referenceDataUris,
    referenceUrls: frames.referenceImageUrls,
    referenceImageUrls: frames.referenceImageUrls,
    aspectRatio: body.aspectRatio || body.aspect_ratio,
    durationSec: typeof body.durationSec === "number" ? body.durationSec : Number(body.duration) || undefined,
    resolution: body.resolution,
    model: body.model,
    generateAudio: body.generateAudio !== false && body.generate_audio !== false,
    klingMode: body.mode === "pro" || body.mode === "std" ? body.mode : undefined,
    klingSound: body.sound === "off" ? "off" : "on",
    productionId: body.productionId,
    brandId: body.brandId,
    shotIndex: body.shotIndex,
    subclipIndex: typeof body.subclipIndex === "number" ? body.subclipIndex : undefined,
  };
}

async function pollGenericUrl(url: string, headers: any, maxSeconds = 45): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < maxSeconds * 1000) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Polling request failed with status ${res.status}`);
    }
    const data = await res.json();
    const status = (data.status || data.state || "").toLowerCase();
    if (status === "completed" || status === "succeeded" || status === "success" || status === "done") {
      return data.videoUrl || data.assets?.video || data.output?.[0] || data.video?.url || "";
    }
    if (status === "failed" || status === "error") {
      throw new Error(`Job execution failed: ${JSON.stringify(data.error || data.reason)}`);
    }
    await sleep(3000);
  }
  throw new Error("Polling timeout exceeded");
}

async function downloadVideoRetry(url: string, attempts = 6): Promise<Buffer> {
  let lastErr: Error | null = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (/video_not_ready|not ready|404/i.test(text) || res.status === 404 || res.status === 425) {
          lastErr = new Error("video_not_ready");
          await sleep(4000 * (i + 1));
          continue;
        }
        throw new Error(`Video download failed (${res.status}): ${text.slice(0, 200)}`);
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (err: any) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (String(lastErr.message).includes("video_not_ready") || /fetch/i.test(String(lastErr.message))) {
        await sleep(4000 * (i + 1));
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr || new Error("video_not_ready");
}

async function extractLastFrameJpeg(videoBuffer: Buffer): Promise<string | undefined> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "spark-frame-"));
  const inputPath = path.join(tmpDir, "clip.mp4");
  const outputPath = path.join(tmpDir, "last.jpg");
  try {
    fs.writeFileSync(inputPath, videoBuffer);
    try {
      await execFileAsync(
        "ffmpeg",
        ["-y", "-sseof", "-0.05", "-i", inputPath, "-frames:v", "1", "-q:v", "2", outputPath],
        { timeout: 30000 }
      );
    } catch {
      await execFileAsync(
        "ffmpeg",
        ["-y", "-i", inputPath, "-vf", "select=eq(n\\,0)", "-frames:v", "1", "-q:v", "2", outputPath],
        { timeout: 30000 }
      );
    }
    if (!fs.existsSync(outputPath)) return undefined;
    const jpeg = fs.readFileSync(outputPath);
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch (err) {
    console.warn("[video adapter] ffmpeg last-frame extract notice:", err);
    return undefined;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

async function finalizeClip(params: {
  videoUrl: string;
  brandId: string;
  productionId: string;
  filename?: string;
}): Promise<{
  videoUrl: string;
  publicUrl: string;
  storagePath: string;
  lastFrameDataUrl?: string;
}> {
  const buffer = await downloadVideoRetry(params.videoUrl);
  const lastFrameDataUrl = await extractLastFrameJpeg(buffer);
  const persisted = await persistVideoBuffer({
    buffer,
    brandId: params.brandId,
    productionId: params.productionId,
    filename: params.filename || `clip-${Date.now()}.mp4`,
  });
  return {
    videoUrl: persisted.publicUrl || persisted.videoUrl,
    publicUrl: persisted.publicUrl,
    storagePath: persisted.storagePath,
    lastFrameDataUrl,
  };
}

async function generateSeedance(req: VideoClipRequest): Promise<{ videoUrl: string; requestId?: string }> {
  const apiKey = process.env.ARK_API_KEY || process.env.SEEDANCE_API_KEY || process.env.VITE_ARK_API_KEY || process.env.VITE_SEEDANCE_API_KEY;
  if (!apiKey) throw new Error("Seedance/Ark API key not configured (ARK_API_KEY or SEEDANCE_API_KEY).");
  const base = (process.env.ARK_BASE_URL || process.env.SEEDANCE_BASE_URL || "https://ark.cn-beijing.volces.com").replace(/\/$/, "");
  const body = buildSeedanceTaskBody({ ...req, model: req.model || SEEDANCE_MODEL_15_PRO });

  const hasImage = Boolean(req.firstFrameUrl || req.firstFrameDataUri);
  const hasSheet = Boolean(req.characterSheetUrl || (req.referenceImageUrls && req.referenceImageUrls.length > 0));
  const hasLastFrame = Boolean(req.lastFrameUrl || req.lastFrameDataUri);
  console.log(
    `[Seedance Video] provider=seedance hasImage=${hasImage} hasSheet=${hasSheet} hasLastFrame=${hasLastFrame} duration=${req.durationSec || 5} aspect=${req.aspectRatio || "9:16"}`
  );

  const createRes = await fetch(`${base}/api/v3/contents/generations/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Seedance create task failed (${createRes.status}): ${errText.slice(0, 400)}`);
  }
  const created = await createRes.json();
  const taskId = created.id || created.task_id || created.data?.id;
  if (!taskId) throw new Error(`Seedance create task returned no id: ${JSON.stringify(created).slice(0, 300)}`);

  const arkRefsCount = Array.isArray(body.content)
    ? (body.content as any[]).filter((c) => c.role === "reference_image").length
    : 0;
  console.log(
    `[I2V CONTRACT] provider=seedance mode=i2v refs_sent=${arkRefsCount} fields=model,content,ratio,duration,resolution,generate_audio`
  );
  console.log(
    `[I2V BILLABLE] provider=seedance model=${req.model || SEEDANCE_MODEL_15_PRO} durationSec=${req.durationSec || 5} scene=${req.shotIndex ?? "unknown"} subclipIndex=${req.subclipIndex ?? 1} request_id=${taskId}`
  );

  const started = Date.now();
  let lastStatus = "";
  while (Date.now() - started < SEEDANCE_POLL_TIMEOUT_MS) {
    await sleep(SEEDANCE_POLL_INTERVAL_MS);
    const pollRes = await fetch(`${base}/api/v3/contents/generations/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!pollRes.ok) {
      console.warn(`[Seedance] poll ${pollRes.status}`);
      continue;
    }
    const data = await pollRes.json();
    lastStatus = String(data.status || data.state || "").toLowerCase();
    if (lastStatus === "succeeded" || lastStatus === "success") {
      const videoUrl = extractSeedanceVideoUrl(data);
      if (!videoUrl) throw new Error("Seedance succeeded but content.video_url was empty.");
      return { videoUrl, requestId: taskId };
    }
    if (lastStatus === "failed" || lastStatus === "error" || lastStatus === "cancelled") {
      throw new Error(`Seedance task ${lastStatus}: ${JSON.stringify(data.error || data.message || data)}`);
    }
  }
  throw new Error(`Seedance poll timed out after ${Math.round(SEEDANCE_POLL_TIMEOUT_MS / 60000)} min (last status: ${lastStatus || "unknown"}). Task ${taskId} was not recreated.`);
}

async function generateKling(req: VideoClipRequest): Promise<{ videoUrl: string; requestId?: string }> {
  const keys = resolveKlingKeys();
  if (!keys) {
    throw new Error("Kling JWT keys not configured (KLING_ACCESS_KEY + KLING_SECRET_KEY). Static Bearer is not supported.");
  }
  const body = buildKlingImage2VideoBody({ ...req, model: req.model || KLING_DEFAULT_MODEL });
  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getKlingJwt(keys.accessKey, keys.secretKey)}`,
  });

  const hasImage = Boolean(req.firstFrameUrl || req.firstFrameDataUri);
  const hasSheet = Boolean(req.characterSheetUrl || (req.referenceImageUrls && req.referenceImageUrls.length > 0));
  const hasLastFrame = Boolean(req.lastFrameUrl || req.lastFrameDataUri);
  console.log(
    `[Kling Video] provider=kling hasImage=${hasImage} hasSheet=${hasSheet} hasLastFrame=${hasLastFrame} duration=${req.durationSec || 5} aspect=${req.aspectRatio || "9:16"}`
  );

  const createRes = await fetch("https://api.klingai.com/v1/videos/image2video", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Kling image2video failed (${createRes.status}): ${errText.slice(0, 400)}`);
  }
  const created = await createRes.json();
  if (created.code && Number(created.code) !== 0) {
    throw new Error(`Kling image2video error: ${created.message || JSON.stringify(created).slice(0, 300)}`);
  }
  const taskId = extractKlingTaskId(created);
  if (!taskId) throw new Error(`Kling image2video returned no task_id: ${JSON.stringify(created).slice(0, 300)}`);

  const klingRefsCount = Array.isArray(body.image_list) ? body.image_list.length : 0;
  const klingFields = `model_name,mode,duration,aspect_ratio,sound,prompt${body.image ? ",image" : ""}${body.image_tail ? ",image_tail" : ""}${klingRefsCount > 0 ? ",image_list" : ""}`;
  console.log(
    `[I2V CONTRACT] provider=kling mode=i2v refs_sent=${klingRefsCount} fields=${klingFields}`
  );
  console.log(
    `[I2V BILLABLE] provider=kling model=${req.model || KLING_DEFAULT_MODEL} durationSec=${req.durationSec || 5} scene=${req.shotIndex ?? "unknown"} subclipIndex=${req.subclipIndex ?? 1} request_id=${taskId}`
  );

  const started = Date.now();
  let lastStatus = "";
  while (Date.now() - started < KLING_POLL_TIMEOUT_MS) {
    await sleep(KLING_POLL_INTERVAL_MS);
    const pollRes = await fetch(`https://api.klingai.com/v1/videos/image2video/${taskId}`, {
      headers: authHeaders(),
    });
    if (!pollRes.ok) {
      console.warn(`[Kling] poll ${pollRes.status}`);
      continue;
    }
    const data = await pollRes.json();
    lastStatus = klingTaskStatus(data);
    if (lastStatus === "succeed" || lastStatus === "succeeded" || lastStatus === "success") {
      const videoUrl = extractKlingVideoUrl(data);
      if (!videoUrl) throw new Error("Kling succeeded but task_result.videos[0].url was empty.");
      return { videoUrl, requestId: taskId };
    }
    if (lastStatus === "failed" || lastStatus === "fail" || lastStatus === "error") {
      throw new Error(`Kling task failed: ${JSON.stringify(data.data || data)}`);
    }
  }
  throw new Error(`Kling poll timed out after ${Math.round(KLING_POLL_TIMEOUT_MS / 60000)} min (last status: ${lastStatus || "unknown"}).`);
}

async function generateGrok(req: VideoClipRequest): Promise<{ videoUrl: string; requestId?: string }> {
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY || process.env.VITE_XAI_API_KEY || process.env.VITE_GROK_API_KEY;
  if (!apiKey) throw new Error("xAI Grok API key not configured (XAI_API_KEY or GROK_API_KEY).");
  // Still URL policy: Prefer durable HTTPS URL for image.imageUrl.
  // If first frame is only data: URI, upload to public Spark path first if possible, then pass HTTPS;
  // otherwise pass data URI directly in imageUrl — never send empty image.
  let effectiveReq = { ...req, model: req.model || GROK_VIDEO_MODEL };
  if (
    (!effectiveReq.firstFrameUrl || !effectiveReq.firstFrameUrl.startsWith("http")) &&
    effectiveReq.firstFrameDataUri?.startsWith("data:")
  ) {
    try {
      const { persistBufferToSpark, sparkBrandMediaPath } = await import("./_sparkStorage.js");
      const match = effectiveReq.firstFrameDataUri.match(/^data:([^;]+);base64,(.*)$/s);
      const mime = match ? match[1] : "image/jpeg";
      const b64 = (match ? match[2] : effectiveReq.firstFrameDataUri.split(",")[1] || "").replace(/\s/g, "");
      if (b64) {
        const buf = Buffer.from(b64, "base64");
        const ext = mime.includes("png") ? "png" : "jpg";
        const storagePath = sparkBrandMediaPath("default-brand", "default-prod", `keyframes/still-${Date.now()}.${ext}`);
        const persisted = await persistBufferToSpark({
          buffer: buf,
          storagePath,
          contentType: mime,
        });
        if (persisted?.publicUrl) {
          effectiveReq.firstFrameUrl = persisted.publicUrl;
        }
      }
    } catch (uploadErr) {
      console.warn("[Grok Video] Pre-upload of data URI to Spark Storage notice:", uploadErr);
    }
  }

  const body = buildGrokVideoGenerateBody(effectiveReq);

  // Log after each submit: provider, hasImage, hasSheet, hasLastFrame, duration, aspect
  const imageUrl = (body.image as any)?.url || (body.image as any)?.imageUrl || (body as any).imageUrl || (body as any).image_url;
  const hasImage = Boolean(imageUrl && typeof imageUrl === "string" && imageUrl.trim().length > 0);
  const hasSheet = Boolean(Array.isArray(body.reference_images) && body.reference_images.length > 0);
  const hasLastFrame = Boolean(body.last_frame && (body.last_frame as any).url);
  console.log(
    `[Grok Video] provider=grok hasImage=${hasImage} hasSheet=${hasSheet} hasLastFrame=${hasLastFrame} duration=${body.duration} aspect=${body.aspect_ratio}`
  );
  if (!hasImage) {
    throw new Error("Refusing to generate Grok video with numInputImages=0 (T2V forbidden for shot i2v).");
  }

  const res = await fetch("https://api.x.ai/v1/videos/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Grok video.generate failed (${res.status}): ${errText.slice(0, 400)}`);
  }
  const data = await res.json();
  const immediate = extractGrokVideoUrl(data);
  const requestId = data.request_id || data.id || data.requestId || "";

  const grokRefsCount = Array.isArray(body.reference_images) ? body.reference_images.length : 0;
  const grokFields = `image,prompt,duration,aspect_ratio,resolution${body.last_frame ? ",last_frame" : ""}${grokRefsCount > 0 ? ",reference_images" : ""}`;
  console.log(
    `[I2V CONTRACT] provider=grok mode=i2v refs_sent=${grokRefsCount} fields=${grokFields}`
  );
  console.log(
    `[I2V BILLABLE] provider=grok model=${effectiveReq.model || GROK_VIDEO_MODEL} durationSec=${body.duration || effectiveReq.durationSec || 5} scene=${effectiveReq.shotIndex ?? "unknown"} subclipIndex=${effectiveReq.subclipIndex ?? 1} request_id=${requestId || "immediate"}`
  );
  if (immediate) return { videoUrl: immediate, requestId: requestId || undefined };

  // Async: response { request_id } → GET /v1/videos/{request_id} until status "done" → video.url
  if (!requestId) {
    throw new Error("Grok video.generate returned neither video URL nor request id.");
  }
  const started = Date.now();
  // Cap under config.maxDuration (300s) so the serverless function can return a real error
  // instead of being killed mid-poll with an opaque platform timeout.
  while (Date.now() - started < GROK_IN_PROCESS_POLL_MS) {
    await sleep(8000);
    const pollRes = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();
    const url = extractGrokVideoUrl(pollData);
    const status = String(pollData.status || "").toLowerCase();
    if (url && (status === "done" || status === "completed" || status === "succeeded" || status === "success" || !status)) {
      return { videoUrl: url, requestId };
    }
    if (status === "failed" || status === "error") {
      const errMsg = pollData.error?.message || (typeof pollData.error === "string" ? pollData.error : JSON.stringify(pollData.error)) || "unknown";
      throw new Error(`Grok video generation failed: ${errMsg}`);
    }
  }
  throw new Error("Grok video.generate timed out in-process (no resume).");
}

async function generateHiggsfield(req: VideoClipRequest): Promise<{ videoUrl: string; requestId?: string }> {
  const creds = resolveHiggsfieldCredentials();
  if (!creds) {
    throw new Error(
      "Higgsfield credentials not configured. Set HIGGSFIELD_API_KEY (in key_id:key_secret form) or HF_API_KEY_ID + HF_API_KEY_SECRET."
    );
  }

  let effectiveReq = { ...req };
  let lastRequestId: string | undefined;

  if (effectiveReq.firstFrameUrl && effectiveReq.firstFrameUrl.startsWith("asset://")) {
    throw new Error("Higgsfield Seedance I2V does not support asset:// URI scheme. A public HTTPS image_url is required.");
  }

  const { looksLikeSheetOrGridUrl } = await import("./_videoContract.js");
  if (effectiveReq.firstFrameUrl && looksLikeSheetOrGridUrl(effectiveReq.firstFrameUrl)) {
    throw new Error("Higgsfield Seedance I2V requires this shot's still, not a storyboard grid or sheet.");
  }

  const uploadDataUri = async (dataUri: string, prefix: string): Promise<string | null> => {
    try {
      const match = dataUri.match(/^data:([^;]+);base64,(.*)$/s);
      const mime = match ? match[1] : "image/jpeg";
      const b64 = (match ? match[2] : dataUri.split(",")[1] || "").replace(/\s/g, "");
      if (!b64) return null;
      const buf = Buffer.from(b64, "base64");

      // Try official Higgsfield file upload first
      try {
        const { uploadHiggsfieldFile } = await import("./_higgsfieldClient.js");
        const hfPublicUrl = await uploadHiggsfieldFile(buf, mime);
        if (hfPublicUrl && hfPublicUrl.startsWith("http")) {
          return hfPublicUrl;
        }
      } catch (hfErr) {
        console.warn(`[Higgsfield Video] Pre-upload via HF files notice:`, hfErr);
      }

      const { persistBufferToSpark, sparkBrandMediaPath } = await import("./_sparkStorage.js");
      const ext = mime.includes("png") ? "png" : "jpg";
      const storagePath = sparkBrandMediaPath(
        req.brandId || "default-brand",
        req.productionId || "default-prod",
        `keyframes/${prefix}-${Date.now()}.${ext}`
      );
      const persisted = await persistBufferToSpark({
        buffer: buf,
        storagePath,
        contentType: mime,
      });
      return persisted?.publicUrl || null;
    } catch (uploadErr) {
      console.warn(`[Higgsfield Video] Pre-upload of ${prefix} data URI to Spark Storage notice:`, uploadErr);
      return null;
    }
  };

  const candidateRefs = [
    ...(effectiveReq.characterSheetUrl ? [effectiveReq.characterSheetUrl] : []),
    ...(effectiveReq.referenceImageUrls || []),
    ...(effectiveReq.referenceUrls || []),
    ...(effectiveReq.imageUrls || []),
  ].filter((u): u is string => typeof u === "string" && u.trim().length > 0);

  const isExplicitR2v =
    effectiveReq.mode === "reference-to-video" ||
    effectiveReq.mode === "reference_to_video" ||
    effectiveReq.mode === "r2v" ||
    (effectiveReq as any).generationMode === "reference_to_video" ||
    effectiveReq.model?.toLowerCase().includes("r2v") ||
    effectiveReq.model?.toLowerCase().includes("reference-to-video");

  const shouldUseR2v = candidateRefs.length > 0 && isExplicitR2v;

  if (shouldUseR2v) {
    const { looksLikeStoryboardGridUrl } = await import("./_videoContract.js");
    const rawRefs = [
      ...(effectiveReq.firstFrameUrl ? [effectiveReq.firstFrameUrl] : []),
      ...candidateRefs,
    ];

    const seen = new Set<string>();
    const cleanRefs: string[] = [];
    for (const ref of rawRefs) {
      if (!ref || typeof ref !== "string") continue;
      if (looksLikeStoryboardGridUrl(ref)) continue;
      if (ref.startsWith("http")) {
        if (!seen.has(ref)) {
          seen.add(ref);
          cleanRefs.push(ref);
        }
      } else if (ref.startsWith("data:")) {
        const uploaded = await uploadDataUri(ref, "r2v-ref");
        if (uploaded && !seen.has(uploaded)) {
          seen.add(uploaded);
          cleanRefs.push(uploaded);
        }
      }
    }

    if (cleanRefs.length === 0) {
      throw new Error(
        "Higgsfield Seedance R2V requires at least 1 public HTTPS reference image (storyboard grids not allowed)."
      );
    }

    console.log(
      `[I2V CONTRACT] provider=higgsfield mode=r2v refs_sent=${cleanRefs.length} fields=image_urls,aspect_ratio,duration,resolution,generate_audio`
    );

    const videoUrl = await generateSeedanceReferenceVideo({
      prompt: effectiveReq.prompt,
      imageUrls: cleanRefs,
      aspectRatio: effectiveReq.aspectRatio || "9:16",
      durationSec: effectiveReq.durationSec,
      resolution: effectiveReq.resolution,
      model: effectiveReq.model,
      generateAudio: effectiveReq.generateAudio,
      videoUrls: effectiveReq.videoUrls,
      audioUrls: effectiveReq.audioUrls,
      shotIndex: effectiveReq.shotIndex,
      subclipIndex: effectiveReq.subclipIndex,
      onSubmit: (id) => {
        lastRequestId = id;
      },
    });
    return { videoUrl, requestId: lastRequestId };
  }

  if (!effectiveReq.firstFrameUrl || !effectiveReq.firstFrameUrl.startsWith("http")) {
    const rawDataUri =
      effectiveReq.firstFrameDataUri ||
      (effectiveReq.firstFrameUrl?.startsWith("data:") ? effectiveReq.firstFrameUrl : "");
    if (rawDataUri) {
      const uploaded = await uploadDataUri(rawDataUri, "still");
      if (uploaded) effectiveReq.firstFrameUrl = uploaded;
    }
  }

  if (effectiveReq.lastFrameUrl && !effectiveReq.lastFrameUrl.startsWith("http")) {
    const rawLastUri =
      effectiveReq.lastFrameDataUri ||
      (effectiveReq.lastFrameUrl?.startsWith("data:") ? effectiveReq.lastFrameUrl : "");
    if (rawLastUri) {
      const uploaded = await uploadDataUri(rawLastUri, "end");
      if (uploaded) {
        effectiveReq.lastFrameUrl = uploaded;
      } else {
        effectiveReq.lastFrameUrl = undefined;
      }
    } else {
      effectiveReq.lastFrameUrl = undefined;
    }
  }

  if (!effectiveReq.firstFrameUrl || !effectiveReq.firstFrameUrl.startsWith("http")) {
    throw new Error("Higgsfield Seedance I2V requires a public HTTPS firstFrameUrl (data URI upload failed or missing).");
  }

  const i2vFields = `image_url${effectiveReq.lastFrameUrl ? ",end_image_url" : ""},duration,resolution,generate_audio`;
  console.log(
    `[I2V CONTRACT] provider=higgsfield mode=i2v refs_sent=0 fields=${i2vFields}`
  );

  const videoUrl = await generateSeedanceVideo({
    prompt: effectiveReq.prompt,
    firstFrameUrl: effectiveReq.firstFrameUrl,
    endFrameUrl: effectiveReq.lastFrameUrl,
    durationSec: effectiveReq.durationSec,
    resolution: effectiveReq.resolution,
    model: effectiveReq.model,
    generateAudio: effectiveReq.generateAudio,
    shotIndex: effectiveReq.shotIndex,
    subclipIndex: effectiveReq.subclipIndex,
    onSubmit: (id) => {
      lastRequestId = id;
    },
  });
  return { videoUrl, requestId: lastRequestId };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireRuntimeUser(req, res))) return;
  if (isIngestMediaRequest(req)) {
    return handleIngestMedia(req, res);
  }

  if (isYoutubeCaptionsRequest(req)) {
    return handleYoutubeCaptions(req, res);
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const {
      provider,
      prompt,
      imageUrl,
      aspectRatio,
      model,
      action,
      productionId,
      brandId = "default-brand",
      videoUrls,
      audioUrl,
    } = body;

    // 0. Serverless FFmpeg merge (concat Spark shot-N.mp4 → video/master.mp4)
    if (
      provider === "mux" ||
      action === "mux" ||
      action === "merge" ||
      (Array.isArray(videoUrls) && !provider)
    ) {
      const validUrls = collectSparkShotClipUrls(
        (videoUrls || []).filter((u: any) => typeof u === "string")
      );
      if (validUrls.length === 0) {
        return res.status(200).json({
          success: false,
          error: "NO_DURABLE_SHOT_CLIPS",
          message:
            "No Spark storage shot-N.mp4 clips to merge. Approve & merge needs brands/{brandId}/{productionId}/video/shot-N.mp4.",
        });
      }

      let ffmpegPath = "ffmpeg";
      try {
        await execFileAsync(ffmpegPath, ["-version"]);
      } catch {
        return res.status(200).json({
          success: false,
          ffmpegAvailable: false,
          error: "FFMPEG_UNAVAILABLE",
          message:
            "ffmpeg is not available on this serverless image. Cannot write brands/{brandId}/{productionId}/video/master.mp4.",
        });
      }

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "spark-mux-"));
      const downloadedFiles: string[] = [];

      try {
        for (let i = 0; i < validUrls.length; i++) {
          const vidUrl = validUrls[i];
          const vResp = await fetch(vidUrl);
          if (!vResp.ok) throw new Error(`Failed to fetch scene ${i + 1} video from ${vidUrl}: status ${vResp.status}`);
          const arrayBuffer = await vResp.arrayBuffer();
          const filePath = path.join(tmpDir, `input_${i}.mp4`);
          fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
          downloadedFiles.push(filePath);
        }

        let audioFilePath: string | undefined;
        if (audioUrl && typeof audioUrl === "string" && audioUrl.trim().startsWith("http")) {
          try {
            const aResp = await fetch(audioUrl);
            if (aResp.ok) {
              const aBuf = await aResp.arrayBuffer();
              audioFilePath = path.join(tmpDir, "audio.mp3");
              fs.writeFileSync(audioFilePath, Buffer.from(aBuf));
            }
          } catch (aErr) {
            console.warn("[ServerlessMux] Audio download notice:", aErr);
          }
        }

        const concatListPath = path.join(tmpDir, "concat_list.txt");
        const fileListContent = downloadedFiles.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n");
        fs.writeFileSync(concatListPath, fileListContent, "utf-8");

        // Probe downloaded scene clips to check for native audio streams (e.g. dialogue/sound)
        let hasInputAudio = false;
        for (const file of downloadedFiles) {
          try {
            await execFileAsync(ffmpegPath, ["-i", file]);
          } catch (probeErr: any) {
            const stderr = probeErr?.stderr || "";
            if (/Audio:/i.test(stderr)) {
              hasInputAudio = true;
              break;
            }
          }
        }

        const outputFilePath = path.join(tmpDir, "output.mp4");
        const ffmpegArgs: string[] = ["-y", "-f", "concat", "-safe", "0", "-i", concatListPath];

        if (audioFilePath && fs.existsSync(audioFilePath)) {
          if (hasInputAudio) {
            // Mix native clip audio with external VO narration so neither is lost
            ffmpegArgs.push(
              "-i",
              audioFilePath,
              "-filter_complex",
              "[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2[aout]",
              "-c:v",
              "libx264",
              "-pix_fmt",
              "yuv420p",
              "-preset",
              "fast",
              "-crf",
              "22",
              "-c:a",
              "aac",
              "-b:a",
              "192k",
              "-map",
              "0:v:0",
              "-map",
              "[aout]",
              "-shortest",
              "-movflags",
              "+faststart",
              outputFilePath
            );
          } else {
            // Clips are silent; map external audio directly
            ffmpegArgs.push(
              "-i",
              audioFilePath,
              "-c:v",
              "libx264",
              "-pix_fmt",
              "yuv420p",
              "-preset",
              "fast",
              "-crf",
              "22",
              "-c:a",
              "aac",
              "-b:a",
              "192k",
              "-map",
              "0:v:0",
              "-map",
              "1:a:0",
              "-shortest",
              "-movflags",
              "+faststart",
              outputFilePath
            );
          }
        } else {
          // No external VO: preserve native audio if present, otherwise encode video only
          ffmpegArgs.push(
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-preset",
            "fast",
            "-crf",
            "22"
          );
          if (hasInputAudio) {
            ffmpegArgs.push(
              "-c:a",
              "aac",
              "-b:a",
              "192k",
              "-map",
              "0:v:0",
              "-map",
              "0:a:0?"
            );
          } else {
            ffmpegArgs.push("-map", "0:v:0");
          }
          ffmpegArgs.push("-movflags", "+faststart", outputFilePath);
        }

        await execFileAsync(ffmpegPath, ffmpegArgs, { timeout: 120000 });

        if (!fs.existsSync(outputFilePath)) {
          throw new Error("FFmpeg failed to produce output.mp4");
        }

        const outputBuffer = fs.readFileSync(outputFilePath);
        const persisted = await persistVideoBuffer({
          buffer: outputBuffer,
          brandId,
          productionId: productionId || "default-prod",
          filename: "master.mp4",
        });

        return res.status(200).json({
          success: true,
          storagePath: persisted.storagePath,
          publicUrl: persisted.publicUrl,
          videoUrl: persisted.publicUrl || persisted.videoUrl,
          provider: "ServerlessFFmpeg",
        });
      } catch (err: any) {
        console.error("[ServerlessMux] Execution error:", err);
        return res.status(200).json({
          success: false,
          error: err?.message || String(err),
          message: `Server ffmpeg merge failed: ${err?.message || String(err)}`,
        });
      } finally {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {}
      }
    }

    // Fail-closed video capability assertion: ensure provider & model are executable
    try {
      assertVideoRequestExecutable(body);
    } catch (valErr: any) {
      return res.status(400).json({
        error: valErr?.message || String(valErr),
        videoUrl: null,
      });
    }

    const keys = {
      runway: process.env.RUNWAY_API_KEY,
      luma: process.env.LUMA_API_KEY,
      pika: process.env.PIKA_API_KEY,
      seedance: process.env.SEEDANCE_API_KEY || process.env.ARK_API_KEY,
      higgsfield: Boolean(resolveHiggsfieldCredentials()),
      wan: process.env.WAN_API_KEY,
      veo: process.env.VEO_API_KEY || process.env.GOOGLE_AI_API_KEY,
      grok: process.env.XAI_API_KEY || process.env.GROK_API_KEY,
    };

    const i2vProviders = ["seedance", "ark", "kling", "grok", "xai", "higgsfield", "higgsfield-seedance"];
    if (i2vProviders.includes(String(provider || "").toLowerCase())) {
      const clipReq = await buildClipRequest(body);
      if (!clipReq.firstFrameDataUri) {
        return res.status(400).json({
          error: "I2V requires a first-frame still (imageUrl / firstFrameUrl / previous last frame).",
          videoUrl: null,
        });
      }

      let providerVideoUrl = "";
      let providerRequestId: string | undefined;
      const p = String(provider).toLowerCase();
      if (p === "seedance" || p === "ark") {
        const genRes = await generateSeedance(clipReq);
        providerVideoUrl = genRes.videoUrl;
        providerRequestId = genRes.requestId;
      } else if (p === "kling") {
        const genRes = await generateKling(clipReq);
        providerVideoUrl = genRes.videoUrl;
        providerRequestId = genRes.requestId;
      } else if (p === "higgsfield" || p === "higgsfield-seedance") {
        const genRes = await generateHiggsfield(clipReq);
        providerVideoUrl = genRes.videoUrl;
        providerRequestId = genRes.requestId;
      } else {
        const genRes = await generateGrok(clipReq);
        providerVideoUrl = genRes.videoUrl;
        providerRequestId = genRes.requestId;
      }

      const shotIndex = Number(body.shotIndex || body.sceneIndex || body.shot);
      const clipFilename =
        Number.isFinite(shotIndex) && shotIndex > 0
          ? `shot-${Math.round(shotIndex)}.mp4`
          : `shot-${Date.now()}.mp4`;
      const finalized = await finalizeClip({
        videoUrl: providerVideoUrl,
        brandId,
        productionId: productionId || "default-prod",
        filename: clipFilename,
      });

      return res.status(200).json({
        success: true,
        storagePath: finalized.storagePath,
        publicUrl: finalized.publicUrl,
        videoUrl: finalized.publicUrl || finalized.videoUrl,
        lastFrameDataUrl: finalized.lastFrameDataUrl,
        provider,
        requestId: providerRequestId || undefined,
        costUsd: p === "kling" ? 0.2 : p === "seedance" || p === "ark" ? 0.18 : 0.15,
      });
    }

    // Runway Gen-3 Alpha
    if (provider === "runway" && keys.runway) {
      const response = await fetch("https://api.runwayml.com/v1/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${keys.runway}`,
        },
        body: JSON.stringify({
          taskType: "image_to_video",
          prompt,
          image: imageUrl,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const taskId = data.id;
        const videoUrl = await pollGenericUrl(`https://api.runwayml.com/v1/tasks/${taskId}`, {
          Authorization: `Bearer ${keys.runway}`,
        });
        const finalized = await finalizeClip({
          videoUrl,
          brandId,
          productionId: productionId || "default-prod",
        });
        return res.status(200).json({
          success: true,
          storagePath: finalized.storagePath,
          publicUrl: finalized.publicUrl,
          videoUrl: finalized.publicUrl || finalized.videoUrl,
          lastFrameDataUrl: finalized.lastFrameDataUrl,
          costUsd: 0.25,
        });
      }
      const errText = await response.text();
      throw new Error(`Runway error: ${errText}`);
    }

    // Luma Dream Machine
    if (provider === "luma" && keys.luma) {
      const response = await fetch("https://api.lumalabs.ai/v1/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${keys.luma}`,
        },
        body: JSON.stringify({
          prompt,
          aspect_ratio: aspectRatio || "9:16",
          image_url: imageUrl,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const taskId = data.id;
        const videoUrl = await pollGenericUrl(`https://api.lumalabs.ai/v1/generations/${taskId}`, {
          Authorization: `Bearer ${keys.luma}`,
        });
        const finalized = await finalizeClip({
          videoUrl,
          brandId,
          productionId: productionId || "default-prod",
        });
        return res.status(200).json({
          success: true,
          storagePath: finalized.storagePath,
          publicUrl: finalized.publicUrl,
          videoUrl: finalized.publicUrl || finalized.videoUrl,
          lastFrameDataUrl: finalized.lastFrameDataUrl,
          costUsd: 0.22,
        });
      }
      const errText = await response.text();
      throw new Error(`Luma error: ${errText}`);
    }

    // Wan2.1 (via Fal.ai or direct)
    if (provider === "wan" && keys.wan) {
      const response = await fetch("https://queue.fal.run/fal-ai/wan/vid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${keys.wan}`,
        },
        body: JSON.stringify({
          prompt,
          image_url: imageUrl,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const requestId = data.request_id;
        const videoUrl = await pollGenericUrl(`https://queue.fal.run/fal-ai/wan/vid/requests/${requestId}`, {
          Authorization: `Key ${keys.wan}`,
        });
        const finalized = await finalizeClip({
          videoUrl,
          brandId,
          productionId: productionId || "default-prod",
        });
        return res.status(200).json({
          success: true,
          storagePath: finalized.storagePath,
          publicUrl: finalized.publicUrl,
          videoUrl: finalized.publicUrl || finalized.videoUrl,
          lastFrameDataUrl: finalized.lastFrameDataUrl,
          costUsd: 0.12,
        });
      }
      const errText = await response.text();
      throw new Error(`Wan Fal.ai error: ${errText}`);
    }

    if (provider === "veo" || provider === "gemini") {
      return res.status(422).json({
        error: "Veo/Gemini video runs through the production orchestrator, not this adapter.",
        videoUrl: null,
      });
    }

    return res.status(422).json({
      error: `No API key configured for provider "${provider || "unknown"}". Add the required key in Vercel environment variables.`,
      videoUrl: null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
