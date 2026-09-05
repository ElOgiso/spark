/**
 * In-memory Production Asset Registry.
 * No new DB required — SPARK works without a Supabase-only dependency.
 * Sits alongside productionAssetService; does not replace it.
 */

import type { ProductionAsset } from "../../../domain/types";
import type { MasterAssetRef } from "../specification/assetSpec";
import type {
  RegisteredAsset,
  ReferenceAuthority,
  ReferenceRole,
  AssetRelationship,
  AssetUsageLink,
  ProductionEntityType,
  ReferenceIssue,
  AssetLifecycleStatus,
} from "./types";
import { assetsFromMaster, normalizeProductionAsset, computeReferenceEligible } from "./normalize";

export interface RegistryListFilter {
  productionId?: string;
  brandId?: string;
  entityType?: ProductionEntityType;
  entityId?: string;
  authority?: ReferenceAuthority;
  role?: ReferenceRole;
  category?: string;
  lifecycle?: AssetLifecycleStatus;
  /** Include global-scope assets when productionId is set (default false). */
  allowGlobal?: boolean;
  referenceEligible?: boolean;
  fingerprint?: string;
  masterRef?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function sameVariant(
  a: RegisteredAsset["variant"] | undefined,
  variantKey?: string
): boolean {
  if (!variantKey) return true;
  return a?.variantKey === variantKey;
}

export class ProductionAssetRegistry {
  private assets = new Map<string, RegisteredAsset>();
  private usages: AssetUsageLink[] = [];

  register(asset: RegisteredAsset): RegisteredAsset {
    this.assertNoDerivedCycle(asset.id, asset.relationships || []);
    for (const rel of asset.relationships || []) {
      if (rel.type === "derived_from") {
        this.assertNoDerivedCycle(rel.fromAssetId, [rel]);
      }
    }
    const copy: RegisteredAsset = {
      ...asset,
      roles: [...(asset.roles || [])],
      relationships: [...(asset.relationships || [])],
      tags: [...(asset.tags || [])],
      updatedAt: asset.updatedAt || nowIso(),
    };
    this.assets.set(copy.id, copy);
    return { ...copy, roles: [...copy.roles], relationships: [...copy.relationships], tags: [...copy.tags] };
  }

  registerProductionAsset(
    asset: ProductionAsset,
    extras?: Partial<RegisteredAsset>
  ): RegisteredAsset {
    return this.register(normalizeProductionAsset(asset, extras));
  }

  registerMasterAssets(
    masters: MasterAssetRef[],
    productionId: string,
    brandId?: string
  ): RegisteredAsset[] {
    const out: RegisteredAsset[] = [];
    for (const master of masters) {
      for (const a of assetsFromMaster(master, productionId, brandId)) {
        out.push(this.register(a));
      }
    }
    return out;
  }

  get(id: string): RegisteredAsset | undefined {
    const a = this.assets.get(id);
    return a ? this.clone(a) : undefined;
  }

  list(filter?: RegistryListFilter): RegisteredAsset[] {
    const results: RegisteredAsset[] = [];
    for (const asset of this.assets.values()) {
      if (!this.matchesFilter(asset, filter)) continue;
      results.push(this.clone(asset));
    }
    return results;
  }

  listByEntity(entityType: ProductionEntityType, entityId: string): RegisteredAsset[] {
    return this.list({ entityType, entityId, allowGlobal: true });
  }

  update(id: string, patch: Partial<RegisteredAsset>): RegisteredAsset {
    const existing = this.assets.get(id);
    if (!existing) throw new Error(`Asset not found: ${id}`);
    const next: RegisteredAsset = {
      ...existing,
      ...patch,
      id: existing.id,
      roles: patch.roles ? [...patch.roles] : [...existing.roles],
      relationships: patch.relationships
        ? [...patch.relationships]
        : [...existing.relationships],
      tags: patch.tags ? [...patch.tags] : [...existing.tags],
      updatedAt: nowIso(),
    };
    if (patch.relationships) {
      this.assertNoDerivedCycle(id, next.relationships);
    }
    next.referenceEligible = computeReferenceEligible({
      lifecycle: next.lifecycle,
      authority: next.authority,
      url: next.storage?.url,
      status: next.legacy?.status,
    });
    this.assets.set(id, next);
    return this.clone(next);
  }

