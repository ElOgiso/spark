/**
 * Decide whether a production/review persist may write to Supabase.
 * Tombstones always win. Production OFF blocks create + generation fields;
 * status/cancel patches remain allowed on update.
 */
import { ProductionGenerationGuard } from "./ProductionGenerationGuard";
import { isProductionTombstoned } from "./productionTombstone";

export type PersistCreatePlan = "skip_tombstone" | "skip_off" | "full";
export type PersistUpdatePlan = "skip_tombstone" | "status_only" | "full";

export function productionWriteHalted(opts: {
  productionId?: string | null;
  reviewId?: string | null;
  brandId?: string | null;
  signal?: AbortSignal | null;
}): boolean {
  if (opts.signal?.aborted) return true;
  if (opts.productionId && isProductionTombstoned(opts.productionId)) return true;
  if (opts.reviewId && isProductionTombstoned(opts.reviewId)) return true;
  if (!ProductionGenerationGuard.isEnabled(opts.brandId || undefined)) return true;
  return false;
}

export function planProductionCreatePersist(opts: {
  productionId?: string | null;
  brandId?: string | null;
}): PersistCreatePlan {
  if (opts.productionId && isProductionTombstoned(opts.productionId)) return "skip_tombstone";
  if (!ProductionGenerationGuard.isEnabled(opts.brandId || undefined)) return "skip_off";
  return "full";
}

export function planProductionUpdatePersist(opts: {
  productionId?: string | null;
  brandId?: string | null;
}): PersistUpdatePlan {
  if (opts.productionId && isProductionTombstoned(opts.productionId)) return "skip_tombstone";
  if (!ProductionGenerationGuard.isEnabled(opts.brandId || undefined)) return "status_only";
  return "full";
}

export function planReviewCreatePersist(opts: {
  reviewId?: string | null;
  productionId?: string | null;
  brandId?: string | null;
}): PersistCreatePlan {
  if (opts.reviewId && isProductionTombstoned(opts.reviewId)) return "skip_tombstone";
  if (opts.productionId && isProductionTombstoned(opts.productionId)) return "skip_tombstone";
  if (!ProductionGenerationGuard.isEnabled(opts.brandId || undefined)) return "skip_off";
  return "full";
}

export function planReviewUpdatePersist(opts: {
  reviewId?: string | null;
  productionId?: string | null;
  brandId?: string | null;
}): PersistUpdatePlan {
  if (opts.reviewId && isProductionTombstoned(opts.reviewId)) return "skip_tombstone";
  if (opts.productionId && isProductionTombstoned(opts.productionId)) return "skip_tombstone";
  if (!ProductionGenerationGuard.isEnabled(opts.brandId || undefined)) return "status_only";
  return "full";
}

/** Cloud delete is success when the productions row is gone (or was already absent). */
export function productionDeleteCloudSucceeded(rowStillPresent: boolean): boolean {
  return rowStillPresent !== true;
}

const GENERATING_STATUSES = new Set(["Generating", "generating"]);

export function isCancelOrStatusPatch(status?: string | null): boolean {
  if (!status) return false;
  return !GENERATING_STATUSES.has(status);
}
