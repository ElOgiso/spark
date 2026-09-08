/**
 * My Spark bible proposer — 3–5 shootable pillars + one short audience line.
 * Domain helper only. Not an agent. Not a UI component.
 */
import type { Brand, Character, ContentFormat, ResearchSource, VideoResearch, VisualGenreSetting } from "../../domain/types";
import { VIDEO_LENGTH_OPTIONS } from "../../domain/types";
import { inferVisualGenreFromText, normalizeVisualGenre } from "../../domain/visualGenre";

export type AcceptedWatchHint = {
  hook_formula?: string;
  format?: string;
  title?: string;
};

export type BibleProposeFrom = "onboard" | "watches";

export interface ProposeBrandBibleInput {
  niche?: string;
  archetype?: string;
  contentFormat?: ContentFormat | string | null;
  visualGenre?: string | null;
  country?: string;
  language?: string;
  acceptedWatches?: AcceptedWatchHint[];
}

export interface BrandBiblePatch {
  contentPillars?: { label: string; active: boolean }[];
  audience?: Brand["audience"];
  tone?: Brand["tone"];
  settings: Record<string, unknown>;
}

const PILLAR_MAX = 48;
const PILLAR_MIN = 3;
const PILLAR_MAX_COUNT = 5;

/** Marketing buckets — never used as a pillar unless the words are in niche or hook_formula. */
const FORBIDDEN_BUCKETS = new Set([
  "educational",
  "education",
  "promotional",
  "promo",
  "behind the scenes",
  "bts",
  "motivation",
  "motivational",
  "lifestyle",
  "ai",
  "crypto",
  "comedy",
  "news",
  "travel",
  "health",
  "music",
  "sports",
  "fashion",
  "beauty",
  "food",
  "gaming",
  "fitness",
]);

const STOP = new Set([
  "this", "that", "with", "from", "your", "their", "about", "into", "then",
  "than", "when", "what", "which", "have", "been", "will", "just", "more",
  "most", "very", "also", "only", "over", "after", "before", "they", "them",
  "make", "made", "want", "need", "like", "stop", "does", "done", "video",
  "videos", "watch", "hook", "formula", "short", "long", "form",
]);

const PLACEHOLDER_AUDIENCE = new Set([
  "general audience",
  "digital creators and forward-thinking professionals",
  "modern digital creators, founders & operators",
  "your target audience — configure during onboarding",
  "your target audience - configure during onboarding",
]);

function clip(text: string, max: number): string {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max).trimEnd();
}

function titleCase(text: string): string {
  return clip(text, PILLAR_MAX)
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.toLowerCase() === "ai" ? "AI" : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

function nicheStem(niche?: string): string {
  const raw = String(niche || "this craft").replace(/&/g, " ").replace(/\s+/g, " ").trim();
  return raw || "this craft";
}

function allowedBlob(input: ProposeBrandBibleInput): string {
  const watches = (input.acceptedWatches || [])
    .map((w) => `${w.hook_formula || ""} ${w.format || ""}`)
    .join(" ");
  return `${input.niche || ""} ${input.archetype || ""} ${watches}`.toLowerCase();
}

function isForbiddenLabel(label: string, allowed: string): boolean {
  const n = label.trim().toLowerCase();
  if (!n) return true;
  if (!/\s/.test(n)) return true;
  if (FORBIDDEN_BUCKETS.has(n) && !allowed.includes(n)) return true;
  return false;
}

function formatShootNoun(contentFormat?: string | null): string {
  const fmt = String(contentFormat || "host").toLowerCase();
  if (fmt === "faceless") return "breakdowns for Shorts";
  if (fmt === "story") return "story sequences";
  if (fmt === "anime") return "story scenes";
  return "breakdowns for Shorts";
}

function archetypeLens(archetype?: string): string {
  const a = String(archetype || "").toLowerCase();
  if (a.includes("educat")) return "Walkthroughs of";
  if (a.includes("analyst")) return "Analyst takes on";
  if (a.includes("operator")) return "Operator systems for";
  if (a.includes("mentor")) return "Mentorship on";
  if (a.includes("strateg")) return "Strategy series on";
  if (a.includes("builder")) return "Builder notes on";
  if (a.includes("story")) return "Story frames for";
  if (a.includes("provoc")) return "Sharp takes on";
  if (a.includes("entertain")) return "High-retention cuts on";
  if (a.includes("insider")) return "Insider notes on";
  return "Creator series on";
}

function topicTokens(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .replace(/viral format:/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
}

function agreedTopics(watches: AcceptedWatchHint[]): string[] {
  const freq = new Map<string, number>();
  for (const w of watches || []) {
    const seen = new Set<string>();
    for (const t of topicTokens(w.hook_formula || "")) seen.add(t);
    for (const t of topicTokens(w.format || "")) seen.add(t);
    const title = String(w.title || "");
    if (title && !/viral format:/i.test(title)) {
      for (const t of topicTokens(title)) seen.add(t);
    }
    for (const t of seen) freq.set(t, (freq.get(t) || 0) + 1);
  }
  return [...freq.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t]) => t);
}