  /**
   * Set authority. When promoting to canonical, demote previous canonicals
   * for the same entity+role+variant WITHOUT deleting them.
   */
  setAuthority(id: string, authority: ReferenceAuthority): RegisteredAsset {
    const asset = this.assets.get(id);
    if (!asset) throw new Error(`Asset not found: ${id}`);

    if (authority === "canonical") {
      this.demoteSiblingCanonicals(asset);
      return this.update(id, {
        authority: "canonical",
        lifecycle: "canonical",
      });
    }

    const lifecycle: AssetLifecycleStatus =
      authority === "approved"
        ? "approved"
        : authority === "deprecated"
          ? "deprecated"
          : authority === "rejected"
            ? "rejected"
            : authority === "candidate"
              ? "candidate"
              : asset.lifecycle;

    return this.update(id, { authority, lifecycle });
  }

  promoteToCanonical(id: string, role: ReferenceRole): RegisteredAsset {
    const asset = this.assets.get(id);
    if (!asset) throw new Error(`Asset not found: ${id}`);
    const roles = asset.roles.includes(role) ? asset.roles : [...asset.roles, role];
    this.update(id, { roles });
    return this.setAuthority(id, "canonical");
  }

  deprecate(id: string): RegisteredAsset {
    return this.setAuthority(id, "deprecated");
  }

  reject(id: string): RegisteredAsset {
    return this.setAuthority(id, "rejected");
  }

  addRelationship(rel: AssetRelationship): void {
    if (rel.type === "derived_from") {
      this.assertNoDerivedCycle(rel.fromAssetId, [rel]);
    }
    const from = this.assets.get(rel.fromAssetId);
    if (!from) throw new Error(`Asset not found: ${rel.fromAssetId}`);
    const relationships = [...from.relationships, rel];
    this.update(rel.fromAssetId, { relationships, parentAssetId: rel.type === "derived_from" ? rel.toAssetId : from.parentAssetId });

    const to = this.assets.get(rel.toAssetId);
    if (to) {
      const mirror = to.relationships.some(
        (r) =>
          r.type === rel.type &&
          r.fromAssetId === rel.fromAssetId &&
          r.toAssetId === rel.toAssetId
      );
      if (!mirror) {
        this.assets.set(rel.toAssetId, {
          ...to,
          relationships: [...to.relationships, rel],
          updatedAt: nowIso(),
        });
      }
    }
  }

