/**
 * SPARK Preproduction Asset Bible Ensurer
 * Automatically synthesizes, uploads, and binds missing asset sheets (props, locations, wardrobe variants)
 * planned in the asset bible before per-shot I2V motion synthesis.
 *
 * Rules:
 * - Capped auto prop generations per run (default max 5) to protect credits
 * - Uploads / re-hosts to durable Spark Storage
 * - Character sheets remain strictly guarded by characterSheetGate (never bypassed)
 * - Non-fatal: individual asset failures log warnings without killing the production
 * - Skip ensure for faceless format when no props are needed
 */

import type { Brand, Character } from "../../../domain/types";
import type { ProductionElement } from "../elements/productionElements";
import { slugify } from "../elements/productionElements";
import {
  listMissingAssetBibleEntries,
  type AssetBibleEntry,
} from "./assetBibleFromBrief";
import { buildProductionProductSheetPrompt } from "../productSheetPrompt";
import { buildLocationPlatePrompt } from "../locationPlatePrompt";
import { buildProductionCharacterSheetPrompt } from "../characterSheetPrompt";
import { brandProductionStoragePath } from "../brandProductionStoragePath";

export interface EnsureAssetBibleAssetsParams {
  bible?: AssetBibleEntry[] | null;
  brand?: Partial<Brand> | null;
  character?: Partial<Character> | null;
  characters?: Partial<Character>[] | null;
  productionId: string;
  contentFormat?: string;
  existingElements?: ProductionElement[] | null;
  knownPropUrls?: (string | { url: string; name?: string; tag?: string })[];
  knownLocationPlateUrl?: string;
  signal?: AbortSignal;
  maxPropGenerations?: number; // default 5
  aspectRatio?: string;
}

export interface EnsuredGeneratedAsset {
  tag: string;
  sheetKind: string;
  url: string;
  label: string;
  role: ProductionElement["role"];
}

export interface EnsureAssetBibleResult {
  fulfilled: ProductionElement[];
  generated: EnsuredGeneratedAsset[];
  stillMissing: AssetBibleEntry[];
  errors: { tag: string; error: string }[];
}

function isValidMediaUrl(val?: string | null): val is string {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  if (!trimmed || trimmed.includes("pending") || trimmed.includes("failed") || trimmed.includes("error")) {
    return false;
  }
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("blob:")
  );
}

