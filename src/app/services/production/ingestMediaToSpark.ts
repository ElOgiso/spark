import { runtimeFetch } from "../../backend/runtimeFetch";
import {
  isEphemeralMediaUrl,
  isSparkStorageUrl,
  extractSparkStoragePath,
} from "./productionAssetService";

/**
 * Client → server ingest when the browser cannot fetch a provider URL (CORS).
 * Server downloads bytes and uploads them to bucket "Spark".
 */

type IngestListener = (sparkUrl: string) => void;
const inFlightIngests = new Map<
  string,
  Promise<{ publicUrl: string; storagePath: string } | null>
>();
const ingestListeners = new Map<string, Set<IngestListener>>();

export function subscribeToIngest(url: string, listener: IngestListener): () => void {
  const trimmed = (url || "").trim();
  if (!trimmed) return () => {};
  if (!ingestListeners.has(trimmed)) {
    ingestListeners.set(trimmed, new Set());
  }
  ingestListeners.get(trimmed)!.add(listener);
  return () => {
    const set = ingestListeners.get(trimmed);
    if (set) {
      set.delete(listener);
      if (set.size === 0) ingestListeners.delete(trimmed);
    }
  };
}

function notifyIngestSuccess(originalUrl: string, sparkUrl: string) {
  const trimmed = (originalUrl || "").trim();
  const listeners = ingestListeners.get(trimmed);
  if (listeners) {
    listeners.forEach((fn) => {
      try {
        fn(sparkUrl);
      } catch (err) {
        console.warn("[ingestMediaToSpark] listener notice:", err);
      }
    });
  }
}

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
    const res = await runtimeFetch("/api/runtime/video", {
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

/**
 * Schedule background auto-ingest for ephemeral provider URLs.
 * Deduplicates in-flight ingests by url+productionId.
 * On success, persists to database and notifies all player listeners.
 * On failure, keeps providerUrl without wiping.
 */
export async function scheduleAutoIngestMedia(params: {
  url: string;
  brandId?: string;
  productionId: string;
  assetType?: "image" | "frame" | "storyboard" | "video" | "audio" | "thumbnail";
  storagePath?: string;
  shotIndex?: number;
  mimeType?: string;
  onSuccess?: (sparkUrl: string) => void;
}): Promise<{ publicUrl: string; storagePath: string } | null> {
  const url = String(params.url || "").trim();
  if (!url) return null;
  if (isSparkStorageUrl(url)) {
    return { publicUrl: url, storagePath: extractSparkStoragePath(url) || "" };
  }

  const productionId = params.productionId || "default-prod";
  const brandId = params.brandId;
  const assetType = params.assetType || "video";
  const dedupeKey = `${url}::${productionId}`;

  if (params.onSuccess) {
    subscribeToIngest(url, params.onSuccess);
  }

  if (inFlightIngests.has(dedupeKey)) {
    return inFlightIngests.get(dedupeKey)!;
  }

  const defaultStoragePath =
    params.storagePath ||
    (assetType === "video"
      ? `video/shot-${params.shotIndex || "master"}-${Date.now()}.mp4`
      : `${assetType}/asset-${Date.now()}.png`);

  const promise = (async () => {
    let result: { publicUrl: string; storagePath: string } | null = null;
    let attemptErr: any = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        result = await ingestRemoteMediaToSpark({
          url,
          brandId,
          productionId,
          assetType,
          storagePath: defaultStoragePath,
          mimeType: params.mimeType || (assetType === "video" ? "video/mp4" : undefined),
        });
        if (result?.publicUrl) break;
      } catch (err) {
        attemptErr = err;
        if (attempt === 1) {
          console.warn("[scheduleAutoIngestMedia] Ingest attempt 1 failed, retrying once...", err);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }

    try {
      if (result?.publicUrl) {
        notifyIngestSuccess(url, result.publicUrl);

        // Persist Spark URL to database
        try {
          const { updateProduction } = await import("../../backend/repositories/productionRepository");
          await updateProduction(productionId, {
            assets: {
              video_url: result.publicUrl,
              video_storage_path: result.storagePath,
            } as any,
            brief: {
              videoUrl: result.publicUrl,
              playablePreviewUrl: result.publicUrl,
              video_storage_path: result.storagePath,
            } as any,
          });
        } catch (dbErr) {
          console.warn("[scheduleAutoIngestMedia] DB persist notice:", dbErr);
        }

        // Persist to production_assets / media_assets table
        try {
          const { createProductionAsset } = await import("../../backend/repositories/productionAssetRepository");
          await createProductionAsset({
            production_id: productionId,
            brand_id: brandId,
            asset_type: assetType,
            public_url: result.publicUrl,
            storage_path: result.storagePath,
            storage_bucket: "Spark",
            mime_type: params.mimeType || (assetType === "video" ? "video/mp4" : "image/jpeg"),
            source_tool: "SparkIngest",
          } as any);
        } catch (assetErr) {
          console.warn("[scheduleAutoIngestMedia] production_assets persist notice:", assetErr);
        }

        return result;
      }

      // If ingest fails: keep provider URL, set lastError ingest-failed, retry ingest once already done. Do not mark production complete-with-no-file.
      console.warn("[scheduleAutoIngestMedia] Ingest failed after retry; keeping provider preview URL.", attemptErr);
      try {
        const { updateProduction } = await import("../../backend/repositories/productionRepository");
        await updateProduction(productionId, {
          last_error: "ingest-failed",
        } as any);
      } catch {}
      return null;
    } finally {
      inFlightIngests.delete(dedupeKey);
    }
  })();

  inFlightIngests.set(dedupeKey, promise);
  return promise;
}
