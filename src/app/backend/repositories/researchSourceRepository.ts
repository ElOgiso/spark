import { deleteRow, insertRow, listByBrand, updateRow } from "./repositoryUtils";
import type { RepositoryResult } from "./repositoryTypes";
import type { ResearchSource, ResearchPattern } from "../../domain/types";
import type { ResearchSourceRow, ResearchPatternRow } from "../database.types";

function sourceRowToDomain(row: ResearchSourceRow): ResearchSource {
  const meta = (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? row.metadata
    : {}) as Record<string, any>;

  const handleVal = row.handle || meta.username || meta.handle || "@account";

  return {
    id: row.id,
    platform: (row.platform || "youtube") as any,
    platformAccountId: row.platform_account_id || undefined,
    url: row.url,
    username: handleVal,
    displayName: row.display_name || handleVal,
    avatar: meta.avatar || meta.imageUrl || undefined,
    banner: meta.banner || undefined,
    followers: typeof meta.followers === "number" ? meta.followers : null,
    videoCount: typeof meta.videoCount === "number" ? meta.videoCount : null,
    totalViews: typeof meta.totalViews === "number" ? meta.totalViews : null,
    metricsAvailability: (meta.metricsAvailability || meta.followers_status || "unavailable") as any,
    verified: Boolean(meta.verified),
    description: meta.description || undefined,
    status: (row.status || "active") as any,
    sourceType: meta.sourceType || "channel",
    videoResearch: meta.videoResearch || undefined,
    recentVideos: Array.isArray(meta.recentVideos) ? meta.recentVideos : [],
    topContent: Array.isArray(meta.topContent) ? meta.topContent : [],
    learnings: Array.isArray(meta.learnings) ? meta.learnings : [],
    observations: Array.isArray(meta.observations) ? meta.observations : [],
    researchConfidence: typeof meta.researchConfidence === "number" ? meta.researchConfidence : 88,
    lastSyncedAt: meta.lastSyncedAt || row.updated_at || row.created_at,
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
  const handleVal = values.username || (values as any).handle || "@account";
  const metadataObj: Record<string, any> = {
    avatar: values.avatar || null,
    banner: (values as any).banner || null,
    followers: typeof values.followers === "number" ? values.followers : null,
    videoCount: typeof values.videoCount === "number" ? values.videoCount : null,
    totalViews: typeof values.totalViews === "number" ? values.totalViews : null,
    metricsAvailability: values.metricsAvailability || null,
    verified: Boolean(values.verified),
    description: values.description || null,
    lastSyncedAt: values.lastSyncedAt || new Date().toISOString(),
    sourceType: (values as any).sourceType || "channel",
    videoResearch: (values as any).videoResearch || null,
    recentVideos: (values as any).recentVideos || [],
    topContent: (values as any).topContent || [],
    learnings: (values as any).learnings || [],
    observations: (values as any).observations || [],
    researchConfidence: values.researchConfidence || 88,
  };

  const rowInsert: Partial<ResearchSourceRow> = {
    id: values.id,
    brand_id: values.brand_id,
    platform: values.platform || "youtube",
    url: values.url,
    handle: handleVal,
    display_name: values.displayName || handleVal,
    status: values.status || "active",
    metadata: metadataObj as any,
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
  if (values.displayName) rowUpdate.display_name = values.displayName;
  if (values.username) rowUpdate.handle = values.username;
  if (values.url) rowUpdate.url = values.url;

  const metadataPatch: Record<string, any> = {};
  if (values.avatar !== undefined) metadataPatch.avatar = values.avatar;
  if (values.followers !== undefined) metadataPatch.followers = values.followers;
  if (values.metricsAvailability !== undefined) metadataPatch.metricsAvailability = values.metricsAvailability;
  if (values.verified !== undefined) metadataPatch.verified = values.verified;
  if (values.description !== undefined) metadataPatch.description = values.description;
  if (values.lastSyncedAt !== undefined) metadataPatch.lastSyncedAt = values.lastSyncedAt;
  if ((values as any).videoResearch !== undefined) metadataPatch.videoResearch = (values as any).videoResearch;
  if ((values as any).recentVideos !== undefined) metadataPatch.recentVideos = (values as any).recentVideos;
  if ((values as any).topContent !== undefined) metadataPatch.topContent = (values as any).topContent;
  if ((values as any).learnings !== undefined) metadataPatch.learnings = (values as any).learnings;

  if (Object.keys(metadataPatch).length > 0) {
    rowUpdate.metadata = metadataPatch as any;
  }

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
  try {
    const res = await listByBrand("research_patterns", brandId);
    if (res.error) {
      // Missing table fallback
      return { data: [], error: null, source: "local" };
    }
    return {
      data: res.data ? res.data.map(patternRowToDomain) : [],
      error: null,
      source: res.source,
    };
  } catch (err) {
    return { data: [], error: null, source: "local" };
  }
}

export async function createResearchPattern(values: Partial<ResearchPattern> & { brand_id?: string }): Promise<RepositoryResult<ResearchPattern>> {
  try {
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
    if (res.error) {
      return { data: null, error: null, source: "local" };
    }
    return {
      data: res.data ? patternRowToDomain(res.data) : null,
      error: null,
      source: res.source,
    };
  } catch (err) {
    return { data: null, error: null, source: "local" };
  }
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
