import { getSupabaseClient, isSupabaseConfigured } from "../supabaseClient";
import type { Database } from "../database.types";
import type { RepositoryResult } from "./repositoryTypes";
import { repositoryError, unconfiguredResult } from "./repositoryTypes";

type TableName = keyof Database["public"]["Tables"];
type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];
type Insert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
type Update<T extends TableName> = Database["public"]["Tables"][T]["Update"];

export async function listByBrand<T extends TableName>(
  table: T,
  brandId: string,
): Promise<RepositoryResult<Row<T>[]>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<Row<T>[]>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<Row<T>[]>();

  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });

  if (error) return repositoryError<Row<T>[]>(error.message);
  return { data: (data ?? []) as Row<T>[], error: null, source: "supabase" };
}

export async function insertRow<T extends TableName>(
  table: T,
  values: Insert<T>,
): Promise<RepositoryResult<Row<T>>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<Row<T>>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<Row<T>>();

  const { data, error } = await supabase.from(table).insert(values).select("*").single();
  if (error) return repositoryError<Row<T>>(error.message);
  return { data: data as Row<T>, error: null, source: "supabase" };
}

export async function updateRow<T extends TableName>(
  table: T,
  id: string,
  values: Update<T>,
): Promise<RepositoryResult<Row<T>>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<Row<T>>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<Row<T>>();

  const { data, error } = await supabase.from(table).update(values).eq("id", id).select("*").single();
  if (error) return repositoryError<Row<T>>(error.message);
  return { data: data as Row<T>, error: null, source: "supabase" };
}

export async function deleteRow<T extends TableName>(
  table: T,
  id: string,
): Promise<RepositoryResult<true>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<true>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<true>();

  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return repositoryError<true>(error.message);
  return { data: true, error: null, source: "supabase" };
}
