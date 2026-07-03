import type { BrandRow, BrandRuleRow, CharacterRow } from "../database.types";
import type { Brand as SparkBrand } from "../../domain/types";
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

export async function ensureDefaultBrand(
  profileId: string,
  localBrand?: Partial<SparkBrand>,
): Promise<RepositoryResult<BrandRow>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<BrandRow>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<BrandRow>();

  const { data: existing, error: listError } = await supabase
    .from("brands")
    .select("*")
    .eq("owner_id", profileId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (listError) return repositoryError<BrandRow>();
  if (existing?.[0]) return { data: existing[0], error: null, source: "supabase" };

  const { data, error } = await supabase
    .from("brands")
    .insert({
      owner_id: profileId,
      name: localBrand?.name || "Tech Insights Nigeria",
      niche: localBrand?.niche || "AI & Technology Education",
      archetype: localBrand?.archetype ?? null,
      purpose: localBrand?.purpose ?? null,
      audience: localBrand?.audience ?? {},
      tone: localBrand?.tone ?? [],
      content_pillars: localBrand?.contentPillars ?? [],
      automation_mode: localBrand?.automation_mode ?? "balanced",
      review_required: localBrand?.review_required ?? true,
      publish_requires_approval: localBrand?.publish_requires_approval ?? true,
      autonomous_publishing_enabled: localBrand?.autonomous_publishing_enabled ?? false,
    })
    .select("*")
    .single();

  if (error) return repositoryError<BrandRow>();
  return { data, error: null, source: "supabase" };
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
