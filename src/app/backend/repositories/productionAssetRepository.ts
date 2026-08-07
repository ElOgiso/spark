import type { ProductionAssetRow } from "../database.types";
import { deleteRow, insertRow, listByBrand, updateRow } from "./repositoryUtils";
import type { RepositoryResult } from "./repositoryTypes";
import { getSupabaseClient } from "../supabaseClient";

export async function listProductionAssets(brandId: string): Promise<RepositoryResult<ProductionAssetRow[]>> {
  return listByBrand("production_assets", brandId);
}

export async function createProductionAsset(values: Partial<ProductionAssetRow>): Promise<RepositoryResult<ProductionAssetRow>> {
  return insertRow("production_assets", values);
}

export async function updateProductionAsset(id: string, values: Partial<ProductionAssetRow>): Promise<RepositoryResult<ProductionAssetRow>> {
  return updateRow("production_assets", id, values);
}

export async function deleteProductionAsset(id: string): Promise<RepositoryResult<true>> {
  return deleteRow("production_assets", id);
}

export async function listProductionAssetsByProductionId(productionId: string): Promise<ProductionAssetRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("production_assets")
      .select("*")
      .eq("production_id", productionId)
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("[productionAssetRepository] list error:", error);
      return [];
    }
    return (data || []) as ProductionAssetRow[];
  } catch (err) {
    console.warn("[productionAssetRepository] query notice:", err);
    return [];
  }
}
