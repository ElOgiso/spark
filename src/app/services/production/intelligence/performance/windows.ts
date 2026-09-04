/**
 * Performance measurement windows — comparable lifecycle points.
 */

import type { PerformanceWindowId } from "./types";

export interface PerformanceWindowDef {
  id: PerformanceWindowId;
  label: string;
  maxAgeMs: number | null; // null = lifetime
}

export const PERFORMANCE_WINDOWS: PerformanceWindowDef[] = [
  { id: "first_hour", label: "First hour", maxAgeMs: 60 * 60 * 1000 },
  { id: "first_6_hours", label: "First 6 hours", maxAgeMs: 6 * 60 * 60 * 1000 },
  { id: "first_24_hours", label: "First 24 hours", maxAgeMs: 24 * 60 * 60 * 1000 },
  { id: "first_3_days", label: "First 3 days", maxAgeMs: 3 * 24 * 60 * 60 * 1000 },
  { id: "first_7_days", label: "First 7 days", maxAgeMs: 7 * 24 * 60 * 60 * 1000 },
  { id: "first_30_days", label: "First 30 days", maxAgeMs: 30 * 24 * 60 * 60 * 1000 },
  { id: "lifetime", label: "Lifetime", maxAgeMs: null },
];

export function windowDef(id: PerformanceWindowId): PerformanceWindowDef | undefined {
  return PERFORMANCE_WINDOWS.find((w) => w.id === id);
}

/** Infer the narrowest window that covers age since publish. */
export function inferWindowFromAge(ageMs: number): PerformanceWindowId {
  for (const w of PERFORMANCE_WINDOWS) {
    if (w.maxAgeMs != null && ageMs <= w.maxAgeMs) return w.id;
  }
  return "lifetime";
}

export function ageMs(publishedAt: string | undefined, asOf: string | Date = new Date()): number | undefined {
  if (!publishedAt) return undefined;
  const pub = Date.parse(publishedAt);
  if (!Number.isFinite(pub)) return undefined;
  const end = typeof asOf === "string" ? Date.parse(asOf) : asOf.getTime();
  if (!Number.isFinite(end)) return undefined;
  return Math.max(0, end - pub);
}

export function resolveWindow(params: {
  explicit?: PerformanceWindowId;
  publishedAt?: string;
  asOf?: string | Date;
}): PerformanceWindowId {
  if (params.explicit) return params.explicit;
  const age = ageMs(params.publishedAt, params.asOf);
  if (age == null) return "lifetime";
  return inferWindowFromAge(age);
}

/** Windows are comparable only when ids match (same lifecycle point). */
export function windowsAreComparable(a: PerformanceWindowId, b: PerformanceWindowId): boolean {
  return a === b;
}
