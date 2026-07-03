import type { BrandRow, BrandRuleRow, CharacterRow } from "../database.types";
import { getSupabaseClient, isSupabaseConfigured } from "../supabaseClient";
import { insertRow, listByBrand, updateRow, deleteRow } from "./repositoryUtils";
import type { RepositoryResult } from "./repositoryTypes";
import { repositoryError, unconfiguredResult } from "./repositoryTypes";

export async function listBrands(): Promise<RepositoryResult<BrandRow[]>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<BrandRow[]>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<BrandRow[]>();

  const { data, error } = await supabase.from("brands").select("*").order("created_at", { ascending: false });
  if (error) return repositoryError<BrandRow[]>();
  return { data: data ?? [], error: null, source: "supabase" };
}

export async function createBrand(values: Partial<BrandRow>): Promise<RepositoryResult<BrandRow>> {
  return insertRow("brands", values);
}

export async function updateBrand(id: string, values: Partial<BrandRow>): Promise<RepositoryResult<BrandRow>> {
  return updateRow("brands", id, values);
}

export async function deleteBrand(id: string): Promise<RepositoryResult<true>> {
  return deleteRow("brands", id);
}

export async function listCharacters(brandId: string): Promise<RepositoryResult<CharacterRow[]>> {
  return listByBrand("characters", brandId);
}

export async function listBrandRules(brandId: string): Promise<RepositoryResult<BrandRuleRow[]>> {
  return listByBrand("brand_rules", brandId);
}
