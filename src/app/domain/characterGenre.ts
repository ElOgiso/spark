/**
 * Character look catalog — distinct from ContentFormat (who is on camera)
 * and from cinematic tone (noir / horror / comedy).
 *
 * Onboarding GenreCarousel and My Spark Character Studio must use this list.
 */

import type { VisualGenreId } from "./visualGenre";
import { normalizeVisualGenre } from "./visualGenre";

export type CharacterGenreId =
  | "Realistic"
  | "Cinematic"
  | "3D"
  | "Anime"
  | "Cartoon"
  | "Illustration"
  | "Comic"
  | "Clay"
  | "Pixel"
  | "Art";

export interface CharacterGenreOption {
  id: CharacterGenreId;
  label: string;
  desc: string;
  family: "live_action" | "stylized_2d" | "stylized_3d" | "hybrid";
  /** Maps onto production visualGenre for storyboard / video look lock. */
  visualGenreId: VisualGenreId;
  /** Real-pixel moodboard shown the moment the chip is ticked — before a character exists. */
  moodboardUrl: string;
}

export const CHARACTER_GENRE_OPTIONS: CharacterGenreOption[] = [
  {
    id: "Realistic",
    label: "Realistic",
    desc: "Photoreal smartphone / street portrait",
    family: "live_action",
    visualGenreId: "realistic",
    moodboardUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=900&q=85&fit=crop&crop=face",
  },
  {
    id: "Cinematic",
    label: "Cinematic",
    desc: "Photoreal cinema lighting and lens",
    family: "live_action",
    visualGenreId: "cinematic",
    moodboardUrl: "https://images.unsplash.com/photo-1675726205553-4e348f24da2c?w=900&q=85&fit=crop&crop=top",
  },
  {
    id: "3D",
    label: "3D",
    desc: "Real pixel / feature-CGI character",
    family: "stylized_3d",
    visualGenreId: "cartoon_3d",
    moodboardUrl: "https://images.unsplash.com/photo-1741894785509-d87c84bdc275?w=900&q=85&fit=crop",
  },
  {
    id: "Anime",
    label: "Anime",
    desc: "2D anime key art — not photoreal, not CGI",
    family: "stylized_2d",
    visualGenreId: "anime",
    moodboardUrl: "https://images.unsplash.com/photo-1576843789623-ba1d22102973?w=900&q=85&fit=crop",
  },
  {
    id: "Cartoon",
    label: "Cartoon",
    desc: "Bold illustrated character",
    family: "stylized_2d",
    visualGenreId: "comic",
    moodboardUrl: "https://images.unsplash.com/photo-1719198539292-e44add6d15c9?w=900&q=85&fit=crop",
  },
  {
    id: "Illustration",
    label: "Illustration",
    desc: "Colorful editorial figure",
    family: "stylized_2d",
    visualGenreId: "comic",
    moodboardUrl: "https://images.unsplash.com/photo-1667419136229-ce2c6e127a43?w=900&q=85&fit=crop",
  },
  {
    id: "Comic",
    label: "Comic",
    desc: "Pop-art / graphic-novel hero",
    family: "stylized_2d",
    visualGenreId: "comic",
    moodboardUrl: "https://images.unsplash.com/photo-1632837287299-04fcf768d376?w=900&q=85&fit=crop",
  },
  {
    id: "Clay",
    label: "Clay / Stop-motion",
    desc: "Handcrafted clay figure",
    family: "stylized_3d",
    visualGenreId: "stop_motion",
    moodboardUrl: "https://images.unsplash.com/photo-1657260630992-76a75351b0f4?w=900&q=85&fit=crop",
  },
  {
    id: "Pixel",
    label: "Pixel",
    desc: "Retro pixel-art character",
    family: "stylized_2d",
    visualGenreId: "comic",
    moodboardUrl: "https://images.unsplash.com/photo-1780193724876-7ca5083d1004?w=900&q=85&fit=crop",
  },
  {
    id: "Art",
    label: "Art / Painterly",
    desc: "Painterly fine-art portrait",
    family: "hybrid",
    visualGenreId: "cinematic",
    moodboardUrl: "https://images.unsplash.com/photo-1509117947687-5090307f5ee7?w=900&q=85&fit=crop",
  },
];

const BY_ID = new Map(CHARACTER_GENRE_OPTIONS.map((g) => [g.id, g]));

const ALIAS: Record<string, CharacterGenreId> = {
  realistic: "Realistic",
  photoreal: "Realistic",
  photorealistic: "Realistic",
  natural: "Realistic",
  naturalistic: "Realistic",
  human: "Realistic",
  cinematic: "Cinematic",
  cinema: "Cinematic",
  filmic: "Cinematic",
  "3d": "3D",
  "3d cartoon": "3D",
  cartoon_3d: "3D",
  cgi: "3D",
  pixar: "3D",
  pixel_3d: "3D",
  anime: "Anime",
  manga: "Anime",
  cartoon: "Cartoon",
  illustration: "Illustration",
  illustrated: "Illustration",
  comic: "Comic",
  comics: "Comic",
  "graphic novel": "Comic",
  clay: "Clay",
  "stop motion": "Clay",
  stop_motion: "Clay",
  claymation: "Clay",
  pixel: "Pixel",
  "pixel art": "Pixel",
  art: "Art",
  painterly: "Art",
  painting: "Art",
};

export function characterGenreOption(id?: string | null): CharacterGenreOption {
  const normalized = normalizeCharacterGenre(id);
  return BY_ID.get(normalized) || CHARACTER_GENRE_OPTIONS[0];
}

export function normalizeCharacterGenre(raw?: string | null): CharacterGenreId {
  if (!raw) return "Realistic";
  const trimmed = String(raw).trim();
  if (BY_ID.has(trimmed as CharacterGenreId)) return trimmed as CharacterGenreId;
  const key = trimmed.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (ALIAS[key]) return ALIAS[key];
  const compact = key.replace(/\s+/g, "_");
  if (ALIAS[compact]) return ALIAS[compact];
  const asVisual = normalizeVisualGenre(trimmed);
  if (asVisual === "realistic") return "Realistic";
  if (asVisual === "cinematic") return "Cinematic";
  if (asVisual === "cartoon_3d") return "3D";
  if (asVisual === "anime") return "Anime";
  if (asVisual === "comic") return "Comic";
  if (asVisual === "stop_motion") return "Clay";
  return "Realistic";
}

export function visualGenreFromCharacterGenre(raw?: string | null): VisualGenreId {
  return characterGenreOption(raw).visualGenreId;
}

export function characterGenreMoodboardUrl(raw?: string | null): string {
  return characterGenreOption(raw).moodboardUrl;
}
