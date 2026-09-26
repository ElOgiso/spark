/**
 * Filmmaking skill runtime — context derivation, run, and production attachment.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { SceneSpec } from "../specification/sceneSpec";
import type { ShotSpec } from "../specification/shotSpec";
import { composeSkillOutputs } from "./composer";
import { ensureFilmmakingSkillLibrary } from "./library";
import { getSkill } from "./registry";
import { resolveSkills } from "./resolver";
import type {
  ComposedSkillOutput,
  FilmmakingSkillContext,
  ShotFilmmakingGuidance,
} from "./types";
import { isVisualGenreId, resolveVisualGenre, visualGenreSkillTags } from "../../../domain/visualGenre";

const CONTINUITY_MERGE_CAP = 6;
const PRODUCT_STILL_PURPOSE = /\b(packshot|hero still|product photo|product shot|flat lay|flatlay|lifestyle image)\b/i;
const COVER_PURPOSE = /\b(cover|thumbnail|poster)\b/i;

function brandIsLocked(spec: ProductionSpec): boolean {
  if (spec.project?.brandId) return true;
  const bible = spec.styleBible;
  if (!bible) return false;
  if (bible.brandId) return true;
  return Object.values(bible.provenanceMap ?? {}).some((value) => value === "BRAND");
}

/**
 * Tags that select Spark operating skills.
 * The recorded production skill is authoritative. Shot facts only add a job
 * the shot itself is (a cover, a product still, or a media-role collision).
 */
export function sparkOperatingTags(
  spec: ProductionSpec,
  _scene: SceneSpec | undefined,
  shot: ShotSpec
): string[] {
  const tags: string[] = [];
  const skillId = spec.meta?.sparkSkill?.id;
  const purpose = `${shot.purpose ?? ""} ${shot.productionReason ?? ""}`;
  const strategy = String(shot.generationStrategy ?? "");
  const hasCharacterRef =
    (shot.characterIds?.length ?? 0) > 0 || (shot.references?.characterRefs?.length ?? 0) > 0;
  const hasFirst = Boolean(shot.references?.firstFrameUrl || shot.keyframeUrl);
  const referenceStrategy = /multi_reference|reference[-_]to[-_]video/i.test(strategy);

  if (skillId === "narrated_explainer") tags.push("narrated_explainer");
  if (skillId === "product_still" || PRODUCT_STILL_PURPOSE.test(purpose)) tags.push("product_still");
  if (skillId === "brand_lock" || brandIsLocked(spec)) tags.push("brand_lock");
  if (skillId === "cover_frame" || COVER_PURPOSE.test(purpose)) tags.push("publish_cover");
  if ((hasFirst && hasCharacterRef) || referenceStrategy) tags.push("media_roles");

  return tags;
}

export function runFilmmakingSkills(ctx: FilmmakingSkillContext): ComposedSkillOutput {
  ensureFilmmakingSkillLibrary();
  const skills = resolveSkills(ctx);
  return composeSkillOutputs(skills, ctx);
}

export function toShotFilmmakingGuidance(composed: ComposedSkillOutput): ShotFilmmakingGuidance {
  return {
    skillIds: composed.skillIds,
    skillVersions: composed.skillVersions,
    constraints: composed.constraints,
    recommendations: composed.recommendations,
    promptContext: composed.promptContext,
    qualityCriteria: composed.qualityCriteria,
    warnings: composed.warnings,
    conflicts: composed.conflicts,
  };
}

function continuityMentionsPrevious(text: string): boolean {
  return /\b(previous|handoff|continue|continuation|from prior|from previous)\b/i.test(text);
}

