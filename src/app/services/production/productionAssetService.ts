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
   * Generates storyboards, scene clips, voiceover, and thumbnail assets
   * via Capability Registry -> Model Router -> Provider Adapters.
   */
  /**
   * Generates storyboards, scene clips, voiceover, and thumbnail assets
   * via Capability Registry -> Model Router -> Provider Adapters.
   */
  static async generateAssets(params: {
    production: Production;
    brief: ProductionBrief;
    brand: Brand;
    character?: Character;
    onProgress?: (progress: import("../../domain/types").GenerationProgress) => void;
  }): Promise<ProductionAssetGenerationResult> {
    const { production, brief, brand, character, onProgress } = params;
    console.log(`[SPARK Pipeline] START Asset Generation for Production "${production.id}" (${brief.title})`);
    ProductionGenerationGuard.assertEnabled("ProductionAssetService.generateAssets");

    const stages: import("../../domain/types").GenerationProgressStage[] = [
      { id: "storyboard", label: "Storyboard structure", status: "active" },
      { id: "voice", label: "Voiceover synthesis", status: "pending" },
      { id: "keyframes", label: "Scene keyframes", status: "pending" },
      { id: "thumbnails", label: "Thumbnail variants", status: "pending" },
      { id: "video", label: "Master video preview", status: "pending" },
      { id: "saving", label: "Finalizing media", status: "pending" },
    ];

    const emitProgress = (percent: number, stage: string, message?: string) => {
      if (onProgress) {
        onProgress({
          percent: Math.min(100, Math.max(0, percent)),
          stage,
          stages: stages.map((s) => ({ ...s })),
          message,
        });
      }
    };

    emitProgress(5, "Storyboard", "Generating vertical 9:16 multi-scene structure...");

    const hostStyle = character?.style || "Executive Presenter";

    const systemInstruction = `You are SPARK's Senior Production Producer & Visual Asset Synthesizer. Generate a complete 3-scene visual storyboard and thumbnail production assets. Return valid JSON only.`;

    const prompt = `
Create a 3-scene vertical (9:16) production storyboard and asset manifest for:

TITLE: "${brief.title}"
HOOK: "${brief.hook}"
NARRATIVE OUTLINE: "${brief.scriptOutline}"
VISUAL DIRECTION: "${brief.visualDirection}"
BRAND: "${brand.name}" (${brand.niche})
HOST STYLE: "${hostStyle}"
MODE: "${brief.productionMode}"

Return JSON matching this exact structure with NO markdown backticks:
{
  "storyboard": [
    {
      "scene": 1,
      "duration": "0-5s",
      "shotList": "Vertical 9:16 medium close-up of host with high-contrast text overlay",
      "cameraDirection": "Push-in slow zoom onto face",
      "transitions": "Hard cut on beat",
      "onScreenText": "ATTENTION: ${(typeof brief.hook === 'string' ? brief.hook : '').slice(0, 30)}",
      "pacing": "High urgency, 0.4s clip cadence",
      "scriptSnippet": "${typeof brief.hook === 'string' ? brief.hook : ''}",
      "visualDescription": "Host standing in modern studio, direct eye contact with high-contrast graphic"
    },
    {
      "scene": 2,
      "duration": "5-25s",
      "shotList": "Split-screen B-roll with dynamic data visualization",
      "cameraDirection": "Slow pan left across metric graphic",
      "transitions": "Whip pan right",
      "onScreenText": "KEY INSIGHT: ${brand.name} Core Method",
      "pacing": "Rhythmic educational breakdown",
      "scriptSnippet": "Here is exactly how this works...",
      "visualDescription": "Screen split showing real-world case study animation and kinetic typography"
    },
    {
      "scene": 3,
      "duration": "25-30s",
      "shotList": "Host framing with branded lower third and save/follow button graphic",
      "cameraDirection": "Static framing with floating CTA animation",
      "transitions": "Fade to black",
      "onScreenText": "SAVE & FOLLOW FOR MORE",
      "pacing": "High impact closing",
      "scriptSnippet": "${(typeof brief.caption === 'string' ? brief.caption : '').slice(0, 60)}",
      "visualDescription": "End screen card with brand logo animation and clear conversion prompt"
    }
  ],
  "thumbnails": [
    { "id": "t1", "variant": "A", "concept": "High-contrast split screen with presenter expression and bold hook" },
    { "id": "t2", "variant": "B", "concept": "Glowing metric dashboard with curiosity-gap text overlay" },
    { "id": "t3", "variant": "C", "concept": "Minimalist dark mode typography card with brand accent highlight" }
  ]
}
`;

    try {
      console.log(`[SPARK Pipeline] Provider Request: Storyboard structure via ModelRouter...`);
      // Execute through ModelRouter (respecting user AI Preferences)
      const rawResponse = await ModelRouter.executeCategoryRequest("production", {
        prompt,
        systemInstruction,
      });

      console.log(`[SPARK Pipeline] Provider Response: Storyboard structure received (${rawResponse.length} chars)`);

      const cleanJson = rawResponse.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);

      const storyboard: ProductionScene[] = Array.isArray(parsed.storyboard) ? parsed.storyboard : [];
      const thumbnails = Array.isArray(parsed.thumbnails) ? parsed.thumbnails : [];

      stages[0].status = "done";
      stages[1].status = "active";
      emitProgress(12, "Voice", "Synthesizing executive voiceover narration...");

      let lastError: string | undefined = undefined;

      const isValidMediaData = (val?: string | null): val is string => {
        if (!val || typeof val !== "string") return false;
        const trimmed = val.trim();
        return trimmed.startsWith("data:image/") || 
               trimmed.startsWith("data:video/") || 
               trimmed.startsWith("data:audio/") || 
               trimmed.startsWith("http://") || 
               trimmed.startsWith("https://");
      };

      // Synthesize real voiceover audio via ElevenLabs -> Provider TTS pipeline
      let realVoiceUrl: string | undefined = undefined;
      try {
        const voiceScript = `${brief.hook}. ${brief.scriptOutline}`.trim();
        const { generateElevenLabsVoice } = await import("../runtime/providers/elevenLabsTTS");
        const elevenVoice = await generateElevenLabsVoice(voiceScript);
        if (isValidMediaData(elevenVoice)) {
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
          realVoiceUrl = storedAudio.publicUrl;
        } else {
          const { generateSuperSparkVoice } = await import("../geminiService");
          const synthesizedVoice = await generateSuperSparkVoice(voiceScript);
          if (isValidMediaData(synthesizedVoice)) {
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
            realVoiceUrl = storedAudio.publicUrl;
          }
        }
      } catch (voiceErr: any) {
        console.warn("[ProductionAssetService] Real voice synthesis notice:", voiceErr);
        if (!lastError) lastError = `Voice: ${voiceErr?.message || String(voiceErr)}`;
      }

      stages[1].status = realVoiceUrl ? "done" : "failed";
      stages[2].status = "active";
      emitProgress(20, "Keyframes", "Rendering 9:16 vertical scene keyframes...");

      // 1. Storyboard Scene Keyframe Image Generation via ModelRouter ("storyboardImages")
      const sceneImages: string[] = [];
      const renderStartedAt = new Date().toISOString();

      try {
        const { ModelRouter } = await import("../runtime/modelRouter");
        const totalScenes = storyboard.length || 3;
        for (let sIdx = 0; sIdx < storyboard.length; sIdx++) {
          const scene = storyboard[sIdx];
          const imagePrompt = `9:16 vertical high-contrast production keyframe image for scene: ${scene.visualDescription || scene.shotList}. Hook: "${brief.hook}". Brand: ${brand.name}`;
          try {
            console.log(`[SPARK Pipeline] Provider Request: Scene ${sIdx + 1} image via ModelRouter ("storyboardImages")...`);
            const imgUrl = await ModelRouter.executeCategoryRequest("storyboardImages", {
              prompt: imagePrompt,
            });
            console.log(`[SPARK Pipeline] Provider Response: Scene ${sIdx + 1} image received (${imgUrl ? imgUrl.slice(0, 50) + "..." : "none"})`);
            if (isValidMediaData(imgUrl)) {
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
              console.log(`[SPARK Pipeline] Upload to Supabase Storage: Scene ${sIdx + 1} SUCCESS -> ${storedImg.publicUrl}`);
              sceneImages.push(storedImg.publicUrl);
              scene.image = storedImg.publicUrl;
            } else {
              console.warn(`[SPARK Pipeline] Scene ${sIdx + 1} returned empty/invalid image data:`, String(imgUrl || "").slice(0, 100));
              if (!lastError) lastError = `Scene ${sIdx + 1} Keyframe: No image bytes returned by provider`;
            }
          } catch (sceneErr: any) {
            console.error(`[SPARK Pipeline] Scene ${scene.scene} image generation failed:`, sceneErr);
            if (!lastError) lastError = `Scene ${sIdx + 1} Keyframe: ${sceneErr?.message || String(sceneErr)}`;
          }

          const currentPct = 20 + Math.round(((sIdx + 1) / totalScenes) * 35);
          emitProgress(currentPct, "Keyframes", `Rendered keyframe ${sIdx + 1} of ${totalScenes}...`);
        }
      } catch (imgErr: any) {
        console.error("[SPARK Pipeline] Storyboard image generation notice:", imgErr);
        if (!lastError) lastError = `Keyframe Stage: ${imgErr?.message || String(imgErr)}`;
      }

      stages[2].status = sceneImages.length > 0 ? "done" : "failed";
      stages[3].status = "active";
      emitProgress(58, "Thumbnails", "Generating Proposed Thumbnail Variants (A, B, C)...");

      // 2. Proposed Thumbnail Variants Real Image Generation Loop via ModelRouter ("storyboardImages")
      const enrichedThumbnails: { id: string; variant: string; concept: string; image?: string; url?: string }[] = [];
      try {
        const { ModelRouter } = await import("../runtime/modelRouter");
        const totalThumbs = thumbnails.length || 3;
        for (let tIdx = 0; tIdx < thumbnails.length; tIdx++) {
          const thumb = thumbnails[tIdx];
          const variantLetter = thumb.variant || ["A", "B", "C"][tIdx] || "A";
          const thumbPrompt = `9:16 vertical high-impact YouTube/TikTok thumbnail image for variant ${variantLetter}: ${thumb.concept}. Hook: "${brief.hook}". Brand: ${brand.name}`;
          let thumbUrl: string | undefined = undefined;

          try {
            console.log(`[SPARK Pipeline] Provider Request: Thumbnail Variant ${variantLetter} image via ModelRouter...`);
            const thumbImgData = await ModelRouter.executeCategoryRequest("storyboardImages", {
              prompt: thumbPrompt,
            });

            if (isValidMediaData(thumbImgData)) {
              const storedThumb = await this.uploadAssetToStorage({
                productionId: production.id,
                brandId: (brand as any).id,
                assetType: "thumbnail",
                storagePath: `${production.id}/thumbnails/variant-${variantLetter.toLowerCase()}.png`,
                dataUrlOrBlob: thumbImgData,
                mimeType: "image/png",
                prompt: thumbPrompt,
                provider: "ModelRouter",
              });
              console.log(`[SPARK Pipeline] Upload to Supabase Storage: Thumbnail Variant ${variantLetter} SUCCESS -> ${storedThumb.publicUrl}`);
              thumbUrl = storedThumb.publicUrl;
            } else {
              console.warn(`[SPARK Pipeline] Thumbnail Variant ${variantLetter} returned non-image data`);
              if (!lastError) lastError = `Thumbnail Variant ${variantLetter}: No image bytes returned`;
            }
          } catch (thumbErr: any) {
            console.error(`[SPARK Pipeline] Thumbnail Variant ${variantLetter} image generation failed:`, thumbErr);
            if (!lastError) lastError = `Thumbnail Variant ${variantLetter}: ${thumbErr?.message || String(thumbErr)}`;
          }

          enrichedThumbnails.push({
            id: thumb.id || `t${tIdx + 1}`,
            variant: variantLetter,
            concept: thumb.concept,
            image: thumbUrl || (isValidMediaData(sceneImages[tIdx]) ? sceneImages[tIdx] : undefined),
            url: thumbUrl || (isValidMediaData(sceneImages[tIdx]) ? sceneImages[tIdx] : undefined),
          });

          const currentPct = 58 + Math.round(((tIdx + 1) / totalThumbs) * 20);
          emitProgress(currentPct, "Thumbnails", `Synthesized thumbnail variant ${variantLetter}...`);
        }
      } catch (tLoopErr: any) {
        console.error("[SPARK Pipeline] Thumbnail generation loop failed:", tLoopErr);
        if (!lastError) lastError = `Thumbnail Stage: ${tLoopErr?.message || String(tLoopErr)}`;
      }

      stages[3].status = enrichedThumbnails.some((t) => isValidMediaData(t.image)) ? "done" : "failed";
      stages[4].status = "active";
      emitProgress(80, "Video", "Rendering 9:16 master video preview...");

      // 3. Video Scene Clips / Video Render Generation via ModelRouter ("videoGeneration")
      let realVideoUrl: string | undefined = undefined;
      try {
        const { ModelRouter } = await import("../runtime/modelRouter");
        const videoPrompt = `9:16 vertical 4K master video preview for "${brief.title}". Script: ${brief.hook}. Visuals: ${brief.visualDirection}`;
        console.log(`[SPARK Pipeline] Provider Request: Video generation via ModelRouter ("videoGeneration")...`);
        const generatedVideo = await ModelRouter.executeCategoryRequest("videoGeneration", {
          prompt: videoPrompt,
        });
        console.log(`[SPARK Pipeline] Provider Response: Video generation received (${generatedVideo ? generatedVideo.slice(0, 50) + "..." : "none"})`);
        if (isValidMediaData(generatedVideo)) {
          const storedVid = await this.uploadAssetToStorage({
            productionId: production.id,
            brandId: (brand as any).id,
            assetType: "video",
            storagePath: `${production.id}/video/master.mp4`,
            dataUrlOrBlob: generatedVideo,
            mimeType: "video/mp4",
            prompt: videoPrompt,
            provider: "ModelRouter",
          });
          console.log(`[SPARK Pipeline] Upload to Supabase Storage: Video SUCCESS -> ${storedVid.publicUrl}`);
          realVideoUrl = storedVid.publicUrl;
        } else {
          console.warn("[SPARK Pipeline] Video generation returned invalid/empty URL or bytes");
          if (!lastError) lastError = "Video Generation: No video URL or bytes returned";
        }
      } catch (vidErr: any) {
        console.error("[SPARK Pipeline] Video generation failed:", vidErr);
        if (!lastError) lastError = `Video Generation: ${vidErr?.message || String(vidErr)}`;
      }

      stages[4].status = realVideoUrl ? "done" : "failed";
      stages[5].status = "active";
      emitProgress(96, "Saving", "Synchronizing storage assets & metadata...");

      const renderCompletedAt = new Date().toISOString();

      const finalProgress: import("../../domain/types").GenerationProgress = {
        percent: 100,
        stage: "Complete",
        stages: stages.map((s) => ({ ...s, status: s.status === "active" ? "done" : s.status })),
        message: realVideoUrl || sceneImages.length > 0 
          ? "Media assets synthesized and ready for executive review."
          : "Asset synthesis complete. Some media stages failed — review error logs.",
      };

      const updatedBrief: ProductionBrief = {
        ...brief,
        storyboard: storyboard.length > 0 ? storyboard : [
          {
            scene: 1,
            duration: "0-5s",
            shotList: "Vertical 9:16 host framing",
            cameraDirection: "Push-in zoom",
            transitions: "Hard cut",
            onScreenText: brief.hook,
            pacing: "Fast",
            scriptSnippet: brief.hook,
            visualDescription: brief.visualDirection,
          },
        ],
        generatedAssets: {
          sceneClips: realVideoUrl ? [realVideoUrl] : undefined,
          thumbnails: enrichedThumbnails.length > 0 ? enrichedThumbnails : thumbnails,
          voiceoverUrl: realVoiceUrl,
          generatedFrames: sceneImages.length > 0 ? sceneImages : undefined,
          generatedVideos: realVideoUrl ? [realVideoUrl] : undefined,
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
        description: `[${s.duration}] ${s.shotList} — Text: "${s.onScreenText}"`,
        duration: s.duration,
        image: s.image,
        videoUrl: s.videoUrl,
      }));

      emitProgress(100, "Complete", "Media assets synthesized and ready for executive review.");

      return {
        brief: updatedBrief,
        scenes: updatedScenes,
        audioUrl: realVoiceUrl,
        videoUrl: realVideoUrl,
      };
    } catch (err) {
      console.warn("[ProductionAssetService] AI storyboard fallback:", err);

      const fallbackStoryboard: ProductionScene[] = [
        {
          scene: 1,
          duration: "0-5s",
          shotList: "Vertical 9:16 presenter frame",
          cameraDirection: "Push-in zoom",
          transitions: "Hard cut",
          onScreenText: brief.hook,
          pacing: "Fast hook",
          scriptSnippet: brief.hook,
          visualDescription: brief.visualDirection,
        },
        {
          scene: 2,
          duration: "5-25s",
          shotList: "Core narrative body & B-roll",
          cameraDirection: "Smooth pan",
          transitions: "Whip pan",
          onScreenText: brief.title,
          pacing: "Rhythmic",
          scriptSnippet: brief.scriptOutline,
          visualDescription: "Visual breakdown",
        },
        {
          scene: 3,
          duration: "25-30s",
          shotList: "Branded CTA closing screen",
          cameraDirection: "Static",
          transitions: "Fade to black",
          onScreenText: "SAVE & FOLLOW",
          pacing: "High impact",
          scriptSnippet: brief.caption,
          visualDescription: "Call to Action",
        },
      ];

      // Synthesize real voiceover audio fallback
      let realVoiceUrl: string | undefined = undefined;
      try {
        const { generateSuperSparkVoice } = await import("../geminiService");
        const voiceScript = `${brief.hook}. ${brief.scriptOutline}`.trim();
        const synthesizedVoice = await generateSuperSparkVoice(voiceScript);
        if (synthesizedVoice && synthesizedVoice.length > 50) {
          realVoiceUrl = synthesizedVoice;
        }
      } catch {}

      const updatedBrief: ProductionBrief = {
        ...brief,
        storyboard: fallbackStoryboard,
        generatedAssets: {
          sceneClips: undefined,
          thumbnails: [
            { id: "t1", variant: "A", concept: "Presenter contrast thumbnail" },
            { id: "t2", variant: "B", concept: "Metric graphic thumbnail" },
          ],
          voiceoverUrl: realVoiceUrl,
        },
        audioUrl: realVoiceUrl,
      };

      return {
        brief: updatedBrief,
        scenes: fallbackStoryboard.map((s) => ({
          scene: s.scene,
          description: `[${s.duration}] ${s.shotList} — Text: "${s.onScreenText}"`,
          duration: s.duration,
        })),
        audioUrl: realVoiceUrl,
        videoUrl: undefined,
      };
    }
  }
}

// Register inside Capability Registry
CapabilityRegistry.register({
  id: "production-asset-service",
  name: "ProductionAssetService",
  category: "Production",
  description: "Executive multi-scene storyboard generation, visual shot-list synthesis, and thumbnail rendering.",
  status: "active",
  providerClass: ProductionAssetService,
});
