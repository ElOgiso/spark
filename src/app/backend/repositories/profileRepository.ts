import type { User } from "@supabase/supabase-js";
import type { ProfileRow } from "../database.types";
import { getSupabaseClient, isSupabaseConfigured } from "../supabaseClient";
import type { RepositoryResult } from "./repositoryTypes";
import { repositoryError, unconfiguredResult } from "./repositoryTypes";

function displayNameFromUser(user: User): string {
  const metadataName = user.user_metadata?.display_name ?? user.user_metadata?.name;
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  const emailPrefix = user.email?.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return emailPrefix || "Spark Director";
}

export async function getProfile(userId: string, email?: string | null): Promise<RepositoryResult<ProfileRow>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<ProfileRow>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<ProfileRow>();

  let { data, error } = await (supabase.from("profiles") as any).select("*").eq("id", userId).maybeSingle();
  if (!data && email) {
    try {
      const byEmail = await (supabase.from("profiles") as any).select("*").eq("email", email).maybeSingle();
      if (byEmail.data) {
        data = byEmail.data;
        error = null;
      }
    } catch {}
  }
  if (error) return repositoryError<ProfileRow>(error.message);
  return { data, error: null, source: "supabase" };
}

export async function upsertProfile(user: User): Promise<RepositoryResult<ProfileRow>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<ProfileRow>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<ProfileRow>();

  try {
    // Check if profile already exists by id, or by email (e.g. pre-provisioned admin in database)
    let existing: ProfileRow | null = null;
    const { data: byId, error: fetchErr } = await (supabase.from("profiles") as any)
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    existing = byId;

    if (!existing && user.email) {
      try {
        const { data: byEmail } = await (supabase.from("profiles") as any)
          .select("*")
          .eq("email", user.email)
          .maybeSingle();
        if (byEmail) {
          existing = byEmail;
        }
      } catch {}
    }

    if (existing && !fetchErr) {
      // Profile exists — refresh display fields (name/email/avatar) but never reset access/onboarding state
      try {
        const refreshPayload: Record<string, any> = {
          id: user.id,
          display_name: displayNameFromUser(user),
          email: user.email ?? null,
          updated_at: new Date().toISOString(),
        };
        if (typeof user.user_metadata?.avatar_url === "string") {
          refreshPayload.avatar_url = user.user_metadata.avatar_url;
        }
        // Always preserve/carry over role, permissions, access status, onboarding state, and active brand
        if (existing.role) refreshPayload.role = existing.role;
        if (existing.is_super_admin !== undefined) refreshPayload.is_super_admin = existing.is_super_admin;
        if (existing.access_status) refreshPayload.access_status = existing.access_status;
        if (existing.onboarding_complete !== undefined) refreshPayload.onboarding_complete = existing.onboarding_complete;
        if (existing.active_brand_id) refreshPayload.active_brand_id = existing.active_brand_id;

        // If local storage has onboarding complete or active brand, and existing profile is missing them, heal it
        try {
          if (typeof localStorage !== "undefined") {
            const cachedOnboarding = localStorage.getItem("spark_onboarding_complete");
            if (cachedOnboarding === "true" && !refreshPayload.onboarding_complete) {
              refreshPayload.onboarding_complete = true;
            }
            const cachedBrand = localStorage.getItem("spark_current_brand_id");
            if (cachedBrand && !refreshPayload.active_brand_id) {
              refreshPayload.active_brand_id = cachedBrand;
            }
          }
        } catch {}
        const { data: refreshed, error: refreshError } = await (supabase.from("profiles") as any)
          .upsert(refreshPayload, { onConflict: "id" })
          .select("*")
          .single();
        if (!refreshError && refreshed) {
          return { data: refreshed, error: null, source: "supabase" };
        }
      } catch {}
      return { data: existing, error: null, source: "supabase" };
    }

    // Check cached onboarding status for new user insert
    let initialOnboarding = false;
    try {
      if (typeof localStorage !== "undefined") {
        const cached = localStorage.getItem("spark_onboarding_complete");
        if (cached === "true") initialOnboarding = true;
      }
    } catch {}

    const metaRole = (user.app_metadata?.role || user.user_metadata?.role || "").toLowerCase().trim();
    const initialRole = metaRole === "admin" || metaRole === "super_admin" ? "admin" : "executive";

    // New user — full insert with safe defaults
    const payload: Partial<ProfileRow> & { id: string } = {
      id: user.id,
      display_name: displayNameFromUser(user),
      role: initialRole,
      avatar_url: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null,
      email: user.email ?? null,
      onboarding_complete: initialOnboarding,
      active_brand_id: null,
    };

    let { data, error } = await (supabase
      .from("profiles") as any)
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      console.warn("[profileRepository] upsertProfile initial notice, attempting minimal fallback:", error.message);
      // If error occurs due to missing columns in schema cache, retry with minimal foundation columns
      const minimalPayload = {
        id: user.id,
        display_name: payload.display_name,
        email: payload.email,
        role: initialRole,
      };
      const retryUpsert = await (supabase.from("profiles") as any)
        .upsert(minimalPayload, { onConflict: "id" })
        .select("*")
        .single();

      if (!retryUpsert.error && retryUpsert.data) {
        data = retryUpsert.data;
        error = null;
      } else {
        const retry = await (supabase.from("profiles") as any).select("*").eq("id", user.id).maybeSingle();
        if (retry.data) return { data: retry.data, error: null, source: "supabase" };
        return repositoryError<ProfileRow>(error.message);
      }
    }
    return { data, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<ProfileRow>(err?.message || "Profile upsert failed");
  }
}

