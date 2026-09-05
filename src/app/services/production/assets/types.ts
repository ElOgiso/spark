/**
 * Reference & Asset Intelligence — Phase 4 contracts.
 *
 * Extends existing ProductionAsset + MasterAsset* models.
 * Asset ≠ Reference. Canonical ≠ latest. Approved ≠ exists.
 * No second asset/character/continuity system.
 */

import type { ProductionAsset } from "../../../domain/types";
import type { MasterAssetKind } from "../specification/assetSpec";

/** Extends media taxonomy without replacing ProductionAsset.assetType. */
export type AssetCategory =
  | ProductionAsset["assetType"]
  | "character"
  | "character_sheet"
  | "face_reference"
  | "body_reference"
  | "wardrobe_reference"
  | "location"
  | "location_plate"
  | "environment_reference"
  | "prop"
  | "prop_reference"
  | "vehicle"
  | "vehicle_reference"
  | "style_reference"
  | "composition_reference"
  | "storyboard"
  | "storyboard_panel"
  | "voice"
  | "music"
  | "sfx"
  | "document"
  | "frame";

export type ProductionEntityType =
  | "character"
  | "location"
  | "prop"
  | "wardrobe"
  | "vehicle"
  | "style"
  | "scene"
  | "shot"
  | "production";

export type ReferenceRole =
  | "canonical_identity"
  | "hero_reference"
  | "supporting_reference"
  | "character_sheet"
  | "face"
  | "body"
  | "full_body"
  | "wardrobe"
  | "location_anchor"
  | "environment"
  | "prop_anchor"
  | "vehicle_anchor"
  | "style_anchor"
  | "composition"
  | "lighting"
  | "storyboard"
  | "start_frame"
  | "end_frame"
  | "continuation_frame"
  | "source_media"
  | "generated_output"
  | "approved_output"
  | "master_output"
  | "thumbnail";

export type ReferenceAuthority =
  | "canonical"
  | "approved"
  | "preferred"
  | "supporting"
  | "candidate"
  | "deprecated"
  | "rejected";

export type AssetLifecycleStatus =
  | "candidate"
  | "imported"
  | "generated"
  | "validated"
  | "approved"
  | "canonical"
  | "deprecated"
  | "rejected";

export type AssetProvenanceSource =
  | "user_uploaded"
  | "generated_by_spark"
  | "generated_external"
  | "provider_output"
  | "derived_from_asset"
  | "extracted_from_video"
  | "extracted_from_frame"
  | "imported"
  | "research_reference"
  | "system_generated"
  | "unknown";

export type AssetRelationshipType =
  | "derived_from"
  | "variant_of"
  | "references"
  | "used_by"
  | "belongs_to"
  | "canonical_for"
  | "approved_for"
  | "replaces"
  | "supersedes";

export type AssetScope = "global" | "brand" | "production" | "scene" | "shot";

export type ReferenceIssueCode =
  | "REFERENCE_MISSING"
  | "REFERENCE_UNRESOLVED"
  | "REFERENCE_FALLBACK_USED"
  | "REFERENCE_AUTHORITY_CONFLICT"
  | "REFERENCE_WRONG_ROLE"
  | "REFERENCE_WRONG_ENTITY"
  | "REFERENCE_WRONG_VARIANT"
  | "REFERENCE_VARIANT_UNAVAILABLE"
  | "REFERENCE_DEPRECATED"
  | "REFERENCE_REJECTED"
  | "REFERENCE_INELIGIBLE"
  | "ASSET_VALIDATION_FAILED"
  | "ASSET_LINEAGE_CYCLE";

export interface AssetStorageRef {
  storageKey?: string;
  storageProvider?: string;
  url?: string;
  thumbnailUrl?: string;
  /** Provider URLs may expire — never use as identity. */
  temporary?: boolean;
  persistenceStatus?: "durable" | "temporary" | "unknown";
}

export interface AssetMediaMetadata {
  width?: number;
  height?: number;
  aspectRatio?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  durationSec?: number;
  frameRate?: number;
  sampleRate?: number;
  channels?: number;
}

export interface AssetProvenance {
  source: AssetProvenanceSource;
  sourceAssetId?: string;
  sourceGenerationTaskId?: string;
  sourceProvider?: string;
  sourceModel?: string;
  sourcePromptId?: string;
  sourceShotId?: string;
  createdAt?: string;
  notes?: string;
}

