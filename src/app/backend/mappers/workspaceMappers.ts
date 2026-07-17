import type {
  AccountRow,
  AnalyticsSnapshotRow,
  MemoryCategory,
  MemoryItemRow,
  ProductionMode as DbProductionMode,
  ProductionRow,
  PublishJobRow,
  ReviewItemRow,
  ViralSparkRow,
  Json,
} from "../database.types";
import type {
  Account,
  AnalyticsInsight,
  MemoryItem,
  Production,
  ProductionMode,
  PublishJob,
  ReviewItem,
  ViralSpark,
} from "../../domain/types";

const memoryCategoryToDb: Record<string, MemoryCategory> = {
  Character: "character",
  Voice: "voice",
  Brand: "brand",
  Niche: "niche",
  Audio: "audio",
  "Winning hooks": "winning_hooks",
  "Winning thumbnails": "winning_thumbnails",
  "Audience preferences": "audience_preferences",
  Failures: "failures",
  "Publishing behavior": "publishing_behavior",
};

const memoryCategoryFromDb: Record<MemoryCategory, NonNullable<MemoryItem["category"]>> = {
  character: "Character",
  voice: "Voice",
  brand: "Brand",
  niche: "Niche",
  audio: "Audio",
  winning_hooks: "Winning hooks",
  winning_thumbnails: "Winning thumbnails",
  audience_preferences: "Audience preferences",
  failures: "Failures",
  publishing_behavior: "Publishing behavior",
};

export function memoryRowToDomain(row: MemoryItemRow): MemoryItem {
  return {
    id: row.id,
    type: row.source === "rule" || row.category === "brand" && row.title.startsWith("Rule") ? "rule" : row.source === "learned" ? "learned" : "learned",
    text: row.description || row.title,
    dateAdded: (row.created_at || "").slice(0, 10),
    category: memoryCategoryFromDb[row.category] ?? "Brand",
  };
}

export function domainMemoryToInsert(
  brandId: string,
  item: MemoryItem,
): Partial<MemoryItemRow> {
  const category: MemoryCategory =
    (item.category && memoryCategoryToDb[item.category]) || "brand";
  return {
    brand_id: brandId,
    category,
    title: item.text.slice(0, 120) || "Memory",
    description: item.text,
    source: item.type,
    confidence: "medium",
    evidence: {},
    affected_systems: [],
    archived: false,
  };
}

export function viralSparkRowToDomain(row: ViralSparkRow): ViralSpark {
  const evidence = (row.evidence && typeof row.evidence === "object" && !Array.isArray(row.evidence)
    ? row.evidence
    : {}) as Record<string, unknown>;
  const score = Number(row.confidence ?? evidence.brandFitScore ?? 80);
  return {
    id: row.id,
    title: row.title,
    platforms: String(evidence.platforms ?? "YouTube + TikTok"),
    hook: String(evidence.hook ?? row.hook_potential ?? row.opportunity ?? ""),
    views: String(evidence.views ?? "—"),
    velocity: String(evidence.velocity ?? "—"),
    platformFit: String(evidence.platformFit ?? "High"),
    brandFitScore: Number.isFinite(score) ? score : 80,
    category: (evidence.category as ViralSpark["category"]) || "rising",
    timeWindow: String(evidence.timeWindow ?? "Open window"),
    productionTime: String(evidence.productionTime ?? "6–12h"),
    whyNow: row.why_now ?? row.opportunity ?? "",
    angle: String(evidence.angle ?? row.hook_potential ?? ""),
  };
}

export function domainViralSparkToInsert(
  brandId: string,
  spark: ViralSpark,
): Partial<ViralSparkRow> {
  return {
    brand_id: brandId,
    title: spark.title,
    opportunity: spark.hook,
    why_now: spark.whyNow,
    audience_fit: spark.platformFit,
    brand_fit: String(spark.brandFitScore),
    hook_potential: spark.hook,
    confidence: String(spark.brandFitScore),
    risk: "low",
    expected_outcome: spark.views,
    evidence: {
      platforms: spark.platforms,
      hook: spark.hook,
      views: spark.views,
      velocity: spark.velocity,
      platformFit: spark.platformFit,
      brandFitScore: spark.brandFitScore,
      category: spark.category,
      timeWindow: spark.timeWindow,
      productionTime: spark.productionTime,
      angle: spark.angle,
    } as Json,
    status: "new",
  };
}

function uiProductionModeToDb(mode: ProductionMode): DbProductionMode {
  if (mode === "express") return "narrator";
  if (mode === "deep") return "cinematic";
  return "hybrid";
}

function dbProductionModeToUi(mode: DbProductionMode): ProductionMode {
  if (mode === "narrator") return "express";
  if (mode === "cinematic") return "deep";
  return "standard";
}

