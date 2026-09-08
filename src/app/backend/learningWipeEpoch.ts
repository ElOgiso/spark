/**
 * Learning wipe epoch — cloud + local.
 * After a successful More wipe, Viral Sparks / sources / memory must stay empty
 * until the user adds a new source. Hydrate and persist honor this epoch.
 */

export const LEARNING_WIPE_LS_PREFIX = "spark_learning_wipe_";
export const LEARNING_WIPE_SESSION_PREFIX = "spark_learning_wipe_session_";
export const LEARNING_SOURCE_SINCE_WIPE_PREFIX = "spark_learning_source_since_wipe_";

export const REQUIRED_LEARNING_WIPE_TABLES = [
  "viral_sparks",
  "research_sources",
  "research_patterns",
  "memory_items",
] as const;

export const OPTIONAL_LEARNING_WIPE_TABLES = ["brand_rules"] as const;

export type LearningPersistKind = "viral_spark" | "memory" | "research_source" | "research_pattern";

export function learningWipeStorageKey(brandId: string): string {
  return `${LEARNING_WIPE_LS_PREFIX}${brandId}`;
}

export function learningWipeSessionKey(brandId: string): string {
  return `${LEARNING_WIPE_SESSION_PREFIX}${brandId}`;
}

export function learningSourceSinceWipeKey(brandId: string): string {
  return `${LEARNING_SOURCE_SINCE_WIPE_PREFIX}${brandId}`;
}

export function newerIso(a?: string | null, b?: string | null): string | null {
  const aMs = a ? Date.parse(a) : NaN;
  const bMs = b ? Date.parse(b) : NaN;
  const aOk = !Number.isNaN(aMs);
  const bOk = !Number.isNaN(bMs);
  if (aOk && bOk) return aMs >= bMs ? (a as string) : (b as string);
  if (aOk) return a as string;
  if (bOk) return b as string;
  return null;
}

export function readLearningWipeAt(brandId?: string | null): string | null {
  if (!brandId || typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(learningWipeStorageKey(brandId));
  } catch {
    return null;
  }
}

/** Persist cloud/local epoch only. Does not mark this-session wipe or clear the source-since flag. */
export function persistLearningWipeAtLocal(brandId: string, iso: string): void {
  if (!brandId || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(learningWipeStorageKey(brandId), iso);
  } catch {
    // ignore quota / private mode
  }
}

export function isSessionWipeActive(brandId?: string | null): boolean {
  if (!brandId || typeof sessionStorage === "undefined") return false;
  try {
    return Boolean(sessionStorage.getItem(learningWipeSessionKey(brandId)));
  } catch {
    return false;
  }
}

export function hasUserAddedSourceSinceWipe(brandId?: string | null): boolean {
  if (!brandId || typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(learningSourceSinceWipeKey(brandId)) === "1";
  } catch {
    return false;
  }
}

export function markUserAddedSourceSinceWipe(brandId: string): void {
  if (!brandId || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(learningSourceSinceWipeKey(brandId), "1");
  } catch {
    // ignore
  }
}

/** Call only after a successful wipe. Sets local + this-session flag and clears source-since. */
export function rememberSuccessfulLearningWipe(brandId: string, iso: string): void {
  persistLearningWipeAtLocal(brandId, iso);
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(learningWipeSessionKey(brandId), iso);
    sessionStorage.removeItem(learningSourceSinceWipeKey(brandId));
  } catch {
    // ignore
  }
}

export function resolveLearningWipeAt(
  brandId?: string | null,
  brandSettings?: Record<string, any> | null
): string | null {
  const cloud =
    (typeof brandSettings?.learning_wipe_at === "string" && brandSettings.learning_wipe_at) ||
    (typeof brandSettings?.learningWipeAt === "string" && brandSettings.learningWipeAt) ||
    null;
  return newerIso(cloud, readLearningWipeAt(brandId));
}

