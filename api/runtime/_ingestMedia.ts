/**
 * Server-side copy of a remote provider URL into bucket "Spark".
 * Avoids browser CORS. Never returns the provider URL as the playable identity.
 *
 * Not a Vercel function (underscore prefix). Dispatched from /api/runtime/video
 * so Hobby stays at the 12-function limit.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { persistBufferToSpark, sparkBrandMediaPath } from "./_sparkStorage.js";

function guessMime(urlOrHeader?: string, assetType?: string): string {
  const v = (urlOrHeader || "").toLowerCase();
  if (v.includes("video/") || v.includes(".mp4") || assetType === "video") return "video/mp4";
  if (v.includes("audio/") || v.includes(".mp3") || assetType === "audio") return "audio/mpeg";
  if (v.includes("png") || v.includes("image/png")) return "image/png";
  if (v.includes("webp")) return "image/webp";
  if (v.includes("gif")) return "image/gif";
  if (v.includes("jpeg") || v.includes("jpg")) return "image/jpeg";
  if (assetType === "audio") return "audio/mpeg";
  if (assetType === "video") return "video/mp4";
  return "image/jpeg";
}

function defaultSubpath(assetType: string): string {
  if (assetType === "video") return `video/clip-${Date.now()}.mp4`;
  if (assetType === "audio") return `audio/voice-${Date.now()}.mp3`;
  if (assetType === "thumbnail") return `thumbnails/thumb-${Date.now()}.png`;
  return `images/${assetType || "image"}-${Date.now()}.png`;
}

export function isIngestMediaRequest(req: VercelRequest): boolean {
  const body = req.body || {};
  if (body.action === "ingest-media") return true;
  const ingestQ = req.query?.ingest;
  if (ingestQ === "1" || ingestQ === "true") return true;
  const url = String(req.url || "");
  return url.includes("ingest-media");
}

export async function handleIngestMedia(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const brandId = typeof body.brandId === "string" ? body.brandId : "default-brand";
    const productionId = typeof body.productionId === "string" ? body.productionId : "";
    const assetType = typeof body.assetType === "string" ? body.assetType : "image";
    const requestedPath = typeof body.storagePath === "string" ? body.storagePath.replace(/^\/+/, "") : "";

    if (!url || (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("data:"))) {
      return res.status(400).json({ success: false, error: "url is required" });
    }
    if (!productionId) {
      return res.status(400).json({ success: false, error: "productionId is required" });
    }

    let buffer: Buffer;
    let contentType = typeof body.mimeType === "string" ? body.mimeType : "";
    if (url.startsWith("data:")) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return res.status(400).json({ success: false, error: "invalid data URL" });
      }
      contentType = contentType || match[1];
      buffer = Buffer.from(match[2], "base64");
    } else {
      let lastStatus = 0;
      let fetched: Response | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        fetched = await fetch(url);
        lastStatus = fetched.status;
        if (fetched.ok) break;
        const text = await fetched.text().catch(() => "");
        if (fetched.status === 404 || fetched.status === 425 || /video_not_ready|not ready/i.test(text)) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        return res.status(502).json({
          success: false,
          error: `Failed to download remote media (${fetched.status})`,
        });
      }
      if (!fetched?.ok) {
        return res.status(502).json({
          success: false,
          error: `Failed to download remote media (${lastStatus})`,
        });
      }
      buffer = Buffer.from(await fetched.arrayBuffer());
      contentType = contentType || guessMime(fetched.headers.get("content-type") || url, assetType);
    }

    if (!buffer.length) {
      return res.status(502).json({ success: false, error: "Remote media download was empty" });
    }

    const storagePath = requestedPath
      ? requestedPath.startsWith("brands/")
        ? requestedPath
        : sparkBrandMediaPath(brandId, productionId, requestedPath)
      : sparkBrandMediaPath(brandId, productionId, defaultSubpath(assetType));

    const persisted = await persistBufferToSpark({
      buffer,
      storagePath,
      contentType: contentType || guessMime(url, assetType),
    });

    return res.status(200).json({
      success: true,
      storagePath: persisted.storagePath,
      publicUrl: persisted.publicUrl,
      videoUrl: persisted.videoUrl,
    });
  } catch (err: any) {
    return res.status(502).json({
      success: false,
      error: err?.message || String(err),
    });
  }
}

export default handleIngestMedia;