function pushUnique(
  out: { label: string; active: true }[],
  label: string,
  allowed: string
): void {
  const clipped = titleCase(label);
  if (clipped.length < 8) return;
  if (isForbiddenLabel(clipped, allowed)) return;
  if (out.some((p) => p.label.toLowerCase() === clipped.toLowerCase())) return;
  if (out.length >= PILLAR_MAX_COUNT) return;
  out.push({ label: clipped, active: true });
}

export function proposeContentPillars(input: ProposeBrandBibleInput): { label: string; active: true }[] {
  const allowed = allowedBlob(input);
  const stem = nicheStem(input.niche);
  const shoot = formatShootNoun(input.contentFormat);
  const lens = archetypeLens(input.archetype);
  const watches = input.acceptedWatches || [];
  const out: { label: string; active: true }[] = [];

  for (const topic of agreedTopics(watches)) {
    pushUnique(out, `${topic} ${shoot}`, allowed);
  }

  pushUnique(out, `${stem} ${shoot}`, allowed);
  pushUnique(out, `${lens} ${stem}`, allowed);
  pushUnique(out, `${stem} viewer questions`, allowed);
  pushUnique(out, `${stem} field examples`, allowed);
  pushUnique(out, `${shoot} from ${stem}`, allowed);

  return out.slice(0, Math.max(PILLAR_MIN, Math.min(PILLAR_MAX_COUNT, out.length)));
}

export function proposeAudienceProfile(input: ProposeBrandBibleInput): string {
  const niche = nicheStem(input.niche);
  const archetype = String(input.archetype || "").toLowerCase();
  let who = "Operators and creators";
  if (archetype.includes("educat") || archetype.includes("mentor")) who = "Practitioners and learners";
  else if (archetype.includes("analyst") || archetype.includes("strateg")) who = "Operators and analysts";
  else if (archetype.includes("builder") || archetype.includes("operator")) who = "Builders and operators";
  else if (archetype.includes("entertain") || archetype.includes("story")) who = "Viewers and story-first creators";
  const geo = String(input.country || "").trim();
  const lang = String(input.language || "").trim();
  const loc = [geo, lang].filter(Boolean).join(", ");
  const line = loc
    ? `${who} in ${niche} — ${loc}`
    : `${who} in ${niche}`;
  return clip(line, 140);
}

export function proposeToneDefaults(archetype?: string): Brand["tone"] {
  const a = String(archetype || "").toLowerCase();
  if (a.includes("educat") || a.includes("mentor")) {
    return [
      { label: "Educational", active: true },
      { label: "Conversational", active: true },
    ];
  }
  if (a.includes("operator") || a.includes("builder") || a.includes("analyst")) {
    return [
      { label: "Authoritative", active: true },
      { label: "No-fluff", active: true },
    ];
  }
  return [
    { label: "Authoritative", active: true },
    { label: "Conversational", active: true },
  ];
}

