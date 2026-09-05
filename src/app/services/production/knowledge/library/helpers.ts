/**
 * Helpers for declaring filmmaking skills in the catalog.
 */

import type {
  EvidenceLevel,
  FilmmakingSkill,
  KnowledgeClassification,
  KnowledgePriorityLayer,
  SkillRule,
} from "../types";

export const SKILL_TIMESTAMP = "2026-09-05T00:00:00.000Z";

const DEFAULT_CLASSIFICATION: KnowledgeClassification = "heuristic";
const DEFAULT_EVIDENCE: EvidenceLevel = "heuristic";
const DEFAULT_PRIORITY: KnowledgePriorityLayer = "ai_generation_heuristics";

export type RuleInput = Partial<SkillRule> &
  Pick<SkillRule, "id" | "description"> & {
    classification?: KnowledgeClassification;
    evidenceLevel?: EvidenceLevel;
    priorityLayer?: KnowledgePriorityLayer;
  };

export function rule(input: RuleInput): SkillRule {
  return {
    classification: input.classification ?? DEFAULT_CLASSIFICATION,
    evidenceLevel: input.evidenceLevel ?? DEFAULT_EVIDENCE,
    priorityLayer: input.priorityLayer ?? DEFAULT_PRIORITY,
    id: input.id,
    description: input.description,
    topic: input.topic,
    value: input.value,
    optional: input.optional,
  };
}

export type SkillInput = Omit<
  FilmmakingSkill,
  "createdAt" | "updatedAt" | "evidenceLevel" | "sourceType" | "version" | "status" | "principles" | "rules"
> &
  Partial<
    Pick<
      FilmmakingSkill,
      | "createdAt"
      | "updatedAt"
      | "evidenceLevel"
      | "sourceType"
      | "version"
      | "status"
      | "principles"
      | "rules"
      | "prerequisites"
      | "inputs"
      | "outputs"
      | "procedure"
      | "constraints"
      | "qualityCriteria"
      | "failureModes"
      | "templates"
      | "promptContextKeys"
      | "metadata"
    >
  >;

export function skill(input: SkillInput): FilmmakingSkill {
  return {
    version: "1.0.0",
    status: "active",
    sourceType: "research-derived",
    evidenceLevel: "heuristic",
    createdAt: SKILL_TIMESTAMP,
    updatedAt: SKILL_TIMESTAMP,
    principles: [],
    rules: [],
    ...input,
  };
}
