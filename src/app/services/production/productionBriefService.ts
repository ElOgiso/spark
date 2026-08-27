import type {
  ViralSpark,
  Brand,
  Character,
  MemoryItem,
  ProductionBrief,
  ProductionBriefBeat,
  ProductionScene,
  Offer,
  StructuredResearchContext,
  BeatSubject,
} from "../../domain/types";
import { ModelRouter } from "../runtime/modelRouter";
import { ProductionGenerationGuard } from "./ProductionGenerationGuard";
import { loadPersistedState } from "../../state/persistence";
import { buildRankedBrandLaws } from "../memory/rankBrandLaws";
import { resolveProductionMode } from "./resolveProductionMode";
import { getEffectiveContentFormat } from "./characterSheetGate";

/**
 * Resolves the shot subject for a beat based on contentFormat and available sheets.
 * Default mapping:
 * - contentFormat host | anime-as-host fallback -> all "main"
 * - faceless -> "insert" except hook/CTA may stay "main" if a sheet exists, else "insert"
 * - story | anime -> mix: hook main, at least one insert or set on longer runtimes, support only if a support character exists
 */
export function resolveBeatSubject(params: {
  contentFormat?: "faceless" | "host" | "story" | "anime" | string;
  beatIndex: number;
  totalBeats: number;
  valueJob?: string;
  hasMainSheet?: boolean;
  hasSupportSheet?: boolean;
  candidateSubject?: string;
}): BeatSubject {
  const {
    contentFormat = "host",
    beatIndex,
    totalBeats,
    valueJob = "",
    hasMainSheet = false,
    hasSupportSheet = false,
    candidateSubject,
  } = params;

  const cleanJob = valueJob.toLowerCase().trim();
  const isHook = beatIndex === 0 || cleanJob === "hook";
  const isCta = beatIndex === totalBeats - 1 || cleanJob === "cta";

  // Validate candidate subject if supplied by LLM or caller
  if (candidateSubject) {
    const s = candidateSubject.toLowerCase().trim();
    if (s === "support") {
      // Support only if support character sheet actually exists
      return hasSupportSheet ? "support" : "main";
    }
    if (s === "set") return "set";
    if (s === "insert") return "insert";
    if (s === "main") {
      if (contentFormat === "faceless") {
        return (isHook || isCta) && hasMainSheet ? "main" : "insert";
      }
      return "main";
    }
  }

  // Format default branches:
  if (contentFormat === "faceless") {
    // faceless -> "insert" except hook/CTA may stay "main" if a sheet exists, else "insert"
    if ((isHook || isCta) && hasMainSheet) {
      return "main";
    }
    return "insert";
  }

  if (contentFormat === "story" || contentFormat === "anime") {
    // story | anime -> mix: hook main, at least one insert or set on longer runtimes, support only if a support character exists
    if (isHook) return "main";
    if (isCta) return "main";

    // Intermediate beats:
    if (hasSupportSheet && (cleanJob === "example" || cleanJob === "context" || beatIndex === 2)) {
      return "support";
    }
    if (cleanJob === "problem" || cleanJob === "context" || beatIndex === 1) {
      return totalBeats >= 4 ? "set" : "insert";
    }
    if (cleanJob === "proof" || cleanJob === "payoff" || cleanJob === "myth_bust") {
      return "insert";
    }
    return "main";
  }

  // host | anime-as-host fallback -> all "main"
  return "main";
}

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
 * Resolves deterministic beat budget, spoken word floor, and time slicing
 * based on formatSettings.targetDurationSec.
 */
export function countScriptWords(text?: string | null): number {
  if (!text || typeof text !== "string") return 0;
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .length;
}

export function resolveBeatBudget(durationSec: number): {
  count: number;
  wordFloor: number;
  targetWords: number;
  label: string;
} {
  const sec = Math.max(10, Math.round(durationSec || 60));
  let count = 4;
  if (sec <= 15) {
    count = 3; // 15s: 3 beats (hook / one value / CTA)
  } else if (sec <= 30) {
    count = 4; // 30s: 4 beats
  } else if (sec <= 60) {
    count = 5; // 60s: 5–6 beats
  } else {
    // 3–5 min and longer: beats ≈ ceil(duration/20s), min 8, each beat has a valueJob
    count = Math.max(8, Math.ceil(sec / 20));
  }

  // WORD LAW: targetWords = round(targetDurationSec * 2.4), minWords = round(targetDurationSec * 2.0)
  const targetWords = Math.round(sec * 2.4);
  const wordFloor = Math.round(sec * 2.0);

  return {
    count,
    wordFloor,
    targetWords,
    label: `${count} beats (~${targetWords} words, min ${wordFloor} words)`,
  };
}

/**
 * Quality Gate & Spark Strengthening before entering Production.
 * Evaluates spark completeness. If missing hook AND format AND angle, attempts 1 automated rewrite;
 * if it still lacks substance, fails loud to prevent topic-only boards.
 */
