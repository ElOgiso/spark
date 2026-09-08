/**
 * Scene video merger — server ffmpeg concat only.
 * Canvas / MediaRecorder is kept unused and must never be a master success.
 */

import { collectSparkShotClipUrls } from "./sparkShotClips";

export interface MergeSceneVideosOptions {
  videoUrls: string[];
  audioUrl?: string;
  onScreenTexts?: string[];
  productionId?: string;
  brandId?: string;
  width?: number;
  height?: number;
  timeoutMs?: number;
}

export interface SceneMergeResult {
  publicUrl?: string;
  storagePath?: string;
  mimeType: string;
  extension: "mp4";
  durationSec: number;
  provider?: string;
  error?: string;
}

export async function mergeSceneVideos(
  options: MergeSceneVideosOptions
): Promise<SceneMergeResult | null> {
  const { videoUrls, audioUrl, productionId, brandId, timeoutMs = 120000 } = options;

  const shotUrls = collectSparkShotClipUrls(videoUrls);
  if (shotUrls.length < 1) {
    throw new Error(
      "Approve & merge needs at least one durable Spark clip at brands/{brandId}/{productionId}/video/shot-N.mp4."
    );
  }
  if (!productionId) {
    throw new Error("Approve & merge requires a productionId for server ffmpeg.");
  }

  console.log(
    `[SceneVideoMerger] Calling serverless FFmpeg merge for ${shotUrls.length} shot clips (production: ${productionId})...`
  );
  const controller = new AbortController();
  const fetchTimeout = setTimeout(() => controller.abort(), timeoutMs);

  let serverResp: Response;
  try {
    serverResp = await fetch("/api/runtime/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "merge",
        provider: "mux",
        productionId,
        brandId: brandId || "default-brand",
        videoUrls: shotUrls,
        audioUrl,
      }),
      signal: controller.signal,
    });
  } catch (serverErr: any) {
    clearTimeout(fetchTimeout);
    throw new Error(
      serverErr?.name === "AbortError"
        ? "Server ffmpeg merge timed out."
        : `Server ffmpeg merge failed: ${serverErr?.message || String(serverErr)}`
    );
  }
  clearTimeout(fetchTimeout);

  let serverData: any = {};
  try {
    serverData = await serverResp.json();
  } catch {
    throw new Error(`Server ffmpeg merge returned non-JSON (${serverResp.status}).`);
  }

  if (serverData.success && serverData.publicUrl) {
    const sparkUrl = String(serverData.publicUrl);
    if (!/\/storage\/v1\/object\/(?:sign|public)\/Spark\//i.test(sparkUrl)) {
      throw new Error("Server ffmpeg merge returned a non-Spark URL — persist failed.");
    }
    console.log(`[SceneVideoMerger] Serverless FFmpeg merge completed -> ${sparkUrl}`);
    return {
      publicUrl: sparkUrl,
      storagePath: typeof serverData.storagePath === "string" ? serverData.storagePath : undefined,
      mimeType: "video/mp4",
      extension: "mp4",
      durationSec: serverData.durationSec || 15,
      provider: "ServerlessFFmpeg",
    };
  }

  const message =
    serverData.message ||
    serverData.error ||
    `Server ffmpeg merge failed (${serverResp.status}).`;
  throw new Error(String(message));
}

/**
 * Unused. Kept so Canvas/MediaRecorder cannot silently become the social master.
 * Do not call from assembleMasterFromClips / Approve & merge.
 */
export async function mergeSceneVideosClientUnused(_options: MergeSceneVideosOptions): Promise<null> {
  return null;
}
