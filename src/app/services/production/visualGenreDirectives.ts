/**
 * Live compiler injection for visual genre — reads filmmaking skill templates.
 * Not a second prompt engine: skills own the look vocabulary; this formats them.
 */

import {
  isVisualGenreId,
  resolveVisualGenre,
  visualGenreOption,
  visualGenreSkillTags,
  type VisualGenreId,
} from "../../domain/visualGenre";
import { ensureFilmmakingSkillLibrary } from "./knowledge/library";
import { getSkill } from "./knowledge/registry";
import type { ContentFormat } from "../../domain/types";

export function resolveLiveVisualGenre(params: {
  formatSettings?: { visualGenre?: string | null; contentFormat?: string | null } | null;
  contentFormat?: ContentFormat | string | null;
  production?: any;
  brief?: any;
  ideaText?: string | null;
  specGenre?: string | null;
}): VisualGenreId {
  const fromSnap =
    params.production?.reasoning?.settingsSnapshot?.formatSettings?.visualGenre ||
    params.production?.settingsSnapshot?.formatSettings?.visualGenre ||
    params.production?.reasoning?.productionSpec?.meta?.visualGenre;
  const explicit =
    params.formatSettings?.visualGenre ||
    fromSnap ||
    params.brief?.formatSettings?.visualGenre;
  return resolveVisualGenre({
    explicit,
    contentFormat:
      params.contentFormat ||
      params.formatSettings?.contentFormat ||
      params.brief?.formatSettings?.contentFormat,
    ideaText: params.ideaText || params.brief?.title || params.brief?.scriptOutline,
    specGenre:
      params.specGenre ||
      params.production?.reasoning?.productionSpec?.creative?.genre,
    visualDirection: params.brief?.visualDirection,
  });
}

export function cinematicCraftEnabled(formatSettings?: { cinematicCraft?: boolean } | null): boolean {
  return formatSettings?.cinematicCraft !== false;
}

/** Look laws from the genre director skill (+ optional cinematic craft overlay). */
export function visualGenreDirective(params: {
  visualGenre: VisualGenreId;
  cinematicCraft?: boolean;
}): string {
  ensureFilmmakingSkillLibrary();
  const option = visualGenreOption(params.visualGenre);
  const genreSkill = getSkill(option.skillId);
  const look =
    (genreSkill?.templates?.look_law && String(genreSkill.templates.look_law)) ||
    `VISUAL GENRE: ${option.label}. ${option.desc}`;

  const craftOn = params.cinematicCraft !== false;
  const craftSkill = craftOn ? getSkill("cinematic-craft-overlay") : undefined;
  const craft =
    craftOn && craftSkill?.templates?.look_law
      ? String(craftSkill.templates.look_law)
      : craftOn
        ? "CINEMATIC CRAFT: motivated camera and coverage without changing medium."
        : "";

  return [look, craft].filter(Boolean).join("\n");
}

export function directorStillLookLaws(params: {
  physicalAction: string;
  cameraDirection: string;
  visualGenre?: VisualGenreId;
  cinematicCraft?: boolean;
}): string {
  const genreBlock =
    params.visualGenre && isVisualGenreId(params.visualGenre)
      ? visualGenreDirective({
          visualGenre: params.visualGenre,
          cinematicCraft: params.cinematicCraft,
        })
      : "";
  return [
    "DIRECTOR STILL LOCK (look authority — ignore planner valueJob / WHY as the picture):",
    `PHYSICAL ACTION / BLOCKING: ${params.physicalAction}`,
    `CAMERA: ${params.cameraDirection}`,
    "Depict this frozen beat only. Do not invent a new character, wardrobe, props, or set.",
    "Do not render spoken lines, captions, or value-brief slogans on the image.",
    genreBlock,
  ]
    .filter(Boolean)
    .join("\n");
}

export function liveVisualGenreSkillTags(params: {
  visualGenre: VisualGenreId;
  cinematicCraft?: boolean;
}): string[] {
  return visualGenreSkillTags(params);
}
