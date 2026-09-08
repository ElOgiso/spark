/**
 * Prevents hydrate from replacing in-memory format / credit / AI / production
 * toggle with a stale cloud snapshot after a successful persist.
 */

export function settingsWrittenAtKey(brandId: string): string {
  return `spark_settings_written_at_${brandId}`;
}

export function readSettingsWrittenAt(brandId?: string | null): string | null {
  if (!brandId || typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(settingsWrittenAtKey(brandId));
  } catch {
    return null;
  }
}

export function stampSettingsWrittenAt(brandId: string, iso?: string): string {
  const at = iso || new Date().toISOString();
  if (brandId && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(settingsWrittenAtKey(brandId), at);
    } catch {
      // ignore
    }
  }
  return at;
}

export function isInMemorySettingsNewer(
  inMemoryAt?: string | null,
  snapAt?: string | null
): boolean {
  if (!inMemoryAt) return false;
  const memMs = Date.parse(inMemoryAt);
  if (Number.isNaN(memMs)) return false;
  if (!snapAt) return true;
  const snapMs = Date.parse(snapAt);
  if (Number.isNaN(snapMs)) return true;
  return memMs > snapMs;
}