export async function markProfileOnboardingComplete(
  userId: string,
  activeBrandId?: string | null,
  accessStatus?: "pending_approval" | "active" | "banned"
): Promise<RepositoryResult<ProfileRow>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<ProfileRow>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<ProfileRow>();

  try {
    const patch: Partial<ProfileRow> = {
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    };
    if (activeBrandId) {
      patch.active_brand_id = activeBrandId;
    }
    if (accessStatus) {
      patch.access_status = accessStatus;
    }

    let { data, error } = await (supabase.from("profiles") as any)
      .update(patch)
      .eq("id", userId)
      .select("*")
      .maybeSingle();

    if (error && patch.access_status) {
      // If access_status column does not exist or is guarded by RLS, retry without it
      const safePatch = { ...patch };
      delete safePatch.access_status;
      const retryUpdate = await (supabase.from("profiles") as any)
        .update(safePatch)
        .eq("id", userId)
        .select("*")
        .maybeSingle();

      if (!retryUpdate.error) {
        data = retryUpdate.data;
        error = null;
      }
    }

    if (error) {
      // If update fails because profile row doesn't exist yet, perform upsert
      const upsertPayload: any = {
        id: userId,
        onboarding_complete: true,
        active_brand_id: activeBrandId || null,
        updated_at: new Date().toISOString(),
      };
      if (accessStatus) {
        upsertPayload.access_status = accessStatus;
      }

      const { data: upsertData, error: upsertErr } = await (supabase.from("profiles") as any)
        .upsert(upsertPayload, { onConflict: "id" })
        .select("*")
        .maybeSingle();

      if (upsertErr) return repositoryError<ProfileRow>(upsertErr.message);
      return { data: upsertData, error: null, source: "supabase" };
    }
    return { data, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<ProfileRow>(err?.message || "Failed to mark profile onboarding complete");
  }
}

export async function setAccessStatus(
  userId: string,
  status: "pending_approval" | "active" | "banned"
): Promise<RepositoryResult<ProfileRow>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<ProfileRow>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<ProfileRow>();

  try {
    const { data, error } = await (supabase.from("profiles") as any)
      .update({
        access_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("*")
      .maybeSingle();

    if (error) return repositoryError<ProfileRow>(error.message);
    return { data, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<ProfileRow>(err?.message || "Failed to update access status");
  }
}

export async function setActiveBrand(
  userId: string,
  activeBrandId: string
): Promise<RepositoryResult<ProfileRow>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<ProfileRow>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<ProfileRow>();

  try {
    const { data, error } = await (supabase.from("profiles") as any)
      .update({
        active_brand_id: activeBrandId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("*")
      .maybeSingle();

    if (error) return repositoryError<ProfileRow>(error.message);
    return { data, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<ProfileRow>(err?.message || "Failed to set active brand");
  }
}

export async function updateProfile(
  userId: string,
  profilePatch: Partial<Pick<ProfileRow, "display_name" | "role" | "avatar_url" | "onboarding_complete" | "active_brand_id">>,
): Promise<RepositoryResult<ProfileRow>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<ProfileRow>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<ProfileRow>();

  const { data, error } = await (supabase
    .from("profiles") as any)
    .update({ ...profilePatch, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) return repositoryError<ProfileRow>(error.message);
  return { data, error: null, source: "supabase" };
}
