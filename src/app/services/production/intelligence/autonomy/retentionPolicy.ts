/**
 * Phase 11 — Retention Observation & Script Open-Loop Policy.
 *
 * Implements observe -> analyze -> learn -> decay -> quarantine:
 * - Observes real audience retention/view duration signals without faking curves.
 * - Enforces strict sample size gate (>= 3 observations) before changing interval.
 * - Applies Phase 11 half-life decay (90 days) on historical observations.
 * - Quarantines contradictory noise and extreme outliers.
 * - Produces a learned RetentionPolicy for script open-loop pacing hints.
 * - Writes a deduplicated MemoryItem under "Winning hooks" or "Audience preferences".
 * - Never leaks into I2V or asset generation.
 */

import type { MemoryItem, Brand } from "../../../../domain/types";
import { computeFingerprint } from "../../../research/researchDepartmentService";

export const MIN_RETENTION_SAMPLE_SIZE = 3;
export const DEFAULT_OPEN_LOOP_INTERVAL_SEC = 60;
export const MIN_OPEN_LOOP_INTERVAL_SEC = 20;
export const MAX_OPEN_LOOP_INTERVAL_SEC = 60;
export const RETENTION_DECAY_HALF_LIFE_DAYS = 90;

export interface RetentionObservation {
  brandId: string;
  productionId?: string;
  platform: string;
  sourceUrl?: string;
  avgViewDurationSec?: number;
  durationSec?: number;
  dropOffSec?: number[];
  hookHeld?: boolean;
  capturedAt: string;
  contentSource?: "youtube_analytics" | "spark_manual" | "unavailable";
}

export interface RetentionPolicy {
  targetOpenLoopIntervalSec: number;
  preferHookOnPayoff: true;
  notes: string[];
  sampleSize: number;
  updatedAt: string;
}

export interface LearnRetentionPolicyResult {
  policy: RetentionPolicy;
  memoryItem?: MemoryItem;
  updatedMemories: MemoryItem[];
}

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  targetOpenLoopIntervalSec: DEFAULT_OPEN_LOOP_INTERVAL_SEC,
  preferHookOnPayoff: true,
  notes: ["Default baseline pacing; pending live observation data."],
  sampleSize: 0,
  updatedAt: new Date().toISOString(),
};

/**
 * Filter out invalid, noisy, or extreme outlier observations.
 */
export function quarantineNoiseAndOutliers(
  observations: RetentionObservation[]
): { valid: RetentionObservation[]; quarantined: RetentionObservation[] } {
  const valid: RetentionObservation[] = [];
  const quarantined: RetentionObservation[] = [];

  for (const obs of observations) {
    // Exclude unavailable data or missing metrics
    if (obs.contentSource === "unavailable" || typeof obs.avgViewDurationSec !== "number" || isNaN(obs.avgViewDurationSec)) {
      quarantined.push(obs);
      continue;
    }

    // Must be positive view duration
    if (obs.avgViewDurationSec <= 0) {
      quarantined.push(obs);
      continue;
    }

    // Extreme outlier check: view duration > 2 hours (7200s)
    if (obs.avgViewDurationSec > 7200) {
      quarantined.push(obs);
      continue;
    }

    // Contradictory check: avg view duration cannot exceed total duration by > 5x
    if (obs.durationSec && obs.durationSec > 0 && obs.avgViewDurationSec > obs.durationSec * 5) {
      quarantined.push(obs);
      continue;
    }

    valid.push(obs);
  }

  return { valid, quarantined };
}

/**
 * Calculates decay weight using Phase 11 standard exponential half-life.
 */
export function calculateObservationWeight(
  capturedAt: string,
  now: Date = new Date(),
  halfLifeDays: number = RETENTION_DECAY_HALF_LIFE_DAYS
): number {
  const parsed = Date.parse(capturedAt);
  if (isNaN(parsed)) return 1.0;
  const ageDays = Math.max(0, (now.getTime() - parsed) / (24 * 60 * 60 * 1000));
  return Math.pow(0.5, ageDays / halfLifeDays);
}

/**
 * Phase 11 retention policy learner.
 * Analyzes observation records, applies sample size gating and decay,
 * and yields updated RetentionPolicy + deduplicated MemoryItem.
 */
