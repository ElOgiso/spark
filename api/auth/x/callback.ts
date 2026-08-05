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
}): Promise<void> {
  if (!UUID_RE.test(input.brandId)) {
    console.warn("[x/callback] skip persist: workspace_id is not a UUID");
    return;
  }
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "";
  if (!supabaseUrl || !supabaseKey) {
    console.warn("[x/callback] skip persist: Supabase env missing");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const now = new Date().toISOString();
  const expiresAtMs = Date.now() + (input.expiresInSeconds || 7200) * 1000;
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
      if (uErr) console.error("[x/callback] update failed:", uErr);
    } else {
      const { error: iErr } = await (supabase.from("accounts") as any).insert(
        payload
      );
      if (iErr) console.error("[x/callback] insert failed:", iErr);
    }
  }
}

/**
 * Server-side X (Twitter) OAuth 2.0 PKCE token exchange.
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
    const { code, code_verifier, redirect_uri, workspace_id, state } =
      req.body || {};

    if (!code) return res.status(400).json({ error: "Missing authorization code" });
    if (!code_verifier) {
      return res.status(400).json({ error: "Missing PKCE code_verifier" });
    }

    const clientId =
      process.env.X_CLIENT_ID || process.env.VITE_TWITTER_CLIENT_ID || "";
    const clientSecret = process.env.X_CLIENT_SECRET || "";

    if (!clientSecret) {
      return res
        .status(500)
        .json({ error: "X_CLIENT_SECRET not configured on server" });
    }
    if (!clientId) {
      return res
        .status(500)
        .json({ error: "X_CLIENT_ID not configured on server" });
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64"
    );

    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: redirect_uri || "",
        code_verifier,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return res.status(tokenRes.status).json({
        error: "X token exchange failed",
        detail: errText,
        status: tokenRes.status,
      });
    }

    const tokenData = await tokenRes.json();

    let profile: any = null;
    try {
      const profileRes = await fetch(
        "https://api.twitter.com/2/users/me?user.fields=profile_image_url,public_metrics,verified,description",
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
      );
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        if (profileData?.data) {
          const u = profileData.data;
          profile = {
            displayName: u.name,
            username: `@${u.username}`,
            avatarUrl: u.profile_image_url || "",
            userId: u.id,
            verified: Boolean(u.verified),
            followersCount: u.public_metrics?.followers_count || 0,
            followingCount: u.public_metrics?.following_count || 0,
            tweetCount: u.public_metrics?.tweet_count || 0,
          };
        }
      }
    } catch (profileErr) {
      console.error("[x/callback] Profile fetch error:", profileErr);
    }

    if (!profile) {
      return res
        .status(400)
        .json({ error: "Could not retrieve X profile information." });
    }

    if (workspace_id) {
      try {
        await upsertConnectedAccount({
          brandId: workspace_id,
          platform: "Twitter/X",
          handle: profile.username,
          displayName: profile.displayName,
          avatar: profile.avatarUrl,
          platformUserId: profile.userId,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || null,
          expiresInSeconds: tokenData.expires_in || 7200,
          scopes: (tokenData.scope || "").split(" ").filter(Boolean),
        });
      } catch (persistErr) {
        console.error("[x/callback] persist error:", persistErr);
      }
    }

    return res.status(200).json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      expires_in: tokenData.expires_in || 7200,
      token_type: tokenData.token_type || "Bearer",
      scope: tokenData.scope || "",
      profile,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
