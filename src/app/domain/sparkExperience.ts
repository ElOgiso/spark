import type { Brand, ContentFormat, Production, PublishJob } from "./types";

/** Purpose is independent of visual genre, destination and production recipe. */
export const SPARK_USE_CASES = [
  {
    id: "influencer",
    label: "Social Influencer",
    description: "A recurring creator and a portrait-video feed",
    format: "host",
    feed: "Posts",
    prompt: "Help me plan my first creator clip",
  },
  {
    id: "short_movies",
    label: "Short Movies",
    description: "Cast, story worlds and standalone short films",
    format: "story",
    feed: "Short films",
    prompt: "Help me develop a short film premise",
  },
  {
    id: "explainer",
    label: "Explainer Videos",
    description: "Sourced videos, topic shelves and optional presenters",
    format: "faceless",
    feed: "Videos",
    prompt: "Research a topic for my first explainer",
  },
  {
    id: "drama",
    label: "Drama Series",
    description: "Series, seasons and ordered episodes",
    format: "story",
    feed: "Episodes",
    prompt: "Help me develop my series and first episode",
  },
  {
    id: "avatar",
    label: "Talking Avatar",
    description: "A presenter, voice and reusable looks",
    format: "host",
    feed: "Presenter clips",
    prompt: "Help me write a script for my presenter",
  },
  {
    id: "films",
    label: "Films",
    description: "Film releases, cast and scene continuity",
    format: "story",
    feed: "Releases",
    prompt: "Help me develop a film treatment",
  },
] as const;
export type SparkUseCase = (typeof SPARK_USE_CASES)[number]["id"];
export function isSparkUseCase(value: unknown): value is SparkUseCase {
  return SPARK_USE_CASES.some((item) => item.id === value);
}
export function inferSparkUseCase(text: string): SparkUseCase | undefined {
  if (/\b(drama|series|episodes?|serial)\b/i.test(text)) return "drama";
  if (/\b(short (movies?|films?))\b/i.test(text)) return "short_movies";
  if (/\b(explainer|explainers|faceless|educational)\b/i.test(text))
    return "explainer";
  if (/\b(avatar|lip[- ]?sync|heygen)\b/i.test(text)) return "avatar";
  if (/\b(films?|movies?|cinema)\b/i.test(text)) return "films";
  if (/\b(influencer|creator|dance tutor|relationship advice)\b/i.test(text))
    return "influencer";
  return undefined;
}
export function resolveSparkUseCase(
  brand: Partial<Brand> | null | undefined,
): SparkUseCase {
  if (isSparkUseCase(brand?.settings?.sparkUseCase))
    return brand.settings.sparkUseCase;
  return (
    inferSparkUseCase(`${brand?.niche || ""} ${brand?.purpose || ""}`) ||
    (brand?.formatSettings?.contentFormat === "faceless" ||
    brand?.contentFormat === "faceless"
      ? "explainer"
      : brand?.contentFormat === "story"
        ? "short_movies"
        : "influencer")
  );
}
export function useCaseDefinition(id: SparkUseCase) {
  return SPARK_USE_CASES.find((item) => item.id === id)!;
}
export function normalizeSocialPlatform(value: string): string {
  const p = value.toLowerCase();
  return p.includes("youtube")
    ? "youtube"
    : /^(x|twitter)/.test(p)
      ? "x"
      : p.includes("tiktok")
        ? "tiktok"
        : p.includes("instagram") || p.includes("reels")
          ? "instagram"
          : p;
}
export function safeExternalUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}
/** Fail closed: a status label alone, upload or export is NOT a public post. */
export function publishedSparkPosts(
  productions: Production[],
  jobs: PublishJob[],
  brandId?: string,
  account?: { channelId: string; platform: string },
) {
  if (!account?.channelId) return [];
  const seen = new Set<string>();
  return jobs
    .flatMap((job) => {
      const production = productions.find((p) => p.id === job.productionId);
      const url = safeExternalUrl(job.postUrl);
      if (
        !production ||
        job.status !== "Published" ||
        !url ||
        !job.platformPostId ||
        job.accountId !== account.channelId ||
        normalizeSocialPlatform(job.platform) !==
          normalizeSocialPlatform(account.platform)
      )
        return [];
      if (brandId && production.brandId && production.brandId !== brandId)
        return [];
      const key = `${job.accountId}:${job.platformPostId}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ production, job, url }];
    })
    .sort(
      (a, b) =>
        Date.parse(b.job.publishedAt || b.job.scheduledTime) -
        Date.parse(a.job.publishedAt || a.job.scheduledTime),
    );
}

export type GenesisTool =
  | "purpose"
  | "identity"
  | "connect"
  | "format"
  | "character"
  | "voice"
  | "preferences"
  | "review";
export const GENESIS_TOOL_FRAMES: Record<GenesisTool, number> = {
  purpose: 8,
  identity: 2,
  connect: 1,
  format: 3,
  character: 4,
  voice: 5,
  preferences: 6,
  review: 7,
};
export function requestedGenesisTool(text: string): GenesisTool | undefined {
  if (/\b(connect|accounts?|tiktok|youtube|instagram)\b/i.test(text))
    return "connect";
  if (/\b(voice|accent|narrator|sound)\b/i.test(text)) return "voice";
  if (/\b(character|cast|outfit|background|location|props?)\b/i.test(text))
    return "character";
  if (/\b(genre|format|duration|length|aspect|look)\b/i.test(text))
    return "format";
  if (/\b(automation|preferences|sources|schedule)\b/i.test(text))
    return "preferences";
  if (/\b(name|audience|niche|purpose)\b/i.test(text)) return "identity";
  if (/\b(review|summary|finish|ready)\b/i.test(text)) return "review";
  return undefined;
}
export function nextGenesisTool(
  data: {
    sparkUseCase?: SparkUseCase;
    brandName: string;
    contentFormat?: ContentFormat;
    characterSheetUrl?: string | null;
  },
  accepted: GenesisTool[],
): GenesisTool {
  if (!data.sparkUseCase) return "purpose";
  if (!data.brandName.trim()) return "identity";
  if (!accepted.includes("connect")) return "connect";
  if (!data.contentFormat || !accepted.includes("format")) return "format";
  if (
    data.contentFormat !== "faceless" &&
    !data.characterSheetUrl &&
    !accepted.includes("character")
  )
    return "character";
  if (!accepted.includes("voice")) return "voice";
  if (!accepted.includes("preferences")) return "preferences";
  return "review";
}
