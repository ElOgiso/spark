/**
 * Visual genre (look tradition) — lives under format settings, distinct from
 * contentFormat (who is on camera) and Spec creative.genre (idea classifier).
 *
 * Cinematic craft (coverage, motivated camera) can overlay ANY visual genre.
 * Visual genre decides medium / lighting / VFX grammar.
 */

export type VisualGenreId =
  | "cinematic"
  | "realistic"
  | "anime"
  | "donghua_wuxia"
  | "cartoon_3d"
  | "documentary"
  | "horror"
  | "noir"
  | "cyberpunk"
  | "music_video"
  | "commercial"
  | "western"
  | "stop_motion"
  | "comic";

export type VisualGenreSetting = VisualGenreId | "auto";

export interface VisualGenreOption {
  id: VisualGenreId;
  label: string;
  desc: string;
  /** Skill catalog id that owns this look. */
  skillId: string;
  family: "live_action" | "stylized_2d" | "stylized_3d" | "hybrid";
}

export const VISUAL_GENRE_OPTIONS: VisualGenreOption[] = [
  {
    id: "cinematic",
    label: "Cinematic",
    desc: "Photoreal live-action cinema — theatrical light, motivated camera",
    skillId: "genre-director-cinematic",
    family: "live_action",
  },
  {
    id: "realistic",
    label: "Realistic",
    desc: "Naturalistic live-action — observed light, documentary-adjacent",
    skillId: "genre-director-realistic",
    family: "live_action",
  },
  {
    id: "anime",
    label: "Anime",
    desc: "Modern 2D anime cinematography — not photoreal, not generic anime",
    skillId: "genre-director-anime",
    family: "stylized_2d",
  },
  {
    id: "donghua_wuxia",
    label: "Wuxia / Donghua",
    desc: "Chinese wuxia / xianxia / donghua — painterly, theatrical, qi VFX",
    skillId: "genre-director-donghua-wuxia",
    family: "stylized_2d",
  },
  {
    id: "cartoon_3d",
    label: "3D Cartoon",
    desc: "Feature CGI — Pixar / WDAS / myth-CGI grammar, not mobile-game plastic",
    skillId: "genre-director-cartoon-3d",
    family: "stylized_3d",
  },
  {
    id: "documentary",
    label: "Documentary",
    desc: "Observational / interview / archive grammar, motivated handheld",
    skillId: "genre-director-documentary",
    family: "live_action",
  },
  {
    id: "horror",
    label: "Horror",
    desc: "Dread lighting, withheld geography, chiaroscuro, off-screen threat",
    skillId: "genre-director-horror",
    family: "live_action",
  },
  {
    id: "noir",
    label: "Noir",
    desc: "Hard light, venetian shadow, wet streets, moral chiaroscuro",
    skillId: "genre-director-noir",
    family: "live_action",
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk",
    desc: "Neon practicals, rain, signage-as-light, dense urban night",
    skillId: "genre-director-cyberpunk",
    family: "hybrid",
  },
  {
    id: "music_video",
    label: "Music Video",
    desc: "Rhythm-cut imagery, graphic lighting, performance-as-spectacle",
    skillId: "genre-director-music-video",
    family: "hybrid",
  },
  {
    id: "commercial",
    label: "Commercial",
    desc: "Premium product cinema — hero object, clean grade, luxury light",
    skillId: "genre-director-commercial",
    family: "live_action",
  },
  {
    id: "western",
    label: "Western",
    desc: "Landscape scale, hard sun, dust, horizon composition",
    skillId: "genre-director-western",
    family: "live_action",
  },
  {
    id: "stop_motion",
    label: "Stop Motion",
    desc: "Tactile miniature craft — visible materials, stepped motion feel",
    skillId: "genre-director-stop-motion",
    family: "stylized_3d",
  },
  {
    id: "comic",
    label: "Comic / Graphic Novel",
    desc: "Inked sequential art — panels, silhouette, graphic color, not photoreal",
    skillId: "genre-director-comic",
    family: "stylized_2d",
  },
];

export const PRIMARY_VISUAL_GENRE_IDS: VisualGenreId[] = [
  "cinematic",
  "realistic",
  "anime",
  "donghua_wuxia",
  "cartoon_3d",
];

const OPTION_BY_ID = new Map(VISUAL_GENRE_OPTIONS.map((o) => [o.id, o]));