export function learnRetentionPolicy(
  observations: RetentionObservation[],
  brand?: Brand,
  existingMemories: MemoryItem[] = []
): LearnRetentionPolicyResult {
  const now = new Date();
  const brandId = brand?.id || "";

  // Filter observations for this brand if brandId exists
  const relevant = brandId
    ? observations.filter((o) => !o.brandId || o.brandId === brandId)
    : observations;

  const { valid, quarantined } = quarantineNoiseAndOutliers(relevant);
  const sampleSize = valid.length;

  const existingPolicy: RetentionPolicy | undefined = brand?.settings?.retentionPolicy;
  const baseInterval = existingPolicy?.targetOpenLoopIntervalSec || DEFAULT_OPEN_LOOP_INTERVAL_SEC;

  // SAMPLE SIZE GATE: strictly require >= 3 valid observations with avgViewDurationSec
  if (sampleSize < MIN_RETENTION_SAMPLE_SIZE) {
    const policy: RetentionPolicy = {
      targetOpenLoopIntervalSec: baseInterval,
      preferHookOnPayoff: true,
      notes: [
        `Sample size (${sampleSize}) below minimum threshold (${MIN_RETENTION_SAMPLE_SIZE}); maintaining baseline ${baseInterval}s interval.`,
        quarantined.length > 0 ? `Quarantined ${quarantined.length} noisy/unavailable observation(s).` : "",
      ].filter(Boolean),
      sampleSize,
      updatedAt: now.toISOString(),
    };

    return {
      policy,
      updatedMemories: [...existingMemories],
    };
  }

  // Calculate weighted average view duration using Phase 11 decay
  let totalWeightedDuration = 0;
  let totalWeight = 0;

  for (const obs of valid) {
    const weight = calculateObservationWeight(obs.capturedAt, now);
    totalWeightedDuration += (obs.avgViewDurationSec as number) * weight;
    totalWeight += weight;
  }

  const weightedAvgSec = totalWeight > 0 ? totalWeightedDuration / totalWeight : baseInterval;

  // Pacing rule:
  // If avgViewDuration is short, viewer drop-off happens early.
  // We plant open loops before viewer interest decays (approx 75% of weighted average duration).
  // Clamped between MIN_OPEN_LOOP_INTERVAL_SEC (20s) and MAX_OPEN_LOOP_INTERVAL_SEC (60s).
  const targetInterval = Math.round(
    Math.max(MIN_OPEN_LOOP_INTERVAL_SEC, Math.min(MAX_OPEN_LOOP_INTERVAL_SEC, weightedAvgSec * 0.75))
  );

  const earliestPlant = Math.min(20, Math.max(10, Math.round(targetInterval * 0.4)));

  const notes = [
    `Weighted average view duration: ~${Math.round(weightedAvgSec)}s across ${sampleSize} observation(s).`,
    `Open loop target interval adjusted to ~${targetInterval}s (plant first loop before ~${earliestPlant}s).`,
    `Phase 11 decay applied (${RETENTION_DECAY_HALF_LIFE_DAYS}-day half-life).`,
  ];
  if (quarantined.length > 0) {
    notes.push(`Quarantined ${quarantined.length} noise/outlier item(s).`);
  }

  const policy: RetentionPolicy = {
    targetOpenLoopIntervalSec: targetInterval,
    preferHookOnPayoff: true,
    notes,
    sampleSize,
    updatedAt: now.toISOString(),
  };

  // Memory Item: Deduplicated rule under "Winning hooks" or "Audience preferences"
  // "In this workspace, first open loop before ~Xs held better than dumping backstory."
  const memoryText = `In this workspace, first open loop before ~${earliestPlant}s held better than dumping backstory.`;
  const rawFingerprintKey = `retention-open-loop:${brandId || "brand"}:${targetInterval}:${earliestPlant}`;
  const fingerprint = `fp-retention-${computeFingerprint(rawFingerprintKey)}`;
  const dateStr = now.toISOString().split("T")[0];

  const updatedMemories = [...existingMemories];
  const existingIdx = updatedMemories.findIndex(
    (m) =>
      m.fingerprint === fingerprint ||
      (m.text && m.text.includes("first open loop before") && (m.category === "Winning hooks" || m.category === "Audience preferences"))
  );

  let memoryItem: MemoryItem;

  if (existingIdx >= 0) {
    const existing = updatedMemories[existingIdx];
    memoryItem = {
      ...existing,
      text: memoryText,
      fingerprint,
      lastSeenAt: now.toISOString(),
      syncCount: (existing.syncCount || 1) + 1,
    };
    updatedMemories[existingIdx] = memoryItem;
  } else {
    memoryItem = {
      id: `mem-retention-${Date.now()}`,
      type: "learned",
      text: memoryText,
      dateAdded: dateStr,
      category: "Winning hooks",
      fingerprint,
      firstSeenAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      syncCount: 1,
      createdAt: now.toISOString(),
    };
    updatedMemories.unshift(memoryItem);
  }

  return {
    policy,
    memoryItem,
    updatedMemories,
  };
}

export const RETENTION_OBSERVATIONS_KEY = "spark_retention_observations_v1";

export function getStoredRetentionObservations(brandId?: string): RetentionObservation[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(RETENTION_OBSERVATIONS_KEY);
    const list: RetentionObservation[] = raw ? JSON.parse(raw) : [];
    return brandId ? list.filter((o) => !o.brandId || o.brandId === brandId) : list;
  } catch {
    return [];
  }
}

export function saveStoredRetentionObservations(observations: RetentionObservation[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(RETENTION_OBSERVATIONS_KEY, JSON.stringify(observations.slice(-100)));
  } catch (e) {
    console.warn("[retentionPolicy] failed to save observations", e);
  }
}

export function recordRetentionObservation(observation: RetentionObservation): RetentionObservation[] {
  const all = getStoredRetentionObservations();
  const isDuplicate = all.some(
    (o) =>
      o.brandId === observation.brandId &&
      o.platform === observation.platform &&
      Math.abs(Date.parse(o.capturedAt) - Date.parse(observation.capturedAt)) < 60000 &&
      o.avgViewDurationSec === observation.avgViewDurationSec
  );
  if (!isDuplicate) {
    all.push(observation);
    saveStoredRetentionObservations(all);
  }
  return all;
}
