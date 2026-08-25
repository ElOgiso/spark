/**
 * Phase 6J — Live multi-platform analytics pipeline (no UI).
 * Ingests real analytics for connected OAuth accounts, persists snapshots,
 * and enriches local token cache for existing Analytics surfaces.
 */
import { createAnalyticsSnapshot } from "../backend/repositories/analyticsRepository";
import { isSupabaseConfigured } from "../backend/supabaseClient";
import type { AnalyticsInsight } from "../domain/types";
import { normalizeHandle } from "../domain/accountUtils";
import {
  getBrandWorkspaceId,
  getStoredAccountTokens,
  socialConnectorFramework,
  type ConnectedAccountToken,
  type LiveAccountProfileCard,
  type PlatformAnalyticsData,
  type SocialProfileMetadata,
} from "./socialIntegrationService";
import { loadPersistedState, savePersistedState } from "../state/persistence";

const PLATFORM_ANALYTICS_KEY = "spark_platform_analytics_v1";

export type PlatformAnalyticsRecord = PlatformAnalyticsData & {
  profile?: SocialProfileMetadata | null;
  content?: Array<{
    id: string;
    title: string;
    publishedAt?: string;
    thumbnail?: string;
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    url?: string;
  }>;
  estimatedRevenue?: number | null;
  revenueStatus?: string;
  syncedAt: string;
  /** True only when Spark failed to call/process the platform API (not empty data). */
  syncFailure?: boolean;
  /** True when API succeeded but there is no content/metrics to show. */
  emptyGenuine?: boolean;
  emptyMessage?: string | null;
  persisted?: boolean;
  persistError?: string | null;
};

