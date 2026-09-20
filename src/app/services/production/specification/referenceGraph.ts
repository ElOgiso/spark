/**
 * Canonical ReferenceGraph Contract
 *
 * Provider-neutral representation of reference relationships, scopes, and inheritance:
 * Production → ReferenceGraph → Scene → Shot → Reference Requirements
 *
 * ReferenceGraph answers: Which visual assets and identities are related to this
 * production/scene/shot, and how? (Without knowing which provider will execute).
 */

export type ReferenceNodeType =
  | "CHARACTER"
  | "CHARACTER_IDENTITY"
  | "CHARACTER_SHEET"
  | "ENVIRONMENT"
  | "LOCATION"
  | "OBJECT"
  | "PRODUCT"
  | "STYLE"
  | "COMPOSITION"
  | "START_FRAME"
  | "END_FRAME"
  | "SOURCE_VIDEO"
  | "REPLACEMENT_OBJECT"
  | "LIGHTING"
  | "WARDROBE"
  | "PROPS"
  | "BRAND"
  | "USER_ASSET";

export type ReferenceRole =
  | "REQUIRED"
  | "PREFERRED"
  | "OPTIONAL"
  | "INHERITED"
  | "OVERRIDE"
  | "EXCLUDED";

export type ReferenceScope =
  | "PRODUCTION"
  | "SCENE"
  | "SHOT"
  | "SEQUENCE"
  | "CHARACTER"
  | "BRAND";

export type ReferenceRelationType =
  | "PARENT"
  | "INHERITS"
  | "OVERRIDES"
  | "DERIVED_FROM"
  | "REPRESENTS"
  | "IDENTITY_OF"
  | "STYLE_OF"
  | "LOCATION_OF"
  | "CONTINUITY_FROM";

/**
 * A semantic node in the ReferenceGraph.
 * Represents a visual or audio reference source.
 * Provider-neutral: contains NO provider-specific tokens, slots, or indexes.
 */
export interface ReferenceNode {
  id: string;
  type: ReferenceNodeType;
  role: ReferenceRole;
  scope: ReferenceScope;
  /** Stable asset ID in ProductionAsset / MediaAsset registry */
  assetId?: string;
  /** Master asset ref if applicable (e.g. character_host:v1) */
  masterRef?: string;
  /** Delivery URL for preview / rendering input */
  url?: string;
  label?: string;
  description?: string;
  /** ID of the entity this reference is attached to (e.g. characterId, locationId, sceneId, shotId) */
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Directed relationship edge between reference nodes.
 */
export interface ReferenceEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  type: ReferenceRelationType;
  metadata?: Record<string, unknown>;
}

/**
 * Canonical ReferenceGraph representing the complete network of reference
 * relationships for a production.
 */
