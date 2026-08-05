import { deleteRow, insertRow, listByBrand, updateRow } from "./repositoryUtils";
import type { RepositoryResult } from "./repositoryTypes";
import type { ResearchSource, ResearchPattern } from "../../domain/types";
import type { ResearchSourceRow, ResearchPatternRow } from "../database.types";

function sourceRowToDomain(row: ResearchSourceRow): ResearchSource {
  return {
    id: row.id,
    platform: (row.platform || "youtube") as any,
    platformAccountId: row.platform_account_id || undefined,
    url: row.url,
    username: row.username,
    displayName: row.display_name,
    avatar: row.avatar || undefined,
    followers: row.followers ?? null,
    metricsAvailability: (row.followers_status || "unavailable") as any,
    verified: Boolean(row.verified),
    description: row.description || undefined,
    status: (row.status || "active") as any,
    lastSyncedAt: row.last_synced_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at || undefined,
  };
}

function patternRowToDomain(row: ResearchPatternRow): ResearchPattern {
  return {
    id: row.id,
    sourceId: row.source_id,
    patternType: row.pattern_type as any,
    confidence: row.confidence ?? 0.8,
    originWeight: row.origin_weight ?? 0.8,
    title: row.title,
    description: row.description,
    evidence: row.evidence || "",
    metrics: (row.metrics && typeof row.metrics === "object" ? row.metrics : undefined) as any,
    createdAt: row.created_at,
  };
}

export async function listResearchSources(brandId: string): Promise<RepositoryResult<ResearchSource[]>> {
  const res = await listByBrand("research_sources", brandId);
  return {
    data: res.data ? res.data.map(sourceRowToDomain) : null,
    error: res.error,
    source: res.source,
  };
}

export async function createResearchSource(values: Partial<ResearchSource> & { brand_id?: string }): Promise<RepositoryResult<ResearchSource>> {
  const rowInsert: Partial<ResearchSourceRow> = {
    id: values.id,
    brand_id: values.brand_id,
    platform: values.platform,
    url: values.url,
    username: values.username,
    display_name: values.displayName,
    avatar: values.avatar || null,
    followers: typeof values.followers === "number" ? values.followers : null,
    followers_status: values.metricsAvailability || null,
    verified: values.verified || false,
    description: values.description || null,
    status: values.status || "active",
    last_synced_at: values.lastSyncedAt || null,
  };
  const res = await insertRow("research_sources", rowInsert as any);
  return {
    data: res.data ? sourceRowToDomain(res.data) : null,
    error: res.error,
    source: res.source,
  };
}

export async function updateResearchSource(id: string, values: Partial<ResearchSource>): Promise<RepositoryResult<ResearchSource>> {
  const rowUpdate: Partial<ResearchSourceRow> = {};
  if (values.status) rowUpdate.status = values.status;
  if (values.lastSyncedAt) rowUpdate.last_synced_at = values.lastSyncedAt;
  if (values.updatedAt) rowUpdate.updated_at = values.updatedAt;
  const res = await updateRow("research_sources", id, rowUpdate as any);
  return {
    data: res.data ? sourceRowToDomain(res.data) : null,
    error: res.error,
    source: res.source,
  };
}

export async function deleteResearchSource(id: string): Promise<RepositoryResult<true>> {
  return deleteRow("research_sources", id);
}

export async function listResearchPatterns(brandId: string): Promise<RepositoryResult<ResearchPattern[]>> {
  const res = await listByBrand("research_patterns", brandId);
  return {
    data: res.data ? res.data.map(patternRowToDomain) : null,
    error: res.error,
    source: res.source,
  };
}

export async function createResearchPattern(values: Partial<ResearchPattern> & { brand_id?: string }): Promise<RepositoryResult<ResearchPattern>> {
  const rowInsert: Partial<ResearchPatternRow> = {
    id: values.id,
    brand_id: values.brand_id,
    source_id: values.sourceId,
    pattern_type: values.patternType,
    confidence: values.confidence,
    origin_weight: values.originWeight,
    title: values.title,
    description: values.description,
    evidence: values.evidence || null,
    metrics: values.metrics as any,
  };
  const res = await insertRow("research_patterns", rowInsert as any);
  return {
    data: res.data ? patternRowToDomain(res.data) : null,
    error: res.error,
    source: res.source,
  };
}

export const researchSourceRepository = {
  async listSources(brandId: string): Promise<ResearchSource[]> {
    const res = await listResearchSources(brandId);
    return res.data || [];
  },
  async addSource(values: Partial<ResearchSource> & { brand_id?: string }): Promise<ResearchSource | null> {
    const res = await createResearchSource(values);
    return res.data || null;
  },
  async updateSource(id: string, values: Partial<ResearchSource>): Promise<ResearchSource | null> {
    const res = await updateResearchSource(id, values);
    return res.data || null;
  },
  async removeSource(id: string): Promise<boolean> {
    const res = await deleteResearchSource(id);
    return !res.error;
  },
  async listPatterns(brandId: string): Promise<ResearchPattern[]> {
    const res = await listResearchPatterns(brandId);
    return res.data || [];
  },
  async addPattern(values: Partial<ResearchPattern> & { brand_id?: string }): Promise<ResearchPattern | null> {
    const res = await createResearchPattern(values);
    return res.data || null;
  }
};
