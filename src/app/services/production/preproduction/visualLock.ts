/**
 * Visual lock + versioning — changing a locked visual requires reason + impact analysis.
 */

import type {
  CharacterVisualContract,
  LocationVisualContract,
  ProductVisualContract,
  StoryboardBlueprint,
  VisualLock,
  VisualLockTarget,
  VisualTreatment,
} from "./types";

export function createVisualLock(params: {
  target: VisualLockTarget;
  subjectId: string;
  version: number;
  reason?: string;
}): VisualLock {
  return {
    id: `lock_${params.target}_${params.subjectId}_v${params.version}`,
    target: params.target,
    subjectId: params.subjectId,
    locked: true,
    version: params.version,
    reason: params.reason,
    lockedAt: new Date(0).toISOString(),
  };
}

export function unlockVisual(lock: VisualLock, reason: string): VisualLock {
  return {
    ...lock,
    locked: false,
    reason,
    impactAnalysis: [`Unlocked ${lock.target}:${lock.subjectId} — ${reason}`],
  };
}

export function analyzeVisualLockImpact(params: {
  lock: VisualLock;
  nextVersion: number;
  affectedShotIds?: string[];
  affectedPanelIds?: string[];
  dependentContracts?: string[];
}): string[] {
  const impact: string[] = [
    `Version change ${params.lock.version} → ${params.nextVersion} on ${params.lock.target}:${params.lock.subjectId}`,
  ];
  if (params.affectedShotIds?.length) {
    impact.push(`Affects shots: ${params.affectedShotIds.join(", ")}`);
  }
  if (params.affectedPanelIds?.length) {
    impact.push(`Affects panels: ${params.affectedPanelIds.join(", ")}`);
  }
  if (params.dependentContracts?.length) {
    impact.push(`Dependent contracts: ${params.dependentContracts.join(", ")}`);
  }
  if (params.lock.target === "character") {
    impact.push("Character identity / wardrobe continuity may need re-validation");
  }
  if (params.lock.target === "location") {
    impact.push("Location lighting / spatial continuity may need re-validation");
  }
  if (params.lock.target === "storyboard" || params.lock.target === "shot_composition") {
    impact.push("Storyboard is non-canonical; ShotSpec remains source of truth");
  }
  return impact;
}

/**
 * Bump a locked visual's version. Requires a non-empty reason; records impact analysis.
 */
export function changeLockedVersion(params: {
  lock: VisualLock;
  nextVersion: number;
  reason: string;
  affectedShotIds?: string[];
  affectedPanelIds?: string[];
  dependentContracts?: string[];
}): VisualLock {
  const reason = params.reason?.trim();
  if (!reason) {
    throw new Error("Changing a locked visual requires a non-empty reason");
  }
  if (!params.lock.locked) {
    throw new Error("Subject is not locked — lock before versioning with impact analysis");
  }
  if (params.nextVersion <= params.lock.version) {
    throw new Error("nextVersion must be greater than current locked version");
  }

  const impactAnalysis = analyzeVisualLockImpact({
    lock: params.lock,
    nextVersion: params.nextVersion,
    affectedShotIds: params.affectedShotIds,
    affectedPanelIds: params.affectedPanelIds,
    dependentContracts: params.dependentContracts,
  });

  return {
    ...params.lock,
    previousVersion: params.lock.version,
    version: params.nextVersion,
    reason,
    impactAnalysis,
    lockedAt: new Date(0).toISOString(),
    locked: true,
  };
}

export function lockVisualTreatment(treatment: VisualTreatment, reason?: string): {
  treatment: VisualTreatment;
  lock: VisualLock;
} {
  const lock = createVisualLock({
    target: "visual_treatment",
    subjectId: treatment.id,
    version: treatment.version,
    reason,
  });
  return {
    treatment: { ...treatment, locked: true },
    lock,
  };
}

export function lockStoryboard(blueprint: StoryboardBlueprint, reason?: string): {
  blueprint: StoryboardBlueprint;
  lock: VisualLock;
} {
  const lock = createVisualLock({
    target: "storyboard",
    subjectId: blueprint.id,
    version: blueprint.version,
    reason,
  });
  return {
    blueprint: { ...blueprint, visualLock: true, status: "locked" },
    lock,
  };
}

export function contractVersionLock(
  contract: CharacterVisualContract | LocationVisualContract | ProductVisualContract,
  target: Extract<VisualLockTarget, "character" | "location" | "product">
): VisualLock {
  return createVisualLock({
    target,
    subjectId:
      "characterId" in contract
        ? contract.characterId
        : "locationId" in contract
          ? contract.locationId
          : contract.productId,
    version: contract.version,
    reason: "Approved visual contract locked",
  });
}
