import type { Production, ProductionBrief, ProductionScene, Brand, Character, ProductionAsset } from "../../domain/types";
import { ModelRouter } from "../runtime/modelRouter";
import { CapabilityRegistry } from "../capabilityRegistry";
import { ProductionGenerationGuard } from "./ProductionGenerationGuard";

export const SPARK_STORAGE_BUCKET = "Spark";

export interface ProductionAssetGenerationResult {
  brief: ProductionBrief;
  scenes: { scene: number; description: string; duration: string }[];
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
    character?.imageUrl || character?.characterSheetUrl || character?.avatarUrl || undefined;

  const rawMode = (production.mode || brief.productionMode || "standard").toLowerCase();
  const mode: "express" | "standard" | "deep" =
    rawMode === "deep" || rawMode === "cinematic"
      ? "deep"
      : rawMode === "express" || rawMode === "narrator"
      ? "express"
      : "standard";

  const aspectRatio =
    mode === "deep" && production.aspectRatio
      ? production.aspectRatio
      : production.aspectRatio || (mode === "deep" ? "16:9" : "9:16");

  const identityBlock = `CHARACTER & WARDROBE LOCK: Primary subject is "${character?.name || "Host"}". Persona: ${character?.style || "Executive Presenter"}. Traits: ${(character?.traits || ["Visionary", "Authoritative", "Magnetic"]).join(", ")}. CONTINUITY LAW: Exact same person, consistent facial structure, identical hair and wardrobe styling across every single scene. Absolutely no character drifting, no face morphing, no outfit changes.`;

  const setBlock = `SET & LIGHTING CONTINUITY: Environment is "${brief.visualDirection || "a high-end executive studio with refined architectural lighting"}". Lighting: Premium cinematic studio lighting, coherent shadows and color temperature aligned with ${brand.name || "Brand"}. Same physical space and atmosphere across all scenes.`;

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
  };
}

