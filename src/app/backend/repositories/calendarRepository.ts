import type { PublishJobRow } from "../database.types";
import { insertRow, listByBrand, updateRow } from "./repositoryUtils";
import type { RepositoryResult } from "./repositoryTypes";

export async function listPublishJobs(brandId: string): Promise<RepositoryResult<PublishJobRow[]>> {
  return listByBrand("publish_jobs", brandId);
}

export async function createPublishJob(values: Partial<PublishJobRow>): Promise<RepositoryResult<PublishJobRow>> {
  return insertRow("publish_jobs", values);
}

export async function updatePublishJob(id: string, values: Partial<PublishJobRow>): Promise<RepositoryResult<PublishJobRow>> {
  return updateRow("publish_jobs", id, values);
}

export async function schedulePublishJob(id: string, scheduledFor: string): Promise<RepositoryResult<PublishJobRow>> {
  return updateRow("publish_jobs", id, {
    scheduled_for: scheduledFor,
    status: "scheduled",
  });
}
