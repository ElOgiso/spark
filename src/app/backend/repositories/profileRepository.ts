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

  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) return repositoryError<ProfileRow>();
  return { data, error: null, source: "supabase" };
}

export async function upsertProfile(user: User): Promise<RepositoryResult<ProfileRow>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<ProfileRow>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<ProfileRow>();

  const payload: Partial<ProfileRow> & { id: string } = {
    id: user.id,
    display_name: displayNameFromUser(user),
    role: "Director",
    avatar_url: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null,
    email: user.email ?? null,
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) return repositoryError<ProfileRow>(error.message);
  return { data, error: null, source: "supabase" };
}

export async function updateProfile(
  userId: string,
  profilePatch: Partial<Pick<ProfileRow, "display_name" | "role" | "avatar_url">>,
): Promise<RepositoryResult<ProfileRow>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<ProfileRow>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<ProfileRow>();

  const { data, error } = await supabase
    .from("profiles")
    .update(profilePatch)
    .eq("id", userId)
    .select("*")
    .single();

  if (error) return repositoryError<ProfileRow>();
  return { data, error: null, source: "supabase" };
}
