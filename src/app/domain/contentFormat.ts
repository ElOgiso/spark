export type ProductionContentFormat =
  | "faceless"
  | "host"
  | "story"
  | "ugc"
  | "ads"
  | "explainer";

export const CONTENT_FORMAT_OPTIONS: { id: ProductionContentFormat; label: string; desc: string }[] = [
  { id: "faceless", label: "Faceless", desc: "Voice + pictures, no host required" },
  { id: "host", label: "Host", desc: "One character on camera (default)" },
  { id: "ugc", label: "UGC", desc: "Smartphone realism, walking selfie to set-down" },
  { id: "story", label: "Story", desc: "Multi-scene narrative with continuity" },
  { id: "ads", label: "Ads", desc: "Product / hook / setting / brand kit recipe" },
  { id: "explainer", label: "Explainer", desc: "Taught concept, style-locked stills + VO" },
];

/** Maps legacy look-as-format values (anime) onto a production recipe. */
export function normalizeContentFormat(raw?: string | null): ProductionContentFormat {
  const key = String(raw || "").trim().toLowerCase().replace(/[_-]+/g, " ");
  if (!key) return "host";
  if (key.includes("faceless") || key.includes("slideshow") || key.includes("voiceover")) return "faceless";
  if (key === "ugc" || key.includes("user generated") || key.includes("selfie")) return "ugc";
  if (key === "ads" || key.includes("advert")) return "ads";
  if (key.includes("explain")) return "explainer";
  if (key.includes("anime") || key.includes("manga")) return "story";
  if (key.includes("story") || key.includes("film") || key.includes("narrative")) return "story";
  if (key.includes("host") || key.includes("presenter") || key.includes("creator")) return "host";
  return "host";
}
