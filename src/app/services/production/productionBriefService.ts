import type { ViralSpark, Brand, Character, MemoryItem, ProductionBrief, Offer, StructuredResearchContext } from "../../domain/types";
import { ModelRouter } from "../runtime/modelRouter";
import { ProductionGenerationGuard } from "./ProductionGenerationGuard";
import { loadPersistedState } from "../../state/persistence";

function formatResearchContextBlock(context?: StructuredResearchContext): string {
  if (!context) return "";

  const lines: string[] = ["STRUCTURED INSPIRATION & RESEARCH PATTERNS (ADAPT PATTERN TO BRAND, DO NOT CLONE CREATOR IDENTITY):"];
  if (context.sourceName) lines.push(`- Inspiration Creator/Account: ${context.sourceName} (${context.platform || "Video"})`);
  if (context.hookPattern) lines.push(`- Proven Hook Pattern: "${context.hookPattern}"`);
  if (context.titlePattern) lines.push(`- Title Structure Pattern: "${context.titlePattern}"`);
  if (context.format) lines.push(`- Content Format Type: ${context.format}`);
  if (context.ctaStyle) lines.push(`- High-Converting CTA Style: "${context.ctaStyle}"`);
  if (context.provenStructure) lines.push(`- Proven Storytelling Structure: ${context.provenStructure}`);
  if (context.nicheLanguage && context.nicheLanguage.length > 0) {
    lines.push(`- High-Value Niche Terminology: ${context.nicheLanguage.join(", ")}`);
  }
  if (context.viralReasons && context.viralReasons.length > 0) {
    lines.push(`- Retention Signals: ${context.viralReasons.join("; ")}`);
  }

  lines.push(`DIRECTIVE: Translate this exact engagement pattern into ${context.nicheLanguage?.length ? "niche-authentic" : "brand-tailored"} spoken lines while adhering 100% to the brand voice.`);
  return lines.join("\n");
}

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

/**
 * Pre-processes and ranks memory items so high-priority brand rules,
 * pinned directives, and hook laws appear at the top, capped at 10 items max.
 */
function rankAndFormatMemory(memoryItems: MemoryItem[] = []): string {
  if (!memoryItems || memoryItems.length === 0) {
    return "- [BRAND LAW] ALWAYS: Maintain sharp executive authority, high-contrast framing, and zero filler words.";
  }

  const sorted = [...memoryItems].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    if (a.type === "rule" && b.type !== "rule") return -1;
    if (a.type !== "rule" && b.type === "rule") return 1;
    return 0;
  });

  const capped = sorted.slice(0, 10);
  return capped
    .map((m) => {
      const cat = m.category ? `[${m.category.toUpperCase()}]` : "[RULE]";
      const text = m.text.trim();
      if (/^(always|never|hook|law)/i.test(text)) {
        return `- ${cat}: ${text}`;
      }
      return `- ${cat} ALWAYS: ${text}`;
    })
    .join("\n");
}

/**
 * Deterministic Brief Compiler Fallback
 * Guarantees a non-empty, directive Production Pack Brief even if AI JSON fails.
 */
