/**
 * Compile GenerationIntent into existing GenerationTask nodes (+ multimodal request).
 */

import type { GenerationTask } from "../specification/generationTask";
import type {
  CapabilityResolutionResult,
  GenerationCandidateRankingContract,
  GenerationIntent,
} from "./generationIntent";
import { buildMultimodalVideoGenerationRequest } from "../preproduction";
import type { MultimodalVideoGenerationRequest } from "../preproduction/types";

export interface CompiledGenerationPlan {
  intent: GenerationIntent;
  resolution: CapabilityResolutionResult;
  tasks: GenerationTask[];
  multimodalRequest?: MultimodalVideoGenerationRequest;
  blocked: boolean;
  blockReasons: string[];
}

function appearanceBrief(intent: GenerationIntent): string {
  return [
    intent.appearanceIntent.visualState,
    intent.appearanceIntent.composition,
    intent.appearanceIntent.framing,
    intent.appearanceIntent.lighting,
    intent.appearanceIntent.treatmentSummary,
  ]
    .filter(Boolean)
    .join(" | ")
    .slice(0, 500);
}

function motionBrief(intent: GenerationIntent): string {
  return [
    `subject: ${intent.motionIntent.subjectMotion}`,
    `camera: ${intent.motionIntent.cameraMotion}`,
    intent.motionIntent.environmentMotion
      ? `environment: ${intent.motionIntent.environmentMotion}`
      : "",
    `temporal: ${intent.motionIntent.temporalOrder}`,
    `speed: ${intent.motionIntent.speed}`,
  ]
    .filter(Boolean)
    .join("; ")
    .slice(0, 500);
}