export function learningRowCreatedAt(row: Record<string, any> | null | undefined): string | null {
  if (!row || typeof row !== "object") return null;
  const candidates = [row.createdAt, row.created_at, row.firstSeenAt, row.first_seen_at];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }
  return null;
}

/** Missing created_at is treated as pre-wipe (fail closed) when an epoch exists. */
export function isLearningRowBeforeWipe(rowCreatedAt: string | null | undefined, wipeAt: string | null): boolean {
  if (!wipeAt) return false;
  const wipeMs = Date.parse(wipeAt);
  if (Number.isNaN(wipeMs)) return false;
  if (!rowCreatedAt) return true;
  const rowMs = Date.parse(rowCreatedAt);
  if (Number.isNaN(rowMs)) return true;
  return rowMs < wipeMs;
}

export function requiredWipeDeleteError(
  results: Record<string, { error?: { message?: string } | null | undefined } | undefined>
): string | null {
  const parts: string[] = [];
  for (const table of REQUIRED_LEARNING_WIPE_TABLES) {
    if (!(table in results) || results[table] == null) {
      parts.push(`${table}: delete did not run`);
      continue;
    }
    const err = results[table]?.error;
    if (err) {
      parts.push(`${table}: ${err.message || "delete failed"}`);
    }
  }
  return parts.length ? parts.join("; ") : null;
}

export function shouldNoOpLearningPersist(opts: {
  brandId: string;
  kind: LearningPersistKind;
  rowCreatedAt?: string | null;
  brandSettings?: Record<string, any> | null;
}): boolean {
  if (!opts.brandId) return false;
  const wipeAt = resolveLearningWipeAt(opts.brandId, opts.brandSettings);
  const sessionActive = isSessionWipeActive(opts.brandId);
  const addedSource = hasUserAddedSourceSinceWipe(opts.brandId);

  if (sessionActive && !addedSource) {
    if (opts.kind === "research_source" && !isLearningRowBeforeWipe(opts.rowCreatedAt, wipeAt)) {
      return false;
    }
    return true;
  }

  return Boolean(wipeAt && isLearningRowBeforeWipe(opts.rowCreatedAt, wipeAt));
}

export function applyLearningWipeToArrays<
  S extends Record<string, any>,
  R extends Record<string, any>,
  P extends Record<string, any>,
  M extends Record<string, any>,
>(opts: {
  brandId: string;
  brandSettings?: Record<string, any> | null;
  viralSparks?: S[] | null;
  researchSources?: R[] | null;
  researchPatterns?: P[] | null;
  memoryItems?: M[] | null;
}): {
  viralSparks: S[];
  researchSources: R[];
  researchPatterns: P[];
  memoryItems: M[];
} {
  const wipeAt = resolveLearningWipeAt(opts.brandId, opts.brandSettings);
  if (isSessionWipeActive(opts.brandId) && !hasUserAddedSourceSinceWipe(opts.brandId)) {
    return { viralSparks: [], researchSources: [], researchPatterns: [], memoryItems: [] };
  }
  const keep = <T extends Record<string, any>>(row: T) =>
    !isLearningRowBeforeWipe(learningRowCreatedAt(row), wipeAt);
  return {
    viralSparks: (opts.viralSparks || []).filter(keep),
    researchSources: (opts.researchSources || []).filter(keep),
    researchPatterns: (opts.researchPatterns || []).filter(keep),
    memoryItems: (opts.memoryItems || []).filter(keep),
  };
}

export function shouldSkipBackgroundResearchSync(opts: {
  brandId?: string | null;
  brandSettings?: Record<string, any> | null;
  researchSources?: any[] | null;
}): boolean {
  const sources = opts.researchSources || [];
  if (sources.length === 0) return true;
  const brandId = opts.brandId || "";
  if (brandId && isSessionWipeActive(brandId) && !hasUserAddedSourceSinceWipe(brandId)) return true;
  const wipeAt = resolveLearningWipeAt(brandId, opts.brandSettings);
  const live = sources.filter((s) => !isLearningRowBeforeWipe(learningRowCreatedAt(s), wipeAt));
  return live.length === 0;
}
