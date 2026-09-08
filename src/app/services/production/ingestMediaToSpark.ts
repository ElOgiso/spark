/**
 * Client → server ingest when the browser cannot fetch a provider URL (CORS).
 * Server downloads bytes and uploads them to bucket "Spark".
 */
export async function ingestRemoteMediaToSpark(params: {
  url: string;
  brandId?: string;
  productionId: string;
  assetType: "image" | "frame" | "storyboard" | "video" | "audio" | "thumbnail";
  storagePath: string;
  mimeType?: string;
}): Promise<{ publicUrl: string; storagePath: string } | null> {
  const url = String(params.url || "").trim();
  if (!url || !params.productionId || !params.storagePath) return null;
  try {
    const res = await fetch("/api/runtime/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ingest-media",
        url,
        brandId: params.brandId,
        productionId: params.productionId,
        assetType: params.assetType,
        storagePath: params.storagePath,
        mimeType: params.mimeType,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || data.success === false) {
      console.warn("[ingestMediaToSpark] failed:", data.error || res.status);
      return null;
    }
    const publicUrl =
      (typeof data.publicUrl === "string" && data.publicUrl) ||
      (typeof data.videoUrl === "string" && data.videoUrl) ||
      "";
    const storagePath = typeof data.storagePath === "string" ? data.storagePath : params.storagePath;
    if (!publicUrl) return null;
    return { publicUrl, storagePath };
  } catch (err) {
    console.warn("[ingestMediaToSpark] notice:", err);
    return null;
  }
}
