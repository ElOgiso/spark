import type { MediaAssetRow, ProductionAssetRow } from "../database.types";
import { deleteRow, insertRow, listByBrand, updateRow } from "./repositoryUtils";
import type { RepositoryResult } from "./repositoryTypes";
import { getSupabaseClient } from "../supabaseClient";

/**
 * Persists asset metadata directly into the verified `public.media_assets` table.
 */
export async function createMediaAsset(values: Partial<MediaAssetRow>): Promise<RepositoryResult<MediaAssetRow>> {
  return insertRow("media_assets", values);
}

/**
 * Backward compatibility alias mapping to `media_assets`
 */
export async function createProductionAsset(values: Partial<ProductionAssetRow | MediaAssetRow>): Promise<RepositoryResult<any>> {
  const mapped: Partial<MediaAssetRow> = {
    id: values.id,
    storage_bucket: (values as any).storage_bucket || "Spark",
    storage_path: (values as any).storage_path || "",
    public_url: (values as any).public_url || null,
    file_type: (values as any).file_type || (values as any).asset_type || "image",
    mime_type: (values as any).mime_type || null,
    source_prompt: (values as any).source_prompt || (values as any).generation_prompt || null,
    source_tool: (values as any).source_tool || (values as any).provider || "AIProviderOrchestrator",
    uploaded_by: (values as any).uploaded_by || (values as any).brand_id || null,
    is_active: true,
    created_at: (values as any).created_at || new Date().toISOString(),
  };
  return insertRow("media_assets", mapped);
}

export async function listMediaAssetsByProductionId(productionId: string): Promise<MediaAssetRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("media_assets")
      .select("*")
      .like("storage_path", `${productionId}/%`)
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("[mediaAssetRepository] list error:", error);
      return [];
    }
    return (data || []) as MediaAssetRow[];
  } catch (err) {
    console.warn("[mediaAssetRepository] query notice:", err);
    return [];
  }
}

export async function listProductionAssetsByProductionId(productionId: string): Promise<ProductionAssetRow[]> {
  const mediaRows = await listMediaAssetsByProductionId(productionId);
  return mediaRows.map((m) => ({
    id: m.id,
    brand_id: m.uploaded_by || null,
    production_id: productionId,
    asset_type: (m.file_type as any) || "image",
    provider: m.source_tool || null,
    storage_bucket: m.storage_bucket,
    storage_path: m.storage_path,
    public_url: m.public_url,
    mime_type: m.mime_type,
    generation_prompt: m.source_prompt,
    status: "completed",
    created_at: m.created_at,
  }));
}

export async function listProductionAssets(brandId: string): Promise<RepositoryResult<ProductionAssetRow[]>> {
  return listByBrand("media_assets", brandId) as any;
}

export async function updateProductionAsset(id: string, values: Partial<ProductionAssetRow | MediaAssetRow>): Promise<RepositoryResult<any>> {
  return updateRow("media_assets", id, values as any);
}

export async function deleteProductionAsset(id: string): Promise<RepositoryResult<true>> {
  return deleteRow("media_assets", id);
}


export type AssetDeleteProtection =
  | { allowed: true; mode: "hard" | "soft" }
  | { allowed: false; reason: string; references: string[] };

/**
 * Safe asset deletion — never blindly cascade-delete assets still referenced
 * by production lineage (master, selected candidate, continuity source, storyboard ref).
 * Unreferenced assets hard-delete; referenced assets soft-deactivate (is_active=false).
 */
export async function assessProductionAssetDeletion(
  id: string,
  referenceIds: string[] = []
): Promise<AssetDeleteProtection> {
  const refs = referenceIds.filter(Boolean);
  if (refs.includes(id)) {
    return {
      allowed: false,
      reason: "Asset is referenced by production lineage",
      references: refs.filter((r) => r === id),
    };
  }
  // Soft-delete path when caller marks asset as protected but detachable
  return { allowed: true, mode: "hard" };
}

export async function safeDeleteProductionAsset(
  id: string,
  options?: { referenceIds?: string[]; forceSoft?: boolean }
): Promise<RepositoryResult<true> & { mode?: "hard" | "soft" | "blocked"; reason?: string }> {
  const assessment = await assessProductionAssetDeletion(id, options?.referenceIds || []);
  if (!assessment.allowed) {
    return {
      data: null,
      error: assessment.reason,
      mode: "blocked",
      reason: assessment.reason,
    } as any;
  }
  if (options?.forceSoft) {
    const updated = await updateProductionAsset(id, { is_active: false } as any);
    if (updated.error) return { data: null, error: updated.error, mode: "soft" } as any;
    return { data: true, error: null, mode: "soft" } as any;
  }
  const deleted = await deleteProductionAsset(id);
  return { ...deleted, mode: "hard" } as any;
}
