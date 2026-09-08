/**
 * Single Storage spine for production media.
 * All generated stills / clips / thumbs / audio live under brands/{brandId}/{productionId}/…
 * so Assets listing (which only recurses brands/{brandId}) can see them.
 */
export function brandProductionStoragePath(
  brandId: string | undefined | null,
  productionId: string,
  sub: string
): string {
  const bId = String(brandId || "").trim() || "default-brand";
  const prodId = String(productionId || "").trim();
  const cleanSub = String(sub || "").replace(/^\/+/, "");
  return `brands/${bId}/${prodId}/${cleanSub}`;
}

/** Prefix used to list/remove every object for one production. */
export function brandProductionStoragePrefix(
  brandId: string | undefined | null,
  productionId: string
): string {
  const bId = String(brandId || "").trim() || "default-brand";
  const prodId = String(productionId || "").trim();
  return `brands/${bId}/${prodId}`;
}