export class ProductionAssetService {
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
    dataUrlOrBlob: string;
    mimeType: string;
    prompt?: string;
    provider?: string;
  }): Promise<{ publicUrl: string; storagePath: string; assetId: string; driveFileId?: string; driveWebViewLink?: string; uploadSuccess: boolean }> {
    const { productionId, brandId = "default-brand", assetType, storagePath, dataUrlOrBlob, mimeType, prompt, provider } = params;
    const assetId = `pa-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    let finalPublicUrl = dataUrlOrBlob;
    let driveFileId: string | undefined = undefined;
    let driveWebViewLink: string | undefined = undefined;
    let uploadSuccess = false;

    let uploadBlob: Blob | null = null;
    if (dataUrlOrBlob.startsWith("data:")) {
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
    onProgress?: (progress: import("../../domain/types").GenerationProgress) => void;
    forceRegenerate?: boolean;
    signal?: AbortSignal;
  }): Promise<ProductionAssetGenerationResult> {
    const { production, brief, brand, character, onProgress, forceRegenerate, signal } = params;
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
    let realVoiceUrl: string | undefined = undefined;
    let realVideoUrl: string | undefined = undefined;
    let lastError: string | undefined = undefined;

    const bId = (brand as any)?.id || "default-brand";
    const getStoragePath = (sub: string) => `brands/${bId}/${production.id}/${sub}`;

    const persistCurrentStage = async (stageName: string) => {
      try {
        const { persistProductionUpdate, persistReviewUpdate } = await import("../../backend/workspaceSync");
        const stageBrief: ProductionBrief = {
          ...brief,
          storyboard: currentStoryboard.length > 0 ? currentStoryboard : brief.storyboard,
          generatedAssets: {
            ...brief.generatedAssets,
            thumbnails: currentThumbnails,
            voiceoverUrl: realVoiceUrl,
            generatedFrames: currentStoryboard.map((s) => s.image).filter(Boolean) as string[],
            generatedVideos: realVideoUrl ? [realVideoUrl] : undefined,
          },
          audioUrl: realVoiceUrl,
          videoUrl: realVideoUrl,
        };
        await persistProductionUpdate(production.id, {
          brief: stageBrief,
          audioUrl: realVoiceUrl,
          videoUrl: realVideoUrl,
          scenes: stageBrief.storyboard,
        });
        console.log(`[SPARK Pipeline] Persistent stage saved to Supabase -> ${stageName} (prod ${production.id})`);
      } catch (stageSyncErr) {
        console.warn(`[SPARK Pipeline] Stage ${stageName} cloud sync notice:`, stageSyncErr);
      }
    };

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
      if (onProgress) {
        onProgress({
          percent: Math.min(100, Math.max(0, percent)),
          stage,
          stages: stages.map((s) => ({ ...s })),
          message,
          updatedAt: new Date().toISOString(),
          partialAssets: {
            storyboard: (partialOverride?.storyboard ?? currentStoryboard).map((s) => ({
              scene: s.scene,
              description: s.shotList || s.visualDescription || `Scene ${s.scene}`,
              duration: s.duration,
              image: s.image,
              videoUrl: s.videoUrl,
            })),
            thumbnails: partialOverride?.thumbnails ?? (currentThumbnails.length > 0 ? currentThumbnails.map((t) => ({ ...t })) : undefined),
            voiceUrl: partialOverride?.voiceUrl ?? realVoiceUrl,
            videoUrl: partialOverride?.videoUrl ?? realVideoUrl,
            lastError: partialOverride?.lastError ?? lastError,
          },
        });
      }
    };

    emitProgress(5, "Storyboard", `Synthesizing ${mode.toUpperCase()} (${aspectRatio}) continuous storyboard...`);

    // PART 2 — Mode-Specific Storyboard Generation Prompt
    let systemInstruction = "";
    let prompt = "";

    if (mode === "deep") {
      systemInstruction = `You are SPARK's Senior Film Director specializing in Continuous One-Take Cinematic Craft. Structure a seamless 3-stage continuous sequence where every stage opens exactly where the previous stage ended, with locked identity, set continuity, and exactly one primary change per stage. Forbid montage cuts, teleportation, or unrelated B-roll cuts. Output valid JSON only.`;

      prompt = `
Create a 3-stage continuous one-take cinematic storyboard (${aspectRatio}) for:

TITLE: "${brief.title}"
BRAND: "${brand.name}" (${brand.niche})
HOST: "${character?.name || "Host"}" (${character?.style || "Executive Director"})
HOOK: "${brief.hook}"
SCRIPT OUTLINE: "${brief.scriptOutline}"
VISUAL DIRECTION: "${brief.visualDirection}"

CONTINUITY LAWS FOR DEEP / CINEMATIC MODE:
- 3 continuous stages:
  * Stage 1 (0-8s): Opening action establishing host & setting -> explicit endState.
  * Stage 2 (8-16s): Opens EXACTLY on Stage 1's endState -> introduces ONE primary change -> explicit endState.
  * Stage 3 (16-24s): Opens EXACTLY on Stage 2's endState -> introduces ONE final primary change -> final resolution endState.
- Exactly ONE primary change per stage.
- Locked identity, wardrobe, and studio set across all 3 stages.
- No unrelated hard-cut montage or stock cutaways.

Return valid JSON with exactly this structure:
{
  "storyboard": [
    {
      "scene": 1,
      "duration": "0-8s",
      "shotList": "Presenter direct-to-camera ${aspectRatio} master shot establishing scene",
      "cameraDirection": "Slow cinematic push-in with subtle lateral glide",
      "transitions": "Continuous one-take flow",
      "startState": "Host stands in studio, looking into lens, holding tablet with initial data",
      "primaryChange": "Host turns slightly as ambient background lighting dims to emphasize key metric",
      "endState": "Host centered in frame, gesturing right, backlight highlighting focused expression",
      "onScreenText": "${(typeof brief.hook === 'string' ? brief.hook : '').slice(0, 50)}",
      "pacing": "Deliberate and cinematic",
      "scriptSnippet": "${(typeof brief.hook === 'string' ? brief.hook : '').slice(0, 60)}",
      "visualDescription": "High contrast executive opening shot with locked lighting and host presence"
    },
    {
      "scene": 2,
      "duration": "8-16s",
      "shotList": "Medium-close continuation with subtle camera drift",
      "cameraDirection": "Motivated lateral tracking following host movement",
      "transitions": "Seamless continuous motion",
      "startState": "Host centered in frame, gesturing right from Stage 1 end state",
      "primaryChange": "Host steps toward camera as holographic analytical breakdown illuminates beside them",
      "endState": "Host in medium close-up, hand raised near interactive holographic interface",
      "onScreenText": "CORE STRATEGY BREAKDOWN",
      "pacing": "Controlled build",
      "scriptSnippet": "${(typeof brief.scriptOutline === 'string' ? brief.scriptOutline : '').slice(0, 80)}",
      "visualDescription": "Seamless continuation in same studio set, showcasing strategic revelation"
    },
    {
      "scene": 3,
      "duration": "16-24s",
      "shotList": "Hero climax resolution and closing authority stance",
      "cameraDirection": "Lock-off settling into authoritative master composition",
      "transitions": "Subtle light fade to brand insignia",
      "startState": "Host in medium close-up beside interactive interface from Stage 2 end state",
      "primaryChange": "Holographic graphic resolves into clear conversion call to action as host faces camera directly",
      "endState": "Host firmly addressing viewer with definitive closing expression in balanced studio light",
      "onScreenText": "TAKE ACTION NOW",
      "pacing": "Decisive closing impact",
      "scriptSnippet": "${(typeof brief.caption === 'string' ? brief.caption : '').slice(0, 60)}",
      "visualDescription": "Final authoritative delivery in unchanged set with clear brand resolution"
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
      systemInstruction = `You are SPARK's Rapid Short-Form Creative Director. Structure a fast, punchy 2-to-3 stage vertical 9:16 social production with staged continuity and high hook retention. Return valid JSON only.`;

      prompt = `
Create a rapid short-form production storyboard (9:16 vertical) for:

TITLE: "${brief.title}"
BRAND: "${brand.name}" (${brand.niche})
HOST: "${character?.name || "Host"}" (${character?.style || "Executive Presenter"})
HOOK: "${brief.hook}"
SCRIPT OUTLINE: "${brief.scriptOutline}"

CONTINUITY RULES FOR EXPRESS MODE:
- 2–3 stages (~15–30s total duration).
- High visual hook energy, immediate engagement, and continuous staged state progression.
- Exact same host identity and outfit across scenes.

Return valid JSON with exactly this structure:
{
  "storyboard": [
    {
      "scene": 1,
      "duration": "0-6s",
      "shotList": "Presenter direct-to-camera dynamic hook",
      "cameraDirection": "Quick snap push-in",
      "transitions": "Continuous flow",
      "startState": "Host centered looking directly into camera with intense hook expression",
      "primaryChange": "Host gestures dynamically as bold headline appears",
      "endState": "Host holding position pointing to key visual",
      "onScreenText": "${(typeof brief.hook === 'string' ? brief.hook : '').slice(0, 45)}",
      "pacing": "Fast hook",
      "scriptSnippet": "${(typeof brief.hook === 'string' ? brief.hook : '').slice(0, 60)}",
      "visualDescription": "High energy vertical framing with clean studio lighting"
    },
    {
      "scene": 2,
      "duration": "6-20s",
      "shotList": "Presenter demonstration in same environment",
      "cameraDirection": "Steady medium frame",
      "transitions": "Smooth momentum",
      "startState": "Host continuing from hook end state",
      "primaryChange": "Demonstrates the core insight directly to viewer",
      "endState": "Host delivers the core solution conclusion",
      "onScreenText": "THE SOLUTION",
      "pacing": "High retention",
      "scriptSnippet": "${(typeof brief.scriptOutline === 'string' ? brief.scriptOutline : '').slice(0, 80)}",
      "visualDescription": "Direct demonstration in locked studio set"
    },
    {
      "scene": 3,
      "duration": "20-30s",
      "shotList": "Closing CTA and action prompt",
      "cameraDirection": "Lock-off",
      "transitions": "Snap to brand insignia",
      "startState": "Host in delivery position from scene 2",
      "primaryChange": "Direct conversion call to action",
      "endState": "Host smiling with definitive closing gesture",
      "onScreenText": "FOLLOW FOR MORE",
      "pacing": "Decisive",
      "scriptSnippet": "${(typeof brief.caption === 'string' ? brief.caption : '').slice(0, 60)}",
      "visualDescription": "Crisp closing frame with high contrast brand highlight"
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
      systemInstruction = `You are SPARK's Senior Production Producer. Structure a balanced 3-stage video production (9:16 vertical) with staged continuity between scenes. Return valid JSON only.`;

      prompt = `
Create a 3-stage vertical (9:16) production storyboard and asset manifest for:

TITLE: "${brief.title}"
BRAND: "${brand.name}" (${brand.niche})
HOST: "${character?.name || "Host"}" (${character?.style || "Executive Presenter"})
HOOK: "${brief.hook}"
SCRIPT OUTLINE: "${brief.scriptOutline}"
VISUAL DIRECTION: "${brief.visualDirection}"

CONTINUITY RULES FOR STANDARD MODE:
- Stage 1 (0-8s): Hook & establishing opening state -> endState.
- Stage 2 (8-18s): Solution delivery continuing from Stage 1 endState -> endState.
- Stage 3 (18-30s): Resolution & CTA continuing from Stage 2 endState -> final endState.
- Exact same host identity and studio set throughout.

Return valid JSON with exactly this structure:
{
  "storyboard": [
    {
      "scene": 1,
      "duration": "0-8s",
      "shotList": "Presenter direct-to-camera vertical 9:16 framing",
      "cameraDirection": "Push-in slow zoom",
      "transitions": "Continuous flow",
      "startState": "Host standing in executive studio addressing viewer",
      "primaryChange": "Host raises tablet presenting the challenge",
      "endState": "Host centered with focused expression holding visual aid",
      "onScreenText": "${(typeof brief.hook === 'string' ? brief.hook : '').slice(0, 50)}",
      "pacing": "Fast hook",
      "scriptSnippet": "${(typeof brief.hook === 'string' ? brief.hook : '').slice(0, 60)}",
      "visualDescription": "High contrast executive presenter opening frame"
    },
    {
      "scene": 2,
      "duration": "8-18s",
      "shotList": "Analytical breakdown in same studio set",
      "cameraDirection": "Smooth tracking pan",
      "transitions": "Seamless motion",
      "startState": "Host established from scene 1 end state",
      "primaryChange": "Core solution graphics appear beside host",
      "endState": "Host gestures toward key strategic takeaway",
      "onScreenText": "THE FORMULA",
      "pacing": "Rhythmic",
      "scriptSnippet": "${(typeof brief.scriptOutline === 'string' ? brief.scriptOutline : '').slice(0, 80)}",
      "visualDescription": "Visual breakdown in sleek studio setting"
    },
    {
      "scene": 3,
      "duration": "18-30s",
      "shotList": "Presenter conversion CTA card",
      "cameraDirection": "Static lock-off",
      "transitions": "Fade to brand logo",
      "startState": "Host in position from scene 2 end state",
      "primaryChange": "Host delivers final call to action",
      "endState": "Host delivering definitive closing statement",
      "onScreenText": "START TODAY",
      "pacing": "High impact closing",
      "scriptSnippet": "${(typeof brief.caption === 'string' ? brief.caption : '').slice(0, 60)}",
      "visualDescription": "End screen card with clear brand resolution"
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

    try {
      checkAborted();
      console.log(`[SPARK Pipeline] Provider Request: ${mode.toUpperCase()} Storyboard structure via ModelRouter...`);
      const rawResponse = await ModelRouter.executeCategoryRequest("production", {
        prompt,
        systemInstruction,
      });

      checkAborted();
      console.log(`[SPARK Pipeline] Provider Response: Storyboard structure received (${rawResponse.length} chars)`);

      const cleanJson = rawResponse.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);

      const storyboard: ProductionScene[] = Array.isArray(parsed.storyboard) ? parsed.storyboard : [];
      const thumbnails = Array.isArray(parsed.thumbnails) ? parsed.thumbnails : [];

      currentStoryboard = storyboard;
      currentThumbnails = thumbnails.map((t: any, idx: number) => ({
        id: t.id || `t${idx + 1}`,
        variant: t.variant || ["A", "B", "C"][idx] || "A",
        concept: t.concept || `Variant ${t.variant || "A"}`,
      }));

      stages[0].status = "done";
      stages[1].status = "active";
      emitProgress(12, "Voice", "Synthesizing executive voiceover narration...");

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

      // Synthesize real voiceover audio via ElevenLabs (with brand voiceId) -> Provider TTS pipeline (or reuse if present)
      checkAborted();
      if (!forceRegenerate && isValidMediaData(production.audioUrl || brief.audioUrl)) {
        realVoiceUrl = production.audioUrl || brief.audioUrl;
        console.log(`[SPARK Pipeline] Reusing existing voiceover audio -> ${realVoiceUrl}`);
      } else {
        try {
          const voiceScript = `${brief.hook}. ${brief.scriptOutline}`.trim();
          const targetVoiceId = character?.voice?.voiceId;
          const { generateElevenLabsVoice } = await import("../runtime/providers/elevenLabsTTS");
          const elevenVoice = await generateElevenLabsVoice(voiceScript, targetVoiceId, undefined, signal);
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
            const synthesizedVoice = await generateSuperSparkVoice(voiceScript);
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
      }

      stages[1].status = realVoiceUrl ? "done" : "failed";
      await persistCurrentStage("Voice");
      stages[2].status = "active";
      emitProgress(20, "Keyframes", `Rendering ${aspectRatio} scene keyframes (Target Hero Frames)...`);

      // PART 1 & 4 — Scene Keyframe Image Generation with Locked Identity Pack targeting END FRAME
      const sceneImages: string[] = [];
      const renderStartedAt = new Date().toISOString();

      try {
        const { ModelRouter } = await import("../runtime/modelRouter");
        const totalScenes = storyboard.length || 3;
        for (let sIdx = 0; sIdx < storyboard.length; sIdx++) {
          checkAborted();
          const scene = storyboard[sIdx];
          if (!forceRegenerate && isValidMediaData(scene.image)) {
            console.log(`[SPARK Pipeline] Reusing existing Scene ${sIdx + 1} image -> ${scene.image}`);
            sceneImages.push(scene.image);
            currentStoryboard[sIdx] = { ...scene, image: scene.image };
            const currentPct = 20 + Math.round(((sIdx + 1) / totalScenes) * 35);
            emitProgress(currentPct, "Keyframes", `Verified keyframe ${sIdx + 1} of ${totalScenes}...`);
            continue;
          }

          const imagePrompt = `
[${identityPack.aspectRatio} ${mode.toUpperCase()} PRODUCTION KEYFRAME - SCENE ${sIdx + 1} OF ${totalScenes}]
TARGET HERO / END FRAME: ${scene.endState || scene.visualDescription || scene.shotList}
SCENE ACTION: ${scene.primaryChange || scene.visualDescription}
CAMERA FRAMING: ${scene.cameraDirection || "Cinematic framing"}
${identityPack.combinedPromptPrefix}
Hook Context: "${brief.hook}". Brand: ${brand.name}
`.trim();

          try {
            checkAborted();
            console.log(`[SPARK Pipeline] Provider Request: Scene ${sIdx + 1} hero keyframe via ModelRouter ("storyboardImages")...`);
            const imgUrl = await ModelRouter.executeCategoryRequest("storyboardImages", {
              prompt: imagePrompt,
              referenceImageUrl: identityPack.characterReferenceImageUrl,
              aspectRatio: identityPack.aspectRatio,
            });
            checkAborted();
            console.log(`[SPARK Pipeline] Provider Response: Scene ${sIdx + 1} image received (${imgUrl ? imgUrl.slice(0, 50) + "..." : "none"})`);
            if (isValidMediaData(imgUrl)) {
              let finalImg = imgUrl;
              try {
                const storedImg = await this.uploadAssetToStorage({
                  productionId: production.id,
                  brandId: (brand as any).id,
                  assetType: "frame",
                  storagePath: `${production.id}/frames/scene-0${sIdx + 1}.png`,
                  dataUrlOrBlob: imgUrl,
                  mimeType: "image/png",
                  prompt: imagePrompt,
                  provider: "ModelRouter",
                });
                if (storedImg?.publicUrl) finalImg = storedImg.publicUrl;
                console.log(`[SPARK Pipeline] Storage Upload: Scene ${sIdx + 1} -> ${finalImg}`);
              } catch (storageErr) {
                console.warn(`[SPARK Pipeline] Scene ${sIdx + 1} upload failed, retaining provider URL:`, storageErr);
              }
              sceneImages.push(finalImg);
              scene.image = finalImg;
              currentStoryboard[sIdx] = { ...scene, image: finalImg };
            } else {
              console.warn(`[SPARK Pipeline] Scene ${sIdx + 1} returned empty/invalid image data:`, String(imgUrl || "").slice(0, 100));
              if (!lastError) lastError = `Scene ${sIdx + 1} Keyframe: No image bytes returned by provider`;
            }
          } catch (sceneErr: any) {
            if (sceneErr?.name === "AbortError" || signal?.aborted) throw sceneErr;
            console.error(`[SPARK Pipeline] Scene ${scene.scene} image generation failed:`, sceneErr);
            if (!lastError) lastError = `Scene ${sIdx + 1} Keyframe: ${sceneErr?.message || String(sceneErr)}`;
          }

          const currentPct = 20 + Math.round(((sIdx + 1) / totalScenes) * 35);
          emitProgress(currentPct, "Keyframes", `Rendered keyframe ${sIdx + 1} of ${totalScenes}...`);
        }
      } catch (imgErr: any) {
        if (imgErr?.name === "AbortError" || signal?.aborted) throw imgErr;
        console.error("[SPARK Pipeline] Storyboard image generation notice:", imgErr);
        if (!lastError) lastError = `Keyframe Stage: ${imgErr?.message || String(imgErr)}`;
      }

      stages[2].status = sceneImages.length > 0 ? "done" : "failed";
      await persistCurrentStage("Keyframes");
      stages[3].status = "active";
      emitProgress(58, "Thumbnails", "Generating Proposed Thumbnail Variants with Locked Identity...");

      // Thumbnail Variants Image Generation Loop via ModelRouter with Locked Identity Pack
      const enrichedThumbnails: { id: string; variant: string; concept: string; image?: string; url?: string }[] = [];
      try {
        const { ModelRouter } = await import("../runtime/modelRouter");
        const totalThumbs = thumbnails.length || 3;
        for (let tIdx = 0; tIdx < thumbnails.length; tIdx++) {
          checkAborted();
          const thumb = thumbnails[tIdx];
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

          const thumbPrompt = `
[${identityPack.aspectRatio} HIGH IMPACT THUMBNAIL VARIANT ${variantLetter}]
CONCEPT: ${thumb.concept}
HOOK: "${brief.hook}"
${identityPack.combinedPromptPrefix}
Brand: ${brand.name}
`.trim();

          let thumbUrl: string | undefined = undefined;

          try {
            checkAborted();
            console.log(`[SPARK Pipeline] Provider Request: Thumbnail Variant ${variantLetter} image via ModelRouter...`);
            const thumbImgData = await ModelRouter.executeCategoryRequest("storyboardImages", {
              prompt: thumbPrompt,
              referenceImageUrl: identityPack.characterReferenceImageUrl,
              aspectRatio: identityPack.aspectRatio,
            });
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
      if (!forceRegenerate && isValidMediaData(production.videoUrl || brief.videoUrl)) {
        realVideoUrl = production.videoUrl || brief.videoUrl;
        console.log(`[SPARK Pipeline] Reusing existing master video -> ${realVideoUrl}`);
        if (currentStoryboard.length > 0) {
          currentStoryboard.forEach((s) => {
            if (!s.videoUrl) s.videoUrl = realVideoUrl;
          });
        }
      } else {
        try {
          const { ModelRouter } = await import("../runtime/modelRouter");
          const totalVideoStages = currentStoryboard.length || 3;

          for (let sIdx = 0; sIdx < currentStoryboard.length; sIdx++) {
            checkAborted();
            const scene = currentStoryboard[sIdx];
            const sceneStill = scene.image || sceneImages[sIdx];

            const stageMotionPrompt = `
[${identityPack.aspectRatio} CINEMATIC MOTION - STAGE ${sIdx + 1} OF ${totalVideoStages}]
INITIAL FRAME / START STATE: ${scene.startState || "Host established in framing"}
PRIMARY ACTION / CHANGE: ${scene.primaryChange || scene.visualDescription}
CAMERA MOVEMENT: ${scene.cameraDirection || "Motivated smooth camera motion"}
DESTINATION / END STATE: ${scene.endState || "Target composition reached"}
${identityPack.combinedPromptPrefix}
Script snippet: "${scene.scriptSnippet || brief.hook}"
`.trim();

            console.log(`[SPARK Pipeline] Provider Request: Video stage ${sIdx + 1} via ModelRouter ("videoGeneration") [Image conditioned: ${Boolean(sceneStill)}]...`);

            try {
              checkAborted();
              const generatedClip = await ModelRouter.executeCategoryRequest("videoGeneration", {
                prompt: stageMotionPrompt,
                referenceImageUrl: sceneStill || undefined,
                aspectRatio: identityPack.aspectRatio,
              });
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
                  if (storedClip?.publicUrl) finalClip = storedClip.publicUrl;
                  console.log(`[SPARK Pipeline] Storage Upload: Stage ${sIdx + 1} Video -> ${finalClip}`);
                } catch (storageErr: any) {
                  console.warn(`[SPARK Pipeline] Video stage ${sIdx + 1} upload failed, retaining provider URL:`, storageErr);
                }

                scene.videoUrl = finalClip;
                sceneClips.push(finalClip);
                if (!realVideoUrl) realVideoUrl = finalClip;
              } else {
                console.warn(`[SPARK Pipeline] Video stage ${sIdx + 1} returned empty/invalid video data`);
              }
            } catch (stageVidErr: any) {
              if (stageVidErr?.name === "AbortError" || signal?.aborted) throw stageVidErr;
              console.warn(`[SPARK Pipeline] Video stage ${sIdx + 1} generation notice:`, stageVidErr);
              if (!lastError) lastError = `Video Stage ${sIdx + 1}: ${stageVidErr?.message || String(stageVidErr)}`;
            }

            const currentPct = 80 + Math.round(((sIdx + 1) / totalVideoStages) * 15);
            emitProgress(currentPct, "Video", `Rendered video stage ${sIdx + 1} of ${totalVideoStages}...`);
          }

          // If stage clips were generated, set primary video to first clip or master
          if (sceneClips.length > 0 && !realVideoUrl) {
            realVideoUrl = sceneClips[0];
          }

          // If no individual clips succeeded, perform single master fallback video request
          if (!realVideoUrl) {
            checkAborted();
            const masterPrompt = `
[${identityPack.aspectRatio} ${mode.toUpperCase()} MASTER VIDEO PREVIEW]
TITLE: "${brief.title}"
HOOK: "${brief.hook}"
VISUAL DIRECTION: "${brief.visualDirection}"
${identityPack.combinedPromptPrefix}
`.trim();
            const fallbackMaster = await ModelRouter.executeCategoryRequest("videoGeneration", {
              prompt: masterPrompt,
              referenceImageUrl: sceneImages[0] || undefined,
              aspectRatio: identityPack.aspectRatio,
            });
            checkAborted();
            if (isValidMediaData(fallbackMaster)) {
              let finalVid = fallbackMaster;
              try {
                const storedVid = await this.uploadAssetToStorage({
                  productionId: production.id,
                  brandId: (brand as any).id,
                  assetType: "video",
                  storagePath: getStoragePath("video/master.mp4"),
                  dataUrlOrBlob: fallbackMaster,
                  mimeType: "video/mp4",
                  prompt: masterPrompt,
                  provider: "ModelRouter",
                });
                if (storedVid?.publicUrl) finalVid = storedVid.publicUrl;
              } catch (storageErr: any) {
                console.warn("[SPARK Pipeline] Fallback video upload failed, retaining provider URL:", storageErr);
              }
              realVideoUrl = finalVid;
              sceneClips.push(finalVid);
              currentStoryboard.forEach((s) => {
                if (!s.videoUrl) s.videoUrl = finalVid;
              });
            }
          }
        } catch (vidErr: any) {
          if (vidErr?.name === "AbortError" || signal?.aborted) throw vidErr;
          console.error("[SPARK Pipeline] Video generation failed:", vidErr);
          if (!lastError) lastError = `Video Generation: ${vidErr?.message || String(vidErr)}`;
        }
      }

      checkAborted();
      const isVideoSuccess = Boolean(realVideoUrl && isValidMediaData(realVideoUrl));
      stages[4].status = isVideoSuccess ? "done" : "failed";
      stages[5].status = isVideoSuccess ? "done" : "failed";

      await persistCurrentStage("Video");

      emitProgress(
        isVideoSuccess ? 96 : 85,
        isVideoSuccess ? "Saving" : "Failed",
        isVideoSuccess ? "Synchronizing storage assets & metadata..." : "Video synthesis stage failed to produce playable video.",
        { videoUrl: realVideoUrl, lastError }
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
          storyboard: currentStoryboard.map((s) => ({
            scene: s.scene,
            description: s.shotList || s.visualDescription || `Scene ${s.scene}`,
            duration: s.duration,
            image: s.image,
            videoUrl: s.videoUrl,
          })),
          thumbnails: enrichedThumbnails.length > 0 ? enrichedThumbnails : thumbnails,
          voiceUrl: realVoiceUrl,
          videoUrl: realVideoUrl,
          lastError: isVideoSuccess ? lastError : (lastError || "Video stage failed to produce a valid video URL."),
        },
      };

      const updatedBrief: ProductionBrief = {
        ...brief,
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
        generatedAssets: {
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
            generationStatus: realVideoUrl || sceneImages.length > 0 ? "Completed" : "Failed",
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

      emitProgress(100, "Complete", `${mode.toUpperCase()} media assets synthesized and ready for executive review.`);

      return {
        brief: updatedBrief,
        scenes: updatedScenes,
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
    }
  }
}
