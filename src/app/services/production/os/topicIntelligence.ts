/**
 * SPARK Creative OS — Topic Intelligence & Niche Lock
 *
 * Synthesizes research patterns and reference channels into bounded,
 * niche-locked TopicCandidates, then writes deduplicated ViralSparks.
 *
 * Borrow FORMAT from a reference channel. NEVER copy that channel's
 * specific videos, titles, or stories.
 */

import type { Brand, ResearchSource, ResearchPattern, ViralSpark } from "../../../domain/types";
import { ModelRouter } from "../../runtime/modelRouter";
import { computeFingerprint } from "../../research/researchDepartmentService";
import { persistViralSparkCreate, persistBrandUpdate } from "../../../backend/workspaceSync";
import { ensureViralSparkProductionReady } from "../viralSparkGate";

export interface TopicCandidate {
  topic: string;
  premise: string; // what the viewer will learn / feel
  format: string; // faceless educational | host | story | … from brand
  nicheTag: string;
  rationale: string; // why this fits THIS brand now
  estRpmBand?: string;
  searchVolumeRank?: number;
  formatSignature?: { // from reference channel, NOT content
    pacing?: string;
    hookStyle?: string;
    chapterShape?: string;
    visualArchetype?: string;
  };
  referenceChannel?: string;
  sourceUrls?: string[];
  mustNotCopy: string[];
}

export interface PlanTopicsInput {
  brand: Brand;
  lockedNicheTag?: string;
  userIntent?: string;
  referenceChannel?: string;
  sourceUrls?: string[];
  researchSources?: ResearchSource[];
  patterns?: ResearchPattern[];
  count?: number; // default 5, capped at 8 (e.g. for calendar mode)
  allowOverride?: boolean; // executive explicit override
}

/**
 * Checks whether a candidate's topic and nicheTag fit the locked niche or brand content pillars.
 */
export function isTopicAllowedByNiche(
  candidate: TopicCandidate,
  lockedNiche: string,
  pillars: { label: string; active: boolean }[] = [],
  allowOverride = false
): boolean {
  if (allowOverride) return true;
  const normLocked = lockedNiche.toLowerCase().trim();
  const normTag = (candidate.nicheTag || "").toLowerCase().trim();
  const normTopic = (candidate.topic || "").toLowerCase().trim();
  const normPremise = (candidate.premise || "").toLowerCase().trim();

  // Direct match with locked niche
  if (normTag.includes(normLocked) || normLocked.includes(normTag)) return true;

  // Keyword token overlap between topic/tag and locked niche
  const lockedTokens = normLocked.split(/[\s,&/]+/).filter((t) => t.length > 2);
  const candidateText = `${normTag} ${normTopic} ${normPremise}`;
  const hasTokenMatch = lockedTokens.some((token) => candidateText.includes(token));
  if (hasTokenMatch) return true;

  // Active brand pillar match
  const activePillars = pillars.filter((p) => p.active !== false).map((p) => p.label.toLowerCase());
  for (const pillar of activePillars) {
    const pillarTokens = pillar.split(/[\s,&/]+/).filter((t) => t.length > 2);
    if (pillarTokens.some((pt) => candidateText.includes(pt))) return true;
  }

  return false;
}

/**
 * Extracts a format signature from stored research patterns or sources.
 */
