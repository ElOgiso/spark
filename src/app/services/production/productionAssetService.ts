import type { Production, ProductionBrief, ProductionScene, Brand, Character, ProductionAsset, ProductionFormatSettings, GenerationCreditSettings } from "../../domain/types";
import { getEffectiveFormatSettings, getEffectiveCreditSettings } from "../../domain/types";
import { ModelRouter } from "../runtime/modelRouter";
import { CapabilityRegistry } from "../capabilityRegistry";
import { ProductionGenerationGuard } from "./ProductionGenerationGuard";
import { getProductionPromptPack, buildTakeMotionPrompt } from "./productionPromptPacks";
import { resolveActiveVideoProvider, PROVIDER_CAPABILITY_MAP, snapToAllowedDuration } from "../runtime/providerCapabilities";

export const SPARK_STORAGE_BUCKET = "Spark";

export interface ProductionAssetGenerationResult {
  brief: ProductionBrief;
  scenes: { scene: number; description: string; duration: string }[];
  productionScenes?: ProductionScene[];
  audioUrl?: string;
  videoUrl?: string;
}

export interface LockedIdentityPack {
  characterReferenceImageUrl?: string;
  identityBlock: string;
  setBlock: string;
  styleBlock: string;
  aspectRatio: string;
  mode: "express" | "standard" | "deep";
  combinedPromptPrefix: string;
  environmentString: string;
}