export function evaluateAndStrengthenSpark(
  spark?: ViralSpark | null,
  brand?: Brand
): { ok: boolean; spark: ViralSpark; message?: string } {
  if (!spark) {
    return { ok: false, spark: {} as ViralSpark, message: "Cannot create production: Viral Spark data is completely missing." };
  }

  const rawHook = typeof spark.hook === "string" ? spark.hook.trim() : "";
  const isUsableHook =
    rawHook.length >= 8 &&
    !/^hook:\s*$/i.test(rawHook) &&
    !rawHook.toLowerCase().startsWith("hook: [") &&
    !rawHook.toLowerCase().includes("curiosity opener") &&
    !rawHook.toLowerCase().includes("pattern interrupt");

  const hasSubstance = Boolean(
    (typeof spark.whyNow === "string" && spark.whyNow.trim().length >= 8) ||
    (typeof spark.angle === "string" && spark.angle.trim().length >= 5) ||
    (spark.researchContext?.hookPattern && spark.researchContext.hookPattern.trim().length >= 8)
  );

  const hasFormat = Boolean(
    spark.platformFit ||
    spark.suggestedFormat ||
    spark.suggestedProductionMode ||
    spark.category ||
    spark.researchContext?.format
  );

  if (isUsableHook && hasSubstance && hasFormat) {
    return { ok: true, spark };
  }

  const brandName = brand?.name || "SPARK";
  const brandNiche = brand?.niche || "this market";
  const title = (spark.title || "Strategic Insight").trim();

  // If title is missing or empty, fail loud
  if (!title || title.length < 3) {
    return {
      ok: false,
      spark,
      message: `Cannot start production: Spark is completely empty with no title, hook, format, or strategic angle. Click 'Strengthen Spark' to upgrade.`,
    };
  }

  // Automated spark repair attempt
  const healedHook = isUsableHook
    ? rawHook
    : spark.researchContext?.hookPattern && spark.researchContext.hookPattern.length >= 8
    ? spark.researchContext.hookPattern
    : `Here is the non-obvious reality about ${brandNiche} around ${title} that most operators in ${brandName}'s space ignore.`;

  const healedAngle = spark.angle && spark.angle.trim().length >= 5
    ? spark.angle.trim()
    : spark.whyNow && spark.whyNow.trim().length >= 8
    ? `Direct execution framework: ${spark.whyNow.trim()}`
    : `Systematic high-signal execution architecture for ${title}`;

  const healedWhyNow = spark.whyNow && spark.whyNow.trim().length >= 8
    ? spark.whyNow.trim()
    : `Recent changes in ${brandNiche} make outdated workflows obsolete, creating an immediate window for strategic differentiation.`;

  const healedFormat = spark.platformFit || spark.suggestedFormat || (spark.suggestedProductionMode === "express" ? "Vertical Short-Form (Shorts)" : "Direct Presentation");

  const upgradedSpark: ViralSpark = {
    ...spark,
    hook: healedHook,
    angle: healedAngle,
    whyNow: healedWhyNow,
    platformFit: healedFormat,
    suggestedFormat: healedFormat,
  };

  const isFinalOk = Boolean(
    upgradedSpark.hook && upgradedSpark.hook.length >= 8 &&
    upgradedSpark.angle && upgradedSpark.angle.length >= 5 &&
    upgradedSpark.platformFit
  );

  if (!isFinalOk) {
    return {
      ok: false,
      spark: upgradedSpark,
      message: `Cannot start production for "${title}": Spark lacks verified hook, format, and angle after repair. Click 'Strengthen Spark' to upgrade.`,
    };
  }

  return { ok: true, spark: upgradedSpark };
}

/**
 * Backward compatibility alias
 */
export function evaluateSparkForProduction(spark?: ViralSpark | null): { ok: boolean; message?: string } {
  return evaluateAndStrengthenSpark(spark);
}

/**
 * Builds the complete canonical voice script from hook, beat spokenLines, and CTA.
 */