export function productionRowToDomain(row: ProductionRow): Production {
  const brief = (row.brief && typeof row.brief === "object" && !Array.isArray(row.brief)
    ? row.brief
    : {}) as Record<string, unknown>;
  const scenes = Array.isArray(brief.scenes)
    ? (brief.scenes as Production["scenes"])
    : [];
  const formats = Array.isArray(brief.formats)
    ? (brief.formats as string[])
    : ["Short-form"];
  const statusMap: Record<string, Production["status"]> = {
    drafting: "Drafting",
    ready_for_review: "Ready for Review",
    approved: "Approved",
    needs_edit: "Needs Edit",
    published: "Published",
    failed: "Failed",
  };
  return {
    id: row.id,
    title: row.title,
    sparkId: row.viral_spark_id ?? undefined,
    status: statusMap[row.status || ""] || (row.status as Production["status"]) || "Drafting",
    mode: dbProductionModeToUi(row.production_mode),
    dateCreated: (row.created_at || "").slice(0, 10),
    aspectRatio: String(brief.aspectRatio ?? "9:16"),
    formats,
    scenes,
    reasoning: (row.reasoning && typeof row.reasoning === "object" && !Array.isArray(row.reasoning)) ? (row.reasoning as any) : {},
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value?: string | null): boolean {
  return Boolean(value && UUID_RE.test(value));
}

export function domainProductionToInsert(
  brandId: string,
  production: Production,
): Partial<ProductionRow> {
  const statusMap: Record<string, string> = {
    Drafting: "drafting",
    "Ready for Review": "ready_for_review",
    Approved: "approved",
    "Needs Edit": "needs_edit",
    Published: "published",
    Failed: "failed",
  };
  return {
    brand_id: brandId,
    viral_spark_id: isUuid(production.sparkId) ? production.sparkId! : null,
    title: production.title,
    production_mode: uiProductionModeToDb(production.mode),
    status: statusMap[production.status] || production.status,
    brief: {
      aspectRatio: production.aspectRatio,
      formats: production.formats,
      scenes: production.scenes,
      sparkId: production.sparkId,
    } as Json,
    assets: [],
    reasoning: (production.reasoning || {}) as Json,
  };
}

export function reviewRowToDomain(row: ReviewItemRow): ReviewItem {
  const reasoning = (row.reasoning && typeof row.reasoning === "object" && !Array.isArray(row.reasoning)
    ? row.reasoning
    : {}) as Record<string, unknown>;
  const statusMap: Record<string, ReviewItem["status"]> = {
    pending: "Pending Review",
    pending_review: "Pending Review",
    approved: "Approved",
    needs_edit: "Needs Edit",
  };
  return {
    id: row.id,
    productionId: row.production_id,
    title: String(reasoning.title ?? "Review item"),
    account: String(reasoning.account ?? "YouTube"),
    series: String(reasoning.series ?? "Series"),
    status: statusMap[row.status || ""] || "Pending Review",
    dateCreated: (row.created_at || "").slice(0, 10),
    scriptSnippet: String(reasoning.scriptSnippet ?? row.notes ?? ""),
    conceptText: String(reasoning.conceptText ?? ""),
    openingMoment: String(reasoning.openingMoment ?? ""),
    qualityCheck: {
      brandSafety: "Passed",
      policyCheck: "Passed",
      technicalCheck: "Passed",
    },
  };
}

export function domainReviewToInsert(
  brandId: string,
  item: ReviewItem,
): Partial<ReviewItemRow> {
  const statusMap: Record<ReviewItem["status"], string> = {
    "Pending Review": "pending",
    Approved: "approved",
    "Needs Edit": "needs_edit",
  };
  return {
    brand_id: brandId,
    production_id: item.productionId,
    status: statusMap[item.status] || "pending",
    decision: null,
    notes: item.scriptSnippet,
    reasoning: {
      title: item.title,
      account: item.account,
      series: item.series,
      scriptSnippet: item.scriptSnippet,
      conceptText: item.conceptText,
      openingMoment: item.openingMoment,
    } as Json,
  };
}

export function publishJobRowToDomain(row: PublishJobRow): PublishJob {
  const meta = (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? row.metadata
    : {}) as Record<string, unknown>;
  const statusMap: Record<string, PublishJob["status"]> = {
    scheduled: "Scheduled",
    export_ready: "Export Ready",
    published: "Published",
    failed: "Failed",
    needs_review: "Needs Review",
  };
  return {
    id: row.id,
    productionId: row.production_id,
    title: String(meta.title ?? "Publish job"),
    platform: row.platform ?? String(meta.platform ?? "YouTube"),
    scheduledTime: row.scheduled_for
      ? new Date(row.scheduled_for).toLocaleString()
      : String(meta.scheduledTime ?? "—"),
    status: statusMap[row.status || ""] || "Scheduled",
  };
}

export function domainPublishJobToInsert(
  brandId: string,
  job: PublishJob,
): Partial<PublishJobRow> {
  const statusMap: Record<PublishJob["status"], string> = {
    Scheduled: "scheduled",
    "Export Ready": "export_ready",
    Published: "published",
    Failed: "failed",
    "Needs Review": "needs_review",
  };
  return {
    brand_id: brandId,
    production_id: job.productionId,
    platform: job.platform,
    status: statusMap[job.status] || "scheduled",
    caption: null,
    metadata: {
      title: job.title,
      platform: job.platform,
      scheduledTime: job.scheduledTime,
    } as Json,
  };
}

export function accountRowToDomain(row: AccountRow): Account {
  return {
    platform: row.platform,
    handle: row.handle || row.display_name || "",
    status: row.status === "connected" ? "connected" : "disconnected",
    posts: 0,
  };
}

export function analyticsRowToDomain(row: AnalyticsSnapshotRow): AnalyticsInsight {
  const metrics = (row.metrics && typeof row.metrics === "object" && !Array.isArray(row.metrics)
    ? row.metrics
    : {}) as Record<string, unknown>;
  return {
    id: row.id,
    title: row.insight || "Insight",
    description: row.recommendation || "",
    metric: String(metrics.metric ?? "—"),
    change: String(metrics.change ?? "—"),
    type: (metrics.type as AnalyticsInsight["type"]) || "learning",
    bestHook: String(metrics.bestHook ?? ""),
    bestFormat: String(metrics.bestFormat ?? ""),
    bestPlatformFit: String(metrics.bestPlatformFit ?? row.platform ?? ""),
  };
}
