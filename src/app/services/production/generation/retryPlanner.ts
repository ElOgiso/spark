/**
 * Retry / partial regeneration planner.
 * Regenerates only affected shots/tasks — preserves unrelated successes.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { ShotSpec } from "../specification/shotSpec";
import type { QcRemediation } from "../specification/qualitySpec";
import type { ShotRoutingDecision } from "../specification/routingSpec";
import { buildFallbackPlan } from "../routing/fallbackPlanner";

export interface RetryPlan {
  shotId: string;
  remediation: QcRemediation;
  providerChange: boolean;
  nextProvider?: string;
  strategyChange?: string;
  modifyPromptHint?: string;
  changedInputs?: string[];
  attempt: number;
  maxAttempts: number;
  failure?: string;
  preserve?: string[];
}

export interface PartialRegenerationPlan {
  scope: "shot" | "scene" | "production" | "task";
  targetId: string;
  failure?: string;
  action: "regenerate";
  regenerateTaskIds: string[];
  regenerateShotIds: string[];
  preserveShotIds: string[];
  preserveTaskIds: string[];
  providerChange: boolean;
  changedInputs: string[];
  nextProvider?: string;
  strategyChange?: string;
}

export function planShotRetry(params: {
  shot: ShotSpec;
  failures: string[];
  routingDecision?: ShotRoutingDecision;
  maxAttempts?: number;
}): RetryPlan {
  const attempt = (params.shot.retry?.attempt || 0) + 1;
  const maxAttempts = params.maxAttempts ?? params.shot.retry?.maxAttempts ?? 2;
  const failures = params.failures || [];

  let remediation: QcRemediation = "rerender_same_model";
  let providerChange = false;
  let nextProvider: string | undefined;
  let strategyChange: string | undefined;
  let modifyPromptHint: string | undefined;
  let changedInputs: string[] | undefined;

  if (failures.some((f) => /identity|character|drift|face/i.test(f))) {
    remediation = "rerender_different_model";
    providerChange = true;
    strategyChange = "multi_reference";
    modifyPromptHint = "Strengthen character lock + reference order";
    changedInputs = ["referenceStrength", "characterRefs"];
  } else if (failures.some((f) => /camera|framing|composition/i.test(f))) {
    remediation = "modify_prompt";
    modifyPromptHint = "Make camera move and framing explicit; reduce conflicting motion";
    changedInputs = ["compiledPrompt", "camera"];
  } else if (failures.some((f) => /duration|length|timing/i.test(f))) {
    remediation = "trim_clip";
    changedInputs = ["durationSec"];
  } else if (failures.some((f) => /keyframe|first.?frame/i.test(f))) {
    remediation = "regenerate_keyframe";
    changedInputs = ["keyframe"];
  } else if (failures.some((f) => /audio|lip/i.test(f))) {
    remediation = "remix_audio";
    changedInputs = ["audio"];
  } else if (attempt >= 2) {
    remediation = "rerender_different_model";
    providerChange = true;
  }

  if (providerChange && params.routingDecision) {
    const fb = buildFallbackPlan(params.routingDecision, failures);
    if (fb) {
      nextProvider = fb.nextProvider;
      strategyChange = strategyChange || fb.changeStrategy;
      changedInputs = changedInputs || fb.changedInputs;
    }
  }

  return {
    shotId: params.shot.id,
    remediation,
    providerChange,
    nextProvider,
    strategyChange,
    modifyPromptHint,
    changedInputs,
    attempt,
    maxAttempts,
    failure: failures[0],
    preserve: [],
  };
}

/**
 * Plan partial regeneration for a shot, scene, task, or full production.
 * Unrelated successful assets are listed in preserve* arrays.
 */
export function planPartialRegeneration(params: {
  spec: ProductionSpec;
  scope: "shot" | "scene" | "production" | "task";
  targetId: string;
  failure?: string;
}): PartialRegenerationPlan {
  const { spec, scope, targetId, failure } = params;
  const allShots = spec.scenes.flatMap((s) => s.shots);
  const allTasks = allShots.flatMap((s) => s.generationTasks || []);

  let regenerateShotIds: string[] = [];

  if (scope === "production") {
    regenerateShotIds = allShots.map((s) => s.id);
  } else if (scope === "scene") {
    const scene = spec.scenes.find((s) => s.id === targetId);
    regenerateShotIds = (scene?.shots || []).map((s) => s.id);
  } else if (scope === "shot") {
    regenerateShotIds = [targetId];
    // Include dependent continuity chain shots after this one in the same scene
    const shot = allShots.find((s) => s.id === targetId);
    if (shot && spec.continuity.lastFrameChainEnabled) {
      const scene = spec.scenes.find((s) => s.id === shot.sceneId);
      const idx = scene?.shots.findIndex((s) => s.id === targetId) ?? -1;
      if (scene && idx >= 0) {
        regenerateShotIds = scene.shots.slice(idx).map((s) => s.id);
      }
    }
  } else {
    // task — find owning shot
    const task = allTasks.find((t) => t.id === targetId);
    regenerateShotIds = task?.shotId ? [task.shotId] : [];
  }

  const regenerateSet = new Set(regenerateShotIds);
  const preserveShotIds = allShots.map((s) => s.id).filter((id) => !regenerateSet.has(id));

  const regenerateTaskIds = allTasks
    .filter((t) => (t.shotId ? regenerateSet.has(t.shotId) : scope === "production"))
    .map((t) => t.id);

  // Always include merge when regenerating anything that feeds it
  const merge = allTasks.find((t) => t.kind === "merge");
  if (merge && regenerateTaskIds.length && !regenerateTaskIds.includes(merge.id)) {
    regenerateTaskIds.push(merge.id);
  }

  const preserveTaskIds = allTasks.map((t) => t.id).filter((id) => !regenerateTaskIds.includes(id));

  const identity = /identity|drift|character/i.test(failure || "");
  const decision = spec.routing.shotDecisions.find((d) => regenerateShotIds.includes(d.shotId));
  const fb = decision ? buildFallbackPlan(decision, failure ? [failure] : []) : null;

  return {
    scope,
    targetId,
    failure,
    action: "regenerate",
    regenerateTaskIds,
    regenerateShotIds,
    preserveShotIds,
    preserveTaskIds,
    providerChange: Boolean(identity && fb?.nextProvider),
    changedInputs: identity ? ["referenceStrength"] : failure ? ["compiledPrompt"] : [],
    nextProvider: fb?.nextProvider,
    strategyChange: fb?.changeStrategy,
  };
}