function compileDeterministicBrief(params: {
  spark: ViralSpark;
  brand: Brand;
  character?: Character;
  defaultOffer?: Offer;
  productionMode?: string;
  niche?: string;
  researchContext?: StructuredResearchContext;
}): ProductionBrief {
  const { spark, brand, character, defaultOffer, productionMode = "standard", niche, researchContext = spark.researchContext } = params;
  const rawMode = (productionMode || spark.suggestedProductionMode || "standard").toLowerCase();
  const modeKey = rawMode.includes("deep") || rawMode.includes("cinematic") ? "deep" : rawMode.includes("express") || rawMode.includes("narrator") ? "express" : "standard";

  const hostTitle = character?.name || brand.name;
  const patternHook = researchContext?.hookPattern || spark.hook;
  const sparkHook = patternHook ? patternHook.trim() : `The ${niche || brand.niche || "industry"} shift nobody is talking about.`;
  const cleanHook = sparkHook.length > 5 && !sparkHook.toLowerCase().startsWith("hook:") ? sparkHook : `Here is why ${brand.name} does things differently in ${niche || brand.niche || "this market"}.`;

  const spokenCta = defaultOffer
    ? `Claim your ${defaultOffer.title} now — link in bio or comment below.`
    : `Follow ${brand.name} for daily strategic breakdowns.`;

  const onScreenCta = defaultOffer
    ? `GET ${defaultOffer.title.toUpperCase().slice(0, 20)}`
    : `SAVE & FOLLOW ${brand.name.toUpperCase().slice(0, 15)}`;

  let scriptOutline = "";
  if (modeKey === "express") {
    scriptOutline = `
[00:00-00:05] HOOK VO: "${cleanHook}"
[00:05-00:15] PROBLEM: ${spark.whyNow || "Most operators fail by repeating outdated playbooks."}
[00:15-00:25] SOLUTION: ${brand.name} applies a precise, non-obvious framework.
[00:25-00:30] CTA VO: "${spokenCta}"
`.trim();
  } else if (modeKey === "deep") {
    scriptOutline = `
[00:00-00:08] HOOK & STAKE: Host establishes framing. "${cleanHook}" | CAMERA: Slow push-in zoom
[00:08-00:16] CORE PARADIGM: ${spark.whyNow || "Deconstructing market dynamics."} | CAMERA: Tracking pan over visual set
[00:16-00:24] EXECUTIVE PROOF: Step-by-step breakdown for ${brand.name}. | CAMERA: Medium close-up
[00:24-00:30] CONVERSION CLOSE: Host delivers spoken CTA. "${spokenCta}" | CAMERA: Static lock-off
`.trim();
  } else {
    scriptOutline = `
1. Hook (0-5s): Spoken opening — "${cleanHook}"
2. Core Value (5-15s): ${spark.whyNow || "The primary insight behind this shift."}
3. Proof & Payoff (15-25s): How ${brand.name} solves this with authority.
4. Spoken CTA (25-30s): "${spokenCta}"
`.trim();
  }

  const visualDirection = modeKey === "deep"
    ? `Continuous single-take staging for ${hostTitle}. 16:9 cinematic framing, studio lighting, zero montage cuts.`
    : `Vertical 9:16 framing. Presenter ${hostTitle} centered in studio set, high-contrast lower-third typography, dynamic scene transitions.`;

  const caption = defaultOffer
    ? `${spark.title}\n\n${spark.whyNow || ""}\n\nGet ${defaultOffer.title} → ${defaultOffer.url}\n\n#${brand.name.replace(/\s+/g, "")} #${(niche || brand.niche || "strategy").replace(/\s+/g, "")}`
    : `${spark.title}\n\n${spark.whyNow || ""}\n\nSave this post and follow ${brand.name} for more strategic breakdowns.`;

  const offerCta = defaultOffer ? {
    id: defaultOffer.id,
    type: defaultOffer.type,
    title: defaultOffer.title,
    url: defaultOffer.url,
    priceLabel: defaultOffer.priceLabel,
    description: defaultOffer.description,
  } : undefined;

  return {
    title: spark.title || "Production Brief",
    productionMode: productionMode,
    hook: cleanHook,
    scriptOutline,
    spokenCta,
    onScreenCta,
    visualDirection,
    caption,
    platformRecommendation: spark.platformFit || (modeKey === "deep" ? "YouTube Long-form (16:9)" : "YouTube Shorts (9:16)"),
    whyThisWorks: spark.whyNow
      ? `Based on viral spark pattern: ${spark.whyNow}. Adapted to ${brand.name}'s voice.`
      : `High curiosity gap paired with ${brand.name}'s niche authority.`,
    brandFitScore: spark.brandFitScore || 90,
    suggestedDuration: modeKey === "deep" ? "60-180s" : "30-60s",
    offerCta,
  };
}

