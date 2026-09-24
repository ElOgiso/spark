/**
 * Planning Guidance Mapper — Derives semantic visual planning inputs and suggested Craft operations.
 *
 * CRITICAL RULE:
 * Observation does NOT automatically equal execution.
 * Observed video understanding evidence informs ShotSpec planning and suggests Craft operations,
 * but NEVER directly invokes providers or creates provider generation requests.
 */

import type { CraftOperation, CraftOperationType } from "../craft/types";
import type { ShotSpec } from "../specification/shotSpec";
import type { StructuredVideoUnderstanding, VideoUnderstandingSegment } from "./types";

export interface VideoPlanningGuidance {
  sourceUnderstandingId: string;
  suggestedShotType?: string;
  suggestedCameraMovement?: string;
  suggestedFraming?: string;
  suggestedLightingMood?: string;
  suggestedVisualStyle?: string;
  motionCadence?: string;
  observedActions: string[];
  observedSubjects: string[];
  suggestedCraftOperations: CraftOperation[];
  startEndBoundary?: {
    startState?: string;
    endState?: string;
  };
}

/**
 * Maps camera motion strings into canonical CraftOperationType where justified.
 */
function cameraMovementToCraftOp(movement?: string): CraftOperationType | null {
  if (!movement) return null;
  const clean = movement.toLowerCase().replace(/\s+/g, "_");
  if (clean.includes("push_in") || clean.includes("dolly_in")) return "PUSH_IN";
  if (clean.includes("pull_back") || clean.includes("dolly_out")) return "PULL_BACK";
  if (clean.includes("pan")) return "PAN";
  if (clean.includes("tilt")) return "TILT";
  if (clean.includes("track")) return "TRACK";
  if (clean.includes("orbit")) return "ORBIT";
  if (clean.includes("crane")) return "CRANE";
  if (clean.includes("zoom")) return "ZOOM";
  return null;
}

/**
 * Extracts semantic planning guidance and justified craft suggestions from a video understanding result.
 */
export function extractPlanningGuidanceFromVideo(
  understanding: StructuredVideoUnderstanding,
  targetShotId: string = "shot_target"
): VideoPlanningGuidance {
  const firstSeg = understanding.segments[0];
  const lastSeg = understanding.segments[understanding.segments.length - 1];

  const cameraState = firstSeg?.camera || understanding.summary.cameraSummary;
  const motionState = firstSeg?.motion || understanding.summary.motionSummary;
  const lightingState = firstSeg?.lighting || understanding.summary.lightingSummary;
  const styleState = firstSeg?.style || understanding.summary.visualStyle;

  const observedActions: string[] = [];
  for (const s of understanding.segments) {
    for (const a of s.actions) {
      observedActions.push(a.description);
    }
  }

  // Derive suggested Craft operations ONLY when evidence supports them
  const suggestedCraftOperations: CraftOperation[] = [];
  const opType = cameraMovementToCraftOp(cameraState?.cameraMovement);

  if (opType) {
    suggestedCraftOperations.push({
      id: `craft_${opType.toLowerCase()}_${understanding.id}`,
      type: opType,
      category: "CAMERA",
      purpose: `Replicate camera motion observed in reference: ${cameraState?.cameraMovement}`,
      target: { type: "CAMERA" },
      parameters: { movement: cameraState?.cameraMovement },
      intensity: "moderate",
      capabilityRequirements: ["camera_motion"],
      metadata: {
        evidenceConfidence: cameraState?.confidence ?? 0.8,
        source: understanding.source.url,
      },
    });
  }

  return {
    sourceUnderstandingId: understanding.id,
    suggestedShotType: cameraState?.shotType,
    suggestedCameraMovement: cameraState?.cameraMovement,
    suggestedFraming: cameraState?.framing,
    suggestedLightingMood: lightingState?.mood,
    suggestedVisualStyle: styleState?.visualStyle,
    motionCadence: motionState?.overallPacing,
    observedActions,
    observedSubjects: (understanding.summary.subjects || []).map((s) => s.label),
    suggestedCraftOperations,
    startEndBoundary: {
      startState: firstSeg?.startState?.visualState,
      endState: lastSeg?.endState?.visualState,
    },
  };
}

/**
 * Applies planning guidance to an existing ShotSpec without calling any generation providers.
 */
export function applyPlanningGuidanceToShot(
  shot: ShotSpec,
  guidance: VideoPlanningGuidance
): ShotSpec {
  return {
    ...shot,
    camera: {
      ...shot.camera,
      shotType: (guidance.suggestedShotType as any) || shot.camera?.shotType || "medium",
      cameraMovement: (guidance.suggestedCameraMovement as any) || shot.camera?.cameraMovement || "static",
      framing: (guidance.suggestedFraming as any) || shot.camera?.framing || "centered",
    },
    metadata: {
      ...(shot.metadata as any),
      referenceGuidance: {
        sourceUnderstandingId: guidance.sourceUnderstandingId,
        lightingMood: guidance.suggestedLightingMood,
        visualStyle: guidance.suggestedVisualStyle,
      },
    },
  };
}
