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
  if (error) return repositoryError<BrandRow[]>(error.message);
  return { data: data ?? [], error: null, source: "supabase" };
}

export async function listBrandsForOwner(ownerId: string): Promise<RepositoryResult<BrandRow[]>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<BrandRow[]>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<BrandRow[]>();

  const { data, error } = await (supabase.from("brands") as any)
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) return repositoryError<BrandRow[]>(error.message);
  return { data: data ?? [], error: null, source: "supabase" };
}

export async function createBrand(values: Partial<BrandRow>): Promise<RepositoryResult<BrandRow>> {
  return insertRow("brands", values);
}

export async function createDraftBrand(
  ownerId: string,
  initialValues?: Partial<BrandRow>
): Promise<RepositoryResult<BrandRow>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<BrandRow>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<BrandRow>();

  const rawAudience = (initialValues?.audience as any) || {};
  const draftAudience = {
    ...rawAudience,
    settings: { is_draft: true, ...((initialValues?.settings as any) || {}), ...(rawAudience.settings || {}) },
  };

  const draftPayload: Partial<BrandRow> = {
    owner_id: ownerId,
    name: initialValues?.name || "Draft Brand",
    niche: initialValues?.niche || null,
    archetype: initialValues?.archetype ?? null,
    purpose: initialValues?.purpose ?? null,
    audience: draftAudience,
    tone: (initialValues?.tone as any) ?? [],
    content_pillars: (initialValues?.content_pillars as any) ?? [],
    automation_mode: initialValues?.automation_mode ?? "balanced",
    review_required: initialValues?.review_required ?? true,
    publish_requires_approval: initialValues?.publish_requires_approval ?? true,
    autonomous_publishing_enabled: initialValues?.autonomous_publishing_enabled ?? false,
  };

  const { data, error } = await (supabase.from("brands") as any)
    .insert(draftPayload)
    .select("*")
    .single();

  if (error) return repositoryError<BrandRow>(error.message);
  return { data, error: null, source: "supabase" };
}


export async function ensureDefaultBrand(
  profileId: string,
  localBrand?: Partial<SparkBrand>,
): Promise<RepositoryResult<BrandRow>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<BrandRow>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<BrandRow>();

  const { data: existing, error: listError } = await (supabase
    .from("brands") as any)
    .select("*")
    .eq("owner_id", profileId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (listError) return repositoryError<BrandRow>(listError.message);
  if (existing?.[0]) return { data: existing[0], error: null, source: "supabase" };

  const { data, error } = await (supabase
    .from("brands") as any)
    .insert({
      owner_id: profileId,
      name: localBrand?.name || "My Brand",
      niche: localBrand?.niche || "Content Creation",
      archetype: localBrand?.archetype ?? null,
      purpose: localBrand?.purpose ?? null,
      audience: (localBrand?.audience as object) ?? {},
      tone: (localBrand?.tone as object[]) ?? [],
      content_pillars: (localBrand?.contentPillars as object[]) ?? [],
      automation_mode: localBrand?.automation_mode ?? "balanced",
      review_required: localBrand?.review_required ?? true,
      publish_requires_approval: localBrand?.publish_requires_approval ?? true,
      autonomous_publishing_enabled: localBrand?.autonomous_publishing_enabled ?? false,
    })
    .select("*")
    .single();

  if (error) return repositoryError<BrandRow>(error.message);
  return { data, error: null, source: "supabase" };
}

export async function updateBrand(id: string, values: Partial<BrandRow>): Promise<RepositoryResult<BrandRow>> {
  const { settings, ...cleanValues } = values as any;
  const finalValues: any = { ...cleanValues };

  // If settings are provided, fold them into audience.settings to avoid Supabase error: column brands.settings does not exist
  if (settings && typeof settings === "object") {
    const supabase = getSupabaseClient();
    let currentAudience: Record<string, any> = {};
    if (finalValues.audience && typeof finalValues.audience === "object") {
      currentAudience = { ...finalValues.audience };
    } else if (supabase) {
      try {
        const { data: bRow } = await (supabase.from("brands") as any)
          .select("audience")
          .eq("id", id)
          .maybeSingle();
        if (bRow?.audience && typeof bRow.audience === "object") {
          currentAudience = { ...bRow.audience };
        }
      } catch {}
    }

    finalValues.audience = {
      ...currentAudience,
      settings: {
        ...(currentAudience.settings || {}),
        ...settings,
      },
    };
  }

  return updateRow("brands", id, finalValues);
}

export async function deleteBrand(id: string): Promise<RepositoryResult<true>> {
  return deleteRow("brands", id);
}

export async function listCharacters(brandId: string): Promise<RepositoryResult<CharacterRow[]>> {
  if (!isSupabaseConfigured()) return unconfiguredResult<CharacterRow[]>();
  const supabase = getSupabaseClient();
  if (!supabase) return unconfiguredResult<CharacterRow[]>();

  const { data, error } = await (supabase.from("characters") as any)
    .select("*")
    .eq("brand_id", brandId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) return repositoryError<CharacterRow[]>(error.message);
  return { data: (data ?? []) as CharacterRow[], error: null, source: "supabase" };
}

export async function listBrandRules(brandId: string): Promise<RepositoryResult<BrandRuleRow[]>> {
  return listByBrand("brand_rules", brandId);
}