export function deriveFormatSignature(
  patterns: ResearchPattern[] = [],
  sources: ResearchSource[] = []
): NonNullable<TopicCandidate["formatSignature"]> {
  let hookStyle: string | undefined;
  let pacing: string | undefined;
  let chapterShape: string | undefined;
  let visualArchetype: string | undefined;

  for (const p of patterns) {
    const hook = (p as any).hookFormula || p.metrics?.hookFormula || (p.patternType === "Hook" || p.patternType === "Opening Pattern" ? p.description : undefined);
    const fmt = (p as any).format || p.metrics?.format || (p.patternType === "Story Structure" || p.patternType === "Series Format" ? p.description : undefined);
    const cta = (p as any).ctaLine || p.metrics?.ctaLine || (p.patternType === "CTA Pattern" ? p.description : undefined);
    if (hook && !hookStyle) hookStyle = String(hook);
    if (fmt && !chapterShape) chapterShape = String(fmt);
    if (cta && !pacing) pacing = `CTA: ${String(cta)}`;
  }

  for (const s of sources) {
    if (s.videoResearch) {
      if (!hookStyle && s.videoResearch.hook_formula) hookStyle = s.videoResearch.hook_formula;
      if (!chapterShape && s.videoResearch.format) chapterShape = s.videoResearch.format;
      if (!pacing && s.videoResearch.spoken_beats && s.videoResearch.spoken_beats.length > 0) {
        pacing = `${s.videoResearch.spoken_beats.length}-beat pacing`;
      }
    }
  }

  return {
    hookStyle: hookStyle || "Direct curiosity opener with rapid pattern interrupt",
    pacing: pacing || "Fast dynamic rhythm; cut every 3-5 seconds",
    chapterShape: chapterShape || "3-part escalation: Hook → Problem Context → Direct Payoff",
    visualArchetype: visualArchetype || "High-clarity visual metaphors with bold typography",
  };
}

/**
 * Gathers known video titles from reference sources so we never copy them.
 */
export function collectMustNotCopyTitles(sources: ResearchSource[] = []): string[] {
  const titles = new Set<string>();
  for (const s of sources) {
    if (s.recentVideos) {
      for (const v of s.recentVideos) {
        if (v.title) titles.add(v.title.trim());
      }
    }
    if (s.videoResearch?.title) {
      titles.add(s.videoResearch.title.trim());
    }
    if (s.topContent) {
      for (const item of s.topContent) {
        if (item.title) titles.add(item.title.trim());
      }
    }
  }
  return Array.from(titles);
}

/**
 * Main Topic Planning Engine:
 * Generates up to count (5 default, max 8) niche-locked TopicCandidate items.
 */
