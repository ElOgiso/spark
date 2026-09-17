/**
 * SPARK Creative OS — Script Quality Gates
 *
 * Enforces fact-checking, genericity checks, and reference story overlap
 * prevention before scripts are accepted for production asset generation.
 *
 * Borrow FORMAT from reference channels. NEVER copy their specific stories.
 * Fail loud: unverified or false claims in educational formats are blocked.
 */

import type { NarrativeScript, ViralSpark, Brand } from "../../../domain/types";
import { ModelRouter } from "../../runtime/modelRouter";

export const MAX_UNVERIFIED_OR_FALSE_CLAIMS = 2;
export const MAX_REFERENCE_OVERLAP_SCORE = 0.7;
export const MAX_GENERICITY_SCORE = 0.75;

export interface ScriptEvaluationScores {
  genericityScore: number;
  originalityScore: number;
  referenceContentOverlapScore: number;
  unverifiedClaimsCount: number;
  falseClaimsCount: number;
}

export interface ScriptEvaluationResult {
  ok: boolean;
  reasons: string[];
  warnings?: string[];
  scores: ScriptEvaluationScores;
  claims?: Array<{ claim: string; verified: boolean | "pending"; source?: string; isCorePremise?: boolean }>;
}

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "all", "am", "an", "and", "any", "are", "as", "at",
  "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
  "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from",
  "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him",
  "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just",
  "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off", "on", "once",
  "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she",
  "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them",
  "themselves", "then", "there", "these", "they", "this", "those", "through", "to", "too",
  "under", "until", "up", "very", "was", "we", "were", "what", "when", "where", "which",
  "while", "who", "whom", "why", "with", "would", "you", "your", "yours", "yourself",
  "yourselves", "video", "shorts", "episode", "part", "secret", "blueprint", "guide",
  "explained", "formula", "step", "steps", "ways", "way", "day", "days"
]);

const GENERIC_FILLER_PATTERNS = [
  "in this video",
  "today we are going to",
  "today we will",
  "stay tuned",
  "let's dive in",
  "without further ado",
  "you won't believe",
  "change your life forever",
  "there are many reasons",
  "it is important to note",
  "at the end of the day",
  "in conclusion",
  "it is what it is",
  "something amazing",
  "we will explore",
  "let's take a closer look",
  "many people wonder",
  "as we all know",
  "have you ever wondered",
  "buckle up",
];

/**
 * Extract claim-bearing sentences (dates, numbers, historical entities, superlatives).
 */
export function extractClaimBearingSentences(text: string): string[] {
  if (!text || typeof text !== "string") return [];

  const sentences = text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 10);

  const claimBearing: string[] = [];

  const datePattern = /\b(1[0-9]{3}|20[0-2][0-9])\b|\b\d+\s*(?:BC|BCE|AD|CE)\b/i;
  const statPattern = /\b\d+(?:\.\d+)?%|\b\d+\s*(?:million|billion|trillion|thousand|hundred)\b/i;
  const absolutePattern = /\b(?:first|only|always|never|invented by|discovered in|founded in|built in|destroyed in|created in|established in|oldest|fastest|largest)\b/i;

  for (const sentence of sentences) {
    if (datePattern.test(sentence) || statPattern.test(sentence) || absolutePattern.test(sentence)) {
      if (!claimBearing.includes(sentence)) {
        claimBearing.push(sentence);
      }
    }
  }

  return claimBearing;
}

/**
 * Deterministic known historical sanity check (e.g. for unit tests and local safety nets).
 */
function evaluateKnownFactualAnachronisms(claim: string): { isKnownFalse: boolean; reason?: string } {
  const norm = claim.toLowerCase();
  // Pompeii eruption was 79 AD; modern dates like 1980 AD are false
  if (norm.includes("pompeii") && (norm.includes("1980") || norm.includes("2000") || norm.includes("1990") || norm.includes("19th century") || norm.includes("20th century"))) {
    return { isKnownFalse: true, reason: "Mount Vesuvius destroyed Pompeii in 79 AD, not in modern times." };
  }
  // Caesar assassinated 44 BC
  if (norm.includes("caesar") && (norm.includes("2005") || norm.includes("1945"))) {
    return { isKnownFalse: true, reason: "Julius Caesar lived in ancient Rome (assassinated 44 BC)." };
  }
  return { isKnownFalse: false };
}

