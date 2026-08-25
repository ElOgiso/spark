/**
 * Single shared helper for platform account handles across SPARK.
 * Always produces exactly one leading '@' when non-empty.
 */
export function normalizeHandle(raw: string | null | undefined): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  return "@" + s.replace(/^@+/, "");
}

/**
 * Normalizes platform names to standard lowercase keys.
 */
export function normalizePlatformKey(platform: string): string {
  const p = (platform || "").toLowerCase().trim();
  if (p.includes("youtube") || p.includes("yt") || p === "google") return "youtube";
  if (p.includes("twitter") || p.includes("x.com") || p === "x") return "x";
  if (p.includes("tiktok")) return "tiktok";
  if (p.includes("instagram") || p.includes("ig")) return "instagram";
  if (p.includes("facebook") || p.includes("fb")) return "facebook";
  if (p.includes("linkedin")) return "linkedin";
  return p;
}
