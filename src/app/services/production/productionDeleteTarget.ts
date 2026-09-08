/**
 * Review rows must never be treated as productions.
 * Delete always targets the production UUID (activeProd.id or review.productionId).
 */
export function resolveProductionDeleteTargetId(params: {
  productionId?: string | null;
  reviewProductionId?: string | null;
  reviewId?: string | null;
}): string | null {
  const prod = typeof params.productionId === "string" ? params.productionId.trim() : "";
  if (prod) return prod;
  const fromReview = typeof params.reviewProductionId === "string" ? params.reviewProductionId.trim() : "";
  if (fromReview) return fromReview;
  return null;
}
