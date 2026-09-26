/**
 * SPARK Preproduction Asset Bible Ensurer
 *
 * OPTION B — reusable studio sheets, not a production DAG shot.
 * `generateAssets` must not call this. A paid sheet is allowed only when the
 * caller passes `studioBilling` (CreditService + userId). Missing billing,
 * unknown price, or insufficient credits fail before ModelRouter submit.
 * Durable Spark Storage upload remains the persistence step after a quoted image.
 */

import type { Brand, Character } from "../../../domain/types";
import type { ProductionElement } from "../elements/productionElements";
import { slugify, normalizeElementTag } from "../elements/productionElements";
import {
  listMissingAssetBibleEntries,
  type AssetBibleEntry,
} from "./assetBibleFromBrief";
import { buildProductionProductSheetPrompt } from "../productSheetPrompt";
import { buildLocationPlatePrompt } from "../locationPlatePrompt";
import { buildProductionCharacterSheetPrompt } from "../characterSheetPrompt";
import { brandProductionStoragePath } from "../brandProductionStoragePath";
import type { CreditService } from "../credits/creditService";
import { CostEngine } from "../economics/costEngine";

export interface StudioSheetBilling {
  creditService: CreditService;
  userId: string;
}

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
  knownWardrobeUrls?: (string | { url: string; name?: string; tag?: string })[];
  signal?: AbortSignal;
  maxPropGenerations?: number; // default 5
  aspectRatio?: string;
  forceRegenerate?: boolean;
  preferredImageProvider?: string;
  /** Required before any paid sheet. Absent callers record a refusal and do not submit. */
  studioBilling?: StudioSheetBilling;
  onProgress?: (tag: string, index: number, total: number) => void;
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

const STUDIO_BILLING_REQUIRED =
  "Asset bible image generation requires explicit studio credit authorization. No provider submit.";

/**
 * Studio sheet transport. Reserves before ModelRouter and settles or releases after.
 * This is not GenerationExecutionEngine: sheets are not production shots.
 */
