import type { ViralSpark, Brand, Character, MemoryItem, ProductionBrief, ProductionBriefBeat, Offer, StructuredResearchContext } from "../../domain/types";
import { ModelRouter } from "../runtime/modelRouter";
import { ProductionGenerationGuard } from "./ProductionGenerationGuard";
import { loadPersistedState } from "../../state/persistence";
import { buildRankedBrandLaws } from "../memory/rankBrandLaws";
import { resolveProductionMode } from "./resolveProductionMode";

/**
 * Deterministically resolves the best available research structure for a spark.
 * Priority: params.researchContext -> spark.researchContext -> rebuild from spark pattern fields -> null.
 */
export function resolveResearchContext(
  spark: ViralSpark,
  params?: { researchContext?: StructuredResearchContext }
): StructuredResearchContext | null {
  // 1) Explicit params.researchContext
  if (params?.researchContext && Object.keys(params.researchContext).length > 0) {
    return params.researchContext;
  }

  // 2) Attached spark.researchContext
  if (spark?.researchContext && Object.keys(spark.researchContext).length > 0) {
    return spark.researchContext;
  }

  // 3) Rebuild from spark fields if source / pattern data exists
  const hasPatternData = Boolean(
    spark.origin === "SOURCE" ||
      spark.sourceId ||
      (spark.hook && (spark.hook.toLowerCase().includes("opener") || spark.hook.toLowerCase().includes("pattern")))
  );

  if (hasPatternData) {
    const hookPattern = spark.hook || undefined;
    const titlePattern = spark.title ? `Title structure (${spark.title.slice(0, 40)}...)` : undefined;
    const format = spark.suggestedFormat || (spark.suggestedProductionMode === "express" ? "Vertical Short-Form (Shorts)" : "Host Presentation");
    const ctaStyle = spark.whyNow?.includes("comment") ? "Organic comment discussion bridge" : "Direct value CTA";
    const nicheLanguage = spark.whyNow ? spark.whyNow.split(/\s+/).filter((w) => w.length > 5).slice(0, 3) : undefined;
    const viralReasons = spark.whyNow ? [spark.whyNow] : undefined;

    return {
      sourceName: spark.sourceId ? `Inspiration Source (${spark.sourceId})` : "Inspiration Account",
      platform: spark.platformFit?.includes("Shorts") ? "YouTube Shorts" : "Video",
      hookPattern,
      titlePattern,
      format,
      ctaStyle,
      nicheLanguage,
      viralReasons,
      provenStructure: format,
    };
  }

  // 4) If pure trend or general spark without research context -> null (do not fabricate)
  return null;
}

