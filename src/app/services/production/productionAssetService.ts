import type { Production, ProductionBrief, ProductionScene, Brand, Character } from "../../domain/types";
import { ModelRouter } from "../runtime/modelRouter";
import { CapabilityRegistry } from "../capabilityRegistry";

export interface ProductionAssetGenerationResult {
  brief: ProductionBrief;
  scenes: { scene: number; description: string; duration: string }[];
  audioUrl?: string;
  videoUrl?: string;
}

export class ProductionAssetService {
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
      // Execute through ModelRouter (respecting user AI Preferences)
      const rawResponse = await ModelRouter.executeCategoryRequest("production", {
        prompt,
        systemInstruction,
      });

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
          realVoiceUrl = elevenVoice;
        } else {
          const { generateSuperSparkVoice } = await import("../geminiService");
          const synthesizedVoice = await generateSuperSparkVoice(voiceScript);
          if (synthesizedVoice && synthesizedVoice.length > 50) {
            realVoiceUrl = synthesizedVoice;
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
        for (const scene of storyboard) {
          const imagePrompt = `9:16 vertical high-contrast production keyframe image for scene: ${scene.visualDescription || scene.shotList}. Brand: ${brand.name}`;
          try {
            const imgUrl = await ModelRouter.executeCategoryRequest("storyboardImages", {
              prompt: imagePrompt,
            });
            if (imgUrl && imgUrl.length > 20) {
              sceneImages.push(imgUrl);
              scene.image = imgUrl;
            }
          } catch (sceneErr) {
            console.warn(`[ProductionAssetService] Scene ${scene.scene} image generation notice:`, sceneErr);
          }
        }
      } catch (imgErr) {
        console.warn("[ProductionAssetService] Storyboard image generation notice:", imgErr);
      }

      // 2. Video Scene Clips / Video Render Generation via ModelRouter ("videoGeneration")
      let realVideoUrl: string | undefined = undefined;
      try {
        const { ModelRouter } = await import("../runtime/modelRouter");
        const videoPrompt = `9:16 vertical 4K master video preview for "${brief.title}". Script: ${brief.hook}. Visuals: ${brief.visualDirection}`;
        const generatedVideo = await ModelRouter.executeCategoryRequest("videoGeneration", {
          prompt: videoPrompt,
        });
        if (generatedVideo && generatedVideo.length > 20) {
          realVideoUrl = generatedVideo;
        }
      } catch (vidErr) {
        console.warn("[ProductionAssetService] Video generation notice:", vidErr);
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
