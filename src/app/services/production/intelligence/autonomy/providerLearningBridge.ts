/**
 * Soft provider preference signals — capability-scoped, version-aware.
 * Feeds ModelRouter preferences; does not create a second router.
 */

import type { ProviderPreferenceSignal } from "./types";

export function deriveProviderPreferences(
  rows: Array<{
    strategyKey: string;
    generationStrategy?: string;
    attempts: number;
    successes: number;
    retries: number;
    qcFailureCodes?: string[];
    providerId?: string;
    modelId?: string;
    modelVersion?: string;
  }>
): ProviderPreferenceSignal[] {
  return rows.map((row) => {
    const sampleSize = Math.max(1, row.attempts);
    const successRate = row.successes / sampleSize;
    const capabilityProfile = row.generationStrategy || row.strategyKey || "unspecified_capability";
    const providerId = row.providerId || row.strategyKey;
    let preferenceDelta = 0;
    if (sampleSize >= 5) {
      if (successRate >= 0.8) preferenceDelta = 0.15;
      else if (successRate >= 0.65) preferenceDelta = 0.05;
      else if (successRate < 0.45) preferenceDelta = -0.15;
      else if (successRate < 0.55) preferenceDelta = -0.05;
    }
    const confidence = Math.min(0.9, sampleSize / 12) * (row.modelVersion ? 1 : 0.85);
    return {
      capabilityProfile,
      providerId,
      modelId: row.modelId,
      modelVersion: row.modelVersion,
      successRate,
      sampleSize,
      confidence,
      preferenceDelta,
      notes: [
        `capability=${capabilityProfile}`,
        row.modelVersion ? `modelVersion=${row.modelVersion}` : "modelVersion=unknown",
        ...(row.qcFailureCodes || []).slice(0, 3).map((c) => `qc:${c}`),
      ],
    };
  });
}

export function applyProviderPreferenceBonuses<T extends { providerId: string; score: number }>(
  ranked: T[],
  prefs: ProviderPreferenceSignal[],
  opts?: { capabilityProfile?: string; modelVersion?: string; hardRejectedIds?: string[] }
): T[] {
  const rejected = new Set(opts?.hardRejectedIds || []);
  const relevant = prefs.filter((p) => {
    if (opts?.capabilityProfile && p.capabilityProfile !== opts.capabilityProfile) return false;
    if (opts?.modelVersion && p.modelVersion && p.modelVersion !== opts.modelVersion) return false;
    return true;
  });

  return ranked
    .filter((r) => !rejected.has(r.providerId))
    .map((r) => {
      const pref = relevant.find((p) => p.providerId === r.providerId);
      if (!pref || pref.sampleSize < 5) return r;
      return { ...r, score: r.score + pref.preferenceDelta * pref.confidence };
    })
    .sort((a, b) => b.score - a.score);
}
