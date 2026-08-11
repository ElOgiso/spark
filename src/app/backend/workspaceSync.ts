/**
 * Silent workspace hydrate/persist — no UI.
 * Keeps conversation/runtime boundary intact; used exclusively by SparkContext.
 */
import { getSupabaseClient, isSupabaseConfigured } from "./supabaseClient";
import { listCharacters } from "./repositories/brandRepository";
import { listMemoryItems, createMemoryItem, updateMemoryItem, deleteMemoryItem } from "./repositories/memoryRepository";
import {
  listProductions,
  createProduction,
  updateProduction,
  listViralSparks,
  createViralSpark,
} from "./repositories/productionRepository";
import {
  listReviewItems,
  createReviewItem,
  updateReviewItem,
  approveReviewItem as approveReviewItemRepo,
  requestReviewEdits,
} from "./repositories/reviewRepository";
import { listPublishJobs, createPublishJob } from "./repositories/calendarRepository";
import { listAnalyticsSnapshots } from "./repositories/analyticsRepository";
import {
  listResearchSources,
  listResearchPatterns,
  createResearchSource,
  updateResearchSource,
  deleteResearchSource,
  createResearchPattern,
} from "./repositories/researchSourceRepository";
import { conversationRepository } from "./repositories/conversationRepository";
import { executiveSessionRepository } from "./repositories/executiveSessionRepository";
import { executiveSummaryRepository } from "./repositories/executiveSummaryRepository";
import { executiveTimelineRepository } from "./repositories/executiveTimelineRepository";
import { listByBrand } from "./repositories/repositoryUtils";
import type { AccountRow, BrandRow, CharacterRow, ExecutiveConversationMessageRow } from "./database.types";
import type {
  Account,
  AnalyticsInsight,
  Brand,
  Character,
  MemoryItem,
  Production,
  PublishJob,
  ReviewItem,
  ViralSpark,
  ResearchSource,
  ResearchPattern,
} from "../domain/types";
import {
  accountRowToDomain,
  analyticsRowToDomain,
  domainMemoryToInsert,
  domainProductionToInsert,
  domainPublishJobToInsert,
  domainReviewToInsert,
  domainViralSparkToInsert,
  memoryRowToDomain,
  productionRowToDomain,
  publishJobRowToDomain,
  reviewRowToDomain,
  viralSparkRowToDomain,
} from "./mappers/workspaceMappers";
import { ExecutiveContext, createEmptyExecutiveContext } from "../state/ExecutiveContext";

export type WorkspaceSnapshot = {
  brand?: Brand;
  character?: Character;
  accounts: Account[];
  memoryItems: MemoryItem[];
  viralSparks: ViralSpark[];
  productions: Production[];
  reviewItems: ReviewItem[];
  publishJobs: PublishJob[];
  analyticsInsights: AnalyticsInsight[];
  researchSources?: ResearchSource[];
  researchPatterns?: ResearchPattern[];
};

function brandRowToDomain(row: BrandRow): Brand {
  return {
    name: row.name || "My Brand",
    niche: row.niche || "Content Creation",
    archetype: row.archetype || "The Expert Guide",
    purpose: row.purpose || "Creating authoritative, engaging digital media content.",
    contentPillars: Array.isArray(row.content_pillars)
      ? (row.content_pillars as any[]).map((p) => typeof p === "string" ? { label: p, active: true } : p)
      : [
          { label: "AI & Automation", active: true },
          { label: "Digital Strategy", active: true },
          { label: "Content Creation", active: true },
          { label: "Growth Marketing", active: true },
        ],
    audience: (row.audience && typeof row.audience === "object" && !Array.isArray(row.audience))
      ? (row.audience as any)
      : {
          primary: "Digital creators and forward-thinking professionals",
          painPoints: ["Inconsistent publishing workflow", "High time investment required for research"],
          desires: ["Scale viral audience reach efficiently", "Maintain high quality brand authority"],
        },
    tone: Array.isArray(row.tone)
      ? (row.tone as any[]).map((t) => typeof t === "string" ? { label: t, active: true } : t)
      : [
          { label: "Energetic", active: true },
          { label: "Relatable", active: true },
          { label: "Expert", active: true },
          { label: "Inspiring", active: true },
        ],
    automation_mode: row.automation_mode || "balanced",
    review_required: row.review_required ?? true,
    publish_requires_approval: row.publish_requires_approval ?? true,
    autonomous_publishing_enabled: row.autonomous_publishing_enabled ?? false,
  };
}

