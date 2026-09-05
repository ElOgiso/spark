/**
 * Filmmaking skill runtime — context derivation, run, and production attachment.
 */

import type { ProductionSpec } from "../specification/productionSpec";
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

const CONTINUITY_MERGE_CAP = 6;

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
