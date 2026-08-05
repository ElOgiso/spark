import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function upsertConnectedAccount(input: {
  brandId: string;
  platform: string;
  handle: string;
  displayName: string;
  avatar?: string;
  platformUserId?: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresInSeconds?: number;
  scopes?: string[];
  extraPermissions?: Record<string, unknown>;
}): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_RE.test(input.brandId)) {
    return { ok: false, error: "workspace_id is not a brand UUID" };
  }
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

  const supabase = createClient(supabaseUrl, supabaseKey);
  const now = new Date().toISOString();
  const expiresAtMs = Date.now() + (input.expiresInSeconds || 3600) * 1000;
  const payload = {
    brand_id: input.brandId,
    platform: input.platform,
    handle: input.handle,
    display_name: input.displayName,
    status: "connected",
    permissions: {
      access_token: input.accessToken,
      refresh_token: input.refreshToken || null,
      expires_at: Math.floor(expiresAtMs / 1000),
      platform_user_id: input.platformUserId || null,
      avatar: input.avatar || null,
      scopes: input.scopes || [],
      ...(input.extraPermissions || {}),
    },
    connected_at: now,
    last_sync_at: now,
    updated_at: now,
  };

  const { error } = await (supabase.from("accounts") as any).upsert(payload, {
    onConflict: "brand_id,platform",
  });
  if (error) {
    const existing = await (supabase.from("accounts") as any)
      .select("id")
      .eq("brand_id", input.brandId)
      .eq("platform", input.platform)
      .maybeSingle();
    if (existing?.data?.id) {
      const { error: uErr } = await (supabase.from("accounts") as any)
        .update(payload)
        .eq("id", existing.data.id);
      if (uErr) return { ok: false, error: uErr.message };
    } else {
      const { error: iErr } = await (supabase.from("accounts") as any).insert(
        payload
      );
      if (iErr) return { ok: false, error: iErr.message };
    }
  }
  return { ok: true };
}

async function fetchYouTubeChannel(accessToken: string): Promise<{
  profile: any | null;
  apiStatus: number | null;
  apiBody: string;
}> {
  try {
    const profileRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const apiBody = await profileRes.text();
    console.log("[google/callback] YouTube channels status:", profileRes.status);

    if (!profileRes.ok) {
      return { profile: null, apiStatus: profileRes.status, apiBody };
    }

    let profileData: any = {};
    try {
      profileData = JSON.parse(apiBody);
    } catch {
      return { profile: null, apiStatus: profileRes.status, apiBody };
    }

    if (profileData?.items?.[0]) {
      const item = profileData.items[0];
      return {
        profile: {
          displayName: item.snippet.title,
          username: `@${
            item.snippet.customUrl ||
            item.snippet.title.toLowerCase().replace(/\s+/g, "")
          }`,
          avatarUrl: item.snippet.thumbnails?.default?.url || "",
          channelId: item.id,
          subscriberCount: parseInt(item.statistics?.subscriberCount || "0", 10),
          viewCount: parseInt(item.statistics?.viewCount || "0", 10),
          videoCount: parseInt(item.statistics?.videoCount || "0", 10),
          source: "youtube_channel",
          hasYouTubeChannel: true,
        },
        apiStatus: profileRes.status,
        apiBody,
      };
    }

    // 200 but empty items = Google account has no YouTube channel yet
    return {
      profile: null,
      apiStatus: profileRes.status,
      apiBody: apiBody || '{"items":[]}',
    };
  } catch (err: any) {
    console.error("[google/callback] YouTube fetch exception:", err);
    return {
      profile: null,
      apiStatus: null,
      apiBody: err?.message || String(err),
    };
  }
}

async function fetchGoogleUserInfo(accessToken: string): Promise<any | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.warn("[google/callback] userinfo status:", res.status, await res.text());
      return null;
    }
    const u = await res.json();
    const name = u.name || u.email || "Google User";
    const handleBase = (u.email || u.sub || name)
      .split("@")[0]
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .toLowerCase();
    return {
      displayName: name,
      username: `@${handleBase || "youtube"}`,
      avatarUrl: u.picture || "",
      channelId: u.sub || "",
      email: u.email || "",
      subscriberCount: 0,
      viewCount: 0,
      videoCount: 0,
      source: "google_userinfo",
      hasYouTubeChannel: false,
    };
  } catch (err) {
    console.error("[google/callback] userinfo exception:", err);
    return null;
  }
}

