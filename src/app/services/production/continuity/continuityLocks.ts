/**
 * Continuity lock helpers — deterministic enforcement (no LLM).
 */

import type { ContinuityLock, ContinuityState } from "../specification/continuitySpec";

export function isFieldLocked(
  locks: ContinuityLock[] | undefined,
  subjectId: string,
  field?: string
): boolean {
  return (locks || []).some((l) => {
    if (!l.locked || l.subjectId !== subjectId) return false;
    if (!field) return true;
    return !l.field || l.field === "*" || l.field === field;
  });
}

export function assertUnlocked(
  locks: ContinuityLock[] | undefined,
  subjectId: string,
  field: string | undefined,
  changeKind: string
): void {
  if (changeKind === "intentional" || changeKind === "planned") return;
  if (isFieldLocked(locks, subjectId, field)) {
    throw new Error(
      `Locked continuity field cannot mutate implicitly: ${subjectId}${field ? `.${field}` : ""}`
    );
  }
}

export function lockSubject(params: {
  targetKind: ContinuityLock["targetKind"];
  subjectId: string;
  field?: string;
  version?: number;
  reason?: string;
  scope?: ContinuityLock["scope"];
}): ContinuityLock {
  return {
    id: `lock_${params.targetKind}_${params.subjectId}_${params.field || "all"}`,
    targetKind: params.targetKind,
    subjectId: params.subjectId,
    field: params.field,
    version: params.version ?? 1,
    locked: true,
    reason: params.reason,
    scope: params.scope,
  };
}

/** Merge structured locks onto a state without mutating callers. */
export function withLocks(state: ContinuityState, locks: ContinuityLock[]): ContinuityState {
  const byId = new Map((state.locks || []).map((l) => [l.id, l]));
  for (const lock of locks) byId.set(lock.id, lock);
  return { ...state, locks: Array.from(byId.values()) };
}

export function findLock(
  locks: ContinuityLock[] | undefined,
  subjectId: string,
  field?: string
): ContinuityLock | undefined {
  return (locks || []).find(
    (l) =>
      l.locked &&
      l.subjectId === subjectId &&
      (!field || !l.field || l.field === "*" || l.field === field)
  );
}