function characterRowToDomain(row: CharacterRow): Character {
  const appearance = (row.appearance && typeof row.appearance === "object" && !Array.isArray(row.appearance)
    ? row.appearance
    : {}) as Record<string, unknown>;
  const personality = (row.personality && typeof row.personality === "object" && !Array.isArray(row.personality)
    ? row.personality
    : {}) as Record<string, unknown>;
  const voice = (row.voice && typeof row.voice === "object" && !Array.isArray(row.voice)
    ? row.voice
    : {}) as Record<string, unknown>;
  return {
    name: row.name,
    role: row.role || "Primary Host",
    style: String(appearance.style ?? ""),
    traits: Array.isArray(personality.traits) ? personality.traits.map(String) : [],
    voice: {
      name: String(voice.name ?? "Default"),
      language: String(voice.language ?? "English"),
      tone: String(voice.tone ?? "Neutral"),
      locked: Boolean(voice.locked ?? true),
    },
  };
}

export async function hydrateWorkspace(brandId: string): Promise<WorkspaceSnapshot> {
  if (!isSupabaseConfigured()) {
    return {
      accounts: [],
      memoryItems: [],
      viralSparks: [],
      productions: [],
      reviewItems: [],
      publishJobs: [],
      analyticsInsights: [],
      researchSources: [],
      researchPatterns: [],
    };
  }

  const supabase = getSupabaseClient();
  const [
    brandRes,
    characters,
    accounts,
    memory,
    sparks,
    productions,
    reviews,
    jobs,
    analytics,
    sourcesRes,
    patternsRes,
  ] = await Promise.all([
    isUuid(brandId) && supabase
      ? (supabase.from("brands") as any).select("*").eq("id", brandId).single()
      : Promise.resolve({ data: null }),
    listCharacters(brandId),
    listByBrand("accounts", brandId),
    listMemoryItems(brandId),
    listViralSparks(brandId),
    listProductions(brandId),
    listReviewItems(brandId),
    listPublishJobs(brandId),
    listAnalyticsSnapshots(brandId),
    listResearchSources(brandId),
    listResearchPatterns(brandId),
  ]);

  const brand = brandRes?.data ? brandRowToDomain(brandRes.data) : undefined;
  const firstCharacter = characters.data?.[0]
    ? characterRowToDomain(characters.data[0])
    : undefined;

  return {
    brand,
    character: firstCharacter,
    accounts: (accounts.data as AccountRow[] | null)?.map(accountRowToDomain) ?? [],
    memoryItems: (memory.data ?? []).map(memoryRowToDomain),
    viralSparks: (sparks.data ?? []).map(viralSparkRowToDomain),
    productions: (productions.data ?? []).map(productionRowToDomain),
    reviewItems: (reviews.data ?? []).map(reviewRowToDomain),
    publishJobs: (jobs.data ?? []).map(publishJobRowToDomain),
    analyticsInsights: (analytics.data ?? []).map(analyticsRowToDomain),
    researchSources: sourcesRes.data ?? [],
    researchPatterns: patternsRes.data ?? [],
  };
}

export async function hydrateExecutiveContext(brandId: string): Promise<ExecutiveContext> {
  if (!isSupabaseConfigured()) {
    return createEmptyExecutiveContext();
  }

  const [
    summary,
    session,
    memoryRows,
    messages,
    timeline,
  ] = await Promise.all([
    executiveSummaryRepository.getSummary(brandId),
    executiveSessionRepository.getExecutiveSession(brandId),
    listMemoryItems(brandId),
    conversationRepository.listConversationMessages(brandId),
    executiveTimelineRepository.listTimeline(brandId),
  ]);

  const workingMemory = {
    context: (session?.working_memory_snapshot as Record<string, unknown>) || {},
  };

  return {
    summary,
    session,
    memory: memoryRows.data || [],
    workingMemory,
    conversation: messages,
    timeline,
  };
}

export async function persistExecutiveMessage(
  brandId: string,
  sessionId: string,
  sender: "user" | "director",
  text: string,
  metadata?: Record<string, unknown>
): Promise<ExecutiveConversationMessageRow | null> {
  if (!isSupabaseConfigured()) return null;
  return await conversationRepository.createConversationMessage({
    brand_id: brandId,
    session_id: sessionId,
    sender,
    text,
    metadata: metadata || {},
    role: sender === "user" ? "user" : "assistant",
    department: "Executive Director",
    importance: "MEDIUM",
  });
}

export async function persistMemoryCreate(brandId: string, item: MemoryItem) {
  if (!isSupabaseConfigured() || !brandId) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(brandId)) {
    console.warn("[workspaceSync] persistMemoryCreate skipped: brandId is not a valid UUID", brandId);
    return null;
  }
  const result = await createMemoryItem(domainMemoryToInsert(brandId, item));
  return result.data ? memoryRowToDomain(result.data) : null;
}

export async function persistMemoryDelete(id: string) {
  if (!isSupabaseConfigured() || !id) return;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    await deleteMemoryItem(id);
  }
}

