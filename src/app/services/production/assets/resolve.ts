/**
 * Deterministic reference resolution for shots / capabilities.
 * Asset ≠ Reference. Canonical ≠ latest. Approved ≠ exists.
 */

import type { ShotReferencePack } from "../specification/shotSpec";
import type { ProductionAssetRegistry } from "./registry";
import type {
  ReferenceResolutionOptions,
  ReferenceBundle,
  ReferenceRequirement,
  ResolvedReference,
  ReferenceIssue,
  RegisteredAsset,
  ReferenceRole,
  ReferenceAuthority,
  CapabilityReferenceNeed,
  ProductionEntityType,
} from "./types";

export const SELECTION_POLICY =
  "explicitAssetId > canonical(+role+variant) > approved/preferred > supporting > candidate(if allowed); never deprecated/rejected; conflict if two canonicals";

const AUTHORITY_RANK: Record<ReferenceAuthority, number> = {
  canonical: 100,
  approved: 80,
  preferred: 70,
  supporting: 50,
  candidate: 20,
  deprecated: 0,
  rejected: 0,
};

function nowIso(): string {
  return new Date().toISOString();
}

function isSelectable(asset: RegisteredAsset, allowCandidate: boolean): boolean {
  if (asset.authority === "deprecated" || asset.authority === "rejected") return false;
  if (asset.lifecycle === "deprecated" || asset.lifecycle === "rejected") return false;
  if (!asset.referenceEligible) return false;
  if (asset.authority === "candidate" && !allowCandidate) return false;
  return true;
}

function roleMatch(asset: RegisteredAsset, roles: ReferenceRole[]): boolean {
  if (!roles.length) return true;
  return roles.some((r) => asset.roles.includes(r));
}

function variantMatch(asset: RegisteredAsset, variant?: string): boolean {
  if (!variant) return true;
  return asset.variant?.variantKey === variant;
}

function pickBest(
  candidates: RegisteredAsset[],
  preferredAuthority?: ReferenceAuthority[]
): RegisteredAsset | undefined {
  if (!candidates.length) return undefined;
  const ranked = [...candidates].sort((a, b) => {
    if (preferredAuthority?.length) {
      const ai = preferredAuthority.indexOf(a.authority);
      const bi = preferredAuthority.indexOf(b.authority);
      const ap = ai === -1 ? 999 : ai;
      const bp = bi === -1 ? 999 : bi;
      if (ap !== bp) return ap - bp;
    }
    const ar = AUTHORITY_RANK[a.authority] ?? 0;
    const br = AUTHORITY_RANK[b.authority] ?? 0;
    if (br !== ar) return br - ar;
    // Higher version wins as tie-break (not identity — only ranking)
    if (b.version.version !== a.version.version) return b.version.version - a.version.version;
    return a.id.localeCompare(b.id);
  });
  return ranked[0];
}

function toResolved(
  asset: RegisteredAsset,
  role: ReferenceRole,
  source: ResolvedReference["source"],
  reason: string
): ResolvedReference {
  return {
    assetId: asset.id,
    entityType: asset.entityType || "production",
    entityId: asset.entityId || asset.id,
    role,
    authority: asset.authority,
    variant: asset.variant?.variantKey,
    source,
    url: asset.storage?.url,
    masterRef: asset.masterRef,
    confidence:
      asset.authority === "canonical"
        ? 1
        : asset.authority === "approved"
          ? 0.9
          : asset.authority === "preferred"
            ? 0.8
            : asset.authority === "supporting"
              ? 0.6
              : 0.4,
    reason,
  };
}

function sourceForAuthority(authority: ReferenceAuthority): ResolvedReference["source"] {
  if (authority === "canonical") return "canonical";
  if (authority === "approved") return "approved";
  if (authority === "preferred") return "preferred";
  if (authority === "supporting") return "supporting";
  return "fallback";
}

/**
 * Resolve a reference bundle for a shot / production context.
 */
