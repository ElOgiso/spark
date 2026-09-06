/**
 * Soft repair preference signals — feeds existing repair planner.
 */

import type { RepairPreferenceSignal } from "./types";

export function deriveRepairPreferences(
  outcomes: Array<{
    failureCode: string;
    repairStrategy: string;
    success: boolean;
    provider?: string;
    model?: string;
  }>
): RepairPreferenceSignal[] {
  const bucket = new Map<string, { success: number; total: number; notes: string[] }>();
  for (const o of outcomes) {
    const key = `${o.failureCode}::${o.repairStrategy}`;
    const cur = bucket.get(key) || { success: 0, total: 0, notes: [] };
    cur.total += 1;
    if (o.success) cur.success += 1;
    if (o.provider) cur.notes.push(`provider=${o.provider}`);
    if (o.model) cur.notes.push(`model=${o.model}`);
    bucket.set(key, cur);
  }

  const out: RepairPreferenceSignal[] = [];
  for (const [key, b] of bucket) {
    const [failureClass, repairStrategy] = key.split("::");
    out.push({
      failureClass,
      repairStrategy,
      successRate: b.success / Math.max(1, b.total),
      sampleSize: b.total,
      confidence: Math.min(0.9, b.total / 8),
      notes: [...new Set(b.notes)].slice(0, 4),
    });
  }
  return out.sort((a, b) => b.successRate * b.confidence - a.successRate * a.confidence);
}

export function preferRepairStrategy(
  prefs: RepairPreferenceSignal[],
  failureClass: string,
  minSample = 3
): RepairPreferenceSignal | undefined {
  return prefs
    .filter((p) => p.failureClass === failureClass && p.sampleSize >= minSample)
    .sort((a, b) => b.successRate - a.successRate)[0];
}