export interface AssetVersionInfo {
  version: number;
  parentVersion?: number;
  reason?: string;
  createdAt: string;
  status: AssetLifecycleStatus;
}

export interface AssetVariantInfo {
  variantKey: string;
  label?: string;
  /** e.g. front | three_quarter | day | night | rain */
  attributes?: Record<string, string>;
}

export interface AssetRelationship {
  type: AssetRelationshipType;
  fromAssetId: string;
  toAssetId: string;
  createdAt: string;
  metadata?: Record<string, string>;
}

export interface AssetUsageLink {
  assetId: string;
  productionId: string;
  sceneId?: string;
  shotId?: string;
  role?: ReferenceRole;
  createdAt: string;
}

/**
 * Normalized registry record — wraps / extends ProductionAsset.
 * Stable `id` is independent of storage URL.
 */
export interface RegisteredAsset {
  id: string;
  productionId: string;
  brandId?: string;
  scope: AssetScope;
  category: AssetCategory;
  /** Original ProductionAsset.assetType when known */
  mediaType?: ProductionAsset["assetType"];
  entityType?: ProductionEntityType;
  entityId?: string;
  roles: ReferenceRole[];
  authority: ReferenceAuthority;
  lifecycle: AssetLifecycleStatus;
  referenceEligible: boolean;
  version: AssetVersionInfo;
  variant?: AssetVariantInfo;
  /** Master asset identity ref e.g. character_001:v3 */
  masterRef?: string;
  masterKind?: MasterAssetKind;
  storage: AssetStorageRef;
  media?: AssetMediaMetadata;
  provenance: AssetProvenance;
  fingerprint?: string;
  parentAssetId?: string;
  relationships: AssetRelationship[];
  tags: string[];
  name?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  /** Optional link back to raw ProductionAsset fields */
  legacy?: Partial<ProductionAsset>;
}

export interface ReferenceRequirement {
  entityType: ProductionEntityType;
  entityId: string;
  roles: ReferenceRole[];
  required?: boolean;
  preferredAuthority?: ReferenceAuthority[];
  variant?: string;
  /** Explicit override — validated, never auto-replaced */
  explicitAssetId?: string;
  allowVariantFallback?: boolean;
}

export interface ResolvedReference {
  assetId: string;
  entityType: ProductionEntityType;
  entityId: string;
  role: ReferenceRole;
  authority: ReferenceAuthority;
  variant?: string;
  source: "explicit" | "canonical" | "approved" | "preferred" | "supporting" | "fallback";
  url?: string;
  masterRef?: string;
  confidence?: number;
  reason: string;
}

export interface ReferenceIssue {
  code: ReferenceIssueCode;
  entityType?: ProductionEntityType;
  entityId?: string;
  role?: ReferenceRole;
  requestedRole?: ReferenceRole;
  selectedRole?: ReferenceRole;
  detail: string;
  candidateAssetIds?: string[];
  /** True when a non-preferred variant/authority was selected under an explicit fallback rule. */
  fallbackUsed?: boolean;
  selectedAssetId?: string;
}

export interface ReferenceBundle {
  productionId: string;
  shotId?: string;
  sceneId?: string;
  references: ResolvedReference[];
  sourceEntityIds: string[];
  selectionPolicy: string;
  authority: ReferenceAuthority;
  issues: ReferenceIssue[];
  resolvedAt: string;
}

/** Provider-neutral handoff for Phase 3 capability routing. */
export interface CapabilityReferenceNeed {
  entityType: ProductionEntityType;
  entityId: string;
  roles: ReferenceRole[];
  assetIds: string[];
  required: boolean;
  modalityHints: Array<"image" | "video" | "audio">;
}

export interface ReferenceResolutionOptions {
  productionId: string;
  shotId?: string;
  sceneId?: string;
  requirements: ReferenceRequirement[];
  /** When true, missing required refs become hard issues (default). */
  strict?: boolean;
  /** Allow selecting candidate-authority assets when no stronger match exists (default false). */
  allowCandidate?: boolean;
  /** Include global-scope assets in resolution (default false). */
  allowGlobal?: boolean;
}
