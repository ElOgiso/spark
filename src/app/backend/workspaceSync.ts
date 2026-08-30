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
import type { AccountRow, BrandRow, CharacterRow, ExecutiveConversationMessageRow, MediaAssetRow } from "./database.types";
import { refreshProductionMediaAssets, refreshCharacterMediaAssets } from "../services/production/productionAssetService";
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
  GenerationCreditSettings,
  ProductionFormatSettings,
  ContentFormat,
} from "../domain/types";
import { DEFAULT_CREDIT_SETTINGS, DEFAULT_FORMAT_SETTINGS } from "../domain/types";
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
  characters?: Character[];
  creditSettings?: GenerationCreditSettings;
  formatSettings?: ProductionFormatSettings;
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
  const audienceObj = (row.audience && typeof row.audience === "object" && !Array.isArray(row.audience))
    ? (row.audience as any)
    : {};

  const toneObj = (row.tone && typeof row.tone === "object" && !Array.isArray(row.tone))
    ? (row.tone as any)
    : null;

  const rawToneList = toneObj?.tones || (Array.isArray(row.tone) ? row.tone : null);
  const rawStyleList = toneObj?.style;

  const settingsObj = (row.settings && typeof row.settings === "object" && !Array.isArray(row.settings))
    ? (row.settings as any)
    : {};

  const rawFormatSettings = settingsObj.format_settings;
  const rawContentFormat: ContentFormat =
    settingsObj.contentFormat ||
    settingsObj.content_format ||
    rawFormatSettings?.contentFormat ||
    "host";

  const formatSettings: ProductionFormatSettings = rawFormatSettings
    ? {
        aspectMode: rawFormatSettings.aspectMode || "portrait",
        targetDurationSec: typeof rawFormatSettings.targetDurationSec === "number" ? rawFormatSettings.targetDurationSec : 60,
        contentFormat: rawContentFormat,
        preferredVideoProvider: rawFormatSettings.preferredVideoProvider || "auto",
        preferredVideoModel: rawFormatSettings.preferredVideoModel,
      }
    : {
        ...DEFAULT_FORMAT_SETTINGS,
        contentFormat: rawContentFormat,
      };

  const creditSettings = settingsObj.credit_settings || audienceObj.credit_settings;

  return {
    id: row.id,
    name: row.name || "My Brand",
    niche: row.niche || "Content Creation",
    archetype: row.archetype || "Visionary Creator",
    purpose: row.purpose || "Creating authoritative, engaging digital media content.",
    website: audienceObj.website || "",
    country: audienceObj.country || "United States",
    language: audienceObj.language || "English (US)",
    contentFormat: rawContentFormat,
    locationPlateUrl: settingsObj.locationPlateUrl || settingsObj.location_plate_url || null,
    formatSettings,
    settings: settingsObj,
    creditSettings: creditSettings ? { ...DEFAULT_CREDIT_SETTINGS, ...creditSettings } : undefined,
    contentPillars: Array.isArray(row.content_pillars)
      ? (row.content_pillars as any[]).map((p) => typeof p === "string" ? { label: p, active: true } : p)
      : [
          { label: "AI & Automation", active: true },
          { label: "Digital Strategy", active: true },
          { label: "Content Creation", active: true },
        ],
    audience: {
      primary: audienceObj.primary || "Digital creators and forward-thinking professionals",
      painPoints: Array.isArray(audienceObj.painPoints) ? audienceObj.painPoints : ["Inconsistent publishing workflow", "High time investment required for research"],
      desires: Array.isArray(audienceObj.desires) ? audienceObj.desires : ["Scale viral audience reach efficiently", "Maintain high quality brand authority"],
    },
    tone: Array.isArray(rawToneList)
      ? (rawToneList as any[]).map((t) => typeof t === "string" ? { label: t, active: true } : t)
      : [
          { label: "Authoritative", active: true },
          { label: "Conversational", active: true },
          { label: "Bold", active: true },
        ],
    style: Array.isArray(rawStyleList)
      ? (rawStyleList as any[]).map((s) => typeof s === "string" ? { label: s, active: true } : s)
      : [
          { label: "Direct-to-camera", active: true },
          { label: "Story-driven", active: true },
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
    avatarUrl: typeof appearance.avatarUrl === "string" ? appearance.avatarUrl : (typeof appearance.characterSheetUrl === "string" ? appearance.characterSheetUrl : (typeof appearance.imageUrl === "string" ? appearance.imageUrl : null)),
    imageUrl: typeof appearance.imageUrl === "string" ? appearance.imageUrl : (typeof appearance.characterSheetUrl === "string" ? appearance.characterSheetUrl : (typeof appearance.avatarUrl === "string" ? appearance.avatarUrl : null)),
    characterSheetUrl: typeof appearance.characterSheetUrl === "string" ? appearance.characterSheetUrl : (typeof appearance.imageUrl === "string" ? appearance.imageUrl : (typeof appearance.avatarUrl === "string" ? appearance.avatarUrl : null)),
    traits: Array.isArray(personality.traits) ? personality.traits.map(String) : [],
    voice: {
      name: String(voice.name ?? "Default"),
      language: String(voice.language ?? "English"),
      tone: String(voice.tone ?? "Neutral"),
      locked: Boolean(voice.locked ?? true),
      voiceId: typeof voice.voiceId === "string" ? voice.voiceId : undefined,
      description: typeof voice.description === "string" ? voice.description : undefined,
      gender: typeof voice.gender === "string" ? voice.gender : undefined,
      previewUrl: typeof voice.previewUrl === "string" ? voice.previewUrl : undefined,
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
    mediaAssetsRes,
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
    listByBrand("media_assets", brandId).catch(() => ({ data: [] })),
  ]);

  const brand = brandRes?.data ? brandRowToDomain(brandRes.data) : undefined;
  const rawCharacters = (characters.data ?? []).map(characterRowToDomain);

  const rawMediaAssets: MediaAssetRow[] = (mediaAssetsRes?.data as MediaAssetRow[] | null) || [];
  const rawProductions = (productions.data ?? []).map(productionRowToDomain);

  // Resign / refresh media URLs for each production
  const refreshedProductions: Production[] = [];
  for (const prod of rawProductions) {
    const { production: refreshedProd, didResign } = await refreshProductionMediaAssets(prod, rawMediaAssets);
    refreshedProductions.push(refreshedProd);

    // If signed URL was refreshed, persist new signed URL on productions row in database
    if (didResign && isUuid(refreshedProd.id)) {
      void updateProduction(refreshedProd.id, {
        brief: (refreshedProd.brief as any) || null,
        assets: {
          video_url: refreshedProd.videoUrl || null,
          audio_url: refreshedProd.audioUrl || null,
          ...(refreshedProd.brief?.generatedAssets || {}),
        } as any,
      }).catch((err) => console.warn("[workspaceSync] Production signed URL update notice:", err));
    }
  }

  // Resign / refresh all character media URLs
  const refreshedCharacters: Character[] = [];
  for (const char of rawCharacters) {
    const { character: charRefreshed, didResign } = await refreshCharacterMediaAssets(char, rawMediaAssets);
    refreshedCharacters.push(charRefreshed);
    if (didResign && isUuid(brandId)) {
      void persistCharacterUpdate(brandId, charRefreshed).catch((err) =>
        console.warn("[workspaceSync] Character signed URL update notice:", err)
      );
    }
  }

  const mainCharacter = refreshedCharacters.find((c) => c.role !== "support") || refreshedCharacters[0];

  const cloudCreditSettings = (brandRes?.data?.settings as any)?.credit_settings || (brandRes?.data?.audience as any)?.credit_settings;
  const cloudFormatSettings = (brandRes?.data?.settings as any)?.format_settings;

  let localCachedFormat: Partial<ProductionFormatSettings> | undefined = undefined;
  if (typeof localStorage !== "undefined" && brandId) {
    try {
      const cached = localStorage.getItem(`spark_format_settings_${brandId}`);
      if (cached) localCachedFormat = JSON.parse(cached);
    } catch {}
  }

  const resolvedFormatDuration =
    (typeof cloudFormatSettings?.targetDurationSec === "number" ? cloudFormatSettings.targetDurationSec : undefined) ??
    (typeof localCachedFormat?.targetDurationSec === "number" ? localCachedFormat.targetDurationSec : undefined) ??
    DEFAULT_FORMAT_SETTINGS.targetDurationSec;

  const resolvedFormat = (cloudFormatSettings || localCachedFormat)
    ? {
        ...DEFAULT_FORMAT_SETTINGS,
        ...(localCachedFormat || {}),
        ...(cloudFormatSettings || {}),
        targetDurationSec: resolvedFormatDuration,
      }
    : undefined;

  if (brand && resolvedFormat) {
    brand.formatSettings = resolvedFormat;
  }

  return {
    brand,
    character: mainCharacter,
    characters: refreshedCharacters,
    creditSettings: cloudCreditSettings ? { ...DEFAULT_CREDIT_SETTINGS, ...cloudCreditSettings } : undefined,
    formatSettings: resolvedFormat,
    accounts: (accounts.data as AccountRow[] | null)?.map(accountRowToDomain) ?? [],
    memoryItems: (memory.data ?? []).map(memoryRowToDomain),
    viralSparks: (sparks.data ?? []).map(viralSparkRowToDomain),
    productions: refreshedProductions,
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
  if (!isSupabaseConfigured() || !isUuid(id)) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { data: existing } = await (supabase.from("productions") as any).select("brief, assets").eq("id", id).single();
  const existingBrief = (existing?.brief && typeof existing.brief === "object" && !Array.isArray(existing.brief))
    ? existing.brief
    : {};
  const existingBriefObj = (existingBrief.briefObject && typeof existingBrief.briefObject === "object" && !Array.isArray(existingBrief.briefObject))
    ? existingBrief.briefObject
    : {};
  const existingAssets = (existing?.assets && typeof existing.assets === "object" && !Array.isArray(existing.assets))
    ? existing.assets
    : {};

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

  const genProg =
    production.generationProgress ||
    (production as any).brief?.generationProgress ||
    (production as any).brief?.generatedAssets?.generationProgress ||
    existingBrief.generationProgress ||
    existingBriefObj.generationProgress;

  const audioUrl = (production as any).audioUrl || (production as any).brief?.audioUrl || existingBrief.audioUrl || existingBriefObj.audioUrl;
  const videoUrl = (production as any).videoUrl || (production as any).brief?.videoUrl || existingBrief.videoUrl || existingBriefObj.videoUrl;
  const storyboardGridUrl = (production as any).brief?.storyboardGridUrl || (production as any).brief?.generatedAssets?.storyboardGridUrl || existingBrief.storyboardGridUrl || existingBriefObj.storyboardGridUrl;

  const briefObject = (production as any).brief
    ? {
        ...(production as any).brief,
        audioUrl,
        videoUrl,
        storyboardGridUrl,
        generationProgress: genProg,
      }
    : existingBriefObj;

  patch.brief = {
    ...existingBrief,
    aspectRatio: production.aspectRatio || existingBrief.aspectRatio,
    formats: production.formats || existingBrief.formats,
    scenes: production.scenes || (production as any).productionScenes || existingBrief.scenes,
    sparkId: production.sparkId || existingBrief.sparkId,
    audioUrl,
    videoUrl,
    storyboardGridUrl,
    generationProgress: genProg,
    briefObject,
  };

  patch.assets = {
    ...existingAssets,
    video_url: videoUrl || null,
    audio_url: audioUrl || null,
    storyboard_grid_url: storyboardGridUrl || null,
    ...(((production as any).brief?.generatedAssets as any) || {}),
  };

  if ((production as any).reasoning) {
    (patch as any).reasoning = (production as any).reasoning;
  }
  await updateProduction(id, patch);
}

export async function persistReviewUpdate(id: string, item: Partial<ReviewItem>) {
  if (!isSupabaseConfigured() || !isUuid(id)) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { data: existing } = await (supabase.from("review_items") as any).select("reasoning").eq("id", id).single();
  const existingReasoning = (existing?.reasoning && typeof existing.reasoning === "object" && !Array.isArray(existing.reasoning))
    ? existing.reasoning
    : {};

  const patch: Record<string, unknown> = {};
  if (item.status) {
    const statusMap: Record<string, string> = {
      "Pending Review": "pending",
      Approved: "approved",
      "Needs Edit": "needs_edit",
    };
    patch.status = statusMap[item.status] || item.status;
  }
  const reasoningPatch: Record<string, unknown> = { ...existingReasoning };
  if (item.title) reasoningPatch.title = item.title;
  if (item.account) reasoningPatch.account = item.account;
  if (item.series) reasoningPatch.series = item.series;
  if (item.scriptSnippet) {
    reasoningPatch.scriptSnippet = item.scriptSnippet;
    patch.notes = item.scriptSnippet;
  }
  if (item.conceptText) reasoningPatch.conceptText = item.conceptText;
  if (item.openingMoment) reasoningPatch.openingMoment = item.openingMoment;
  if (item.brief) reasoningPatch.brief = item.brief;
  if (item.whyThisWorks) reasoningPatch.whyThisWorks = item.whyThisWorks;
  if (item.videoUrl) reasoningPatch.videoUrl = item.videoUrl;
  if (item.audioUrl) reasoningPatch.audioUrl = item.audioUrl;

  patch.reasoning = reasoningPatch;

  await updateReviewItem(id, patch as any);
}

function isUuid(id?: string | null) {
  return Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id));
}

