/**
 * In-memory filmmaking skill registry.
 */

import type { FilmmakingSkill, SkillStatus } from "./types";

const skills = new Map<string, FilmmakingSkill>();

export function registerSkill(skill: FilmmakingSkill): void {
  skills.set(skill.id, skill);
}

export function registerSkills(list: FilmmakingSkill[]): void {
  for (const skill of list) {
    registerSkill(skill);
  }
}

export function getSkill(id: string): FilmmakingSkill | undefined {
  return skills.get(id);
}

export interface ListSkillsOptions {
  includeDeprecated?: boolean;
  status?: SkillStatus | SkillStatus[];
  domain?: string;
}

export function listSkills(options: ListSkillsOptions = {}): FilmmakingSkill[] {
  const { includeDeprecated = false, status, domain } = options;
  const statusSet = status
    ? new Set(Array.isArray(status) ? status : [status])
    : null;

  return Array.from(skills.values()).filter((skill) => {
    if (!includeDeprecated && (skill.status === "deprecated" || skill.status === "disabled")) {
      return false;
    }
    if (statusSet && !statusSet.has(skill.status)) {
      return false;
    }
    if (domain && skill.domain !== domain) {
      return false;
    }
    return true;
  });
}

export function clearSkillRegistry(): void {
  skills.clear();
}

export function skillRegistrySize(): number {
  return skills.size;
}