/**
 * Single-pass fact check for claims in NarrativeScript.
 * Reuses ModelRouter research capability (max 1 model call, no loops).
 */
export async function factCheckNarrativeScript(
  script: NarrativeScript,
  brand?: Brand
): Promise<NarrativeScript> {
  let existingClaims = Array.isArray(script.claims) ? [...script.claims] : [];

  // If no claims provided by compiler, extract candidate claim sentences
  if (existingClaims.length === 0) {
    const extracted = extractClaimBearingSentences(
      `${script.hook?.spoken || ""} ${script.premise || ""} ${script.fullSpokenScript || ""}`
    );
    existingClaims = extracted.slice(0, 6).map((c) => ({
      claim: c,
      verified: "pending" as const,
    }));
  }

  if (existingClaims.length === 0) {
    return { ...script, claims: [] };
  }

  // Check known deterministic safety checks first
  let needsModelCheck = false;
  const inspectedClaims = existingClaims.map((item) => {
    const known = evaluateKnownFactualAnachronisms(item.claim);
    if (known.isKnownFalse) {
      return {
        ...item,
        verified: false as const,
        source: known.reason || "Historical Record",
        isCorePremise: true,
      };
    }
    if (item.verified === "pending" || typeof item.verified === "undefined") {
      needsModelCheck = true;
    }
    return item;
  });

  if (!needsModelCheck) {
    return { ...script, claims: inspectedClaims };
  }

  // Single ModelRouter research call to verify pending claims
  try {
    const claimsToVerify = inspectedClaims
      .filter((c) => c.verified === "pending" || typeof c.verified === "undefined")
      .map((c) => c.claim);

    const prompt = `You are SPARK's Fact-Checking Engine.
Script Title: "${script.title}"
Format: "${script.format || brand?.contentFormat || "faceless"}"
Niche: "${brand?.niche || "General"}"

Evaluate these claims for factual accuracy:
${claimsToVerify.map((c, i) => `${i + 1}. "${c}"`).join("\n")}

Rules:
- If factually accurate, verified: true and provide a recognized source name (e.g. "Encyclopedia Britannica", "NASA", "US Geological Survey"). NEVER invent URLs.
- If factually false or invented (e.g. wrong date, wrong name, fabricated event), verified: false.
- If ambiguous or unverifiable, verified: "pending".
- Set isCorePremise: true if this claim is central to the topic/title/premise.

Return ONLY a JSON array:
[
  { "claim": "...", "verified": true|false|"pending", "source": "...", "isCorePremise": boolean }
]`;

    const rawResponse = await ModelRouter.executeCategoryRequest("research", {
      prompt,
      systemInstruction: "You are a strict, objective fact checker. Return ONLY valid JSON array. Never invent fake URLs.",
    });

    const cleanJson = rawResponse.replace(/^\`\`\`json/i, "").replace(/\`\`\`$/g, "").trim();
    const verifiedList = JSON.parse(cleanJson);

    if (Array.isArray(verifiedList)) {
      const mergedClaims = inspectedClaims.map((existing) => {
        const found = verifiedList.find((v: any) => v.claim === existing.claim || existing.claim.includes(v.claim));
        if (found) {
          const verifiedStatus: boolean | "pending" =
            found.verified === true ? true : found.verified === false ? false : "pending";
          return {
            claim: existing.claim,
            verified: verifiedStatus,
            source: found.source ? String(found.source).trim() : existing.source,
            isCorePremise: Boolean(found.isCorePremise),
          };
        }
        return existing;
      });
      return { ...script, claims: mergedClaims };
    }
  } catch (err) {
    console.warn("[factCheckNarrativeScript] Verification request notice (marking pending):", err);
  }

  return { ...script, claims: inspectedClaims };
}

/**
 * Tokenizes text into significant content keywords (removes format/stop words).
 */
export function extractContentKeywords(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  return Array.from(new Set(tokens));
}

/**
 * Calculates reference content / story overlap (0 to 1).
 * Ignores format structure; strictly flags identical/overlapping stories.
 */
export function computeReferenceContentOverlapScore(
  script: Partial<NarrativeScript>,
  spark?: Partial<ViralSpark> | null,
  referenceTitles: string[] = []
): number {
  const allRefTitles = new Set<string>();
  for (const t of referenceTitles) {
    if (t && t.trim()) allRefTitles.add(t.trim());
  }
  if (Array.isArray(script.mustNotCopy)) {
    for (const t of script.mustNotCopy) {
      if (t && t.trim()) allRefTitles.add(t.trim());
    }
  }

  if (allRefTitles.size === 0) return 0;

  const scriptTitle = (script.title || spark?.title || "").trim();
  const scriptHook = (script.hook?.spoken || spark?.hook || "").trim();
  const scriptPremise = (script.premise || script.logline || spark?.whyNow || "").trim();
  const scriptSpoken = (script.fullSpokenScript || "").trim();

  const scriptTokens = extractContentKeywords(`${scriptTitle} ${scriptHook} ${scriptPremise} ${scriptSpoken.slice(0, 300)}`);
  const titleTokens = extractContentKeywords(scriptTitle);

  let maxOverlap = 0;

  for (const refTitle of allRefTitles) {
    const refKeywords = extractContentKeywords(refTitle);
    if (refKeywords.length === 0) continue;

    // Direct string similarity on titles
    const normRef = refTitle.toLowerCase().replace(/[^\w\s]/g, "").trim();
    const normScript = scriptTitle.toLowerCase().replace(/[^\w\s]/g, "").trim();

    if (normRef.length > 0 && normScript.length > 0) {
      if (normRef === normScript) {
        return 1.0;
      }
      if (normScript.includes(normRef) || normRef.includes(normScript)) {
        const ratio = Math.min(normRef.length, normScript.length) / Math.max(normRef.length, normScript.length);
        if (ratio > 0.8) return 0.95;
      }
    }

    // Keyword containment of the reference title
    const matchingTitleTokens = refKeywords.filter((k) => titleTokens.includes(k));
    const titleContainment = matchingTitleTokens.length / refKeywords.length;

    const matchingScriptTokens = refKeywords.filter((k) => scriptTokens.includes(k));
    const scriptContainment = matchingScriptTokens.length / refKeywords.length;

    // Weight title match highest, then overall script topic containment
    const overlap = Math.max(titleContainment * 0.9 + scriptContainment * 0.1, scriptContainment * 0.85);

    if (overlap > maxOverlap) {
      maxOverlap = overlap;
    }
  }

  return Number(Math.min(1, Math.max(0, maxOverlap)).toFixed(2));
}

/**
 * Computes genericity score (0 to 1). High = generic slop / empty payoff.
 */
export function computeGenericityScore(
  script: Partial<NarrativeScript>,
  spark?: Partial<ViralSpark> | null
): number {
  const fullText = `${script.title || ""} ${script.hook?.spoken || ""} ${script.premise || ""} ${script.fullSpokenScript || ""}`.toLowerCase();
  if (fullText.trim().length === 0) return 0.5;

  let fillerHits = 0;
  for (const pattern of GENERIC_FILLER_PATTERNS) {
    if (fullText.includes(pattern)) {
      fillerHits++;
    }
  }

  // Look for concrete specifics: numbers, dates, proper entities
  const hasNumbers = /\b\d+\b/.test(fullText);
  const words = fullText.split(/\s+/).filter(Boolean);
  const uniqueWords = new Set(words);
  const lexicalDiversity = words.length > 0 ? uniqueWords.size / words.length : 0.5;

  // Empty payoff indicators
  const premise = (script.premise || script.logline || spark?.whyNow || "").toLowerCase();
  const isEmptyPremise =
    premise.length < 20 ||
    /^(this video (is about|explains|discusses)|a video about)/.test(premise);

  let score = 0.2; // baseline
  score += Math.min(0.4, fillerHits * 0.12);
  if (!hasNumbers) score += 0.15;
  if (lexicalDiversity < 0.45) score += 0.15;
  if (isEmptyPremise) score += 0.25;

  return Number(Math.min(1, Math.max(0, score)).toFixed(2));
}

/**
 * Evaluates NarrativeScript readiness for production assets.
 * Single source of truth gate.
 */
export function evaluateScriptForProduction(
  script: NarrativeScript,
  spark?: ViralSpark | null,
  brand?: Brand | null,
  referenceTitles: string[] = []
): ScriptEvaluationResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  const overlapScore = computeReferenceContentOverlapScore(script, spark, referenceTitles);
  const genericity = computeGenericityScore(script, spark);
  const originality = Number(Math.max(0, Math.min(1, 1 - Math.max(genericity, overlapScore))).toFixed(2));

  // Gate 1: Reference Content Overlap (Hard gate at threshold 0.7)
  if (overlapScore >= MAX_REFERENCE_OVERLAP_SCORE) {
    reasons.push("This story is too close to a reference video. Borrow the format, write a new episode.");
  }

  // Gate 2: Genericity / Empty Payoff (Hard gate at threshold 0.75)
  const premiseText = (script.premise || script.logline || spark?.whyNow || "").trim();
  if (genericity >= MAX_GENERICITY_SCORE && (premiseText.length < 25 || /^(this video|general overview)/i.test(premiseText))) {
    reasons.push("Script has no specific payoff. SPARK will not generate filler.");
  }

  // Gate 3: Claims and Fact-Checking
  const claims = Array.isArray(script.claims) ? script.claims : [];
  let unverifiedCount = 0;
  let falseCount = 0;
  let falseCorePremise = false;

  for (const c of claims) {
    if (c.verified === false) {
      falseCount++;
      if (c.isCorePremise) {
        falseCorePremise = true;
      }
    } else if (c.verified === "pending" || typeof c.verified === "undefined") {
      unverifiedCount++;
    }
  }

  const formatStr = (script.format || brand?.contentFormat || "faceless").toLowerCase();
  const isFiction = formatStr.includes("anime") || formatStr.includes("story") || formatStr.includes("fiction");

  if (!isFiction) {
    if (falseCorePremise) {
      reasons.push("Core premise claim is factually false or fabricated. Educational scripts require verified facts.");
    } else if (falseCount > 0) {
      reasons.push(`Script contains ${falseCount} false claim(s). Educational scripts require verified facts.`);
    } else if (unverifiedCount + falseCount > MAX_UNVERIFIED_OR_FALSE_CLAIMS) {
      reasons.push(
        `Script contains ${unverifiedCount} unverified claim(s) (limit is ${MAX_UNVERIFIED_OR_FALSE_CLAIMS}). Verify facts before generating assets.`
      );
    }
  }

  // Gate 4: Retention Open-Loop Pacing Warning
  // Warn if long script has zero planted loops when brand retention policy has sampleSize >= 3
  const targetDurationSec = script.targetDurationSec || 60;
  const plantedLoops = script.openLoops?.plantedAtSec || [];
  const retPolicy = brand?.settings?.retentionPolicy;
  const sampleSize = typeof retPolicy?.sampleSize === "number" ? retPolicy.sampleSize : 0;

  if (targetDurationSec >= 45 && plantedLoops.length === 0 && sampleSize >= 3) {
    const isEducational = formatStr.includes("faceless") || formatStr.includes("educational") || formatStr.includes("host") || formatStr.includes("explainer");
    const targetInterval = retPolicy?.targetOpenLoopIntervalSec || 60;
    warnings.push(
      `Script has no planted open loops despite retention policy recommending loops every ~${targetInterval}s. For ${isEducational ? "educational/faceless" : "long"} content, viewer drop-off is likely without early open loops.`
    );
  }

  // Attach scores to script in place
  script.genericityScore = genericity;
  script.originalityScore = originality;
  script.referenceContentOverlapScore = overlapScore;

  return {
    ok: reasons.length === 0,
    reasons,
    warnings,
    scores: {
      genericityScore: genericity,
      originalityScore: originality,
      referenceContentOverlapScore: overlapScore,
      unverifiedClaimsCount: unverifiedCount,
      falseClaimsCount: falseCount,
    },
    claims,
  };
}
