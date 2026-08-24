import type { ViralSpark, Brand, Character, MemoryItem, ProductionBrief, ProductionBriefBeat, Offer, StructuredResearchContext } from "../../domain/types";
import { ModelRouter } from "../runtime/modelRouter";
import { ProductionGenerationGuard } from "./ProductionGenerationGuard";
import { loadPersistedState } from "../../state/persistence";
import { buildRankedBrandLaws } from "../memory/rankBrandLaws";
import { resolveProductionMode } from "./resolveProductionMode";

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
  targetDurationSec?: number;
}): ProductionBrief {
  const { spark, brand, character, defaultOffer, productionMode = "standard", niche, researchContext = spark.researchContext } = params;
  const rawMode = (productionMode || spark.suggestedProductionMode || "standard").toLowerCase();
  const modeKey = rawMode.includes("deep") || rawMode.includes("cinematic") ? "deep" : rawMode.includes("express") || rawMode.includes("narrator") ? "express" : "standard";

  const hostTitle = character?.name || brand.name;
  const patternHook = researchContext?.hookPattern || spark.hook;
  const sparkHook = patternHook ? patternHook.trim() : `The ${niche || brand.niche || "industry"} shift nobody is talking about.`;
  const cleanHook =
    sparkHook.length > 5 && !sparkHook.toLowerCase().startsWith("hook:") && !sparkHook.toLowerCase().includes("curiosity opener")
      ? sparkHook
      : `Here is the non-obvious reality about ${niche || brand.niche || "this market"} that most operators in ${brand.name}'s space ignore.`;

  const spokenCta = defaultOffer
    ? `Claim your access to ${defaultOffer.title} now — link in bio or comment below.`
    : `Follow ${brand.name} for daily strategic breakdowns.`;

  const onScreenCta = defaultOffer
    ? `GET ${defaultOffer.title.toUpperCase().slice(0, 20)}`
    : `SAVE & FOLLOW ${brand.name.toUpperCase().slice(0, 15)}`;

  const durationSec = params.targetDurationSec || (modeKey === "deep" ? 120 : 45);
  const beats: ProductionBriefBeat[] = [];

  if (durationSec <= 45) {
    beats.push(
      {
        timecode: "[00:00-00:06]",
        valueJob: "hook",
        spokenLines: cleanHook,
        onScreenText: `WHY MOST GET THIS WRONG`,
        cameraDirection: modeKey === "deep" ? "Slow push-in zoom on presenter" : "Presenter centered, high energy",
      },
      {
        timecode: "[00:06-00:18]",
        valueJob: "problem",
        spokenLines: spark.whyNow || `Most leaders in ${niche || brand.niche || "this space"} make the costly mistake of applying outdated playbooks.`,
        onScreenText: `THE COSTLY MISTAKE`,
        cameraDirection: "Medium tracking shot with graphics",
      },
      {
        timecode: "[00:18-00:36]",
        valueJob: "proof",
        spokenLines: `Here is the framework ${brand.name} uses: focus on core leverage, eliminate wasted spend, and execute with disciplined precision.`,
        onScreenText: `${brand.name.toUpperCase()} FRAMEWORK`,
        cameraDirection: "Close-up authority angle",
      },
      {
        timecode: "[00:36-00:45]",
        valueJob: "cta",
        spokenLines: spokenCta,
        onScreenText: onScreenCta,
        cameraDirection: "Static lock-off direct to lens",
      }
    );
  } else if (durationSec <= 90) {
    beats.push(
      {
        timecode: "[00:00-00:08]",
        valueJob: "hook",
        spokenLines: cleanHook,
        onScreenText: `THE SHIFT NOBODY SEES`,
        cameraDirection: "Slow push-in zoom on host",
      },
      {
        timecode: "[00:08-00:22]",
        valueJob: "problem",
        spokenLines: spark.whyNow || `Every day, operators in ${niche || brand.niche || "this industry"} waste resources solving yesterday's problems.`,
        onScreenText: `THE CORE BOTTLENECK`,
        cameraDirection: "Medium tracking pan across set",
      },
      {
        timecode: "[00:22-00:40]",
        valueJob: "context",
        spokenLines: `When you look at the top 1% performing brands, they never rely on brute force. They deploy structured leverage.`,
        onScreenText: `HOW THE TOP 1% EXECUTE`,
        cameraDirection: "Medium shot with split screen data graphic",
      },
      {
        timecode: "[00:40-00:60]",
        valueJob: "example",
        spokenLines: `For example, instead of scaling broken processes, ${brand.name} restructures the entire delivery pipeline to guarantee consistent ROI.`,
        onScreenText: `CASE IN POINT: SYSTEMATIC ROI`,
        cameraDirection: "Presenter dynamic walk-and-talk",
      },
      {
        timecode: "[00:60-00:78]",
        valueJob: "payoff",
        spokenLines: `The result is effortless compounding and total predictability in execution.`,
        onScreenText: `THE COMPOUNDING ADVANTAGE`,
        cameraDirection: "Tight close-up, high authority",
      },
      {
        timecode: "[00:78-00:90]",
        valueJob: "cta",
        spokenLines: spokenCta,
        onScreenText: onScreenCta,
        cameraDirection: "Static lock-off direct to camera",
      }
    );
  } else {
    beats.push(
      {
        timecode: "[00:00-00:12]",
        valueJob: "hook",
        spokenLines: cleanHook,
        onScreenText: `EXECUTIVE BRIEFING`,
        cameraDirection: "Cinematic wide-to-tight camera push",
      },
      {
        timecode: "[00:12-00:30]",
        valueJob: "problem",
        spokenLines: `Here is the systemic breakdown happening right now across ${niche || brand.niche || "this industry"}. Traditional methods are decaying faster than ever.`,
        onScreenText: `SYSTEMIC FAILURE MODES`,
        cameraDirection: "Slow tracking pan over studio set",
      },
      {
        timecode: "[00:30-00:50]",
        valueJob: "myth_bust",
        spokenLines: `Common wisdom tells you to just work harder or increase volume. That is the fastest route to burnout and margin erosion.`,
        onScreenText: `MYTH: MORE VOLUME = BETTER RESULTS`,
        cameraDirection: "Medium close-up authority frame",
      },
      {
        timecode: "[00:50-00:80]",
        valueJob: "context",
        spokenLines: `At ${brand.name}, we operate on a completely different architecture. We decouple input effort from high-leverage output.`,
        onScreenText: `THE NEW OPERATING MODEL`,
        cameraDirection: "Dynamic angle with lower-third visual overlay",
      },
      {
        timecode: "[00:80-01:15]",
        valueJob: "proof",
        spokenLines: `Let us break down the exact math: when you optimize the core conversion engine first, every subsequent metric scales exponentially.`,
        onScreenText: `THE MATHEMATICS OF LEVERAGE`,
        cameraDirection: "Presenter explaining breakdown",
      },
      {
        timecode: "[01:15-01:45]",
        valueJob: "example",
        spokenLines: `Here is how you implement this starting today: audit your primary friction points, automate repetitive cycles, and protect focus.`,
        onScreenText: `3-STEP IMPLEMENTATION AUDIT`,
        cameraDirection: "Medium tracking shot",
      },
      {
        timecode: "[01:45-02:10]",
        valueJob: "payoff",
        spokenLines: `When this architecture is locked in, you gain total clarity, speed, and unbeatable market positioning.`,
        onScreenText: `PREDICTABLE SCALING`,
        cameraDirection: "Tight framing with cinematic depth",
      },
      {
        timecode: "[02:10-02:30]",
        valueJob: "cta",
        spokenLines: spokenCta,
        onScreenText: onScreenCta,
        cameraDirection: "Static lock-off direct to lens",
      }
    );
  }

  const scriptOutline = beats
    .map(
      (b) =>
        `${b.timecode} [${b.valueJob.toUpperCase()}] "${b.spokenLines}" | ONSCREEN: ${b.onScreenText} | CAMERA: ${b.cameraDirection || "Standard"}`
    )
    .join("\n");

  const visualDirection =
    modeKey === "deep"
      ? `Continuous single-take staging for ${hostTitle}. 16:9 cinematic framing, studio lighting, zero montage cuts.`
      : `Vertical 9:16 framing. Presenter ${hostTitle} centered in studio set, high-contrast lower-third typography, dynamic scene transitions.`;

  const caption = defaultOffer
    ? `${spark.title}\n\n${spark.whyNow || ""}\n\nGet ${defaultOffer.title} → ${defaultOffer.url}\n\n#${brand.name.replace(/\s+/g, "")} #${(niche || brand.niche || "strategy").replace(/\s+/g, "")}`
    : `${spark.title}\n\n${spark.whyNow || ""}\n\nSave this post and follow ${brand.name} for more strategic breakdowns.`;

  const offerCta = defaultOffer
    ? {
        id: defaultOffer.id,
        type: defaultOffer.type,
        title: defaultOffer.title,
        url: defaultOffer.url,
        priceLabel: defaultOffer.priceLabel,
        description: defaultOffer.description,
      }
    : undefined;

  return {
    title: spark.title || "Production Brief",
    productionMode: productionMode,
    hook: cleanHook,
    scriptOutline,
    beats,
    spokenCta,
    onScreenCta,
    visualDirection,
    caption,
    platformRecommendation: spark.platformFit || (modeKey === "deep" ? "YouTube Long-form (16:9)" : "YouTube Shorts (9:16)"),
    whyThisWorks: spark.whyNow
      ? `Based on proven pattern: ${spark.whyNow}. Adapted to ${brand.name}'s voice.`
      : `High curiosity gap paired with ${brand.name}'s niche authority.`,
    brandFitScore: spark.brandFitScore || 90,
    suggestedDuration: durationSec >= 120 ? "120-180s" : durationSec >= 60 ? "60-90s" : "30-45s",
    offerCta,
  };
}

