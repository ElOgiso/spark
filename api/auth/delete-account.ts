import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

/**
 * Serverless API endpoint to securely delete all data owned by the authenticated caller.
 * Authenticates via the caller's JWT bearer token (auth.uid()).
 * Never allows modifying or deleting other users' rows.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://jaqzjhabmtvqtvinoafq.supabase.co";
    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      "sb_publishable_vMsNKA4Icb2BD9SzgBTz4A_DTmSnwWb";
    const supabaseAnonKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      "sb_publishable_vMsNKA4Icb2BD9SzgBTz4A_DTmSnwWb";

    if (!token) {
      return res.status(401).json({ error: "Missing authorization bearer token" });
    }

    // 1. Authenticate caller strictly using token to extract their true auth.uid()
    const authVerifier = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: userError } = await authVerifier.auth.getUser(token);

    if (userError || !userData?.user?.id) {
      return res.status(401).json({ error: "Invalid or expired authorization token", detail: userError?.message });
    }

    const userId = userData.user.id;
    console.log(`[delete-account API] Initiating full cascade account wipe for user: ${userId}`);

    // 2. Admin client with Service Role key to clean all user-owned rows across tables
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Find all brands owned by this user
    const { data: userBrands, error: brandsQueryErr } = await (adminClient.from("brands") as any)
      .select("id")
      .eq("owner_id", userId);

    if (brandsQueryErr) {
      console.warn("[delete-account API] Notice querying user brands:", brandsQueryErr);
    }

    const brandIds = (userBrands || []).map((b: any) => b.id).filter(Boolean);

    // 4. Delete child records for all brands owned by this user
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

    if (brandIds.length > 0) {
      for (const table of childTables) {
        try {
          await (adminClient.from(table as any) as any).delete().in("brand_id", brandIds);
        } catch (tErr) {
          console.warn(`[delete-account API] Notice deleting from ${table}:`, tErr);
        }
      }

      // 5. Delete Storage objects under brands/{brandId}/ in bucket 'spark'
      try {
        for (const bId of brandIds) {
          const { data: fileList } = await adminClient.storage.from("spark").list(`brands/${bId}`, { limit: 1000 });
          if (fileList && fileList.length > 0) {
            const filesToRemove = fileList.map((f) => `brands/${bId}/${f.name}`);
            await adminClient.storage.from("spark").remove(filesToRemove);
          }
        }
      } catch (sErr) {
        console.warn("[delete-account API] Storage delete notice:", sErr);
      }

      // 6. Delete brands owned by this user
      try {
        await (adminClient.from("brands") as any).delete().in("id", brandIds).eq("owner_id", userId);
      } catch (bErr) {
        console.warn("[delete-account API] Brands deletion notice:", bErr);
      }
    }

    // 7. Delete profiles row for this user
    try {
      await (adminClient.from("profiles") as any).delete().eq("id", userId);
    } catch (pErr) {
      console.warn("[delete-account API] Profile deletion notice:", pErr);
    }

    // 8. Delete user from auth.users via Supabase Auth Admin if service role available
    let authUserDeleted = false;
    try {
      if (adminClient.auth && adminClient.auth.admin && typeof adminClient.auth.admin.deleteUser === "function") {
        const { error: delUserErr } = await adminClient.auth.admin.deleteUser(userId);
        if (!delUserErr) {
          authUserDeleted = true;
        } else {
          console.warn("[delete-account API] admin.deleteUser notice:", delUserErr);
        }
      }
    } catch (authDelErr) {
      console.warn("[delete-account API] auth deleteUser error:", authDelErr);
    }

    return res.status(200).json({
      success: true,
      userId,
      brandsDeleted: brandIds.length,
      authUserDeleted,
      message: authUserDeleted
        ? "Account and all associated SPARK data permanently deleted."
        : "Account data removed. Contact support if login still exists.",
    });
  } catch (error: any) {
    console.error("[delete-account API] Fatal error:", error);
    return res.status(500).json({ error: "Failed to delete account", detail: error?.message });
  }
}
