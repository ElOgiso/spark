/**
 * Normalize legacy ProductionAsset / master URLs into RegisteredAsset records.
 * Unknown metadata stays unknown — never invent provenance or approval.
 */

import type { ProductionAsset } from "../../../domain/types";
import type { MasterAssetRef } from "../specification/assetSpec";
import type {
  RegisteredAsset,
  AssetCategory,
  ReferenceRole,
  ReferenceAuthority,
  AssetLifecycleStatus,
  AssetProvenanceSource,
  ProductionEntityType,
  AssetScope,
  AssetVariantInfo,
} from "./types";
import { fingerprintFromUrlAndMeta } from "./fingerprint";

function nowIso(): string {
  return new Date().toISOString();
}

function inferCategory(assetType: ProductionAsset["assetType"]): AssetCategory {
  return assetType;
}

/**
 * Never invent provenance — only classify when evidence is clear.
 */
function inferProvenance(asset: ProductionAsset): AssetProvenanceSource {
  if (asset.provider || asset.generationPrompt) return "generated_by_spark";
  if (asset.parentAssetId) return "derived_from_asset";
  return "unknown";
}

function parseAuthority(raw?: string): ReferenceAuthority | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase();
  const allowed: ReferenceAuthority[] = [
    "canonical",
    "approved",
    "preferred",
    "supporting",
    "candidate",
    "deprecated",
    "rejected",
  ];
  return allowed.includes(v as ReferenceAuthority) ? (v as ReferenceAuthority) : undefined;
}

function parseLifecycle(raw?: string): AssetLifecycleStatus | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase();
  const allowed: AssetLifecycleStatus[] = [
    "candidate",
    "imported",
    "generated",
    "validated",
    "approved",
    "canonical",
    "deprecated",
    "rejected",
  ];
  return allowed.includes(v as AssetLifecycleStatus) ? (v as AssetLifecycleStatus) : undefined;
}

function lifecycleFromStatus(status: ProductionAsset["status"]): AssetLifecycleStatus {
  if (status === "failed") return "rejected";
  if (status === "pending") return "candidate";
  return "generated";
}

function parseRole(raw?: string): ReferenceRole | undefined {
  if (!raw) return undefined;
  return raw as ReferenceRole;
}

/**
 * Lift a legacy ProductionAsset into the registry model without requiring new fields.
 */
export function normalizeProductionAsset(
  asset: ProductionAsset,
  extras?: Partial<RegisteredAsset>
): RegisteredAsset {
  const createdAt = asset.createdAt || nowIso();
  const lifecycle =
    extras?.lifecycle ??
    parseLifecycle(asset.lifecycle) ??
    lifecycleFromStatus(asset.status);
  const authority =
    extras?.authority ?? parseAuthority(asset.authority) ?? "candidate";
  const roleFromAsset = parseRole(asset.role);
  const roles =
    extras?.roles?.length
      ? extras.roles
      : roleFromAsset
        ? [roleFromAsset]
        : (["generated_output"] as ReferenceRole[]);

  const variant: AssetVariantInfo | undefined =
    extras?.variant ??
    (asset.variant
      ? { variantKey: asset.variant, label: asset.variant }
      : undefined);

  const versionNum = extras?.version?.version ?? asset.version ?? 1;
  const url = extras?.storage?.url ?? asset.publicUrl;

  const base: RegisteredAsset = {
    id: asset.id,
    productionId: asset.productionId,
    brandId: extras?.brandId ?? asset.brandId,
    scope:
      extras?.scope ??
      (asset.shotId ? "shot" : asset.sceneId ? "scene" : ("production" as AssetScope)),
    category: extras?.category ?? inferCategory(asset.assetType),
    mediaType: asset.assetType,
    entityType: extras?.entityType,
    entityId: extras?.entityId,
    roles,
    authority,
    lifecycle,
    referenceEligible: false,
    version: extras?.version ?? {
      version: versionNum,
      createdAt,
      status: lifecycle,
    },
    variant,
    masterRef: extras?.masterRef ?? asset.masterRef,
    masterKind: extras?.masterKind,
    storage: {
      storageKey: asset.storagePath,
      storageProvider: asset.storageBucket ? "supabase" : undefined,
      url,
      temporary: Boolean(asset.expiresAt),
      persistenceStatus: asset.storagePath
        ? "durable"
        : asset.publicUrl
          ? "unknown"
          : "unknown",
      ...extras?.storage,
    },
    media: {
      mimeType: asset.mimeType,
      durationSec: asset.duration ? Number.parseFloat(asset.duration) || undefined : undefined,
      ...extras?.media,
    },
    provenance: extras?.provenance ?? {
      source: inferProvenance(asset),
      sourceProvider: asset.provider,
      sourceShotId: asset.shotId,
      sourceAssetId: asset.parentAssetId,
      createdAt,
      notes: asset.generationPrompt ? "Has generationPrompt on ProductionAsset" : undefined,
    },
    fingerprint:
      extras?.fingerprint ??
      asset.fingerprint ??
      fingerprintFromUrlAndMeta({
        url: asset.publicUrl,
        mimeType: asset.mimeType,
      }),
    parentAssetId: extras?.parentAssetId ?? asset.parentAssetId,
    relationships: extras?.relationships ?? [],
    tags: extras?.tags ?? [],
    name: extras?.name,
    description: extras?.description,
    createdAt,
    updatedAt: nowIso(),
    legacy: {
      ...asset,
      publicUrl: asset.publicUrl,
      storagePath: asset.storagePath,
      storageBucket: asset.storageBucket,
      generationPrompt: asset.generationPrompt,
      provider: asset.provider,
      expiresAt: asset.expiresAt,
    },
  };

  // Apply remaining extras without inventing fields that were intentionally computed.
  if (extras) {
    for (const [k, v] of Object.entries(extras)) {
      if (v !== undefined && k !== "referenceEligible") {
        (base as any)[k] = v;
      }
    }
  }

  base.referenceEligible =
    extras?.referenceEligible ??
    computeReferenceEligible({
      lifecycle: base.lifecycle,
      authority: base.authority,
      url: base.storage.url,
      status: asset.status,
    });

  return base;
}

