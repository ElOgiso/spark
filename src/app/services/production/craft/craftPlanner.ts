/**
 * Canonical Craft Planner & Cinematography Bridge
 *
 * Core Principle: SPARK OWNS MEANING. PROVIDERS OWN EXECUTION.
 *
 * Integrates with existing Cinematography Intelligence:
 * Cinematography Intelligence remains the authoritative planner for dramatic
 * purpose, camera angles, lighting moods, and coverage.
 *
 * The Craft Planner translates that cinematic intent into structured,
 * provider-neutral CraftOperations and aggregates capability requirements.
 */

import type { ShotSpec, CameraMovement, ShotType } from "../specification/shotSpec";
import type { StyleBible } from "../specification/styleBible";
import type { ReferenceGraph } from "../specification/referenceGraph";
import type {
  CraftPlan,
  CraftOperation,
  CraftOperationType,
  CraftTargetType,
  ResolvedSemanticShot,
} from "./types";
import { CreativeOperationRegistry } from "./operationRegistry";
import { productStillCraft } from "../skills/sparkSkills";

export interface DeriveCraftPlanOptions {
  /** Keep existing custom operations if shot already has a craftPlan */
  preserveExisting?: boolean;
  /** User intent when the production job is a product still. Maps onto an existing craft purpose. */
  productStillIntent?: string;
}

/**
 * Map a camera movement string to a canonical CraftOperationType.
 */
function cameraMovementToCraftType(movement?: CameraMovement): CraftOperationType | null {
  switch (movement) {
    case "push_in":
      return "PUSH_IN";
    case "pull_out":
      return "PULL_BACK";
    case "pan":
      return "PAN";
    case "tilt":
      return "TILT";
    case "dolly":
      return "DOLLY";
    case "crane":
      return "CRANE";
    case "orbit":
      return "ORBIT";
    case "tracking":
      return "TRACK";
    case "static":
    default:
      return null;
  }
}

/**
 * Map a shot type to a canonical composition operation type.
 */
function shotTypeToCompositionType(
  shotType?: ShotType,
  purpose?: string
): CraftOperationType {
  switch (shotType) {
    case "establishing":
    case "wide":
    case "aerial":
      return "WIDE_ESTABLISHING";
    case "closeup":
    case "extreme_closeup":
      return "CLOSE_UP";
    case "macro":
      return "MACRO_DETAIL";
    case "medium":
    default:
      if (purpose && /hero|product|flagship|showcase|prestige/i.test(purpose)) {
        return "HERO_SHOT";
      }
      return "CLOSE_UP";
  }
}

/**
 * Derive a canonical CraftPlan from a planned ShotSpec.
 *
 * Consumes existing cinematography data (camera movement, framing, lighting,
 * temporal beats) and generates provider-neutral CraftOperations.
 */
