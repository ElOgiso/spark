import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeHandle(raw: string | null | undefined): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  return "@" + s.replace(/^@+/, "");
}

/**
 * Phase 6J — Live multi-platform analytics ingestion proxy.
 * Body: { platform, access_token, channel_id?, workspace_id? }
 * Persists to analytics_snapshots with service role when workspace_id is a brand UUID.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { platform, access_token, channel_id, workspace_id } = req.body || {};
    if (!access_token) {
      return res.status(400).json({
        error: "Missing access_token",
        syncFailure: true,
        emptyGenuine: false,
      });
    }
    if (!platform) {
      return res.status(400).json({
        error: "Missing platform",
        syncFailure: true,
        emptyGenuine: false,
      });
    }

    const p = String(platform).toLowerCase();
    const lastSynced = new Date().toISOString();
    let payload: any;

    if (p.includes("youtube")) {
      payload = await ingestYouTube(access_token, channel_id);
    } else if (p.includes("twitter") || p === "x" || p.includes("twitter/x")) {
      payload = await ingestX(access_token, channel_id);
    } else if (p.includes("tiktok")) {
      payload = unavailable(
        "TikTok",
        "This platform does not expose analytics through Spark yet (OAuth adapter not connected)."
      );
    } else if (p.includes("instagram")) {
      payload = unavailable(
        "Instagram",
        "This platform does not expose analytics through Spark yet (OAuth adapter not connected)."
      );
    } else if (p.includes("facebook")) {
      payload = unavailable(
        "Facebook",
        "This platform does not expose analytics through Spark yet (OAuth adapter not connected)."
      );
    } else if (p.includes("linkedin")) {
      payload = unavailable(
        "LinkedIn",
        "This platform does not expose analytics through Spark yet (OAuth adapter not connected)."
      );
    } else {
      return res.status(400).json({
        error: `Analytics ingestion not implemented for platform: ${platform}`,
        syncFailure: true,
        emptyGenuine: false,
      });
    }

    // Classify empty vs available
    const contentLen = Array.isArray(payload.content) ? payload.content.length : 0;
    const emptyGenuine =
      Boolean(payload.available) &&
      (payload.postsCount || 0) === 0 &&
      contentLen === 0 &&
      (payload.views || 0) === 0;

    const analytics = {
      ...payload,
      lastSynced,
      syncFailure: false,
      emptyGenuine,
      emptyMessage: emptyGenuine ? "No analytics available yet" : null,
    };

    // Server-side Supabase persist (bypasses browser RLS with service role)
    let persisted = false;
    let persistError: string | null = null;
    if (workspace_id && UUID_RE.test(String(workspace_id))) {
      const persist = await persistAnalyticsSnapshot(String(workspace_id), analytics);
      persisted = persist.ok;
      persistError = persist.error || null;
    } else {
      persistError = "workspace_id missing or not a brand UUID — snapshot not written";
    }

    return res.status(200).json({
      analytics,
      persisted,
      persistError,
      table: "analytics_snapshots",
    });
  } catch (err: any) {
    console.error("[social-analytics]", err);
    return res.status(500).json({
      error: err.message || String(err),
      syncFailure: true,
      emptyGenuine: false,
    });
  }
}

async function persistAnalyticsSnapshot(
  brandId: string,
  analytics: any
): Promise<{ ok: boolean; error?: string }> {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "";
  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, error: "Supabase env missing on server" };
  }
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const now = new Date().toISOString();
    const row = {
      brand_id: brandId,
      production_id: null,
      platform: analytics.platform || null,
      metrics: {
        followers: analytics.followers || 0,
        views: analytics.views || 0,
        engagementRate: analytics.engagementRate || 0,
        watchTimeHours: analytics.watchTimeHours || 0,
        impressions: analytics.impressions || 0,
        postsCount: analytics.postsCount || 0,
        growthPercent: analytics.growthPercent || 0,
        content: (analytics.content || []).slice(0, 15),
        profile: analytics.profile || null,
        available: Boolean(analytics.available),
        emptyGenuine: Boolean(analytics.emptyGenuine),
        syncFailure: Boolean(analytics.syncFailure),
        unavailableReason: analytics.unavailableReason || null,
      },
      insight: analytics.available
        ? `${analytics.platform}: ${analytics.followers} audience · ${analytics.views} views · ${analytics.postsCount} posts`
        : analytics.unavailableReason || "unavailable",
      recommendation: analytics.emptyGenuine
        ? "No analytics available yet"
        : analytics.available
          ? "Live platform metrics synchronized."
          : analytics.unavailableReason || "Platform analytics not available.",
      captured_at: now,
    };
    const { error } = await (supabase.from("analytics_snapshots") as any).insert(row);
    if (error) {
      console.error("[social-analytics] insert analytics_snapshots failed:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

function unavailable(platform: string, reason: string) {
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
    estimatedRevenue: null,
    revenueStatus: "Unavailable from Platform",
    lastSynced: new Date().toISOString(),
    available: false,
    unavailableReason: reason,
    content: [],
    profile: null,
    syncFailure: false,
    emptyGenuine: false,
    platformNotExposed: true,
  };
}

async function ingestYouTube(accessToken: string, channelId?: string) {
  let channel: any = null;

  // 1) Prefer direct channel lookup if channelId / handle provided
  if (channelId && typeof channelId === "string" && channelId.trim()) {
    const rawId = channelId.trim();
    if (rawId.startsWith("@")) {
      const cleanHandle = normalizeHandle(rawId).replace(/^@+/, "");
      try {
        const handleRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,status&forHandle=${encodeURIComponent(cleanHandle)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (handleRes.ok) {
          const handleData = await handleRes.json();
          if (handleData?.items?.[0]) {
            channel = handleData.items[0];
          }
        }
      } catch (err) {
        console.warn("[social-analytics] YouTube channels forHandle fetch error:", err);
      }
    } else {
      try {
        const idRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,status&id=${encodeURIComponent(rawId)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (idRes.ok) {
          const idData = await idRes.json();
          if (idData?.items?.[0]) {
            channel = idData.items[0];
          }
        }
      } catch (err) {
        console.warn("[social-analytics] YouTube channels id fetch error:", err);
      }
    }
  }

  // Fallback to mine=true (always available with youtube.readonly)
  if (!channel) {
    const chRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,status&mine=true",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const chText = await chRes.text();
    if (!chRes.ok) {
      throw new Error(`YouTube channels API ${chRes.status}: ${chText.slice(0, 400)}`);
    }
    const chData = JSON.parse(chText);
    channel = chData?.items?.[0];
  }
  if (!channel) {
    return {
      platform: "YouTube Shorts",
      followers: 0,
      views: 0,
      engagementRate: 0,
      watchTimeHours: 0,
      ctrPercent: 0,
      impressions: 0,
      postsCount: 0,
      growthPercent: 0,
      estimatedRevenue: null,
      revenueStatus: "Unavailable from Platform",
      available: true,
      emptyGenuine: true,
      emptyMessage: "No analytics available yet",
      unavailableReason: undefined,
      content: [],
      profile: null,
      syncFailure: false,
    };
  }

  const subs = parseInt(channel.statistics?.subscriberCount || "0", 10);
  const views = parseInt(channel.statistics?.viewCount || "0", 10);
  const videoCount = parseInt(channel.statistics?.videoCount || "0", 10);
  const title = channel.snippet?.title || "YouTube Channel";
  const customUrl = channel.snippet?.customUrl || "";
  const rawHandle = customUrl || title.toLowerCase().replace(/\s+/g, "");
  const username = normalizeHandle(rawHandle);

  // 2) Recent uploads with per-video stats (existing content)
  let content: any[] = [];
  try {
    const searchUrl = channel.id
      ? `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channel.id)}&type=video&order=date&maxResults=15`
      : "https://www.googleapis.com/youtube/v3/search?part=snippet&forMine=true&type=video&order=date&maxResults=15";
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const ids = (searchData.items || [])
        .map((it: any) => it.id?.videoId)
        .filter(Boolean);
      if (ids.length > 0) {
        const statsRes = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(",")}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          content = (statsData.items || []).map((v: any) => ({
            id: v.id,
            title: v.snippet?.title || "Untitled",
            publishedAt: v.snippet?.publishedAt || "",
            thumbnail:
              v.snippet?.thumbnails?.medium?.url ||
              v.snippet?.thumbnails?.default?.url ||
              "",
            views: parseInt(v.statistics?.viewCount || "0", 10),
            likes: parseInt(v.statistics?.likeCount || "0", 10),
            comments: parseInt(v.statistics?.commentCount || "0", 10),
            url: `https://www.youtube.com/watch?v=${v.id}`,
          }));
        }
      }
    }
  } catch (e) {
    console.warn("[social-analytics] YouTube content list partial fail", e);
  }

  // 3) Optional YouTube Analytics API (28d) — includes estimatedRevenue when monetized
  let watchTimeHours = 0;
  let growthPercent = 0;
  let impressions = 0;
  let engagementRate = 0;
  let estimatedRevenue: number | null = null;
  let revenueStatus = "Unavailable from Platform";
  let analyticsAvailable = true;
  let analyticsNote: string | undefined;

  try {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 28);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);
    const reportUrl =
      `https://youtubeanalytics.googleapis.com/v2/reports` +
      `?ids=channel==MINE&startDate=${startDate}&endDate=${endDate}` +
      `&metrics=views,estimatedMinutesWatched,subscribersGained,subscribersLost,likes,comments,shares,averageViewDuration,estimatedRevenue` +
      `&dimensions=`;

    const aRes = await fetch(reportUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (aRes.ok) {
      const aData = await aRes.json();
      const row = aData?.rows?.[0];
      const headers: string[] = aData?.columnHeaders?.map((h: any) => h.name) || [];
      if (row && headers.length) {
        const idx = (name: string) => headers.indexOf(name);
        const views28 = Number(row[idx("views")] || 0);
        const minutes = Number(row[idx("estimatedMinutesWatched")] || 0);
        const subGained = Number(row[idx("subscribersGained")] || 0);
        const subLost = Number(row[idx("subscribersLost")] || 0);
        const likes = Number(row[idx("likes")] || 0);
        const comments = Number(row[idx("comments")] || 0);
        const revIdx = idx("estimatedRevenue");
        if (revIdx >= 0 && row[revIdx] != null) {
          estimatedRevenue = Math.round(Number(row[revIdx]) * 100) / 100;
          revenueStatus = "Available";
        }
        watchTimeHours = Math.round((minutes / 60) * 10) / 10;
        growthPercent =
          subs > 0
            ? Math.round(((subGained - subLost) / Math.max(subs, 1)) * 1000) / 10
            : subGained - subLost;
        impressions = views28;
        if (views28 > 0) {
          engagementRate =
            Math.round(((likes + comments) / views28) * 1000) / 10;
        }
      }
    } else {
      analyticsAvailable = true; // channel stats still real
      analyticsNote = `YouTube Analytics API ${aRes.status} — using channel statistics`;
      console.warn("[social-analytics] YT Analytics report:", aRes.status, await aRes.text());
    }
  } catch (e) {
    analyticsNote = "YouTube Analytics report unavailable — using channel statistics";
    console.warn("[social-analytics] YT Analytics exception", e);
  }

  // Engagement from recent content if report empty
  if (!engagementRate && content.length > 0) {
    const totV = content.reduce((s, c) => s + (c.views || 0), 0);
    const totE = content.reduce((s, c) => s + (c.likes || 0) + (c.comments || 0), 0);
    if (totV > 0) engagementRate = Math.round((totE / totV) * 1000) / 10;
  }

  return {
    platform: "YouTube Shorts",
    followers: subs,
    views,
    engagementRate,
    watchTimeHours,
    ctrPercent: 0,
    impressions: impressions || views,
    postsCount: videoCount,
    growthPercent,
    estimatedRevenue,
    revenueStatus,
    available: true,
    unavailableReason: analyticsNote,
    content,
    profile: {
      platform: "YouTube Shorts",
      displayName: title,
      username,
      avatarUrl:
        channel.snippet?.thumbnails?.high?.url ||
        channel.snippet?.thumbnails?.medium?.url ||
        channel.snippet?.thumbnails?.default?.url ||
        "",
      description: channel.snippet?.description || "",
      channelId: channel.id,
      verified: Boolean(channel.status?.isLinked),
      followersCount: subs,
      subscribersCount: subs,
      postsCount: videoCount,
      totalViews: views,
      country: channel.snippet?.country || "",
      publishedAt: channel.snippet?.publishedAt || "",
      profileUrl: channel.id
        ? `https://www.youtube.com/channel/${channel.id}`
        : "https://www.youtube.com",
      hiddenSubscriberCount: Boolean(channel.statistics?.hiddenSubscriberCount),
    },
  };
}

async function ingestX(accessToken: string, channelId?: string) {
  const meRes = await fetch(
    "https://api.twitter.com/2/users/me?user.fields=profile_image_url,public_metrics,verified,description,created_at,url,location,username,name",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meText = await meRes.text();
  if (!meRes.ok) {
    throw new Error(`X users/me ${meRes.status}: ${meText.slice(0, 400)}`);
  }
  const meData = JSON.parse(meText);
  const u = meData?.data;
  if (!u) {
    return unavailable("Twitter/X", "No X user profile for token");
  }

  const followers = u.public_metrics?.followers_count || 0;
  const following = u.public_metrics?.following_count || 0;
  const tweets = u.public_metrics?.tweet_count || 0;
  const listed = u.public_metrics?.listed_count || 0;

  let content: any[] = [];
  let impressions = 0;
  let likes = 0;
  let replies = 0;
  let retweets = 0;

  try {
    const userId = channelId || u.id;
    const tRes = await fetch(
      `https://api.twitter.com/2/users/${userId}/tweets?max_results=10&exclude=replies,retweets&tweet.fields=public_metrics,created_at,text`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (tRes.ok) {
      const tData = await tRes.json();
      content = (tData.data || []).map((t: any) => {
        const m = t.public_metrics || {};
        impressions += m.impression_count || 0;
        likes += m.like_count || 0;
        replies += m.reply_count || 0;
        retweets += m.retweet_count || 0;
        return {
          id: t.id,
          title: (t.text || "").slice(0, 120),
          publishedAt: t.created_at || "",
          views: m.impression_count || 0,
          likes: m.like_count || 0,
          comments: m.reply_count || 0,
          shares: m.retweet_count || 0,
          url: u.username ? `https://x.com/${u.username}/status/${t.id}` : "",
        };
      });
    }
  } catch (e) {
    console.warn("[social-analytics] X tweets partial fail", e);
  }

  const engagementRate =
    impressions > 0
      ? Math.round(((likes + replies + retweets) / impressions) * 1000) / 10
      : 0;

  return {
    platform: "Twitter/X",
    followers,
    views: impressions,
    engagementRate,
    watchTimeHours: 0,
    ctrPercent: 0,
    impressions: impressions || listed,
    postsCount: tweets,
    growthPercent: 0,
    available: true,
    content,
    profile: {
      platform: "Twitter/X",
      displayName: u.name || "X User",
      username: u.username ? `@${u.username}` : "",
      avatarUrl: (u.profile_image_url || "").replace("_normal", "_400x400"),
      description: u.description || "",
      channelId: u.id,
      verified: Boolean(u.verified),
      followersCount: followers,
      subscribersCount: followers,
      postsCount: tweets,
      followingCount: following,
      totalViews: impressions,
      country: u.location || "",
      publishedAt: u.created_at || "",
      profileUrl: u.username ? `https://x.com/${u.username}` : "https://x.com",
      website: u.url || "",
    },
  };
}