export function buildCompleteVoiceScript(brief: ProductionBrief): string {
  const hook = typeof brief.hook === "string" ? brief.hook.trim() : "";
  const outline = typeof brief.scriptOutline === "string" ? brief.scriptOutline.trim() : "";

  let cta = brief.spokenCta?.trim() || "";
  if (!cta && typeof brief.caption === "string" && brief.caption.trim()) {
    const firstSentence = brief.caption.split(/[.!?\n]/)[0]?.trim();
    if (firstSentence && firstSentence.length > 5 && firstSentence.length < 120) {
      cta = firstSentence;
    }
  }
  if (!cta && brief.storyboard && brief.storyboard.length > 0) {
    const lastScene = brief.storyboard[brief.storyboard.length - 1];
    cta = lastScene?.onScreenText || lastScene?.scriptSnippet || "";
  }
  if (!cta) {
    cta = "Follow for more strategies.";
  }

  const clean = (str: string) =>
    str
      .replace(/[*_#`~\[\]()]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const cleanHook = clean(hook);
  const cleanOutline = clean(outline);
  const cleanCta = clean(cta);

  const parts = [cleanHook, cleanOutline, cleanCta].filter(Boolean);
  const fullScript = parts.join(". ").replace(/\.\s*\./g, ".").replace(/\s+/g, " ");

  return fullScript.slice(0, 600);
}

/**
 * PART 1 & 4 — Locked Identity Pack Helper
 * Enforces reference-led identity consistency, locked wardrobe, set continuity,
 * and format discipline by Production Mode across every visual call.
 */
export function buildLockedIdentityPack(params: {
  brand: Brand;
  character?: Character;
  brief: ProductionBrief;
  production: Production;
}): LockedIdentityPack {
  const { brand, character, brief, production } = params;
  const characterReferenceImageUrl =
    character?.characterSheetUrl || character?.imageUrl || character?.avatarUrl || undefined;

  const rawMode = (production.mode || brief.productionMode || "standard").toLowerCase();
  const mode: "express" | "standard" | "deep" =
    rawMode === "deep" || rawMode === "cinematic"
      ? "deep"
      : rawMode === "express" || rawMode === "narrator"
      ? "express"
      : "standard";

  const formatSettings = (params as any).formatSettings || (brand as any)?.formatSettings;
  const aspectMode = formatSettings?.aspectMode || "portrait";

  let aspectRatio = "9:16";
  if (aspectMode === "landscape") {
    aspectRatio = "16:9";
  } else if (aspectMode === "portrait") {
    aspectRatio = "9:16";
  } else if (aspectMode === "dynamic") {
    const briefAny = brief as any;
    if (briefAny.aspectRatio === "16:9" || briefAny.aspectRatio === "9:16") {
      aspectRatio = briefAny.aspectRatio;
    } else if (mode === "deep") {
      aspectRatio = "16:9";
    } else if (mode === "express") {
      aspectRatio = "9:16";
    } else {
      const platform = (briefAny.platformRecommendation || briefAny.platform || "").toLowerCase();
      aspectRatio = platform.includes("youtube long") || platform.includes("16:9") ? "16:9" : "9:16";
    }
  }

  const environmentString = brief.visualDirection || "a high-end executive studio with refined architectural lighting";

  const identityBlock = `CHARACTER (LOCKED IDENTITY): Primary subject is "${character?.name || "Host"}" (Style: ${character?.style || "Executive Presenter"}, Traits: ${(character?.traits || ["Visionary", "Authoritative", "Magnetic"]).join(", ")}).
IDENTITY CONTINUITY LAW: Must be the exact same person in every panel. Consistent facial structure, hair, and wardrobe styling across every single scene. Absolutely no character drifting, no face morphing, no outfit changes.${characterReferenceImageUrl ? ` Reference Sheet: ${characterReferenceImageUrl}` : ""}`;

  const setBlock = `ENVIRONMENT (LOCKED SET): Location is "${environmentString}".
SET CONTINUITY LAW: Same physical set, backdrop, architectural details, and lighting atmosphere across all panels. Do not change set location mid-board unless brief explicitly changes scene location. Lighting aligned with ${brand.name || "Brand"}.`;

  const styleBlock = `CINEMATIC DISCIPLINE: Format: ${aspectRatio} aspect ratio. 8K UHD photorealistic render, prime cinema optics, coherent color grade, natural depth of field, realistic skin texture, zero AI distortion.`;

  const combinedPromptPrefix = `${identityBlock}\n${setBlock}\n${styleBlock}`;

  return {
    characterReferenceImageUrl,
    identityBlock,
    setBlock,
    styleBlock,
    aspectRatio,
    mode,
    combinedPromptPrefix,
    environmentString,
  };
}

export interface VisualLockRefsResult {
  imageUrls: string[];
  primaryRefUrl?: string;
  charSheetUrls: string[];
  refPromptHeader: string;
}

export function isPlayableVideoUrl(val?: string | null): val is string {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  if (trimmed.length < 10) return false;
  if (trimmed.includes("pending") || trimmed.includes("failed") || trimmed.includes("error")) return false;
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:video/")
  );
}

export function isStorageVerifiedVideoUrl(val?: string | null): boolean {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  if (!isPlayableVideoUrl(trimmed)) return false;
  // Ephemeral provider URLs that expire quickly or are not durable storage
  const isEphemeral =
    trimmed.includes("vidgen.x.ai") ||
    trimmed.includes("generativelanguage.googleapis.com") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:");
  return !isEphemeral;
}

export function isDurableMasterVideoReady(val?: string | null): boolean {
  return isPlayableVideoUrl(val) && isStorageVerifiedVideoUrl(val);
}

export function isValidMediaData(val?: string | null): val is string {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  return (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("data:video/") ||
    trimmed.startsWith("data:audio/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  );
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
  signal?: AbortSignal
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timeout (${Math.round(timeoutMs / 1000)}s): ${errorMessage}`));
    }, timeoutMs);
  });

  const abortPromise = new Promise<T>((_, reject) => {
    if (signal?.aborted) {
      reject(new Error("Operation aborted"));
    } else {
      signal?.addEventListener("abort", () => reject(new Error("Operation aborted")), { once: true });
    }
  });

  try {
    return await Promise.race([promise, timeoutPromise, abortPromise]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Builds a deterministic, positional visual reference list for image/video models:
 * 1. Character Sheet URL(s) (always top priority)
 * 2. Master Storyboard Grid Reference Map
 * 3. Current Scene Keyframe Still
 * 4. Preceding Scene End-State Continuity Reference
 */
export function buildVisualLockRefs(params: {
  character?: Character;
  storyboardGridUrl?: string;
  sceneKeyframeUrl?: string;
  previousLastFrameUrl?: string;
}): VisualLockRefsResult {
  const { character, storyboardGridUrl, sceneKeyframeUrl, previousLastFrameUrl } = params;

  const charSheetUrls: string[] = [];
  if (character) {
    const directSheet = character.characterSheetUrl;
    if (directSheet && isValidMediaData(directSheet)) charSheetUrls.push(directSheet);

    const sheetList = (character as any).sheet_image_urls;
    if (Array.isArray(sheetList)) {
      for (const url of sheetList) {
        if (url && isValidMediaData(url) && !charSheetUrls.includes(url)) {
          charSheetUrls.push(url);
        }
      }
    }

    const imgUrl = character.imageUrl || character.avatarUrl;
    if (imgUrl && isValidMediaData(imgUrl) && !charSheetUrls.includes(imgUrl)) {
      charSheetUrls.push(imgUrl);
    }
  }

  const orderedRefs: string[] = [];
  const labelLines: string[] = [];
  let refCounter = 1;

  for (const sheetUrl of charSheetUrls) {
    orderedRefs.push(sheetUrl);
    labelLines.push(`INPUT REF [${refCounter}]: Character Reference Sheet (${character?.name || "Host"})`);
    refCounter++;
  }

  if (storyboardGridUrl && isValidMediaData(storyboardGridUrl) && !orderedRefs.includes(storyboardGridUrl)) {
    orderedRefs.push(storyboardGridUrl);
    labelLines.push(`INPUT REF [${refCounter}]: Master Multi-Panel Storyboard Grid Reference Map`);
    refCounter++;
  }

  if (sceneKeyframeUrl && isValidMediaData(sceneKeyframeUrl) && !orderedRefs.includes(sceneKeyframeUrl)) {
    orderedRefs.push(sceneKeyframeUrl);
    labelLines.push(`INPUT REF [${refCounter}]: Scene Hero Keyframe Still Reference`);
    refCounter++;
  }

  if (previousLastFrameUrl && isValidMediaData(previousLastFrameUrl) && !orderedRefs.includes(previousLastFrameUrl)) {
    orderedRefs.push(previousLastFrameUrl);
    labelLines.push(`INPUT REF [${refCounter}]: Preceding Scene Continuity Reference`);
    refCounter++;
  }

  const refPromptHeader = labelLines.length > 0
    ? `${labelLines.join("\n")}\nVISUAL LOCK LAW: The physical identity, face, outfit, and studio set look strictly lives in the reference images above. Text describes physical action and camera motion only.\n`
    : "";

  return {
    imageUrls: orderedRefs,
    primaryRefUrl: orderedRefs[0],
    charSheetUrls,
    refPromptHeader,
  };
}

/**
 * Normalizes on-screen text for in-picture burn-in (canvas lower-third or keyframe typography overlay).
 * Enforces concise length (<=8 words / <=60 chars) and excludes long spoken scripts or platform captions.
 */
export function formatBurnedOnScreenText(text?: string): string {
  if (!text) return "";
  const cleaned = text.replace(/["\r\n\t]+/g, " ").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= 8 && cleaned.length <= 60) return cleaned;
  return words.slice(0, 8).join(" ");
}

export class ProductionAssetService {
  /**
   * Refetches existing video mp4 objects from Supabase Storage if UI state is missing playable URLs.
   */
  static async refetchVideoFromStorage(params: {
    productionId: string;
    brandId?: string;
  }): Promise<{ videoUrl?: string; sceneClips?: string[] }> {
    try {
      const { getSupabaseClient } = await import("../../backend/supabaseClient");
      const supabase = getSupabaseClient();
      if (!supabase) return {};

      const { brandId = "default-brand", productionId } = params;
      const folderPaths = [
        `brands/${brandId}/${productionId}/video`,
        `${productionId}/video`,
      ];

      for (const folderPath of folderPaths) {
        const { data: files, error } = await supabase.storage.from(SPARK_STORAGE_BUCKET).list(folderPath, {
          limit: 20,
          sortBy: { column: "created_at", order: "asc" },
        });

        if (!error && files && files.length > 0) {
          const mp4Files = files.filter((f) => f.name && f.name.endsWith(".mp4"));
          if (mp4Files.length > 0) {
            const sceneClips: string[] = [];
            for (const mp4 of mp4Files) {
              const filePath = `${folderPath}/${mp4.name}`;
              const { data: signedData } = await supabase.storage.from(SPARK_STORAGE_BUCKET).createSignedUrl(filePath, 60 * 60 * 24 * 7);
              const clipUrl = signedData?.signedUrl || supabase.storage.from(SPARK_STORAGE_BUCKET).getPublicUrl(filePath).data?.publicUrl;
              if (clipUrl && isPlayableVideoUrl(clipUrl)) {
                sceneClips.push(clipUrl);
              }
            }
            if (sceneClips.length > 0) {
              return { videoUrl: sceneClips[0], sceneClips };
            }
          }
        }
      }
    } catch (err) {
      console.warn("[ProductionAssetService] Storage refetch notice:", err);
    }
    return {};
  }

  /**
   * Complete Media Asset Pipeline:
   * 1. Working storage upload to verified Supabase bucket "Spark"
   * 2. Resolves usable signed URLs for private bucket playback (7 days TTL)
   * 3. Saves metadata in media_assets table
   * 4. Optional parallel / preferred path: Google Drive folder (if user connected Drive)
   * 5. Lifecycle management: supports deleting working storage objects after 7 days
   */
  static async uploadAssetToStorage(params: {
    productionId: string;
    brandId?: string;
    assetType: "image" | "frame" | "storyboard" | "video" | "audio" | "thumbnail";
    storagePath: string;
    dataUrlOrBlob: string | Blob;
    mimeType: string;
    prompt?: string;
    provider?: string;
  }): Promise<{ publicUrl: string; storagePath: string; assetId: string; driveFileId?: string; driveWebViewLink?: string; uploadSuccess: boolean }> {
    const { productionId, brandId = "default-brand", assetType, storagePath, dataUrlOrBlob, mimeType, prompt, provider } = params;
    const assetId = `pa-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    let finalPublicUrl = typeof dataUrlOrBlob === "string" ? dataUrlOrBlob : `blob:${assetId}`;
    let driveFileId: string | undefined = undefined;
    let driveWebViewLink: string | undefined = undefined;
    let uploadSuccess = false;

    let uploadBlob: Blob | null = null;
    if (dataUrlOrBlob instanceof Blob) {
      uploadBlob = dataUrlOrBlob;
    } else if (typeof dataUrlOrBlob === "string" && dataUrlOrBlob.startsWith("data:")) {
      const base64Data = dataUrlOrBlob.split(",")[1];
      if (base64Data) {
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        uploadBlob = new Blob([byteArray], { type: mimeType });
      }
    } else if (dataUrlOrBlob.startsWith("http://") || dataUrlOrBlob.startsWith("https://")) {
      try {
        const fetched = await fetch(dataUrlOrBlob);
        if (fetched.ok) {
          uploadBlob = await fetched.blob();
        }
      } catch (fetchErr) {
        console.warn("[ProductionAssetService] Remote URL fetch for storage upload notice:", fetchErr);
      }
    }

    // 1. Working Storage Upload to Supabase bucket "Spark"
    try {
      const { getSupabaseClient } = await import("../../backend/supabaseClient");
      const supabase = getSupabaseClient();

      if (supabase && uploadBlob) {
        const { data, error } = await supabase.storage.from(SPARK_STORAGE_BUCKET).upload(storagePath, uploadBlob, {
          contentType: mimeType || uploadBlob.type || "image/png",
          upsert: true,
        });

        if (!error && data) {
          uploadSuccess = true;
          console.log(`[ProductionAssetService] Uploaded binary to bucket "${SPARK_STORAGE_BUCKET}": ${storagePath} (${uploadBlob.size} bytes)`);

          // Bucket 'Spark' is private: create signed URL with 7 days TTL (604800s)
          const { data: signedData, error: signedError } = await supabase.storage
            .from(SPARK_STORAGE_BUCKET)
            .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

          if (!signedError && signedData?.signedUrl) {
            finalPublicUrl = signedData.signedUrl;
          } else {
            const { data: pubData } = supabase.storage.from(SPARK_STORAGE_BUCKET).getPublicUrl(storagePath);
            if (pubData?.publicUrl) {
              finalPublicUrl = pubData.publicUrl;
            }
          }
        } else if (error) {
          uploadSuccess = false;
          console.error(`[ProductionAssetService] Supabase Storage upload to bucket "${SPARK_STORAGE_BUCKET}" failed:`, error);
        }
      } else if (!uploadBlob) {
        console.warn(`[ProductionAssetService] No binary blob available for upload to "${storagePath}"`);
      }
    } catch (err) {
      uploadSuccess = false;
      console.error("[ProductionAssetService] Working storage upload error:", err);
    }

    // 2. Optional Parallel / Preferred Path: Google Drive Upload (if user connected Drive)
    try {
      const { uploadToUserGoogleDriveIfConnected } = await import("../googleDriveService");
      if (uploadBlob) {
        const driveResult = await uploadToUserGoogleDriveIfConnected({
          blob: uploadBlob,
          filename: storagePath.split("/").pop() || `${assetId}.png`,
          mimeType: mimeType || uploadBlob.type,
          productionId,
        });
        if (driveResult) {
          driveFileId = driveResult.fileId;
          driveWebViewLink = driveResult.webViewLink;
        }
      }
    } catch (driveErr) {
      console.log("[ProductionAssetService] Google Drive upload notice (optional path):", driveErr);
    }

    // 3. Save metadata in media_assets table
    const prodAsset: ProductionAsset = {
      id: assetId,
      brandId,
      productionId,
      assetType,
      provider: provider || "AIProviderOrchestrator",
      storageBucket: SPARK_STORAGE_BUCKET,
      storagePath,
      publicUrl: finalPublicUrl,
      driveFileId,
      driveWebViewLink,
      expiresAt,
      mimeType: mimeType || uploadBlob?.type || "application/octet-stream",
      generationPrompt: prompt,
      status: uploadSuccess ? "completed" : "failed",
      createdAt: new Date().toISOString(),
    };

    try {
      const { persistProductionAssetCreate } = await import("../../backend/workspaceSync");
      void persistProductionAssetCreate(brandId, prodAsset);
    } catch (dbErr) {
      console.warn("[ProductionAssetService] Media asset record persist notice:", dbErr);
    }

    return { publicUrl: finalPublicUrl, storagePath, assetId, driveFileId, driveWebViewLink, uploadSuccess };
  }

  /**
   * Helper to resolve fresh signed URL from private "Spark" bucket for playback
   */
  static async resolveSignedUrl(storagePath: string, expiresIn = 604800): Promise<string | null> {
    if (!storagePath) return null;
    try {
      const { getSupabaseClient } = await import("../../backend/supabaseClient");
      const supabase = getSupabaseClient();
      if (!supabase) return null;
      const { data, error } = await supabase.storage
        .from(SPARK_STORAGE_BUCKET)
        .createSignedUrl(storagePath, expiresIn);
      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
      const { data: pubData } = supabase.storage.from(SPARK_STORAGE_BUCKET).getPublicUrl(storagePath);
      return pubData?.publicUrl || null;
    } catch (err) {
      console.warn("[ProductionAssetService] resolveSignedUrl error:", err);
      return null;
    }
  }

  /**
   * Generates storyboards, scene keyframes, voiceovers, thumbnails, and video clips
   * via Capability Registry -> Model Router -> Provider Adapters.
   */
  static async generateAssets(params: {
    production: Production;
    brief: ProductionBrief;
    brand: Brand;
    character?: Character;
    memoryItems?: import("../../domain/types").MemoryItem[];
    creditSettings?: import("../../domain/types").GenerationCreditSettings;
    onProgress?: (progress: import("../../domain/types").GenerationProgress) => void;
    forceRegenerate?: boolean;
    signal?: AbortSignal;
  }): Promise<ProductionAssetGenerationResult> {
    const { production, brief, brand, character, memoryItems = [], creditSettings, onProgress, forceRegenerate, signal } = params;
    const activeFormatSettings = getEffectiveFormatSettings({
      formatSettings: (production as any)?.formatSettings || (brief as any)?.formatSettings,
      brand,
    });
    const activeCreditSettings = getEffectiveCreditSettings({
      creditSettings: creditSettings || (production as any)?.creditSettings,
      brand,
    });
    console.log(`[SPARK Pipeline] START Asset Generation for Production "${production.id}" (${brief.title})`);
    ProductionGenerationGuard.assertEnabled("ProductionAssetService.generateAssets");

    const checkAborted = () => {
      if (signal?.aborted) {
        const err = new Error("Generation cancelled by executive");
        err.name = "AbortError";
        throw err;
      }
    };

    checkAborted();

    const identityPack = buildLockedIdentityPack({ brand, character, brief, production });
    const { mode, aspectRatio } = identityPack;
    const promptPack = getProductionPromptPack({
      brand,
      character,
      brief,
      production,
      aspectRatio,
      characterRefUrl: identityPack.characterReferenceImageUrl,
      memoryItems,
    });

    const stages: import("../../domain/types").GenerationProgressStage[] = [
      { id: "storyboard", label: `${mode.toUpperCase()} Storyboard structure`, status: "active" },
      { id: "voice", label: "Voiceover synthesis", status: "pending" },
      { id: "keyframes", label: "Scene keyframes (Hero stills)", status: "pending" },
      { id: "thumbnails", label: "Thumbnail variants", status: "pending" },
      { id: "video", label: "Motion synthesis (Image-to-video)", status: "pending" },
      { id: "saving", label: "Finalizing media package", status: "pending" },
    ];

    let currentStoryboard: ProductionScene[] = [];
    let currentThumbnails: { id: string; variant: string; concept: string; image?: string; url?: string }[] = [];
    let realGridUrl: string | undefined = brief.storyboardGridUrl || brief.generatedAssets?.storyboardGridUrl;
    let realVoiceUrl: string | undefined = undefined;
    let realVideoUrl: string | undefined = undefined;
    let lastError: string | undefined = undefined;

    const bId = (brand as any)?.id || "default-brand";
    const getStoragePath = (sub: string) => `brands/${bId}/${production.id}/${sub}`;

    let latestProgressSnapshot: import("../../domain/types").GenerationProgress | undefined = undefined;

    const emitProgress = (
      percent: number,
      stage: string,
      message?: string,
      partialOverride?: {
        storyboard?: ProductionScene[];
        thumbnails?: { id: string; variant: string; concept: string; image?: string; url?: string }[];
        voiceUrl?: string;
        videoUrl?: string;
        lastError?: string;
      }
    ) => {
      if (signal?.aborted) return;
      latestProgressSnapshot = {
        percent: Math.min(100, Math.max(0, percent)),
        stage,
        stages: stages.map((s) => ({ ...s })),
        message,
        updatedAt: new Date().toISOString(),
        partialAssets: {
          storyboard: partialOverride?.storyboard ?? (currentStoryboard.length > 0 ? currentStoryboard : undefined),
          thumbnails: partialOverride?.thumbnails ?? (currentThumbnails.length > 0 ? currentThumbnails.map((t) => ({ ...t })) : undefined),
          voiceUrl: partialOverride?.voiceUrl ?? realVoiceUrl,
          videoUrl: partialOverride?.videoUrl ?? realVideoUrl,
          lastError: partialOverride?.lastError ?? lastError,
        },
      };
      if (onProgress) {
        onProgress(latestProgressSnapshot);
      }
    };

    const persistCurrentStage = async (stageName: string) => {
      try {
        const { persistProductionUpdate, persistReviewUpdate } = await import("../../backend/workspaceSync");
        const stageBrief: ProductionBrief = {
          ...brief,
          storyboard: currentStoryboard.length > 0 ? currentStoryboard : brief.storyboard,
          storyboardGridUrl: realGridUrl,
          generationProgress: latestProgressSnapshot,
          generatedAssets: {
            ...brief.generatedAssets,
            storyboardGridUrl: realGridUrl,
            thumbnails: currentThumbnails,
            voiceoverUrl: realVoiceUrl,
            generatedFrames: currentStoryboard.map((s) => s.image).filter(Boolean) as string[],
            generatedVideos: realVideoUrl ? [realVideoUrl] : undefined,
            generationProgress: latestProgressSnapshot,
          },
          audioUrl: realVoiceUrl,
          videoUrl: realVideoUrl,
        };
        await persistProductionUpdate(production.id, {
          brief: stageBrief,
          audioUrl: realVoiceUrl,
          videoUrl: realVideoUrl,
          generationProgress: latestProgressSnapshot,
          isGeneratingAssets: latestProgressSnapshot ? (latestProgressSnapshot.stage !== "Complete" && latestProgressSnapshot.stage !== "Failed" && latestProgressSnapshot.percent < 100) : false,
          scenes: stageBrief.storyboard?.map((s) => ({
            scene: s.scene,
            description: s.shotList || s.visualDescription || `Scene ${s.scene}`,
            duration: s.duration,
            image: s.image,
            videoUrl: s.videoUrl,
          })),
        });
        console.log(`[SPARK Pipeline] Persistent stage saved to Supabase -> ${stageName} (prod ${production.id}, ${latestProgressSnapshot?.percent ?? 0}%)`);
      } catch (stageSyncErr) {
        console.warn(`[SPARK Pipeline] Stage ${stageName} cloud sync notice:`, stageSyncErr);
      }
    };

    let heartbeatTimer: any = null;
    const startHeartbeat = (stageLabel: string) => {
      stopHeartbeat();
      heartbeatTimer = setInterval(() => {
        if (signal?.aborted) {
          stopHeartbeat();
          return;
        }
        if (
          latestProgressSnapshot &&
          latestProgressSnapshot.stage !== "Complete" &&
          latestProgressSnapshot.stage !== "Failed" &&
          latestProgressSnapshot.stage !== "Cancelled" &&
          latestProgressSnapshot.percent < 100
        ) {
          emitProgress(
            latestProgressSnapshot.percent,
            latestProgressSnapshot.stage,
            `Working on ${stageLabel || latestProgressSnapshot.stage}...`
          );
        }
      }, 4000);
    };

    const stopHeartbeat = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    };

    emitProgress(5, "Storyboard", `Synthesizing ${mode.toUpperCase()} (${aspectRatio}) continuous storyboard...`);
    void persistCurrentStage("Storyboard");
    startHeartbeat("Storyboard");

    try {
      // PART 2 — Mode-Specific Storyboard Generation Prompt
    let systemInstruction = "";
    let prompt = "";

    const formattedBeatsBlock = brief.beats && brief.beats.length > 0
      ? `
STRUCTURED PRODUCTION BEATS (MANDATORY 1-TO-1 PANEL MAPPING):
${brief.beats
  .map(
    (b, i) =>
      `Beat ${i + 1} ${b.timecode} [${b.valueJob.toUpperCase()}]: "${b.spokenLines}" | ONSCREEN: "${b.onScreenText}" | CAMERA: ${b.cameraDirection || "Standard"}`
  )
  .join("\n")}
`
      : "";

    if (mode === "deep") {
      systemInstruction = `You are SPARK's Senior Film Director specializing in Continuous One-Take Cinematic Craft.
Structure a seamless continuous one-take sequence matching the brief's duration and beats.
CONTINUITY LAWS:
1. Stage N's startState MUST open EXACTLY on Stage N-1's endState.
2. Exactly ONE primary physical/story change per stage.
3. Locked character identity, wardrobe, and studio set across all panels.
4. Concrete camera direction required every panel.
5. Forbid montage cuts, teleportation, or stock cutaways. Return valid JSON only.`;

      prompt = `
Create a continuous one-take cinematic storyboard (${aspectRatio}) for:

TITLE: "${brief.title}"
BRAND: "${brand.name}" (${brand.niche})
HOST: "${character?.name || "Host"}" (${character?.style || "Executive Director"})
HOOK: "${brief.hook}"
SCRIPT OUTLINE: "${brief.scriptOutline}"
VISUAL DIRECTION: "${brief.visualDirection}"
${formattedBeatsBlock}
CONTINUITY LAWS FOR DEEP / CINEMATIC MODE:
- Continuous one-take staging across all beats.
- Every panel has:
  * valueJob: hook | problem | context | proof | example | myth_bust | payoff | cta
  * spokenLines: Complete substantive spoken line for host/VO
  * onScreenText: <=6-8 uppercase words
  * startState -> primaryChange -> endState (one change only)
  * cameraDirection: Specific cinematic motion (e.g. slow push-in, motivated tracking)

Return valid JSON with this exact structure:
{
  "storyboard": [
    {
      "scene": 1,
      "duration": "0-8s",
      "valueJob": "hook",
      "shotList": "Presenter direct-to-camera ${aspectRatio} master shot establishing scene",
      "cameraDirection": "Slow cinematic push-in with subtle lateral glide",
      "transitions": "Continuous one-take flow",
      "startState": "Host stands in studio, looking into lens, holding tablet with initial data",
      "primaryChange": "Host turns slightly as ambient background lighting dims to emphasize key metric",
      "endState": "Host centered in frame, gesturing right, backlight highlighting focused expression",
      "onScreenText": "${(typeof brief.hook === 'string' ? brief.hook : '').slice(0, 50)}",
      "pacing": "Deliberate and cinematic",
      "spokenLines": "${(typeof brief.hook === 'string' ? brief.hook : '').slice(0, 80)}",
      "scriptSnippet": "${(typeof brief.hook === 'string' ? brief.hook : '').slice(0, 80)}",
      "visualDescription": "High contrast executive opening shot with locked lighting and host presence"
    }
  ],
  "thumbnails": [
    { "id": "t1", "variant": "A", "concept": "High-contrast cinematic keyframe with host authority expression and curiosity hook" },
    { "id": "t2", "variant": "B", "concept": "Cinematic split lighting with illuminated metric graphic breakdown" },
    { "id": "t3", "variant": "C", "concept": "Minimalist premium typography overlay on sharp host portrait in studio" }
  ]
}
`;
    } else if (mode === "express") {
      systemInstruction = `You are SPARK's Rapid Short-Form Creative Director.
Structure an Express Narrator storyboard where high-impact visual stills support a FULL spoken VO script.
EXPRESS LAWS:
1. Every panel has a concrete valueJob, full substantive spokenLines, and <=6-8 word onScreenText.
2. Clean sequential visual storytelling with crisp typography safe margins.
3. Locked host identity and studio set. Return valid JSON only.`;

      prompt = `
Create an express narrator production storyboard (9:16 vertical) for:

TITLE: "${brief.title}"
BRAND: "${brand.name}" (${brand.niche})
HOST: "${character?.name || "Host"}" (${character?.style || "Executive Presenter"})
HOOK: "${brief.hook}"
SCRIPT OUTLINE: "${brief.scriptOutline}"
${formattedBeatsBlock}
EXPRESS NARRATOR RULES:
- Every panel has:
  * valueJob: hook | problem | context | proof | example | myth_bust | payoff | cta
  * spokenLines: Full VO sentence(s) for that beat
  * onScreenText: <=6-8 words, high-contrast lower-third ready
  * visualDescription / startState / primaryChange / endState for continuity

Return valid JSON with this exact structure:
{
  "storyboard": [
    {
      "scene": 1,
      "duration": "0-6s",
      "valueJob": "hook",
      "shotList": "Presenter direct-to-camera dynamic hook",
      "cameraDirection": "Quick snap push-in",
      "transitions": "Continuous flow",
      "startState": "Host centered looking directly into camera with intense hook expression",
      "primaryChange": "Host gestures dynamically as bold headline appears",
      "endState": "Host holding position pointing to key visual",
      "onScreenText": "${(typeof brief.hook === 'string' ? brief.hook : '').slice(0, 45)}",
      "pacing": "Fast hook",
      "spokenLines": "${(typeof brief.hook === 'string' ? brief.hook : '').slice(0, 80)}",
      "scriptSnippet": "${(typeof brief.hook === 'string' ? brief.hook : '').slice(0, 80)}",
      "visualDescription": "High energy vertical framing with clean studio lighting"
    }
  ],
  "thumbnails": [
    { "id": "t1", "variant": "A", "concept": "High-energy face reaction with bold hook text overlay" },
    { "id": "t2", "variant": "B", "concept": "Curiosity gap split graphic in dark mode" },
    { "id": "t3", "variant": "C", "concept": "Clean bold typography card with brand accent" }
  ]
}
`;
    } else {
      // standard mode
      systemInstruction = `You are SPARK's Senior Production Producer.
Structure a balanced Hybrid Presentation storyboard (host-on-camera + overlay text).
HYBRID LAWS:
1. Every panel has valueJob, exact host spokenLines, and onScreenText overlay.
2. startState -> primaryChange -> endState with clear single action focus.
3. Concrete camera direction per panel (no generic descriptors).
4. Locked character identity, wardrobe, and studio set across all panels. Return valid JSON only.`;

      prompt = `
Create a hybrid presentation storyboard (${aspectRatio}) for:

TITLE: "${brief.title}"
BRAND: "${brand.name}" (${brand.niche})
HOST: "${character?.name || "Host"}" (${character?.style || "Executive Presenter"})
HOOK: "${brief.hook}"
SCRIPT OUTLINE: "${brief.scriptOutline}"
VISUAL DIRECTION: "${brief.visualDirection}"
${formattedBeatsBlock}
HYBRID PRESENTATION RULES:
- Every panel has:
  * valueJob: hook | problem | context | proof | example | myth_bust | payoff | cta
  * spokenLines: Exact lines for host on camera
  * onScreenText: <=6-8 words in uppercase
  * startState -> primaryChange -> endState
  * cameraDirection: Concrete camera framing

Return valid JSON with this exact structure:
{
  "storyboard": [
    {
      "scene": 1,
      "duration": "0-8s",
      "valueJob": "hook",
      "shotList": "Presenter direct-to-camera vertical framing",
      "cameraDirection": "Push-in slow zoom",
      "transitions": "Continuous flow",
      "startState": "Host standing in executive studio addressing viewer",
      "primaryChange": "Host raises tablet presenting the challenge",
      "endState": "Host centered with focused expression holding visual aid",
      "onScreenText": "${(typeof brief.hook === 'string' ? brief.hook : '').slice(0, 50)}",
      "pacing": "Fast hook",
      "spokenLines": "${(typeof brief.hook === 'string' ? brief.hook : '').slice(0, 80)}",
      "scriptSnippet": "${(typeof brief.hook === 'string' ? brief.hook : '').slice(0, 80)}",
      "visualDescription": "High contrast executive presenter opening frame"
    }
  ],
  "thumbnails": [
    { "id": "t1", "variant": "A", "concept": "High-contrast split screen with presenter expression and bold hook" },
    { "id": "t2", "variant": "B", "concept": "Glowing metric dashboard with curiosity-gap text overlay" },
    { "id": "t3", "variant": "C", "concept": "Minimalist dark mode typography card with brand accent highlight" }
  ]
}
`;
    }

    let parsedStoryboard: any[] = [];
    let thumbnails: any[] = [];

    try {
      checkAborted();
      console.log(`[SPARK Pipeline] Provider Request: ${mode.toUpperCase()} Storyboard structure via ModelRouter...`);
      const rawResponse = await withTimeout(
        ModelRouter.executeCategoryRequest("production", {
          prompt,
          systemInstruction,
        }),
        45000,
        "Storyboard structure generation timed out after 45s",
        signal
      );

      checkAborted();
      console.log(`[SPARK Pipeline] Provider Response: Storyboard structure received (${rawResponse.length} chars)`);

      const cleanJson = rawResponse.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);

      parsedStoryboard = Array.isArray(parsed.storyboard) ? parsed.storyboard : [];
      thumbnails = Array.isArray(parsed.thumbnails) ? parsed.thumbnails : [];
    } catch (llmErr: any) {
      if (llmErr?.name === "AbortError" || signal?.aborted) throw llmErr;
      console.warn("[SPARK Pipeline] Storyboard LLM generation notice, using structured fallback:", llmErr);
      if (!lastError) lastError = `Storyboard: ${llmErr?.message || String(llmErr)}`;
    }

    // Ensure every parsed scene has valueJob, spokenLines, and audio mode
    const storyboard: ProductionScene[] = parsedStoryboard.length > 0
      ? parsedStoryboard.map((s, idx) => {
          const job = s.valueJob || brief.beats?.[idx]?.valueJob || "context";
          const resolvedAudio: "vo" | "talent" =
            s.audio ||
            (mode === "express"
              ? "vo"
              : mode === "deep"
              ? "talent"
              : (job === "slide" || job === "still" || job === "b-roll" || job === "context" || job === "example" || job === "problem" || job === "myth_bust"
                  ? "vo"
                  : "talent"));

          return {
            ...s,
            scene: typeof s.scene === "number" ? s.scene : idx + 1,
            audio: resolvedAudio,
            valueJob: job,
            spokenLines: s.spokenLines || s.scriptSnippet || brief.beats?.[idx]?.spokenLines || (idx === 0 ? brief.hook : ""),
            scriptSnippet: s.spokenLines || s.scriptSnippet || brief.beats?.[idx]?.spokenLines || (idx === 0 ? brief.hook : ""),
            onScreenText: s.onScreenText || brief.beats?.[idx]?.onScreenText || `BEAT ${idx + 1}`,
            cameraDirection: s.cameraDirection || brief.beats?.[idx]?.cameraDirection || (mode === "deep" ? "Tracking shot" : "Medium shot"),
          };
        })
      : ProductionAssetService.planProductionScenes({ production, brief, brand, formatSettings: activeFormatSettings });

    currentStoryboard = storyboard;
    currentThumbnails = thumbnails.length > 0
      ? thumbnails.map((t: any, idx: number) => ({
          id: t.id || `t${idx + 1}`,
          variant: t.variant || ["A", "B", "C"][idx] || "A",
          concept: t.concept || `Variant ${t.variant || "A"}`,
        }))
      : [
          { id: "t1", variant: "A", concept: "High-contrast hook framing with brand authority" },
          { id: "t2", variant: "B", concept: "Core value delivery and insight breakdown" },
          { id: "t3", variant: "C", concept: "Resolving call-to-action with clear next step" },
        ];

    const isValidMediaData = (val?: string | null): val is string => {
      if (!val || typeof val !== "string") return false;
      const trimmed = val.trim();
      return (
        trimmed.startsWith("data:image/") ||
        trimmed.startsWith("data:video/") ||
        trimmed.startsWith("data:audio/") ||
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://")
      );
    };

    // Generate ONE master multi-panel storyboard GRID image mapping scenes 1 -> N
    checkAborted();
    if (!forceRegenerate && isValidMediaData(realGridUrl)) {
      console.log(`[SPARK Pipeline] Reusing existing Master Storyboard Grid -> ${realGridUrl}`);
    } else {
      try {
        checkAborted();
        console.log(`[SPARK Pipeline] Generating Master Multi-Panel Storyboard Grid Map (${storyboard.length} panels)...`);
        const gridVisualLock = buildVisualLockRefs({
          character,
        });

        const masterGridPrompt = `
${gridVisualLock.refPromptHeader}
Production storyboard master grid map, sequential visual map of ${storyboard.length} panels.
PANEL 1 (Top / Scene 1 - Establishing): ${storyboard[0]?.startState || storyboard[0]?.visualDescription || "Scene 1 opening"} (Framing: Wide/Medium establishing shot).
PANEL 2 (Middle / Scene 2 - Action): ${storyboard[1]?.startState || storyboard[1]?.visualDescription || "Scene 2 transition"} (Framing: Medium action shot).
PANEL 3 (Bottom / Scene 3 - Resolution): ${storyboard[2]?.endState || storyboard[2]?.visualDescription || "Scene 3 resolution"} (Framing: Medium close-up resolving shot).
CHARACTER (locked, identical every panel): ${character?.name || "Host"}, style: ${character?.style || "Executive Presenter"}, traits: ${(character?.traits || ["Visionary", "Authoritative"]).join(", ")}. Use reference image. Do not change face or outfit.
ENVIRONMENT (locked): ${identityPack.environmentString}. Same set across all panels.
LAYOUT INSTRUCTION: Create a 9:16 vertical continuous 3-panel storyboard grid map showing Scene 1, Scene 2, Scene 3 in exact order from top to bottom. Clear readable scene progression with shot variety, not extreme facial close-ups.
`.trim();

        const gridImgData = await withTimeout(
          ModelRouter.executeCategoryRequest("storyboardImages", {
            prompt: masterGridPrompt,
            referenceImageUrl: gridVisualLock.primaryRefUrl,
            referenceImageUrls: gridVisualLock.imageUrls,
            aspectRatio: identityPack.aspectRatio,
          }),
          60000,
          "Master storyboard grid image generation timed out after 60s",
          signal
        );
          checkAborted();

          if (isValidMediaData(gridImgData)) {
            let finalGrid = gridImgData;
            try {
              const storedGrid = await this.uploadAssetToStorage({
                productionId: production.id,
                brandId: (brand as any).id,
                assetType: "storyboard",
                storagePath: getStoragePath("storyboard/master-grid.png"),
                dataUrlOrBlob: gridImgData,
                mimeType: "image/png",
                prompt: masterGridPrompt,
                provider: "ModelRouter",
              });
              if (storedGrid?.publicUrl) finalGrid = storedGrid.publicUrl;
              console.log(`[SPARK Pipeline] Storage Upload: Master Storyboard Grid -> ${finalGrid}`);
            } catch (storageErr) {
              console.warn("[SPARK Pipeline] Master Storyboard Grid upload notice:", storageErr);
            }
            realGridUrl = finalGrid;
          }
        } catch (gridErr: any) {
          if (gridErr?.name === "AbortError" || signal?.aborted) throw gridErr;
          console.warn("[SPARK Pipeline] Master Storyboard Grid generation notice:", gridErr);
        }
      }

      stages[0].status = "done";
      stages[1].status = "active";

      const isExpressMode = mode === "express";
      const scenesNeedVo = (sb: typeof currentStoryboard) => {
        if (!sb || sb.length === 0) return false;
        return sb.some((s) => s.audio === "vo");
      };

      const shouldSynthesizeExternalVoice =
        mode === "express" ||
        (mode === "standard" && scenesNeedVo(currentStoryboard));

      if (!shouldSynthesizeExternalVoice) {
        console.log(`[SPARK Pipeline] Mode is "${mode}" (${mode === "deep" ? "cinematic picture speech" : "talent-led hybrid"}). Skipping separate ElevenLabs voiceover bed (speech delivered via video clips/talent).`);
        realVoiceUrl = undefined;
        stages[1].status = "done";
      } else if (!forceRegenerate && isValidMediaData(production.audioUrl || brief.audioUrl)) {
        realVoiceUrl = production.audioUrl || brief.audioUrl;
        console.log(`[SPARK Pipeline] Reusing existing voiceover audio -> ${realVoiceUrl}`);
        stages[1].status = "done";
      } else {
        emitProgress(12, "Voice", "Synthesizing voiceover narration (Hook + Core + CTA)...");
        void persistCurrentStage("Voice");
        startHeartbeat("Voice");
        checkAborted();
        try {
          const voiceScript = promptPack.voiceScript;
          const targetVoiceId = character?.voice?.voiceId || (brand as any)?.voice?.voiceId;
          const { generateElevenLabsVoice } = await import("../runtime/providers/elevenLabsTTS");
          const elevenVoice = await withTimeout(
            generateElevenLabsVoice(voiceScript, targetVoiceId, undefined, signal),
            45000,
            "ElevenLabs voice synthesis timed out after 45s",
            signal
          );
          checkAborted();
          if (isValidMediaData(elevenVoice)) {
            let voiceResult = elevenVoice;
            try {
              const storedAudio = await this.uploadAssetToStorage({
                productionId: production.id,
                brandId: (brand as any).id,
                assetType: "audio",
                storagePath: `${production.id}/audio/voice.mp3`,
                dataUrlOrBlob: elevenVoice,
                mimeType: "audio/mpeg",
                prompt: voiceScript,
                provider: "ElevenLabs",
              });
              if (storedAudio?.publicUrl) voiceResult = storedAudio.publicUrl;
            } catch (storageErr) {
              console.warn("[ProductionAssetService] Supabase audio upload failed, retaining provider audio URL:", storageErr);
            }
            realVoiceUrl = voiceResult;
          } else {
            checkAborted();
            const { generateSuperSparkVoice } = await import("../geminiService");
            const synthesizedVoice = await withTimeout(
              generateSuperSparkVoice(voiceScript),
              45000,
              "SuperSpark voice synthesis timed out after 45s",
              signal
            );
            checkAborted();
            if (isValidMediaData(synthesizedVoice)) {
              let voiceResult = synthesizedVoice;
              try {
                const storedAudio = await this.uploadAssetToStorage({
                  productionId: production.id,
                  brandId: (brand as any).id,
                  assetType: "audio",
                  storagePath: `${production.id}/audio/voice.mp3`,
                  dataUrlOrBlob: synthesizedVoice,
                  mimeType: "audio/wav",
                  prompt: voiceScript,
                  provider: "Google Gemini TTS",
                });
                if (storedAudio?.publicUrl) voiceResult = storedAudio.publicUrl;
              } catch (storageErr) {
                console.warn("[ProductionAssetService] Supabase audio upload failed, retaining provider audio URL:", storageErr);
              }
              realVoiceUrl = voiceResult;
            }
          }
        } catch (voiceErr: any) {
          if (voiceErr?.name === "AbortError" || signal?.aborted) throw voiceErr;
          console.warn("[ProductionAssetService] Real voice synthesis notice:", voiceErr);
          if (!lastError) lastError = `Voice: ${voiceErr?.message || String(voiceErr)}`;
        }
        stages[1].status = realVoiceUrl ? "done" : "failed";
      }

      await persistCurrentStage("Voice");
      stages[2].status = "active";
      emitProgress(20, "Keyframes", `Rendering ${aspectRatio} scene keyframes (Target Hero Frames)...`);
      void persistCurrentStage("Keyframes");
      startHeartbeat("Keyframes");

      // PART 1 & 4 — Professional Sequential Take Grids (3-4 panels per take contact sheet)
      const sceneImages: string[] = [];
      const takeGrids: string[] = [];
      const renderStartedAt = new Date().toISOString();

      const panelsPerTake = aspectRatio === "16:9" ? 4 : 3;
      const totalTakes = Math.max(1, Math.ceil(currentStoryboard.length / panelsPerTake));
      const targetSec = activeFormatSettings?.targetDurationSec || 60;
      const takeSec = Math.max(4, Math.round(targetSec / totalTakes));

      try {
        const { ModelRouter } = await import("../runtime/modelRouter");

        for (let tIdx = 0; tIdx < totalTakes; tIdx++) {
          checkAborted();
          const startIdx = tIdx * panelsPerTake;
          const takeScenes = currentStoryboard.slice(startIdx, startIdx + panelsPerTake);
          if (takeScenes.length === 0) continue;

          // Check if existing take grid is already stored / durable
          const existingTakeGrid = brief.takeGrids?.[tIdx] || (tIdx === 0 ? realGridUrl : undefined);
          if (!forceRegenerate && isValidMediaData(existingTakeGrid)) {
            console.log(`[SPARK Pipeline] Reusing existing Take ${tIdx + 1} Grid -> ${existingTakeGrid}`);
            takeGrids.push(existingTakeGrid);
            takeScenes.forEach((s, idx) => {
              const globalIdx = startIdx + idx;
              s.image = existingTakeGrid;
              sceneImages.push(existingTakeGrid);
              currentStoryboard[globalIdx] = { ...s, image: existingTakeGrid };
            });
            continue;
          }

          const prevTakeGrid = tIdx > 0 ? takeGrids[tIdx - 1] : undefined;
          const visualLock = buildVisualLockRefs({
            character,
            storyboardGridUrl: prevTakeGrid || realGridUrl,
            previousLastFrameUrl: prevTakeGrid,
          });

          const charAnalysis = `
CHARACTER CONTINUITY (Strictly locked from sheet):
- Name: ${character?.name || "Host"} (${character?.style || "Executive Presenter"}).
- Traits: ${(character?.traits || ["Visionary", "Authoritative"]).join(", ")}.
- Signature Wardrobe: Proportions, face, hair, and wardrobe strictly identical to IMAGE 1. Never change mid-board. No second costume.
- Environment (locked): ${identityPack.environmentString}.
`.trim();

          const panelBreakdown = takeScenes.map((s, pIdx) => {
            const panelNum = pIdx + 1;
            const globalSceneNum = startIdx + pIdx + 1;
            const shotFraming = s.cameraDirection || (pIdx === 0 ? "Wide/Medium establishing shot" : pIdx === 1 ? "Medium action shot" : "Medium close-up resolving shot");
            const spoken = s.spokenLines || s.scriptSnippet ? `LINE: "${(s.spokenLines || s.scriptSnippet).replace(/"/g, "'")}"` : "";
            const onScreen = formatBurnedOnScreenText(s.onScreenText || brief.beats?.[startIdx + pIdx]?.onScreenText || (globalSceneNum === 1 ? brief.hook : `SCENE ${globalSceneNum}`));
            const action = s.primaryChange || s.visualDescription || s.startState || "Host presents key insight";
            const endPose = s.endState || "Host delivers clear resolving gesture";
            return `PANEL ${panelNum} (Scene ${globalSceneNum}): [${shotFraming}] | ACTION: ${action} | ${spoken} | ON-SCREEN: "${onScreen}" | CAMERA: ${shotFraming} | END POSE: ${endPose}`;
          }).join("\n");

          const takeGridPrompt = `
${visualLock.refPromptHeader}
Cinematic storyboard CONTACT SHEET for TAKE ${tIdx + 1} of ${totalTakes}.
Duration this take: ${takeSec}s. Cell aspect: ${aspectRatio}.
IMAGE 1 = Character sheet/avatar reference (${character?.name || "Lead Host"}).
${tIdx > 0 ? `IMAGE 2 = Previous take grid continuing from Take ${tIdx} last panel end pose.` : ""}

${charAnalysis}

LAYOUT ON ONE IMAGE:
- ${takeScenes.length} numbered sequential panels with thin gutters (${aspectRatio === "16:9" ? "2x2 grid layout" : "vertical continuous 3-panel stack"}).
- Panel order from 1 to ${takeScenes.length}.
- Panel k starts from panel k-1 end pose. ${tIdx === 0 ? "Take 1 Panel 1 = Wide/Medium establishing shot." : `Take ${tIdx + 1} Panel 1 continues from Take ${tIdx} resolution.`}

PANEL BREAKDOWN:
${panelBreakdown}

PRODUCTION LAWS:
- Looks like a finished professional film/manhua storyboard contact sheet.
- No extra cast members. No random moodboard collage. No text walls.
- Ultra-crisp storyboard rendering, readable action staging, consistent framing variety.
`.trim();

          try {
            checkAborted();
            console.log(`[SPARK Pipeline] Provider Request: Take ${tIdx + 1} of ${totalTakes} storyboard grid via ModelRouter ("storyboardImages") [Refs: ${visualLock.imageUrls.length}]...`);
            const gridImgUrl = await withTimeout(
              ModelRouter.executeCategoryRequest("storyboardImages", {
                prompt: takeGridPrompt,
                referenceImageUrl: visualLock.primaryRefUrl,
                referenceImageUrls: visualLock.imageUrls,
                aspectRatio: identityPack.aspectRatio,
              }),
              60000,
              `Take ${tIdx + 1} storyboard grid generation timed out after 60s`,
              signal
            );
            checkAborted();

            if (isValidMediaData(gridImgUrl)) {
              let finalGrid = gridImgUrl;
              try {
                const storedGrid = await this.uploadAssetToStorage({
                  productionId: production.id,
                  brandId: (brand as any).id,
                  assetType: "storyboard",
                  storagePath: `${production.id}/take-grids/take-0${tIdx + 1}.png`,
                  dataUrlOrBlob: gridImgUrl,
                  mimeType: "image/png",
                  prompt: takeGridPrompt,
                  provider: "ModelRouter",
                });
                if (storedGrid?.publicUrl) finalGrid = storedGrid.publicUrl;
                console.log(`[SPARK Pipeline] Storage Upload: Take ${tIdx + 1} Grid -> ${finalGrid}`);
              } catch (storageErr) {
                console.warn(`[SPARK Pipeline] Take ${tIdx + 1} Grid upload notice:`, storageErr);
              }

              takeGrids.push(finalGrid);
              if (tIdx === 0) realGridUrl = finalGrid;

              takeScenes.forEach((s, idx) => {
                const globalIdx = startIdx + idx;
                s.image = finalGrid;
                sceneImages.push(finalGrid);
                currentStoryboard[globalIdx] = { ...s, image: finalGrid };
              });
            } else {
              console.warn(`[SPARK Pipeline] Take ${tIdx + 1} returned empty/invalid image data:`, String(gridImgUrl || "").slice(0, 100));
              if (!lastError) lastError = `Take ${tIdx + 1} Grid: No image bytes returned by provider`;
            }
          } catch (takeErr: any) {
            if (takeErr?.name === "AbortError" || signal?.aborted) throw takeErr;
            console.error(`[SPARK Pipeline] Take ${tIdx + 1} grid generation failed:`, takeErr);
            if (!lastError) lastError = `Take ${tIdx + 1} Grid: ${takeErr?.message || String(takeErr)}`;
          }

          const currentPct = 20 + Math.round(((tIdx + 1) / totalTakes) * 35);
          emitProgress(currentPct, "Keyframes", `Rendered Take ${tIdx + 1} of ${totalTakes} storyboard grid...`);
          void persistCurrentStage(`Take-${tIdx + 1}`);
        }
      } catch (imgErr: any) {
        if (imgErr?.name === "AbortError" || signal?.aborted) throw imgErr;
        console.error("[SPARK Pipeline] Storyboard take grid generation notice:", imgErr);
        if (!lastError) lastError = `Take Grid Stage: ${imgErr?.message || String(imgErr)}`;
      }

      stages[2].status = takeGrids.length > 0 ? "done" : "failed";
      await persistCurrentStage("Keyframes");
      stages[3].status = "active";
      emitProgress(58, "Thumbnails", "Generating Proposed Thumbnail Variants with Locked Identity...");
      void persistCurrentStage("Thumbnails");
      startHeartbeat("Thumbnails");

      // Thumbnail Variants Image Generation Loop via ModelRouter with Locked Identity Pack
      const enrichedThumbnails: { id: string; variant: string; concept: string; image?: string; url?: string }[] = [];
      try {
        const { ModelRouter } = await import("../runtime/modelRouter");
        const targetThumbCount = typeof activeCreditSettings.thumbnailCount === "number" ? Math.max(0, activeCreditSettings.thumbnailCount) : 3;
        const effectiveThumbnails = thumbnails.slice(0, targetThumbCount);
        const totalThumbs = effectiveThumbnails.length || 3;
        for (let tIdx = 0; tIdx < effectiveThumbnails.length; tIdx++) {
          checkAborted();
          const thumb = effectiveThumbnails[tIdx];
          const variantLetter = thumb.variant || ["A", "B", "C"][tIdx] || "A";
          if (!forceRegenerate && isValidMediaData(thumb.image || thumb.url)) {
            const existingThumbUrl = thumb.image || thumb.url;
            console.log(`[SPARK Pipeline] Reusing existing Thumbnail Variant ${variantLetter} -> ${existingThumbUrl}`);
            enrichedThumbnails.push({
              id: thumb.id || `t${tIdx + 1}`,
              variant: variantLetter,
              concept: thumb.concept,
              image: existingThumbUrl,
              url: existingThumbUrl,
            });
            currentThumbnails = [...enrichedThumbnails];
            const currentPct = 58 + Math.round(((tIdx + 1) / totalThumbs) * 20);
            emitProgress(currentPct, "Thumbnails", `Verified thumbnail variant ${variantLetter}...`);
            continue;
          }

          const shortHookText = (typeof brief.hook === "string" ? brief.hook : brief.title || "VIRAL INSIGHT")
            .replace(/[^\w\s]/gi, "")
            .split(" ")
            .filter(Boolean)
            .slice(0, 4)
            .join(" ")
            .toUpperCase();

          const formulaDirectives: Record<string, string> = {
            A: `VIRAL FORMULA: Shock / High Emotion + Curiosity Gap.
LAYOUT: Subject on left vertical third (Rule of Thirds grid), short bold 2-4 word headline on right third.
TEXT OVERLAY: "${shortHookText}" (Short, bold, high-contrast typography, ≤4 words).
COLOR PALETTE: Primary brand accent + high-contrast monochrome base (black/white) + neon magenta highlight glow.`,
            B: `VIRAL FORMULA: Big Number Transformation + Character Scale Comparison.
LAYOUT: Subject on right vertical third gesturing toward large metric graphic card on left vertical third.
TEXT OVERLAY: "${shortHookText}" (Bold numerical highlight & metric callout, ≤4 words).
COLOR PALETTE: Primary brand accent + dark obsidian base + electric amber per-video highlight.`,
            C: `VIRAL FORMULA: Hero Object + Burning Question + Blurred Outcome.
LAYOUT: Subject at Rule of Thirds focal intersection looking toward curiosity object with subtle depth-of-field blur.
TEXT OVERLAY: "${shortHookText}" (Bold mystery question prompt, ≤4 words).
COLOR PALETTE: Primary brand accent + studio dark monochrome + cyan highlight glow.`,
          };

          const formulaSpec = formulaDirectives[variantLetter] || formulaDirectives.A;

          const thumbVisualLock = buildVisualLockRefs({
            character,
            storyboardGridUrl: realGridUrl,
            sceneKeyframeUrl: sceneImages[0],
          });

          const thumbPrompt = `
${thumbVisualLock.refPromptHeader}
[${identityPack.aspectRatio} PROVEN VIRAL THUMBNAIL VARIANT ${variantLetter}]
CONCEPT: ${thumb.concept}
${formulaSpec}
RULE OF THIRDS LAW: Align character face and visual elements on rule-of-thirds grid intersections.
CHARACTER LOCK: Primary subject "${character?.name || "Host"}" (${character?.style || "Executive"}). Facial structure, hair, and wardrobe strictly identical to character sheet reference.
${identityPack.combinedPromptPrefix}
Brand: ${brand.name}
`.trim();

          let thumbUrl: string | undefined = undefined;

          try {
            checkAborted();
            console.log(`[SPARK Pipeline] Provider Request: Thumbnail Variant ${variantLetter} image via ModelRouter...`);
            const thumbImgData = await withTimeout(
              ModelRouter.executeCategoryRequest("storyboardImages", {
                prompt: thumbPrompt,
                referenceImageUrl: thumbVisualLock.primaryRefUrl,
                referenceImageUrls: thumbVisualLock.imageUrls,
                aspectRatio: identityPack.aspectRatio,
              }),
              45000,
              `Thumbnail variant ${variantLetter} generation timed out after 45s`,
              signal
            );
            checkAborted();

            if (isValidMediaData(thumbImgData)) {
              let finalThumb = thumbImgData;
              try {
                const storedThumb = await this.uploadAssetToStorage({
                  productionId: production.id,
                  brandId: (brand as any).id,
                  assetType: "thumbnail",
                  storagePath: getStoragePath(`thumbnails/variant-${variantLetter.toLowerCase()}.png`),
                  dataUrlOrBlob: thumbImgData,
                  mimeType: "image/png",
                  prompt: thumbPrompt,
                  provider: "ModelRouter",
                });
                if (storedThumb?.publicUrl) finalThumb = storedThumb.publicUrl;
                console.log(`[SPARK Pipeline] Storage Upload: Thumbnail Variant ${variantLetter} -> ${finalThumb}`);
              } catch (storageErr) {
                console.warn(`[SPARK Pipeline] Thumbnail ${variantLetter} upload failed, retaining provider URL:`, storageErr);
              }
              thumbUrl = finalThumb;
            } else {
              console.warn(`[SPARK Pipeline] Thumbnail Variant ${variantLetter} returned non-image data`);
              if (!lastError) lastError = `Thumbnail Variant ${variantLetter}: No image bytes returned`;
            }
          } catch (thumbErr: any) {
            if (thumbErr?.name === "AbortError" || signal?.aborted) throw thumbErr;
            console.error(`[SPARK Pipeline] Thumbnail Variant ${variantLetter} image generation failed:`, thumbErr);
            if (!lastError) lastError = `Thumbnail Variant ${variantLetter}: ${thumbErr?.message || String(thumbErr)}`;
          }

          const resolvedThumbImage = thumbUrl || (isValidMediaData(sceneImages[tIdx]) ? sceneImages[tIdx] : undefined);
          const thumbEntry = {
            id: thumb.id || `t${tIdx + 1}`,
            variant: variantLetter,
            concept: thumb.concept,
            image: resolvedThumbImage,
            url: resolvedThumbImage,
          };
          enrichedThumbnails.push(thumbEntry);
          currentThumbnails = [...enrichedThumbnails];

          const currentPct = 58 + Math.round(((tIdx + 1) / totalThumbs) * 20);
          emitProgress(currentPct, "Thumbnails", `Synthesized thumbnail variant ${variantLetter}...`);
          void persistCurrentStage("Thumbnails");
        }
      } catch (tLoopErr: any) {
        if (tLoopErr?.name === "AbortError" || signal?.aborted) throw tLoopErr;
        console.error("[SPARK Pipeline] Thumbnail generation loop failed:", tLoopErr);
        if (!lastError) lastError = `Thumbnail Stage: ${tLoopErr?.message || String(tLoopErr)}`;
      }

      stages[3].status = enrichedThumbnails.some((t) => isValidMediaData(t.image)) ? "done" : "failed";
      await persistCurrentStage("Thumbnails");
      stages[4].status = "active";
      emitProgress(80, "Video", `Synthesizing ${mode.toUpperCase()} motion conditioned on scene stills...`);

      // PART 3 — Stills Drive Motion: Image-Conditioned Video Generation Loop via ModelRouter ("videoGeneration")
      const sceneClips: string[] = [];

      checkAborted();

      // Stored production generation fingerprint comparison (BUG 3)
      const prevProdDuration =
        (production as any)?.formatSettings?.targetDurationSec ??
        (production as any)?.targetDurationSec ??
        brief?.targetDurationSec ??
        (brief as any)?.formatSettings?.targetDurationSec;

      const prevProdMode = (production as any)?.productionMode || (brief as any)?.productionMode;
      const prevProdProvider = (production as any)?.formatSettings?.preferredVideoProvider || (brief as any)?.formatSettings?.preferredVideoProvider;
      const prevProdAspect = (production as any)?.formatSettings?.aspectMode || (brief as any)?.formatSettings?.aspectMode;

      const currentDuration = activeFormatSettings?.targetDurationSec || 60;
      const currentMode = mode;
      const currentProvider = activeFormatSettings?.preferredVideoProvider || "auto";
      const currentAspect = activeFormatSettings?.aspectMode || "portrait";

      const durationMatches = typeof prevProdDuration === "number" && prevProdDuration === currentDuration;
      const modeMatches = typeof prevProdMode === "string" && prevProdMode === currentMode;
      const providerMatches = typeof prevProdProvider === "string" && prevProdProvider === currentProvider;
      const aspectMatches = typeof prevProdAspect === "string" && prevProdAspect === currentAspect;

      const canReuseExistingVideo = !forceRegenerate && durationMatches && modeMatches && providerMatches && aspectMatches;

      let existingVideoCandidate = canReuseExistingVideo
        ? [
            production.videoUrl,
            brief.videoUrl,
            brief.generatedAssets?.generatedVideos?.[0],
            ...(brief.storyboard?.map((s) => s.videoUrl) || []),
          ].find((u) => isDurableMasterVideoReady(u))
        : undefined;

      if (canReuseExistingVideo && existingVideoCandidate) {
        realVideoUrl = existingVideoCandidate;
        console.log(`[SPARK Pipeline] Reusing existing verified durable master video (${currentDuration}s ${currentMode}) -> ${realVideoUrl}`);
        if (currentStoryboard.length > 0) {
          currentStoryboard.forEach((s) => {
            if (!s.videoUrl) s.videoUrl = realVideoUrl;
          });
        }
      } else if (canReuseExistingVideo) {
        console.log("[SPARK Pipeline] No verified durable video in memory/brief. Attempting Storage refetch before AI video generation...");
        const refetched = await ProductionAssetService.refetchVideoFromStorage({
          productionId: production.id,
          brandId: (brand as any).id,
        });
        if (refetched.videoUrl && isDurableMasterVideoReady(refetched.videoUrl)) {
          realVideoUrl = refetched.videoUrl;
          if (refetched.sceneClips?.length) {
            sceneClips.push(...refetched.sceneClips);
          }
          console.log(`[SPARK Pipeline] Refetched existing verified durable video from Storage -> ${realVideoUrl}`);
          if (currentStoryboard.length > 0) {
            currentStoryboard.forEach((s, idx) => {
              s.videoUrl = refetched.sceneClips?.[idx] || realVideoUrl;
            });
          }
        }
      } else if (!forceRegenerate) {
        console.log(`[SPARK Pipeline] Generation parameters changed (target: ${currentDuration}s ${currentMode} [${currentProvider} · ${currentAspect}], prev: ${prevProdDuration}s ${prevProdMode} [${prevProdProvider} · ${prevProdAspect}]). Skipping stale video reuse and synthesizing fresh video.`);
      }

      if (!realVideoUrl) {
        try {
          const isExpressNarrator = mode === "express";

          if (isExpressNarrator) {
            // NARRATOR PIPELINE (express): Compile stills + voiceover into video without calling videoGeneration provider
            console.log(`[SPARK Pipeline] Mode is "${mode}" (Narrator). Compiling ordered stills + voiceover narration into master MP4 (0 AI video credits burned).`);
            emitProgress(85, "Compile", "Compiling Narrator slideshow video from keyframe stills & voiceover...");

            try {
              const targetImages = sceneImages.length > 0 ? sceneImages : (currentStoryboard.map((s) => s.image).filter(Boolean) as string[]);
              const targetTexts = currentStoryboard.map((s, idx) => {
                const primaryOnScreen = s.onScreenText;
                if (primaryOnScreen) {
                  const formatted = formatBurnedOnScreenText(primaryOnScreen);
                  if (formatted) return formatted;
                }
                const beatOnScreen = brief.beats?.[idx]?.onScreenText;
                if (beatOnScreen) {
                  const formatted = formatBurnedOnScreenText(beatOnScreen);
                  if (formatted) return formatted;
                }
                if (idx === 0 && brief.hook) {
                  return formatBurnedOnScreenText(brief.hook);
                }
                return "";
              });

              if (targetImages.length === 0) {
                throw new Error("Narrator compilation requires generated keyframe still images (0 stills available).");
              }
              if (!realVoiceUrl) {
                throw new Error("Narrator compilation requires a generated voice audio track (realVoiceUrl missing).");
              }

              const { compileNarratorSlideshowVideo } = await import("./narratorVideoCompiler");
              const compileResult = await withTimeout(
                compileNarratorSlideshowVideo({
                  imageUrls: targetImages,
                  audioUrl: realVoiceUrl,
                  onScreenTexts: targetTexts,
                  totalDurationSec: activeFormatSettings?.targetDurationSec || 60,
                }),
                60000,
                "Narrator slideshow compilation timed out after 60s",
                signal
              );

              if (compileResult && compileResult.blob && compileResult.blob.size > 0) {
                const ext = compileResult.extension || (compileResult.mimeType.includes("mp4") ? "mp4" : "webm");
                const storedCompiledVid = await this.uploadAssetToStorage({
                  productionId: production.id,
                  brandId: (brand as any).id,
                  assetType: "video",
                  storagePath: getStoragePath(`video/master.${ext}`),
                  dataUrlOrBlob: compileResult.blob,
                  mimeType: compileResult.mimeType || `video/${ext}`,
                  prompt: "Narrator compiled slideshow video with voiceover muxing",
                  provider: "NarratorSlideshowCompiler",
                });
                if (storedCompiledVid?.publicUrl && isDurableMasterVideoReady(storedCompiledVid.publicUrl)) {
                  realVideoUrl = storedCompiledVid.publicUrl;
                  sceneClips.length = 0;
                  currentStoryboard.forEach((s) => {
                    s.videoUrl = realVideoUrl;
                  });
                  console.log(`[SPARK Pipeline] Storage Upload: Narrator Compiled Video (${compileResult.mimeType}, ${Math.round(compileResult.durationSec)}s) -> ${realVideoUrl}`);
                } else {
                  throw new Error("Narrator compiled video upload failed to return a verified durable URL in Supabase Storage.");
                }
              } else {
                throw new Error("Narrator slideshow compiler produced an empty video blob.");
              }
            } catch (compilerErr: any) {
              console.warn("[SPARK Pipeline] Narrator video compiler exception:", compilerErr);
              lastError = `Narrator video compiler error: ${compilerErr.message || String(compilerErr)}`;
              realVideoUrl = undefined;
            }
          } else {
            // HYBRID (standard) & CINEMATIC (deep): Use videoGeneration model for motion
            // CONSISTENCY GATE: Do not call videoGeneration unless at least Take 1 grid exists and is valid
            if (takeGrids.length === 0 || !isValidMediaData(takeGrids[0])) {
              const errMsg = "Consistency Gate Failure: Take 1 storyboard grid is missing or invalid. Video motion requires a verified Take 1 grid.";
              console.error(`[SPARK Pipeline] ${errMsg}`);
              throw new Error(errMsg);
            }

            const { ModelRouter } = await import("../runtime/modelRouter");
            const activeVideo = resolveActiveVideoProvider({
              preferredVideoProvider: activeFormatSettings?.preferredVideoProvider,
            });
            const nativeMaxClipSec = activeVideo.maxVideoDurationSec || 8;
            const targetSec = activeFormatSettings?.targetDurationSec || 60;
            const enablePerSceneClips = Boolean(
              (params as any)?.enablePerSceneClips ||
              ((mode === "standard" || mode === "deep") && (targetSec > nativeMaxClipSec || currentStoryboard.length > 1))
            );

            if (enablePerSceneClips) {
              // Per-scene clip generation with mode-specific motion directives and automatic merge
              const totalVideoStages = currentStoryboard.length || 3;
              const isDeep = mode === "deep";

              for (let sIdx = 0; sIdx < currentStoryboard.length; sIdx++) {
                checkAborted();
                const scene = currentStoryboard[sIdx];
                const sceneStill = scene.image || sceneImages[sIdx];
                const panelFraming = scene.cameraDirection || (sIdx === 0 ? "Wide/Medium establishing shot" : sIdx === 1 ? "Medium action shot" : "Medium close-up resolving shot");

                const takeIdxForScene = Math.floor(sIdx / panelsPerTake);
                const takeGridForScene = takeGrids[takeIdxForScene] || realGridUrl;
                const takeScenesForPrompt = currentStoryboard.slice(takeIdxForScene * panelsPerTake, (takeIdxForScene + 1) * panelsPerTake);

                const stageVisualLock = buildVisualLockRefs({
                  character,
                  storyboardGridUrl: takeGridForScene,
                  sceneKeyframeUrl: sceneStill,
                  previousLastFrameUrl: sIdx > 0 ? (sceneClips[sIdx - 1] || sceneImages[sIdx - 1]) : undefined,
                });

                const rawSceneDur = parseInt(scene.duration) || snapToAllowedDuration(Math.ceil(targetSec / totalVideoStages), activeVideo.providerId);
                const sceneTargetDuration = snapToAllowedDuration(rawSceneDur, activeVideo.providerId) || Math.min(nativeMaxClipSec, 8);

                const stageMotionPrompt = `${stageVisualLock.refPromptHeader}\n${buildTakeMotionPrompt({
                  mode,
                  aspectRatio: identityPack.aspectRatio,
                  takeIndex: takeIdxForScene + 1,
                  totalTakes: totalTakes,
                  takeDurationSec: sceneTargetDuration,
                  panels: takeScenesForPrompt.map((ts, pIdx) => ({
                    panelIndex: pIdx,
                    shotFraming: ts.cameraDirection,
                    action: ts.primaryChange || ts.visualDescription,
                    spokenLines: ts.spokenLines || ts.scriptSnippet,
                    onScreenText: ts.onScreenText,
                    audio: ts.audio,
                  })),
                  characterName: character?.name || "Host",
                  characterStyle: character?.style || "Executive Presenter",
                  environment: identityPack.environmentString,
                })}`;

                console.log(`[SPARK Pipeline] Provider Request: Video stage ${sIdx + 1} (${mode.toUpperCase()}) via ModelRouter ("videoGeneration") [Refs: ${stageVisualLock.imageUrls.length}]...`);

                try {
                  checkAborted();
                  const generatedClip = await withTimeout(
                    ModelRouter.executeCategoryRequest("videoGeneration", {
                      prompt: stageMotionPrompt,
                      referenceImageUrl: stageVisualLock.primaryRefUrl,
                      referenceImageUrls: stageVisualLock.imageUrls,
                      aspectRatio: identityPack.aspectRatio,
                      durationSec: sceneTargetDuration,
                    }),
                    90000,
                    `Video stage ${sIdx + 1} generation timed out after 90s`,
                    signal
                  );
                  checkAborted();

                  if (isValidMediaData(generatedClip)) {
                    let finalClip = generatedClip;
                    try {
                      const storedClip = await this.uploadAssetToStorage({
                        productionId: production.id,
                        brandId: (brand as any).id,
                        assetType: "video",
                        storagePath: getStoragePath(`video/scene-0${sIdx + 1}.mp4`),
                        dataUrlOrBlob: generatedClip,
                        mimeType: "video/mp4",
                        prompt: stageMotionPrompt,
                        provider: "ModelRouter",
                      });
                      if (storedClip?.publicUrl && isDurableMasterVideoReady(storedClip.publicUrl)) finalClip = storedClip.publicUrl;
                      console.log(`[SPARK Pipeline] Storage Upload: Stage ${sIdx + 1} Video -> ${finalClip}`);
                    } catch (storageErr: any) {
                      console.warn(`[SPARK Pipeline] Video stage ${sIdx + 1} upload failed, retaining provider URL:`, storageErr);
                    }

                    scene.videoUrl = finalClip;
                    sceneClips.push(finalClip);
                    if (!realVideoUrl) realVideoUrl = finalClip;
                  }
                } catch (stageVidErr: any) {
                  if (stageVidErr?.name === "AbortError" || signal?.aborted) throw stageVidErr;
                  console.warn(`[SPARK Pipeline] Video stage ${sIdx + 1} generation notice:`, stageVidErr);
                  if (!lastError) lastError = `Video Scene ${sIdx + 1}: ${stageVidErr?.message || String(stageVidErr)}`;
                }

                const currentPct = 80 + Math.round(((sIdx + 1) / totalVideoStages) * 15);
                emitProgress(currentPct, "Video", `Rendered video stage ${sIdx + 1} of ${totalVideoStages}...`);
                void persistCurrentStage(`Video-Scene-${sIdx + 1}`);
              }

              // MERGE SCENE CLIPS INTO ONE PLAYABLE MASTER VIDEO
              const allScenesVo = currentStoryboard.length > 0 && currentStoryboard.every((s) => s.audio === "vo");
              const mergeAudioUrl = allScenesVo ? realVoiceUrl : undefined;
              const targetMergeTexts = currentStoryboard.map((s, idx) => {
                const primaryOnScreen = s.onScreenText;
                if (primaryOnScreen) {
                  const formatted = formatBurnedOnScreenText(primaryOnScreen);
                  if (formatted) return formatted;
                }
                const beatOnScreen = brief.beats?.[idx]?.onScreenText;
                if (beatOnScreen) {
                  const formatted = formatBurnedOnScreenText(beatOnScreen);
                  if (formatted) return formatted;
                }
                if (idx === 0 && brief.hook) {
                  return formatBurnedOnScreenText(brief.hook);
                }
                return "";
              });

              if (sceneClips.length > 1) {
                emitProgress(95, "Merge", `Merging ${sceneClips.length} approved scene videos into master MP4...`);
                try {
                  const { mergeSceneVideos } = await import("./sceneVideoMerger");
                  const mergeResult = await withTimeout(
                    mergeSceneVideos({
                      videoUrls: sceneClips,
                      audioUrl: mergeAudioUrl,
                      onScreenTexts: targetMergeTexts,
                      width: aspectRatio === "16:9" ? 1920 : 1080,
                      height: aspectRatio === "16:9" ? 1080 : 1920,
                    }),
                    60000,
                    "Automatic scene video merge timed out after 60s",
                    signal
                  );

                  if (mergeResult && mergeResult.blob && mergeResult.blob.size > 0) {
                    const ext = mergeResult.extension || "mp4";
                    const storedMergedVid = await this.uploadAssetToStorage({
                      productionId: production.id,
                      brandId: (brand as any).id,
                      assetType: "video",
                      storagePath: getStoragePath(`video/master.${ext}`),
                      dataUrlOrBlob: mergeResult.blob,
                      mimeType: mergeResult.mimeType || `video/${ext}`,
                      prompt: `Merged ${mode} master video from ${sceneClips.length} scenes`,
                      provider: "SceneVideoMerger",
                    });
                    if (storedMergedVid?.publicUrl && isDurableMasterVideoReady(storedMergedVid.publicUrl)) {
                      realVideoUrl = storedMergedVid.publicUrl;
                      console.log(`[SPARK Pipeline] Storage Upload: Merged Master Video (${sceneClips.length} scenes) -> ${realVideoUrl}`);
                    } else {
                      realVideoUrl = undefined;
                      lastError = "Merged video upload failed to return a verified durable Storage URL.";
                    }
                  } else {
                    realVideoUrl = undefined;
                    lastError = "Automatic scene video merger produced an empty video blob.";
                  }
                } catch (mergeErr: any) {
                  console.warn("[SPARK Pipeline] Automatic scene merge execution notice:", mergeErr);
                  realVideoUrl = undefined;
                  lastError = `Automatic scene merge failed: ${mergeErr?.message || String(mergeErr)}`;
                }
              } else if (sceneClips.length === 1) {
                if (isDurableMasterVideoReady(sceneClips[0])) {
                  realVideoUrl = sceneClips[0];
                } else {
                  try {
                    const storedSingle = await this.uploadAssetToStorage({
                      productionId: production.id,
                      brandId: (brand as any).id,
                      assetType: "video",
                      storagePath: getStoragePath("video/master.mp4"),
                      dataUrlOrBlob: sceneClips[0],
                      mimeType: "video/mp4",
                      prompt: `Master video from single scene clip (${mode})`,
                      provider: "ModelRouter",
                    });
                    if (storedSingle?.publicUrl && isDurableMasterVideoReady(storedSingle.publicUrl)) {
                      realVideoUrl = storedSingle.publicUrl;
                    }
                  } catch (singleErr: any) {
                    console.warn("[SPARK Pipeline] Single scene master storage upload notice:", singleErr);
                  }
                }
              }
            } else {
              // DEFAULT PATH: ONE MASTER VIDEO FROM STORYBOARD KEYFRAMES / GRID
              const activeVideo = resolveActiveVideoProvider({
                preferredVideoProvider: activeFormatSettings?.preferredVideoProvider,
              });
              const nativeMaxClipSec = activeVideo.maxVideoDurationSec || 8;
              const targetSec = activeFormatSettings?.targetDurationSec || 60;
              const allowedDuration = snapToAllowedDuration(Math.min(targetSec, nativeMaxClipSec), activeVideo.providerId);
              const videoDurationSec = allowedDuration || (mode === "deep" ? Math.min(targetSec, 12) : Math.min(targetSec, 8));
              const beatInterval = Math.max(3, Math.floor(videoDurationSec / Math.max(1, currentStoryboard.length)));
              const sceneDescriptions = currentStoryboard
                .map((s, i) => {
                  const startSec = i * beatInterval;
                  const endSec = (i + 1) * beatInterval;
                  const timeStr = `${startSec}-${endSec}s:`;
                  const actionStr = s.primaryChange || s.visualDescription || s.startState || "Action beat";
                  const cameraStr = s.cameraDirection || (mode === "deep" ? "Slow motivated push-in tracking shot" : "Host-on-camera medium frame");
                  const spoken = s.spokenLines || s.scriptSnippet || "";
                  const dialogueStr = spoken ? ` "${spoken.replace(/"/g, "'")}"` : "";
                  return `${timeStr} ACTION: ${actionStr}. CAMERA: ${cameraStr}.${dialogueStr}`;
                })
                .join("\n");

              const masterMotionVisualLock = buildVisualLockRefs({
                character,
                storyboardGridUrl: realGridUrl,
                sceneKeyframeUrl: sceneImages[0] || currentStoryboard[0]?.image,
                previousLastFrameUrl: sceneImages[1] || currentStoryboard[1]?.image,
              });

              const motionRefImages = masterMotionVisualLock.imageUrls;
              const masterMotionPrompt = `
${masterMotionVisualLock.refPromptHeader}
${promptPack.videoPromptTemplate(videoDurationSec, sceneDescriptions)}
`.trim();

              console.log(`[SPARK Pipeline] Provider Request: Master Video via ModelRouter ("videoGeneration") [Refs: ${motionRefImages.length}, Duration: ${videoDurationSec}s]...`);
              emitProgress(85, "Video", `Synthesizing master ${mode.toUpperCase()} video from keyframes...`);

              checkAborted();
              const generatedMaster = await withTimeout(
                ModelRouter.executeCategoryRequest("videoGeneration", {
                  prompt: masterMotionPrompt,
                  referenceImageUrl: masterMotionVisualLock.primaryRefUrl,
                  referenceImageUrls: motionRefImages,
                  aspectRatio: identityPack.aspectRatio,
                  durationSec: videoDurationSec,
                }),
                90000,
                "Master video generation timed out after 90s",
                signal
              );
              checkAborted();

              if (isValidMediaData(generatedMaster)) {
                let finalMasterUrl: string | undefined = undefined;
                try {
                  const storedVid = await this.uploadAssetToStorage({
                    productionId: production.id,
                    brandId: (brand as any).id,
                    assetType: "video",
                    storagePath: getStoragePath("video/master.mp4"),
                    dataUrlOrBlob: generatedMaster,
                    mimeType: "video/mp4",
                    prompt: masterMotionPrompt,
                    provider: "ModelRouter",
                  });
                  if (storedVid?.publicUrl && isDurableMasterVideoReady(storedVid.publicUrl)) {
                    finalMasterUrl = storedVid.publicUrl;
                    console.log(`[SPARK Pipeline] Storage Upload: Master Video -> ${finalMasterUrl}`);
                  }
                } catch (storageErr: any) {
                  console.warn("[SPARK Pipeline] Master video storage upload failed:", storageErr);
                  lastError = `Master video storage upload failed: ${storageErr?.message || String(storageErr)}`;
                }

                // If direct upload failed or returned non-durable, try refetch from Storage before giving up
                if (!finalMasterUrl) {
                  const refetched = await ProductionAssetService.refetchVideoFromStorage({
                    productionId: production.id,
                    brandId: (brand as any).id,
                  });
                  if (refetched.videoUrl && isDurableMasterVideoReady(refetched.videoUrl)) {
                    finalMasterUrl = refetched.videoUrl;
                  }
                }

                if (finalMasterUrl && isDurableMasterVideoReady(finalMasterUrl)) {
                  realVideoUrl = finalMasterUrl;
                } else {
                  realVideoUrl = undefined;
                  if (!lastError) {
                    lastError = "AI video generated but failed to persist to permanent Supabase Storage.";
                  }
                }
              }
            }
          }
        } catch (vidErr: any) {
          if (vidErr?.name === "AbortError" || signal?.aborted) throw vidErr;
          console.error("[SPARK Pipeline] Video generation failed:", vidErr);
          if (!lastError) lastError = `Video Generation: ${vidErr?.message || String(vidErr)}`;
        }
      }

      checkAborted();
      const isVideoSuccess = Boolean(realVideoUrl && isDurableMasterVideoReady(realVideoUrl));
      if (!isVideoSuccess && !lastError) {
        lastError = "Video synthesis completed but did not produce a verified durable video in Storage.";
      }

      stages[4].status = isVideoSuccess ? "done" : "failed";
      stages[5].status = isVideoSuccess ? "done" : "failed";

      brief.videoUrl = realVideoUrl;
      brief.audioUrl = realVoiceUrl;
      if (!brief.generatedAssets) brief.generatedAssets = {};
      brief.generatedAssets.generatedVideos = sceneClips.length > 0 ? sceneClips : (realVideoUrl ? [realVideoUrl] : undefined);
      brief.generatedAssets.voiceoverUrl = realVoiceUrl;

      await persistCurrentStage("Video");

      emitProgress(
        isVideoSuccess ? 96 : 85,
        isVideoSuccess ? "Saving" : "Failed",
        isVideoSuccess ? "Synchronizing storage assets & metadata..." : `Video synthesis failed to produce playable video. ${lastError}`,
        { videoUrl: realVideoUrl, voiceUrl: realVoiceUrl, lastError }
      );

      const renderCompletedAt = new Date().toISOString();

      const finalProgress: import("../../domain/types").GenerationProgress = {
        percent: isVideoSuccess ? 100 : 85,
        stage: isVideoSuccess ? "Complete" : "Failed",
        stages: stages.map((s) => ({
          ...s,
          status: s.status === "active" ? (isVideoSuccess ? "done" : "failed") : s.status,
        })),
        message: isVideoSuccess
          ? `${mode.toUpperCase()} media assets synthesized with continuous staged craft and ready for executive review.`
          : `Video synthesis failed or incomplete. ${lastError || "Check error logs and click Regenerate."}`,
        updatedAt: renderCompletedAt,
        partialAssets: {
          storyboard: currentStoryboard,
          thumbnails: enrichedThumbnails.length > 0 ? enrichedThumbnails : thumbnails,
          voiceUrl: realVoiceUrl,
          videoUrl: realVideoUrl,
          lastError: isVideoSuccess ? lastError : (lastError || "Video stage failed to produce a valid video URL."),
        },
      };

      const updatedBrief: ProductionBrief = {
        ...brief,
        targetDurationSec: currentDuration,
        productionMode: mode,
        formatSettings: { ...activeFormatSettings, targetDurationSec: currentDuration },
        storyboard: currentStoryboard.length > 0 ? currentStoryboard : [
          {
            scene: 1,
            duration: mode === "deep" ? "0-8s" : "0-5s",
            shotList: `${aspectRatio} host framing`,
            cameraDirection: "Push-in zoom",
            transitions: "Continuous flow",
            startState: "Host established in framing",
            primaryChange: "Host presents initial insight",
            endState: "Host in delivery position",
            onScreenText: brief.hook,
            pacing: "Fast",
            scriptSnippet: brief.hook,
            visualDescription: brief.visualDirection,
          },
        ],
        takeGrids: takeGrids.length > 0 ? takeGrids : brief.takeGrids,
        storyboardGridUrl: realGridUrl || takeGrids[0] || brief.storyboardGridUrl,
        generatedAssets: {
          storyboardGridUrl: realGridUrl || takeGrids[0] || brief.storyboardGridUrl,
          takeGrids: takeGrids.length > 0 ? takeGrids : brief.takeGrids,
          sceneClips: sceneClips.length > 0 ? sceneClips : (realVideoUrl ? [realVideoUrl] : undefined),
          thumbnails: enrichedThumbnails.length > 0 ? enrichedThumbnails : thumbnails,
          voiceoverUrl: realVoiceUrl,
          generatedFrames: sceneImages.length > 0 ? sceneImages : undefined,
          generatedVideos: sceneClips.length > 0 ? sceneClips : (realVideoUrl ? [realVideoUrl] : undefined),
          generatedAudio: realVoiceUrl ? [realVoiceUrl] : undefined,
          generationProgress: finalProgress,
          generationMetadata: {
            renderStartedAt,
            renderCompletedAt,
            providerUsed: "AIProviderOrchestrator",
            generationStatus: isVideoSuccess ? "Completed" : "Failed",
            lastError,
          },
        },
        audioUrl: realVoiceUrl,
        videoUrl: realVideoUrl,
      };

      const updatedScenes = updatedBrief.storyboard!.map((s) => ({
        scene: s.scene,
        description: s.startState && s.endState
          ? `[${s.duration}] ${s.shotList} — Action: ${s.primaryChange || s.visualDescription} (End: ${s.endState})`
          : `[${s.duration}] ${s.shotList} — Text: "${s.onScreenText}"`,
        duration: s.duration,
        image: s.image,
        videoUrl: s.videoUrl,
      }));

      const fullProductionScenes: ProductionScene[] = (updatedBrief.storyboard || []).map((sb, idx) => ({
        scene: sb.scene || idx + 1,
        index: sb.scene || idx + 1,
        id: `scene-${production.id}-${sb.scene || idx + 1}`,
        productionId: production.id,
        brandId: (brand as any)?.id,
        duration: sb.duration || "5s",
        durationSec: parseInt(sb.duration) || 5,
        shotList: sb.shotList || `Scene ${idx + 1} framing`,
        cameraDirection: sb.cameraDirection || "Medium shot",
        camera: sb.cameraDirection || "Medium shot",
        transitions: sb.transitions || "Seamless flow",
        onScreenText: sb.onScreenText || `SCENE ${idx + 1}`,
        pacing: sb.pacing || "Balanced",
        scriptSnippet: sb.scriptSnippet || sb.spokenLines || "",
        spokenLines: sb.spokenLines || sb.scriptSnippet || "",
        audio: sb.audio || (mode === "express" ? "vo" : mode === "deep" ? "talent" : "talent"),
        scriptBeat: sb.spokenLines || sb.scriptSnippet || "",
        visualDescription: sb.visualDescription || sb.startState || `Scene ${idx + 1}`,
        action: sb.primaryChange || sb.visualDescription || `Scene ${idx + 1} action`,
        startState: sb.startState || `Scene ${idx + 1} start`,
        endState: sb.endState || `Scene ${idx + 1} end`,
        primaryChange: sb.primaryChange || sb.visualDescription,
        image: sb.image || sceneImages[idx] || (thumbnails[idx] as any)?.image,
        keyframeImageUrl: sb.image || sceneImages[idx] || (thumbnails[idx] as any)?.image,
        videoUrl: sb.videoUrl || sceneClips[idx] || (idx === 0 ? realVideoUrl : undefined),
        status: (sb.videoUrl || sceneClips[idx] || (idx === 0 && realVideoUrl)) ? "ready" : sb.image ? "ready" : "pending",
        createdAt: renderStartedAt,
        updatedAt: renderCompletedAt,
      }));

      const isExpressNarrator = mode === "express";
      if (isExpressNarrator) {
        if (!realVoiceUrl) {
          lastError = lastError || "Voiceover generation failed or audio was missing for Narrator mode.";
        }
        if (!realVideoUrl) {
          lastError = lastError || "Narrator slideshow compilation failed to produce a verified durable video in Storage.";
        }
      }

      const isOverallSuccess = Boolean(realVideoUrl && isDurableMasterVideoReady(realVideoUrl));
      const finalStatus = isOverallSuccess ? "Completed" : "Failed";
      if (!isOverallSuccess && !lastError) {
        lastError = isExpressNarrator
          ? "Narrator slideshow compilation failed to produce a verified durable video in Storage."
          : "Video generation failed to produce a verified durable master video in permanent Storage.";
      }
      const finalMsg = isOverallSuccess
        ? `${mode.toUpperCase()} media assets synthesized and ready for executive review.`
        : lastError;

      if (updatedBrief.generatedAssets?.generationMetadata) {
        updatedBrief.generatedAssets.generationMetadata.generationStatus = finalStatus;
        updatedBrief.generatedAssets.generationMetadata.lastError = lastError;
      }

      emitProgress(isOverallSuccess ? 100 : 50, isOverallSuccess ? "Complete" : "Failed", finalMsg);

      return {
        brief: updatedBrief,
        scenes: updatedScenes,
        productionScenes: fullProductionScenes,
        audioUrl: realVoiceUrl,
        videoUrl: realVideoUrl,
      };
    } catch (err: any) {
      if (err?.name === "AbortError" || signal?.aborted) {
        console.log(`[SPARK Pipeline] Asset Generation ABORTED for Production "${production.id}"`);
        throw err;
      }
      console.warn("[ProductionAssetService] AI storyboard fallback:", err);

      const fallbackStoryboard: ProductionScene[] = [
        {
          scene: 1,
          duration: mode === "deep" ? "0-8s" : "0-5s",
          shotList: `${identityPack.aspectRatio} host master frame`,
          cameraDirection: "Push-in zoom",
          transitions: "Continuous flow",
          startState: "Host established in framing addressing camera",
          primaryChange: "Host gestures to introduce core premise",
          endState: "Host in medium frame with focused authority expression",
          onScreenText: brief.hook,
          pacing: "Fast hook",
          scriptSnippet: brief.hook,
          visualDescription: brief.visualDirection,
        },
        {
          scene: 2,
          duration: mode === "deep" ? "8-16s" : "5-25s",
          shotList: "Solution delivery and visual demonstration",
          cameraDirection: "Smooth tracking pan",
          transitions: "Seamless flow",
          startState: "Host continuing from opening frame",
          primaryChange: "Solution breakdown is revealed",
          endState: "Host positioned beside visual breakdown",
          onScreenText: brief.title,
          pacing: "Rhythmic",
          scriptSnippet: brief.scriptOutline,
          visualDescription: "Visual breakdown in same studio set",
        },
        {
          scene: 3,
          duration: mode === "deep" ? "16-24s" : "25-30s",
          shotList: "Branded CTA closing screen",
          cameraDirection: "Lock-off",
          transitions: "Subtle resolution",
          startState: "Host completing key insight delivery",
          primaryChange: "Conversion prompt and brand conclusion",
          endState: "Definitive closing frame with call to action",
          onScreenText: "SAVE THIS NOW",
          pacing: "High impact",
          scriptSnippet: brief.caption || brief.hook,
          visualDescription: "End frame with clear conversion prompt",
        },
      ];

      const fallbackResult: ProductionAssetGenerationResult = {
        brief: {
          ...brief,
          storyboard: fallbackStoryboard,
        },
        scenes: fallbackStoryboard.map((s) => ({
          scene: s.scene,
          description: `[${s.duration}] ${s.shotList} — Action: ${s.primaryChange || s.visualDescription}`,
          duration: s.duration,
        })),
      };

      return fallbackResult;
    } finally {
      stopHeartbeat();
    }
  }

  /**
   * Plan sequential production scenes based on targetDurationSec vs provider max clip length
   */
  public static planProductionScenes(params: {
    production: Production;
    brief: ProductionBrief;
    brand: Brand;
    formatSettings?: ProductionFormatSettings;
    creditSettings?: GenerationCreditSettings;
  }): ProductionScene[] {
    const { production, brief, brand, formatSettings } = params;
    const targetSec =
      formatSettings?.targetDurationSec ||
      (production as any)?.targetDurationSec ||
      (production as any)?.formatSettings?.targetDurationSec ||
      (brief as any)?.targetDurationSec ||
      (brand as any)?.formatSettings?.targetDurationSec ||
      60;
    const rawMode = (production.mode || brief.productionMode || "standard").toLowerCase();
    const mode = rawMode === "deep" || rawMode === "cinematic" ? "deep" : rawMode === "express" || rawMode === "narrator" ? "express" : "standard";

    // Dynamic Video Provider Physics: Read real single-shot native peak quality limit and legal durations
    const activeVideo = resolveActiveVideoProvider({
      preferredVideoProvider: formatSettings?.preferredVideoProvider,
    });
    const nativeMaxClipSec = activeVideo.maxVideoDurationSec || 8;
    const providerMaxClipSec = mode === "deep" ? Math.min(nativeMaxClipSec, 12) : nativeMaxClipSec;
    const isOneTake = targetSec <= providerMaxClipSec;
    const briefBeats = brief.beats || [];

    // Calculate total scenes count: enforce scene segmentation when target exceeds engine max clip
    const minScenesForDuration = Math.ceil(targetSec / providerMaxClipSec);
    const totalScenesCount = isOneTake
      ? (briefBeats.length > 0 ? Math.min(briefBeats.length, 3) : 1)
      : Math.max(minScenesForDuration, briefBeats.length);

    // Calculate per-scene legal duration snapped to provider capability map (e.g. Veo: 4|6|8s, Grok: 1..15s)
    const rawPerSceneSec = Math.max(1, Math.min(providerMaxClipSec, Math.ceil(targetSec / totalScenesCount)));
    const perSceneSec = snapToAllowedDuration(rawPerSceneSec, activeVideo.providerId);

    console.log(`[SPARK Scene Planner] Active Provider: "${activeVideo.providerId}" (Native Max: ${nativeMaxClipSec}s, Allowed: [${activeVideo.allowedDurationsSec.join(",")}]) -> Sized ${totalScenesCount} scenes (${perSceneSec}s each) for ${targetSec}s target runtime.`);

    const storyboard: any[] = (brief.storyboard as any[]) || [];
    const scenesList: ProductionScene[] = [];
    let cumulativeSec = 0;

    for (let i = 0; i < totalScenesCount; i++) {
      const idx = i + 1;
      const sbItem: any = storyboard[i] || storyboard[storyboard.length - 1];
      const beatItem = briefBeats[i] || briefBeats[briefBeats.length - 1];
      const clipUrl = brief.generatedAssets?.generatedVideos?.[i] || (i === 0 ? production.videoUrl || brief.videoUrl : undefined);

      const sceneStartSec = cumulativeSec;
      const sceneEndSec = sceneStartSec + perSceneSec;
      cumulativeSec = sceneEndSec;

      const formatTime = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      };
      const continuousTimecode = `[${formatTime(sceneStartSec)}-${formatTime(sceneEndSec)}]`;

      const resolvedSpoken = beatItem?.spokenLines || sbItem?.scriptSnippet || (idx === 1 ? brief.hook : brief.spokenCta || "");
      const resolvedOnScreen = beatItem?.onScreenText || sbItem?.onScreenText || (idx === 1 ? "HOOK" : `SCENE ${idx}`);
      const resolvedCamera = beatItem?.cameraDirection || sbItem?.cameraDirection || (mode === "deep" ? "Tracking shot" : "Medium shot");
      const job = (beatItem?.valueJob as string) || "";
      let resolvedAudio: "vo" | "talent";
      if (sbItem?.audio) {
        resolvedAudio = sbItem.audio;
      } else if (mode === "express") {
        resolvedAudio = "vo";
      } else if (mode === "deep") {
        resolvedAudio = "talent";
      } else {
        // Hybrid (standard) mode: on-camera presentation for hook/proof/payoff/cta, VO for problem/context/example/b-roll
        if (job === "hook" || job === "proof" || job === "payoff" || job === "cta") {
          resolvedAudio = "talent";
        } else if (job === "problem" || job === "context" || job === "example" || job === "myth_bust" || job === "slide" || job === "still" || job === "b-roll") {
          resolvedAudio = "vo";
        } else {
          resolvedAudio = i % 2 === 0 ? "talent" : "vo";
        }
      }

      scenesList.push({
        scene: idx,
        duration: `${perSceneSec}s`,
        shotList: sbItem?.shotList || `${continuousTimecode} Scene ${idx} framing (${beatItem?.valueJob || "content"})`,
        cameraDirection: resolvedCamera,
        transitions: sbItem?.transitions || "Seamless flow",
        onScreenText: resolvedOnScreen,
        pacing: sbItem?.pacing || "Balanced",
        scriptSnippet: resolvedSpoken,
        spokenLines: resolvedSpoken,
        audio: resolvedAudio,
        visualDescription: sbItem?.visualDescription || `${continuousTimecode} [${(beatItem?.valueJob || "beat").toUpperCase()}] ${resolvedSpoken}`,
        startState: sbItem?.startState || `Scene ${idx} start state (${formatTime(sceneStartSec)})`,
        endState: sbItem?.endState || `Scene ${idx} end state (${formatTime(sceneEndSec)})`,
        primaryChange: sbItem?.primaryChange || resolvedSpoken,
        image: sbItem?.image || (brief.generatedAssets?.thumbnails?.[i] as any)?.image || undefined,
        videoUrl: clipUrl,
        id: `scene-${production.id}-${idx}`,
        productionId: production.id,
        brandId: (brand as any).id,
        index: idx,
        durationSec: perSceneSec,
        action: sbItem?.primaryChange || resolvedSpoken,
        camera: resolvedCamera,
        scriptBeat: resolvedSpoken,
        keyframeImageUrl: sbItem?.image || (brief.generatedAssets?.thumbnails?.[i] as any)?.image || undefined,
        status: clipUrl ? "ready" : "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return scenesList;
  }

  /**
   * Fix / regenerate a specific scene index with editNotes without touching neighboring scenes
   */
  public static async fixProductionScene(params: {
    productionId: string;
    sceneIndex: number;
    editNotes: string;
    brand: Brand;
    character?: Character;
    production: Production;
    memoryItems?: import("../../domain/types").MemoryItem[];
  }): Promise<ProductionScene | null> {
    const { productionId, sceneIndex, editNotes, brand, character, production, memoryItems = [] } = params;
    const brief = production.brief || ({} as ProductionBrief);
    const existingScenes = production.productionScenes || ProductionAssetService.planProductionScenes({
      production,
      brief,
      brand,
      formatSettings: getEffectiveFormatSettings({
        formatSettings: (production as any)?.formatSettings || (brief as any)?.formatSettings,
        brand,
      }),
    });
    const targetSceneIdx = existingScenes.findIndex((s) => (s.index || s.scene) === sceneIndex);

    if (targetSceneIdx < 0) return null;
    const sceneToFix = existingScenes[targetSceneIdx];
    sceneToFix.status = "generating";
    sceneToFix.editNotes = editNotes;

    try {
      const identityPack = buildLockedIdentityPack({ brand, character, brief, production });
      const promptPack = getProductionPromptPack({
        brand,
        character,
        brief,
        production,
        aspectRatio: identityPack.aspectRatio,
        characterRefUrl: identityPack.characterReferenceImageUrl,
        memoryItems,
      });

      // Adjacent continuity seed: previous scene's last frame or keyframe
      const prevScene = existingScenes[targetSceneIdx - 1];
      const fixVisualLock = buildVisualLockRefs({
        character,
        storyboardGridUrl: (brief as any).storyboardGridUrl,
        sceneKeyframeUrl: sceneToFix.image || sceneToFix.keyframeImageUrl,
        previousLastFrameUrl: prevScene?.lastFrameUrl || prevScene?.keyframeImageUrl || prevScene?.image,
      });

      const beatPrompt = `
${fixVisualLock.refPromptHeader}
${promptPack.globalLockBlock}

FIX REVISION FOR SCENE ${sceneIndex}:
Original Beat Action: ${sceneToFix.action || sceneToFix.scriptBeat || sceneToFix.visualDescription}
EXECUTIVE REVISION REASON: "${editNotes}"
Apply revision while maintaining 100% subject identity and set continuity.
`.trim();

      const fixTargetDuration = sceneToFix.durationSec || parseInt(sceneToFix.duration) || 8;
      const generatedClip = await ModelRouter.executeCategoryRequest("videoGeneration", {
        prompt: beatPrompt,
        referenceImageUrl: fixVisualLock.primaryRefUrl,
        referenceImageUrls: fixVisualLock.imageUrls,
        aspectRatio: identityPack.aspectRatio,
        durationSec: fixTargetDuration,
      });

      let finalClipUrl = generatedClip;
      if (isPlayableVideoUrl(generatedClip)) {
        try {
          const storedAsset = await ProductionAssetService.uploadAssetToStorage({
            productionId,
            brandId: (brand as any).id,
            assetType: "video",
            storagePath: `brands/${(brand as any).id || "default-brand"}/${productionId}/scenes/scene_${sceneIndex}_rev_${Date.now()}.mp4`,
            dataUrlOrBlob: generatedClip,
            mimeType: "video/mp4",
            prompt: beatPrompt,
            provider: "ModelRouter",
          });
          if (storedAsset?.publicUrl) finalClipUrl = storedAsset.publicUrl;
        } catch {}
      }

      sceneToFix.videoUrl = finalClipUrl;
      sceneToFix.status = isPlayableVideoUrl(finalClipUrl) ? "ready" : "needs_edit";
      sceneToFix.updatedAt = new Date().toISOString();

      return sceneToFix;
    } catch (err: any) {
      sceneToFix.status = "needs_edit";
      sceneToFix.lastError = err?.message || String(err);
      return sceneToFix;
    }
  }

  /**
   * Concatenate ready scene video clips in index order into one master video
   */
  public static async mergeProductionScenes(params: {
    productionId: string;
    production: Production;
    brand: Brand;
  }): Promise<string | null> {
    const { productionId, production, brand } = params;
    const brief = production.brief || ({} as ProductionBrief);
    const scenes = production.productionScenes || [];

    const readyClips = scenes
      .filter((s) => (s.status === "ready" || s.status === "approved") && s.videoUrl)
      .sort((a, b) => (a.index || a.scene) - (b.index || b.scene))
      .map((s) => s.videoUrl!);

    if (readyClips.length === 0) {
      return (isDurableMasterVideoReady(production.videoUrl) ? production.videoUrl : null) || null;
    }

    if (readyClips.length === 1) {
      if (isDurableMasterVideoReady(readyClips[0])) {
        production.videoUrl = readyClips[0];
        brief.videoUrl = readyClips[0];
        if (!brief.generatedAssets) brief.generatedAssets = {};
        brief.generatedAssets.generatedVideos = [readyClips[0]];
        return readyClips[0];
      }
    }

    const allScenesVo = scenes.length > 0 && scenes.every((s) => s.audio === "vo");
    const mergeAudioUrl = allScenesVo ? (brief.audioUrl || production.audioUrl) : undefined;
    const targetMergeTexts = scenes.map((s, idx) => {
      const primaryOnScreen = s.onScreenText;
      if (primaryOnScreen) {
        const formatted = formatBurnedOnScreenText(primaryOnScreen);
        if (formatted) return formatted;
      }
      const beatOnScreen = brief.beats?.[idx]?.onScreenText;
      if (beatOnScreen) {
        const formatted = formatBurnedOnScreenText(beatOnScreen);
        if (formatted) return formatted;
      }
      if (idx === 0 && brief.hook) {
        return formatBurnedOnScreenText(brief.hook);
      }
      return "";
    });

    try {
      const { mergeSceneVideos } = await import("./sceneVideoMerger");
      const mergeResult = await mergeSceneVideos({
        videoUrls: readyClips,
        audioUrl: mergeAudioUrl,
        onScreenTexts: targetMergeTexts,
      });

      if (!mergeResult || !mergeResult.blob || mergeResult.blob.size === 0) {
        console.warn("[ProductionAssetService] Merge produced empty result.");
        return null;
      }

      const storedMaster = await ProductionAssetService.uploadAssetToStorage({
        productionId,
        brandId: (brand as any).id,
        assetType: "video",
        storagePath: `brands/${(brand as any).id || "default-brand"}/${productionId}/video/master.mp4`,
        dataUrlOrBlob: mergeResult.blob,
        mimeType: mergeResult.mimeType,
        prompt: "Merged Master Video from Approved Scene Sequence",
        provider: "SceneVideoMerger",
      });

      if (storedMaster?.publicUrl && isDurableMasterVideoReady(storedMaster.publicUrl)) {
        const masterUrl = storedMaster.publicUrl;
        production.videoUrl = masterUrl;
        brief.videoUrl = masterUrl;
        if (!brief.generatedAssets) brief.generatedAssets = {};
        brief.generatedAssets.generatedVideos = [masterUrl];
        production.status = "Ready for Review";
        return masterUrl;
      }

      return null;
    } catch (err) {
      console.error("[ProductionAssetService] Merge execution notice:", err);
      return null;
    }
  }
}