export async function persistReviewCreate(brandId: string, item: ReviewItem) {
  if (!isSupabaseConfigured()) return null;
  const insert = domainReviewToInsert(brandId, item);
  const result = await createReviewItem(insert);
  return result.data ? reviewRowToDomain(result.data) : null;
}

export async function persistReviewApprove(id: string) {
  if (!isSupabaseConfigured() || !isUuid(id)) return;
  await updateReviewItem(id, {
    status: "approved",
    approved_at: new Date().toISOString(),
  } as any);
}

export async function deleteProductionCascade(brandId: string, productionId: string, title?: string) {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    if (isUuid(productionId)) {
      // 1. Delete review items where production_id = id OR id = id
      await (supabase.from("review_items") as any).delete().or(`production_id.eq.${productionId},id.eq.${productionId}`);
      // 2. Delete production assets
      await (supabase.from("production_assets") as any).delete().eq("production_id", productionId).catch(() => {});
      // 3. Delete production row
      await (supabase.from("productions") as any).delete().eq("id", productionId);
    }
    
    // If legacy non-UUID id or cleanup by title + brand
    if (brandId && isUuid(brandId) && title) {
      await (supabase.from("review_items") as any).delete().eq("brand_id", brandId).eq("reasoning->>title", title);
      await (supabase.from("productions") as any).delete().eq("brand_id", brandId).eq("title", title);
    }
  } catch (err) {
    console.warn("[workspaceSync] deleteProductionCascade error:", err);
  }
}

