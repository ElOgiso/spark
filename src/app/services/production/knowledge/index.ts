/**
 * Filmmaking Knowledge & Skill Runtime — public API.
 */

export type {
  SkillDomain,
  SkillStage,
  KnowledgeClassification,
  EvidenceLevel,
  SkillStatus,
  KnowledgeScope,
  SkillSourceType,
  KnowledgePriorityLayer,
  SkillApplicability,
  SkillPrinciple,
  SkillRule,
  SkillProcedureStep,
  SkillQualityCriterion,
  SkillFailureMode,
  FilmmakingSkill,
  FilmmakingSkillContext,
  SkillConflict,
  SkillApplicationOutput,
  ComposedSkillOutput,
  ShotFilmmakingGuidance,
} from "./types";

export { KNOWLEDGE_PRIORITY_ORDER } from "./types";

export {
  registerSkill,
  registerSkills,
  getSkill,
  listSkills,
  clearSkillRegistry,
  skillRegistrySize,
} from "./registry";
export type { ListSkillsOptions } from "./registry";

export { resolveSkills, resolveSkillIds, deriveContextTags } from "./resolver";

export { applySkill, composeSkillOutputs } from "./composer";

export {
  runFilmmakingSkills,
  toShotFilmmakingGuidance,
  skillContextFromShot,
  applyFilmmakingSkillsToProduction,
  getSkillVersion,
} from "./runtime";

export {
  ensureFilmmakingSkillLibrary,
  resetFilmmakingSkillLibraryForTests,
  FILMMAKING_SKILL_CATALOG,
  FILMMAKING_SKILL_IDS,
} from "./library";
