/**
 * Location plate durability + set-still reuse helpers.
 * Brand set plates must land in Spark Storage (not ephemeral fal/data URLs)
 * and lock stills: set subjects reuse the plate; host/insert use it as visual lock ref.
 */

function isEphemeralUri(val?: string | null): boolean {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim().toLowerCase();
  return (
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:") ||
    trimmed.includes("vidgen.x.ai") ||
    trimmed.includes("generativelanguage.googleapis.com") ||
    trimmed.includes("oaidalleapiprodscus.blob.core.windows.net") ||
    trimmed.includes("fal.media")
  );
}

function isValidMediaUri(val?: string | null): boolean {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  if (trimmed.includes("pending") || trimmed.includes("failed") || trimmed.includes("error")) {
    return false;
  }
  return (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  );
}

/** True when URI is not already a durable Spark Storage public/sign URL. */
export function needsLocationPlateStorageUpload(imageUri?: string | null): boolean {
  if (!imageUri || typeof imageUri !== "string") return false;
  const trimmed = imageUri.trim();
  if (!trimmed) return false;
  if (trimmed.includes(".supabase.co/storage/v1/object/")) return false;
  if (isEphemeralUri(trimmed)) return true;
  // Remote provider / CDN URLs that are not our bucket — fetch + re-host
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return true;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return true;
  return false;
}

/** Set / establishing / environment shots should use the locked plate as the still itself. */
export function shouldReuseLocationPlateAsStill(params: {
  resolvedSubject?: string | null;
  locationPlateUrl?: string | null;
}): boolean {
  const subject = String(params.resolvedSubject || "").toLowerCase().trim();
  const isSet =
    subject === "set" ||
    subject === "establishing" ||
    subject === "environment" ||
    subject === "location";
  if (!isSet) return false;
  return isValidMediaUri(params.locationPlateUrl);
}

/**
 * Resolve plate URL for a production run: prefer snapshot, then brand.
 * Caller should pass the result through uploadLocationPlateToStorage when needed.
 */
export function resolveLocationPlateUrl(params: {
  snapshotPlateUrl?: string | null;
  brandPlateUrl?: string | null;
  brandSettings?: Record<string, unknown> | null;
}): string | undefined {
  const fromSettings =
    (params.brandSettings?.locationPlateUrl as string | undefined) ||
    (params.brandSettings?.location_plate_url as string | undefined) ||
    undefined;
  const raw =
    params.snapshotPlateUrl ||
    params.brandPlateUrl ||
    fromSettings ||
    undefined;
  if (!raw || typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
