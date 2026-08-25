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
      process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

    if (!clientSecret) {
      return res
        .status(500)
        .json({ error: "GOOGLE_CLIENT_SECRET not configured on server" });
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.warn("[api/auth/google/refresh] Refresh failed:", tokenRes.status, errText);

      // If invalid_grant / revoked, update row status to needs_reconnect
      if (workspace_id && UUID_RE.test(workspace_id) && (tokenRes.status === 400 || tokenRes.status === 401)) {
        try {
          const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
          if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey);
            await (supabase.from("accounts") as any)
              .update({
                status: "needs_reconnect",
                updated_at: new Date().toISOString(),
              })
              .eq("brand_id", workspace_id)
              .in("platform", ["youtube", "YouTube Shorts", "YouTube"]);
          }
        } catch (dbErr) {
          console.warn("[api/auth/google/refresh] Failed to set needs_reconnect in DB:", dbErr);
        }
      }

      return res.status(tokenRes.status).json({
        error: "Google token refresh failed",
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
        const { data: rows } = await (supabase.from("accounts") as any)
          .select("id, permissions")
          .eq("brand_id", workspace_id)
          .in("platform", ["youtube", "YouTube Shorts", "YouTube"])
          .limit(1);
        const row = rows?.[0];
        if (row?.id) {
          const prev =
            row.permissions && typeof row.permissions === "object"
              ? row.permissions
              : {};
          const expiresAtMs =
            Date.now() + (tokenData.expires_in || 3600) * 1000;
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
      expires_in: tokenData.expires_in || 3600,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || String(err) });
  }
}
