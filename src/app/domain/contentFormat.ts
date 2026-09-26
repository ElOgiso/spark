/**
 * Production format — who is on camera / how the show is built.
 * Not character genre. "Anime" is a look, not a format.
 */

export type ProductionContentFormat = "faceless" | "host" | "story";

export interface ProductionContentFormatOption {
  id: ProductionContentFormat;
  label: string;
  desc: string;
}

export const PRODUCTION_CONTENT_FORMAT_OPTIONS: ProductionContentFormatOption[] = [
  { id: "faceless", label: "Faceless", desc: "Voice + pictures, no host required" },
  { id: "host", label: "Host", desc: "One character on camera (default)" },
  { id: "story", label: "Story", desc: "Multi-scene narrative" },
];

export function normalizeContentFormat(raw?: string | null): ProductionContentFormat {
  const key = String(raw || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!key) return "host";
  if (key.includes("faceless") || key.includes("slideshow") || key.includes("voiceover")) return "faceless";
  if (key.includes("story") || key.includes("film") || key.includes("narrative")) return "story";
  if (key.includes("host") || key.includes("creator") || key.includes("presenter") || key.includes("ugc")) return "host";
  if (key.includes("anime") || key.includes("manga") || key.includes("3d") || key.includes("cartoon")) return "story";
  return "host";
}
