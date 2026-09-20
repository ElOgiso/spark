/**
 * Semantic Execution Request Contract
 *
 * Establishes the provider-neutral contract boundary between GenerationTask
 * and downstream routing/provider payload compilers.
 *
 * GenerationTask → SemanticGenerationRequest → [Routing / Payload Compiler] → ProviderExecutionRequest
 */

import type { GenerationTask } from "./generationTask";
import type { ShotSpec } from "./shotSpec";
import type { ProductionSpec } from "./productionSpec";
import {
  type SemanticMediaType,
  type QualityTier,
  type ShotOutputRequirement,
  type SemanticReference,
  normalizeQualityTier,
  parseResolutionClass,
  referencePackToSemanticReferences,
} from "./semanticMedia";

/**
 * Provider-neutral semantic generation request.
 * Contains WHAT to generate and WHY, without model IDs or provider parameters.
 */
export interface SemanticGenerationRequest {
  taskId: string;
  productionId: string;
  sceneId?: string;
  shotId?: string;
  mediaType: SemanticMediaType;
  intent: {
    purpose: string;
    description: string;
    subject?: string;
    action?: string;
    context?: string;
    creativeNotes?: string;
  };
  capabilities: {
    required: string[];
    preferred?: string[];
  };
  references: SemanticReference[];
  output: ShotOutputRequirement;
  constraints?: {
    qualityTier?: QualityTier;
    maxDurationSec?: number;
    speedPriority?: boolean;
    costPriority?: boolean;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Map GenerationTask kind to SemanticMediaType.
 */
export function taskKindToSemanticMediaType(kind: GenerationTask["kind"]): SemanticMediaType {
  switch (kind) {
    case "keyframe":
      return "IMAGE";
    case "video":
    case "extend":
    case "short_cut":
      return "VIDEO";
    case "voice":
      return "VOICE";
    case "music":
      return "MUSIC";
    case "sfx":
      return "SFX";
    case "merge":
    case "edit":
      return "MOTION_GRAPHIC";
    default:
      return "VIDEO";
  }
}

/**
 * Build a provider-neutral SemanticGenerationRequest from a GenerationTask and optional ShotSpec / ProductionSpec.
 * This does NOT select a provider or model.
 */
export function buildSemanticGenerationRequest(
  task: GenerationTask,
  shot?: ShotSpec,
  spec?: ProductionSpec
): SemanticGenerationRequest {
  const mediaType = taskKindToSemanticMediaType(task.kind);

  // Collect semantic references from task or shot
  const references: SemanticReference[] = [];
  if (task.semanticReferences?.length) {
    references.push(...task.semanticReferences);
  } else if (shot?.semanticReferences?.length) {
    references.push(...shot.semanticReferences);
  } else if (shot?.references) {
    references.push(...referencePackToSemanticReferences(shot.references));
  }

  // Derive output requirements
  const qualityTier = normalizeQualityTier(task.qualityTarget || spec?.quality?.target);
  const resolutionClass = shot?.resolution ? parseResolutionClass(shot.resolution) : undefined;
  const aspectRatio = shot?.aspectRatio || spec?.project?.aspectRatio;

  const output: ShotOutputRequirement = task.outputRequirements || {
    mediaType,
    aspectRatio,
    qualityTier,
    resolutionClass,
    durationSec: shot?.durationSec,
  };

  return {
    taskId: task.id,
    productionId: task.productionId,
    sceneId: task.sceneId || shot?.sceneId,
    shotId: task.shotId || shot?.id,
    mediaType,
    intent: {
      purpose: shot?.purpose || task.kind,
      description: shot?.productionReason || task.kind,
      subject: shot?.subject,
      action: shot?.subjectAction,
      context: shot?.environment,
      creativeNotes: shot?.performanceDirection,
    },
    capabilities: {
      required: [...(task.requiredCapabilities || [])],
      preferred: task.preferredCapabilities ? [...task.preferredCapabilities] : undefined,
    },
    references,
    output,
    constraints: {
      qualityTier,
      maxDurationSec: shot?.durationSec,
      speedPriority: task.speedPriority,
      costPriority: task.costPriority,
    },
    metadata: {
      intentId: task.intentId,
      panelId: task.panelId,
      generationMode: task.generationMode,
    },
  };
}
