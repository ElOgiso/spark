/**
 * Barrel exports + validation helpers for Production OS specs.
 */

export * from "./productionSpec";
export * from "./sceneSpec";
export * from "./shotSpec";
export * from "./assetSpec";
export * from "./continuitySpec";
export * from "./audioSpec";
export * from "./routingSpec";
export * from "./qualitySpec";
export * from "./adapters";
export * from "./creatorProfile";

import type { ProductionSpec } from "./productionSpec";
import type { SceneSpec } from "./sceneSpec";
import type { ShotSpec } from "./shotSpec";

export interface SpecValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateShotSpec(shot: ShotSpec): SpecValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!shot.id) errors.push("shot.id required");
  if (!shot.sceneId) errors.push("shot.sceneId required");
  if (!shot.productionReason?.trim()) errors.push("shot.productionReason required — no purposeless shots");
  if (!(shot.durationSec > 0)) errors.push("shot.durationSec must be > 0");
  if (!shot.camera?.shotType) errors.push("shot.camera.shotType required");
  if (!shot.motion?.beginState || !shot.motion?.endState) {
    errors.push("shot.motion beginState and endState required");
  }
  if (!shot.subjectAction?.trim()) warnings.push("shot.subjectAction empty");
  return { ok: errors.length === 0, errors, warnings };
}

export function validateSceneSpec(scene: SceneSpec): SpecValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!scene.id) errors.push("scene.id required");
  if (!(scene.durationSec > 0)) errors.push("scene.durationSec must be > 0");
  if (!scene.shots?.length) errors.push("scene must contain at least one shot");
  if (!scene.purpose?.trim()) warnings.push("scene.purpose empty");
  for (const shot of scene.shots || []) {
    const r = validateShotSpec(shot);
    errors.push(...r.errors.map((e) => `shot[${shot.index}]: ${e}`));
    warnings.push(...r.warnings.map((w) => `shot[${shot.index}]: ${w}`));
  }
  const shotDur = (scene.shots || []).reduce((s, sh) => s + (sh.durationSec || 0), 0);
  if (shotDur > scene.durationSec * 1.25) {
    warnings.push("sum of shot durations exceeds scene duration significantly");
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function validateProductionSpec(spec: ProductionSpec): SpecValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!spec.id) errors.push("spec.id required");
  if (!spec.project?.idea?.trim() && !spec.creative?.intent?.trim()) {
    errors.push("project.idea or creative.intent required");
  }
  if (!(spec.project?.targetDurationSec > 0)) errors.push("project.targetDurationSec must be > 0");
  if (!spec.scenes?.length) errors.push("spec must contain scenes");
  for (const scene of spec.scenes || []) {
    const r = validateSceneSpec(scene);
    errors.push(...r.errors.map((e) => `scene[${scene.index}]: ${e}`));
    warnings.push(...r.warnings.map((w) => `scene[${scene.index}]: ${w}`));
  }
  if (spec.creative.estimatedShotCount > 0) {
    const actual = spec.scenes.reduce((n, s) => n + s.shots.length, 0);
    if (actual === 0) errors.push("no shots planned");
  }
  return { ok: errors.length === 0, errors, warnings };
}
