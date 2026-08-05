import type { ViralSpark, Brand, Character, MemoryItem, ProductionBrief } from "../../domain/types";
import { ModelRouter } from "../runtime/modelRouter";

export class ProductionBriefService {
  /**
   * Single focused function to transform a ViralSpark + Brand/Character Context + ProductionMode
   * into a fully structured ProductionBrief via ModelRouter / AIProviderOrchestrator.
   */
  static async generateBrief(params: {
    spark: ViralSpark;
    brand: Brand;
    character?: Character;
    niche?: string;
    memoryItems?: MemoryItem[];
    productionMode?: string;
  }): Promise<ProductionBrief> {
    const { spark, brand, character, niche, memoryItems = [], productionMode = "Narrator" } = params;

    const brandRules = memoryItems.map((m) => `- [${m.category || "Rule"}]: ${m.text}`).join("\n");
    const hostStyle = character?.style || "Executive Director";
    const charTraits = character?.traits ? character.traits.join(", ") : "Engaging, authoritative";
    const pillars = brand.contentPillars ? brand.contentPillars.map((p) => p.label).join(", ") : "Educational, Strategic";
    const tones = brand.tone ? brand.tone.map((t) => t.label).join(", ") : "Professional, direct";
    const sparkScore = spark.brandFitScore || 92;

    const systemInstruction = `You are SPARK's Executive Creative Director. Your job is to convert a high-performing Viral Spark into a complete, ready-to-produce Production Brief tailored specifically for the brand "${brand.name}". Output MUST be valid JSON only.`;

    const prompt = `
Generate a structured Production Brief for the following Viral Spark:

TITLE: "${spark.title}"
HOOK / ANGLE: "${spark.hook}" (Angle: ${spark.angle})
WHY NOW: "${spark.whyNow}"
TARGET PLATFORM: ${spark.platformFit || "YouTube Shorts"}
VIRAL SCORE: ${sparkScore}/100

BRAND CONTEXT:
- Brand Name: ${brand.name}
- Niche / Industry: ${niche || brand.niche}
- Archetype: ${brand.archetype}
- Voice / Tone Profile: ${tones}
- Content Pillars: ${pillars}
- Character/Host Style: ${hostStyle} (${charTraits})
- Production Mode: ${productionMode}

BRAND MEMORY & RULES:
${brandRules || "- Standard executive quality standards apply."}

Return a valid JSON object matching this exact structure with NO surrounding markdown backticks:
{
  "title": "${spark.title}",
  "productionMode": "${productionMode}",
  "hook": "Specific curiosity-gap hook tailored for ${brand.name}",
  "scriptOutline": "Complete 3-part script outline (Hook -> Core Value Delivery -> Call to Action)",
  "visualDirection": "Scene-by-scene visual direction (lighting, host framing, visual overlays, 9:16 cuts)",
  "caption": "Platform caption with high-converting CTA for ${brand.name}",
  "platformRecommendation": "${spark.platformFit || "YouTube Shorts"}",
  "whyThisWorks": "Executive strategic rationale explaining why this concept will perform well for ${brand.name}",
  "brandFitScore": ${Math.min(99, Math.max(80, sparkScore))},
  "suggestedDuration": "30-60s"
}
`;

    try {
      const rawResponse = await ModelRouter.executeCategoryRequest("production", {
        prompt,
        systemInstruction,
      });

      const cleanJson = rawResponse
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const parsed = JSON.parse(cleanJson);
      return {
        title: parsed.title || spark.title,
        productionMode: parsed.productionMode || productionMode,
        hook: parsed.hook || spark.hook,
        scriptOutline: parsed.scriptOutline || `1. Hook: ${spark.hook}\n2. Core Insight: ${spark.whyNow}\n3. Action: Tailored for ${brand.name}`,
        visualDirection: parsed.visualDirection || `Host (${hostStyle}): Clean backdrop, 9:16 vertical composition, dynamic text overlays.`,
        caption: parsed.caption || `Discover how ${brand.name} approaches ${spark.title}. Save and follow for more insights.`,
        platformRecommendation: parsed.platformRecommendation || spark.platformFit || "YouTube Shorts",
        whyThisWorks: parsed.whyThisWorks || spark.whyNow || "High curiosity gap paired with brand-aligned authority.",
        brandFitScore: typeof parsed.brandFitScore === "number" ? parsed.brandFitScore : sparkScore,
        suggestedDuration: parsed.suggestedDuration || "30-60s",
      };
    } catch (err) {
      console.warn("[ProductionBriefService] AI generation fallback:", err);

      return {
        title: spark.title,
        productionMode,
        hook: spark.hook || `How ${brand.name} leverages ${spark.title}`,
        scriptOutline: `Scene 1 (0-5s): ${spark.hook}\nScene 2 (5-25s): Deconstruct ${spark.title} in the context of ${brand.niche}.\nScene 3 (25-30s): Call to action for ${brand.name}.`,
        visualDirection: `Vertical 9:16. Presenter (${hostStyle}) with high-contrast text graphics and dynamic scene cuts.`,
        caption: `Top strategy breakdown on ${spark.title}. Learn more with ${brand.name}.`,
        platformRecommendation: spark.platformFit || "YouTube Shorts",
        whyThisWorks: spark.whyNow || "Proven viral narrative structure adapted to brand identity.",
        brandFitScore: sparkScore,
        suggestedDuration: "30-60s",
      };
    }
  }
}
