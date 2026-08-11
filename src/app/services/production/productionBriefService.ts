import type { ViralSpark, Brand, Character, MemoryItem, ProductionBrief } from "../../domain/types";
import { ModelRouter } from "../runtime/modelRouter";
import { ProductionGenerationGuard } from "./ProductionGenerationGuard";

function asText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : typeof v === "object" && v ? JSON.stringify(v) : String(v)))
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return String(value);
}

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

    // System-wide guard check: Block AI generation if Production is OFF
    if (!ProductionGenerationGuard.isEnabled()) {
      console.warn("[ProductionBriefService] Generation blocked: Production Generation is OFF.");
      return {
        title: asText(spark.title, "Production Draft"),
        productionMode: asText(productionMode, "Narrator"),
        hook: asText(spark.hook, "Curiosity hook"),
        scriptOutline: "Production Generation is turned OFF. Enable Production Generation to draft script.",
        visualDirection: "Production Generation is turned OFF. Planning mode active.",
        caption: asText(spark.title, "Production Draft"),
        platformRecommendation: asText(spark.platformFit, "YouTube Shorts"),
        whyThisWorks: asText(spark.whyNow, "Strategic angle"),
        brandFitScore: spark.brandFitScore || 90,
        suggestedDuration: "30-60s",
      };
    }

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
      const fallbackScript = `1. Hook: ${spark.hook}\n2. Core Insight: ${spark.whyNow}\n3. Action: Tailored for ${brand.name}`;
      const fallbackVisual = `Host (${hostStyle}): Clean backdrop, 9:16 vertical composition, dynamic text overlays.`;
      const fallbackCaption = `Discover how ${brand.name} approaches ${spark.title}. Save and follow for more insights.`;
      const fallbackWhy = spark.whyNow || "High curiosity gap paired with brand-aligned authority.";

      return {
        title: asText(parsed.title, spark.title),
        productionMode: asText(parsed.productionMode, productionMode),
        hook: asText(parsed.hook, spark.hook),
        scriptOutline: asText(parsed.scriptOutline, fallbackScript),
        visualDirection: asText(parsed.visualDirection, fallbackVisual),
        caption: asText(parsed.caption, fallbackCaption),
        platformRecommendation: asText(parsed.platformRecommendation, spark.platformFit || "YouTube Shorts"),
        whyThisWorks: asText(parsed.whyThisWorks, fallbackWhy),
        brandFitScore: typeof parsed.brandFitScore === "number" ? parsed.brandFitScore : sparkScore,
        suggestedDuration: asText(parsed.suggestedDuration, "30-60s"),
      };
    } catch (err) {
      console.warn("[ProductionBriefService] AI generation fallback:", err);

      return {
        title: asText(spark.title, "Production Draft"),
        productionMode: asText(productionMode, "Narrator"),
        hook: asText(spark.hook, `How ${brand.name} leverages ${spark.title}`),
        scriptOutline: `Scene 1 (0-5s): ${spark.hook}\nScene 2 (5-25s): Deconstruct ${spark.title} in the context of ${brand.niche}.\nScene 3 (25-30s): Call to action for ${brand.name}.`,
        visualDirection: `Vertical 9:16. Presenter (${hostStyle}) with high-contrast text graphics and dynamic scene cuts.`,
        caption: `Top strategy breakdown on ${spark.title}. Learn more with ${brand.name}.`,
        platformRecommendation: asText(spark.platformFit, "YouTube Shorts"),
        whyThisWorks: asText(spark.whyNow, "Proven viral narrative structure adapted to brand identity."),
        brandFitScore: sparkScore,
        suggestedDuration: "30-60s",
      };
    }
  }
}
