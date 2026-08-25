import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Proxy live social profile fetches (avoids browser CORS on platform APIs).
 * Body: { platform: string, access_token: string }
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
    const { platform, access_token } = req.body || {};
    if (!access_token) {
      return res.status(400).json({ error: "Missing access_token" });
    }
    if (!platform) {
      return res.status(400).json({ error: "Missing platform" });
    }

    const p = String(platform).toLowerCase();

    if (p.includes("youtube")) {
      const profile = await fetchYouTubeProfile(access_token);
      if (!profile) {
        return res.status(404).json({
          error: "No YouTube channel found for this Google account",
        });
      }
      return res.status(200).json({ profile });
    }

    if (p.includes("twitter") || p === "x" || p.includes("twitter/x")) {
      const profile = await fetchXProfile(access_token);
      if (!profile) {
        return res.status(404).json({ error: "No X profile found for this token" });
      }
      return res.status(200).json({ profile });
    }

    return res.status(400).json({
      error: `Live profile fetch not yet available for platform: ${platform}`,
    });
  } catch (err: any) {
    console.error("[social-profile]", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}

function normalizeHandle(raw: string | null | undefined): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  return "@" + s.replace(/^@+/, "");
}

async function fetchYouTubeProfile(accessToken: string) {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings,status&mine=true",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`YouTube API ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = JSON.parse(text);
  const item = data?.items?.[0];
  if (!item) return null;

  const title = item.snippet?.title || "YouTube Channel";
  const customUrl = item.snippet?.customUrl || "";
  const rawHandle = customUrl || title.toLowerCase().replace(/\s+/g, "");
  const username = normalizeHandle(rawHandle);

  return {
    platform: "YouTube Shorts",
    displayName: title,
    username,
    avatarUrl:
      item.snippet?.thumbnails?.high?.url ||
      item.snippet?.thumbnails?.medium?.url ||
      item.snippet?.thumbnails?.default?.url ||
      "",
    description: item.snippet?.description || "",
    channelId: item.id || "",
    verified: Boolean(item.status?.isLinked),
    followersCount: parseInt(item.statistics?.subscriberCount || "0", 10),
    subscribersCount: parseInt(item.statistics?.subscriberCount || "0", 10),
    postsCount: parseInt(item.statistics?.videoCount || "0", 10),
    totalViews: parseInt(item.statistics?.viewCount || "0", 10),
    country: item.snippet?.country || item.brandingSettings?.channel?.country || "",
    publishedAt: item.snippet?.publishedAt || "",
    profileUrl: customUrl
      ? `https://www.youtube.com/${customUrl.startsWith("@") ? customUrl : "@" + customUrl}`
      : item.id
        ? `https://www.youtube.com/channel/${item.id}`
        : "https://www.youtube.com",
    hiddenSubscriberCount: Boolean(item.statistics?.hiddenSubscriberCount),
  };
}

async function fetchXProfile(accessToken: string) {
  const res = await fetch(
    "https://api.twitter.com/2/users/me?user.fields=profile_image_url,public_metrics,verified,description,created_at,url,location,username,name",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`X API ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = JSON.parse(text);
  const u = data?.data;
  if (!u) return null;

  return {
    platform: "Twitter/X",
    displayName: u.name || "X User",
    username: u.username ? `@${u.username}` : "",
    avatarUrl: (u.profile_image_url || "").replace("_normal", "_400x400"),
    description: u.description || "",
    channelId: u.id || "",
    verified: Boolean(u.verified),
    followersCount: u.public_metrics?.followers_count || 0,
    subscribersCount: u.public_metrics?.followers_count || 0,
    postsCount: u.public_metrics?.tweet_count || 0,
    totalViews: 0,
    followingCount: u.public_metrics?.following_count || 0,
    country: u.location || "",
    publishedAt: u.created_at || "",
    profileUrl: u.username ? `https://x.com/${u.username}` : "https://x.com",
    website: u.url || "",
  };
}