export interface ReferenceGraph {
  id: string;
  productionId: string;
  nodes: ReferenceNode[];
  edges: ReferenceEdge[];
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Deterministic conflict surfaced when contradictory references cannot coexist.
 */
export interface ReferenceConflict {
  code: "CONTRADICTORY_IDENTITY" | "MULTIPLE_REQUIRED" | "MUTUALLY_EXCLUSIVE";
  entityId?: string;
  nodeIds: string[];
  description: string;
  evidence: {
    candidates: Array<{ id: string; assetId?: string; url?: string; role: ReferenceRole }>;
  };
}

export interface ResolveReferencesOptions {
  productionId: string;
  sceneId?: string;
  shotId?: string;
  characterIds?: string[];
  locationId?: string;
}

export interface ResolvedReferenceItem {
  nodeId: string;
  type: ReferenceNodeType;
  role: ReferenceRole;
  scope: ReferenceScope;
  assetId?: string;
  masterRef?: string;
  url?: string;
  label?: string;
  entityId?: string;
  source: "shot_override" | "shot" | "scene" | "character" | "brand" | "production" | "continuity";
}

export interface ResolvedReferenceSet {
  required: ResolvedReferenceItem[];
  preferred: ResolvedReferenceItem[];
  optional: ResolvedReferenceItem[];
  startFrame?: ResolvedReferenceItem;
  endFrame?: ResolvedReferenceItem;
  all: ResolvedReferenceItem[];
  conflicts: ReferenceConflict[];
  excludedNodeIds: string[];
}

/**
 * Create an empty, valid ReferenceGraph for a production.
 */
export function createEmptyReferenceGraph(productionId: string): ReferenceGraph {
  return {
    id: `refgraph_${productionId}`,
    productionId,
    nodes: [],
    edges: [],
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Resolve the effective set of references for a given shot within a ReferenceGraph.
 *
 * Precedence hierarchy (audited from SPARK production rules):
 * 1. Exclusions (explicitly excluded nodes or target of OVERRIDES edges)
 * 2. Shot-level overrides
 * 3. Shot-level references
 * 4. Scene-level references
 * 5. Character references (where entityId in characterIds)
 * 6. Brand / Production references
 *
 * Surfaces conflicts as structured data if contradictory REQUIRED references compete.
 */
export function resolveReferences(
  graph: ReferenceGraph,
  opts: ResolveReferencesOptions
): ResolvedReferenceSet {
  const excludedNodeIds = new Set<string>();
  const conflicts: ReferenceConflict[] = [];

  // Identify exclusions and override targets from edges
  for (const edge of graph.edges) {
    if (edge.type === "OVERRIDES") {
      excludedNodeIds.add(edge.toNodeId);
    }
  }

  // Identify nodes explicitly marked EXCLUDED
  for (const node of graph.nodes) {
    if (node.role === "EXCLUDED") {
      excludedNodeIds.add(node.id);
    }
  }

  // Filter eligible nodes by scope & relevance
  const eligibleItems: ResolvedReferenceItem[] = [];

  for (const node of graph.nodes) {
    if (excludedNodeIds.has(node.id)) continue;

    // Determine relevance
    if (opts.shotId && node.scope === "SHOT" && node.entityId === opts.shotId) {
      eligibleItems.push({
        nodeId: node.id,
        type: node.type,
        role: node.role,
        scope: node.scope,
        assetId: node.assetId,
        masterRef: node.masterRef,
        url: node.url,
        label: node.label,
        entityId: node.entityId,
        source: node.role === "OVERRIDE" ? "shot_override" : "shot",
      });
    } else if (opts.sceneId && node.scope === "SCENE" && node.entityId === opts.sceneId) {
      eligibleItems.push({
        nodeId: node.id,
        type: node.type,
        role: node.role,
        scope: node.scope,
        assetId: node.assetId,
        masterRef: node.masterRef,
        url: node.url,
        label: node.label,
        entityId: node.entityId,
        source: "scene",
      });
    } else if (
      opts.characterIds?.length &&
      node.scope === "CHARACTER" &&
      node.entityId &&
      opts.characterIds.includes(node.entityId)
    ) {
      eligibleItems.push({
        nodeId: node.id,
        type: node.type,
        role: node.role,
        scope: node.scope,
        assetId: node.assetId,
        masterRef: node.masterRef,
        url: node.url,
        label: node.label,
        entityId: node.entityId,
        source: "character",
      });
    } else if (node.scope === "BRAND") {
      eligibleItems.push({
        nodeId: node.id,
        type: node.type,
        role: node.role,
        scope: node.scope,
        assetId: node.assetId,
        masterRef: node.masterRef,
        url: node.url,
        label: node.label,
        entityId: node.entityId,
        source: "brand",
      });
    } else if (node.scope === "PRODUCTION") {
      eligibleItems.push({
        nodeId: node.id,
        type: node.type,
        role: node.role,
        scope: node.scope,
        assetId: node.assetId,
        masterRef: node.masterRef,
        url: node.url,
        label: node.label,
        entityId: node.entityId,
        source: "production",
      });
    }
  }

  // Conflict detection:
  // Detect if two distinct REQUIRED references claim the same character identity or same start frame
  const requiredByEntity: Record<string, ResolvedReferenceItem[]> = {};
  for (const item of eligibleItems) {
    if (item.role === "REQUIRED" && item.entityId && (item.type === "CHARACTER" || item.type === "CHARACTER_IDENTITY")) {
      const key = `${item.type}:${item.entityId}`;
      if (!requiredByEntity[key]) requiredByEntity[key] = [];
      requiredByEntity[key].push(item);
    }
  }

  for (const [key, items] of Object.entries(requiredByEntity)) {
    // If multiple items have distinct assetIds or URLs, surface a conflict
    const distinctAssets = new Set(items.map((i) => i.assetId || i.url).filter(Boolean));
    if (distinctAssets.size > 1) {
      const [type, entityId] = key.split(":");
      conflicts.push({
        code: "CONTRADICTORY_IDENTITY",
        entityId,
        nodeIds: items.map((i) => i.nodeId),
        description: `Contradictory REQUIRED references detected for ${type} entity ${entityId}.`,
        evidence: {
          candidates: items.map((i) => ({
            id: i.nodeId,
            assetId: i.assetId,
            url: i.url,
            role: i.role,
          })),
        },
      });
    }
  }

  // Deduplicate items: more specific source wins over broader source
  const sourceRank: Record<ResolvedReferenceItem["source"], number> = {
    shot_override: 100,
    shot: 80,
    scene: 60,
    continuity: 50,
    character: 40,
    brand: 20,
    production: 10,
  };

  const finalItems: ResolvedReferenceItem[] = [];
  const seenIdentities = new Set<string>();

  // Sort by priority rank descending
  const sorted = [...eligibleItems].sort((a, b) => sourceRank[b.source] - sourceRank[a.source]);

  for (const item of sorted) {
    const identityKey = `${item.type}:${item.entityId || "global"}:${item.assetId || item.url || item.nodeId}`;
    if (!seenIdentities.has(identityKey)) {
      seenIdentities.add(identityKey);
      finalItems.push(item);
    }
  }

  const required = finalItems.filter((i) => i.role === "REQUIRED" || i.role === "OVERRIDE");
  const preferred = finalItems.filter((i) => i.role === "PREFERRED" || i.role === "INHERITED");
  const optional = finalItems.filter((i) => i.role === "OPTIONAL");

  const startFrame = finalItems.find((i) => i.type === "START_FRAME");
  const endFrame = finalItems.find((i) => i.type === "END_FRAME");

  return {
    required,
    preferred,
    optional,
    startFrame,
    endFrame,
    all: finalItems,
    conflicts,
    excludedNodeIds: Array.from(excludedNodeIds),
  };
}