export function buildCompleteVoiceScript(brief: ProductionBrief, targetDurationSec: number = 60): string {
  const clean = (str: string) =>
    str
      .replace(/[*_#`~\[\]()]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const hook = typeof brief.hook === "string" ? clean(brief.hook) : "";
  const beats = brief.beats || [];
  const cta = typeof brief.spokenCta === "string" ? clean(brief.spokenCta) : "";
  const lines: string[] = [];

  if (beats.length > 0) {
    const firstBeatSpoken = clean(beats[0].spokenLines || "");
    const hookAlreadyInFirstBeat = hook && firstBeatSpoken.toLowerCase().includes(hook.toLowerCase().slice(0, 20));

    if (hook && !hookAlreadyInFirstBeat && beats[0].valueJob !== "hook") {
      lines.push(hook);
    }

    for (let i = 0; i < beats.length; i++) {
      const beatSpoken = clean(beats[i].spokenLines || "");
      if (beatSpoken) {
        lines.push(beatSpoken);
      }
    }

    const lastBeatSpoken = clean(beats[beats.length - 1].spokenLines || "");
    const ctaAlreadyInLastBeat = cta && lastBeatSpoken.toLowerCase().includes(cta.toLowerCase().slice(0, 20));

    if (cta && !ctaAlreadyInLastBeat && beats[beats.length - 1].valueJob !== "cta") {
      lines.push(cta);
    }
  } else {
    if (hook) lines.push(hook);
    if (brief.scriptOutline) lines.push(clean(brief.scriptOutline));
    if (cta) lines.push(cta);
  }

  const fullScript = lines.join(" ").replace(/\.\s*\./g, ".").replace(/\s+/g, " ").trim();
  const maxCharBudget = Math.max(1000, targetDurationSec * 25);
  return fullScript.slice(0, maxCharBudget);
}

/**
 * Deterministic Brief Compiler Fallback
 * Guarantees a non-empty, directive Production Pack Brief scaled exactly to targetDurationSec.
 * Injects brand content pillars, audience constraints, continuity chaining, and memory rules.
 */
export function compileDeterministicBrief(params: {
  spark: ViralSpark;
  brand: Brand;
  character?: Character;
  characters?: Character[];
  defaultOffer?: Offer;
  productionMode?: string;
  niche?: string;
  researchContext?: StructuredResearchContext;
  targetDurationSec?: number;
}): ProductionBrief {
  const { spark, brand, character, characters, defaultOffer, productionMode = "standard", niche, researchContext = spark.researchContext } = params;
  const modeKey = resolveProductionMode({ modeOverride: productionMode, brand, spark });

  const hostTitle = character?.name || brand.name;
  const patternHook = researchContext?.hookPattern || spark.hook;
  const rawHook = patternHook ? patternHook.trim() : "";
  const cleanHook =
    rawHook.length > 5 && !rawHook.toLowerCase().startsWith("hook:") && !rawHook.toLowerCase().includes("curiosity opener")
      ? rawHook.replace(/^["']|["']$/g, "").trim()
      : `Here is the non-obvious reality about ${niche || brand.niche || "this market"} that most operators in ${brand.name}'s space ignore.`;

  // Brand Pillars & Audience Constraints
  const rawPillars = Array.isArray(brand.contentPillars) ? brand.contentPillars : [];
  const activePillar = rawPillars.length > 0
    ? (typeof rawPillars[0] === "string" ? rawPillars[0] : (rawPillars[0] as any)?.name || (rawPillars[0] as any)?.title || "")
    : "";
  const pillarLabel = activePillar ? ` under our ${activePillar} framework` : "";
  const pillarBadge = activePillar ? activePillar.toUpperCase().slice(0, 22) : `${brand.name.toUpperCase()} METHOD`;

  const audiencePain = (brand.audience?.painPoints?.[0] || (brand as any).painPoints?.[0] || (brand as any).targetAudience || "").replace(/["\r\n]+/g, " ").trim();
  const audienceDesire = (brand.audience?.desires?.[0] || (brand as any).desires?.[0] || "").replace(/["\r\n]+/g, " ").trim();
  const sparkAngle = spark.angle ? spark.angle.replace(/["\r\n]+/g, " ").trim() : "";
  const sparkWhyNow = spark.whyNow ? spark.whyNow.replace(/["\r\n]+/g, " ").trim() : "";
  const sparkTitle = spark.title ? spark.title.replace(/["\r\n]+/g, " ").trim() : "";

  const spokenCta = defaultOffer
    ? `Claim your access to ${defaultOffer.title} right now — click the link in bio or drop a comment below.`
    : `Follow ${brand.name} for daily high-conviction executive breakdowns and operational blueprints.`;

  const onScreenCta = defaultOffer
    ? `GET ${defaultOffer.title.toUpperCase().slice(0, 20)}`
    : `SAVE & FOLLOW ${brand.name.toUpperCase().slice(0, 15)}`;

  const durationSec = params.targetDurationSec || brand.formatSettings?.targetDurationSec || 60;
  const budget = resolveBeatBudget(durationSec);
  const totalBeats = budget.count;

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const resolveBeatAudio = (index: number, job: string): "vo" | "talent" => {
    if (modeKey === "express") return "vo";
    if (modeKey === "deep") return "talent";
    if (job === "hook" || job === "payoff" || job === "cta" || index === 0) return "talent";
    return "vo";
  };

  // Construct chained continuity states across all beats: endState of Beat N = startState of Beat N+1
  const states: { start: string; end: string }[] = [];
  for (let i = 0; i < totalBeats; i++) {
    if (i === 0) {
      states.push({
        start: `Host established in framing with focused delivery posture`,
        end: `Host gestures outward emphasizing core hook revelation`,
      });
    } else if (i === totalBeats - 1) {
      states.push({
        start: states[i - 1].end,
        end: `Host delivers direct-to-lens resolution with confident posture`,
      });
    } else {
      const stageIdx = i;
      states.push({
        start: states[i - 1].end,
        end: `Host references analytical breakdown visual (Phase ${stageIdx})`,
      });
    }
  }

  const beats: ProductionBriefBeat[] = [];

  // Compute time intervals per beat
  const timeIntervals: { start: number; end: number }[] = [];
  let currentElapsed = 0;
  for (let i = 0; i < totalBeats; i++) {
    const isLast = i === totalBeats - 1;
    const beatDur = isLast ? durationSec - currentElapsed : Math.max(3, Math.round(durationSec / totalBeats));
    const startSec = currentElapsed;
    const endSec = isLast ? durationSec : currentElapsed + beatDur;
    currentElapsed = endSec;
    timeIntervals.push({ start: startSec, end: endSec });
  }

  if (totalBeats === 3) {
    // 15s: 3 Beats (Hook, One Value/Proof, CTA) -> Target ~36-45 words
    const t0 = timeIntervals[0];
    const t1 = timeIntervals[1];
    const t2 = timeIntervals[2];

    const hookLine = `${cleanHook} Here is the exact shift leading operators are deploying right now.`;
    const valueLine = sparkAngle
      ? `The core mechanism is clear: ${sparkAngle}. When you eliminate manual friction${pillarLabel}, execution speed and delivery velocity compound immediately.`
      : sparkWhyNow
      ? `Here is the catalyst: ${sparkWhyNow}. At ${brand.name}${pillarLabel}, we eliminate process drag to unlock maximum market leverage.`
      : `Most teams waste bandwidth on ${audiencePain || "outdated workflows"}. The real leverage comes from building around systematic, high-conviction delivery.`;

    beats.push(
      {
        timecode: `[${formatTime(t0.start)}-${formatTime(t0.end)}]`,
        valueJob: "hook",
        spokenLines: hookLine,
        onScreenText: activePillar ? `${activePillar.toUpperCase().slice(0, 20)}` : `THE NON-OBVIOUS SHIFT`,
        cameraDirection: modeKey === "deep" ? "Slow push-in zoom on presenter" : "Presenter centered, high energy",
        startState: states[0].start,
        endState: states[0].end,
        audio: resolveBeatAudio(0, "hook"),
      },
      {
        timecode: `[${formatTime(t1.start)}-${formatTime(t1.end)}]`,
        valueJob: "proof",
        spokenLines: valueLine,
        onScreenText: pillarBadge,
        cameraDirection: "Close-up authority angle",
        startState: states[1].start,
        endState: states[1].end,
        audio: resolveBeatAudio(1, "proof"),
      },
      {
        timecode: `[${formatTime(t2.start)}-${formatTime(t2.end)}]`,
        valueJob: "cta",
        spokenLines: spokenCta,
        onScreenText: onScreenCta,
        cameraDirection: "Static lock-off direct to lens",
        startState: states[2].start,
        endState: states[2].end,
        audio: resolveBeatAudio(2, "cta"),
      }
    );
  } else if (totalBeats === 4) {
    // 30s: 4 Beats (Hook, Problem, Proof, CTA) -> Target ~72-90 words
    const hookLine = `${cleanHook} In this breakdown, we reveal the core operational unlock that separates leading operators from the rest of the market.`;
    const problemLine = audiencePain
      ? `Here is the systemic bottleneck: ${audiencePain}. ${sparkWhyNow ? `Because ${sparkWhyNow.toLowerCase()}, legacy playbooks cannot keep pace.` : "When execution relies on manual effort instead of leverage, delivery velocity and margins decay rapidly."}`
      : `Most operators in ${niche || brand.niche || "this space"} waste time solving modern challenges with broken, fragmented tools that compound process debt.`;

    const proofLine = sparkAngle
      ? `To solve this${pillarLabel}, ${brand.name} deploys a streamlined framework: ${sparkAngle}. This consistently generates ${audienceDesire || "high market leverage and compounding efficiency"}.`
      : `When you build around systematic execution${pillarLabel}, you eliminate manual drag to achieve ${audienceDesire || "predictable pipeline velocity and market authority"}.`;

    beats.push(
      {
        timecode: `[${formatTime(timeIntervals[0].start)}-${formatTime(timeIntervals[0].end)}]`,
        valueJob: "hook",
        spokenLines: hookLine,
        onScreenText: `WHY MOST GET THIS WRONG`,
        cameraDirection: modeKey === "deep" ? "Slow push-in zoom on presenter" : "Presenter centered, high energy",
        startState: states[0].start,
        endState: states[0].end,
        audio: resolveBeatAudio(0, "hook"),
      },
      {
        timecode: `[${formatTime(timeIntervals[1].start)}-${formatTime(timeIntervals[1].end)}]`,
        valueJob: "problem",
        spokenLines: problemLine,
        onScreenText: `THE CORE BOTTLENECK`,
        cameraDirection: "Medium tracking pan across set",
        startState: states[1].start,
        endState: states[1].end,
        audio: resolveBeatAudio(1, "problem"),
      },
      {
        timecode: `[${formatTime(timeIntervals[2].start)}-${formatTime(timeIntervals[2].end)}]`,
        valueJob: "proof",
        spokenLines: proofLine,
        onScreenText: pillarBadge,
        cameraDirection: "Close-up authority angle",
        startState: states[2].start,
        endState: states[2].end,
        audio: resolveBeatAudio(2, "proof"),
      },
      {
        timecode: `[${formatTime(timeIntervals[3].start)}-${formatTime(timeIntervals[3].end)}]`,
        valueJob: "cta",
        spokenLines: spokenCta,
        onScreenText: onScreenCta,
        cameraDirection: "Static lock-off direct to lens",
        startState: states[3].start,
        endState: states[3].end,
        audio: resolveBeatAudio(3, "cta"),
      }
    );
  } else if (totalBeats <= 6) {
    // 45s - 60s: 5–6 Beats (Hook, Problem, Context/Myth, Proof, Payoff, CTA) -> Target ~144-170 words
    const hookLine = `${cleanHook} Most operators attempt to solve modern challenges with broken, outdated playbooks. In this strategic breakdown, we deconstruct the exact execution model ${brand.name} uses to establish market authority.`;

    const problemLine = audiencePain
      ? `Here is the root bottleneck: ${audiencePain}. ${sparkWhyNow ? `Because ${sparkWhyNow.toLowerCase()}, legacy systems collapse under load.` : "When you scale without systematic leverage, process debt compounds into permanent drag across your entire organization."}`
      : `Every single day in ${niche || brand.niche || "this space"}, teams waste critical executive bandwidth fighting avoidable operational friction instead of executing high-signal strategy.`;

    const contextLine = `The prevailing misconception is that hiring more people or buying more tools solves process debt. At ${brand.name}, our core methodology decouples input hours from strategic output${pillarLabel}.`;

    const proofLine = sparkAngle
      ? `To achieve genuine compounding, we deploy a streamlined framework: ${sparkAngle}. By automating repeatable delivery, conversion and execution velocity improve immediately.`
      : `When you align execution with clear market positioning and modular pipelines, your team delivers ten times the output with zero manual overhead.`;

    const payoffLine = `This unlocks ${audienceDesire || "total operational freedom, predictable growth, and an unassailable competitive moat that competitors cannot replicate"}.`;

    const intermediateJobs = totalBeats === 5
      ? [
          { job: "problem", text: problemLine, screen: "THE ROOT BOTTLENECK", cam: "Medium tracking shot" },
          { job: "context", text: contextLine, screen: pillarBadge, cam: "Split composition" },
          { job: "proof", text: proofLine, screen: "SYSTEMATIC LEVERAGE", cam: "Authority close-up" },
        ]
      : [
          { job: "problem", text: problemLine, screen: "THE ROOT BOTTLENECK", cam: "Medium tracking shot" },
          { job: "myth_bust", text: `Common wisdom says work harder to scale. In reality, working harder on broken systems only accelerates burnout and margin compression.`, screen: "MYTH: EFFORT = SCALE", cam: "Close-up direct angle" },
          { job: "context", text: contextLine, screen: pillarBadge, cam: "Split composition" },
          { job: "proof", text: proofLine, screen: "SYSTEMATIC LEVERAGE", cam: "Authority close-up" },
          { job: "payoff", text: payoffLine, screen: "COMPOUNDING LEVERAGE", cam: "Cinematic push-in" },
        ];

    beats.push({
      timecode: `[${formatTime(timeIntervals[0].start)}-${formatTime(timeIntervals[0].end)}]`,
      valueJob: "hook",
      spokenLines: hookLine,
      onScreenText: `THE NON-OBVIOUS SHIFT`,
      cameraDirection: modeKey === "deep" ? "Slow push-in zoom on presenter" : "Presenter centered, high energy",
      startState: states[0].start,
      endState: states[0].end,
      audio: resolveBeatAudio(0, "hook"),
    });

    intermediateJobs.forEach((item, idx) => {
      const bIdx = idx + 1;
      beats.push({
        timecode: `[${formatTime(timeIntervals[bIdx].start)}-${formatTime(timeIntervals[bIdx].end)}]`,
        valueJob: item.job,
        spokenLines: item.text,
        onScreenText: item.screen,
        cameraDirection: item.cam,
        startState: states[bIdx].start,
        endState: states[bIdx].end,
        audio: resolveBeatAudio(bIdx, item.job),
      });
    });

    beats.push({
      timecode: `[${formatTime(timeIntervals[totalBeats - 1].start)}-${formatTime(timeIntervals[totalBeats - 1].end)}]`,
      valueJob: "cta",
      spokenLines: spokenCta,
      onScreenText: onScreenCta,
      cameraDirection: "Static lock-off direct to lens",
      startState: states[totalBeats - 1].start,
      endState: states[totalBeats - 1].end,
      audio: resolveBeatAudio(totalBeats - 1, "cta"),
    });
  } else {
    // 3–5 min+ (8 to N Beats): Full Chaptered Value Chain
    const jobPalette = [
      { job: "problem", text: audiencePain ? `Here is the systemic friction: ${audiencePain}. When teams scale without modernizing workflows, operational drag compounds into permanent margin compression.` : `Here is the systemic breakdown in ${niche || brand.niche || "this space"}: traditional execution models are decaying under modern market speed.`, screen: "SYSTEMIC FRICTION AUDIT", cam: "Slow tracking pan over set" },
      { job: "myth_bust", text: `The biggest misconception is that adding more personnel or software solves process debt. It does the exact opposite—it multiplies communication overhead and fragments ownership.`, screen: "MYTH: SOFTWARE FIXES PROCESS", cam: "Close-up direct-to-lens" },
      { job: "context", text: `At ${brand.name}, we build directly around${pillarLabel}. We decouple input effort from high-conviction output so every asset produces lasting enterprise leverage.`, screen: pillarBadge, cam: "Dynamic angle with schematic visual" },
      { job: "proof", text: sparkWhyNow ? `Let us examine the concrete evidence: ${sparkWhyNow}. Aligning your core delivery with this dynamic improves conversion velocity immediately.` : `Let us break down the exact operational mechanism: optimizing the core conversion loop yields compounding efficiency gains across all channels.`, screen: "DATA PROOF & EVIDENCE", cam: "Presenter explaining breakdown" },
      { job: "example", text: `Step one is auditing your delivery pipeline. Eliminate every manual touchpoint, handoff delay, and duplicate review cycle that stalls forward momentum.`, screen: "STEP 1: PIPELINE AUDIT", cam: "Medium tracking walk-and-talk" },
      { job: "example", text: `Step two is deploying modular automated execution loops so your core leadership bandwidth stays locked on high-conviction strategic priorities.`, screen: "STEP 2: MODULAR AUTOMATION", cam: "Close-up with UI graphics" },
      { job: "payoff", text: `When these integrated systems lock into place, you unlock ${audienceDesire || "total operational freedom, predictable pipeline velocity, and commanding market authority"}.`, screen: "THE COMPOUNDING ADVANTAGE", cam: "Cinematic low-angle authority shot" },
    ];

    beats.push({
      timecode: `[${formatTime(timeIntervals[0].start)}-${formatTime(timeIntervals[0].end)}]`,
      valueJob: "hook",
      spokenLines: `${cleanHook} In this complete masterclass breakdown, we will deconstruct ${sparkTitle || "the market shift"} and install the exact execution architecture ${brand.name} uses${pillarLabel}.`,
      onScreenText: `EXECUTIVE BRIEFING`,
      cameraDirection: "Cinematic establishing push-in",
      startState: states[0].start,
      endState: states[0].end,
      audio: resolveBeatAudio(0, "hook"),
    });

    const middleCount = totalBeats - 2;
    for (let m = 0; m < middleCount; m++) {
      const bIdx = m + 1;
      const t = timeIntervals[bIdx];
      const template = jobPalette[m % jobPalette.length];
      beats.push({
        timecode: `[${formatTime(t.start)}-${formatTime(t.end)}]`,
        valueJob: template.job,
        spokenLines: template.text,
        onScreenText: template.screen,
        cameraDirection: template.cam,
        startState: states[bIdx].start,
        endState: states[bIdx].end,
        audio: resolveBeatAudio(bIdx, template.job),
      });
    }

    beats.push({
      timecode: `[${formatTime(timeIntervals[totalBeats - 1].start)}-${formatTime(timeIntervals[totalBeats - 1].end)}]`,
      valueJob: "cta",
      spokenLines: spokenCta,
      onScreenText: onScreenCta,
      cameraDirection: "Static lock-off direct to lens",
      startState: states[totalBeats - 1].start,
      endState: states[totalBeats - 1].end,
      audio: resolveBeatAudio(totalBeats - 1, "cta"),
    });
  }

  // Strictly enforce continuity chaining: beat[n].startState === beat[n-1].endState
  for (let i = 1; i < beats.length; i++) {
    beats[i].startState = beats[i - 1].endState;
  }

  // Stamp shot subject on every beat based on contentFormat & character sheets
  const contentFormat = getEffectiveContentFormat({ brand, formatSettings: brand.formatSettings });
  const hasMainSheet = Boolean(
    character?.characterSheetUrl ||
    character?.imageUrl ||
    (brand as any).characterSheetUrl ||
    (brand as any).settings?.characterSheetUrl
  );
  const hasSupportSheet = Boolean(
    characters?.some(
      (c) => (c.role === "support" || c.id !== character?.id) && (c.characterSheetUrl || c.imageUrl)
    )
  );

  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    const subj = resolveBeatSubject({
      contentFormat,
      beatIndex: i,
      totalBeats: beats.length,
      valueJob: b.valueJob,
      hasMainSheet,
      hasSupportSheet,
      candidateSubject: b.subject || b.subjectType,
    });
    b.subject = subj;
    b.subjectType = subj;
  }

  const scriptOutline = beats
    .map(
      (b) =>
        `${b.timecode} [${b.valueJob.toUpperCase()}] [${(b.subject || "main").toUpperCase()}] "${b.spokenLines}" | ONSCREEN: ${b.onScreenText} | CAMERA: ${b.cameraDirection || "Standard"}`
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

  const storyboardScenes: ProductionScene[] = beats.map((b, idx) => ({
    scene: idx + 1,
    duration: `${Math.max(3, Math.round(durationSec / beats.length))}s`,
    shotList: `${b.timecode} Scene ${idx + 1} (${b.valueJob}) [${(b.subject || "main").toUpperCase()}]`,
    cameraDirection: b.cameraDirection || "Presenter centered",
    transitions: "Continuous flow",
    onScreenText: b.onScreenText,
    pacing: durationSec <= 30 ? "Fast" : "Balanced",
    scriptSnippet: b.spokenLines,
    spokenLines: b.spokenLines,
    audio: b.audio || (modeKey === "express" ? "vo" : modeKey === "deep" ? "talent" : "talent"),
    valueJob: b.valueJob,
    subject: b.subject,
    subjectType: b.subject,
    visualDescription: `[${b.valueJob.toUpperCase()}] [${(b.subject || "main").toUpperCase()}] ${b.spokenLines}`,
    startState: b.startState,
    endState: b.endState,
    primaryChange: b.spokenLines,
  }));

  return {
    title: spark.title || "Production Brief",
    productionMode: productionMode,
    targetDurationSec: durationSec,
    hook: cleanHook,
    scriptOutline,
    beats,
    storyboard: storyboardScenes,
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
    characters?: Character[];
    niche?: string;
    memoryItems?: MemoryItem[];
    productionMode?: string;
    researchContext?: StructuredResearchContext;
    targetDurationSec?: number;
  }): Promise<ProductionBrief> {
    const { spark: rawSpark, brand, character, characters, niche, memoryItems = [], productionMode = "standard", researchContext = rawSpark.researchContext, targetDurationSec } = params;

    // Quality gate & self-healing spark rewrite
    const sparkEvaluation = evaluateAndStrengthenSpark(rawSpark, brand);
    if (!sparkEvaluation.ok) {
      console.warn(`[ProductionBriefService] Spark evaluation notice: ${sparkEvaluation.message}`);
    }
    const spark = sparkEvaluation.spark;

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

    const effectiveDurationSec =
      targetDurationSec ||
      brand.formatSettings?.targetDurationSec ||
      60;

    const modeKey = resolveProductionMode({ modeOverride: productionMode, brand, spark });
    const budget = resolveBeatBudget(effectiveDurationSec);

    if (!ProductionGenerationGuard.isEnabled()) {
      console.warn("[ProductionBriefService] Generation blocked: Production Generation is OFF.");
      const fallback = compileDeterministicBrief({ spark, brand, character, characters, defaultOffer, productionMode: modeKey, niche, researchContext: resolvedResearch || undefined, targetDurationSec: effectiveDurationSec });
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

    const contentFormat = getEffectiveContentFormat({ brand, formatSettings: brand.formatSettings });
    const hasMainSheet = Boolean(
      character?.characterSheetUrl ||
      character?.imageUrl ||
      (brand as any).characterSheetUrl ||
      (brand as any).settings?.characterSheetUrl
    );
    const hasSupportSheet = Boolean(
      characters?.some(
        (c) => (c.role === "support" || c.id !== character?.id) && (c.characterSheetUrl || c.imageUrl)
      )
    );

    const systemInstruction = `You are SPARK's Chief Creative Officer & Production Compiler.
Your task is to compile a Viral Spark into a HIGH-SUBSTANCE, DURATION-SIZED PRODUCTION BRIEF for "${brand.name}".

WORD LAW & ANTI-SLOP COMPILER LAWS (MANDATORY):
1. HOOK LAW: Output an exact READY-TO-SPEAK line(s) for the brand host. NEVER output meta phrases like "curiosity opener", "pattern interrupt", "hook formula", "in this video we will discuss".
2. WORD LAW & BEAT BUDGET:
   - Target runtime: ${effectiveDurationSec} seconds (${modeKey.toUpperCase()} mode).
   - Word Law Floor: Total spoken words across all beats MUST be >= ${budget.wordFloor} words (target ≈ ${budget.targetWords} words at ~2.4 words/sec).
   - You MUST generate EXACTLY ${budget.count} beats in the "beats" array.
   - Every beat MUST contain:
     * timecode: [mm:ss-mm:ss]
     * valueJob: "hook" | "problem" | "context" | "myth_bust" | "proof" | "example" | "payoff" | "cta"
     * subject: "main" | "support" | "insert" | "set"
       - host / anime-as-host fallback: "main" for all presenter shots.
       - faceless: "insert" for all B-roll/graphics/data shots.
       - story / anime: "main" for hook/payoff, "insert" or "set" for environment/product details, and "support" only if a supporting character is present.
     * spokenLines: 2-4 complete substantive ready-to-speak sentences that thoroughly execute that beat's valueJob. NO fluff.
     * onScreenText: <= 6 words in uppercase.
     * cameraDirection: Specific camera framing / movement.
     * startState & endState: Beat N's startState MUST open EXACTLY on Beat N-1's endState.
     * audio: "vo" | "talent" (express=all vo; deep=talent; standard per beat).
3. CTA LAW: spokenCta must be 1 exact ready-to-speak line. onScreenCta must be <= 6 words in uppercase.
4. AUDIENCE, PILLARS & RESEARCH LAW:
   - At least one beat MUST explicitly cite an active content pillar (${pillars}).
   - At least one beat MUST directly address the stated audience pain points (${audPain}) or desires (${audDesires}).
   - Address the audience's primary desires and solve their pain points directly. Cite evidence in whyThisWorks.
5. MEMORY LAW: Obey all ranked brand laws and hard NEVER rules.
6. OUTPUT LAW: Return valid JSON matching the schema with zero introductory chatter.`;

    const prompt = `
COMPILE PRODUCTION BRIEF FOR VIRAL SPARK:

TARGET RUNTIME: ${effectiveDurationSec} seconds (${modeKey.toUpperCase()} MODE)
REQUIRED BEATS: ${budget.count} beats (Minimum spoken word floor: ${budget.wordFloor} words, target ≈ ${budget.targetWords} words at 2.4 words/sec)
SHOW FORMAT: ${contentFormat}

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
  "targetDurationSec": ${effectiveDurationSec},
  "hook": "Exact ready-to-speak opening line adapted for ${brand.name}",
  "scriptOutline": "[00:00-00:10] [HOOK] [MAIN] \"Exact spoken line\" | ONSCREEN: TEXT | CAMERA: Action\\n...",
  "beats": [
    {
      "timecode": "[00:00-00:10]",
      "valueJob": "hook",
      "subject": "main",
      "spokenLines": "Exact multi-sentence substantive spoken lines for host/VO",
      "onScreenText": "TEXT OVERLAY (MAX 6 WORDS)",
      "cameraDirection": "Slow push-in zoom on host",
      "startState": "Host established in framing with initial posture",
      "endState": "Host gestures outward emphasizing hook discovery",
      "audio": "talent"
    }
  ],
  "spokenCta": "Exact ready-to-speak closing line for host/VO",
  "onScreenCta": "UPPERCASE LOWER-THIRD TEXT (MAX 6 WORDS)",
  "visualDirection": "Concrete studio set, camera movement, and host posture direction for ${modeKey} mode",
  "caption": "Platform post text with hashtags and offer link",
  "platformRecommendation": "${spark.platformFit || (modeKey === "deep" ? "YouTube Long-form" : "YouTube Shorts")}",
  "whyThisWorks": "1-3 sentences citing spark evidence (${spark.whyNow}), active content pillar, and brand authority",
  "brandFitScore": ${Math.min(99, Math.max(80, sparkScore))},
  "suggestedDuration": "${effectiveDurationSec}s"
}
`;

    const fallback = compileDeterministicBrief({
      spark,
      brand,
      character,
      characters,
      defaultOffer,
      productionMode: modeKey,
      niche,
      targetDurationSec: effectiveDurationSec,
    });

    const mapParsedBeats = (candidateBeats: any[]): { beats: ProductionBriefBeat[]; words: number } => {
      if (!Array.isArray(candidateBeats) || candidateBeats.length === 0) {
        return { beats: [], words: 0 };
      }
      const rawList = candidateBeats.slice(0, budget.count);
      let prevEnd = "";
      const mapped: ProductionBriefBeat[] = rawList.map((b: any, idx: number) => {
        const fallbackBeat = fallback.beats?.[idx];
        const rawJob = String(b.valueJob || fallbackBeat?.valueJob || (idx === 0 ? "hook" : idx === budget.count - 1 ? "cta" : "context")).toLowerCase();
        const cleanJob = rawJob.replace(/[^\w]/g, "") || "context";
        const rawSpoken = String(b.spokenLines || b.spoken || fallbackBeat?.spokenLines || "").trim();
        const rawOnScreen = String(b.onScreenText || b.text || fallbackBeat?.onScreenText || `BEAT ${idx + 1}`).trim();
        const onScreenWords = rawOnScreen.split(/\s+/).filter(Boolean);
        const cleanOnScreen = (onScreenWords.length <= 6 ? rawOnScreen : onScreenWords.slice(0, 6).join(" ")).toUpperCase();

        const rawCamera = String(b.cameraDirection || fallbackBeat?.cameraDirection || "Presenter centered").trim();
        const rawStart = idx === 0
          ? String(b.startState || fallbackBeat?.startState || "Host established in framing")
          : (prevEnd || String(b.startState || fallbackBeat?.startState || "Host in delivery position"));
        const rawEnd = String(b.endState || fallbackBeat?.endState || (idx === budget.count - 1 ? "Host delivers resolution" : `Host transitions to beat ${idx + 2}`));
        prevEnd = rawEnd;

        const rawAudio: "vo" | "talent" = b.audio === "vo" || b.audio === "talent"
          ? b.audio
          : (modeKey === "express" ? "vo" : modeKey === "deep" ? "talent" : (cleanJob === "hook" || cleanJob === "payoff" || cleanJob === "cta" || idx === 0 ? "talent" : "vo"));

        const rawSubject = b.subject || b.subjectType || fallbackBeat?.subject;
        const cleanSubject = resolveBeatSubject({
          contentFormat,
          beatIndex: idx,
          totalBeats: budget.count,
          valueJob: cleanJob,
          hasMainSheet,
          hasSupportSheet,
          candidateSubject: rawSubject,
        });

        return {
          timecode: String(b.timecode || fallbackBeat?.timecode || `[${idx * 5}-${(idx + 1) * 5}]`),
          valueJob: cleanJob,
          subject: cleanSubject,
          subjectType: cleanSubject,
          spokenLines: rawSpoken,
          onScreenText: cleanOnScreen,
          cameraDirection: rawCamera,
          startState: rawStart,
          endState: rawEnd,
          audio: rawAudio,
        };
      });

      // Strict continuity enforcement: beat[n].startState === beat[n-1].endState
      for (let i = 1; i < mapped.length; i++) {
        mapped[i].startState = mapped[i - 1].endState;
      }

      const totalWords = mapped.reduce(
        (acc, b) => acc + countScriptWords(b.spokenLines),
        0
      );

      return { beats: mapped, words: totalWords };
    };

    let parsedJson: any = null;
    try {
      const rawResponse = await ModelRouter.executeCategoryRequest("production", {
        prompt,
        systemInstruction,
      });

      const cleanJson = rawResponse
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      parsedJson = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.warn("[ProductionBriefService] Initial LLM generation notice:", parseErr);
    }

    let evaluated = mapParsedBeats(parsedJson?.beats);

    // If initial LLM output is below word floor or missing required beats: execute 1 rewrite pass
    if (evaluated.beats.length < budget.count || evaluated.words < budget.wordFloor) {
      console.log(
        `[ProductionBriefService] Initial LLM brief too thin (${evaluated.words} words, ${evaluated.beats.length} beats < floor ${budget.wordFloor} words, ${budget.count} beats for ${effectiveDurationSec}s). Executing WORD LAW rewrite pass...`
      );

      try {
        const rewriteInstruction = `${systemInstruction}\n\nCRITICAL WORD LAW REWRITE:\nThe previous output was too thin (${evaluated.words} words). For ${effectiveDurationSec} seconds, you MUST generate at least ${budget.wordFloor} total words (~${budget.targetWords} words at 2.4 words/sec) across all ${budget.count} beats. Add concrete proof, detailed examples, or actionable steps for every beat's valueJob. NO fluff.`;

        const rewritePrompt = `REWRITE SCRIPT TO FILL FULL ${effectiveDurationSec}s TARGET:
Target Duration: ${effectiveDurationSec} seconds (${modeKey.toUpperCase()} mode).
Required Beats: EXACTLY ${budget.count} beats.
Word Floor: >= ${budget.wordFloor} spoken words.

Expand each beat's "spokenLines" into 2-4 complete, substantive sentences that thoroughly execute that beat's valueJob with concrete domain mechanics and proof.

${prompt}`;

        const rewriteResponse = await ModelRouter.executeCategoryRequest("production", {
          prompt: rewritePrompt,
          systemInstruction: rewriteInstruction,
        });

        const cleanRewriteJson = rewriteResponse
          .replace(/```json/gi, "")
          .replace(/```/g, "")
          .trim();

        const rewrittenParsed = JSON.parse(cleanRewriteJson);
        const rewrittenEvaluated = mapParsedBeats(rewrittenParsed?.beats);

        if (rewrittenEvaluated.beats.length >= budget.count && rewrittenEvaluated.words >= budget.wordFloor) {
          parsedJson = rewrittenParsed;
          evaluated = rewrittenEvaluated;
          console.log(
            `[ProductionBriefService] Rewrite pass succeeded: ${evaluated.words} words across ${evaluated.beats.length} beats.`
          );
        }
      } catch (rewriteErr) {
        console.warn("[ProductionBriefService] Rewrite pass error:", rewriteErr);
      }
    }

    // Final validation: if LLM output still fails floor, use verified deterministic fallback
    let validBeats: ProductionBriefBeat[] = evaluated.beats;
    let totalWords = evaluated.words;

    if (validBeats.length < budget.count || totalWords < budget.wordFloor) {
      const fallbackWords = (fallback.beats || []).reduce(
        (acc, b) => acc + countScriptWords(b.spokenLines),
        0
      );

      if (fallbackWords >= budget.wordFloor && (fallback.beats?.length || 0) >= budget.count) {
        console.log(
          `[ProductionBriefService] Using duration-scaled deterministic fallback (${fallbackWords} words >= ${budget.wordFloor} floor for ${effectiveDurationSec}s).`
        );
        validBeats = fallback.beats || [];
        totalWords = fallbackWords;
      } else {
        const errMsg = `Brief too thin for ${effectiveDurationSec}s (${totalWords} words < ${budget.wordFloor} minimum words)`;
        console.error(`[ProductionBriefService] ${errMsg}`);
        throw new Error(errMsg);
      }
    }

    let parsedHook = asText(parsedJson?.hook, fallback.hook);
    if (
      parsedHook.toLowerCase().startsWith("hook:") ||
      parsedHook.toLowerCase().includes("curiosity opener") ||
      parsedHook.toLowerCase().includes("pattern interrupt") ||
      parsedHook.length < 5
    ) {
      parsedHook = fallback.hook;
    }

    let parsedOutline = asText(parsedJson?.scriptOutline, fallback.scriptOutline);
    if (!parsedOutline.includes("00:") && !parsedOutline.includes("1.") && !parsedOutline.includes("Beat")) {
      parsedOutline = fallback.scriptOutline;
    }

    const storyboardScenes: ProductionScene[] = validBeats.map((b, idx) => ({
      scene: idx + 1,
      duration: `${Math.max(3, Math.round(effectiveDurationSec / validBeats.length))}s`,
      shotList: `${b.timecode} Scene ${idx + 1} (${b.valueJob}) [${(b.subject || "main").toUpperCase()}]`,
      cameraDirection: b.cameraDirection || "Presenter centered",
      transitions: "Continuous flow",
      onScreenText: b.onScreenText,
      pacing: effectiveDurationSec <= 30 ? "Fast" : "Balanced",
      scriptSnippet: b.spokenLines,
      spokenLines: b.spokenLines,
      audio: b.audio || (modeKey === "express" ? "vo" : modeKey === "deep" ? "talent" : "talent"),
      valueJob: b.valueJob,
      subject: b.subject,
      subjectType: b.subject,
      visualDescription: `[${b.valueJob.toUpperCase()}] [${(b.subject || "main").toUpperCase()}] ${b.spokenLines}`,
      startState: b.startState,
      endState: b.endState,
      primaryChange: b.spokenLines,
    }));

    return {
      title: asText(parsedJson?.title, spark.title),
      productionMode: modeKey,
      targetDurationSec: effectiveDurationSec,
      hook: parsedHook,
      scriptOutline: parsedOutline,
      beats: validBeats,
      storyboard: storyboardScenes,
      spokenCta: asText(parsedJson?.spokenCta, fallback.spokenCta),
      onScreenCta: asText(parsedJson?.onScreenCta, fallback.onScreenCta),
      visualDirection: asText(parsedJson?.visualDirection, fallback.visualDirection),
      caption: asText(parsedJson?.caption, fallback.caption),
      platformRecommendation: asText(parsedJson?.platformRecommendation, fallback.platformRecommendation),
      whyThisWorks: asText(parsedJson?.whyThisWorks, fallback.whyThisWorks),
      brandFitScore: typeof parsedJson?.brandFitScore === "number" ? parsedJson.brandFitScore : sparkScore,
      suggestedDuration: asText(parsedJson?.suggestedDuration, fallback.suggestedDuration),
      offerCta: fallback.offerCta,
    };
  }
}
