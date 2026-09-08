/**
 * Durable Spark i2v clip identity: brands/{brandId}/{productionId}/video/shot-N.mp4
 * Approve & merge concatenates these only — never a Canvas/MediaRecorder stand-in.
 */

const SPARK_SHOT_RE = /\/video\/shot-(\d+)\.mp4/i;
const SPARK_OBJECT_RE = /\/storage\/v1\/object\/(?:sign|public)\/Spark\//i;

export function sparkShotIndexFromUrl(url?: string | null): number | null {
  if (!url || typeof url !== "string") return null;
  const m = url.match(SPARK_SHOT_RE);
  if (!m) return null;
  const idx = Number(m[1]);
  return Number.isFinite(idx) ? idx : null;
}

export function isSparkShotClipUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (trimmed.length < 8) return false;
  if (!SPARK_OBJECT_RE.test(trimmed) && !/\/brands\/[^/]+\/[^/]+\/video\/shot-\d+\.mp4/i.test(trimmed)) {
    return false;
  }
  return sparkShotIndexFromUrl(trimmed) != null;
}

/** Numeric order. Skip missing / non-shot URLs. */
export function collectSparkShotClipUrls(urls: Array<string | null | undefined>): string[] {
  const byIndex = new Map<number, string>();
  for (const raw of urls) {
    if (!raw || typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!isSparkShotClipUrl(trimmed)) continue;
    const idx = sparkShotIndexFromUrl(trimmed);
    if (idx == null || byIndex.has(idx)) continue;
    byIndex.set(idx, trimmed);
  }
  return [...byIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, url]) => url);
}
