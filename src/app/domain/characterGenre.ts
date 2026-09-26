/**
 * Character visual genre — how the person LOOKS (medium / pixels).
 * Distinct from ContentFormat (how the video is produced) and from
 * cinematic tone (noir / horror / comedy), which never live on the character picker.
 *
 * Identity (face, hair, clothing) is NEVER stored here.
 */

import {
  normalizeVisualGenre,
  type VisualGenreId,
  type VisualGenreOption,
} from "./visualGenre";

export type CharacterGenreId =
  | "realistic"
  | "cinematic"
  | "pixel_3d"
  | "anime"
  | "cartoon"
  | "illustration"
  | "comic"
  | "painterly"
  | "clay";

export type CharacterGenreFamily = "live_action" | "stylized_2d" | "stylized_3d";

export interface CharacterGenreOption {
  id: CharacterGenreId;
  label: string;
  family: CharacterGenreFamily;
  desc: string;
  primary: boolean;
  /** Existing production VisualGenreId this picker id compiles to. */
  visualGenreId: VisualGenreId;
  mediumLockLine: string;
  doNot: string;
  /** STYLE / MEDIUM refs only. Never identity. Empty until library pixels are attached. */
  referenceImages: string[];
}

export const CHARACTER_GENRE_OPTIONS: CharacterGenreOption[] = [
  {
    id: "realistic",
    label: "Realistic",
    family: "live_action",
    desc: "Real photoreal street / smartphone portrait pixels. Not beauty-filter. Not CGI.",
    primary: true,
    visualGenreId: "realistic",
    mediumLockLine:
      "MEDIUM LOCK: Photoreal live-action smartphone photography. Visible pores, natural cloth, observed daylight. Not beauty-filter, not CGI, not 2D anime.",
    doNot: "not CGI, not 2D anime, not beauty-filter, not plastic skin",
    referenceImages: [],
  },
  {
    id: "cinematic",
    label: "Cinematic",
    family: "live_action",
    desc: "Real cinema-still pixels — production lighting, lens, skin texture.",
    primary: true,
    visualGenreId: "cinematic",
    mediumLockLine:
      "MEDIUM LOCK: Photoreal cinema still. Production lighting, cinema lens language, physically plausible materials. Not smartphone UGC, not CGI, not 2D anime.",
    doNot: "not smartphone UGC grade, not CGI, not 2D anime",
    referenceImages: [],
  },
  {
    id: "pixel_3d",
    label: "3D",
    family: "stylized_3d",
    desc: "Real feature-CGI / pixel-3D stills. Not mobile-game plastic. Not 2D anime linework.",
    primary: true,
    visualGenreId: "cartoon_3d",
    mediumLockLine:
      "MEDIUM LOCK: Feature-CGI / pixel-3D character. Coherent materials, subsurface, studio key. Not photoreal live-action, not 2D anime linework, not mobile-game plastic.",
    doNot: "not photoreal live-action, not 2D anime, not mobile-game plastic",
    referenceImages: [],
  },
  {
    id: "anime",
    label: "Anime",
    family: "stylized_2d",
    desc: "Real 2D anime character pixels. Cel / line. Not photoreal. Not 3D.",
    primary: true,
    visualGenreId: "anime",
    mediumLockLine:
      "MEDIUM LOCK: 2D anime character construction — consistent line weight, anime proportions, cel color flats. Not photoreal skin, not live-action photography, not 3D CGI.",
    doNot: "not photoreal, not live-action, not 3D CGI",
    referenceImages: [],
  },
  {
    id: "cartoon",
    label: "Cartoon",
    family: "stylized_2d",
    desc: "Stylized 2D cartoon, broad shapes, readable silhouette.",
    primary: true,
    visualGenreId: "comic",
    mediumLockLine:
      "MEDIUM LOCK: Stylized 2D cartoon. Broad readable shapes, graphic color, clean silhouette. Not photoreal, not 3D CGI, not anime cel unless Anime is selected.",
    doNot: "not photoreal, not 3D CGI",
    referenceImages: [],
  },
  {
    id: "illustration",
    label: "Illustration",
    family: "stylized_2d",
    desc: "Editorial / book illustration — painted or inked, not a photograph.",
    primary: false,
    visualGenreId: "comic",
    mediumLockLine:
      "MEDIUM LOCK: Illustration medium. Drawn or painted figure, not a photograph, not 3D render.",
    doNot: "not photoreal photograph, not 3D render",
    referenceImages: [],
  },
  {
    id: "comic",
    label: "Comic",
    family: "stylized_2d",
    desc: "Inked sequential-art character. Graphic color. Not photoreal.",
    primary: false,
    visualGenreId: "comic",
    mediumLockLine:
      "MEDIUM LOCK: Graphic-novel / comic character. Inked line, graphic color. Not photoreal.",
    doNot: "not photoreal",
    referenceImages: [],
  },
  {
    id: "painterly",
    label: "Painterly",
    family: "stylized_2d",
    desc: "Visible pigment and brush — theatrical, not a photograph.",
    primary: false,
    visualGenreId: "donghua_wuxia",
    mediumLockLine:
      "MEDIUM LOCK: Painterly figure. Visible pigment, theatrical light. Not photoreal, not 3D CGI.",
    doNot: "not photoreal, not 3D CGI",
    referenceImages: [],
  },
  {
    id: "clay",
    label: "Clay / Stop Motion",
    family: "stylized_3d",
    desc: "Tactile miniature / clay craft. Visible materials.",
    primary: false,
    visualGenreId: "stop_motion",
    mediumLockLine:
      "MEDIUM LOCK: Stop-motion / clay miniature. Tactile materials, handmade surface. Not smooth photoreal CGI, not 2D anime.",
    doNot: "not photoreal live-action, not 2D anime, not feature CGI plastic",
    referenceImages: [],
  },
];

