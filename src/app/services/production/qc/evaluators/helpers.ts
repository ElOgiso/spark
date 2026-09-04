/**
 * Shared comparison helpers for planned vs observed QC dimensions.
 */

export function normalizeText(value: string | undefined | null): string {
  return (value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function tokens(value: string | undefined | null): Set<string> {
  return new Set(
    normalizeText(value)
      .split(" ")
      .filter((t) => t.length > 2)
  );
}

/** Soft overlap — not exact string equality */
export function semanticOverlap(expected: string | undefined, observed: string | undefined): number {
  const a = tokens(expected);
  const b = tokens(observed);
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit += 1;
  return hit / a.size;
}

export function includesAny(haystack: string | undefined, needles: string[]): boolean {
  const h = normalizeText(haystack);
  return needles.some((n) => h.includes(normalizeText(n)));
}

export function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Map shot type vocabulary to comparable buckets */
export function shotSizeBucket(value: string | undefined): string {
  const v = normalizeText(value);
  if (!v) return "";
  if (/extreme.?close|ecu|macro/.test(v)) return "ecu";
  if (/close/.test(v)) return "close";
  if (/medium|mcu|ms\b|two.?shot|over.?the.?shoulder|ots/.test(v)) return "medium";
  if (/wide|establishing|full|long|aerial/.test(v)) return "wide";
  if (/insert|detail/.test(v)) return "insert";
  return v;
}

export function cameraMoveBucket(value: string | undefined): string {
  const v = normalizeText(value);
  if (!v || v === "none" || v === "static") return "static";
  if (/push|dolly.?in|track.?in/.test(v)) return "push_in";
  if (/pull|dolly.?out|track.?out/.test(v)) return "pull_out";
  if (/pan|whip/.test(v)) return "pan";
  if (/tilt/.test(v)) return "tilt";
  if (/orbit|crane|handheld|tracking|dolly/.test(v)) return "moving";
  return v;
}
