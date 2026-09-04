/**
 * Infer content genre / grammar tags from raw creative intent.
 * Deterministic classifier — no hard lock; tags remain composable.
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
}

function includesAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

export function classifyCreativeIntent(idea: string, opts?: {
  preferredPlatforms?: PlatformId[];
  preferredAspectRatio?: AspectRatioId;
  targetDurationSec?: number;
}): GenreClassification {
  const text = (idea || "").toLowerCase();
  const rationale: string[] = [];
  const styleTags: string[] = [];
  const secondary: ContentGenreId[] = [];

  let primary: ContentGenreId = "social";
  let tone = "engaging";
  let audience = "general social audience";
  let confidence = 0.55;

  const rules: Array<{ genre: ContentGenreId; words: string[]; boost: number; tone?: string }> = [
    { genre: "documentary", words: ["documentary", "true story", "history", "archive", "investigat"], boost: 0.25, tone: "authoritative" },
    { genre: "advertisement", words: ["ad", "commercial", "promo", "campaign", "brand film"], boost: 0.22, tone: "premium" },
    { genre: "product_demo", words: ["product", "demo", "unbox", "launch", "feature"], boost: 0.2, tone: "clear" },
    { genre: "educational", words: ["explain", "tutorial", "how to", "lesson", "course", "teach", "solar", "science"], boost: 0.22, tone: "instructive" },
    { genre: "news_explainer", words: ["news", "breaking", "headline", "current event"], boost: 0.2, tone: "urgent" },
    { genre: "music_video", words: ["music video", "mv", "lyrics video", "song"], boost: 0.25, tone: "rhythmic" },
    { genre: "anime", words: ["anime", "manga"], boost: 0.3, tone: "expressive" },
    { genre: "animation", words: ["animation", "animated", "cartoon", "3d character"], boost: 0.25, tone: "playful" },
    { genre: "narrative_film", words: ["film", "trailer", "short film", "cinematic story", "drama", "screenplay"], boost: 0.22, tone: "dramatic" },
    { genre: "travel", words: ["travel", "destination", "tour", "voyage"], boost: 0.2, tone: "aspirational" },
    { genre: "sports", words: ["sports", "match", "training", "athlete", "highlight"], boost: 0.2, tone: "kinetic" },
    { genre: "comedy", words: ["funny", "comedy", "skit", "joke", "humor"], boost: 0.2, tone: "playful" },
    { genre: "social", words: ["tiktok", "shorts", "reel", "viral", "faceless"], boost: 0.15, tone: "punchy" },
  ];

  let bestScore = 0;
  for (const rule of rules) {
    if (includesAny(text, rule.words)) {
      const score = rule.boost;
      rationale.push(`Matched ${rule.genre} cues: ${rule.words.filter((w) => text.includes(w)).join(", ")}`);
      if (score > bestScore) {
        if (primary !== "social" && primary !== rule.genre) secondary.push(primary);
        primary = rule.genre;
        bestScore = score;
        confidence = Math.min(0.95, 0.55 + score);
        if (rule.tone) tone = rule.tone;
      } else if (rule.genre !== primary) {
        secondary.push(rule.genre);
      }
    }
  }

  if (includesAny(text, ["cinematic", "film look", "anamorphic"])) styleTags.push("cinematic");
  if (includesAny(text, ["luxury", "premium", "elegant"])) styleTags.push("luxury");
  if (includesAny(text, ["vertical", "tiktok", "shorts", "reel"])) styleTags.push("short-form", "vertical");
  if (includesAny(text, ["african", "afro"])) styleTags.push("african");
  if (includesAny(text, ["horror", "thriller"])) styleTags.push("dark");
  if (includesAny(text, ["faceless"])) styleTags.push("faceless");
  if (includesAny(text, ["talking head", "host"])) styleTags.push("talking-head");

  const platformHints: PlatformId[] = opts?.preferredPlatforms?.length
    ? opts.preferredPlatforms
    : includesAny(text, ["tiktok"])
      ? ["tiktok"]
      : includesAny(text, ["shorts", "reel", "vertical"])
        ? ["youtube_shorts", "tiktok"]
        : includesAny(text, ["youtube", "documentary", "film"])
          ? ["youtube"]
          : ["youtube_shorts"];

  let durationHintSec = opts?.targetDurationSec;
  const durMatch = text.match(/(\d+)\s*(?:minute|min)\b/) || text.match(/(\d+)\s*s(?:ec(?:ond)?s?)?\b/);
  if (!durationHintSec && durMatch) {
    const n = Number(durMatch[1]);
    durationHintSec = text.includes("min") ? n * 60 : n;
    rationale.push(`Parsed duration hint: ${durationHintSec}s`);
  }
  if (!durationHintSec) {
    durationHintSec =
      primary === "documentary" || primary === "narrative_film"
        ? 180
        : primary === "educational"
          ? 120
          : 60;
  }

  const aspectRatioHint: AspectRatioId =
    opts?.preferredAspectRatio ||
    (platformHints.includes("youtube") && !platformHints.includes("youtube_shorts") && !styleTags.includes("vertical")
      ? "16:9"
      : "9:16");

  if (primary === "documentary") audience = "curious learners / documentary viewers";
  if (primary === "advertisement" || primary === "product_demo") audience = "buyers and prospects";
  if (primary === "educational") audience = "learners seeking clarity";
  if (primary === "anime" || primary === "animation") audience = "animation fans";

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
  };
}