export async function planTopics(input: PlanTopicsInput): Promise<TopicCandidate[]> {
  const count = Math.min(Math.max(1, input.count ?? 5), 8);
  const brand = input.brand;
  const lockedNiche = (
    input.lockedNicheTag ||
    brand.settings?.nicheTag ||
    brand.niche ||
    "General"
  ).trim();

  // Persist lock on brand.settings.nicheTag if not set
  if (brand.id && !brand.settings?.nicheTag) {
    brand.settings = { ...brand.settings, nicheTag: lockedNiche };
    persistBrandUpdate(brand.id, { settings: brand.settings }).catch((err) =>
      console.warn("[TopicIntelligence] Persist niche lock notice:", err)
    );
  }

  const formatSig = deriveFormatSignature(input.patterns, input.researchSources);
  const mustNotCopy = collectMustNotCopyTitles(input.researchSources);

  const pillarsList = (brand.contentPillars || [])
    .filter((p) => p.active !== false)
    .map((p) => p.label)
    .join(", ");
  const audiencePrimary = brand.audience?.primary || "Broad audience";
  const audienceDesires = (brand.audience?.desires || []).join(", ");
  const brandFormat = typeof brand.contentFormat === "string" ? brand.contentFormat : "Short-form (45–60 sec)";

  const refChannelNote = input.referenceChannel
    ? `Reference Channel / Inspiration: "${input.referenceChannel}". Borrow FORMAT ONLY (pacing, hook structure, visual rhythm). NEVER copy their episode titles, story topics, or transcripts.`
    : "";

  const mustNotCopyNote =
    mustNotCopy.length > 0
      ? `DO NOT COPY OR REUSE ANY OF THESE TITLES FROM THE REFERENCE CHANNEL:\n${mustNotCopy.slice(0, 15).map((t) => `- "${t}"`).join("\n")}`
      : "";

  const userIntentPrompt = input.userIntent ? `User Intent / Focus: "${input.userIntent}"` : "";

  const prompt = `You are the Executive Creative Director for brand "${brand.name}".
Your task is to plan up to ${count} original, high-performing video topic candidates.

STRICT CONSTRAINTS:
1. LOCKED NICHE: "${lockedNiche}".
   Every topic candidate MUST be strictly inside this locked niche.
   Do not suggest topics outside this niche (e.g. if the niche is AI/Tech, do not suggest cooking or fitness).
2. BRAND PILLARS: ${pillarsList || lockedNiche}
3. TARGET AUDIENCE: ${audiencePrimary} (Desires: ${audienceDesires || "Actionable value"})
4. BRAND FORMAT: ${brandFormat}
${refChannelNote}
${mustNotCopyNote}
${userIntentPrompt}

FORMAT SIGNATURE TO BORROW (Pacing & Structure Only):
- Hook Style: ${formatSig.hookStyle}
- Pacing: ${formatSig.pacing}
- Chapter Shape: ${formatSig.chapterShape}
- Visual Archetype: ${formatSig.visualArchetype}

Output MUST be a valid JSON array of up to ${count} objects matching this exact structure:
[
  {
    "topic": "Clean punchy title for this brand",
    "premise": "What the viewer will learn or feel (the core value proposition)",
    "format": "${brandFormat}",
    "nicheTag": "${lockedNiche}",
    "rationale": "Why this topic fits THIS brand and target audience right now",
    "estRpmBand": "$4-$8",
    "searchVolumeRank": 85,
    "formatSignature": {
      "pacing": "${formatSig.pacing}",
      "hookStyle": "${formatSig.hookStyle}",
      "chapterShape": "${formatSig.chapterShape}",
      "visualArchetype": "${formatSig.visualArchetype}"
    },
    "referenceChannel": "${input.referenceChannel || ""}",
    "mustNotCopy": ${JSON.stringify(mustNotCopy.slice(0, 5))}
  }
]

Do NOT output conversational filler, markdown commentary, or apologies. Return ONLY the JSON array.`;

  const callProvider = async (p: string): Promise<TopicCandidate[]> => {
    const raw = await ModelRouter.executeCategoryRequest("research", {
      prompt: p,
      capability: "Reasoning",
    });

    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }
    const jsonStart = cleaned.indexOf("[");
    const jsonEnd = cleaned.lastIndexOf("]");
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
    }
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      throw new Error("Provider returned JSON that is not an array of topic candidates");
    }
    return parsed as TopicCandidate[];
  };

  let rawCandidates: TopicCandidate[];
  try {
    rawCandidates = await callProvider(prompt);
  } catch (firstErr) {
    console.warn("[TopicIntelligence] First parse failed, retrying once with explicit repair:", firstErr);
    const retryPrompt = `${prompt}\n\nIMPORTANT: Your previous output could not be parsed as JSON. Return ONLY the raw JSON array starting with '[' and ending with ']'.`;
    rawCandidates = await callProvider(retryPrompt);
  }

  // Niche Lock Gate: drop off-niche topics unless allowOverride === true
  const accepted: TopicCandidate[] = [];
  for (const cand of rawCandidates) {
    if (!cand || !cand.topic) continue;

    if (!isTopicAllowedByNiche(cand, lockedNiche, brand.contentPillars, input.allowOverride)) {
      console.warn(
        `[TopicIntelligence] Dropped off-niche topic: "${cand.topic}" (tag: ${cand.nicheTag}) - locked to "${lockedNiche}"`
      );
      continue;
    }

    // Attach reference metadata and format signature
    accepted.push({
      ...cand,
      formatSignature: cand.formatSignature || formatSig,
      referenceChannel: cand.referenceChannel || input.referenceChannel,
      sourceUrls: input.sourceUrls || (input.referenceChannel ? [input.referenceChannel] : []),
      mustNotCopy: cand.mustNotCopy && cand.mustNotCopy.length > 0 ? cand.mustNotCopy : mustNotCopy.slice(0, 5),
    });

    if (accepted.length >= count) break;
  }

  return accepted;
}