function formatResearchContextBlock(context: StructuredResearchContext | null, brandName: string): string {
  if (!context) {
    return `RESEARCH CONTEXT: None attached. (Do NOT fabricate source metrics or claim external inspiration in whyThisWorks).`;
  }

  const lines: string[] = ["RESEARCH STRUCTURE (EVIDENCE-BACKED — TRANSLATE, DO NOT CLONE):"];
  if (context.sourceName) lines.push(`- Inspiration Source: ${context.sourceName} (${context.platform || "Video"})`);
  if (context.hookPattern) lines.push(`- Proven Hook Pattern: "${context.hookPattern}"`);
  if (context.titlePattern) lines.push(`- Title Structure Pattern: "${context.titlePattern}"`);
  if (context.format) lines.push(`- Content Format that Worked: ${context.format}`);
  if (context.ctaStyle) lines.push(`- CTA Style that Worked: "${context.ctaStyle}"`);
  if (context.provenStructure) lines.push(`- Proven Storytelling Structure: ${context.provenStructure}`);
  if (context.nicheLanguage && context.nicheLanguage.length > 0) {
    lines.push(`- High-Value Niche Language to Prefer: ${context.nicheLanguage.join(", ")}`);
  }
  if (context.viralReasons && context.viralReasons.length > 0) {
    lines.push(`- Retention & Viral Evidence: ${context.viralReasons.join("; ")}`);
  }

  lines.push(`COMPILER ORDERS:`);
  lines.push(`- Translate this engagement STRUCTURE into niche-authentic spoken lines for ${brandName}.`);
  lines.push(`- Adapt to brand tone, pillars, character, and offer — do NOT copy the source creator's identity.`);
  lines.push(`- Hook output must be ready-to-speak, not a meta description of the pattern.`);
  lines.push(`- whyThisWorks must cite the research evidence in 1-3 sentences.`);

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
  const modeKey = resolveProductionMode({ modeOverride: productionMode, brand, spark });

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

  const durationSec = params.targetDurationSec || brand.formatSettings?.targetDurationSec || 60;
  const beats: ProductionBriefBeat[] = [];

  if (durationSec <= 20) {
    // <=20s (15s Short): 2 Beats (Hook + CTA) ~35-50 words total
    beats.push(
      {
        timecode: "[00:00-00:10]",
        valueJob: "hook",
        spokenLines: `${cleanHook} If you are running an operation in ${niche || brand.niche || "this space"}, this is the shift you cannot afford to overlook.`,
        onScreenText: `THE NON-OBVIOUS SHIFT`,
        cameraDirection: modeKey === "deep" ? "Slow push-in zoom on presenter" : "Presenter centered, high energy",
      },
      {
        timecode: `[00:10-00:${durationSec.toString().padStart(2, "0")}]`,
        valueJob: "cta",
        spokenLines: spokenCta,
        onScreenText: onScreenCta,
        cameraDirection: "Static lock-off direct to lens",
      }
    );
  } else if (durationSec <= 45) {
    // <=45s (30-45s Short): 3 Beats (Hook, Proof/Payoff, CTA) ~70-110 words total
    const midSec = Math.round(durationSec * 0.72);
    beats.push(
      {
        timecode: "[00:00-00:08]",
        valueJob: "hook",
        spokenLines: cleanHook,
        onScreenText: `WHY MOST GET THIS WRONG`,
        cameraDirection: modeKey === "deep" ? "Slow push-in zoom on presenter" : "Presenter centered, high energy",
      },
      {
        timecode: `[00:08-00:${midSec.toString().padStart(2, "0")}]`,
        valueJob: "proof",
        spokenLines: spark.whyNow
          ? `${spark.whyNow} Here is the exact architecture ${brand.name} uses: focus on core leverage, eliminate wasted spend, and execute with disciplined precision.`
          : `Most operators in ${niche || brand.niche || "this space"} make the costly mistake of applying outdated playbooks. Here is the framework ${brand.name} uses: focus on core leverage, eliminate wasted spend, and execute with disciplined precision.`,
        onScreenText: `${brand.name.toUpperCase()} FRAMEWORK`,
        cameraDirection: "Close-up authority angle",
      },
      {
        timecode: `[00:${midSec.toString().padStart(2, "0")}-00:${durationSec.toString().padStart(2, "0")}]`,
        valueJob: "cta",
        spokenLines: spokenCta,
        onScreenText: onScreenCta,
        cameraDirection: "Static lock-off direct to lens",
      }
    );
  } else if (durationSec <= 90) {
    // <=90s (60s Short/Reel): 4 Beats (Hook, Problem, Proof, CTA) ~140-180 words total
    beats.push(
      {
        timecode: "[00:00-00:10]",
        valueJob: "hook",
        spokenLines: cleanHook,
        onScreenText: `THE SHIFT NOBODY SEES`,
        cameraDirection: "Slow push-in zoom on host",
      },
      {
        timecode: "[00:10-00:25]",
        valueJob: "problem",
        spokenLines: spark.whyNow
          ? `Here is the core problem: ${spark.whyNow}. Traditional workflows in ${niche || brand.niche || "this industry"} simply cannot keep pace with this change.`
          : `Every single day, operators in ${niche || brand.niche || "this industry"} waste critical resources attempting to solve tomorrow's bottlenecks with yesterday's broken playbooks.`,
        onScreenText: `THE CORE BOTTLENECK`,
        cameraDirection: "Medium tracking pan across set",
      },
      {
        timecode: "[00:25-00:48]",
        valueJob: "proof",
        spokenLines: `When you look at the top 1% performing brands, they never rely on brute force. At ${brand.name}, we deploy structured leverage to automate repetitive cycles and guarantee compounding ROI.`,
        onScreenText: `${brand.name.toUpperCase()} LEVERAGE SYSTEM`,
        cameraDirection: "Medium shot with split screen data graphic",
      },
      {
        timecode: `[00:48-00:${durationSec.toString().padStart(2, "0")}]`,
        valueJob: "cta",
        spokenLines: spokenCta,
        onScreenText: onScreenCta,
        cameraDirection: "Static lock-off direct to camera",
      }
    );
  } else if (durationSec <= 200) {
    // 120-180s (2-3 min) Mid-Deep Dive (8 Value Beats)
    beats.push(
      {
        timecode: "[00:00-00:15]",
        valueJob: "hook",
        spokenLines: cleanHook,
        onScreenText: `EXECUTIVE BRIEFING`,
        cameraDirection: "Cinematic wide-to-tight camera push",
      },
      {
        timecode: "[00:15-00:35]",
        valueJob: "problem",
        spokenLines: `Here is the systemic breakdown happening right now across ${niche || brand.niche || "this industry"}. Traditional methods are decaying faster than ever.`,
        onScreenText: `SYSTEMIC FAILURE MODES`,
        cameraDirection: "Slow tracking pan over studio set",
      },
      {
        timecode: "[00:35-00:55]",
        valueJob: "myth_bust",
        spokenLines: `Common wisdom tells you to just work harder or increase volume. That is the fastest route to burnout and margin erosion.`,
        onScreenText: `MYTH: MORE VOLUME = BETTER RESULTS`,
        cameraDirection: "Medium close-up authority frame",
      },
      {
        timecode: "[00:55-01:25]",
        valueJob: "context",
        spokenLines: `At ${brand.name}, we operate on a completely different architecture. We decouple input effort from high-leverage output.`,
        onScreenText: `THE NEW OPERATING MODEL`,
        cameraDirection: "Dynamic angle with lower-third visual overlay",
      },
      {
        timecode: "[01:25-01:55]",
        valueJob: "proof",
        spokenLines: `Let us break down the exact math: when you optimize the core conversion engine first, every subsequent metric scales exponentially.`,
        onScreenText: `THE MATHEMATICS OF LEVERAGE`,
        cameraDirection: "Presenter explaining breakdown",
      },
      {
        timecode: "[01:55-02:20]",
        valueJob: "example",
        spokenLines: `Here is how you implement this starting today: audit your primary friction points, automate repetitive cycles, and protect focus.`,
        onScreenText: `3-STEP IMPLEMENTATION AUDIT`,
        cameraDirection: "Medium tracking shot",
      },
      {
        timecode: "[02:20-02:45]",
        valueJob: "payoff",
        spokenLines: `When this architecture is locked in, you gain total clarity, speed, and unbeatable market positioning.`,
        onScreenText: `PREDICTABLE SCALING`,
        cameraDirection: "Tight framing with cinematic depth",
      },
      {
        timecode: "[02:45-03:00]",
        valueJob: "cta",
        spokenLines: spokenCta,
        onScreenText: onScreenCta,
        cameraDirection: "Static lock-off direct to lens",
      }
    );
  } else {
    // 300s+ (5 min - 60 min) Long-Form Master Blueprint (10 Executive Chapter Beats)
    beats.push(
      {
        timecode: "[00:00-00:25]",
        valueJob: "hook",
        spokenLines: `${cleanHook} In this complete masterclass, we will deconstruct why traditional playbooks in ${niche || brand.niche || "this space"} are failing, and install the exact high-leverage architecture ${brand.name} uses.`,
        onScreenText: `EXECUTIVE MASTERCLASS`,
        cameraDirection: "Cinematic push-in establishing host in architectural studio",
      },
      {
        timecode: "[00:25-00:55]",
        valueJob: "problem",
        spokenLines: `Look across the landscape today: operators are running faster on the treadmill while margins shrink. The underlying issue is not execution effort—it is structural friction and outdated operational paradigms.`,
        onScreenText: `STRUCTURAL FRICTION AUDIT`,
        cameraDirection: "Slow motivated tracking shot with illuminated data overlay",
      },
      {
        timecode: "[00:55-01:30]",
        valueJob: "myth_bust",
        spokenLines: `The biggest misconception in ${niche || brand.niche || "this market"} is that adding more personnel or buying more software fixes process debt. It does the opposite—it multiplies complexity and slows decision velocity.`,
        onScreenText: `MYTH: SOFTWARE SOLVES BROKEN SYSTEMS`,
        cameraDirection: "Close-up direct-to-lens authority delivery",
      },
      {
        timecode: "[01:30-02:15]",
        valueJob: "context",
        spokenLines: `To achieve genuine compounding, you must transition from reactive hustle to systematic leverage. At ${brand.name}, our core thesis rests on three non-negotiable pillars: signal clarity, frictionless conversion, and automated distribution.`,
        onScreenText: `THE 3 PILLARS OF COMPOUNDING LEVERAGE`,
        cameraDirection: "Medium tracking shot revealing schematic diagram",
      },
      {
        timecode: "[02:15-03:00]",
        valueJob: "proof",
        spokenLines: `Let us examine the data: when you remove intermediary friction and streamline your core value proposition, customer acquisition efficiency improves by 300% without increasing top-of-funnel spend.`,
        onScreenText: `ACQUISITION EFFICIENCY: +300%`,
        cameraDirection: "Split composition with key performance metrics",
      },
      {
        timecode: "[03:00-03:45]",
        valueJob: "example",
        spokenLines: `Step one is auditing your delivery pipeline. Map every single touchpoint where prospects stall, and eliminate every requirement that does not directly contribute to immediate value realization.`,
        onScreenText: `STEP 1: PIPELINE FRICTION AUDIT`,
        cameraDirection: "Dynamic presenter walk-and-talk in studio set",
      },
      {
        timecode: "[03:45-04:20]",
        valueJob: "example",
        spokenLines: `Step two is deploying modular automated workflows. By systematizing repetitive operational loops, your core team focuses 100% of their bandwidth on high-conviction strategic initiatives.`,
        onScreenText: `STEP 2: MODULAR WORKFLOW AUTOMATION`,
        cameraDirection: "Medium close-up with visual interface graphics",
      },
      {
        timecode: "[04:20-04:45]",
        valueJob: "payoff",
        spokenLines: `When these systems lock into place, you unlock total operational freedom, predictable pipeline velocity, and an unassailable competitive moat in ${niche || brand.niche || "your industry"}.`,
        onScreenText: `THE COMPOUNDING ADVANTAGE`,
        cameraDirection: "Cinematic low-angle authority shot",
      },
      {
        timecode: "[04:45-05:00]",
        valueJob: "cta",
        spokenLines: spokenCta,
        onScreenText: onScreenCta,
        cameraDirection: "Static lock-off direct into camera with brand resolution",
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
    whyThisWorks: researchContext
      ? `Based on proven inspiration pattern (${researchContext.sourceName || "Inspiration Account"}: ${researchContext.format || "Structured format"}). Cites verified retention signals translated for ${brand.name}.`
      : spark.whyNow
      ? `Built on strategic opportunity: ${spark.whyNow}. Adapted directly to ${brand.name}'s niche authority.`
      : `High curiosity gap paired with ${brand.name}'s executive authority.`,
    brandFitScore: spark.brandFitScore || 90,
    suggestedDuration: durationSec >= 300 ? "300-600s" : durationSec >= 120 ? "120-180s" : durationSec >= 60 ? "60-90s" : "30-45s",
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

    const resolvedResearch = resolveResearchContext(spark, { researchContext });

    if (!ProductionGenerationGuard.isEnabled()) {
      console.warn("[ProductionBriefService] Generation blocked: Production Generation is OFF.");
      const fallback = compileDeterministicBrief({ spark, brand, character, defaultOffer, productionMode, niche, researchContext: resolvedResearch || undefined, targetDurationSec });
      return {
        ...fallback,
        scriptOutline: "[PAUSED] Production Generation is turned OFF in settings.",
      };
    }

    const rankedMemory = buildRankedBrandLaws(memoryItems).lawsBlock;
    const researchPromptBlock = formatResearchContextBlock(resolvedResearch, brand.name);
    const hostStyle = character?.style || character?.name || brand.name;
    const charTraits = character?.traits ? character.traits.join(", ") : "Authoritative, direct, engaging";

    const activePillars = Array.isArray(brand.contentPillars)
      ? brand.contentPillars.filter((p) => p.active !== false).map((p) => p.label)
      : [];
    const pillars = activePillars.length > 0 ? activePillars.join(", ") : (brand.niche || "Strategy, Insights");

    const activeTones = Array.isArray(brand.tone)
      ? brand.tone.filter((t) => t.active !== false).map((t) => t.label)
      : [];
    const activeStyles = Array.isArray(brand.style)
      ? brand.style.filter((s) => s.active !== false).map((s) => s.label)
      : [];
    const tones = activeTones.length > 0 ? activeTones.join(", ") : "Authoritative, conversational";
    const styles = activeStyles.length > 0 ? activeStyles.join(", ") : "Direct-to-camera, story-driven";

    const audPrimary = brand.audience?.primary || "Forward-thinking creators and operators";
    const audPain = Array.isArray(brand.audience?.painPoints) && brand.audience.painPoints.length > 0
      ? brand.audience.painPoints.join("; ")
      : "Inconsistent output and unclear positioning";
    const audDesires = Array.isArray(brand.audience?.desires) && brand.audience.desires.length > 0
      ? brand.audience.desires.join("; ")
      : "High-retention viral authority and rapid execution";

    const sparkScore = spark.brandFitScore || 92;
    const modeKey = resolveProductionMode({ modeOverride: productionMode, brand, spark });

    const effectiveDurationSec =
      targetDurationSec ||
      brand.formatSettings?.targetDurationSec ||
      60;

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

    const targetBeatCount =
      effectiveDurationSec <= 20
        ? "2 beats"
        : effectiveDurationSec <= 45
        ? "3 beats"
        : effectiveDurationSec <= 90
        ? "4 beats"
        : effectiveDurationSec <= 180
        ? "5-6 beats"
        : effectiveDurationSec <= 300
        ? "7-8 beats"
        : "8-12 beats";

    const minRequiredBeats =
      effectiveDurationSec <= 20
        ? 2
        : effectiveDurationSec <= 45
        ? 3
        : effectiveDurationSec <= 90
        ? 4
        : effectiveDurationSec <= 180
        ? 5
        : effectiveDurationSec <= 300
        ? 7
        : 8;

    const targetWordFloor =
      effectiveDurationSec <= 20
        ? 35
        : effectiveDurationSec <= 45
        ? 75
        : effectiveDurationSec <= 90
        ? 140
        : effectiveDurationSec <= 180
        ? 380
        : effectiveDurationSec <= 300
        ? 700
        : 850;

    const systemInstruction = `You are SPARK's Chief Creative Officer & Production Compiler.
Your task is to compile a Viral Spark into a HIGH-SUBSTANCE, DURATION-SIZED PRODUCTION BRIEF for "${brand.name}".

ANTI-SLOP COMPILER LAWS (MANDATORY):
1. HOOK LAW: Output an exact READY-TO-SPEAK line(s) for the brand host. NEVER output meta phrases like "curiosity opener", "pattern interrupt", "hook formula", "in this video we will discuss".
2. BEAT SHEET LAW: scriptOutline must be a timed beat sheet scaled to ${effectiveDurationSec} seconds. Every beat MUST have:
   - Timecode: [00:00-00:08]
   - ValueJob: hook | problem | context | proof | example | myth_bust | payoff | cta
   - SpokenLines: Complete, ready-to-speak sentences for the host/narrator (substantive, no placeholders)
   - OnScreenText: <=6-8 words in uppercase
3. DURATION LAW: Scale substance strictly with duration (${effectiveDurationSec}s):
   - You MUST generate exactly ${targetBeatCount}.
   - The total spoken word count across all beats combined MUST be at least ${targetWordFloor} words (no thin stubs).
   - Long targets get deep proof, examples, step-by-step implementation, and breakdowns—NEVER empty filler or time-padding.
4. CTA LAW: spokenCta must be 1 exact ready-to-speak line. onScreenCta must be <=6-8 words in uppercase.
5. AUDIENCE & RESEARCH LAW: Address the audience's primary desires and solve their pain points directly. Translate inspiration patterns and niche language into authentic brand copy. Cite evidence in whyThisWorks.
6. MEMORY LAW: Obey all ranked brand laws and hard NEVER rules.
7. OUTPUT LAW: Return valid JSON matching the schema with zero introductory chatter.`;

    const prompt = `
COMPILE PRODUCTION BRIEF FOR VIRAL SPARK:

TARGET RUNTIME: ${effectiveDurationSec} seconds (${modeKey.toUpperCase()} MODE)
REQUIRED BEATS: ${targetBeatCount} (Minimum spoken word floor: ${targetWordFloor} words)

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
- Archetype: ${brand.archetype || "Visionary Creator"}
- Tone Profile: ${tones}
- Delivery Style: ${styles}
- Content Pillars (Active Focus): ${pillars}
- Country & Language Context: ${brand.country || "Global"} / ${brand.language || "English"}
- Target Audience: ${audPrimary}
- Audience Core Pain Points: ${audPain}
- Audience Core Desires: ${audDesires}
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
  "suggestedDuration": "${effectiveDurationSec >= 300 ? "300-600s" : effectiveDurationSec >= 120 ? "120-180s" : effectiveDurationSec >= 60 ? "60-90s" : "30-45s"}"
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

      let parsedBeats: ProductionBriefBeat[] = Array.isArray(parsed.beats) && parsed.beats.length > 0
        ? parsed.beats.map((b: any) => ({
            timecode: String(b.timecode || "[00:00-00:05]"),
            valueJob: b.valueJob || "context",
            spokenLines: String(b.spokenLines || b.spoken || ""),
            onScreenText: String(b.onScreenText || b.text || ""),
            cameraDirection: b.cameraDirection || "Presenter centered",
          }))
        : fallback.beats || [];

      // Spoken-word floor & beat count verification
      const totalSpokenWords = parsedBeats.reduce(
        (acc, b) => acc + (b.spokenLines ? b.spokenLines.trim().split(/\s+/).filter(Boolean).length : 0),
        0
      );

      if (parsedBeats.length < minRequiredBeats || totalSpokenWords < targetWordFloor * 0.70) {
        console.log(
          `[ProductionBriefService] Parsed beats (${parsedBeats.length} beats, ${totalSpokenWords} words) below floor for ${effectiveDurationSec}s (requires ${minRequiredBeats} beats, >=${Math.round(targetWordFloor * 0.7)} words). Using duration-scaled fallback beats.`
        );
        parsedBeats = fallback.beats || parsedBeats;
        parsedOutline = fallback.scriptOutline || parsedOutline;
      }

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