  /** Ancestors via derived_from, oldest-first. */
  getLineage(assetId: string): RegisteredAsset[] {
    const ancestors: RegisteredAsset[] = [];
    const visited = new Set<string>();
    let currentId: string | undefined = assetId;

    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);
      const asset = this.assets.get(currentId);
      if (!asset) break;
      const parentRel = asset.relationships.find((r) => r.type === "derived_from" && r.fromAssetId === currentId);
      const parentId = parentRel?.toAssetId || asset.parentAssetId;
      if (!parentId || parentId === currentId) break;
      const parent = this.assets.get(parentId);
      if (!parent) break;
      ancestors.unshift(this.clone(parent));
      currentId = parentId;
    }
    return ancestors;
  }

  getUsages(assetId: string): AssetUsageLink[] {
    return this.usages.filter((u) => u.assetId === assetId).map((u) => ({ ...u }));
  }

  recordUsage(link: AssetUsageLink): AssetUsageLink {
    const entry = { ...link, createdAt: link.createdAt || nowIso() };
    this.usages.push(entry);
    return { ...entry };
  }

  findByFingerprint(fingerprint: string, productionId?: string): RegisteredAsset[] {
    return this.list({
      fingerprint,
      productionId,
      allowGlobal: !productionId,
    });
  }

  validateAsset(id: string): { ok: boolean; issues: ReferenceIssue[] } {
    const asset = this.assets.get(id);
    const issues: ReferenceIssue[] = [];
    if (!asset) {
      return {
        ok: false,
        issues: [{ code: "ASSET_VALIDATION_FAILED", detail: `Asset not found: ${id}` }],
      };
    }
    if (asset.authority === "rejected" || asset.lifecycle === "rejected") {
      issues.push({
        code: "REFERENCE_REJECTED",
        entityType: asset.entityType,
        entityId: asset.entityId,
        detail: `Asset ${id} is rejected`,
        selectedAssetId: id,
      });
    }
    if (asset.authority === "deprecated" || asset.lifecycle === "deprecated") {
      issues.push({
        code: "REFERENCE_DEPRECATED",
        entityType: asset.entityType,
        entityId: asset.entityId,
        detail: `Asset ${id} is deprecated`,
        selectedAssetId: id,
      });
    }
    if (!asset.referenceEligible) {
      issues.push({
        code: "REFERENCE_INELIGIBLE",
        entityType: asset.entityType,
        entityId: asset.entityId,
        detail: `Asset ${id} is not reference-eligible`,
        selectedAssetId: id,
      });
    }
    try {
      this.assertNoDerivedCycle(id, asset.relationships);
    } catch (e: any) {
      issues.push({
        code: "ASSET_LINEAGE_CYCLE",
        detail: e?.message || "Lineage cycle detected",
        selectedAssetId: id,
      });
    }
    return { ok: issues.length === 0, issues };
  }

  resetForTests(): void {
    this.assets.clear();
    this.usages = [];
  }

  private demoteSiblingCanonicals(asset: RegisteredAsset): void {
    for (const other of this.assets.values()) {
      if (other.id === asset.id) continue;
      if (other.authority !== "canonical") continue;
      if (other.productionId !== asset.productionId && other.scope !== "global") continue;
      if (other.entityType !== asset.entityType || other.entityId !== asset.entityId) continue;
      const sharedRole = asset.roles.some((r) => other.roles.includes(r));
      if (!sharedRole) continue;
      if (asset.variant?.variantKey || other.variant?.variantKey) {
        if (asset.variant?.variantKey !== other.variant?.variantKey) continue;
      }
      other.authority = "approved";
      other.lifecycle = other.lifecycle === "canonical" ? "approved" : other.lifecycle;
      other.updatedAt = nowIso();
      other.referenceEligible = computeReferenceEligible({
        lifecycle: other.lifecycle,
        authority: other.authority,
        url: other.storage?.url,
        status: other.legacy?.status,
      });
    }
  }

  private matchesFilter(asset: RegisteredAsset, filter?: RegistryListFilter): boolean {
    if (!filter) return true;
    if (filter.productionId) {
      const sameProduction = asset.productionId === filter.productionId;
      const globalOk = filter.allowGlobal && asset.scope === "global";
      if (!sameProduction && !globalOk) return false;
    } else if (asset.scope === "global" && filter.allowGlobal === false) {
      return false;
    }
    if (filter.brandId && asset.brandId !== filter.brandId) return false;
    if (filter.entityType && asset.entityType !== filter.entityType) return false;
    if (filter.entityId && asset.entityId !== filter.entityId) return false;
    if (filter.authority && asset.authority !== filter.authority) return false;
    if (filter.lifecycle && asset.lifecycle !== filter.lifecycle) return false;
    if (filter.category && asset.category !== filter.category) return false;
    if (filter.role && !asset.roles.includes(filter.role)) return false;
    if (filter.referenceEligible != null && asset.referenceEligible !== filter.referenceEligible)
      return false;
    if (filter.fingerprint && asset.fingerprint !== filter.fingerprint) return false;
    if (filter.masterRef && asset.masterRef !== filter.masterRef) return false;
    return true;
  }

  /**
   * Reject lineage cycles on derived_from chains.
   * Relationship semantics: fromAssetId derived_from toAssetId (from ← to).
   */
  private assertNoDerivedCycle(fromId: string, newRels: AssetRelationship[]): void {
    for (const rel of newRels) {
      if (rel.type !== "derived_from") continue;
      if (rel.fromAssetId !== fromId && fromId !== rel.fromAssetId) {
        // Still check the declared edge
      }
      const start = rel.fromAssetId;
      const parent = rel.toAssetId;
      if (start === parent) {
        throw new Error(`ASSET_LINEAGE_CYCLE: self-reference on ${start}`);
      }
      // Walk ancestors of parent; if we reach start, adding this edge creates a cycle.
      const visited = new Set<string>();
      const queue: string[] = [parent];
      while (queue.length) {
        const cur = queue.shift()!;
        if (cur === start) {
          throw new Error(
            `ASSET_LINEAGE_CYCLE: derived_from cycle involving ${start} and ${parent}`
          );
        }
        if (visited.has(cur)) continue;
        visited.add(cur);
        const node = this.assets.get(cur);
        if (!node) continue;
        if (node.parentAssetId) queue.push(node.parentAssetId);
        for (const r of node.relationships) {
          if (r.type === "derived_from" && r.fromAssetId === cur) {
            queue.push(r.toAssetId);
          }
        }
      }
    }
  }

  private clone(asset: RegisteredAsset): RegisteredAsset {
    return {
      ...asset,
      roles: [...asset.roles],
      relationships: [...asset.relationships],
      tags: [...asset.tags],
      version: { ...asset.version },
      variant: asset.variant ? { ...asset.variant } : undefined,
      storage: { ...asset.storage },
      media: asset.media ? { ...asset.media } : undefined,
      provenance: { ...asset.provenance },
      legacy: asset.legacy ? { ...asset.legacy } : undefined,
    };
  }
}

/** Shared singleton for optional app-wide use (tests should prefer a fresh instance). */
export const defaultProductionAssetRegistry = new ProductionAssetRegistry();
