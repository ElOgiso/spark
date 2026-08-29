import type { VercelRequest, VercelResponse } from "@vercel/node";
import { execFile } from "child_process";
import { promisify } from "util";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";
import { createClient } from "@supabase/supabase-js";
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
} from "./videoContract";

const execFileAsync = promisify(execFile);

export const config = {
  maxDuration: 800,
};

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
    try {
      const uri = await toDataUri(url);
      if (uri) referenceDataUris.push(uri);
    } catch (err) {
      console.warn("[video adapter] reference image fetch notice:", err);
    }
  }
  return {
    prompt: body.prompt || "",
    firstFrameDataUri,
    lastFrameDataUri,
    referenceDataUris,
    aspectRatio: body.aspectRatio || body.aspect_ratio,
    durationSec: typeof body.durationSec === "number" ? body.durationSec : Number(body.duration) || undefined,
    resolution: body.resolution,
    model: body.model,
    generateAudio: body.generateAudio !== false && body.generate_audio !== false,
    klingMode: body.mode === "pro" || body.mode === "std" ? body.mode : undefined,
    klingSound: body.sound === "off" ? "off" : "on",
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

function createSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_URL / VITE_SUPABASE_SERVICE_ROLE_KEY)."
    );
  }
  return createClient(supabaseUrl, supabaseKey);
}

async function persistVideoBuffer(params: {
  buffer: Buffer;
  brandId: string;
  productionId: string;
  filename?: string;
  contentType?: string;
}): Promise<string> {
  const supabase = createSupabase();
  const SPARK_BUCKET = "Spark";
  const storagePath = `brands/${params.brandId}/${params.productionId}/video/${params.filename || "clip.mp4"}`;
  const { error: uploadError } = await supabase.storage.from(SPARK_BUCKET).upload(storagePath, params.buffer, {
    contentType: params.contentType || "video/mp4",
    upsert: true,
  });
  if (uploadError) {
    const { error: fallbackError } = await supabase.storage.from("media").upload(storagePath, params.buffer, {
      contentType: params.contentType || "video/mp4",
      upsert: true,
    });
    if (fallbackError) {
      throw new Error(`Storage upload failed: ${uploadError.message} / ${fallbackError.message}`);
    }
  }
  const { data: signData } = await supabase.storage.from(SPARK_BUCKET).createSignedUrl(storagePath, 60 * 60 * 24 * 7);
  if (signData?.signedUrl) return signData.signedUrl;
  const { data: publicData } = supabase.storage.from(SPARK_BUCKET).getPublicUrl(storagePath);
  return publicData?.publicUrl || "";
}

async function finalizeClip(params: {
  videoUrl: string;
  brandId: string;
  productionId: string;
  persist?: boolean;
}): Promise<{ videoUrl: string; lastFrameDataUrl?: string; persistedUrl?: string }> {
  let buffer: Buffer | undefined;
  try {
    buffer = await downloadVideoRetry(params.videoUrl);
  } catch (err) {
    console.warn("[video adapter] clip download notice (returning provider URL):", err);
    return { videoUrl: params.videoUrl };
  }
  const lastFrameDataUrl = await extractLastFrameJpeg(buffer);
  let persistedUrl: string | undefined;
  if (params.persist !== false && params.productionId) {
    try {
      persistedUrl = await persistVideoBuffer({
        buffer,
        brandId: params.brandId,
        productionId: params.productionId,
        filename: `clip-${Date.now()}.mp4`,
      });
    } catch (err) {
      console.warn("[video adapter] persist notice:", err);
    }
  }
  return {
    videoUrl: persistedUrl || params.videoUrl,
    lastFrameDataUrl,
    persistedUrl,
  };
}

async function generateSeedance(req: VideoClipRequest): Promise<string> {
  const apiKey = process.env.ARK_API_KEY || process.env.SEEDANCE_API_KEY || process.env.VITE_ARK_API_KEY || process.env.VITE_SEEDANCE_API_KEY;
  if (!apiKey) throw new Error("Seedance/Ark API key not configured (ARK_API_KEY or SEEDANCE_API_KEY).");
  const base = (process.env.ARK_BASE_URL || process.env.SEEDANCE_BASE_URL || "https://ark.cn-beijing.volces.com").replace(/\/$/, "");
  const body = buildSeedanceTaskBody({ ...req, model: req.model || SEEDANCE_MODEL_15_PRO });

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
      return videoUrl;
    }
    if (lastStatus === "failed" || lastStatus === "error" || lastStatus === "cancelled") {
      throw new Error(`Seedance task ${lastStatus}: ${JSON.stringify(data.error || data.message || data)}`);
    }
  }
  throw new Error(`Seedance poll timed out after ${Math.round(SEEDANCE_POLL_TIMEOUT_MS / 60000)} min (last status: ${lastStatus || "unknown"}). Task ${taskId} was not recreated.`);
}