export async function ensureAssetBibleAssets(
  params: EnsureAssetBibleAssetsParams
): Promise<EnsureAssetBibleResult> {
  const {
    bible,
    brand,
    character,
    characters,
    productionId,
    contentFormat = "standard",
    existingElements = [],
    knownLocationPlateUrl,
    signal,
    maxPropGenerations = 5,
    aspectRatio = "1:1",
  } = params;

  const result: EnsureAssetBibleResult = {
    fulfilled: Array.isArray(existingElements) ? [...existingElements] : [],
    generated: [],
    stillMissing: [],
    errors: [],
  };

  if (!bible || !Array.isArray(bible) || bible.length === 0) {
    return result;
  }

  // Identify missing entries against current resolved elements
  const missing = listMissingAssetBibleEntries(bible, result.fulfilled);
  if (missing.length === 0) {
    return result;
  }

  const isFaceless = contentFormat.toLowerCase().includes("faceless");
  const brandId = (brand as any)?.id || "default-brand";
  let propGenCount = 0;

  for (const entry of missing) {
    if (signal?.aborted) {
      result.stillMissing.push(entry);
      continue;
    }

    const normKind = (entry.sheetKind || entry.role || "").toLowerCase();

    // 1. PROP GENERATION
    if (normKind === "prop" || entry.role === "prop") {
      // If faceless format and no prop requested or cap reached
      if (propGenCount >= maxPropGenerations) {
        console.log(
          `[SPARK Asset Bible] Prop generation cap reached (${maxPropGenerations}). Skipping ${entry.tag}.`
        );
        result.stillMissing.push(entry);
        continue;
      }

      try {
        const { ModelRouter } = await import("../../runtime/modelRouter");
        const prompt = buildProductionProductSheetPrompt({
          productName: entry.label,
          brandName: brand?.name,
          category: "Prop",
          usageContext: entry.notes,
          genre: (brand as any)?.genre || "Realistic",
        });

        const rawImgUrl = await ModelRouter.executeCategoryRequest("storyboardImages", {
          prompt,
          aspectRatio,
          capability: "Image Generation",
        });

        if (!isValidMediaUrl(rawImgUrl)) {
          throw new Error("Image provider returned empty or invalid URL");
        }

        // Re-host / upload to Spark Storage
        let finalUrl = rawImgUrl;
        try {
          const { ProductionAssetService } = await import("../productionAssetService");
          const storageSubpath = `props/prop-sheet-${slugify(entry.tag || entry.label)}.png`;
          const stored = await ProductionAssetService.uploadAssetToStorage({
            productionId,
            brandId,
            assetType: "image",
            storagePath: brandProductionStoragePath(brandId, productionId, storageSubpath),
            dataUrlOrBlob: rawImgUrl,
            mimeType: "image/png",
            prompt,
            provider: "ModelRouter",
          });
          if (stored?.publicUrl && isValidMediaUrl(stored.publicUrl)) {
            finalUrl = stored.publicUrl;
          }
        } catch (uploadErr) {
          console.warn(`[SPARK Asset Bible] Storage upload notice for ${entry.tag}:`, uploadErr);
        }

        console.log(`[SPARK Asset Bible] Ensured ${entry.tag} → ${finalUrl}`);
        const genItem: EnsuredGeneratedAsset = {
          tag: entry.tag,
          sheetKind: "prop",
          url: finalUrl,
          label: entry.label,
          role: "prop",
        };
        result.generated.push(genItem);
        result.fulfilled.push({
          tag: entry.tag,
          role: "prop",
          label: entry.label,
          url: finalUrl,
          description: entry.notes,
        });
        propGenCount++;
      } catch (err: any) {
        const reason = err?.message || String(err);
        console.warn(`[SPARK Asset Bible] failed ${entry.tag} reason: ${reason}`);
        result.errors.push({ tag: entry.tag, error: reason });
        result.stillMissing.push(entry);
      }
      continue;
    }

    // 2. LOCATION PLATE GENERATION
    if (normKind === "location" || entry.role === "location") {
      if (knownLocationPlateUrl && isValidMediaUrl(knownLocationPlateUrl)) {
        // Already satisfied by known plate URL
        continue;
      }

      try {
        const { ModelRouter } = await import("../../runtime/modelRouter");
        const prompt = buildLocationPlatePrompt({
          locationName: entry.label,
          brandName: brand?.name,
          environmentDescription: entry.notes,
          visualMedium: (brand as any)?.genre || "Realistic",
        });

        const rawImgUrl = await ModelRouter.executeCategoryRequest("storyboardImages", {
          prompt,
          aspectRatio: "16:9",
          capability: "Image Generation",
        });

        if (!isValidMediaUrl(rawImgUrl)) {
          throw new Error("Image provider returned empty or invalid URL");
        }

        let finalUrl = rawImgUrl;
        try {
          const { ProductionAssetService } = await import("../productionAssetService");
          const storageSubpath = `locations/location-plate-${slugify(entry.tag || entry.label)}.png`;
          const stored = await ProductionAssetService.uploadAssetToStorage({
            productionId,
            brandId,
            assetType: "image",
            storagePath: brandProductionStoragePath(brandId, productionId, storageSubpath),
            dataUrlOrBlob: rawImgUrl,
            mimeType: "image/png",
            prompt,
            provider: "ModelRouter",
          });
          if (stored?.publicUrl && isValidMediaUrl(stored.publicUrl)) {
            finalUrl = stored.publicUrl;
          }
        } catch (uploadErr) {
          console.warn(`[SPARK Asset Bible] Storage upload notice for ${entry.tag}:`, uploadErr);
        }

        console.log(`[SPARK Asset Bible] Ensured ${entry.tag} → ${finalUrl}`);
        const genItem: EnsuredGeneratedAsset = {
          tag: entry.tag,
          sheetKind: "location",
          url: finalUrl,
          label: entry.label,
          role: "location",
        };
        result.generated.push(genItem);
        result.fulfilled.push({
          tag: entry.tag,
          role: "location",
          label: entry.label,
          url: finalUrl,
          description: entry.notes,
        });
      } catch (err: any) {
        const reason = err?.message || String(err);
        console.warn(`[SPARK Asset Bible] failed ${entry.tag} reason: ${reason}`);
        result.errors.push({ tag: entry.tag, error: reason });
        result.stillMissing.push(entry);
      }
      continue;
    }

    // 3. WARDROBE VARIANT GENERATION
    if (normKind === "wardrobe_variant" || entry.role === "wardrobe_variant") {
      const baseCharRef = character?.characterSheetUrl || character?.imageUrl || character?.avatarUrl;
      if (!baseCharRef || !isValidMediaUrl(baseCharRef)) {
        // Base character identity required to synthesize consistent wardrobe variant
        result.stillMissing.push(entry);
        continue;
      }

      try {
        const { ModelRouter } = await import("../../runtime/modelRouter");
        const prompt = buildProductionCharacterSheetPrompt({
          creatorName: character?.name || entry.label,
          brandName: brand?.name,
          wardrobe: entry.notes || entry.label,
          directorNotes: `Wardrobe variant: ${entry.label}. ${entry.notes || ""}`,
          genre: (brand as any)?.genre || "Realistic",
        });

        const rawImgUrl = await ModelRouter.executeCategoryRequest("storyboardImages", {
          prompt,
          referenceImageUrl: baseCharRef,
          aspectRatio: "16:9",
          capability: "Image Generation",
        });

        if (!isValidMediaUrl(rawImgUrl)) {
          throw new Error("Image provider returned empty or invalid URL");
        }

        let finalUrl = rawImgUrl;
        try {
          const { ProductionAssetService } = await import("../productionAssetService");
          const storageSubpath = `wardrobe/wardrobe-variant-${slugify(entry.tag || entry.label)}.png`;
          const stored = await ProductionAssetService.uploadAssetToStorage({
            productionId,
            brandId,
            assetType: "image",
            storagePath: brandProductionStoragePath(brandId, productionId, storageSubpath),
            dataUrlOrBlob: rawImgUrl,
            mimeType: "image/png",
            prompt,
            provider: "ModelRouter",
          });
          if (stored?.publicUrl && isValidMediaUrl(stored.publicUrl)) {
            finalUrl = stored.publicUrl;
          }
        } catch (uploadErr) {
          console.warn(`[SPARK Asset Bible] Storage upload notice for ${entry.tag}:`, uploadErr);
        }

        console.log(`[SPARK Asset Bible] Ensured ${entry.tag} → ${finalUrl}`);
        const genItem: EnsuredGeneratedAsset = {
          tag: entry.tag,
          sheetKind: "wardrobe_variant",
          url: finalUrl,
          label: entry.label,
          role: "wardrobe_variant",
        };
        result.generated.push(genItem);
        result.fulfilled.push({
          tag: entry.tag,
          role: "wardrobe_variant",
          label: entry.label,
          url: finalUrl,
          description: entry.notes,
        });
      } catch (err: any) {
        const reason = err?.message || String(err);
        console.warn(`[SPARK Asset Bible] failed ${entry.tag} reason: ${reason}`);
        result.errors.push({ tag: entry.tag, error: reason });
        result.stillMissing.push(entry);
      }
      continue;
    }

    // 4. CHARACTER SHEETS: NEVER BYPASS GATING
    // If a primary character sheet is missing, leave to characterSheetGate
    result.stillMissing.push(entry);
  }

  return result;
}