export function resolveReferenceBundle(
  registry: ProductionAssetRegistry,
  options: ReferenceResolutionOptions
): ReferenceBundle {
  const strict = options.strict !== false;
  const allowCandidate = options.allowCandidate === true;
  const references: ResolvedReference[] = [];
  const issues: ReferenceIssue[] = [];
  const sourceEntityIds = new Set<string>();
  let highestAuthority: ReferenceAuthority = "candidate";

  for (const req of options.requirements) {
    sourceEntityIds.add(req.entityId);
    const primaryRole = req.roles[0] || ("supporting_reference" as ReferenceRole);
    const pool = registry.list({
      productionId: options.productionId,
      entityType: req.entityType,
      entityId: req.entityId,
      allowGlobal: options.allowGlobal === true,
    });

    // 1. Explicit override
    if (req.explicitAssetId) {
      const explicit = registry.get(req.explicitAssetId);
      if (!explicit) {
        issues.push({
          code: "REFERENCE_UNRESOLVED",
          entityType: req.entityType,
          entityId: req.entityId,
          role: primaryRole,
          detail: `Explicit asset ${req.explicitAssetId} not found`,
          candidateAssetIds: [],
        });
        if (req.required !== false && strict) {
          issues.push({
            code: "REFERENCE_MISSING",
            entityType: req.entityType,
            entityId: req.entityId,
            role: primaryRole,
            detail: `Required explicit asset missing: ${req.explicitAssetId}`,
          });
        }
        continue;
      }
      if (explicit.entityType && explicit.entityType !== req.entityType) {
        issues.push({
          code: "REFERENCE_WRONG_ENTITY",
          entityType: req.entityType,
          entityId: req.entityId,
          role: primaryRole,
          detail: `Explicit asset ${explicit.id} entityType=${explicit.entityType} does not match ${req.entityType}`,
          selectedAssetId: explicit.id,
        });
        continue;
      }
      if (explicit.entityId && explicit.entityId !== req.entityId) {
        issues.push({
          code: "REFERENCE_WRONG_ENTITY",
          entityType: req.entityType,
          entityId: req.entityId,
          role: primaryRole,
          detail: `Explicit asset ${explicit.id} entityId=${explicit.entityId} does not match ${req.entityId}`,
          selectedAssetId: explicit.id,
        });
        continue;
      }
      if (req.roles.length && !roleMatch(explicit, req.roles)) {
        issues.push({
          code: "REFERENCE_WRONG_ROLE",
          entityType: req.entityType,
          entityId: req.entityId,
          requestedRole: primaryRole,
          selectedRole: explicit.roles[0],
          detail: `Explicit asset ${explicit.id} roles=[${explicit.roles.join(",")}] do not match required [${req.roles.join(",")}]`,
          selectedAssetId: explicit.id,
        });
        continue;
      }
      if (explicit.authority === "rejected" || explicit.lifecycle === "rejected") {
        issues.push({
          code: "REFERENCE_REJECTED",
          entityType: req.entityType,
          entityId: req.entityId,
          role: primaryRole,
          detail: `Explicit asset ${explicit.id} is rejected`,
          selectedAssetId: explicit.id,
        });
        continue;
      }
      references.push(
        toResolved(explicit, primaryRole, "explicit", "Selected via explicitAssetId override")
      );
      if (AUTHORITY_RANK[explicit.authority] > AUTHORITY_RANK[highestAuthority]) {
        highestAuthority = explicit.authority;
      }
      continue;
    }

    // Detect authority conflict: two+ canonicals same entity+role+variant
    const canonicals = pool.filter(
      (a) =>
        a.authority === "canonical" &&
        roleMatch(a, req.roles) &&
        variantMatch(a, req.variant) &&
        a.lifecycle !== "deprecated" &&
        a.lifecycle !== "rejected"
    );
    if (canonicals.length > 1) {
      issues.push({
        code: "REFERENCE_AUTHORITY_CONFLICT",
        entityType: req.entityType,
        entityId: req.entityId,
        role: primaryRole,
        detail: `Multiple canonical assets for ${req.entityType}/${req.entityId} role=${primaryRole} variant=${req.variant || "*"}`,
        candidateAssetIds: canonicals.map((c) => c.id),
      });
      continue;
    }

    // Build selectable pool by priority bands
    const selectableExact = pool.filter(
      (a) => isSelectable(a, allowCandidate) && roleMatch(a, req.roles) && variantMatch(a, req.variant)
    );

    let selected: RegisteredAsset | undefined;
    let source: ResolvedReference["source"] = "canonical";
    let reason = "";
    let fallbackUsed = false;

    // 2. Canonical + role + variant
    const canonical = selectableExact.find((a) => a.authority === "canonical");
    if (canonical) {
      selected = canonical;
      source = "canonical";
      reason = "Canonical match for entity+role+variant";
    }

    // 3. Approved / preferred
    if (!selected) {
      const approvedBand = selectableExact.filter(
        (a) => a.authority === "approved" || a.authority === "preferred"
      );
      selected = pickBest(approvedBand, req.preferredAuthority);
      if (selected) {
        source = sourceForAuthority(selected.authority);
        reason = `${selected.authority} match for entity+role+variant`;
      }
    }

    // 4. Supporting
    if (!selected) {
      const supporting = selectableExact.filter((a) => a.authority === "supporting");
      selected = pickBest(supporting, req.preferredAuthority);
      if (selected) {
        source = "supporting";
        reason = "Supporting match for entity+role+variant";
      }
    }

    // 5. Candidate (only if allowed)
    if (!selected && allowCandidate) {
      const candidates = selectableExact.filter((a) => a.authority === "candidate");
      selected = pickBest(candidates, req.preferredAuthority);
      if (selected) {
        source = "fallback";
        reason = "Candidate selected (allowCandidate=true)";
      }
    }

    // Variant fallback
    if (!selected && req.variant && req.allowVariantFallback) {
      const otherVariant = pool.filter(
        (a) =>
          isSelectable(a, allowCandidate) &&
          roleMatch(a, req.roles) &&
          !variantMatch(a, req.variant)
      );
      selected = pickBest(otherVariant, req.preferredAuthority);
      if (selected) {
        source = "fallback";
        reason = `Variant fallback: requested ${req.variant}, selected ${selected.variant?.variantKey || "default"}`;
        fallbackUsed = true;
        issues.push({
          code: "REFERENCE_FALLBACK_USED",
          entityType: req.entityType,
          entityId: req.entityId,
          role: primaryRole,
          detail: reason,
          fallbackUsed: true,
          selectedAssetId: selected.id,
          candidateAssetIds: otherVariant.map((a) => a.id),
        });
      } else {
        issues.push({
          code: "REFERENCE_VARIANT_UNAVAILABLE",
          entityType: req.entityType,
          entityId: req.entityId,
          role: primaryRole,
          detail: `No selectable assets for variant ${req.variant} and no fallback match`,
        });
      }
    } else if (!selected && req.variant && !req.allowVariantFallback) {
      const hasOther = pool.some(
        (a) => isSelectable(a, allowCandidate) && roleMatch(a, req.roles) && !variantMatch(a, req.variant)
      );
      if (hasOther || pool.some((a) => roleMatch(a, req.roles))) {
        issues.push({
          code: "REFERENCE_VARIANT_UNAVAILABLE",
          entityType: req.entityType,
          entityId: req.entityId,
          role: primaryRole,
          detail: `Variant ${req.variant} unavailable and allowVariantFallback=false`,
        });
      }
    }

    // Wrong role detection when entity assets exist but no role match
    if (!selected) {
      const entityAssets = pool.filter((a) => isSelectable(a, true));
      if (entityAssets.length && req.roles.length) {
        const wrongRole = entityAssets.filter((a) => !roleMatch(a, req.roles));
        if (wrongRole.length === entityAssets.length) {
          issues.push({
            code: "REFERENCE_WRONG_ROLE",
            entityType: req.entityType,
            entityId: req.entityId,
            requestedRole: primaryRole,
            selectedRole: wrongRole[0]?.roles[0],
            detail: `No asset with required roles [${req.roles.join(",")}] for ${req.entityId}`,
            candidateAssetIds: wrongRole.map((a) => a.id),
          });
          continue;
        }
      }
    }

    if (selected) {
      references.push(
        toResolved(
          selected,
          primaryRole,
          fallbackUsed ? "fallback" : source,
          reason || "Resolved by selection policy"
        )
      );
      if (AUTHORITY_RANK[selected.authority] > AUTHORITY_RANK[highestAuthority]) {
        highestAuthority = selected.authority;
      }
    } else if (req.required !== false) {
      issues.push({
        code: strict ? "REFERENCE_MISSING" : "REFERENCE_UNRESOLVED",
        entityType: req.entityType,
        entityId: req.entityId,
        role: primaryRole,
        detail: `No selectable reference for ${req.entityType}/${req.entityId} roles=[${req.roles.join(",")}] variant=${req.variant || "*"}`,
        candidateAssetIds: pool.map((a) => a.id),
      });
    } else {
      issues.push({
        code: "REFERENCE_UNRESOLVED",
        entityType: req.entityType,
        entityId: req.entityId,
        role: primaryRole,
        detail: `Optional reference unresolved for ${req.entityId}`,
        candidateAssetIds: pool.map((a) => a.id),
      });
    }
  }

  return {
    productionId: options.productionId,
    shotId: options.shotId,
    sceneId: options.sceneId,
    references,
    sourceEntityIds: [...sourceEntityIds],
    selectionPolicy: SELECTION_POLICY,
    authority: references.length ? highestAuthority : "candidate",
    issues,
    resolvedAt: nowIso(),
  };
}

