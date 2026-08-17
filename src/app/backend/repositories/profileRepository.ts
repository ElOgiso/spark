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
    // 1. Check if profile already exists by user.id
    const { data: existingById, error: fetchErr } = await (supabase.from("profiles") as any)
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (existingById && !fetchErr) {
      return { data: existingById, error: null, source: "supabase" };
    }

    // 2. Check if profile already exists by email (e.g. Gmail login with same email)
    if (user.email) {
      const { data: existingByEmail } = await (supabase.from("profiles") as any)
        .select("*")
        .eq("email", user.email)
        .maybeSingle();

      if (existingByEmail) {
        return { data: existingByEmail, error: null, source: "supabase" };
      }
    }

    const payload: Partial<ProfileRow> & { id: string } = {
      id: user.id,
      display_name: displayNameFromUser(user),
      role: "Director",
      avatar_url: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null,
      email: user.email ?? null,
      onboarding_complete: false,
      active_brand_id: null,
    };

    const { data, error } = await (supabase
      .from("profiles") as any)
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) return repositoryError<ProfileRow>(error.message);
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

    if (error) return repositoryError<ProfileRow>(error.message);
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