/**
 * Server-side Google OAuth token exchange + YouTube/Google profile + accounts persist.
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
    const { code, redirect_uri, workspace_id, state } = req.body || {};

    console.log("[api/auth/google/callback] Received POST", {
      codeExists: !!code,
      redirect_uri,
      workspace_id,
      state,
    });

    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }

    const clientId =
      process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

    if (!clientSecret) {
      return res
        .status(500)
        .json({ error: "GOOGLE_CLIENT_SECRET not configured on server" });
    }
    if (!clientId) {
      return res
        .status(500)
        .json({ error: "GOOGLE_CLIENT_ID not configured on server" });
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirect_uri || "",
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return res.status(tokenRes.status).json({
        error: "Google token exchange failed",
        detail: errText,
        status: tokenRes.status,
      });
    }

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(400).json({
        error: "Google token exchange returned no access_token",
        detail: tokenData,
      });
    }

    // 1) Prefer YouTube channel profile
    const yt = await fetchYouTubeChannel(tokenData.access_token);
    let profile = yt.profile;

    // 2) Fallback: Google account profile (no channel / API issue / empty items)
    if (!profile) {
      console.warn("[google/callback] No YouTube channel profile; trying userinfo", {
        youtubeStatus: yt.apiStatus,
        youtubeBodyPreview: (yt.apiBody || "").slice(0, 400),
      });
      profile = await fetchGoogleUserInfo(tokenData.access_token);
    }

    if (!profile) {
      // Distinguish common failure modes for the user-facing UI
      const body = (yt.apiBody || "").toLowerCase();
      let hint =
        "Token was issued, but neither YouTube channel nor Google profile could be loaded.";
      if (yt.apiStatus === 403 || body.includes("accessnotconfigured") || body.includes("has not been used") || body.includes("disabled")) {
        hint =
          "Enable YouTube Data API v3 in Google Cloud Console for this project, then reconnect.";
      } else if (yt.apiStatus === 200 && (body.includes('"items":[]') || body.includes('"items": []'))) {
        hint =
          "This Google account has no YouTube channel yet. Create a channel on YouTube, then reconnect. Also ensure openid/userinfo scopes are allowed.";
      } else if (yt.apiStatus === 401) {
        hint = "Access token rejected by YouTube API. Reconnect and re-consent all permissions.";
      }

      return res.status(400).json({
        error: "Could not retrieve YouTube profile information.",
        hint,
        youtubeStatus: yt.apiStatus,
        youtubeDetail: (yt.apiBody || "").slice(0, 800),
      });
    }

    let persistResult: { ok: boolean; error?: string } | null = null;
    if (workspace_id && UUID_RE.test(String(workspace_id))) {
      try {
        persistResult = await upsertConnectedAccount({
          brandId: workspace_id,
          platform: "YouTube Shorts",
          handle: profile.username,
          displayName: profile.displayName,
          avatar: profile.avatarUrl,
          platformUserId: profile.channelId,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || null,
          expiresInSeconds: tokenData.expires_in || 3600,
          scopes: (tokenData.scope || "").split(" ").filter(Boolean),
          extraPermissions: {
            has_youtube_channel: Boolean(profile.hasYouTubeChannel),
            profile_source: profile.source || "unknown",
            email: profile.email || null,
          },
        });
        if (!persistResult.ok) {
          console.error("[google/callback] persist failed:", persistResult.error);
        }
      } catch (persistErr) {
        console.error("[google/callback] persist error:", persistErr);
        persistResult = { ok: false, error: String(persistErr) };
      }
    } else {
      console.warn(
        "[google/callback] No brand UUID workspace_id — tokens returned to client only"
      );
    }

    return res.status(200).json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      expires_in: tokenData.expires_in || 3600,
      token_type: tokenData.token_type || "Bearer",
      scope: tokenData.scope || "",
      profile,
      workspace_persisted: Boolean(persistResult?.ok),
      workspace_persist_error: persistResult?.error || null,
      warning: profile.hasYouTubeChannel
        ? null
        : "Connected with Google account profile. No YouTube channel was found for this account yet.",
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
