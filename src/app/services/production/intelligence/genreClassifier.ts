/**
 * Genre / grammar classification — composable, extensible, not a forced dropdown.
 * Register additional rules without rewriting the classifier core.
 */

import type { ContentGenreId, PlatformId, AspectRatioId } from "../specification/productionSpec";

export interface GenreClassification {
  primaryGenre: ContentGenreId;
  secondaryGenres: ContentGenreId[];
  styleTags: string[];
  tone: string;
  audience: string;
  platformHints: PlatformId[];
  aspectRatioHint: AspectRatioId;
  durationHintSec?: number;
  confidence: number;
  rationale: string[];
  ambiguous: boolean;
  unknownFields: string[];
}

export interface GenreClassificationRule {
  id: string;
  genre: ContentGenreId;
  words: string[];
  boost: number;
  tone?: string;
  audience?: string;
}

const DEFAULT_RULES: GenreClassificationRule[] = [
  { id: "documentary", genre: "documentary", words: ["documentary", "true story", "history", "archive", "investigat", "kingdom", "ancient", "benin", "historical"], boost: 0.25, tone: "authoritative", audience: "curious learners / documentary viewers" },
  { id: "advertisement", genre: "advertisement", words: ["ad", "commercial", "promo", "campaign", "brand film", "luxury commercial"], boost: 0.24, tone: "premium", audience: "buyers and prospects" },
  { id: "product_demo", genre: "product_demo", words: ["product", "demo", "unbox", "launch", "feature", "watch", "gadget"], boost: 0.2, tone: "clear", audience: "buyers and prospects" },
  { id: "educational", genre: "educational", words: ["explain", "tutorial", "how to", "lesson", "course", "teach", "bitcoin", "solar", "science"], boost: 0.22, tone: "instructive", audience: "learners seeking clarity" },
  { id: "news_explainer", genre: "news_explainer", words: ["news", "breaking", "headline", "current event"], boost: 0.2, tone: "urgent" },
  { id: "music_video", genre: "music_video", words: ["music video", "mv", "lyrics video", "performance video"], boost: 0.25, tone: "rhythmic" },
  { id: "anime", genre: "anime", words: ["anime", "manga"], boost: 0.3, tone: "expressive", audience: "animation fans" },
  { id: "animation", genre: "animation", words: ["animation", "animated", "cartoon", "3d character", "animated short"], boost: 0.25, tone: "playful", audience: "animation fans" },
  { id: "narrative_film", genre: "narrative_film", words: ["film", "trailer", "short film", "cinematic story", "drama", "screenplay", "explorer", "hidden city", "story about"], boost: 0.22, tone: "dramatic" },
  { id: "travel", genre: "travel", words: ["travel", "destination", "tour", "voyage"], boost: 0.2, tone: "aspirational" },
  { id: "sports", genre: "sports", words: ["sports", "match", "training", "athlete", "highlight"], boost: 0.2, tone: "kinetic" },
  { id: "comedy", genre: "comedy", words: ["funny", "comedy", "skit", "joke", "humor"], boost: 0.2, tone: "playful" },
  { id: "social", genre: "social", words: ["tiktok", "shorts", "reel", "viral", "faceless"], boost: 0.15, tone: "punchy" },
];

/** Extensible rule registry — future grammars register here without rewriting classifier */
const RULE_REGISTRY: GenreClassificationRule[] = [...DEFAULT_RULES];

export function registerGenreClassificationRule(rule: GenreClassificationRule): void {
  const idx = RULE_REGISTRY.findIndex((r) => r.id === rule.id);
  if (idx >= 0) RULE_REGISTRY[idx] = rule;
  else RULE_REGISTRY.push(rule);
}

export function listGenreClassificationRules(): GenreClassificationRule[] {
  return [...RULE_REGISTRY];
}

function includesAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