/**
 * Creates and persists ViralSparks from TopicCandidates with deduplication.
 * Does NOT delete existing SOURCE sparks from ResearchDepartmentService.
 */
export async function createViralSparksFromTopics(
  topics: TopicCandidate[],
  brand: Brand,
  options?: {
    existingSparks?: ViralSpark[];
    autoHydrateFirst?: boolean;
  }
): Promise<{ created: ViralSpark[]; skipped: number }> {
  const existingSparks = options?.existingSparks || [];
  const existingFingerprints = new Set(existingSparks.map((s) => s.fingerprint).filter(Boolean));
  const existingTitles = new Set(existingSparks.map((s) => s.title.toLowerCase().trim()));

  const created: ViralSpark[] = [];
  let skipped = 0;
  const now = new Date().toISOString();

  for (const topic of topics) {
    const rawFp = `${brand.id || brand.name}:${topic.topic}:${topic.nicheTag}`;
    const fp = computeFingerprint(rawFp);

    if (existingFingerprints.has(fp) || existingTitles.has(topic.topic.toLowerCase().trim())) {
      skipped++;
      continue;
    }

    const origin: "HYBRID" | "TREND" =
      topic.referenceChannel || (topic.sourceUrls && topic.sourceUrls.length > 0)
        ? "HYBRID"
        : "TREND";

    const hookText = topic.formatSignature?.hookStyle
      ? `${topic.premise} — ${topic.formatSignature.hookStyle.replace(/^\[.*?\]\s*/, "")}`
      : topic.premise;

    const sparkDraft: ViralSpark = {
      id: `spk-topic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: topic.topic,
      hook: hookText,
      views: "Projected High Signal",
      velocity: "Rising Opportunity",
      platformFit: /16:9|long|documentary/i.test(topic.format) ? "YouTube Long-form" : "YouTube Shorts",
      brandFitScore: typeof topic.searchVolumeRank === "number" ? Math.min(96, Math.max(75, topic.searchVolumeRank)) : 88,
      category: "rising",
      timeWindow: "Immediate Opportunity",
      productionTime: /16:9|long/i.test(topic.format) ? "30 mins" : "15 mins",
      whyNow: topic.rationale,
      angle: topic.premise,
      audienceEmotion: "Curiosity + High Value",
      expectedRetention: topic.formatSignature?.pacing || "Retention target: >70% through beat 2",
      difficulty: "Medium",
      riskLevel: "Low",
      suggestedFormat: topic.format || (typeof brand.contentFormat === "string" ? brand.contentFormat : "Short-form (45–60 sec)"),
      suggestedProductionMode: /16:9|long|documentary/i.test(topic.format) ? "standard" : "express",
      origin,
      fingerprint: fp,
      firstSeenAt: now,
      lastSeenAt: now,
      lastSyncedAt: now,
      syncCount: 1,
      status: "draft",
      sourceUrl: topic.sourceUrls?.[0],
      researchContext: {
        sourceName: topic.referenceChannel,
        sourceUrl: topic.sourceUrls?.[0],
        format: topic.formatSignature?.chapterShape || topic.format,
        hookPattern: topic.formatSignature?.hookStyle,
        ctaStyle: topic.formatSignature?.pacing,
        provenStructure: topic.formatSignature?.chapterShape,
      },
    };

    // Auto-hydrate first spark only if requested
    let finalSpark = sparkDraft;
    if (options?.autoHydrateFirst && created.length === 0) {
      const ensured = ensureViralSparkProductionReady(sparkDraft, brand);
      if (ensured.ok) {
        finalSpark = ensured.spark;
      }
    }

    if (brand.id) {
      persistViralSparkCreate(brand.id, finalSpark).catch((err) =>
        console.warn("[TopicIntelligence] Persist topic spark notice:", err)
      );
    }

    created.push(finalSpark);
    existingFingerprints.add(fp);
    existingTitles.add(topic.topic.toLowerCase().trim());
  }

  return { created, skipped };
}