const ALIAS: Record<string, VisualGenreId> = {
  auto: "cinematic",
  cinematic: "cinematic",
  cinema: "cinematic",
  filmic: "cinematic",
  photoreal: "cinematic",
  photorealistic: "cinematic",
  live_action: "cinematic",
  liveaction: "cinematic",
  realistic: "realistic",
  natural: "realistic",
  naturalistic: "realistic",
  anime: "anime",
  manga: "anime",
  "2d": "anime",
  donghua_wuxia: "donghua_wuxia",
  donghua: "donghua_wuxia",
  wuxia: "donghua_wuxia",
  xianxia: "donghua_wuxia",
  xuanhuan: "donghua_wuxia",
  cultivation: "donghua_wuxia",
  cartoon_3d: "cartoon_3d",
  cartoon: "cartoon_3d",
  "3d": "cartoon_3d",
  pixar: "cartoon_3d",
  disney: "cartoon_3d",
  cgi: "cartoon_3d",
  animated: "cartoon_3d",
  documentary: "documentary",
  doc: "documentary",
  horror: "horror",
  noir: "noir",
  cyberpunk: "cyberpunk",
  neon: "cyberpunk",
  music_video: "music_video",
  mv: "music_video",
  commercial: "commercial",
  ad: "commercial",
  advertisement: "commercial",
  western: "western",
  stop_motion: "stop_motion",
  stopmotion: "stop_motion",
  comic: "comic",
  comics: "comic",
  comic_book: "comic",
  graphic_novel: "comic",
  sequential_art: "comic",
  ghibli: "anime",
  shonen: "anime",
  seinen: "anime",
};

export function visualGenreOption(id: VisualGenreId): VisualGenreOption {
  return OPTION_BY_ID.get(id) || VISUAL_GENRE_OPTIONS[0];
}

export function normalizeVisualGenre(raw?: string | null): VisualGenreId | "auto" | undefined {
  if (raw == null) return undefined;
  const key = String(raw).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!key) return undefined;
  if (key === "auto") return "auto";
  return ALIAS[key];
}

export function isVisualGenreId(value: unknown): value is VisualGenreId {
  return typeof value === "string" && OPTION_BY_ID.has(value as VisualGenreId);
}

/** Default look from show format when user has not picked a genre. */
export function defaultVisualGenreForContentFormat(contentFormat?: string | null): VisualGenreId {
  const f = String(contentFormat || "").toLowerCase();
  if (f.includes("anime") || f.includes("manga")) return "anime";
  if (f.includes("faceless")) return "cinematic";
  return "cinematic";
}

const INFER_RULES: Array<{ genre: VisualGenreId; words: RegExp }> = [
  {
    genre: "donghua_wuxia",
    words:
      /\bwuxia\b|\bxianxia\b|\bxuanhuan\b|\bdonghua\b|\bcultivation\b|\bjianghu\b|\bsect\b|\bimmortal\b|\brenegade immortal\b|\bmortal'?s journey\b|\bbattle through the heavens\b|\bsoul land\b|\bthrone of seal\b|\bswallowed star\b|\bfanren\b|\bxian ni\b/i,
  },
  {
    genre: "anime",
    words:
      /\banime\b|\bmanga\b|\bshonen\b|\bseinen\b|\bcel[- ]?shad|\bghibli\b|\bgod of high school\b|\btokyo ghoul\b|\bclassroom of the elite\b|\bjujutsu kaisen\b|\bchainsaw man\b|\battack on titan\b/i,
  },
  {
    genre: "cartoon_3d",
    words:
      /\bpixar\b|\bdisney cgi\b|\b3d cartoon\b|\banimated feature\b|\bne zha\b|\bnew gods\b|\bincredibles\b|\bfrozen\b|\bmoana\b|\blight chaser\b/i,
  },
  { genre: "comic", words: /\bgraphic novel\b|\bcomic book\b|\bsequential art\b|\bben[- ]day\b/i },
  { genre: "documentary", words: /\bdocumentary\b|\btrue story\b|\barchive footage\b|\bobservational\b/i },
  { genre: "horror", words: /\bhorror\b|\bdread\b|\bbody[- ]horror\b/i },
  { genre: "noir", words: /\bnoir\b|\bfemme fatale\b|\brain[- ]slicked\b/i },
  { genre: "cyberpunk", words: /\bcyberpunk\b|\bneon night\b|\bblade runner\b/i },
  { genre: "music_video", words: /\bmusic video\b|\blyric video\b|\bperformance video\b/i },
  { genre: "commercial", words: /\bcommercial\b|\bproduct film\b|\bluxury ad\b|\bbrand film\b/i },
  { genre: "western", words: /\bwestern\b|\bdust town\b|\bfrontier\b|\bcowboy\b/i },
  { genre: "stop_motion", words: /\bstop[- ]motion\b|\bpuppet animation\b|\bclaymation\b/i },
  { genre: "realistic", words: /\bnaturalistic\b|\bhandheld doc\b|\bobserved light\b|\bphotoreal documentary\b/i },
  { genre: "cinematic", words: /\bcinematic\b|\bfilmic\b|\blive[- ]action cinema\b/i },
];