export class ProductionBriefService {
  /**
   * Compiles a ViralSpark + Brand/Character + Memory into a directive, timed Production Pack Brief.
   */
  static async generateBrief(params: {
    spark: ViralSpark;
    brand: Brand;
    character?: Character;
    niche?: string;
    memoryItems?: MemoryItem[];
    productionMode?: string;
    researchContext?: StructuredResearchContext;
  }): Promise<ProductionBrief> {
    const { spark, brand, character, niche, memoryItems = [], productionMode = "standard", researchContext = spark.researchContext } = params;

    // Resolve active offer
    const defaultOffer: Offer | undefined = (() => {
      try {
        const local = loadPersistedState<any>();
        const offers: Offer[] = Array.isArray(local?.offers) ? local.offers : [];
        return offers.find((o) => o.active && o.isDefault) || offers.find((o) => o.active);
      } catch {
        return undefined;
      }
    })();

    // Check system generation guard
    if (!ProductionGenerationGuard.isEnabled()) {
      console.warn("[ProductionBriefService] Generation blocked: Production Generation is OFF.");
      const fallback = compileDeterministicBrief({ spark, brand, character, defaultOffer, productionMode, niche, researchContext });
      return {
        ...fallback,
        scriptOutline: "[PAUSED] Production Generation is turned OFF in settings.",
      };
    }

    const rankedMemory = rankAndFormatMemory(memoryItems);
    const researchPromptBlock = formatResearchContextBlock(researchContext);
    const hostStyle = character?.style || character?.name || brand.name;
    const charTraits = character?.traits ? character.traits.join(", ") : "Authoritative, direct, engaging";
    const pillars = brand.contentPillars ? brand.contentPillars.map((p) => p.label).join(", ") : "Strategy, Insights";
    const tones = brand.tone ? brand.tone.map((t) => t.label).join(", ") : "Professional, executive";
    const sparkScore = spark.brandFitScore || 92;
    const rawMode = (productionMode || spark.suggestedProductionMode || "standard").toLowerCase();
    const modeKey = rawMode.includes("deep") || rawMode.includes("cinematic") ? "deep" : rawMode.includes("express") || rawMode.includes("narrator") ? "express" : "standard";

    const offerPromptSection = defaultOffer
      ? `
PROMOTED OFFER (MANDATORY CTA):
- Title: ${defaultOffer.title}
- Type: ${defaultOffer.type}
- URL: ${defaultOffer.url}
${defaultOffer.priceLabel ? `- Price: ${defaultOffer.priceLabel}` : ""}
${defaultOffer.description ? `- Summary: ${defaultOffer.description}` : ""}
Incorporate this offer as the spoken CTA and in the platform caption.
`
      : "";

    const systemInstruction = `You are SPARK's Chief Creative Officer & Production Architect.
Your task is to compile a Viral Spark into a PRODUCTION PACK BRIEF for "${brand.name}".

ANTI-SLOP LAWS (MUST FOLLOW):
1. HOOK: Output the EXACT READY-TO-SPEAK spoken line(s) for the brand host (max 2 short sentences). NEVER write meta descriptions like "Start with a hook about..." or "Curiosity hook:".
2. SCRIPT OUTLINE: Output a structured, beat-by-beat script outline with timestamp markers [00:00-00:05]. No single paragraph blobs or generic bullet points.
3. SPOKEN CTA: Provide 1 concise spoken line for the host/narrator to close the video.
4. ONSCREEN CTA: Provide a short lower-third text overlay (<= 6-8 words).
5. VISUAL DIRECTION: Concrete studio/host setup — continuity-safe, no random style drift.
6. NO FILLER: Zero introduction chatter or conversational meta-text. Return valid JSON only.`;

    const prompt = `
COMPILE PRODUCTION PACK BRIEF FOR VIRAL SPARK:

SOURCE SPARK DATA:
- Title: "${spark.title}"
- Viral Hook Pattern: "${spark.hook}"
- Angle / Hook Type: "${spark.angle}"
- Why Now / Retention Rationale: "${spark.whyNow}"
- Target Platform: ${spark.platformFit || (modeKey === "deep" ? "YouTube Long-form (16:9)" : "YouTube Shorts (9:16)")}
- Viral Score: ${sparkScore}/100

${researchPromptBlock ? `${researchPromptBlock}\n` : ""}BRAND IDENTITY & ENVIRONMENT:
- Brand Name: ${brand.name}
- Industry Niche: ${niche || brand.niche || "General"}
- Archetype: ${brand.archetype}
- Tone Profile: ${tones}
- Content Pillars: ${pillars}
- Presenter / Host: ${hostStyle} (${charTraits})
- Production Mode: ${productionMode}
${offerPromptSection}
RANKED BRAND MEMORY & EXECUTIVE LAWS:
${rankedMemory}

Return a valid JSON object matching this exact structure with NO markdown formatting:
{
  "title": "${spark.title}",
  "productionMode": "${productionMode}",
  "hook": "Exact ready-to-speak opening line adapted for ${brand.name}",
  "scriptOutline": "Numbered beat sheet with timecodes: [00:00-00:05] Hook line... [00:05-00:15] Core Value... [00:15-00:25] Proof... [00:25-00:30] Spoken CTA...",
  "spokenCta": "Exact ready-to-speak closing line for host/VO",
  "onScreenCta": "UPPERCASE LOWER-THIRD TEXT (MAX 6 WORDS)",
  "visualDirection": "Concrete studio set, camera movement, and host posture direction for ${modeKey} mode",
  "caption": "Platform post text with hashtags and offer link",
  "platformRecommendation": "${spark.platformFit || (modeKey === "deep" ? "YouTube Long-form" : "YouTube Shorts")}",
  "whyThisWorks": "1-3 sentences citing spark evidence (${spark.whyNow}) and brand fit",
  "brandFitScore": ${Math.min(99, Math.max(80, sparkScore))},
  "suggestedDuration": "${modeKey === "deep" ? "60-180s" : "30-60s"}"
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
      const fallback = compileDeterministicBrief({ spark, brand, character, defaultOffer, productionMode, niche });

      // Validate hook: if parsed.hook looks like meta instruction ("hook for brand"), use fallback
      let parsedHook = asText(parsed.hook, fallback.hook);
      if (parsedHook.toLowerCase().startsWith("hook:") || parsedHook.toLowerCase().includes("curiosity-gap hook") || parsedHook.length < 5) {
        parsedHook = fallback.hook;
      }

      let parsedOutline = asText(parsed.scriptOutline, fallback.scriptOutline);
      if (!parsedOutline.includes("00:") && !parsedOutline.includes("1.") && !parsedOutline.includes("Beat")) {
        parsedOutline = fallback.scriptOutline;
      }

      return {
        title: asText(parsed.title, spark.title),
        productionMode: asText(parsed.productionMode, productionMode),
        hook: parsedHook,
        scriptOutline: parsedOutline,
        spokenCta: asText(parsed.spokenCta, fallback.spokenCta),
        onScreenCta: asText(parsed.onScreenCta, fallback.onScreenCta),
        visualDirection: asText(parsed.visualDirection, fallback.visualDirection),
        caption: asText(parsed.caption, fallback.caption),
        platformRecommendation: asText(parsed.platformRecommendation, fallback.platformRecommendation),
        whyThisWorks: asText(parsed.whyThisWorks, fallback.whyThisWorks),
        brandFitScore: typeof parsed.brandFitScore === "number" ? parsed.brandFitScore : sparkScore,
        suggestedDuration: asText(parsed.suggestedDuration, fallback.suggestedDuration),
        offerCta: fallback.offerCta,
      };
    } catch (err) {
      console.warn("[ProductionBriefService] AI generation fallback triggered:", err);
      return compileDeterministicBrief({ spark, brand, character, defaultOffer, productionMode, niche });
    }
  }
}
