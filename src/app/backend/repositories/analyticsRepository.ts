import type { AnalyticsSnapshotRow } from "../database.types";
import { insertRow, listByBrand } from "./repositoryUtils";
import type { RepositoryResult } from "./repositoryTypes";

export async function listAnalyticsSnapshots(brandId: string): Promise<RepositoryResult<AnalyticsSnapshotRow[]>> {
  return listByBrand("analytics_snapshots", brandId);
}

export async function createAnalyticsSnapshot(
  values: Partial<AnalyticsSnapshotRow>,
): Promise<RepositoryResult<AnalyticsSnapshotRow>> {
  return insertRow("analytics_snapshots", values);
}
