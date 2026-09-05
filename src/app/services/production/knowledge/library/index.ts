/**
 * Filmmaking skill library bootstrap.
 */

import { clearSkillRegistry, registerSkills, skillRegistrySize } from "../registry";
import { FILMMAKING_SKILL_CATALOG, FILMMAKING_SKILL_IDS } from "./catalog";

export { FILMMAKING_SKILL_CATALOG, FILMMAKING_SKILL_IDS };

let loaded = false;

export function ensureFilmmakingSkillLibrary(): void {
  if (loaded && skillRegistrySize() > 0) return;
  registerSkills(FILMMAKING_SKILL_CATALOG);
  loaded = true;
}

export function resetFilmmakingSkillLibraryForTests(): void {
  loaded = false;
  clearSkillRegistry();
}
