import type { ExecutiveSessionRow } from "../database.types";
import { getSupabaseClient, isSupabaseConfigured } from "../supabaseClient";
import type { RepositoryResult } from "./repositoryTypes";
import { repositoryError, unconfiguredResult } from "./repositoryTypes";

export async function getExecutiveSession(
  brandId: string,
): Promise<RepositoryResult<ExecutiveSessionRow | null>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<ExecutiveSessionRow | null>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<ExecutiveSessionRow | null>();

  const { data, error } = await supabase
    .from("executive_sessions")
    .select("*")
    .eq("brand_id", brandId)
    .maybeSingle();

  if (error) return repositoryError<ExecutiveSessionRow | null>(error.message);
  return { data: data as ExecutiveSessionRow | null, error: null, source: "supabase" };
}

export async function upsertExecutiveSession(
  brandId: string,
  patch: Partial<Omit<ExecutiveSessionRow, "id" | "brand_id">>,
): Promise<RepositoryResult<ExecutiveSessionRow>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<ExecutiveSessionRow>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<ExecutiveSessionRow>();

  const { data, error } = await supabase
    .from("executive_sessions")
    .upsert(
      { brand_id: brandId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "brand_id" },
    )
    .select("*")
    .single();

  if (error) return repositoryError<ExecutiveSessionRow>(error.message);
  return { data: data as ExecutiveSessionRow, error: null, source: "supabase" };
}