export interface ShotLikeForReferences {
  id: string;
  sceneId: string;
  references: ShotReferencePack;
  characterIds?: string[];
  propIds?: string[];
}

/**
 * Build registry requirements from a shot's reference pack + entity ids.
 */
export function buildReferenceRequirementsFromShot(
  shot: ShotLikeForReferences,
  opts?: {
    required?: boolean;
    characterRoles?: ReferenceRole[];
    locationRoles?: ReferenceRole[];
    styleRoles?: ReferenceRole[];
    propRoles?: ReferenceRole[];
  }
): ReferenceRequirement[] {
  const required = opts?.required !== false;
  const reqs: ReferenceRequirement[] = [];
  const characterRoles: ReferenceRole[] = opts?.characterRoles || [
    "canonical_identity",
    "character_sheet",
    "hero_reference",
  ];
  const locationRoles: ReferenceRole[] = opts?.locationRoles || ["location_anchor", "environment"];
  const styleRoles: ReferenceRole[] = opts?.styleRoles || ["style_anchor"];
  const propRoles: ReferenceRole[] = opts?.propRoles || ["prop_anchor"];

  const characterIds = new Set<string>([
    ...(shot.characterIds || []),
    ...(shot.references.characterRefs || []),
  ]);
  for (const entityId of characterIds) {
    reqs.push({
      entityType: "character",
      entityId,
      roles: characterRoles,
      required,
    });
  }

  for (const entityId of shot.references.locationRefs || []) {
    reqs.push({
      entityType: "location",
      entityId,
      roles: locationRoles,
      required,
    });
  }

  for (const entityId of shot.references.styleRefs || []) {
    reqs.push({
      entityType: "style",
      entityId,
      roles: styleRoles,
      required: false,
    });
  }

  for (const entityId of shot.propIds || []) {
    reqs.push({
      entityType: "prop",
      entityId,
      roles: propRoles,
      required: false,
    });
  }

  return reqs;
}

