/**
 * Resolve applicable filmmaking skills for a generation context.
 */

import { listSkills } from "./registry";
import type { FilmmakingSkill, FilmmakingSkillContext } from "./types";

const ALWAYS_TAGS = [
  "shot_planning",
  "cinematic_coverage",
  "quality_gate",
  "prompt_compilation",
  "failure_awareness",
] as const;

const MOTIVATED_CAMERA = /track|dolly|push|pull|orbit|crane|handheld/i;

export function deriveContextTags(ctx: FilmmakingSkillContext): string[] {
  const tags = new Set<string>(ALWAYS_TAGS);

  if (ctx.tags?.length) {
    for (const t of ctx.tags) tags.add(t);
  }

  if (ctx.hasRecurringCharacter) tags.add("recurring_character");
  if (ctx.hasRecurringLocation) tags.add("recurring_location");
  if ((ctx.characterCount ?? 0) > 0) tags.add("has_character");
  if (ctx.dependsOnPreviousShot) tags.add("dependent_shot");
  if (ctx.hasPreviousVideo) {
    tags.add("previous_video");
    tags.add("video_continuation");
  }
  if (ctx.hasFirstFrame) tags.add("has_first_frame");
  if (ctx.hasLastFrame) tags.add("has_last_frame");
  if (ctx.isEstablishingShot) tags.add("establishing_shot");
  if (ctx.isIsolatedShot) tags.add("isolated_shot");
  if (ctx.requiresMotion) tags.add("requires_motion");
  if (ctx.requiresTimeline) {
    tags.add("requires_timeline");
    tags.add("start_end_frame");
  }

  const strategy = (ctx.generationStrategy ?? "").toLowerCase();
  if (strategy.includes("image_to_video")) {
    tags.add("i2v");
    tags.add("requires_motion");
  }
  if (strategy.includes("first_last_frame")) {
    tags.add("start_end_frame");
    tags.add("requires_timeline");
  }
  if (strategy.includes("text_to_video")) {
    tags.add("t2v");
    tags.add("requires_motion");
  }
  if (strategy.includes("extend")) {
    tags.add("video_continuation");
  }
  if (strategy.includes("multi_reference")) {
    tags.add("multi_reference");
  }

  const move = (ctx.cameraMovement ?? "").toLowerCase().trim();
  if (move && move !== "static" && move !== "none") {
    tags.add("camera_move");
    if (MOTIVATED_CAMERA.test(move)) {
      tags.add("motivated_camera_move");
    }
  }

  return Array.from(tags);
}

function matchesApplicability(skill: FilmmakingSkill, tags: Set<string>): boolean {
  const { whenAny, whenAll, whenNone } = skill.applicability;

  if (whenNone?.length && whenNone.some((t) => tags.has(t))) {
    return false;
  }
  if (whenAll?.length && !whenAll.every((t) => tags.has(t))) {
    return false;
  }
  if (whenAny?.length && !whenAny.some((t) => tags.has(t))) {
    return false;
  }
  return true;
}

export function resolveSkills(ctx: FilmmakingSkillContext): FilmmakingSkill[] {
  const tags = new Set(deriveContextTags(ctx));
  const candidates = listSkills({ status: ["active", "experimental"] });
  return candidates.filter((skill) => matchesApplicability(skill, tags));
}

export function resolveSkillIds(ctx: FilmmakingSkillContext): string[] {
  return resolveSkills(ctx).map((s) => s.id);
}