export function classifyCreativeIntent(
  idea: string,
  opts?: {
    preferredPlatforms?: PlatformId[];
    preferredAspectRatio?: AspectRatioId;
    targetDurationSec?: number;
  }
): GenreClassification {
  const text = (idea || "").toLowerCase().trim();
  const rationale: string[] = [];
  const styleTags: string[] = [];
  const secondary: ContentGenreId[] = [];
  const unknownFields: string[] = [];

  if (!text) {
    return {
      primaryGenre: "custom",
      secondaryGenres: [],
      styleTags: [],
      tone: "unknown",
      audience: "unknown",
      platformHints: opts?.preferredPlatforms?.length ? opts.preferredPlatforms : ["youtube_shorts"],
      aspectRatioHint: opts?.preferredAspectRatio || "9:16",
      durationHintSec: opts?.targetDurationSec,
      confidence: 0,
      rationale: ["Empty idea — classification deferred"],
      ambiguous: true,
      unknownFields: ["genre", "tone", "audience", "duration", "visualStyle"],
    };
  }

  let primary: ContentGenreId = "custom";
  let tone = "unknown";
  let audience = "general audience";
  let confidence = 0.35;
  let bestScore = 0;
  let matchCount = 0;

  for (const rule of RULE_REGISTRY) {
    if (!includesAny(text, rule.words)) continue;
    matchCount += 1;
    const matched = rule.words.filter((w) => text.includes(w));
    rationale.push(`Matched ${rule.genre} cues: ${matched.join(", ")}`);
    if (rule.boost > bestScore) {
      if (primary !== "custom" && primary !== rule.genre) secondary.push(primary);
      primary = rule.genre;
      bestScore = rule.boost;
      confidence = Math.min(0.95, 0.45 + rule.boost);
      if (rule.tone) tone = rule.tone;
      if (rule.audience) audience = rule.audience;
    } else if (rule.genre !== primary) {
      secondary.push(rule.genre);
    }
  }

  if (matchCount === 0) {
    primary = "custom";
    confidence = 0.4;
    rationale.push("No strong genre cues — using custom grammar");
    unknownFields.push("genre");
  }

  if (includesAny(text, ["cinematic", "film look", "anamorphic"])) styleTags.push("cinematic");
  if (includesAny(text, ["luxury", "premium", "elegant"])) styleTags.push("luxury");
  if (includesAny(text, ["sci-fi", "scifi", "futuristic"])) styleTags.push("sci-fi");
  if (includesAny(text, ["vertical", "tiktok", "shorts", "reel"])) styleTags.push("short-form", "vertical");
  if (includesAny(text, ["african", "afro"])) styleTags.push("african");
  if (includesAny(text, ["horror", "thriller"])) styleTags.push("dark");
  if (includesAny(text, ["faceless"])) styleTags.push("faceless");
  if (includesAny(text, ["talking head", "host"])) styleTags.push("talking-head");
  if (includesAny(text, ["explainer"])) styleTags.push("explainer");
  if (includesAny(text, ["performance"])) styleTags.push("performance");
  if (includesAny(text, ["comedy", "funny"]) && primary === "anime") styleTags.push("comedy");
  if (includesAny(text, ["education", "explain"]) && primary === "social") styleTags.push("educational");

  const ambiguous = matchCount === 0 || (matchCount >= 3 && confidence < 0.7);
  if (ambiguous) rationale.push("Classification marked ambiguous — planner should stay conservative");

  if (tone === "unknown") unknownFields.push("tone");

  const platformHints: PlatformId[] = opts?.preferredPlatforms?.length
    ? opts.preferredPlatforms
    : includesAny(text, ["tiktok"])
      ? ["tiktok"]
      : includesAny(text, ["shorts", "reel", "vertical"])
        ? ["youtube_shorts", "tiktok"]
        : includesAny(text, ["youtube", "documentary", "film", "minute"])
          ? ["youtube"]
          : ["youtube_shorts"];

  let durationHintSec = opts?.targetDurationSec;
  const minMatch = text.match(/(\d+)\s*-?\s*(?:minutes|minute|mins|min)\b/);
  const secMatch = text.match(/(\d+)\s*-?\s*s(?:ec(?:ond)?s?)?\b/);
  if (!durationHintSec && minMatch) {
    durationHintSec = Number(minMatch[1]) * 60;
    rationale.push(`Parsed duration hint: ${durationHintSec}s`);
  } else if (!durationHintSec && secMatch) {
    durationHintSec = Number(secMatch[1]);
    rationale.push(`Parsed duration hint: ${durationHintSec}s`);
  }
  if (!durationHintSec) {
    unknownFields.push("duration");
    durationHintSec =
      primary === "documentary" || primary === "narrative_film"
        ? 180
        : primary === "educational"
          ? 120
          : primary === "advertisement" || primary === "product_demo"
            ? 30
            : 60;
  }

  const aspectRatioHint: AspectRatioId =
    opts?.preferredAspectRatio ||
    (platformHints.includes("youtube") &&
    !platformHints.includes("youtube_shorts") &&
    !styleTags.includes("vertical")
      ? "16:9"
      : "9:16");

  return {
    primaryGenre: primary,
    secondaryGenres: Array.from(new Set(secondary)).slice(0, 3),
    styleTags: Array.from(new Set(styleTags)),
    tone,
    audience,
    platformHints,
    aspectRatioHint,
    durationHintSec,
    confidence,
    rationale,
    ambiguous,
    unknownFields: Array.from(new Set(unknownFields)),
  };
}
