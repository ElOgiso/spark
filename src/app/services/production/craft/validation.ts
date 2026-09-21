/**
 * Canonical Craft Engine Validation
 *
 * Provides deterministic semantic validation and conflict detection for
 * CraftPlans and individual CraftOperations.
 *
 * Core Principle: SPARK OWNS MEANING. PROVIDERS OWN EXECUTION.
 *
 * Validates:
 * 1. Target compatibility (is the target type permitted for this operation?)
 * 2. Required semantic inputs (are critical parameters present?)
 * 3. Temporal consistency (timing within shot bounds)
 * 4. Mutual exclusion & temporal overlap (e.g. PUSH_IN vs PULL_BACK at the same time)
 * 5. ReferenceGraph presence (when ReferenceGraph is provided, verify required references exist)
 */

import type {
  CraftOperation,
  CraftPlan,
  CraftValidationResult,
  CraftConflict,
} from "./types";
import { CreativeOperationRegistry } from "./operationRegistry";
import type { ReferenceGraph } from "../specification/referenceGraph";

export interface CraftValidationContext {
  shotDurationSec?: number;
  referenceGraph?: ReferenceGraph;
  characterIds?: string[];
  propIds?: string[];
  locationIds?: string[];
}

/**
 * Validate an individual CraftOperation against its registry definition and context.
 */
export function validateCraftOperation(
  op: CraftOperation,
  context?: CraftValidationContext
): { errors: string[]; warnings: string[]; missingRequirements: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingRequirements: string[] = [];

  const registry = CreativeOperationRegistry.getInstance();
  const def = registry.getDefinition(op.type);

  if (!def) {
    errors.push(`Operation type '${op.type}' is not registered in CreativeOperationRegistry.`);
    return { errors, warnings, missingRequirements };
  }

  // 1. Target validation
  if (!def.acceptedTargets.includes(op.target.type)) {
    errors.push(
      `Operation '${op.type}' (id: ${op.id}) does not accept target type '${op.target.type}'. Allowed targets: ${def.acceptedTargets.join(", ")}.`
    );
  }

  // 2. Required input validation
  const params = (op.parameters || {}) as Record<string, unknown>;
  for (const inputKey of def.requiredInputs) {
    const val = params[inputKey];
    if (val === undefined || val === null || val === "") {
      missingRequirements.push(`Operation '${op.type}' (id: ${op.id}) is missing required input: '${inputKey}'.`);
      errors.push(`Operation '${op.type}' requires parameter '${inputKey}' but none was supplied.`);
    }
  }

  // 3. Timing validation
  if (op.timing) {
    if (op.timing.startSec < 0) {
      errors.push(`Operation '${op.type}' (id: ${op.id}) has invalid negative startSec: ${op.timing.startSec}.`);
    }
    if (op.timing.durationSec <= 0) {
      errors.push(`Operation '${op.type}' (id: ${op.id}) has invalid non-positive durationSec: ${op.timing.durationSec}.`);
    }
    if (context?.shotDurationSec !== undefined && context.shotDurationSec > 0) {
      const endSec = op.timing.endSec ?? op.timing.startSec + op.timing.durationSec;
      if (op.timing.startSec >= context.shotDurationSec) {
        errors.push(
          `Operation '${op.type}' (id: ${op.id}) startSec (${op.timing.startSec}) exceeds shot duration (${context.shotDurationSec}s).`
        );
      } else if (endSec > context.shotDurationSec + 0.05) {
        warnings.push(
          `Operation '${op.type}' (id: ${op.id}) endSec (${endSec.toFixed(2)}s) exceeds shot duration (${context.shotDurationSec}s); will be clamped.`
        );
      }
    }
  }

  // 4. Reference validation against ReferenceGraph (if provided)
  if (context?.referenceGraph && op.referenceNodeIds?.length) {
    const existingNodeIds = new Set(context.referenceGraph.nodes.map((n) => n.id));
    for (const refId of op.referenceNodeIds) {
      if (!existingNodeIds.has(refId)) {
        warnings.push(
          `Operation '${op.type}' references node '${refId}' which was not found in the ReferenceGraph.`
        );
      }
    }
  }

  return { errors, warnings, missingRequirements };
}

/**
 * Check whether two operations on the same target overlap temporally.
 */
function checkTemporalOverlap(
  opA: CraftOperation,
  opB: CraftOperation,
  shotDuration: number = 10
): boolean {
  const startA = opA.timing?.startSec ?? 0;
  const durA = opA.timing?.durationSec ?? shotDuration;
  const endA = opA.timing?.endSec ?? startA + durA;

  const startB = opB.timing?.startSec ?? 0;
  const durB = opB.timing?.durationSec ?? shotDuration;
  const endB = opB.timing?.endSec ?? startB + durB;

  // Overlap condition: start of one is before end of other, and vice versa
  return startA < endB && startB < endA;
}

/**
 * Validate an entire CraftPlan for internal consistency and semantic conflicts.
 */
export function validateCraftPlan(
  plan: CraftPlan,
  context?: CraftValidationContext
): CraftValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const conflicts: CraftConflict[] = [];
  const missingRequirements: string[] = [];

  const registry = CreativeOperationRegistry.getInstance();
  const ops = plan.operations || [];

  // Validate each operation individually
  for (const op of ops) {
    const res = validateCraftOperation(op, context);
    errors.push(...res.errors);
    warnings.push(...res.warnings);
    missingRequirements.push(...res.missingRequirements);
  }

  // Cross-operation conflict detection (pairwise)
  const shotDur = context?.shotDurationSec ?? 10;
  for (let i = 0; i < ops.length; i++) {
    for (let j = i + 1; j < ops.length; j++) {
      const opA = ops[i];
      const opB = ops[j];

      // Check mutual exclusivity in principle
      const mutuallyExclusive = registry.areMutuallyExclusive(opA.type, opB.type);

      if (mutuallyExclusive) {
        // Both act on the camera or same target
        const sameTarget =
          opA.target.type === opB.target.type &&
          (opA.target.id === opB.target.id || opA.target.type === "CAMERA");

        if (sameTarget && checkTemporalOverlap(opA, opB, shotDur)) {
          conflicts.push({
            code: "OPPOSING_CAMERA_MOVEMENT",
            operationIds: [opA.id, opB.id],
            description: `Contradictory operations '${opA.type}' and '${opB.type}' overlap during the same camera temporal interval.`,
            evidence: {
              opA: { id: opA.id, type: opA.type, timing: opA.timing },
              opB: { id: opB.id, type: opB.type, timing: opB.timing },
            },
          });
        }
      }
    }
  }

  const valid = errors.length === 0 && conflicts.length === 0;

  return {
    valid,
    errors,
    warnings,
    conflicts,
    missingRequirements,
  };
}
