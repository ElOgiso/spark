import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { refresh_token, workspace_id } = req.body || {};

    if (!refresh_token) {
      return res.status(400).json({ error: "Missing refresh_token" });
    }

    const clientId =
      process.env.X_CLIENT_ID || process.env.VITE_TWITTER_CLIENT_ID || "";
    const clientSecret = process.env.X_CLIENT_SECRET || "";

    if (!clientSecret) {
      return res
        .status(500)
        .json({ error: "X_CLIENT_SECRET not configured on server" });
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
        grant_type: "refresh_token",
        refresh_token,
        client_id: clientId,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return res.status(tokenRes.status).json({
        error: "X token refresh failed",
        detail: errText,
        status: tokenRes.status,
      });
    }

    const tokenData = await tokenRes.json();

    if (workspace_id && UUID_RE.test(workspace_id)) {
      const supabaseUrl =
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
      const supabaseKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        "";
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: row } = await (supabase.from("accounts") as any)
          .select("id, permissions")
          .eq("brand_id", workspace_id)
          .eq("platform", "Twitter/X")
          .maybeSingle();
        if (row?.id) {
          const prev =
            row.permissions && typeof row.permissions === "object"
              ? row.permissions
              : {};
          const expiresAtMs =
            Date.now() + (tokenData.expires_in || 7200) * 1000;
          await (supabase.from("accounts") as any)
            .update({
              status: "connected",
              last_sync_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              permissions: {
                ...prev,
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token || refresh_token,
                expires_at: Math.floor(expiresAtMs / 1000),
              },
            })
            .eq("id", row.id);
        }
      }
    }

    return res.status(200).json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || refresh_token,
      expires_in: tokenData.expires_in || 7200,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