/**
 * Provider-neutral handoff for Phase 3 capability routing.
 * No kling/veo/seedance field names.
 */
export function referenceBundleToCapabilityNeeds(
  bundle: ReferenceBundle
): CapabilityReferenceNeed[] {
  const byKey = new Map<string, CapabilityReferenceNeed>();

  for (const ref of bundle.references) {
    const key = `${ref.entityType}:${ref.entityId}`;
    const existing = byKey.get(key);
    const modalityHints = inferModalityHints(ref.url);
    if (existing) {
      if (!existing.roles.includes(ref.role)) existing.roles.push(ref.role);
      if (!existing.assetIds.includes(ref.assetId)) existing.assetIds.push(ref.assetId);
      for (const m of modalityHints) {
        if (!existing.modalityHints.includes(m)) existing.modalityHints.push(m);
      }
      existing.required = true;
    } else {
      byKey.set(key, {
        entityType: ref.entityType,
        entityId: ref.entityId,
        roles: [ref.role],
        assetIds: [ref.assetId],
        required: true,
        modalityHints,
      });
    }
  }

  // Surface unresolved required entities as needs with empty assetIds
  for (const issue of bundle.issues) {
    if (
      (issue.code === "REFERENCE_MISSING" || issue.code === "REFERENCE_UNRESOLVED") &&
      issue.entityType &&
      issue.entityId
    ) {
      const key = `${issue.entityType}:${issue.entityId}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          entityType: issue.entityType,
          entityId: issue.entityId,
          roles: issue.role ? [issue.role] : [],
          assetIds: [],
          required: issue.code === "REFERENCE_MISSING",
          modalityHints: ["image"],
        });
      }
    }
  }

  return [...byKey.values()];
}

function inferModalityHints(url?: string): Array<"image" | "video" | "audio"> {
  if (!url) return ["image"];
  const lower = url.toLowerCase();
  if (/\.(mp4|webm|mov|m4v)(\?|$)/.test(lower) || lower.includes("video/")) return ["video"];
  if (/\.(mp3|wav|aac|ogg|m4a)(\?|$)/.test(lower) || lower.includes("audio/")) return ["audio"];
  return ["image"];
}

export type { ProductionEntityType };