function loadAnalyticsMap(): Record<string, PlatformAnalyticsRecord> {
  try {
    const raw = localStorage.getItem(PLATFORM_ANALYTICS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAnalyticsMap(map: Record<string, PlatformAnalyticsRecord>) {
  try {
    localStorage.setItem(PLATFORM_ANALYTICS_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn("[analyticsPipeline] persist map failed", e);
  }
}

export function getStoredPlatformAnalytics(): Record<string, PlatformAnalyticsRecord> {
  return loadAnalyticsMap();
}

export function getStoredPlatformAnalyticsFor(platform: string): PlatformAnalyticsRecord | null {
  const map = loadAnalyticsMap();
  if (map[platform]) return map[platform];
  const key = Object.keys(map).find(
    (k) => k.toLowerCase() === platform.toLowerCase() || k.toLowerCase().includes(platform.toLowerCase().split(" ")[0])
  );
  return key ? map[key] : null;
}

/** Convert live analytics into AnalyticsInsight[] for SparkContext / existing consumers. */
export function platformAnalyticsToInsights(
  records: PlatformAnalyticsRecord[]
): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = [];
  for (const r of records) {
    // Sync failure: never phrase as "no analytics available yet"
    if (r.syncFailure) {
      insights.push({
        id: `sync-fail-${r.platform}`,
        title: `${r.platform}: synchronization failed`,
        description:
          r.unavailableReason ||
          "Spark failed to synchronize analytics. Retry from Analytics refresh.",
        metric: "SYNC_ERROR",
        change: "—",
        type: "failed",
        bestHook: "",
        bestFormat: "",
        bestPlatformFit: r.platform,
      });
      continue;
    }

    // Genuine empty: no uploads / no metrics from platform
    if (r.emptyGenuine || (r.available && (r.postsCount || 0) === 0 && (r.views || 0) === 0)) {
      insights.push({
        id: `empty-${r.platform}`,
        title: `${r.platform}`,
        description: "No analytics available yet",
        metric: "0",
        change: "—",
        type: "learning",
        bestHook: "",
        bestFormat: "",
        bestPlatformFit: r.platform,
      });
      continue;
    }

    if (!r.available) {
      insights.push({
        id: `na-${r.platform}`,
        title: `${r.platform}`,
        description:
          r.unavailableReason ||
          "This platform does not expose those metrics through Spark yet.",
        metric: "—",
        change: "—",
        type: "learning",
        bestHook: "",
        bestFormat: "",
        bestPlatformFit: r.platform,
      });
      continue;
    }

    insights.push({
      id: `live-${r.platform}-followers`,
      title: `${r.platform} audience`,
      description: `Live followers/subscribers: ${r.followers.toLocaleString()}. Posts/videos: ${r.postsCount.toLocaleString()}.`,
      metric: String(r.followers),
      change: r.growthPercent ? `${r.growthPercent > 0 ? "+" : ""}${r.growthPercent}%` : "—",
      type: "worked",
      bestHook: "",
      bestFormat: "",
      bestPlatformFit: r.platform,
    });
    insights.push({
      id: `live-${r.platform}-views`,
      title: `${r.platform} reach`,
      description: `Lifetime views/impressions: ${r.views.toLocaleString()}. Engagement rate: ${r.engagementRate}%.`,
      metric: String(r.views),
      change: r.engagementRate ? `${r.engagementRate}% eng` : "—",
      type: "worked",
      bestHook: "",
      bestFormat: "",
      bestPlatformFit: r.platform,
    });
    const top = (r.content || [])
      .slice()
      .sort((a, b) => (b.views || 0) - (a.views || 0))[0];
    if (top) {
      insights.push({
        id: `live-${r.platform}-top`,
        title: top.title || "Top content",
        description: `Top content on ${r.platform}: ${top.views?.toLocaleString() || 0} views, ${top.likes || 0} likes.`,
        metric: String(top.views || 0),
        change: top.likes ? `${top.likes} likes` : "—",
        type: "worked",
        bestHook: top.title || "",
        bestFormat: r.platform,
        bestPlatformFit: r.platform,
      });
    }
  }
  return insights;
}

/**
 * Client-side snapshot write (RLS requires authenticated owner).
 * Primary write is server-side in /api/runtime/social-analytics with service role.
 */
async function persistSnapshotClient(
  brandId: string,
  record: PlatformAnalyticsRecord
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured() || !brandId) {
    return { ok: false, error: "Supabase not configured or brandId missing" };
  }
  try {
    const result = await createAnalyticsSnapshot({
      brand_id: brandId,
      production_id: null,
      platform: record.platform,
      metrics: {
        followers: record.followers,
        views: record.views,
        engagementRate: record.engagementRate,
        watchTimeHours: record.watchTimeHours,
        impressions: record.impressions,
        postsCount: record.postsCount,
        growthPercent: record.growthPercent,
        content: (record.content || []).slice(0, 15),
        profile: record.profile || null,
        available: record.available,
        syncFailure: record.syncFailure || false,
        emptyGenuine: record.emptyGenuine || false,
        unavailableReason: record.unavailableReason || null,
      } as any,
      insight: record.syncFailure
        ? `SYNC_ERROR ${record.platform}: ${record.unavailableReason || "failed"}`
        : record.emptyGenuine
          ? "No analytics available yet"
          : record.available
            ? `${record.platform}: ${record.followers} audience · ${record.views} views · ${record.postsCount} posts`
            : record.unavailableReason || "unavailable",
      recommendation: record.syncFailure
        ? "Retry synchronization — this is not an empty channel."
        : record.emptyGenuine
          ? "No analytics available yet"
          : "Live platform metrics synchronized.",
      captured_at: record.syncedAt || new Date().toISOString(),
    } as any);
    if (result.error) {
      console.warn("[analyticsPipeline] client snapshot error:", result.error);
      return { ok: false, error: result.error };
    }
    return { ok: true };
  } catch (e: any) {
    console.warn("[analyticsPipeline] snapshot persist failed", e);
    return { ok: false, error: e?.message || String(e) };
  }
}

function enrichTokenFromAnalytics(
  token: ConnectedAccountToken,
  record: PlatformAnalyticsRecord
): ConnectedAccountToken {
  const p = record.profile;
  const rawHandle = p?.username || token.handle;
  return {
    ...token,
    handle: normalizeHandle(rawHandle),
    displayName: p?.displayName || token.displayName,
    avatar: p?.avatarUrl || token.avatar,
    channelId: p?.channelId || token.channelId,
    verified: p?.verified ?? token.verified,
    description: p?.description ?? token.description,
    followersCount: p?.followersCount ?? record.followers ?? token.followersCount,
    subscribersCount: p?.subscribersCount ?? record.followers ?? token.subscribersCount,
    postsCount: p?.postsCount ?? record.postsCount ?? token.postsCount,
    totalViews: p?.totalViews ?? record.views ?? token.totalViews,
    followingCount: p?.followingCount ?? token.followingCount,
    country: p?.country ?? token.country,
    profileUrl: p?.profileUrl ?? token.profileUrl,
    website: p?.website ?? token.website,
    lastSyncAt: record.syncedAt || new Date().toISOString(),
  };
}

/**
 * Fetch live analytics for one platform via serverless proxy.
 */
export async function ingestPlatformAnalytics(
  platform: string,
  accessToken: string,
  channelId?: string
): Promise<PlatformAnalyticsRecord> {
  const workspaceId = getBrandWorkspaceId();
  const res = await fetch("/api/runtime/social-analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      platform,
      access_token: accessToken,
      channel_id: channelId || "",
      workspace_id: workspaceId || "",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    // SYNC FAILURE — not "no analytics available yet"
    return {
      platform,
      followers: 0,
      views: 0,
      engagementRate: 0,
      watchTimeHours: 0,
      ctrPercent: 0,
      impressions: 0,
      postsCount: 0,
      growthPercent: 0,
      lastSynced: new Date().toISOString(),
      available: false,
      syncFailure: true,
      emptyGenuine: false,
      unavailableReason: `Spark synchronization failed (HTTP ${res.status}): ${text.slice(0, 240)}`,
      content: [],
      profile: null,
      syncedAt: new Date().toISOString(),
      persisted: false,
      persistError: "sync request failed",
    };
  }

  const data = await res.json();
  const a = data.analytics || {};
  const content = a.content || [];
  const emptyGenuine =
    Boolean(a.emptyGenuine) ||
    (Boolean(a.available) &&
      (a.postsCount || 0) === 0 &&
      content.length === 0 &&
      (a.views || 0) === 0);

  return {
    platform: a.platform || platform,
    followers: a.followers || 0,
    views: a.views || 0,
    engagementRate: a.engagementRate || 0,
    watchTimeHours: a.watchTimeHours || 0,
    ctrPercent: a.ctrPercent || 0,
    impressions: a.impressions || 0,
    postsCount: a.postsCount || 0,
    growthPercent: a.growthPercent || 0,
    estimatedRevenue: a.estimatedRevenue ?? null,
    revenueStatus: a.revenueStatus || "Unavailable from Platform",
    lastSynced: a.lastSynced || new Date().toISOString(),
    available: Boolean(a.available),
    unavailableReason: a.unavailableReason,
    content,
    profile: a.profile || null,
    syncedAt: a.lastSynced || new Date().toISOString(),
    syncFailure: Boolean(a.syncFailure) || Boolean(data.syncFailure),
    emptyGenuine,
    emptyMessage: emptyGenuine ? "No analytics available yet" : a.emptyMessage || null,
    persisted: Boolean(data.persisted),
    persistError: data.persistError || null,
  };
}

export type AnalyticsSyncResult = {
  records: PlatformAnalyticsRecord[];
  insights: AnalyticsInsight[];
  profiles: LiveAccountProfileCard[];
};

/**
 * Full sync for all connected OAuth accounts.
 * Call on OAuth connect success and when Analytics opens.
 */
export async function syncConnectedPlatformAnalytics(): Promise<AnalyticsSyncResult> {
  const tokens = Object.values(getStoredAccountTokens()).filter(
    (t) => t.status === "Connected" || t.status === "Refreshing"
  );
  const brandId = getBrandWorkspaceId();
  const map = loadAnalyticsMap();
  const records: PlatformAnalyticsRecord[] = [];
  const profiles: LiveAccountProfileCard[] = [];

  for (const token of tokens) {
    try {
      const access = await socialConnectorFramework.getValidAccessToken(token.platform);
      if (!access) {
        const stale: PlatformAnalyticsRecord = {
          platform: token.platform,
          followers: token.followersCount || 0,
          views: token.totalViews || 0,
          engagementRate: 0,
          watchTimeHours: 0,
          ctrPercent: 0,
          impressions: 0,
          postsCount: token.postsCount || 0,
          growthPercent: 0,
          lastSynced: new Date().toISOString(),
          available: false,
          syncFailure: true,
          emptyGenuine: false,
          unavailableReason:
            "Spark synchronization failed: access token missing or expired — reconnect account",
          content: [],
          profile: null,
          syncedAt: new Date().toISOString(),
        };
        map[token.platform] = stale;
        records.push(stale);
        profiles.push(tokenToProfileCard(token, "token", stale.unavailableReason));
        continue;
      }

      const record = await ingestPlatformAnalytics(
        token.platform,
        access,
        token.channelId
      );
      map[token.platform] = record;
      records.push(record);

      // Enrich local OAuth token cache (feeds existing UI without layout change)
      if (record.profile || record.available) {
        socialConnectorFramework.saveToken(enrichTokenFromAnalytics(token, record), {
          silent: true,
        });
      }

      if (record.profile) {
        const p = record.profile;
        const cardError = record.syncFailure
          ? record.unavailableReason
          : record.emptyGenuine
            ? "No analytics available yet"
            : !record.available
              ? record.unavailableReason
              : undefined;
        profiles.push({
          platform: token.platform,
          displayName: p.displayName,
          username: p.username,
          avatarUrl: p.avatarUrl,
          channelId: p.channelId,
          verified: p.verified,
          followersCount: p.followersCount,
          subscribersCount: p.subscribersCount ?? p.followersCount,
          description: p.description,
          postsCount: p.postsCount ?? record.postsCount,
          totalViews: p.totalViews ?? record.views,
          followingCount: p.followingCount,
          country: p.country,
          publishedAt: p.publishedAt,
          profileUrl: p.profileUrl,
          website: p.website,
          hiddenSubscriberCount: p.hiddenSubscriberCount,
          source: record.syncFailure ? "token" : record.available ? "live" : "cached",
          lastSynced: record.syncedAt,
          error: cardError,
        });
      } else {
        profiles.push(
          tokenToProfileCard(
            token,
            record.syncFailure ? "token" : "cached",
            record.syncFailure
              ? record.unavailableReason
              : record.emptyGenuine
                ? "No analytics available yet"
                : record.unavailableReason
          )
        );
      }

      // Client fallback persist if server did not
      if (brandId && !record.persisted) {
        const clientPersist = await persistSnapshotClient(brandId, record);
        record.persisted = clientPersist.ok;
        record.persistError = clientPersist.error || record.persistError;
      }

      // Executive memory: one learned insight per platform per day (not empty/sync-fail)
      if (brandId && record.available && !record.syncFailure && !record.emptyGenuine) {
        try {
          const dayKey = `spark_analytics_memory_${token.platform}_${new Date().toISOString().slice(0, 10)}`;
          if (!localStorage.getItem(dayKey)) {
            const { persistMemoryCreate } = await import("../backend/workspaceSync");
            
            const sorted = (record.content || []).slice().sort((a, b) => (b.views || 0) - (a.views || 0));
            const top = sorted[0];
            const low = sorted.length > 1 ? sorted[sorted.length - 1] : null;
            
            const workedSection = top 
              ? `• What worked: The post "${top.title}" reached ${top.views?.toLocaleString()} views with ${top.likes?.toLocaleString()} likes. This hook pattern resonated strongly.\n` 
              : `• What worked: General audience reach is active with ${record.views?.toLocaleString()} impressions.\n`;
              
            const failedSection = low && low !== top
              ? `• What failed: The post "${low.title}" had lower velocity (${low.views?.toLocaleString()} views). The hook pattern was weaker.\n`
              : `• What failed: No content failures detected; continue monitoring engagement rates.\n`;
              
            const formatSection = `• Format to Series: Recommend turning high-performing format "${top ? top.title.slice(0, 30) + '...' : 'Short-form'}" into a series.\n`;
            const tryNextSection = `• Try next: Test alternative high-engagement hook patterns and optimize publishing frequency.\n`;
            
            const fullLearningText = `ANALYTICS CLOSED-LOOP LEARNING (${token.platform})\n` +
              `Status: ${record.followers.toLocaleString()} subscribers, ${record.views.toLocaleString()} total views across ${record.postsCount} posts.\n\n` +
              workedSection +
              failedSection +
              formatSection +
              `• Best Account Fit: ${token.platform} verified account.\n` +
              tryNextSection +
              `• Rules Strengthened: Character consistency, Voice guidelines, and Audio hooks.`;

            await persistMemoryCreate(brandId, {
              id: `analytics-${token.platform}-${Date.now()}`,
              type: "learned",
              text: fullLearningText,
              dateAdded: new Date().toISOString().split("T")[0],
              category: "Audience preferences",
            });
            localStorage.setItem(dayKey, "1");
          }
        } catch (memErr) {
          console.warn("[analyticsPipeline] memory write failed", memErr);
        }
      }
    } catch (err: any) {
      console.error("[analyticsPipeline] platform sync failed", token.platform, err);
      const fail: PlatformAnalyticsRecord = {
        platform: token.platform,
        followers: token.followersCount || 0,
        views: token.totalViews || 0,
        engagementRate: 0,
        watchTimeHours: 0,
        ctrPercent: 0,
        impressions: 0,
        postsCount: token.postsCount || 0,
        growthPercent: 0,
        lastSynced: new Date().toISOString(),
        available: false,
        syncFailure: true,
        emptyGenuine: false,
        unavailableReason: `Spark synchronization failed: ${err?.message || "unknown error"}`,
        content: [],
        profile: null,
        syncedAt: new Date().toISOString(),
      };
      map[token.platform] = fail;
      records.push(fail);
      profiles.push(tokenToProfileCard(token, "token", fail.unavailableReason));
    }
  }

  saveAnalyticsMap(map);

  const insights = platformAnalyticsToInsights(records);

  // Merge into persisted Spark state for existing consumers (analyticsInsights)
  try {
    const state = loadPersistedState<any>() || {};
    savePersistedState({
      ...state,
      analyticsInsights: insights,
      platformAnalytics: map,
    });
  } catch (e) {
    console.warn("[analyticsPipeline] state merge failed", e);
  }

  // Notify runtime
  try {
    window.dispatchEvent(
      new CustomEvent("spark-analytics-synced", {
        detail: { platforms: records.map((r) => r.platform), count: records.length },
      })
    );
  } catch {
    /* ignore */
  }

  return { records, insights, profiles };
}

function tokenToProfileCard(
  token: ConnectedAccountToken,
  source: LiveAccountProfileCard["source"],
  error?: string
): LiveAccountProfileCard {
  const cleanHandle = normalizeHandle(token.handle);
  return {
    platform: token.platform,
    displayName: token.displayName || cleanHandle || token.platform,
    username: cleanHandle,
    avatarUrl: token.avatar || "",
    channelId: token.channelId || "",
    verified: Boolean(token.verified),
    followersCount: token.followersCount ?? 0,
    subscribersCount: token.subscribersCount ?? token.followersCount,
    description: token.description || "",
    postsCount: token.postsCount,
    totalViews: token.totalViews,
    followingCount: token.followingCount,
    country: token.country,
    profileUrl: token.profileUrl,
    website: token.website,
    source,
    lastSynced: token.lastSyncAt,
    error,
  };
}

/** Adapter bridge: real fetchAnalytics via pipeline proxy */
export async function fetchAnalyticsViaPipeline(
  platform: string,
  accessToken: string
): Promise<PlatformAnalyticsData> {
  const record = await ingestPlatformAnalytics(platform, accessToken);
  return {
    platform: record.platform,
    followers: record.followers,
    views: record.views,
    engagementRate: record.engagementRate,
    watchTimeHours: record.watchTimeHours,
    ctrPercent: record.ctrPercent,
    impressions: record.impressions,
    postsCount: record.postsCount,
    growthPercent: record.growthPercent,
    lastSynced: record.lastSynced,
    available: record.available,
    unavailableReason: record.unavailableReason,
  };
}