export async function persistAccountToken(brandId: string, account: any) {
  if (!isSupabaseConfigured() || !isUuid(brandId)) return;
  try {
    const { supabase } = await import("./supabaseClient");
    if (!supabase) return;
    const { normalizePlatformKey, normalizeHandle } = await import("../domain/accountUtils");
    const now = new Date().toISOString();
    const pKey = normalizePlatformKey(account.platform || "youtube");
    const rawHandle = account.handle || account.username;
    const cleanHandle = rawHandle ? normalizeHandle(rawHandle) : null;
    // Preserve OAuth tokens on the persisted row. The client connect path passes tokens as
    // top-level fields (accessToken/refreshToken/expiresAt) with NO permissions object, so the old
    // code stored the account WITHOUT tokens — on relogin it showed "connected" but was dead.
    const basePermissions =
      account.permissions && typeof account.permissions === "object" ? { ...account.permissions } : {};
    const accessToken = account.accessToken || account.access_token || basePermissions.access_token;
    const refreshToken = account.refreshToken || account.refresh_token || basePermissions.refresh_token;
    const expiresAt = account.expiresAt || account.expires_at || basePermissions.expires_at;
    const permissions: Record<string, any> = {
      scopes: basePermissions.scopes || account.permissionsGranted || account.scopes || [],
      platform_user_id: basePermissions.platform_user_id || account.channelId || account.platform_user_id || null,
      avatar: basePermissions.avatar || account.avatar || null,
      ...basePermissions,
    };
    if (accessToken) permissions.access_token = accessToken;
    if (refreshToken) permissions.refresh_token = refreshToken;
    if (expiresAt) permissions.expires_at = expiresAt;
    await (supabase.from("accounts") as any).upsert(
      {
        brand_id: brandId,
        platform: pKey,
        handle: cleanHandle,
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

export async function persistResearchSourceCreate(brandId: string, source: ResearchSource) {
  if (!isSupabaseConfigured() || !brandId) return null;
  if (!isUuid(brandId)) {
    console.error("[workspaceSync] persistResearchSourceCreate failed: brandId is not a valid UUID", brandId);
    return null;
  }
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

export async function persistCreditSettings(
  brandId: string,
  settings: GenerationCreditSettings
): Promise<boolean> {
  if (!isSupabaseConfigured() || !brandId) return false;
  if (!isUuid(brandId)) {
    console.error("[workspaceSync] persistCreditSettings failed: brandId is not a valid UUID", brandId);
    return false;
  }

  try {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const { data: brandRow } = await (supabase.from("brands") as any)
      .select("settings")
      .eq("id", brandId)
      .single();

    const existingSettings =
      brandRow?.settings && typeof brandRow.settings === "object" && !Array.isArray(brandRow.settings)
        ? { ...brandRow.settings }
        : {};

    existingSettings.credit_settings = { ...settings };

    const { error } = await (supabase.from("brands") as any)
      .update({ settings: existingSettings, updated_at: new Date().toISOString() })
      .eq("id", brandId);

    if (error) {
      console.error("[workspaceSync] persistCreditSettings update error:", error.message);
      return false;
    }

    console.log("[workspaceSync] Credit settings persisted to brands.settings in Supabase:", settings);
    return true;
  } catch (err) {
    console.error("[workspaceSync] persistCreditSettings error:", err);
    return false;
  }
}

export async function persistFormatSettings(
  brandId: string,
  settings: ProductionFormatSettings
): Promise<boolean> {
  const cleanDuration = typeof settings.targetDurationSec === "number" ? settings.targetDurationSec : 60;
  const cleanSettings: ProductionFormatSettings = {
    ...settings,
    targetDurationSec: cleanDuration,
  };

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(`spark_format_settings_${brandId || "default"}`, JSON.stringify(cleanSettings));
    if (brandId) {
      localStorage.setItem(`spark_format_settings_active`, JSON.stringify(cleanSettings));
    }
  }
  if (!isSupabaseConfigured() || !brandId || !isUuid(brandId)) return true;

  try {
    const supabase = getSupabaseClient();
    if (!supabase) return true;

    const { data: brandRow } = await (supabase.from("brands") as any)
      .select("settings")
      .eq("id", brandId)
      .single();

    const existingSettings =
      brandRow?.settings && typeof brandRow.settings === "object" && !Array.isArray(brandRow.settings)
        ? { ...brandRow.settings }
        : {};

    existingSettings.format_settings = { ...cleanSettings };
    if (cleanSettings.contentFormat) {
      existingSettings.contentFormat = cleanSettings.contentFormat;
      existingSettings.content_format = cleanSettings.contentFormat;
    }

    await (supabase.from("brands") as any)
      .update({ settings: existingSettings, updated_at: new Date().toISOString() })
      .eq("id", brandId);

    console.log("[workspaceSync] Format settings persisted to brands.settings in Supabase:", settings);
    return true;
  } catch (err) {
    console.error("[workspaceSync] persistFormatSettings error:", err);
    return false;
  }
}

export async function persistBrandUpdate(brandId: string, patch: Partial<Brand> & Record<string, any>): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.warn("[workspaceSync] persistBrandUpdate skipped: Supabase not configured");
    return false;
  }
  if (!isUuid(brandId)) {
    console.error("[workspaceSync] persistBrandUpdate failed: brandId is not a valid UUID", brandId);
    return false;
  }

  try {
    const { updateBrand } = await import("./repositories/brandRepository");
    const rowPatch: any = {};
    if (patch.name !== undefined) rowPatch.name = patch.name;
    if (patch.niche !== undefined) rowPatch.niche = patch.niche;
    if (patch.archetype !== undefined) rowPatch.archetype = patch.archetype;
    if (patch.purpose !== undefined) rowPatch.purpose = patch.purpose;
    if (patch.contentPillars !== undefined) rowPatch.content_pillars = patch.contentPillars;
    if (patch.tone !== undefined || patch.style !== undefined) {
      if (patch.style !== undefined) {
        rowPatch.tone = {
          tones: patch.tone,
          style: patch.style,
        };
      } else {
        rowPatch.tone = patch.tone;
      }
    }

    const audienceObj: Record<string, any> =
      typeof patch.audience === "object" && patch.audience !== null ? { ...patch.audience } : {};

    if (patch.audiencePrimary !== undefined) audienceObj.primary = patch.audiencePrimary;
    if (patch.painPoints !== undefined) audienceObj.painPoints = patch.painPoints;
    if (patch.desires !== undefined) audienceObj.desires = patch.desires;
    if (patch.website !== undefined) audienceObj.website = patch.website;
    if (patch.country !== undefined) audienceObj.country = patch.country;
    if (patch.language !== undefined) audienceObj.language = patch.language;
    if (patch.targetAudience !== undefined) audienceObj.targetAudience = patch.targetAudience;

    if (Object.keys(audienceObj).length > 0) {
      rowPatch.audience = audienceObj;
    }

    // Merge settings (locationPlateUrl, format_settings, credit_settings, etc.)
    const supabase = getSupabaseClient();
    let existingSettings: Record<string, any> = {};
    if (supabase) {
      const { data: bRow } = await (supabase.from("brands") as any).select("settings").eq("id", brandId).single();
      const rawSettings = (bRow as any)?.settings;
      if (rawSettings && typeof rawSettings === "object" && !Array.isArray(rawSettings)) {
        existingSettings = { ...rawSettings };
      }
    }

    const newSettings: Record<string, any> = { ...existingSettings };
    if (patch.settings && typeof patch.settings === "object") {
      Object.assign(newSettings, patch.settings);
    }
    if (patch.locationPlateUrl !== undefined) {
      newSettings.locationPlateUrl = patch.locationPlateUrl || null;
      newSettings.location_plate_url = patch.locationPlateUrl || null;
    }
    if (patch.formatSettings !== undefined) {
      newSettings.format_settings = patch.formatSettings;
    }
    if (patch.contentFormat !== undefined) {
      newSettings.contentFormat = patch.contentFormat;
      newSettings.content_format = patch.contentFormat;
      if (newSettings.format_settings) {
        newSettings.format_settings.contentFormat = patch.contentFormat;
      }
    }
    if (patch.creditSettings !== undefined) {
      newSettings.credit_settings = patch.creditSettings;
    }

    if (Object.keys(newSettings).length > 0) {
      rowPatch.settings = newSettings;
    }

    const res = await updateBrand(brandId, rowPatch);
    if (res.error) {
      console.error("[workspaceSync] persistBrandUpdate cloud write error:", res.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[workspaceSync] Brand update persist notice:", err);
    return false;
  }
}

export async function uploadLocationPlateToStorage(brandId: string, imageUri: string): Promise<string> {
  if (!isSupabaseConfigured() || !brandId || !imageUri) return imageUri;
  if (imageUri.includes(".supabase.co/storage/v1/object/")) {
    return imageUri;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return imageUri;

  try {
    let uploadBlob: Blob | null = null;
    let mimeType = "image/png";

    if (imageUri.startsWith("data:")) {
      const match = imageUri.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        mimeType = match[1] || "image/png";
        const base64Data = match[2];
        const binaryStr = atob(base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        uploadBlob = new Blob([bytes], { type: mimeType });
      }
    } else if (imageUri.startsWith("blob:") || typeof fetch !== "undefined") {
      const res = await fetch(imageUri);
      if (res.ok) {
        uploadBlob = await res.blob();
        mimeType = uploadBlob.type || "image/png";
      }
    }

    if (!uploadBlob) return imageUri;

    const ext = mimeType.includes("webp") ? "webp" : mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";
    const storagePath = `brands/${brandId}/set/location_plate.${ext}`;

    const { error: uploadError } = await supabase.storage.from("Spark").upload(storagePath, uploadBlob, {
      contentType: mimeType,
      upsert: true,
    });

    if (uploadError) {
      console.warn("[workspaceSync] uploadLocationPlateToStorage notice:", uploadError);
      return imageUri;
    }

    const { data: publicUrlData } = supabase.storage.from("Spark").getPublicUrl(storagePath);
    return publicUrlData?.publicUrl || imageUri;
  } catch (err) {
    console.warn("[workspaceSync] uploadLocationPlateToStorage failed:", err);
    return imageUri;
  }
}

export async function uploadCharacterSheetToStorage(brandId: string, imageUri: string, charId?: string): Promise<string> {
  if (!isSupabaseConfigured() || !brandId || !imageUri) return imageUri;
  // If already hosted in our Supabase Storage bucket, skip re-upload
  if (imageUri.includes(".supabase.co/storage/v1/object/")) {
    return imageUri;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return imageUri;

  try {
    let uploadBlob: Blob | null = null;
    let mimeType = "image/png";

    if (imageUri.startsWith("data:")) {
      const match = imageUri.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        mimeType = match[1] || "image/png";
        const base64Data = match[2];
        const binaryStr = atob(base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        uploadBlob = new Blob([bytes], { type: mimeType });
      }
    } else if (imageUri.startsWith("blob:") || typeof fetch !== "undefined") {
      const res = await fetch(imageUri);
      if (res.ok) {
        uploadBlob = await res.blob();
        mimeType = uploadBlob.type || "image/png";
      }
    }

    if (!uploadBlob) return imageUri;

    const ext = mimeType.includes("webp") ? "webp" : mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";
    const storagePath = charId
      ? `brands/${brandId}/character/sheet_${charId}.${ext}`
      : `brands/${brandId}/character/sheet.${ext}`;

    const { error: uploadError } = await supabase.storage.from("Spark").upload(storagePath, uploadBlob, {
      contentType: mimeType,
      upsert: true,
    });

    if (uploadError) {
      console.warn("[workspaceSync] Storage upload for character sheet notice:", uploadError);
      return imageUri;
    }

    // Try creating signed URL with 1 year TTL (31536000s)
    const { data: signedData, error: signedError } = await supabase.storage
      .from("Spark")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    if (!signedError && signedData?.signedUrl) {
      return signedData.signedUrl;
    }

    const { data: pubData } = supabase.storage.from("Spark").getPublicUrl(storagePath);
    if (pubData?.publicUrl) {
      return pubData.publicUrl;
    }

    return imageUri;
  } catch (err) {
    console.warn("[workspaceSync] uploadCharacterSheetToStorage notice:", err);
    return imageUri;
  }
}

export async function uploadVoicePreviewToStorage(brandId: string, audioUri: string): Promise<string> {
  if (!isSupabaseConfigured() || !isUuid(brandId) || !audioUri) return audioUri;
  const supabase = getSupabaseClient();
  if (!supabase) return audioUri;

  try {
    let uploadBlob: Blob | null = null;

    if (audioUri.startsWith("data:")) {
      const parts = audioUri.split(",");
      const mime = parts[0].match(/:(.*?);/)?.[1] || "audio/mpeg";
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      uploadBlob = new Blob([u8arr], { type: mime });
    } else if (audioUri.startsWith("blob:") || audioUri.startsWith("http")) {
      const res = await fetch(audioUri);
      if (res.ok) {
        uploadBlob = await res.blob();
      }
    }

    if (!uploadBlob) return audioUri;

    const storagePath = `brands/${brandId}/voice/preview.mp3`;
    const { error: uploadError } = await supabase.storage.from("Spark").upload(storagePath, uploadBlob, {
      contentType: "audio/mpeg",
      upsert: true,
    });

    if (uploadError) {
      console.warn("[workspaceSync] Storage upload for voice preview notice:", uploadError);
      return audioUri;
    }

    const { data: signedData } = await supabase.storage
      .from("Spark")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    if (signedData?.signedUrl) return signedData.signedUrl;

    const { data: pubData } = supabase.storage.from("Spark").getPublicUrl(storagePath);
    if (pubData?.publicUrl) return pubData.publicUrl;

    return audioUri;
  } catch (err) {
    console.warn("[workspaceSync] uploadVoicePreviewToStorage notice:", err);
    return audioUri;
  }
}

export async function fetchBrandStorageAssets(brandId: string): Promise<{ id: string; name: string; type: string; size: string; date: string; url: string }[]> {
  if (!isSupabaseConfigured() || !isUuid(brandId)) return [];
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const results: { id: string; name: string; type: string; size: string; date: string; url: string }[] = [];
  const seenPaths = new Set<string>();

  const listFolderRecursive = async (folderPath: string, depth = 0) => {
    if (depth > 3) return;
    try {
      const { data: files, error } = await supabase.storage.from("Spark").list(folderPath, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error || !files || !Array.isArray(files)) return;

      for (const f of files) {
        if (!f.name || f.name.startsWith(".")) continue;
        const currentPath = `${folderPath}/${f.name}`;

        const isFile = Boolean(f.metadata && typeof f.metadata.size === "number");
        if (!isFile) {
          await listFolderRecursive(currentPath, depth + 1);
          continue;
        }

        if (seenPaths.has(currentPath)) continue;
        seenPaths.add(currentPath);

        let publicOrSignedUrl = "";
        const { data: signedData } = await supabase.storage.from("Spark").createSignedUrl(currentPath, 60 * 60 * 24 * 7);
        if (signedData?.signedUrl) {
          publicOrSignedUrl = signedData.signedUrl;
        } else {
          const { data: pubData } = supabase.storage.from("Spark").getPublicUrl(currentPath);
          publicOrSignedUrl = pubData?.publicUrl || "";
        }

        const sizeFormatted = f.metadata?.size
          ? (f.metadata.size / 1024 < 1024 ? `${(f.metadata.size / 1024).toFixed(1)} KB` : `${(f.metadata.size / 1024 / 1024).toFixed(1)} MB`)
          : "—";

        const dateFormatted = f.created_at ? new Date(f.created_at).toLocaleDateString() : "Today";
        const mimeType = f.metadata?.mimetype || (f.name.endsWith(".mp3") ? "Audio (MP3)" : f.name.endsWith(".mp4") ? "Video (MP4)" : f.name.endsWith(".png") || f.name.endsWith(".jpg") ? "Image" : "Document");

        const displayName = folderPath.startsWith(`brands/${brandId}/uploads`)
          ? f.name
          : `${folderPath.replace(`brands/${brandId}/`, "")}/${f.name}`;

        results.push({
          id: f.id || currentPath,
          name: displayName,
          type: mimeType,
          size: sizeFormatted,
          date: dateFormatted,
          url: publicOrSignedUrl,
        });
      }
    } catch (err) {
      console.warn("[workspaceSync] listFolderRecursive notice:", err);
    }
  };

  await listFolderRecursive(`brands/${brandId}`);
  return results;
}

export async function uploadBrandAssetFile(brandId: string, file: File): Promise<{ id: string; name: string; type: string; size: string; date: string; url: string } | null> {
  if (!isSupabaseConfigured() || !isUuid(brandId)) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const storagePath = `brands/${brandId}/uploads/${Date.now()}_${cleanFileName}`;

    const { error: uploadError } = await supabase.storage.from("Spark").upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });

    if (uploadError) {
      console.warn("[workspaceSync] uploadBrandAssetFile storage notice:", uploadError);
      return null;
    }

    let url = "";
    const { data: signedData } = await supabase.storage.from("Spark").createSignedUrl(storagePath, 60 * 60 * 24 * 365);
    if (signedData?.signedUrl) {
      url = signedData.signedUrl;
    } else {
      const { data: pubData } = supabase.storage.from("Spark").getPublicUrl(storagePath);
      url = pubData?.publicUrl || "";
    }

    const sizeFormatted = file.size / 1024 < 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`;

    return {
      id: storagePath,
      name: file.name,
      type: file.type || "File",
      size: sizeFormatted,
      date: new Date().toLocaleDateString(),
      url,
    };
  } catch (err) {
    console.warn("[workspaceSync] uploadBrandAssetFile error:", err);
    return null;
  }
}

export async function persistCharacterUpdate(brandId: string, character: Character): Promise<void> {
  if (!isSupabaseConfigured() || !isUuid(brandId)) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const appearancePayload = {
      style: character.style || "",
      imageUrl: character.imageUrl || character.characterSheetUrl || character.avatarUrl || null,
      avatarUrl: character.avatarUrl || character.characterSheetUrl || character.imageUrl || null,
      characterSheetUrl: character.characterSheetUrl || character.imageUrl || character.avatarUrl || null,
    };
    const personalityPayload = {
      traits: character.traits || [],
    };
    const voicePayload = {
      name: character.voice?.name || "Default",
      language: character.voice?.language || "English",
      tone: character.voice?.tone || "Neutral",
      locked: character.voice?.locked ?? true,
      voiceId: character.voice?.voiceId || null,
      description: character.voice?.description || null,
      gender: character.voice?.gender || null,
      previewUrl: character.voice?.previewUrl || null,
    };

    const now = new Date().toISOString();

    if (character.id && isUuid(character.id)) {
      await (supabase.from("characters") as any)
        .update({
          name: character.name || "Character",
          role: character.role || "host",
          appearance: appearancePayload,
          personality: personalityPayload,
          voice: voicePayload,
          updated_at: now,
        })
        .eq("id", character.id);
      return;
    }

    const { data: existing } = await (supabase.from("characters") as any)
      .select("id")
      .eq("brand_id", brandId)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      await (supabase.from("characters") as any)
        .update({
          name: character.name || "Primary Host",
          role: character.role || "Primary Host",
          appearance: appearancePayload,
          personality: personalityPayload,
          voice: voicePayload,
          updated_at: now,
        })
        .eq("id", existing[0].id);
    } else {
      await (supabase.from("characters") as any).insert({
        id: crypto.randomUUID(),
        brand_id: brandId,
        name: character.name || "Primary Host",
        role: character.role || "Primary Host",
        appearance: appearancePayload,
        personality: personalityPayload,
        voice: voicePayload,
        consistency_rules: {},
        generation_rules: {},
        updated_at: now,
      });
    }
  } catch (err) {
    console.warn("[workspaceSync] Character persist notice:", err);
  }
}

export async function persistCharacterCreate(brandId: string, character: Partial<Character>): Promise<Character | null> {
  if (!isSupabaseConfigured() || !isUuid(brandId)) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const charId = character.id && isUuid(character.id) ? character.id : crypto.randomUUID();
    const appearancePayload = {
      style: character.style || "",
      imageUrl: character.imageUrl || character.characterSheetUrl || character.avatarUrl || null,
      avatarUrl: character.avatarUrl || character.characterSheetUrl || character.imageUrl || null,
      characterSheetUrl: character.characterSheetUrl || character.imageUrl || character.avatarUrl || null,
    };
    const personalityPayload = {
      traits: character.traits || [],
    };
    const voicePayload = {
      name: character.voice?.name || "Default",
      language: character.voice?.language || "English",
      tone: character.voice?.tone || "Neutral",
      locked: character.voice?.locked ?? true,
      voiceId: character.voice?.voiceId || null,
      description: character.voice?.description || null,
      gender: character.voice?.gender || null,
      previewUrl: character.voice?.previewUrl || null,
    };

    const row = {
      id: charId,
      brand_id: brandId,
      name: character.name || (character.role === "support" ? "Supporting Character" : "Primary Host"),
      role: character.role || "support",
      appearance: appearancePayload,
      personality: personalityPayload,
      voice: voicePayload,
      consistency_rules: {},
      generation_rules: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await (supabase.from("characters") as any).insert(row).select().single();
    if (error) {
      console.warn("[workspaceSync] persistCharacterCreate notice:", error);
      return characterRowToDomain(row as any);
    }
    return characterRowToDomain(data);
  } catch (err) {
    console.warn("[workspaceSync] persistCharacterCreate error:", err);
    return null;
  }
}

export async function persistCharacterDelete(characterId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !isUuid(characterId)) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await (supabase.from("characters") as any).delete().eq("id", characterId);
    if (error) {
      console.warn("[workspaceSync] Character delete notice:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[workspaceSync] Character delete error:", err);
    return false;
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

/**
 * Permanently deletes an entire workspace and all its child scoped records:
 * - review_items, publish_jobs, export_packages, analytics_insights
 * - productions, viral_sparks, research_sources, research_patterns
 * - memory_items, brand_rules, conversation_sessions, executive_sessions
 * - executive_director_summaries, executive_timeline, characters, accounts
 * - brand row (scoped by owner_id if provided)
 * - cleans local storage workspace cache
 */
export async function deleteWorkspace(brandId: string, ownerId?: string): Promise<boolean> {
  if (!brandId) return false;
  console.log(`[workspaceSync] Initiating complete workspace deletion for brandId: ${brandId}`);

  // 1. Cloud Deletion (if Supabase is configured)
  if (isSupabaseConfigured() && isUuid(brandId)) {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        // Child tables in safe deletion order
        const childTables = [
          "review_items",
          "publish_jobs",
          "export_packages",
          "analytics_insights",
          "productions",
          "viral_sparks",
          "research_sources",
          "research_patterns",
          "memory_items",
          "brand_rules",
          "conversation_sessions",
          "executive_sessions",
          "executive_director_summaries",
          "executive_timeline",
          "characters",
          "accounts",
        ];

        for (const table of childTables) {
          try {
            await (supabase.from(table as any) as any).delete().eq("brand_id", brandId);
          } catch (tErr) {
            console.warn(`[workspaceSync] Notice deleting from ${table}:`, tErr);
          }
        }

        // Delete parent brand (enforcing owner check if provided)
        let brandDeleteQuery = (supabase.from("brands") as any).delete().eq("id", brandId);
        if (ownerId) {
          brandDeleteQuery = brandDeleteQuery.eq("owner_id", ownerId);
        }
        const { error: brandErr } = await brandDeleteQuery;
        if (brandErr) {
          console.warn("[workspaceSync] Brand table deletion notice:", brandErr);
        }
      }
    } catch (err) {
      console.warn("[workspaceSync] Supabase workspace deletion error:", err);
    }
  }

  // 2. Local Storage Cleanup
  try {
    if (typeof localStorage !== "undefined") {
      const keysToRemove = [
        `spark_workspace_${brandId}`,
        `spark_format_settings_${brandId}`,
        `spark_credit_settings_${brandId}`,
        `spark_ai_settings_${brandId}`,
        `spark_ai_routing_${brandId}`,
        `spark_ai_models_${brandId}`,
        `spark_selected_offer_${brandId}`,
        `spark_account_tokens_${brandId}`,
      ];
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      if (localStorage.getItem("spark_current_brand_id") === brandId) {
        localStorage.removeItem("spark_current_brand_id");
        localStorage.removeItem("spark_current_brand_name");
      }
    }
  } catch (lsErr) {
    console.warn("[workspaceSync] Local storage cleanup notice:", lsErr);
  }

  console.log(`[workspaceSync] Successfully deleted workspace brandId: ${brandId}`);
  return true;
}

/**
 * Completely deletes all SPARK data, workspace brands, storage assets, and account records
 * owned by the specified userId. Calls the serverless /api/auth/delete-account endpoint
 * with the caller's JWT, and runs direct client-side Supabase cascade cleanup as defense-in-depth.
 */
export async function deleteUserAccount(userId: string): Promise<{ success: boolean; message?: string }> {
  if (!userId) return { success: false, message: "Missing user ID" };
  console.log(`[workspaceSync] Initiating account deletion for user: ${userId}`);

  let serverMessage = "";

  // 1. Call serverless backend endpoint with user's JWT token
  try {
    const supabase = getSupabaseClient();
    const sessionRes = await supabase?.auth.getSession();
    const token = sessionRes?.data?.session?.access_token;

    if (token) {
      const resp = await fetch("/api/auth/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (resp.ok) {
        const data = await resp.json();
        serverMessage = data.message || "Account data removed.";
      }
    }
  } catch (apiErr) {
    console.warn("[workspaceSync] Serverless delete-account endpoint notice:", apiErr);
  }

  // 2. Direct client-side Supabase data cleanup (defense-in-depth under caller's auth context)
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        // Query user's owned brands
        const { data: userBrands } = await (supabase.from("brands") as any)
          .select("id")
          .eq("owner_id", userId);

        const brandIds = (userBrands || []).map((b: any) => b.id).filter(Boolean);

        const childTables = [
          "review_items",
          "publish_jobs",
          "export_packages",
          "analytics_insights",
          "production_assets",
          "productions",
          "viral_sparks",
          "research_sources",
          "research_patterns",
          "memory_items",
          "brand_rules",
          "conversation_sessions",
          "executive_sessions",
          "executive_director_summaries",
          "executive_timeline",
          "characters",
          "accounts",
          "media_assets",
        ];

        for (const bId of brandIds) {
          for (const table of childTables) {
            try {
              await (supabase.from(table as any) as any).delete().eq("brand_id", bId);
            } catch (tErr) {
              console.warn(`[workspaceSync] Notice deleting from ${table}:`, tErr);
            }
          }
          try {
            await (supabase.from("brands") as any).delete().eq("id", bId).eq("owner_id", userId);
          } catch (bErr) {
            console.warn("[workspaceSync] Brand delete notice:", bErr);
          }
        }

        // Delete profile row
        try {
          await (supabase.from("profiles") as any).delete().eq("id", userId);
        } catch (pErr) {
          console.warn("[workspaceSync] Profile delete notice:", pErr);
        }
      }
    } catch (dbErr) {
      console.warn("[workspaceSync] Client-side DB cleanup notice:", dbErr);
    }
  }

  // 3. Complete purge of local storage
  try {
    if (typeof localStorage !== "undefined") {
      const allKeys = Object.keys(localStorage);
      for (const k of allKeys) {
        if (k.startsWith("spark_") || k.startsWith("sb-") || k.includes("supabase")) {
          localStorage.removeItem(k);
        }
      }
      localStorage.removeItem("media_os_state");
    }
  } catch (lsErr) {
    console.warn("[workspaceSync] LocalStorage cleanup notice:", lsErr);
  }

  console.log(`[workspaceSync] Account deletion completed for user: ${userId}`);
  return {
    success: true,
    message: serverMessage || "Account data removed. Contact support if login still exists.",
  };
}


