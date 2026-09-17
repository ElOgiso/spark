export function isEphemeralMediaUrl(val?: string | null): boolean {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim().toLowerCase();
  return (
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:") ||
    trimmed.includes("vidgen.x.ai") ||
    trimmed.includes("generativelanguage.googleapis.com") ||
    trimmed.includes("oaidalleapiprodscus.blob.core.windows.net") ||
    trimmed.includes("fal.media") ||
    trimmed.includes("klingai.com") ||
    trimmed.includes("runwayml.com") ||
    trimmed.includes("lumalabs.ai") ||
    trimmed.includes("ark.cn-beijing") ||
    trimmed.includes("byteimg.com")
  );
}

export function isSparkStorageUrl(val?: string | null): boolean {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  if (extractSparkStoragePath(trimmed)) return true;
  return /\/storage\/v1\/object\/(?:sign|public)\/Spark\//i.test(trimmed);
}

export function extractSparkStoragePath(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const match = url.match(/\/storage\/v1\/object\/(?:sign|public)\/Spark\/([^?#]+)/i);
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return null;
}

export function isPersistableSparkMediaUrl(val?: string | null): boolean {
  if (!val || typeof val !== "string") return false;
  if (isEphemeralMediaUrl(val)) return false;
  return isSparkStorageUrl(val);
}