export async function persistMemoryUpdate(
  id: string,
  patch: { text?: string; type?: "learned" | "rule"; category?: string; pinned?: boolean; archived?: boolean }
) {
  if (!isSupabaseConfigured() || !id) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return null;
  const updateData: Record<string, unknown> = {};
  if (patch.text !== undefined) {
    updateData.title = patch.text.slice(0, 120);
    updateData.description = patch.text;
  }
  if (patch.type !== undefined) {
    updateData.source = patch.type;
  }
  if (patch.category !== undefined) {
    updateData.category = patch.category;
  }
  if (patch.archived !== undefined) {
    updateData.archived = patch.archived;
  }
  if (patch.pinned !== undefined) {
    updateData.evidence = { pinned: patch.pinned };
  }
  const result = await updateMemoryItem(id, updateData as any);
  return result.data ? memoryRowToDomain(result.data) : null;
}

export async function persistViralSparkCreate(brandId: string, spark: ViralSpark) {
  if (!isSupabaseConfigured()) return null;
  const result = await createViralSpark(domainViralSparkToInsert(brandId, spark));
  return result.data ? viralSparkRowToDomain(result.data) : null;
}

export async function persistProductionCreate(brandId: string, production: Production) {
  if (!isSupabaseConfigured()) return null;
  const insert = domainProductionToInsert(brandId, production);
  const result = await createProduction(insert);
  return result.data ? productionRowToDomain(result.data) : null;
}

export async function persistProductionUpdate(id: string, production: Partial<Production>) {
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const patch: Record<string, unknown> = {};
  if (production.status) {
    const statusMap: Record<string, string> = {
      Drafting: "drafting",
      "Ready for Review": "ready_for_review",
      Approved: "approved",
      "Needs Edit": "needs_edit",
      Published: "published",
      Failed: "failed",
    };
    patch.status = statusMap[production.status] || production.status;
  }
  if (production.title) patch.title = production.title;
  if (production.scenes || production.aspectRatio || production.formats) {
    patch.brief = {
      aspectRatio: production.aspectRatio,
      formats: production.formats,
      scenes: production.scenes,
      sparkId: production.sparkId,
    };
  }
  if ((production as any).reasoning) {
    (patch as any).reasoning = (production as any).reasoning;
  }
  await updateProduction(id, patch);
}

function isUuid(id?: string | null) {
  return Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
}

export async function persistReviewCreate(brandId: string, item: ReviewItem) {
  if (!isSupabaseConfigured()) return null;
  if (!isUuid(item.productionId)) return null;
  const result = await createReviewItem(domainReviewToInsert(brandId, item));
  return result.data ? reviewRowToDomain(result.data) : null;
}

export async function persistReviewApprove(id: string) {
  if (!isSupabaseConfigured() || !isUuid(id)) return;
  await updateReviewItem(id, {
    status: "approved",
    approved_at: new Date().toISOString(),
  } as any);
}

export async function persistAccountToken(brandId: string, account: any) {
  if (!isSupabaseConfigured() || !isUuid(brandId)) return;
  try {
    const { supabase } = await import("./supabaseClient");
    if (!supabase) return;
    const now = new Date().toISOString();
    const permissions =
      account.permissions && typeof account.permissions === "object"
        ? account.permissions
        : {
            scopes: account.permissionsGranted || account.scopes || [],
            platform_user_id: account.channelId || account.platform_user_id || null,
            avatar: account.avatar || null,
          };
    await (supabase.from("accounts") as any).upsert(
      {
        brand_id: brandId,
        platform: account.platform || "YouTube Shorts",
        handle: account.handle || account.username || null,
        display_name: account.displayName || account.display_name || null,
        status:
          String(account.status || "connected").toLowerCase() === "connected"
            ? "connected"
            : String(account.status || "disconnected").toLowerCase(),
        permissions,
        connected_at: account.connectedAt || now,
        last_sync_at: account.lastSyncAt || now,
        updated_at: now,
      },
      { onConflict: "brand_id,platform" }
    );
  } catch (err) {
    console.warn("[workspaceSync] Account persistence error:", err);
  }
}

export async function persistReviewNeedsEdit(id: string) {
  if (!isSupabaseConfigured() || !isUuid(id)) return;
  await requestReviewEdits(id);
}
export async function persistPublishJobCreate(brandId: string, job: PublishJob) {
  if (!isSupabaseConfigured()) return null;
  if (!isUuid(job.productionId)) return null;
  const result = await createPublishJob(domainPublishJobToInsert(brandId, job));
  return result.data ? publishJobRowToDomain(result.data) : null;
}

export async function persistReviewUpdate(id: string, values: { status?: string; notes?: string }) {
  if (!isSupabaseConfigured() || !isUuid(id)) return null;
  const result = await updateReviewItem(id, values as any);
  return result.data ? reviewRowToDomain(result.data) : null;
}

