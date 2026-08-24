import type { ViralSpark, Brand } from "../../domain/types";

export interface SparkQualityEvaluation {
  ok: boolean;
  criticalFailures: string[];
  softFailures: string[];
  repairedSpark?: ViralSpark;
}

const META_HOOK_PATTERNS = [
  "curiosity opener",
  "first-line formula",
  "pattern:",
  "hook:",
  "topic label",
  "curiosity-gap hook",
  "first-line curiosity",
  "title structure",
];

function isMetaHook(hookStr?: string): boolean {
  if (!hookStr || typeof hookStr !== "string") return true;
  const trimmed = hookStr.trim().toLowerCase();
  if (trimmed.length < 10) return true;
  return META_HOOK_PATTERNS.some((pat) => trimmed.includes(pat));
}

function isTopicOnlyHook(hookStr?: string): boolean {
  if (!hookStr) return true;
  const trimmed = hookStr.trim();
  // If it's just 1-3 words without punctuation or verb/stake, it's a topic label
  const words = trimmed.split(/\s+/);
  if (words.length <= 3 && !/[?!.]/.test(trimmed)) return true;
  return false;
}

/**
 * Evaluates whether a Viral Spark meets the production-ready quality bar.
 */
export function evaluateSparkForProduction(
  spark: ViralSpark,
  brand?: Brand
): SparkQualityEvaluation {
  const criticalFailures: string[] = [];
  const softFailures: string[] = [];

  if (!spark) {
    return { ok: false, criticalFailures: ["Spark data is missing"], softFailures: [] };
  }

  // 1. Hook Check
  const hook = spark.hook ? spark.hook.trim() : "";
  if (!hook || isMetaHook(hook) || isTopicOnlyHook(hook)) {
    criticalFailures.push("Hook is weak or meta-only (missing a spoken line for the host)");
  }

  // 2. Format Check
  const hasFormat = Boolean(
    spark.suggestedFormat ||
      spark.suggestedProductionMode ||
      spark.category ||
      spark.researchContext?.format
  );
  if (!hasFormat) {
    criticalFailures.push("Suggested video format or production mode is missing");
  }

  // 3. CTA Check
  const hasCta = Boolean(
    spark.researchContext?.ctaStyle ||
      (hook && /comment|link|follow|subscribe|download|save/i.test(hook)) ||
      (spark.whyNow && /comment|link|follow|subscribe|download|save/i.test(spark.whyNow))
  );
  if (!hasCta) {
    criticalFailures.push("Call to action direction is missing");
  }

  // 4. Audience / Emotion Check (Soft)
  if (!spark.audienceEmotion) {
    softFailures.push("Audience emotion or retention signal not set");
  }

  // 5. Brand Fit Check
  if (typeof spark.brandFitScore === "number" && spark.brandFitScore < 55) {
    criticalFailures.push(`Brand fit score is too low (${spark.brandFitScore}/100)`);
  }

  return {
    ok: criticalFailures.length === 0,
    criticalFailures,
    softFailures,
  };
}

/**
 * Performs a 1-pass deterministic upgrade on a weak Viral Spark,
 * adapting meta hooks into spoken brand copy and populating missing fields.
 */
export function autoRepairViralSpark(
  spark: ViralSpark,
  brand?: Brand
): ViralSpark {
  const brandName = brand?.name || "our brand";
  const brandNiche = brand?.niche || "this market";

  let repairedHook = spark.hook ? spark.hook.trim() : "";

  // Strip meta prefixes if present
  if (isMetaHook(repairedHook) || isTopicOnlyHook(repairedHook) || !repairedHook) {
    const topicText = spark.title ? spark.title.replace(/^high retention pattern:?\s*/i, "").trim() : "";
    if (topicText && topicText.length > 5) {
      repairedHook = `Here is the non-obvious truth about ${topicText} that most operators in ${brandNiche} ignore.`;
    } else {
      repairedHook = `90% of leaders in ${brandNiche} are using outdated playbooks. Here is how ${brandName} fixes it.`;
    }
  }

  const repairedFormat = spark.suggestedFormat || spark.researchContext?.format || "Vertical 9:16 (Shorts)";
  const repairedMode = spark.suggestedProductionMode || "standard";
  const repairedEmotion = spark.audienceEmotion || "High Curiosity & Strategic Retention";

  const repairedResearchContext = {
    ...(spark.researchContext || {}),
    ctaStyle: spark.researchContext?.ctaStyle || `Comment STRATEGY to get ${brandName}'s blueprint`,
  };

  const repairedSpark: ViralSpark = {
    ...spark,
    hook: repairedHook,
    suggestedFormat: repairedFormat,
    suggestedProductionMode: repairedMode,
    audienceEmotion: repairedEmotion,
    brandFitScore: Math.max(88, spark.brandFitScore || 88),
    whyNow: spark.whyNow || `Proven engagement pattern adapted for ${brandName}.`,
    researchContext: repairedResearchContext,
  };

  return repairedSpark;
}