async function submitPricedStudioSheet(params: {
  billing?: StudioSheetBilling;
  productionId: string;
  tag: string;
  prompt: string;
  aspectRatio: string;
  preferredImageProvider?: string;
  referenceImageUrl?: string;
}): Promise<string> {
  if (!params.billing?.creditService || !params.billing.userId) {
    throw new Error(STUDIO_BILLING_REQUIRED);
  }
  const providerId =
    params.preferredImageProvider && params.preferredImageProvider !== "auto"
      ? params.preferredImageProvider
      : "openai";
  const modelId = providerId === "openai" ? "dall-e-3" : providerId;
  const est = CostEngine.estimateCost({
    providerId,
    modelId,
    modality: "image",
  });
  if (est.status === "UNKNOWN" || !(typeof est.amount === "number" && est.amount > 0)) {
    throw new Error("Unknown studio sheet cost — refusing to reserve zero or submit.");
  }
  const quote = params.billing.creditService.quote({
    estimatedCostUsd: est.amount,
    generationId: `bible_${params.productionId}_${params.tag}`,
  });
  const reserved = await params.billing.creditService.reserve({
    quote,
    userId: params.billing.userId,
    idempotencyKey: `bible_${params.productionId}_${params.tag}`,
    metadata: { scope: "asset_bible_studio", tag: params.tag, providerId, modelId },
  });
  try {
    const { ModelRouter } = await import("../../runtime/modelRouter");
    const rawImgUrl = await ModelRouter.executeCategoryRequest("storyboardImages", {
      prompt: params.prompt,
      aspectRatio: params.aspectRatio,
      capability: "Image Generation",
      preferredProvider: (params.preferredImageProvider as any) || undefined,
      referenceImageUrl: params.referenceImageUrl,
    });
    if (!isValidMediaUrl(rawImgUrl)) {
      throw new Error("Image provider returned empty or invalid URL");
    }
    await params.billing.creditService.settle({
      reservationId: reserved.reservation.id,
      userId: params.billing.userId,
      actualProviderCostUsd: est.amount,
    });
    return rawImgUrl;
  } catch (err) {
    await params.billing.creditService
      .release({
        reservationId: reserved.reservation.id,
        userId: params.billing.userId,
        reason: err instanceof Error ? err.message : String(err),
      })
      .catch(() => undefined);
    throw err;
  }
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
    knownWardrobeUrls,
    signal,
    maxPropGenerations = 5,
    aspectRatio = "1:1",
    forceRegenerate = false,
    preferredImageProvider,
  } = params;

  const result: EnsureAssetBibleResult = {
    fulfilled: forceRegenerate ? [] : (Array.isArray(existingElements) ? [...existingElements] : []),
    generated: [],
    stillMissing: [],
    errors: [],
  };

  if (!bible || !Array.isArray(bible) || bible.length === 0) {
    return result;
  }

  // Seed known prop URLs into fulfilled if not already present
  if (!forceRegenerate && Array.isArray(params.knownPropUrls)) {
    for (const p of params.knownPropUrls) {
      const url = typeof p === "string" ? p : p?.url;
      const tag = typeof p === "object" ? p?.tag : undefined;
      const name = typeof p === "object" ? p?.name : undefined;
      if (isValidMediaUrl(url)) {
        const normTag = tag ? normalizeElementTag(tag) : undefined;
        const alreadyPresent = result.fulfilled.some(
          (e) => (normTag && normalizeElementTag(e.tag) === normTag) || e.url === url
        );
        if (!alreadyPresent) {
          result.fulfilled.push({
            tag: normTag || "@prop",
            role: "prop",
            label: name || "Prop",
            url: url.trim(),
          });
        }
      }
    }
  }

  // Seed known location plate URL into fulfilled if not already present
  if (!forceRegenerate && knownLocationPlateUrl && isValidMediaUrl(knownLocationPlateUrl)) {
    const locTag = bible.find((b) => b.role === "location" || b.sheetKind === "location")?.tag || "@location_plate";
    const alreadyPresent = result.fulfilled.some(
      (e) => e.role === "location" || normalizeElementTag(e.tag) === normalizeElementTag(locTag) || e.url === knownLocationPlateUrl
    );
    if (!alreadyPresent) {
      result.fulfilled.push({
        tag: locTag,
        role: "location",
        label: "Location Plate",
        url: knownLocationPlateUrl.trim(),
      });
    }
  }

  // Seed known wardrobe URLs into fulfilled if not already present
  if (!forceRegenerate && Array.isArray(knownWardrobeUrls)) {
    for (const w of knownWardrobeUrls) {
      const url = typeof w === "string" ? w : w?.url;
      const tag = typeof w === "object" ? w?.tag : undefined;
      const name = typeof w === "object" ? w?.name : undefined;
      if (isValidMediaUrl(url)) {
        const normTag = tag ? normalizeElementTag(tag) : undefined;
        const alreadyPresent = result.fulfilled.some(
          (e) => (normTag && normalizeElementTag(e.tag) === normTag) || e.url === url
        );
        if (!alreadyPresent) {
          result.fulfilled.push({
            tag: normTag || "@wardrobe_variant",
            role: "wardrobe_variant",
            label: name || "Wardrobe Variant",
            url: url.trim(),
          });
        }
      }
    }
  }

  // Identify missing entries against current resolved elements
  const missing = forceRegenerate
    ? [...bible]
    : listMissingAssetBibleEntries(bible, result.fulfilled);
  if (missing.length === 0) {
    console.log(`[SPARK Asset Bible] All ${bible.length} bible entries already satisfied by durable assets.`);
    return result;
  }

  const isFaceless = contentFormat.toLowerCase().includes("faceless");
  const brandId = (brand as any)?.id || "default-brand";
  let propGenCount = 0;

  for (let i = 0; i < missing.length; i++) {
    const entry = missing[i];
    if (params.onProgress) params.onProgress(entry.tag, i, missing.length);
    if (signal?.aborted) {
      result.stillMissing.push(entry);
      continue;
    }

    // Skip if already fulfilled and not forceRegenerate
    if (!forceRegenerate) {
      const normTag = normalizeElementTag(entry.tag);
      const alreadyFulfilled = result.fulfilled.find(
        (f) => normalizeElementTag(f.tag) === normTag && isValidMediaUrl(f.url)
      );
      if (alreadyFulfilled) {
        continue;
      }
    }

    const normKind = (entry.sheetKind || entry.role || "").toLowerCase();

    // 1. PROP GENERATION
    if (normKind === "prop" || entry.role === "prop") {
      // Check if known prop URL matches
      if (!forceRegenerate) {
        const normTag = normalizeElementTag(entry.tag);
        const knownProp = (params.knownPropUrls || []).find((p) => {
          if (typeof p === "string") return false;
          return (
            (p?.tag && normalizeElementTag(p.tag) === normTag) ||
            (p?.name && entry.label && p.name.toLowerCase().includes(entry.label.toLowerCase()))
          );
        });
        if (knownProp && typeof knownProp === "object" && isValidMediaUrl(knownProp.url)) {
          result.fulfilled.push({
            tag: entry.tag,
            role: "prop",
            label: entry.label,
            url: knownProp.url,
            description: entry.notes,
          });
          continue;
        }
      }

      // If faceless format and no prop requested or cap reached
      if (propGenCount >= maxPropGenerations) {
        console.log(
          `[SPARK Asset Bible] Prop generation cap reached (${maxPropGenerations}). Skipping ${entry.tag}.`
        );
        result.stillMissing.push(entry);
        continue;
      }

      try {
        const prompt = buildProductionProductSheetPrompt({
          productName: entry.label,
          brandName: brand?.name,
          category: "Prop",
          usageContext: entry.notes,
          genre: (brand as any)?.genre || "Realistic",
        });

        const rawImgUrl = await submitPricedStudioSheet({
          billing: params.studioBilling,
          productionId,
          tag: entry.tag,
          prompt,
          aspectRatio,
          preferredImageProvider,
        });

        // Re-host / upload to Spark Storage
        const { ProductionAssetService, isSparkStorageUrl } = await import("../productionAssetService");
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

        const isDurable = Boolean(stored?.uploadSuccess && stored?.publicUrl && isSparkStorageUrl(stored.publicUrl));
        if (!isDurable || !stored?.publicUrl) {
          throw new Error(
            `Storage upload failed for ${entry.tag}: upload did not return a verified durable Spark Storage URL`
          );
        }
        const finalUrl = stored.publicUrl;

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
      if (!forceRegenerate && knownLocationPlateUrl && isValidMediaUrl(knownLocationPlateUrl)) {
        if (!result.fulfilled.some((f) => normalizeElementTag(f.tag) === normalizeElementTag(entry.tag))) {
          result.fulfilled.push({
            tag: entry.tag,
            role: "location",
            label: entry.label,
            url: knownLocationPlateUrl,
            description: entry.notes,
          });
        }
        continue;
      }

      try {
        const prompt = buildProductionProductSheetPrompt({
          productName: entry.label,
          brandName: brand?.name,
          category: "Prop",
          usageContext: entry.notes,
          genre: (brand as any)?.genre || "Realistic",
        });

        const rawImgUrl = await submitPricedStudioSheet({
          billing: params.studioBilling,
          productionId,
          tag: entry.tag,
          prompt,
          aspectRatio,
          preferredImageProvider,
        });

        // Re-host / upload to Spark Storage
        const { ProductionAssetService, isSparkStorageUrl } = await import("../productionAssetService");
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

        const isDurable = Boolean(stored?.uploadSuccess && stored?.publicUrl && isSparkStorageUrl(stored.publicUrl));
        if (!isDurable || !stored?.publicUrl) {
          throw new Error(
            `Storage upload failed for ${entry.tag}: upload did not return a verified durable Spark Storage URL`
          );
        }
        const finalUrl = stored.publicUrl;

        // Set brand location plate if brand context is provided
        if (brand && typeof brand === "object") {
          (brand as any).locationPlateUrl = finalUrl;
          try {
            const { uploadLocationPlateToStorage } = await import("../../../backend/workspaceSync");
            void uploadLocationPlateToStorage(brandId, rawImgUrl);
          } catch (syncErr) {
            console.warn("[SPARK Asset Bible] Brand set plate mirror notice:", syncErr);
          }
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
      if (!forceRegenerate) {
        const normTag = normalizeElementTag(entry.tag);
        const knownWardrobe = (params.knownWardrobeUrls || []).find((w) => {
          if (typeof w === "string") return false;
          return (
            (w?.tag && normalizeElementTag(w.tag) === normTag) ||
            (w?.name && entry.label && w.name.toLowerCase().includes(entry.label.toLowerCase()))
          );
        });
        if (knownWardrobe && typeof knownWardrobe === "object" && isValidMediaUrl(knownWardrobe.url)) {
          result.fulfilled.push({
            tag: entry.tag,
            role: "wardrobe_variant",
            label: entry.label,
            url: knownWardrobe.url,
            description: entry.notes,
          });
          continue;
        }
      }

      const baseCharRef = character?.characterSheetUrl || character?.imageUrl || character?.avatarUrl;
      if (!baseCharRef || !isValidMediaUrl(baseCharRef)) {
        // Base character identity required to synthesize consistent wardrobe variant
        result.stillMissing.push(entry);
        continue;
      }

      try {
        const prompt = buildProductionCharacterSheetPrompt({
          creatorName: character?.name || entry.label,
          brandName: brand?.name,
          wardrobe: entry.notes || entry.label,
          directorNotes: `Wardrobe variant: ${entry.label}. ${entry.notes || ""}`,
          genre: (brand as any)?.genre || "Realistic",
        });

        const rawImgUrl = await submitPricedStudioSheet({
          billing: params.studioBilling,
          productionId,
          tag: entry.tag,
          prompt,
          aspectRatio: "16:9",
          preferredImageProvider,
          referenceImageUrl: baseCharRef,
        });

        // Re-host / upload to Spark Storage
        const { ProductionAssetService, isSparkStorageUrl } = await import("../productionAssetService");
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

        const isDurable = Boolean(stored?.uploadSuccess && stored?.publicUrl && isSparkStorageUrl(stored.publicUrl));
        if (!isDurable || !stored?.publicUrl) {
          throw new Error(
            `Storage upload failed for ${entry.tag}: upload did not return a verified durable Spark Storage URL`
          );
        }
        const finalUrl = stored.publicUrl;

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
