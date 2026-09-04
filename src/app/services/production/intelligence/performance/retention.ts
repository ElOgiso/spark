/**
 * Retention intelligence — only when granular data exists.
 */

import type { RetentionAnalysis, RetentionSegment, EvidenceStrength } from "./types";

export interface RetentionCurvePoint {
  atSec: number;
  retentionRate: number; // 0–1 or 0–100 (normalized below)
}

function normRate(v: number): number {
  return v > 1 ? v / 100 : v;
}

/**
 * Build segments from available curve points and total duration.
 * Ranges are derived from data — not hard-coded universal buckets.
 */
export function analyzeRetention(params: {
  durationSec?: number;
  curve?: RetentionCurvePoint[];
  completionRate?: number;
  rewatchSignal?: number;
}): RetentionAnalysis {
  const curve = params.curve || [];
  if (!curve.length && params.completionRate == null) {
    return {
      segments: [],
      interestLossHints: [],
      strength: "insufficient_data",
      explanation: "SPARK does not have enough retention data to locate interest loss.",
    };
  }

  const duration = params.durationSec || (curve.length ? curve[curve.length - 1].atSec : 0);
  const sorted = [...curve].sort((a, b) => a.atSec - b.atSec).map((p) => ({
    atSec: p.atSec,
    retentionRate: normRate(p.retentionRate),
  }));

  const segments: RetentionSegment[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = i === 0 ? 0 : sorted[i - 1].atSec;
    const end = sorted[i].atSec;
    const prev = i === 0 ? 1 : sorted[i - 1].retentionRate;
    const curr = sorted[i].retentionRate;
    segments.push({
      startSec: start,
      endSec: end,
      retentionRate: curr,
      dropOffRate: Math.max(0, prev - curr),
      availability: "available",
      label: `${start}–${end}s`,
    });
  }

  const opening = segments.find((s) => s.endSec <= Math.max(3, duration * 0.05));
  const early = segments.find((s) => s.endSec > 3 && s.endSec <= Math.max(15, duration * 0.15));
  const midPoint = duration / 2;
  const mid = segments.find((s) => s.startSec <= midPoint && s.endSec >= midPoint);
  const late = segments.filter((s) => s.startSec >= duration * 0.7);
  const lateDrop = late.reduce((m, s) => Math.max(m, s.dropOffRate || 0), 0);

  const completion =
    params.completionRate != null
      ? normRate(params.completionRate)
      : sorted.length
        ? sorted[sorted.length - 1].retentionRate
        : undefined;

  const hints: string[] = [];
  let strength: EvidenceStrength = "observed";

  if (opening && (opening.dropOffRate || 0) >= 0.25) {
    hints.push(`Opening drop-off concentrated in ${opening.label || "early seconds"}`);
  }
  if (early && (early.dropOffRate || 0) >= 0.2) {
    hints.push(`Early retention weakness around ${early.label}`);
  }
  if (mid && (mid.dropOffRate || 0) >= 0.15) {
    hints.push(`Mid-video drop near ${mid.label}`);
  }
  if (lateDrop >= 0.15) {
    hints.push("Late-video drop before completion");
  }
  if (completion != null && completion >= 0.55) {
    hints.push("Completion holds relatively well");
  } else if (completion != null && completion < 0.25) {
    hints.push("Completion is weak relative to typical short-form baselines (observed only)");
  }

  if (!hints.length) {
    strength = "uncertain";
    hints.push("Retention curve present but no dominant loss region identified");
  }

  return {
    segments,
    openingDropOff: opening?.dropOffRate,
    earlyRetention: early?.retentionRate ?? opening?.retentionRate,
    midVideoDrop: mid?.dropOffRate,
    lateVideoDrop: lateDrop || undefined,
    completionRate: completion,
    rewatchSignal: params.rewatchSignal,
    interestLossHints: hints,
    strength,
    explanation: hints[0] || "Retention analyzed from available curve points.",
  };
}
