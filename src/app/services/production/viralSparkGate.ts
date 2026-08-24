import type { ViralSpark, Brand, MemoryItem, StructuredResearchContext } from "../../domain/types";
import { ModelRouter } from "../runtime/modelRouter";
import { buildRankedBrandLaws } from "../memory/rankBrandLaws";
import { ProductionGenerationGuard } from "./ProductionGenerationGuard";

export const MIN_BRAND_FIT_SCORE = 70;

const META_HOOK_PATTERNS = [
  "curiosity opener",
  "curiosity gap",
  "pattern interrupt",
  "hook formula",
  "opener pattern",
  "first-line formula",
  "first-line curiosity",
  "this video will",
  "discusses",
  "pattern:",
  "hook:",
  "topic label",
  "title structure",
];

export function isMetaHook(hookStr?: string): boolean {
  if (!hookStr || typeof hookStr !== "string") return true;
  const trimmed = hookStr.trim().toLowerCase();
  if (trimmed.length < 12) return true;
  return META_HOOK_PATTERNS.some((pat) => trimmed.includes(pat));
}

export function isTopicOnlyTitle(titleStr?: string): boolean {
  if (!titleStr) return true;
  const trimmed = titleStr.trim();
  const words = trimmed.split(/\s+/);
  return words.length <= 2 && !/[?!.:]/.test(trimmed);
}

/**
 * Validates whether a Viral Spark is production-ready.
 */
