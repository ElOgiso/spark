import type { ReviewItemRow } from "../database.types";
import { insertRow, listByBrand, updateRow } from "./repositoryUtils";
import type { RepositoryResult } from "./repositoryTypes";

export async function listReviewItems(brandId: string): Promise<RepositoryResult<ReviewItemRow[]>> {
  return listByBrand("review_items", brandId);
}

export async function createReviewItem(values: Partial<ReviewItemRow>): Promise<RepositoryResult<ReviewItemRow>> {
  return insertRow("review_items", values);
}

export async function updateReviewItem(id: string, values: Partial<ReviewItemRow>): Promise<RepositoryResult<ReviewItemRow>> {
  return updateRow("review_items", id, values);
}

export async function approveReviewItem(id: string): Promise<RepositoryResult<ReviewItemRow>> {
  return updateRow("review_items", id, {
    status: "approved",
    decision: "approved",
    reviewed_at: new Date().toISOString(),
  });
}

export async function requestReviewEdits(id: string, notes?: string): Promise<RepositoryResult<ReviewItemRow>> {
  return updateRow("review_items", id, {
    status: "needs_edit",
    decision: "needs_edit",
    notes,
    reviewed_at: new Date().toISOString(),
  });
}
