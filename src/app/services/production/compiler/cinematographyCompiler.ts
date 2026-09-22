/**
 * Cinematography & Craft Compiler for Provider Payload Compiler.
 *
 * Compiles:
 * - ShotCameraSpec (framing, composition, lens, cameraMovement)
 * - ShotMotionDirection (subjectMovement, cameraMovementDetail, beginState, endState)
 * - CraftPlan / CraftOperation (PUSH_IN, PULL_BACK, PRODUCT_SPIN, LIGHT_SWEEP, etc.)
 *
 * Translates structured operations into provider parameters where supported,
 * or precise structured prompt cues where parameters are unsupported,
 * emitting degradation warnings where necessary.
 */

import type { ShotSpec } from "../specification/shotSpec";
import type { CraftPlan, CraftOperation } from "../craft/types";
import type { MediaCapabilityProfile } from "../capability/types";

export interface CinematographyCompilationResult {
  cameraPromptDirectives: string[];
  operationDirectives: string[];
  structuredCameraParams?: Record<string, unknown>;
  warnings: string[];
  degradedFeatures: string[];
}

export function compileCinematographyAndCraft(params: {
  shot: ShotSpec;
  craftPlan?: CraftPlan;
  capabilityProfile: MediaCapabilityProfile;
}): CinematographyCompilationResult {
  const { shot, craftPlan, capabilityProfile } = params;
  const cameraPromptDirectives: string[] = [];
  const operationDirectives: string[] = [];
  const warnings: string[] = [];
  const degradedFeatures: string[] = [];

  const camera = shot.camera;
  const motion = shot.motion;

  // 1. Camera Specifications
  if (camera) {
    const parts: string[] = [];
    if (camera.shotType) parts.push(`Shot: ${camera.shotType}`);
    if (camera.framing) parts.push(`Framing: ${camera.framing}`);
    if (camera.composition) parts.push(`Composition: ${camera.composition}`);
    if (camera.cameraPosition) parts.push(`Position: ${camera.cameraPosition}`);
    if (camera.lens) parts.push(`Lens: ${camera.lens}`);
    if (camera.depthOfField) parts.push(`DOF: ${camera.depthOfField}`);
    if (camera.cameraMovement && camera.cameraMovement !== "none" && camera.cameraMovement !== "static") {
      parts.push(`Move: ${camera.cameraMovement}`);
    }
    if (parts.length) {
      cameraPromptDirectives.push(`CAMERA: ${parts.join("; ")}`);
    }
  }

  // 2. Motion Direction
  if (motion) {
    if (motion.subjectMovement) {
      operationDirectives.push(`SUBJECT ACTION: ${motion.subjectMovement}`);
    }
    if (motion.cameraMovementDetail) {
      operationDirectives.push(`CAMERA MOVEMENT: ${motion.cameraMovementDetail}`);
    }
    if (motion.beginState && motion.endState) {
      operationDirectives.push(`MOTION FLOW: Begin at ${motion.beginState} -> Transition to ${motion.endState}`);
    }
  }

  // 3. CraftPlan & Operations
  const operations: CraftOperation[] = craftPlan?.operations || shot.craftPlan?.operations || [];
  let structuredCameraParams: Record<string, unknown> | undefined;

  for (const op of operations) {
    switch (op.type) {
      case "PUSH_IN": {
        const p = op.parameters as any;
        const speed = p?.speed || "slow";
        operationDirectives.push(`CAMERA OPERATION: Steady ${speed} push-in focusing on ${p?.focalTarget || "subject"}`);
        break;
      }
      case "PULL_BACK": {
        const p = op.parameters as any;
        const speed = p?.speed || "slow";
        operationDirectives.push(`CAMERA OPERATION: Smooth ${speed} pull-back revealing ${p?.revealTarget || "environment"}`);
        break;
      }
      case "ORBIT": {
        const p = op.parameters as any;
        const dir = p?.direction === "clockwise" ? "clockwise" : "counter-clockwise";
        operationDirectives.push(`CAMERA OPERATION: Controlled ${dir} orbit around target`);
        break;
      }
      case "PRODUCT_SPIN": {
        const p = op.parameters as any;
        operationDirectives.push(`OBJECT MOTION: Product rotates smoothly on ${p?.axis || "vertical"} axis (${p?.rotationSpeed || "steady"})`);
        break;
      }
      case "LIGHT_SWEEP": {
        const p = op.parameters as any;
        operationDirectives.push(`LIGHTING EFFECT: Atmospheric light sweep ${p?.direction || "across scene"}`);
        break;
      }
      case "HERO_SHOT": {
        operationDirectives.push("COMPOSITION: Low-angle commanding hero presentation");
        break;
      }
      case "MACRO_DETAIL": {
        const p = op.parameters as any;
        operationDirectives.push(`OPTICAL: Macro detail focus on ${p?.focalSubject || "subject"} with shallow depth of field`);
        break;
      }
      case "MOTION_TRANSFER": {
        // Check if provider supports motion transfer / driving video
        const supportsVideoToVideo = capabilityProfile.generationModes.includes("video_to_video");
        if (!supportsVideoToVideo) {
          warnings.push(`UNSUPPORTED_CREATIVE_OPERATION: Provider ${capabilityProfile.providerId} does not support native MOTION_TRANSFER`);
          degradedFeatures.push("MOTION_TRANSFER_DEGRADED");
        }
        const p = op.parameters as any;
        operationDirectives.push(`MOTION REFERENCE: Transfer motion from driving source (${p?.drivingAction || "prescribed action"})`);
        break;
      }
      default: {
        if (op.purpose) {
          operationDirectives.push(`CRAFT OPERATION [${op.type}]: ${op.purpose}`);
        }
        break;
      }
    }
  }

  // Check camera control capability against requirements
  const hasCameraMove = camera?.cameraMovement && camera.cameraMovement !== "none" && camera.cameraMovement !== "static";
  const cameraControlLevel = capabilityProfile.camera.controlLevel;

  if (hasCameraMove && cameraControlLevel === "none") {
    warnings.push(`CAMERA_MOVEMENT_DEGRADED: Model ${capabilityProfile.modelId} has controlLevel='none'; camera movement '${camera?.cameraMovement}' may not be respected`);
    degradedFeatures.push("CAMERA_MOVEMENT_DEGRADED");
  }

  return {
    cameraPromptDirectives,
    operationDirectives,
    structuredCameraParams,
    warnings,
    degradedFeatures,
  };
}