export function isPlaceholderAudience(primary?: string | null): boolean {
  const n = String(primary || "").trim().toLowerCase();
  return !n || PLACEHOLDER_AUDIENCE.has(n);
}

export function acceptedWatchesFromSources(sources: ResearchSource[] = []): AcceptedWatchHint[] {
  const out: AcceptedWatchHint[] = [];
  const seen = new Set<string>();
  for (const source of sources || []) {
    const vr = source.videoResearch;
    if (vr && vr.accepted !== false && vr.hook_formula) {
      const key = `${vr.platform || source.platform}:${vr.videoId || vr.hook_formula}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ hook_formula: vr.hook_formula, format: vr.format, title: vr.title });
      }
    }
    for (const entry of source.watchLedger || []) {
      if (entry.status !== "watched" || !entry.fingerprint) continue;
      if (seen.has(entry.watchedVideoKey)) continue;
      seen.add(entry.watchedVideoKey);
      out.push({ hook_formula: entry.fingerprint, format: "", title: "" });
    }
  }
  return out;
}

export function acceptedWatchesFromResearch(watches: VideoResearch[] = []): AcceptedWatchHint[] {
  return (watches || [])
    .filter((w) => w && w.accepted !== false && String(w.hook_formula || "").trim())
    .map((w) => ({ hook_formula: w.hook_formula, format: w.format, title: w.title }));
}

export function shouldProposeBrandBible(
  brand: Brand | null | undefined,
  opts?: { newAcceptedWatchCount?: number }
): BibleProposeFrom | "skip" {
  if (!brand) return "skip";
  const settings = (brand.settings || {}) as Record<string, unknown>;
  if (settings.pillars_user_edited === true) return "skip";
  const pillars = Array.isArray(brand.contentPillars) ? brand.contentPillars : [];
  const empty = pillars.length === 0;
  const newWatches = opts?.newAcceptedWatchCount || 0;
  if (empty) return newWatches > 0 ? "watches" : "onboard";
  if (settings.bible_proposed_from === "onboard" && newWatches > 0) return "watches";
  return "skip";
}

export function audienceNeedsSeed(brand: Brand | null | undefined): boolean {
  if (!brand) return false;
  const settings = (brand.settings || {}) as Record<string, unknown>;
  if (settings.audience_user_edited === true) return false;
  return isPlaceholderAudience(brand.audience?.primary);
}

export function toneNeedsSeed(brand: Brand | null | undefined): boolean {
  if (!brand) return false;
  const tones = Array.isArray(brand.tone) ? brand.tone : [];
  return tones.length === 0;
}

export function buildBrandBiblePatch(
  brand: Brand,
  opts?: {
    watches?: AcceptedWatchHint[];
    character?: Character | null;
    newAcceptedWatchCount?: number;
    forceFrom?: BibleProposeFrom;
  }
): BrandBiblePatch | null {
  const from = opts?.forceFrom || shouldProposeBrandBible(brand, {
    newAcceptedWatchCount: opts?.newAcceptedWatchCount,
  });
  const seedAudience = audienceNeedsSeed(brand);
  const seedTone = toneNeedsSeed(brand);
  if (from === "skip" && !seedAudience && !seedTone) return null;

  const watches = opts?.watches || [];
  const input: ProposeBrandBibleInput = {
    niche: brand.niche,
    archetype: brand.archetype,
    contentFormat: brand.contentFormat || brand.formatSettings?.contentFormat,
    visualGenre: brand.formatSettings?.visualGenre as string | undefined,
    country: brand.country,
    language: brand.language,
    acceptedWatches: watches,
  };

  const settings: Record<string, unknown> = { ...(brand.settings || {}) };
  const patch: BrandBiblePatch = { settings };

  if (from !== "skip") {
    const proposedFrom: BibleProposeFrom = from === "watches" || watches.length >= 2 ? "watches" : "onboard";
    patch.contentPillars = proposeContentPillars({
      ...input,
      acceptedWatches: watches,
    });
    settings.bible_proposed_at = new Date().toISOString();
    settings.bible_proposed_from = proposedFrom;
  }

  if (seedAudience) {
    patch.audience = {
      ...(brand.audience || { primary: "", painPoints: [], desires: [] }),
      primary: proposeAudienceProfile(input),
    };
    settings.bible_audience_proposed_at = new Date().toISOString();
  }

  if (seedTone) {
    patch.tone = proposeToneDefaults(brand.archetype);
    settings.bible_tone_proposed_at = new Date().toISOString();
  }

  patch.settings = settings;
  if (!patch.contentPillars && !patch.audience && !patch.tone) return null;
  return patch;
}

export function mergeBrandBiblePatch(brand: Brand, patch: BrandBiblePatch): Brand {
  return {
    ...brand,
    ...(patch.contentPillars ? { contentPillars: patch.contentPillars } : {}),
    ...(patch.tone ? { tone: patch.tone } : {}),
    audience: patch.audience ? { ...brand.audience, ...patch.audience } : brand.audience,
    settings: { ...(brand.settings || {}), ...(patch.settings || {}) },
  };
}

export type GenesisDirectorCompile = {
  niche?: string;
  audience?: string;
  visualGenre?: VisualGenreSetting;
  contentFormat?: ContentFormat;
  targetDurationSec?: number;
  country?: string;
  language?: string;
};

const COUNTRY_TOKEN: Record<string, string> = {
  ng: "Nigeria",
  nigeria: "Nigeria",
  uk: "United Kingdom",
  gb: "United Kingdom",
  us: "United States",
  usa: "United States",
  ca: "Canada",
  canada: "Canada",
  au: "Australia",
  australia: "Australia",
  in: "India",
  india: "India",
  ke: "Kenya",
  kenya: "Kenya",
  gh: "Ghana",
  ghana: "Ghana",
  za: "South Africa",
};

const LANGUAGE_FOR_COUNTRY: Record<string, string> = {
  Nigeria: "English (NG)",
  "United Kingdom": "English (UK)",
  "United States": "English (US)",
  Australia: "English (AU)",
  India: "English (IN)",
  Canada: "English (US)",
};

const DURATION_SPEECH: Array<[RegExp, number]> = [
  [/\b15\s*(m|min|mins|minutes)\b/i, 900],
  [/\b15\s*(s|sec|secs|seconds)\b|\b15s\b/i, 15],
  [/\b30\s*(m|min|mins|minutes)\b/i, 1800],
  [/\b30\s*(s|sec|secs|seconds)\b|\b30s\b/i, 30],
  [/\b60\s*(s|sec|secs|seconds)\b|\b60s\b/i, 60],
  [/\b1\s*(m|min|mins|minutes)\b|\b1m\b/i, 60],
  [/\b3\s*(m|min|mins|minutes)\b|\b3m\b/i, 180],
  [/\b5\s*(m|min|mins|minutes)\b|\b5m\b/i, 300],
  [/\b10\s*(m|min|mins|minutes)\b|\b10m\b/i, 600],
  [/\b20\s*(m|min|mins|minutes)\b|\b20m\b/i, 1200],
  [/\b45\s*(m|min|mins|minutes)\b|\b45m\b/i, 2700],
  [/\b60\s*(m|min|mins|minutes)\b|\b60m\b|\b1\s*h(our)?s?\b/i, 3600],
];

function parseSpokenDuration(text: string): number | undefined {
  const blob = String(text || "");
  for (const [re, sec] of DURATION_SPEECH) {
    if (re.test(blob) && VIDEO_LENGTH_OPTIONS.some((o) => o.sec === sec)) return sec;
  }
  return undefined;
}

function parseSpokenFormat(text: string): ContentFormat | undefined {
  const blob = String(text || "").toLowerCase();
  if (/\bfaceless\b/.test(blob)) return "faceless";
  if (/\bhost\b|\bon[- ]camera\b/.test(blob)) return "host";
  if (/\bstory\b|\bnarrative\b/.test(blob)) return "story";
  if (/\banime\b|\bmanga\b/.test(blob)) return "anime";
  return undefined;
}

function parseSpokenCountry(text: string): string | undefined {
  const blob = String(text || "");
  const inMatch = blob.match(/\bin\s+([A-Za-z]{2,}|[A-Z]{2})\b/);
  const token = (inMatch?.[1] || "").trim().toLowerCase();
  if (token && COUNTRY_TOKEN[token]) return COUNTRY_TOKEN[token];
  for (const [key, country] of Object.entries(COUNTRY_TOKEN)) {
    if (key.length > 2 && new RegExp(`\\b${key}\\b`, "i").test(blob)) return country;
  }
  return undefined;
}

function parseSpokenTopic(text: string): string | undefined {
  const blob = String(text || "").replace(/\s+/g, " ").trim();
  if (!blob) return undefined;
  const about = blob.match(/\babout\s+(.+)$/i);
  let topic = about?.[1] || "";
  if (!topic) {
    const make = blob.match(/\b(?:make|making)\s+(.+)$/i);
    topic = make?.[1] || "";
  }
  if (!topic) return undefined;
  topic = topic
    .replace(/\bin\s+([A-Za-z]{2}|nigeria|kenya|ghana|india|canada|australia)\b/gi, "")
    .replace(/\b(15|30|60)\s*(s|sec|secs|seconds?|m|min|mins|minutes?)?\b/gi, "")
    .replace(/\b(anime|manga|faceless|host|story|narrative|cinematic|explainers?|shorts?)\b/gi, "")
    .replace(/\b(i make|we make|i want|we want)\b/gi, "")
    .replace(/[,.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (topic.length < 3) return undefined;
  return topic.slice(0, 80);
}

function parseSpokenAudience(text: string): string | undefined {
  const blob = String(text || "").replace(/\s+/g, " ").trim();
  const forMatch = blob.match(/\bfor\s+([^,.]+)/i);
  const who = blob.match(/\b(?:who(?:'s| is)? it for|audience is)\s+([^,.]+)/i);
  const line = (who?.[1] || forMatch?.[1] || "").trim();
  if (line.length < 3) return undefined;
  if (/^(me|us|youtube|tiktok|everyone)$/i.test(line)) return undefined;
  return line.slice(0, 140);
}

/** Map only what the executive said. Never invent a second niche or a prose genre. */
export function compileGenesisDirectorReply(text: string): GenesisDirectorCompile {
  const raw = String(text || "").trim();
  if (!raw) return {};
  const out: GenesisDirectorCompile = {};
  const niche = parseSpokenTopic(raw);
  if (niche) out.niche = niche;
  const audience = parseSpokenAudience(raw);
  if (audience) out.audience = audience;
  const inferred = inferVisualGenreFromText(raw);
  const normalized = normalizeVisualGenre(raw) || (inferred as VisualGenreSetting | undefined);
  if (normalized) out.visualGenre = normalized === "auto" ? "auto" : normalized;
  else if (inferred) out.visualGenre = inferred;
  const format = parseSpokenFormat(raw);
  if (format) out.contentFormat = format;
  const duration = parseSpokenDuration(raw);
  if (typeof duration === "number") out.targetDurationSec = duration;
  const country = parseSpokenCountry(raw);
  if (country) {
    out.country = country;
    const language = LANGUAGE_FOR_COUNTRY[country];
    if (language) out.language = language;
  }
  return out;
}

export function nextDirectorInterviewQuestion(state: {
  niche?: string;
  audience?: string;
  visualGenre?: VisualGenreSetting | string;
  lookChosen?: boolean;
  durationChosen?: boolean;
}): string | null {
  if (!String(state.niche || "").trim()) return "What should this brand make?";
  if (!String(state.audience || "").trim()) return "Who is it for? One line.";
  if (!state.lookChosen && (!state.visualGenre || state.visualGenre === "auto")) {
    return "Look: tap a Visual Genre chip, or name anime / cinematic / documentary.";
  }
  if (!state.durationChosen) return "How long should a typical piece be? Tap a length chip.";
  return null;
}