export const PRIMARY_CHARACTER_GENRE_IDS: CharacterGenreId[] = CHARACTER_GENRE_OPTIONS.filter(
  (o) => o.primary,
).map((o) => o.id);

const OPTION_BY_ID = new Map(CHARACTER_GENRE_OPTIONS.map((o) => [o.id, o]));

const ALIAS: Record<string, CharacterGenreId> = {
  realistic: "realistic",
  natural: "realistic",
  naturalistic: "realistic",
  photoreal: "realistic",
  photorealistic: "realistic",
  live_action: "realistic",
  liveaction: "realistic",
  cinematic: "cinematic",
  cinema: "cinematic",
  filmic: "cinematic",
  pixel_3d: "pixel_3d",
  cartoon_3d: "pixel_3d",
  "3d": "pixel_3d",
  "3d_cartoon": "pixel_3d",
  cgi: "pixel_3d",
  pixar: "pixel_3d",
  disney: "pixel_3d",
  animated: "pixel_3d",
  feature_cgi: "pixel_3d",
  anime: "anime",
  manga: "anime",
  "2d": "anime",
  ghibli: "anime",
  shonen: "anime",
  seinen: "anime",
  cartoon: "cartoon",
  illustration: "illustration",
  illustrated: "illustration",
  comic: "comic",
  comics: "comic",
  comic_book: "comic",
  graphic_novel: "comic",
  painterly: "painterly",
  painted: "painterly",
  donghua: "painterly",
  wuxia: "painterly",
  clay: "clay",
  stop_motion: "clay",
  stopmotion: "clay",
  claymation: "clay",
};

export function characterGenreOption(id: CharacterGenreId): CharacterGenreOption {
  return OPTION_BY_ID.get(id) || CHARACTER_GENRE_OPTIONS[0];
}

export function isCharacterGenreId(value: unknown): value is CharacterGenreId {
  return typeof value === "string" && OPTION_BY_ID.has(value as CharacterGenreId);
}

export function normalizeCharacterGenre(raw?: string | null): CharacterGenreId | undefined {
  if (raw == null) return undefined;
  const key = String(raw).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!key) return undefined;
  if (ALIAS[key]) return ALIAS[key];
  const visual = normalizeVisualGenre(raw);
  if (visual && visual !== "auto") {
    if (visual === "cartoon_3d") return "pixel_3d";
    if (visual === "realistic") return "realistic";
    if (visual === "cinematic") return "cinematic";
    if (visual === "anime") return "anime";
    if (visual === "comic") return "comic";
    if (visual === "stop_motion") return "clay";
    if (visual === "donghua_wuxia") return "painterly";
  }
  return undefined;
}

export function characterGenreToVisualGenre(id: CharacterGenreId): VisualGenreId {
  return characterGenreOption(id).visualGenreId;
}

export function visualGenreToCharacterGenre(id?: VisualGenreId | string | null): CharacterGenreId {
  return normalizeCharacterGenre(id) || "realistic";
}

export function characterGenreAsVisualOption(id: CharacterGenreId): VisualGenreOption {
  const opt = characterGenreOption(id);
  return {
    id: opt.visualGenreId,
    label: opt.label,
    desc: opt.desc,
    skillId: `genre-director-${opt.visualGenreId.replace(/_/g, "-")}`,
    family: opt.family === "stylized_3d" ? "stylized_3d" : opt.family === "stylized_2d" ? "stylized_2d" : "live_action",
  };
}