async function generateKling(req: VideoClipRequest): Promise<string> {
  const keys = resolveKlingKeys();
  if (!keys) {
    throw new Error("Kling JWT keys not configured (KLING_ACCESS_KEY + KLING_SECRET_KEY). Static Bearer is not supported.");
  }
  const body = buildKlingImage2VideoBody({ ...req, model: req.model || KLING_DEFAULT_MODEL });
  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getKlingJwt(keys.accessKey, keys.secretKey)}`,
  });

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
      return videoUrl;
    }
    if (lastStatus === "failed" || lastStatus === "fail" || lastStatus === "error") {
      throw new Error(`Kling task failed: ${JSON.stringify(data.data || data)}`);
    }
  }
  throw new Error(`Kling poll timed out after ${Math.round(KLING_POLL_TIMEOUT_MS / 60000)} min (last status: ${lastStatus || "unknown"}).`);
}

async function generateGrok(req: VideoClipRequest): Promise<string> {
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY || process.env.VITE_XAI_API_KEY || process.env.VITE_GROK_API_KEY;
  if (!apiKey) throw new Error("xAI Grok API key not configured (XAI_API_KEY or GROK_API_KEY).");
  const body = buildGrokVideoGenerateBody({ ...req, model: req.model || GROK_VIDEO_MODEL });

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
  if (immediate) return immediate;

  // Sync SDK has no resume. If the provider still returns an id, wait in-process only.
  const requestId = data.id || data.request_id || "";
  if (!requestId) {
    throw new Error("Grok video.generate returned neither video URL nor request id.");
  }
  const started = Date.now();
  while (Date.now() - started < 6 * 60 * 1000) {
    await sleep(8000);
    const pollRes = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();
    const url = extractGrokVideoUrl(pollData);
    if (url) return url;
    const status = String(pollData.status || "").toLowerCase();
    if (status === "failed" || status === "error") {
      throw new Error(`Grok video generation failed: ${pollData.error || "unknown"}`);
    }
  }
  throw new Error("Grok video.generate timed out in-process (no resume).");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    // 0. Serverless FFmpeg Video Muxing (Concat I2V-continuous scene clips into master)
    if (provider === "mux" || action === "mux" || (Array.isArray(videoUrls) && !provider)) {
      const validUrls = (videoUrls || []).filter((u: any) => typeof u === "string" && u.trim().startsWith("http"));
      if (validUrls.length === 0) {
        return res.status(400).json({ error: "No valid HTTP video URLs provided for muxing" });
      }

      let ffmpegPath = "ffmpeg";
      try {
        await execFileAsync(ffmpegPath, ["-version"]);
      } catch {
        return res.status(200).json({
          success: false,
          ffmpegAvailable: false,
          fallbackToClient: true,
          error: "FFMPEG_UNAVAILABLE",
          message: "Serverless FFmpeg binary not available on host. Use client Canvas mux fallback.",
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

        const outputFilePath = path.join(tmpDir, "output.mp4");
        const ffmpegArgs: string[] = ["-y", "-f", "concat", "-safe", "0", "-i", concatListPath];

        if (audioFilePath && fs.existsSync(audioFilePath)) {
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
        } else {
          ffmpegArgs.push(
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
            "-movflags",
            "+faststart",
            outputFilePath
          );
        }

        await execFileAsync(ffmpegPath, ffmpegArgs, { timeout: 120000 });

        if (!fs.existsSync(outputFilePath)) {
          throw new Error("FFmpeg failed to produce output.mp4");
        }

        const outputBuffer = fs.readFileSync(outputFilePath);
        const publicUrl = await persistVideoBuffer({
          buffer: outputBuffer,
          brandId,
          productionId: productionId || "default-prod",
          filename: "master.mp4",
        });

        return res.status(200).json({
          success: true,
          publicUrl,
          videoUrl: publicUrl,
          provider: "ServerlessFFmpeg",
        });
      } catch (err: any) {
        console.error("[ServerlessMux] Execution error:", err);
        return res.status(200).json({
          success: false,
          fallbackToClient: true,
          error: err?.message || String(err),
        });
      } finally {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch {}
      }
    }

    const keys = {
      runway: process.env.RUNWAY_API_KEY,
      luma: process.env.LUMA_API_KEY,
      pika: process.env.PIKA_API_KEY,
      seedance: process.env.SEEDANCE_API_KEY || process.env.ARK_API_KEY,
      higgsfield: process.env.HIGGSFIELD_API_KEY,
      wan: process.env.WAN_API_KEY,
      veo: process.env.VEO_API_KEY || process.env.GOOGLE_AI_API_KEY,
      grok: process.env.XAI_API_KEY || process.env.GROK_API_KEY,
    };

    const i2vProviders = ["seedance", "ark", "kling", "grok", "xai"];
    if (i2vProviders.includes(String(provider || "").toLowerCase())) {
      const clipReq = await buildClipRequest(body);
      if (!clipReq.firstFrameDataUri) {
        return res.status(400).json({
          error: "I2V requires a first-frame still (imageUrl / firstFrameUrl / previous last frame).",
          videoUrl: null,
        });
      }

      let providerVideoUrl = "";
      const p = String(provider).toLowerCase();
      if (p === "seedance" || p === "ark") {
        providerVideoUrl = await generateSeedance(clipReq);
      } else if (p === "kling") {
        providerVideoUrl = await generateKling(clipReq);
      } else {
        providerVideoUrl = await generateGrok(clipReq);
      }

      const finalized = await finalizeClip({
        videoUrl: providerVideoUrl,
        brandId,
        productionId: productionId || "default-prod",
      });

      return res.status(200).json({
        success: true,
        videoUrl: finalized.videoUrl,
        lastFrameDataUrl: finalized.lastFrameDataUrl,
        provider,
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
        return res.status(200).json({ videoUrl, costUsd: 0.25 });
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
        return res.status(200).json({ videoUrl, costUsd: 0.22 });
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
        return res.status(200).json({ videoUrl, costUsd: 0.12 });
      }
      const errText = await response.text();
      throw new Error(`Wan Fal.ai error: ${errText}`);
    }

    if (provider === "higgsfield") {
      return res.status(422).json({
        error: "Higgsfield video generation is not wired for production I2V. Use Grok, Seedance, or Kling.",
        videoUrl: null,
      });
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