export function computeReferenceEligible(params: {
  lifecycle: AssetLifecycleStatus;
  authority: ReferenceAuthority;
  url?: string;
  status?: ProductionAsset["status"];
}): boolean {
  if (params.lifecycle === "rejected" || params.lifecycle === "deprecated") return false;
  if (params.authority === "rejected" || params.authority === "deprecated") return false;
  if (params.status === "failed" || params.status === "pending") return false;
  if (!params.url || !String(params.url).trim()) return false;
  const u = params.url.trim();
  if (u.startsWith("initials://") || u.startsWith("avatar://") || u === "null") return false;
  return (
    u.startsWith("http://") ||
    u.startsWith("https://") ||
    u.startsWith("data:image/") ||
    u.startsWith("blob:")
  );
}

/** Promote master approved URLs into registered reference assets. */
export function assetsFromMaster(
  master: MasterAssetRef,
  productionId: string,
  brandId?: string
): RegisteredAsset[] {
  const entityType = masterKindToEntity(master.kind);
  const entityId = master.identity.baseId;
  const createdAt = master.createdAt || nowIso();
  const authority: ReferenceAuthority =
    master.status === "approved"
      ? "approved"
      : master.status === "retired"
        ? "deprecated"
        : "candidate";
  const lifecycle: AssetLifecycleStatus =
    master.status === "approved"
      ? "approved"
      : master.status === "retired"
        ? "deprecated"
        : "candidate";

  return (master.approvedReferenceUrls || []).map((url, index) => {
    const id = `master-${master.identity.ref}-ref-${index}`;
    const role = defaultRoleForKind(master.kind, index);
    return {
      id,
      productionId,
      brandId,
      scope: "production" as const,
      category: categoryForKind(master.kind),
      entityType,
      entityId,
      roles: [role],
      authority,
      lifecycle,
      referenceEligible: computeReferenceEligible({ lifecycle, authority, url }),
      version: {
        version: master.identity.version,
        createdAt,
        status: lifecycle,
      },
      masterRef: master.identity.ref,
      masterKind: master.kind,
      storage: {
        url,
        persistenceStatus: "unknown" as const,
      },
      provenance: {
        source: "unknown" as const,
        createdAt,
        notes: `Derived from master ${master.identity.ref}`,
      },
      fingerprint: fingerprintFromUrlAndMeta({ url }),
      relationships: [],
      tags: master.tags || [],
      name: master.name,
      description: master.description,
      createdAt,
      updatedAt: master.updatedAt || createdAt,
    };
  });
}

function masterKindToEntity(kind: MasterAssetRef["kind"]): ProductionEntityType {
  switch (kind) {
    case "character":
      return "character";
    case "location":
      return "location";
    case "prop":
      return "prop";
    case "wardrobe":
      return "wardrobe";
    case "vehicle":
      return "vehicle";
    case "style":
      return "style";
    default:
      return "production";
  }
}

function categoryForKind(kind: MasterAssetRef["kind"]): AssetCategory {
  switch (kind) {
    case "character":
      return "character";
    case "location":
      return "location_plate";
    case "prop":
      return "prop";
    case "wardrobe":
      return "wardrobe_reference";
    case "style":
      return "style_reference";
    case "voice":
      return "voice";
    case "music":
      return "music";
    default:
      return "image";
  }
}

function defaultRoleForKind(kind: MasterAssetRef["kind"], index: number): ReferenceRole {
  if (kind === "character") return index === 0 ? "canonical_identity" : "supporting_reference";
  if (kind === "location") return index === 0 ? "location_anchor" : "environment";
  if (kind === "wardrobe") return "wardrobe";
  if (kind === "prop") return "prop_anchor";
  if (kind === "style") return "style_anchor";
  return "supporting_reference";
}