export function skillContextFromShot(
  spec: ProductionSpec,
  sceneId: string,
  shot: ShotSpec
): FilmmakingSkillContext {
  const scene = spec.scenes.find((s) => s.id === sceneId);
  const characterCount = shot.characterIds?.length ?? 0;
  const characterRefs = shot.references?.characterRefs ?? [];
  const locationRefs = shot.references?.locationRefs ?? [];

  const hasRecurringCharacter = characterCount > 0 || characterRefs.length > 0;
  const hasRecurringLocation = locationRefs.length > 0 || Boolean(scene?.locationId);

  const continuityJoined = (shot.continuityRequirements ?? []).join(" ");
  const dependsOnPreviousShot =
    Boolean(shot.references?.previousShotId) || continuityMentionsPrevious(continuityJoined);

  const shotType = String(shot.camera?.shotType ?? "");
  const purpose = String(shot.purpose ?? "");
  const isEstablishingShot =
    /establish/i.test(shotType) || /establish/i.test(purpose);

  const isIsolatedShot =
    isEstablishingShot && !dependsOnPreviousShot && characterCount === 0;

  const strategy = String(shot.generationStrategy ?? "");
  const hasFirstFrame = Boolean(shot.references?.firstFrameUrl || shot.keyframeUrl);
  const hasLastFrame = Boolean(shot.references?.lastFrameUrl || shot.lastFrameUrl);
  const hasPreviousVideo = Boolean(shot.references?.previousShotId);

  const requiresMotion =
    Boolean(shot.motion?.beginState || shot.motion?.endState) ||
    /video|i2v|t2v|extend|motion/i.test(strategy);

  const requiresTimeline =
    /first_last_frame/i.test(strategy) ||
    Boolean(shot.motion?.beginState && shot.motion?.endState);

  return {
    productionId: spec.id,
    sceneId,
    shotId: shot.id,
    shotPurpose: shot.purpose,
    shotType: shot.camera?.shotType,
    cameraMovement: shot.camera?.cameraMovement,
    generationStrategy: strategy,
    hasRecurringCharacter,
    hasRecurringLocation,
    characterCount,
    dependsOnPreviousShot,
    hasPreviousVideo,
    hasFirstFrame,
    hasLastFrame,
    isEstablishingShot,
    isIsolatedShot,
    requiresMotion,
    requiresTimeline,
    tags: [
      ...visualGenreSkillTags({
        visualGenre: isVisualGenreId(spec.meta?.visualGenre)
          ? spec.meta.visualGenre
          : resolveVisualGenre({
              explicit: spec.meta?.visualGenre,
              contentFormat: spec.meta?.contentFormat,
              specGenre: spec.creative?.genre,
            }),
        cinematicCraft: spec.meta?.cinematicCraft !== false,
      }),
      ...sparkOperatingTags(spec, scene, shot),
    ],
  };
}

function mergeContinuityRequirements(
  existing: string[],
  fromSkills: string[]
): string[] {
  const out = [...existing];
  const seen = new Set(existing.map((s) => s.trim().toLowerCase()));
  let added = 0;
  for (const item of fromSkills) {
    if (added >= CONTINUITY_MERGE_CAP) break;
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    added += 1;
  }
  return out;
}

export function applyFilmmakingSkillsToProduction(spec: ProductionSpec): ProductionSpec {
  ensureFilmmakingSkillLibrary();

  const scenes = spec.scenes.map((scene) => ({
    ...scene,
    shots: scene.shots.map((shot) => {
      const ctx = skillContextFromShot(spec, scene.id, shot);
      const composed = runFilmmakingSkills(ctx);
      const guidance = toShotFilmmakingGuidance(composed);

      const continuityRequirements = mergeContinuityRequirements(
        shot.continuityRequirements ?? [],
        composed.continuityRequirements
      );

      return {
        ...shot,
        continuityRequirements,
        filmmakingGuidance: guidance,
        observability: {
          ...shot.observability,
          filmmakingSkillIds: composed.skillIds,
          filmmakingSkillVersions: composed.skillVersions,
        },
      };
    }),
  }));

  return { ...spec, scenes };
}

export function getSkillVersion(id: string): string | undefined {
  ensureFilmmakingSkillLibrary();
  return getSkill(id)?.version;
}