export class ProductionBriefService {
  static async generateBrief(params: {
    spark: ViralSpark;
    brand: Brand;
    character?: Character;
    niche?: string;
    memoryItems?: MemoryItem[];
    productionMode?: string;
    researchContext?: StructuredResearchContext;
    targetDurationSec?: number;
  }): Promise<ProductionBrief> {
    const { spark, brand, character, niche, memoryItems = [], productionMode = "standard", researchContext = spark.researchContext, targetDurationSec } = params;

    const defaultOffer: Offer | undefined = (() => {
      try {
        const local = loadPersistedState<any>();
        const offers: Offer[] = Array.isArray(local?.offers) ? local.offers : [];
        return offers.find((o) => o.active && o.isDefault) || offers.find((o) => o.active);
      } catch {
        return undefined;
      }
    })();

    if (!ProductionGenerationGuard.isEnabled()) {
      console.warn("[ProductionBriefService] Generation blocked: Production Generation is OFF.");
      const fallback = compileDeterministicBrief({ spark, brand, character, defaultOffer, productionMode, niche, researchContext, targetDurationSec });
      return {
        ...fallback,
        scriptOutline: "[PAUSED] Production Generation is turned OFF in settings.",
      };
    }

    const rankedMemory = buildRankedBrandLaws(memoryItems).lawsBlock;
    const researchPromptBlock = formatResearchContextBlock(researchContext);
    const hostStyle = character?.style || character?.name || brand.name;
    const charTraits = character?.traits ? character.traits.join(", ") : "Authoritative, direct, engaging";
    const pillars = brand.contentPillars ? brand.contentPillars.map((p) => p.label).join(", ") : "Strategy, Insights";
    const tones = brand.tone ? brand.tone.map((t) => t.label).join(", ") : "Professional, executive";
    const sparkScore = spark.brandFitScore || 92;
    const modeKey = resolveProductionMode({ modeOverride: productionMode, spark, brand });

    const effectiveDurationSec =
      targetDurationSec ||
      brand.formatSettings?.targetDurationSec ||
      (modeKey === "deep" ? 120 : 45);

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

    const systemInstruction = `You are SPARK's Chief Creative Officer & Production Compiler.
Your task is to compile a Viral Spark into a HIGH-SUBSTANCE, DURATION-SIZED PRODUCTION BRIEF for "${brand.name}".

ANTI-SLOP COMPILER LAWS (MANDATORY):
1. HOOK LAW: Output an exact READY-TO-SPEAK line(s) for the brand host. NEVER output meta phrases like "curiosity opener", "pattern interrupt", "hook formula", "in this video we will discuss".
2. BEAT SHEET LAW: scriptOutline must be a timed beat sheet scaled to ${effectiveDurationSec} seconds. Every beat MUST have:
   - Timecode: [00:00-00:08]
   - ValueJob: hook | problem | context | proof | example | myth_bust | payoff | cta
   - SpokenLines: Complete, ready-to-speak sentences for the host/narrator (substantive, no placeholders)
   - OnScreenText: <=6-8 words in uppercase
3. DURATION LAW: Scale substance with duration (${effectiveDurationSec}s). Long targets get more proof, examples, and breakdowns—NEVER empty filler or time-padding.
4. CTA LAW: spokenCta must be 1 exact ready-to-speak line. onScreenCta must be <=6-8 words in uppercase.
5. RESEARCH LAW: Translate inspiration patterns and niche language into authentic brand copy. Cite evidence in whyThisWorks.
6. MEMORY LAW: Obey all ranked brand laws and hard NEVER rules.
7. OUTPUT LAW: Return valid JSON matching the schema with zero introductory chatter.`;

    const prompt = `
COMPILE PRODUCTION BRIEF FOR VIRAL SPARK:

TARGET RUNTIME: ${effectiveDurationSec} seconds (${modeKey.toUpperCase()} MODE)

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
- Production Mode: ${modeKey}
${offerPromptSection}
RANKED BRAND MEMORY & EXECUTIVE LAWS:
${rankedMemory}

Return a valid JSON object matching this exact structure with NO markdown formatting:
{
  "title": "${spark.title}",
  "productionMode": "${modeKey}",
  "hook": "Exact ready-to-speak opening line adapted for ${brand.name}",
  "scriptOutline": "[00:00-00:06] [HOOK] \"Exact spoken line\" | ONSCREEN: TEXT | CAMERA: Action\\n[00:06-00:20] [PROBLEM] \"Exact spoken line\" | ONSCREEN: TEXT | CAMERA: Action\\n...",
  "beats": [
    {
      "timecode": "[00:00-00:06]",
      "valueJob": "hook",
      "spokenLines": "Exact spoken line",
      "onScreenText": "TEXT OVERLAY",
      "cameraDirection": "Presenter centered"
    }
  ],
  "spokenCta": "Exact ready-to-speak closing line for host/VO",
  "onScreenCta": "UPPERCASE LOWER-THIRD TEXT (MAX 6 WORDS)",
  "visualDirection": "Concrete studio set, camera movement, and host posture direction for ${modeKey} mode",
  "caption": "Platform post text with hashtags and offer link",
  "platformRecommendation": "${spark.platformFit || (modeKey === "deep" ? "YouTube Long-form" : "YouTube Shorts")}",
  "whyThisWorks": "1-3 sentences citing spark evidence (${spark.whyNow}) and brand authority",
  "brandFitScore": ${Math.min(99, Math.max(80, sparkScore))},
  "suggestedDuration": "${effectiveDurationSec >= 120 ? "120-180s" : effectiveDurationSec >= 60 ? "60-90s" : "30-45s"}"
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
      const fallback = compileDeterministicBrief({ spark, brand, character, defaultOffer, productionMode: modeKey, niche, targetDurationSec: effectiveDurationSec });

      let parsedHook = asText(parsed.hook, fallback.hook);
      if (
        parsedHook.toLowerCase().startsWith("hook:") ||
        parsedHook.toLowerCase().includes("curiosity opener") ||
        parsedHook.toLowerCase().includes("pattern interrupt") ||
        parsedHook.length < 5
      ) {
        parsedHook = fallback.hook;
      }

      let parsedOutline = asText(parsed.scriptOutline, fallback.scriptOutline);
      if (!parsedOutline.includes("00:") && !parsedOutline.includes("1.") && !parsedOutline.includes("Beat")) {
        parsedOutline = fallback.scriptOutline;
      }

      const parsedBeats: ProductionBriefBeat[] = Array.isArray(parsed.beats) && parsed.beats.length > 0
        ? parsed.beats.map((b: any) => ({
            timecode: String(b.timecode || "[00:00-00:05]"),
            valueJob: b.valueJob || "context",
            spokenLines: String(b.spokenLines || b.spoken || ""),
            onScreenText: String(b.onScreenText || b.text || ""),
            cameraDirection: b.cameraDirection || "Presenter centered",
          }))
        : fallback.beats || [];

      return {
        title: asText(parsed.title, spark.title),
        productionMode: modeKey,
        hook: parsedHook,
        scriptOutline: parsedOutline,
        beats: parsedBeats,
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
      return compileDeterministicBrief({ spark, brand, character, defaultOffer, productionMode: modeKey, niche, targetDurationSec: effectiveDurationSec });
    }
  }
}