export async function persistResearchSourceCreate(brandId: string, source: ResearchSource) {
  if (!isSupabaseConfigured() || !isUuid(brandId)) return null;
  const result = await createResearchSource({ ...source, brand_id: brandId });
  return result.data || null;
}

export async function persistResearchSourceDelete(id: string) {
  if (!isSupabaseConfigured() || !id) return;
  await deleteResearchSource(id);
}

export async function persistResearchSourceUpdate(id: string, patch: Partial<ResearchSource>) {
  if (!isSupabaseConfigured() || !id) return null;
  const result = await updateResearchSource(id, patch);
  return result.data || null;
}

export async function persistResearchPatternCreate(brandId: string, pattern: ResearchPattern) {
  if (!isSupabaseConfigured() || !isUuid(brandId)) return null;
  const result = await createResearchPattern({ ...pattern, brand_id: brandId });
  return result.data || null;
}

export async function persistMemoryDeleteSafe(id: string) {
  if (!isSupabaseConfigured() || !isUuid(id)) return;
  await deleteMemoryItem(id);
}

export async function persistBrandUpdate(brandId: string, patch: Partial<Brand>) {
  if (!isSupabaseConfigured() || !isUuid(brandId)) return;
  try {
    const { updateBrand } = await import("./repositories/brandRepository");
    const rowPatch: any = {};
    if (patch.name) rowPatch.name = patch.name;
    if (patch.niche) rowPatch.niche = patch.niche;
    if (patch.archetype) rowPatch.archetype = patch.archetype;
    if (patch.purpose) rowPatch.purpose = patch.purpose;
    if (patch.contentPillars) rowPatch.content_pillars = patch.contentPillars;
    if (patch.tone) rowPatch.tone = patch.tone;
    if (patch.audience) rowPatch.audience = patch.audience;
    await updateBrand(brandId, rowPatch);
  } catch (err) {
    console.warn("[workspaceSync] Brand update persist notice:", err);
  }
}

export async function persistExecutiveModeUpdate(brandId: string, patch: { automationMode?: string; productionMode?: string }) {
  if (!isSupabaseConfigured() || !isUuid(brandId)) return;
  try {
    const summaryPatch: any = { brand_id: brandId };
    if (patch.automationMode) summaryPatch.automation_mode = patch.automationMode;
    await executiveSummaryRepository.upsertSummary(summaryPatch);
  } catch (err) {
    console.warn("[workspaceSync] Executive mode update persist notice:", err);
  }
}

export async function persistAISettings(brandId: string, aiSettings: import("../domain/types").AISettings) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(`spark_ai_settings_${brandId || "default"}`, JSON.stringify(aiSettings));
    }
    if (isSupabaseConfigured() && isUuid(brandId)) {
      await executiveSummaryRepository.upsertSummary({
        brand_id: brandId,
        current_objectives: { ai_settings: aiSettings } as any,
      });
    }
  } catch (err) {
    console.warn("[workspaceSync] AI settings persist notice:", err);
  }
}

export async function persistProductionAssetCreate(
  brandId: string,
  asset: import("../domain/types").ProductionAsset
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const { createMediaAsset } = await import("./repositories/productionAssetRepository");
    await createMediaAsset({
      id: asset.id,
      storage_bucket: asset.storageBucket || "Spark",
      storage_path: asset.storagePath,
      public_url: asset.publicUrl,
      file_type: asset.assetType,
      mime_type: asset.mimeType,
      source_prompt: asset.generationPrompt || null,
      source_tool: asset.provider || "AIProviderOrchestrator",
      is_active: true,
      uploaded_by: brandId || null,
      created_at: asset.createdAt || new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[workspaceSync] Media asset persist notice:", err);
  }
}

/**
 * Lifecycle Management: Deletes expired working storage objects from Supabase Storage bucket 'Spark'
 * after ~7 days while keeping metadata and Drive references intact.
 */
export async function cleanupExpiredWorkingStorage(brandId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return 0;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expiredRows, error } = await (supabase.from("media_assets") as any)
      .select("id, storage_path, storage_bucket")
      .lt("created_at", sevenDaysAgo)
      .not("storage_path", "is", null);

    if (error || !expiredRows || (expiredRows as any[]).length === 0) return 0;

    const pathsToRemove = (expiredRows as any[])
      .map((r: any) => r.storage_path)
      .filter(Boolean) as string[];

    if (pathsToRemove.length > 0) {
      await supabase.storage.from("Spark").remove(pathsToRemove);
      console.log(`[workspaceSync] Cleaned up ${pathsToRemove.length} expired working storage objects from bucket "Spark".`);
    }

    return pathsToRemove.length;
  } catch (err) {
    console.warn("[workspaceSync] Working storage cleanup notice:", err);
    return 0;
  }
}