export function compileGenerationIntentToTasks(params: {
  intent: GenerationIntent;
  resolution: CapabilityResolutionResult;
  includeKeyframe?: boolean;
}): CompiledGenerationPlan {
  const { intent, resolution } = params;

  if (!resolution.ok || resolution.degradation.action === "block" || !resolution.providerId) {
    return {
      intent,
      resolution,
      tasks: [],
      blocked: true,
      blockReasons: [
        ...resolution.missingHard.map((m) => m.message),
        ...resolution.degradation.reasons,
      ].filter(Boolean),
    };
  }

  const providerId = resolution.providerId;
  const candidateCount = Math.max(1, intent.candidatePolicy.recommendedCandidateCount);
  const tasks: GenerationTask[] = [];
  const includeKeyframe = params.includeKeyframe !== false;

  let keyframeId: string | undefined;
  if (includeKeyframe) {
    keyframeId = `${intent.shotId}_keyframe`;
    tasks.push({
      id: keyframeId,
      kind: "keyframe",
      productionId: intent.productionId,
      sceneId: intent.sceneId,
      shotId: intent.shotId,
      strategy: {
        modality: "text_to_image",
        conditioning: { referenceImages: true },
        notes: "storyboard/keyframe from appearance intent",
      },
      requiredCapabilities: ["text_to_image"],
      preferredCapabilities: intent.capabilityRequirements.filter((c) =>
        /character|multi_reference|reference/.test(c)
      ),
      dependsOn: [],
      status: "planned",
      maxRetries: 2,
      qualityTarget: intent.generationMode,
      intentId: intent.id,
      panelId: intent.panelId,
      referenceManifestId: intent.referenceManifest.id,
      storyboardId: intent.storyboardId,
      generationMode: intent.generationMode,
      appearanceBrief: appearanceBrief(intent),
      hardConstraintIds: intent.hardConstraints.map((c) => c.id),
      softPreferenceIds: intent.softPreferences.map((c) => c.id),
      degradationNotes: resolution.degradation.reasons,
      candidateIndex: 0,
      candidateCount: 1,
      traceJson: JSON.stringify({ ...intent.trace, stage: "keyframe", providerId }),
    });
  }

  for (let i = 0; i < candidateCount; i++) {
    const videoId =
      candidateCount === 1 ? `${intent.shotId}_video` : `${intent.shotId}_video_c${i + 1}`;
    tasks.push({
      id: videoId,
      kind: "video",
      productionId: intent.productionId,
      sceneId: intent.sceneId,
      shotId: intent.shotId,
      strategy: intent.strategy,
      requiredCapabilities: intent.capabilityRequirements,
      preferredCapabilities: intent.capabilityRequirements.filter((c) =>
        /character_consistency|motion_quality|last_frame|multi_reference/.test(c)
      ),
      selectedProvider: providerId,
      fallbackProviders: resolution.fallbackProviders,
      dependsOn: keyframeId ? [keyframeId, ...intent.dependencies] : [...intent.dependencies],
      status: "blocked",
      maxRetries: intent.candidatePolicy.riskLevel === "high" ? 3 : 2,
      qualityTarget: intent.generationMode,
      speedPriority: intent.generationMode === "previs",
      costPriority: intent.generationMode === "previs",
      intentId: intent.id,
      panelId: intent.panelId,
      referenceManifestId: intent.referenceManifest.id,
      storyboardId: intent.storyboardId,
      generationMode: intent.generationMode,
      appearanceBrief: appearanceBrief(intent),
      motionBrief: motionBrief(intent),
      hardConstraintIds: intent.hardConstraints.map((c) => c.id),
      softPreferenceIds: intent.softPreferences
        .map((c) => c.id)
        .filter((id) => !resolution.degradation.droppedSoftPreferences.includes(id)),
      degradationNotes: [
        ...resolution.degradation.reasons,
        ...resolution.degradation.droppedSoftPreferences.map((d) => `dropped_soft:${d}`),
      ],
      candidateIndex: i,
      candidateCount,
      traceJson: JSON.stringify({
        ...intent.trace,
        stage: "video",
        providerId,
        candidateIndex: i,
        matchedCapabilities: resolution.matchedCapabilities,
        degradation: resolution.degradation,
      }),
    });
  }

  const multimodalRequest = buildMultimodalVideoGenerationRequest({
    intent: intent.videoIntent,
    providerId,
  });

  return {
    intent: {
      ...intent,
      trace: {
        ...intent.trace,
        providerId,
        generationTaskIds: tasks.map((t) => t.id),
      },
    },
    resolution,
    tasks,
    multimodalRequest,
    blocked: false,
    blockReasons: [],
  };
}

export function buildHeuristicCandidateRanking(params: {
  candidateId: string;
  shotId: string;
  generationTaskId: string;
  identityFidelity?: number;
  motionQuality?: number;
  continuity?: number;
  composition?: number;
}): GenerationCandidateRankingContract {
  const identityFidelity = params.identityFidelity ?? 0.7;
  const motionQuality = params.motionQuality ?? 0.7;
  const continuity = params.continuity ?? 0.7;
  const composition = params.composition ?? 0.7;
  const scores = {
    identityFidelity,
    referenceAdherence: identityFidelity,
    composition,
    cinematicIntent: composition,
    motionQuality,
    continuity,
    temporalStability: motionQuality,
    artifactRate: 0.2,
    styleConsistency: 0.7,
    technicalValidity: 0.75,
    promptAdherence: 0.7,
  };
  const overall =
    (identityFidelity +
      motionQuality +
      continuity +
      composition +
      scores.technicalValidity +
      (1 - scores.artifactRate)) /
    6;
  return {
    candidateId: params.candidateId,
    shotId: params.shotId,
    generationTaskId: params.generationTaskId,
    scores,
    overall: Math.round(overall * 100) / 100,
    strengths: Object.entries(scores)
      .filter(([, v]) => v >= 0.75)
      .map(([k]) => k),
    weaknesses: Object.entries(scores)
      .filter(([k, v]) => (k === "artifactRate" ? v >= 0.4 : v < 0.55))
      .map(([k]) => k),
    source: "heuristic",
  };
}