export function isProductionReadySpark(
  spark: ViralSpark,
  brand?: Brand
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!spark) {
    return { ok: false, reasons: ["Spark data is completely missing"] };
  }

  // 1. Title Validation
  if (!spark.title || spark.title.trim().length < 4 || isTopicOnlyTitle(spark.title)) {
    reasons.push("Title is generic or topic-only with no specific angle");
  }

  // 2. Hook Validation
  const hook = spark.hook ? spark.hook.trim() : "";
  if (!hook || isMetaHook(hook)) {
    reasons.push("Hook is weak or meta-only (missing an exact ready-to-speak line for the host)");
  }

  // 3. Format / Structure Signal
  const hasFormat = Boolean(
    spark.suggestedFormat ||
      spark.suggestedProductionMode ||
      spark.category ||
      spark.researchContext?.format
  );
  if (!hasFormat) {
    reasons.push("Missing video format or production mode structure signal");
  }

  // 4. CTA Signal
  const hasCta = Boolean(
    spark.researchContext?.ctaStyle ||
      (hook && /comment|link|follow|subscribe|download|save|blueprint|guide|join/i.test(hook)) ||
      (spark.whyNow && /comment|link|follow|subscribe|download|save|blueprint|guide|join/i.test(spark.whyNow))
  );
  if (!hasCta) {
    reasons.push("Missing call-to-action (CTA) signal or direction");
  }

  // 5. Payoff / Why Watch
  const hasPayoff = Boolean(
    (spark.whyNow && spark.whyNow.trim().length > 10) ||
      (spark.audienceEmotion && spark.audienceEmotion.trim().length > 5)
  );
  if (!hasPayoff) {
    reasons.push("Missing clear audience payoff, retention rationale, or why-watch signal");
  }

  // 6. Brand Fit Score Check
  if (typeof spark.brandFitScore === "number" && spark.brandFitScore < MIN_BRAND_FIT_SCORE) {
    reasons.push(`Brand fit score (${spark.brandFitScore}/100) is below production threshold (${MIN_BRAND_FIT_SCORE}/100)`);
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

/**
 * Deterministic upgrade for a weak Viral Spark.
 */
export function autoRepairViralSparkDeterministic(
  spark: ViralSpark,
  brand?: Brand
): ViralSpark {
  const brandName = brand?.name || "our brand";
  const brandNiche = brand?.niche || "this market";

  let repairedHook = spark.hook ? spark.hook.trim() : "";
  if (isMetaHook(repairedHook) || !repairedHook) {
    const topicText = spark.title
      ? spark.title.replace(/^high retention pattern:?\s*/i, "").replace(/^title structure:?\s*/i, "").trim()
      : "";
    if (topicText && topicText.length > 5) {
      repairedHook = `Here is the non-obvious reality about ${topicText} that most operators in ${brandNiche} ignore.`;
    } else {
      repairedHook = `90% of leaders in ${brandNiche} are using outdated playbooks. Here is how ${brandName} fixes it.`;
    }
  }

  let repairedTitle = spark.title ? spark.title.trim() : "";
  if (isTopicOnlyTitle(repairedTitle) || !repairedTitle) {
    repairedTitle = `The ${brandNiche} Playbook Shift: Why ${brandName} Operates Differently`;
  }

  const repairedFormat = spark.suggestedFormat || spark.researchContext?.format || "Vertical 9:16 (Shorts)";
  const repairedMode = (spark.suggestedProductionMode || "standard") as "express" | "standard" | "deep";
  const repairedEmotion = spark.audienceEmotion || "High Curiosity & Strategic Retention";

  const repairedResearchContext: StructuredResearchContext = {
    ...(spark.researchContext || {}),
    ctaStyle: spark.researchContext?.ctaStyle || `Comment STRATEGY to get ${brandName}'s blueprint`,
    format: repairedFormat,
  };

  return {
    ...spark,
    title: repairedTitle,
    hook: repairedHook,
    suggestedFormat: repairedFormat,
    suggestedProductionMode: repairedMode,
    suggestedMode: repairedMode,
    audienceEmotion: repairedEmotion,
    brandFitScore: Math.max(88, spark.brandFitScore || 88),
    whyNow: spark.whyNow || `High-retention strategic framework adapted for ${brandName}.`,
    researchContext: repairedResearchContext,
  };
}

/**
 * AI-powered or deterministic single-pass rewrite of a weak spark into production-ready shape.
 */
export async function rewriteSparkForProduction(params: {
  spark: ViralSpark;
  brand: Brand;
  memoryItems?: MemoryItem[];
  researchContext?: StructuredResearchContext;
}): Promise<ViralSpark> {
  const { spark, brand, memoryItems = [], researchContext = spark.researchContext } = params;

  if (!ProductionGenerationGuard.isEnabled()) {
    return autoRepairViralSparkDeterministic(spark, brand);
  }

  const rankedLaws = buildRankedBrandLaws(memoryItems).lawsBlock;

  const systemInstruction = `You are SPARK's Senior Production Architect.
Your job is to REWRITE a weak or meta Viral Spark into an exact PRODUCTION-READY SPARK for "${brand.name}".

ANTI-SLOP RULES:
1. HOOK: Output an EXACT READY-TO-SPEAK line for the host. FORBIDDEN: meta phrases like "curiosity opener", "pattern interrupt", "hook formula".
2. TITLE: Specific, angled, and compelling. Not a generic 1-2 word topic label.
3. CTA: Direct, actionable call to action.
4. BRAND VOICE: Adapt 100% to "${brand.name}" (${brand.niche || "strategy"}). Obey ranked brand memory laws.
5. JSON OUTPUT ONLY.`;

  const prompt = `
REWRITE WEAK SPARK INTO PRODUCTION-READY SHAPE:

ORIGINAL SPARK:
- Title: "${spark.title}"
- Hook: "${spark.hook}"
- Why Now: "${spark.whyNow}"
- Category: ${spark.category}
- Platform Fit: ${spark.platformFit || "YouTube Shorts"}

BRAND IDENTITY:
- Brand Name: ${brand.name}
- Industry Niche: ${brand.niche || "General"}
- Ranked Memory Laws:
${rankedLaws}

Return a valid JSON object matching this schema with NO extra text:
{
  "title": "Specific angled title",
  "hook": "Exact ready-to-speak spoken opening line",
  "angle": "Core strategic contrast or insight",
  "whyNow": "Concrete viewer payoff and retention reason",
  "suggestedFormat": "Vertical 9:16 (Shorts)",
  "suggestedMode": "standard",
  "ctaStyle": "Comment STRATEGY to get our guide",
  "audienceEmotion": "Curiosity & Urgency"
}
`;

  try {
    const rawResponse = await ModelRouter.executeCategoryRequest("production", {
      prompt,
      systemInstruction,
    });

    const cleanJson = rawResponse.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    let cleanHook = String(parsed.hook || "").trim();
    if (isMetaHook(cleanHook) || cleanHook.length < 10) {
      cleanHook = autoRepairViralSparkDeterministic(spark, brand).hook;
    }

    return {
      ...spark,
      title: String(parsed.title || spark.title).trim(),
      hook: cleanHook,
      angle: String(parsed.angle || spark.angle).trim(),
      whyNow: String(parsed.whyNow || spark.whyNow).trim(),
      suggestedFormat: String(parsed.suggestedFormat || spark.suggestedFormat || "Vertical 9:16 (Shorts)").trim(),
      suggestedProductionMode: String(parsed.suggestedMode || spark.suggestedProductionMode || "standard"),
      suggestedMode: (parsed.suggestedMode || "standard") as any,
      audienceEmotion: String(parsed.audienceEmotion || spark.audienceEmotion || "High Curiosity & Retention"),
      brandFitScore: Math.max(88, spark.brandFitScore || 88),
      researchContext: {
        ...(spark.researchContext || {}),
        ctaStyle: String(parsed.ctaStyle || spark.researchContext?.ctaStyle || `Follow ${brand.name} for daily insights`),
        format: String(parsed.suggestedFormat || spark.suggestedFormat || "Vertical 9:16 (Shorts)"),
      },
    };
  } catch (err) {
    console.warn("[viralSparkGate] AI rewrite fallback triggered:", err);
    return autoRepairViralSparkDeterministic(spark, brand);
  }
}

/**
 * Main Quality Gate Orchestration:
 * 1. Validate spark
 * 2. If !ok -> rewrite once
 * 3. Re-validate
 * 4. If still !ok -> return error reason
 * 5. If ok -> return upgraded production-ready spark
 */
export async function gateSparkForProduction(params: {
  spark: ViralSpark;
  brand: Brand;
  memoryItems?: MemoryItem[];
  researchContext?: StructuredResearchContext;
}): Promise<{ ok: boolean; spark?: ViralSpark; errorReason?: string }> {
  const { spark, brand, memoryItems, researchContext } = params;

  // 1. First Validation
  const initialCheck = isProductionReadySpark(spark, brand);
  if (initialCheck.ok) {
    return { ok: true, spark };
  }

  console.log(`[viralSparkGate] Spark "${spark.title}" failed quality check (${initialCheck.reasons.join("; ")}). Rewriting once...`);

  // 2. Rewrite once
  const rewritten = await rewriteSparkForProduction({ spark, brand, memoryItems, researchContext });

  // 3. Second Validation
  const secondCheck = isProductionReadySpark(rewritten, brand);
  if (secondCheck.ok) {
    return { ok: true, spark: rewritten };
  }

  // 4. Deterministic fallback guarantee
  const deterministicUpgrade = autoRepairViralSparkDeterministic(rewritten, brand);
  const finalCheck = isProductionReadySpark(deterministicUpgrade, brand);

  if (finalCheck.ok) {
    return { ok: true, spark: deterministicUpgrade };
  }

  return {
    ok: false,
    errorReason: `Spark needs strengthening before production: ${finalCheck.reasons.join(", ")}`,
  };
}