export function inferVisualGenreFromText(text?: string | null): VisualGenreId | undefined {
  const blob = String(text || "").trim();
  if (!blob) return undefined;
  for (const rule of INFER_RULES) {
    if (rule.words.test(blob)) return rule.genre;
  }
  return undefined;
}

export function mapSpecCreativeGenreToVisualGenre(specGenre?: string | null): VisualGenreId | undefined {
  const g = String(specGenre || "").toLowerCase();
  if (!g) return undefined;
  if (g === "anime") return "anime";
  if (g === "animation") return "cartoon_3d";
  if (g === "documentary" || g === "news_explainer") return "documentary";
  if (g === "music_video") return "music_video";
  if (g === "advertisement" || g === "product_demo") return "commercial";
  if (g === "travel" || g === "sports") return "cinematic";
  if (g === "comedy") return "cinematic";
  if (g === "narrative_film") return "cinematic";
  return undefined;
}

/**
 * Authority order: explicit user pick → snapshot → idea/spec inference → format default.
 * "auto" is not a look — it resolves once at production lock time.
 */
export function resolveVisualGenre(params: {
  explicit?: string | null;
  contentFormat?: string | null;
  ideaText?: string | null;
  specGenre?: string | null;
  visualDirection?: string | null;
}): VisualGenreId {
  const explicit = normalizeVisualGenre(params.explicit);
  if (explicit && explicit !== "auto" && isVisualGenreId(explicit)) return explicit;

  const inferred =
    inferVisualGenreFromText(
      [params.ideaText, params.visualDirection, params.specGenre].filter(Boolean).join("\n")
    ) || mapSpecCreativeGenreToVisualGenre(params.specGenre);

  if (inferred) return inferred;
  return defaultVisualGenreForContentFormat(params.contentFormat);
}

export function visualGenreTag(id: VisualGenreId): string {
  return `visual_genre_${id}`;
}

/** Skill applicability tags for the selected look (+ cinematic overlay). */
export function visualGenreSkillTags(params: {
  visualGenre: VisualGenreId;
  cinematicCraft?: boolean;
}): string[] {
  const tags = [visualGenreTag(params.visualGenre), "visual_genre"];
  if (params.cinematicCraft !== false) tags.push("cinematic_craft");
  return tags;
}

export function isPhotorealVisualGenre(id: VisualGenreId): boolean {
  const family = visualGenreOption(id).family;
  // Hybrid (cyberpunk / music video) still wants live-action materials unless a stylized genre is locked.
  return family === "live_action" || family === "hybrid";
}

/** Medium lock for stills / identity packs — never 8K photoreal on stylized looks. */
export function stillMediumLockLine(id: VisualGenreId): string {
  switch (id) {
    case "anime":
      return " Anime medium lock: cel shading / anime line art — not photoreal live-action.";
    case "donghua_wuxia":
      return " Donghua medium lock: painterly / cel-adjacent theatrical light — not photoreal, not Ne Zha blockbuster CGI.";
    case "cartoon_3d":
      return " Feature-CGI medium lock: stylized 3D cartoon — not photoreal live-action, not 2D anime.";
    case "stop_motion":
      return " Stop-motion medium lock: tactile miniature materials, stepped motion feel.";
    case "comic":
      return " Graphic-novel medium lock: inked sequential art — not photoreal.";
    default:
      return "";
  }
}

/** Optical / physics line for I2V envelopes. Cinematic craft may still overlay camera language. */
export function opticalDisciplineForVisualGenre(id: VisualGenreId): string {
  switch (id) {
    case "anime":
      return "OPTICAL: 2D anime/cel medium. Graphic motion blur and impact holds. Not photoreal skin. Zero extra limbs.";
    case "donghua_wuxia":
      return "OPTICAL: painterly donghua. Theatrical color-coded light, named VFX family. Not 8K photoreal, not Ne Zha CGI. Zero extra limbs.";
    case "cartoon_3d":
      return "OPTICAL: stylized feature CGI. Color-script contrast; magic as a light source. Not live-action photoreal. Zero extra limbs.";
    case "stop_motion":
      return "OPTICAL: tactile miniature / stop-motion. Stepped handmade motion — not smooth photoreal CGI.";
    case "comic":
      return "OPTICAL: inked graphic-novel stills in motion. Flat/halftone color. Not photoreal.";
    default:
      return "OPTICAL: photoreal live-action materials, coherent grade, natural depth of field, zero extra limbs. Do not restyle into anime, donghua, or cartoon CGI unless that visualGenre is locked.";
  }
}
