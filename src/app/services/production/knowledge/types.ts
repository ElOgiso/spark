/**
 * Filmmaking Knowledge & Skill Runtime — provider-neutral schema.
 * Skills = reusable production knowledge modules (NOT agents).
 * Distinct from MemoryItem (preferences) and CapabilityRegistry (services).
 */

export type SkillDomain =
  | "story"
  | "character"
  | "environment"
  | "cinematography"
  | "generation"
  | "continuity"
  | "storyboard"
  | "audio"
  | "editorial"
  | "quality";

export type SkillStage =
  | "planning"
  | "shot_planning"
  | "prompt_compilation"
  | "generation_strategy"
  | "continuity"
  | "qc"
  | "editorial";

export type KnowledgeClassification =
  | "general-filmmaking"
  | "ai-filmmaking"
  | "generation-technique"
  | "provider-specific"
  | "experimental"
  | "heuristic"
  | "verified"
  | "unverified"
  | "deprecated";

export type EvidenceLevel =
  | "verified"
  | "heuristic"
  | "experimental"
  | "provider-specific"
  | "deprecated";

export type SkillStatus = "active" | "experimental" | "deprecated" | "disabled";

export type KnowledgeScope = "global" | "project" | "creator" | "provider";

export type SkillSourceType =
  | "research-derived"
  | "production-evidence"
  | "authoritative-docs"
  | "creator-preference"
  | "provider-contract";

/** Lower index = higher precedence. Provider capability facts may override generics. */
export type KnowledgePriorityLayer =
  | "project_constraints"
  | "production_requirements"
  | "creator_preferences"
  | "general_filmmaking"
  | "ai_generation_heuristics"
  | "provider_specific"
  | "experimental";

export const KNOWLEDGE_PRIORITY_ORDER: KnowledgePriorityLayer[] = [
  "project_constraints",
  "production_requirements",
  "creator_preferences",
  "general_filmmaking",
  "ai_generation_heuristics",
  "provider_specific",
  "experimental",
];

export interface SkillApplicability {
  whenAny?: string[];
  whenAll?: string[];
  whenNone?: string[];
  stages?: SkillStage[];
  mediaTypes?: Array<"image" | "video" | "audio" | "any">;
}

export interface SkillPrinciple {
  id: string;
  statement: string;
  classification: KnowledgeClassification;
  evidenceLevel: EvidenceLevel;
  priorityLayer: KnowledgePriorityLayer;
  scope?: KnowledgeScope;
}

export interface SkillRule {
  id: string;
  description: string;
  classification: KnowledgeClassification;
  evidenceLevel: EvidenceLevel;
  priorityLayer: KnowledgePriorityLayer;
  topic?: string;
  value?: string;
  optional?: boolean;
}

export interface SkillProcedureStep {
  id: string;
  action: string;
  notes?: string;
}

export interface SkillQualityCriterion {
  id: string;
  dimension: string;
  checks: string[];
}

export interface SkillFailureMode {
  id: string;
  symptom: string;
  likelyCause: string;
  recovery: string;
}

export interface FilmmakingSkill {
  id: string;
  name: string;
  version: string;
  status: SkillStatus;
  domain: SkillDomain;
  stages: SkillStage[];
  purpose: string;
  applicability: SkillApplicability;
  prerequisites?: string[];
  inputs?: string[];
  outputs?: string[];
  principles: SkillPrinciple[];
  rules: SkillRule[];
  procedure?: SkillProcedureStep[];
  constraints?: string[];
  qualityCriteria?: SkillQualityCriterion[];
  failureModes?: SkillFailureMode[];
  templates?: Record<string, string>;
  promptContextKeys?: string[];
  sourceType: SkillSourceType;
  evidenceLevel: EvidenceLevel;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, string>;
}

export interface FilmmakingSkillContext {
  productionId?: string;
  sceneId?: string;
  shotId?: string;
  shotPurpose?: string;
  shotType?: string;
  cameraMovement?: string;
  generationStrategy?: string;
  hasRecurringCharacter?: boolean;
  hasRecurringLocation?: boolean;
  characterCount?: number;
  dependsOnPreviousShot?: boolean;
  hasPreviousVideo?: boolean;
  hasFirstFrame?: boolean;
  hasLastFrame?: boolean;
  isEstablishingShot?: boolean;
  isIsolatedShot?: boolean;
  requiresMotion?: boolean;
  requiresTimeline?: boolean;
  projectConstraints?: string[];
  creatorPreferences?: string[];
  tags?: string[];
  providerCapabilityFacts?: string[];
}

export interface SkillConflict {
  topic: string;
  skillAId: string;
  skillAVersion: string;
  valueA: string;
  skillBId: string;
  skillBVersion: string;
  valueB: string;
  resolution:
    | "higher_priority"
    | "different_context"
    | "optional_ignored"
    | "needs_review"
    | "unresolved";
  winnerSkillId?: string;
  note: string;
}

export interface SkillApplicationOutput {
  skillId: string;
  skillVersion: string;
  constraints: string[];
  recommendations: string[];
  promptContext: Record<string, string | string[]>;
  generationRequirements: Record<string, string | boolean | string[]>;
  continuityRequirements: string[];
  qualityCriteria: string[];
  warnings: string[];
  rulesApplied: Array<{
    ruleId: string;
    topic?: string;
    value?: string;
    priorityLayer: KnowledgePriorityLayer;
  }>;
}

export interface ComposedSkillOutput {
  skillIds: string[];
  skillVersions: Record<string, string>;
  constraints: string[];
  recommendations: string[];
  promptContext: Record<string, string | string[]>;
  generationRequirements: Record<string, string | boolean | string[]>;
  continuityRequirements: string[];
  qualityCriteria: string[];
  warnings: string[];
  conflicts: SkillConflict[];
  applied: SkillApplicationOutput[];
}

export interface ShotFilmmakingGuidance {
  skillIds: string[];
  skillVersions: Record<string, string>;
  constraints: string[];
  recommendations: string[];
  promptContext: Record<string, string | string[]>;
  qualityCriteria: string[];
  warnings: string[];
  conflicts: SkillConflict[];
}
