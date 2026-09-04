/**
 * Canonical production specification types for Spark Production OS.
 * ProductionSpec is the source of truth for planning; legacy ProductionBrief remains a compatibility view.
 */

import type { ProductionMode, StructuredResearchContext } from "../../../domain/types";
import type { SceneSpec } from "./sceneSpec";
import type { ContinuitySpec } from "./continuitySpec";
import type { AudioSpec } from "./audioSpec";
import type { RoutingSpec } from "./routingSpec";
import type { QualitySpec } from "./qualitySpec";
import type { AssetMasterRef, CharacterMaster, MasterAssetRef } from "./assetSpec";
import type { ResearchRequirementSpec } from "./researchRequirement";

export type CreativeControlMode = "auto" | "director" | "studio";

export type ContentGenreId =
  | "narrative_film"
  | "documentary"
  | "advertisement"
  | "music_video"
  | "social"
  | "educational"
  | "news_explainer"
  | "animation"
  | "anime"
  | "product_demo"
  | "travel"
  | "sports"
  | "comedy"
  | "custom";

export type PlatformId =
  | "youtube"
  | "youtube_shorts"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "other";

export type AspectRatioId = "9:16" | "16:9" | "1:1" | "4:5" | "21:9" | string;

export interface ProjectSpec {
  id: string;
  title: string;
  brandId?: string;
  sparkId?: string;
  idea: string;
  createdAt: string;
  updatedAt: string;
  productionMode: ProductionMode | string;
  creativeControl: CreativeControlMode;
  targetDurationSec: number;
  platforms: PlatformId[];
  aspectRatio: AspectRatioId;
  formats: string[];
  status:
    | "planning"
    | "brief_pending_approval"
    | "approved"
    | "generating"
    | "qc"
    | "editorial"
    | "mastered"
    | "failed"
    | "cancelled";
}

export interface CreativeSpec {
  /** Raw user intent */
  intent: string;
  /** Primary genre grammar id */
  genre: ContentGenreId;
  /** Additional composable grammar tags (e.g. cinematic, luxury, short-form) */
  grammarTags: string[];
  subgenre?: string;
  tone: string;
  audience: string;
  narrativeStructure: string;
  visualLanguage: string;
  pacing: "compressed" | "measured" | "epic" | "variable" | string;
  emotionalArc: string;
  requiresHost: boolean;
  requiresCharacters: boolean;
  requiresNarration: boolean;
  requiresDialogue: boolean;
  requiresAnimation: boolean;
  requiresProductShots: boolean;
  requiresDocumentaryTreatment: boolean;
  requiresResearch: boolean;
  requiresGeneratedEnvironments: boolean;
  requiresStockOrUserAssets: boolean;
  requiresImageGeneration: boolean;
  requiresVideoGeneration: boolean;
  requiresVoiceGeneration: boolean;
  requiresMusic: boolean;
  requiresSoundDesign: boolean;
  requiresEditing: boolean;
  estimatedSceneCount: number;
  estimatedShotCount: number;
  confidence: number;
  rationale: string[];
}

export interface WorldSpec {
  era?: string;
  settingSummary: string;
  locations: Array<{
    id: string;
    name: string;
    description: string;
    timeOfDay?: string;
    atmosphere?: string;
    masterAssetId?: string;
  }>;
  geographyNotes?: string;
}

export interface NarrativeSpec {
  logline: string;
  hook: string;
  acts: Array<{
    id: string;
    name: string;
    purpose: string;
    sceneIds: string[];
  }>;
  scriptOutline: string;
  ctaSpoken?: string;
  ctaOnScreen?: string;
  caption?: string;
  whyThisWorks?: string;
}

export interface VisualStyleSpec {
  look: string;
  colorLanguage: string;
  cameraLanguage: string;
  lightingLanguage: string;
  era?: string;
  references: string[];
  antiSlopLaws: string[];
}

export interface ProductionApprovalSummary {
  projectTitle: string;
  genreLabel: string;
  styleLabel: string;
  structureLabel: string;
  characterCount: number;
  locationCount: number;
  sceneCount: number;
  shotCount: number;
  audioSummary: string;
  generationStrategy: string;
  estimatedGenerationTasks: number;
  qualityTarget: string;
  estimatedCreditsHint?: string;
}

/**
 * Canonical production specification — planning brain of Spark Production OS.
 */
export interface ProductionSpec {
  id: string;
  version: number;
  project: ProjectSpec;
  creative: CreativeSpec;
  world: WorldSpec;
  characters: CharacterMaster[];
  assets: MasterAssetRef[];
  narrative: NarrativeSpec;
  scenes: SceneSpec[];
  audio: AudioSpec;
  visualStyle: VisualStyleSpec;
  continuity: ContinuitySpec;
  routing: RoutingSpec;
  quality: QualitySpec;
  /** Structured research needs identified by Creative Director — not invented facts */
  researchRequirements: ResearchRequirementSpec;
  researchContext?: StructuredResearchContext;
  approvalSummary?: ProductionApprovalSummary;
  /** Observability / compiler metadata */
  meta: {
    specVersion: string;
    compilerVersion: string;
    createdFrom: "spark" | "idea" | "legacy_brief" | "migration";
    legacyProductionId?: string;
    grammarIds: string[];
  };
}

export type { SceneSpec, ContinuitySpec, AudioSpec, RoutingSpec, QualitySpec, CharacterMaster, AssetMasterRef, MasterAssetRef };
