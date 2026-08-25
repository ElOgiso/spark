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

export async function getProfile(userId: string): Promise<RepositoryResult<ProfileRow>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<ProfileRow>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<ProfileRow>();

  const { data, error } = await (supabase.from("profiles") as any).select("*").eq("id", userId).maybeSingle();
  if (error) return repositoryError<ProfileRow>(error.message);
  return { data, error: null, source: "supabase" };
}

export async function upsertProfile(user: User): Promise<RepositoryResult<ProfileRow>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<ProfileRow>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<ProfileRow>();

  try {
    // Check if profile already exists to preserve onboarding_complete and active_brand_id
    const { data: existing, error: fetchErr } = await (supabase.from("profiles") as any)
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (existing && !fetchErr) {
      return { data: existing, error: null, source: "supabase" };
    }

    // Check cached onboarding status if available
    let initialOnboarding = false;
    try {
      if (typeof localStorage !== "undefined") {
        const cached = localStorage.getItem("spark_onboarding_complete");
        if (cached === "true") initialOnboarding = true;
      }
    } catch {}

    const payload: Partial<ProfileRow> & { id: string } = {
      id: user.id,
      display_name: displayNameFromUser(user),
      role: "executive",
      is_super_admin: false,
      avatar_url: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null,
      email: user.email ?? null,
      onboarding_complete: initialOnboarding,
      active_brand_id: null,
    };

    const { data, error } = await (supabase
      .from("profiles") as any)
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      // If error occurs, try fetching existing row once more before failing
      const retry = await (supabase.from("profiles") as any).select("*").eq("id", user.id).maybeSingle();
      if (retry.data) return { data: retry.data, error: null, source: "supabase" };
      return repositoryError<ProfileRow>(error.message);
    }
    return { data, error: null, source: "supabase" };
  } catch (err: any) {
    return repositoryError<ProfileRow>(err?.message || "Profile upsert failed");
  }
}

export async function markProfileOnboardingComplete(
  userId: string,
  activeBrandId?: string | null
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

    const { data, error } = await (supabase.from("profiles") as any)
      .update(patch)
      .eq("id", userId)
      .select("*")
      .maybeSingle();

    if (error) {
      // If update fails because profile row doesn't exist yet, perform upsert
      const { data: upsertData, error: upsertErr } = await (supabase.from("profiles") as any)
        .upsert({
          id: userId,
          onboarding_complete: true,
          active_brand_id: activeBrandId || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" })
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
