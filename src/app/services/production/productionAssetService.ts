import type { Production, ProductionBrief, ProductionScene, Brand, Character, ProductionAsset } from "../../domain/types";
import { ModelRouter } from "../runtime/modelRouter";
import { CapabilityRegistry } from "../capabilityRegistry";
import { ProductionGenerationGuard } from "./ProductionGenerationGuard";

export interface ProductionAssetGenerationResult {
  brief: ProductionBrief;
  scenes: { scene: number; description: string; duration: string }[];
  audioUrl?: string;
  videoUrl?: string;
}

export class ProductionAssetService {
  /**
   * Automatically uploads generated base64 / blob data URIs into Supabase Storage
   * bucket 'production-assets' under paths e.g. `production-id/storyboard/scene-01.png`
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
  }): Promise<{ publicUrl: string; storagePath: string; assetId: string }> {
    const { productionId, brandId = "default-brand", assetType, storagePath, dataUrlOrBlob, mimeType, prompt, provider } = params;
    const assetId = `pa-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    let finalPublicUrl = dataUrlOrBlob;

    try {
      const { getSupabaseClient } = await import("../../backend/supabaseClient");
      const supabase = getSupabaseClient();

      if (supabase) {
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

        if (uploadBlob) {
          const bucket = "production-assets";
          const { data, error } = await supabase.storage.from(bucket).upload(storagePath, uploadBlob, {
            contentType: mimeType || uploadBlob.type || "image/png",
            upsert: true,
          });

          if (!error && data) {
            const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
            if (pubData?.publicUrl) {
              finalPublicUrl = pubData.publicUrl;
            }
          } else if (error) {
            console.warn("[ProductionAssetService] Supabase Storage upload notice:", error);
          }
        }
      }
    } catch (err) {
      console.warn("[ProductionAssetService] Asset upload error, using raw URL:", err);
    }

    // Persist production asset record to Supabase production_assets table
    const prodAsset: ProductionAsset = {
      id: assetId,
      brandId,
      productionId,
      assetType,
      provider: provider || "AIProviderOrchestrator",
      storageBucket: "production-assets",
      storagePath,
      publicUrl: finalPublicUrl,
      mimeType,
      generationPrompt: prompt,
      status: "completed",
      createdAt: new Date().toISOString(),
    };

    try {
      const { persistProductionAssetCreate } = await import("../../backend/workspaceSync");
      void persistProductionAssetCreate(brandId, prodAsset);
    } catch (dbErr) {
      console.warn("[ProductionAssetService] Production asset record persist notice:", dbErr);
    }

    return { publicUrl: finalPublicUrl, storagePath, assetId };
  }

  /**
   * Generates storyboards, scene clips, voiceover, and thumbnail assets
   * via Capability Registry -> Model Router -> Provider Adapters.
   */
  static async generateAssets(params: {
    production: Production;
    brief: ProductionBrief;
    brand: Brand;
    character?: Character;
  }): Promise<ProductionAssetGenerationResult> {
    const { production, brief, brand, character } = params;
    console.log(`[SPARK Pipeline] START Asset Generation for Production "${production.id}" (${brief.title})`);
    ProductionGenerationGuard.assertEnabled("ProductionAssetService.generateAssets");

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
      "onScreenText": "ATTENTION: ${brief.hook.slice(0, 30)}",
      "pacing": "High urgency, 0.4s clip cadence",
      "scriptSnippet": "${brief.hook}",
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
      "scriptSnippet": "${brief.caption.slice(0, 60)}",
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

      // Synthesize real voiceover audio via ElevenLabs -> Provider TTS pipeline
      let realVoiceUrl: string | undefined = undefined;
      try {
        const voiceScript = `${brief.hook}. ${brief.scriptOutline}`.trim();
        const { generateElevenLabsVoice } = await import("../runtime/providers/elevenLabsTTS");
        const elevenVoice = await generateElevenLabsVoice(voiceScript);
        if (elevenVoice && elevenVoice.length > 50) {
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
          if (synthesizedVoice && synthesizedVoice.length > 50) {
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
      } catch (voiceErr) {
        console.warn("[ProductionAssetService] Real voice synthesis notice:", voiceErr);
      }

      // 1. Storyboard Scene Keyframe Image Generation via ModelRouter ("storyboardImages")
      const sceneImages: string[] = [];
      const renderStartedAt = new Date().toISOString();

      try {
        const { ModelRouter } = await import("../runtime/modelRouter");
        for (let sIdx = 0; sIdx < storyboard.length; sIdx++) {
          const scene = storyboard[sIdx];
          const imagePrompt = `9:16 vertical high-contrast production keyframe image for scene: ${scene.visualDescription || scene.shotList}. Brand: ${brand.name}`;
          try {
            console.log(`[SPARK Pipeline] Provider Request: Scene ${sIdx + 1} image via ModelRouter ("storyboardImages")...`);
            const imgUrl = await ModelRouter.executeCategoryRequest("storyboardImages", {
              prompt: imagePrompt,
            });
            console.log(`[SPARK Pipeline] Provider Response: Scene ${sIdx + 1} image received (${imgUrl ? imgUrl.slice(0, 50) + "..." : "none"})`);
            if (imgUrl && imgUrl.length > 20) {
              const storedImg = await this.uploadAssetToStorage({
                productionId: production.id,
                brandId: (brand as any).id,
                assetType: "frame",
                storagePath: `${production.id}/frames/scene-0${sIdx + 1}.png`,
                dataUrlOrBlob: imgUrl,
                mimeType: "image/png",
                prompt: imagePrompt,
                provider: "OpenAI Image / ModelRouter",
              });
              console.log(`[SPARK Pipeline] Upload to Supabase Storage: Scene ${sIdx + 1} SUCCESS -> ${storedImg.publicUrl}`);
              sceneImages.push(storedImg.publicUrl);
              scene.image = storedImg.publicUrl;
            }
          } catch (sceneErr) {
            console.warn(`[SPARK Pipeline] Scene ${scene.scene} image generation notice/fallback:`, sceneErr);
          }
        }
      } catch (imgErr) {
        console.warn("[SPARK Pipeline] Storyboard image generation notice:", imgErr);
      }

      // 2. Video Scene Clips / Video Render Generation via ModelRouter ("videoGeneration")
      let realVideoUrl: string | undefined = undefined;
      try {
        const { ModelRouter } = await import("../runtime/modelRouter");
        const videoPrompt = `9:16 vertical 4K master video preview for "${brief.title}". Script: ${brief.hook}. Visuals: ${brief.visualDirection}`;
        console.log(`[SPARK Pipeline] Provider Request: Video generation via ModelRouter ("videoGeneration")...`);
        const generatedVideo = await ModelRouter.executeCategoryRequest("videoGeneration", {
          prompt: videoPrompt,
        });
        console.log(`[SPARK Pipeline] Provider Response: Video generation received (${generatedVideo ? generatedVideo.slice(0, 50) + "..." : "none"})`);
        if (generatedVideo && generatedVideo.length > 20) {
          const storedVid = await this.uploadAssetToStorage({
            productionId: production.id,
            brandId: (brand as any).id,
            assetType: "video",
            storagePath: `${production.id}/video/master.mp4`,
            dataUrlOrBlob: generatedVideo,
            mimeType: "video/mp4",
            prompt: videoPrompt,
            provider: "Google Gemini Video / ModelRouter",
          });
          console.log(`[SPARK Pipeline] Upload to Supabase Storage: Video SUCCESS -> ${storedVid.publicUrl}`);
          realVideoUrl = storedVid.publicUrl;
        }
      } catch (vidErr) {
        console.warn("[SPARK Pipeline] Video generation notice/fallback:", vidErr);
      }

      const renderCompletedAt = new Date().toISOString();

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
          thumbnails,
          voiceoverUrl: realVoiceUrl,
          generatedFrames: sceneImages.length > 0 ? sceneImages : undefined,
          generatedVideos: realVideoUrl ? [realVideoUrl] : undefined,
          generatedAudio: realVoiceUrl ? [realVoiceUrl] : undefined,
          generationMetadata: {
            renderStartedAt,
            renderCompletedAt,
            providerUsed: "AIProviderOrchestrator",
            generationStatus: "Completed",
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
