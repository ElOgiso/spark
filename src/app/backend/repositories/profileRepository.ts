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
          display_name: displayNameFromUser(user),
          updated_at: new Date().toISOString(),
        };
        if (typeof user.user_metadata?.avatar_url === "string") {
          refreshPayload.avatar_url = user.user_metadata.avatar_url;
        }
        // Always preserve/carry over role, permissions, access status, onboarding state, and active brand
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
          .update(refreshPayload)
          .eq("id", user.id)
          .select("*")
          .single();
        if (!refreshError && refreshed) {
          return { data: refreshed, error: null, source: "supabase" };
        }
      } catch {}
      return { data: existing, error: null, source: "supabase" };
    }

    // Auth's database trigger owns profile creation and all privilege defaults.
    // Never derive authorization from user-editable metadata or insert from the browser.
    return repositoryError<ProfileRow>(fetchErr?.message || "Profile provisioning is incomplete. Please contact support.");
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


    let { data, error } = await (supabase.from("profiles") as any)
      .update(patch)
      .eq("id", userId)
      .select("*")
      .maybeSingle();

    if (error) return repositoryError<ProfileRow>(error.message);
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
    const { error } = await supabase.rpc("admin_set_access_status", { target_user_id: userId, new_status: status });
    if (error) return repositoryError<ProfileRow>(error.message);
    return getProfile(userId);
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
  profilePatch: Partial<Pick<ProfileRow, "display_name" | "avatar_url" | "onboarding_complete" | "active_brand_id">>,
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