export function deriveCraftPlanFromShot(
  shot: ShotSpec,
  options?: DeriveCraftPlanOptions
): CraftPlan {
  const registry = CreativeOperationRegistry.getInstance();
  const operations: CraftOperation[] = [];

  // If preserving existing operations, include them first
  if (options?.preserveExisting && shot.craftPlan?.operations) {
    operations.push(...shot.craftPlan.operations);
  }

  const existingTypes = new Set(operations.map((op) => op.type));

  // 1. Derive Camera Movement Operation
  const camMovement = shot.camera?.cameraMovement;
  const camType = cameraMovementToCraftType(camMovement);

  if (camType && !existingTypes.has(camType)) {
    const caps = registry.getCapabilitiesForOperation(camType);
    let params: Record<string, unknown> = {};

    if (camType === "PUSH_IN") {
      params = { direction: "forward", distance: "moderate", speed: "normal" };
    } else if (camType === "PULL_BACK") {
      params = { direction: "backward", distance: "moderate", speed: "normal" };
    } else if (camType === "PAN") {
      params = { direction: "left", speed: "normal" };
    } else if (camType === "TILT") {
      params = { direction: "up", speed: "normal" };
    } else if (camType === "ORBIT") {
      params = { direction: "clockwise", degrees: 90, speed: "normal" };
    } else if (camType === "CRANE") {
      params = { direction: "up", heightChange: "eye_to_aerial" };
    } else if (camType === "TRACK") {
      params = { followSubject: shot.subject };
    }

    operations.push({
      id: `op_${camType.toLowerCase()}_${shot.id}`,
      type: camType,
      category: "CAMERA",
      purpose: shot.motion?.cameraMovementDetail || `Motivated ${camType} camera movement for ${shot.purpose}`,
      target: {
        type: "CAMERA",
        id: shot.subject || "primary_camera",
        label: "Main Camera",
      },
      parameters: params,
      timing: {
        startSec: 0,
        durationSec: shot.durationSec,
        endSec: shot.durationSec,
        easing: "ease_in_out",
      },
      intensity: "moderate",
      capabilityRequirements: caps,
    });
  }

  // 2. Derive Composition Operation
  const productCraft = options?.productStillIntent
    ? productStillCraft(options.productStillIntent)
    : null;
  const compType = productCraft ?? shotTypeToCompositionType(shot.camera?.shotType, shot.purpose);
  if (compType && !existingTypes.has(compType)) {
    const caps = registry.getCapabilitiesForOperation(compType);
    const definition = registry.getDefinition(compType);
    const accepted = definition?.acceptedTargets ?? [];
    const targetType: CraftTargetType =
      productCraft && accepted.includes("PRODUCT")
        ? "PRODUCT"
        : accepted.includes("SUBJECT")
          ? "SUBJECT"
          : (accepted[0] ?? "SUBJECT");

    operations.push({
      id: `op_${compType.toLowerCase()}_${shot.id}`,
      type: compType,
      category: definition?.category ?? "COMPOSITION",
      purpose: productCraft
        ? `Product still: ${productCraft} for ${shot.purpose}`
        : shot.camera?.framing || `Compositional framing for ${shot.purpose}`,
      target: {
        type: targetType,
        id: targetType === "SUBJECT" || targetType === "PRODUCT" ? shot.subject : undefined,
        label:
          targetType === "ENVIRONMENT"
            ? "Scene Environment"
            : targetType === "PRODUCT"
              ? shot.subject || "Product"
              : shot.subject,
      },
      parameters:
        compType === "MACRO_DETAIL"
          ? { focalSubject: shot.subject, magnification: "2x" }
          : {},
      capabilityRequirements: caps,
    });
    existingTypes.add(compType);
  }

  // 3. Product / Lighting Specials based on narrative function
  const purposeBlob = `${shot.purpose} ${shot.productionReason} ${shot.subjectAction}`.toLowerCase();
  if (!productCraft && purposeBlob.includes("hero") && !existingTypes.has("HERO_SHOT")) {
    operations.push({
      id: `op_hero_${shot.id}`,
      type: "HERO_SHOT",
      category: "COMPOSITION",
      purpose: "Hero framing for key narrative beat",
      target: {
        type: "SUBJECT",
        id: shot.subject,
        label: shot.subject,
      },
      parameters: { angle: "low_angle", prominence: "commanding" },
      intensity: "dramatic",
      capabilityRequirements: registry.getCapabilitiesForOperation("HERO_SHOT"),
    });
  }

  const cinematographySummary = [
    shot.camera?.shotType,
    shot.camera?.cameraMovement && shot.camera.cameraMovement !== "static"
      ? `${shot.camera.cameraMovement} movement`
      : "locked-off camera",
    shot.camera?.lens ? `${shot.camera.lens} optic` : undefined,
    shot.lighting?.atmosphere ? `${shot.lighting.atmosphere} lighting` : undefined,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    shotId: shot.id,
    operations,
    cinematographySummary,
    temporalBeats: shot.cinematic?.temporalBeats,
    constraints: shot.continuityRequirements,
  };
}

/**
 * Bind a shot together with StyleBible, ReferenceGraph, and CraftPlan
 * into a canonical ResolvedSemanticShot for downstream routing and compilation.
 */
export function resolveSemanticShot(params: {
  shot: ShotSpec;
  styleBible: StyleBible;
  referenceGraph: ReferenceGraph;
  craftPlan?: CraftPlan;
}): ResolvedSemanticShot {
  const craftPlan = params.craftPlan || params.shot.craftPlan || deriveCraftPlanFromShot(params.shot);
  const registry = CreativeOperationRegistry.getInstance();

  const craftCaps = registry.deriveCapabilitiesFromOperations(craftPlan.operations);

  // Combine task requirements with craft requirements
  const taskCaps = new Set<string>();
  if (params.shot.generationTasks) {
    for (const task of params.shot.generationTasks) {
      for (const cap of task.requiredCapabilities || []) {
        taskCaps.add(cap);
      }
    }
  }

  const mergedCapabilities = Array.from(new Set([...craftCaps, ...Array.from(taskCaps)])).sort();

  return {
    shot: {
      ...params.shot,
      craftPlan,
    },
    styleBible: params.styleBible,
    referenceGraph: params.referenceGraph,
    craftPlan,
    resolvedCapabilities: mergedCapabilities,
  };
}
