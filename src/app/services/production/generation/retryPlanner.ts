/**
 * Retry / remediation planner for failed shots (partial regeneration only).
 */

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
  attempt: number;
  maxAttempts: number;
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

  if (failures.some((f) => /identity|character|drift|face/i.test(f))) {
    remediation = "rerender_different_model";
    providerChange = true;
    strategyChange = "multi_reference";
    modifyPromptHint = "Strengthen character lock + reference order";
  } else if (failures.some((f) => /camera|framing|composition/i.test(f))) {
    remediation = "modify_prompt";
    modifyPromptHint = "Make camera move and framing explicit; reduce conflicting motion";
  } else if (failures.some((f) => /duration|length|timing/i.test(f))) {
    remediation = "trim_clip";
  } else if (failures.some((f) => /keyframe|first.?frame/i.test(f))) {
    remediation = "regenerate_keyframe";
  } else if (failures.some((f) => /audio|lip/i.test(f))) {
    remediation = "remix_audio";
  } else if (attempt >= 2) {
    remediation = "rerender_different_model";
    providerChange = true;
  }

  if (providerChange && params.routingDecision) {
    const fb = buildFallbackPlan(params.routingDecision, failures);
    if (fb) {
      nextProvider = fb.nextProvider;
      strategyChange = strategyChange || fb.changeStrategy;
    }
  }

  return {
    shotId: params.shot.id,
    remediation,
    providerChange,
    nextProvider,
    strategyChange,
    modifyPromptHint,
    attempt,
    maxAttempts,
  };
}
