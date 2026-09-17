/**
 * Shorts Selection Plan Compiler — Prompt 8, Component D
 *
 * Derives a list of clip-worthy spans from an existing production's
 * shot boundaries and open-loop timestamps. Each short is a trim/mux
 * of the canonical master — NOT a re-I2V of the feature.
 *
 * Constitution rules enforced:
 * - Cap at ≤8 shorts per master.
 * - Anchor on shot boundaries OR openLoop plantedAtSec — no arbitrary wall-clock slices.
 * - Minimum span: 15 s. Maximum span: 60 s (configurable via maxSpanSec).
 * - Emits GenerationTask entries with kind "short_cut" and reason "TEMPORAL" dependency on master.
 * - Does NOT call I2V. Does NOT touch productionAssetService.
 */

import type { GenerationTask } from "../specification/generationTask";
import type { NarrativeScript } from "../../../domain/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ShortsSpan {
  /** Unique identifier for this derived short. */
  id: string;
  /** Clip start in seconds, anchored on shot/loop boundary. */
  startSec: number;
  /** Clip end in seconds. */
  endSec: number;
  /** Source chapter ID if anchored on a chapter. */
  chapterId?: string;
  /** Source shot ID if anchored on a shot spec. */
  shotId?: string;
  /** True if span includes an open-loop anchor point. */
  openLoopAnchor?: boolean;
  /** Human-readable rationale for selection. */
  rationale: string;
}

export interface ShortsSelectionPlan {
  spans: ShortsSpan[];
  tasks: GenerationTask[];
  masterProductionId: string;
  masterUrl?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_MAX_SHORT_SEC = 60;
const DEFAULT_MIN_SHORT_SEC = 15;
const MAX_SHORTS_PER_MASTER = 8;

/** Clamp a span to the [min, max] duration window and master length. */
function clampSpan(
  start: number,
  end: number,
  masterDurationSec: number,
  minSec = DEFAULT_MIN_SHORT_SEC,
  maxSec = DEFAULT_MAX_SHORT_SEC
): { start: number; end: number } | null {
  const clampedEnd = Math.min(end, masterDurationSec);
  const clampedStart = Math.min(start, clampedEnd);
  const dur = clampedEnd - clampedStart;
  if (dur < minSec) return null;
  if (dur > maxSec) return { start: clampedStart, end: clampedStart + maxSec };
  return { start: clampedStart, end: clampedEnd };
}

// ─── Core Function ───────────────────────────────────────────────────────────

export interface ComputeShortsParams {
  /** Chapters from the NarrativeScript — used for boundary anchoring. */
  chapters?: NarrativeScript["chapters"];
  /** Open-loop planted timestamps from the NarrativeScript. */
  openLoops?: { plantedAtSec: number[]; resolvedAtSec: number[] };
  /** Total duration of the canonical master in seconds. Required. */
  masterDurationSec: number;
  /** The production ID of the canonical master. */
  masterProductionId: string;
  /** Durable URL of the canonical master (for task dependency reference). */
  masterUrl?: string;
  /** Optional override for maximum clip duration (default 60 s). */
  maxSpanSec?: number;
}

/**
 * Derives ShortsSpan candidates from shot/chapter boundaries + open-loop timestamps.
 * Returns ≤8 spans with GenerationTask entries (kind: "short_cut") for the DAG.
 */
export function compileShortsSelectionPlan(params: ComputeShortsParams): ShortsSelectionPlan {
  const {
    chapters = [],
    openLoops,
    masterDurationSec,
    masterProductionId,
    masterUrl,
    maxSpanSec = DEFAULT_MAX_SHORT_SEC,
  } = params;

  if (!masterProductionId) {
    throw new Error("[compileShortsSelectionPlan] masterProductionId is required");
  }
  if (!masterDurationSec || masterDurationSec <= 0) {
    throw new Error("[compileShortsSelectionPlan] masterDurationSec must be a positive number");
  }

  const candidates: ShortsSpan[] = [];

  // ── 1. Chapter-boundary anchors ──────────────────────────────────────────
  // Build cumulative timestamps from chapter durations
  let cursor = 0;
  const chapterBoundaries: Array<{ id: string; startSec: number; endSec: number; job: string }> = [];
  for (const ch of chapters) {
    const dur = ch.durationSec ?? 0;
    chapterBoundaries.push({ id: ch.id, startSec: cursor, endSec: cursor + dur, job: ch.job ?? "" });
    cursor += dur;
  }

  // Select hook chapter as #1 candidate (always high value)
  const hookChapter = chapterBoundaries.find((c) => c.job === "hook");
  if (hookChapter) {
    const span = clampSpan(hookChapter.startSec, hookChapter.endSec, masterDurationSec, DEFAULT_MIN_SHORT_SEC, maxSpanSec);
    if (span) {
      candidates.push({
        id: `short-hook-${masterProductionId}`,
        startSec: span.start,
        endSec: span.end,
        chapterId: hookChapter.id,
        rationale: `Hook chapter "${hookChapter.id}" — highest drop-off risk, strongest short candidate`,
      });
    }
  }

  // Payoff / CTA chapters are strong short candidates
  for (const ch of chapterBoundaries) {
    if (["payoff", "cta", "proof", "myth_bust"].includes(ch.job)) {
      const span = clampSpan(ch.startSec, ch.endSec, masterDurationSec, DEFAULT_MIN_SHORT_SEC, maxSpanSec);
      if (span) {
        candidates.push({
          id: `short-${ch.job}-${ch.id}`,
          startSec: span.start,
          endSec: span.end,
          chapterId: ch.id,
          rationale: `"${ch.job}" chapter — self-contained value payoff suitable for vertical short`,
        });
      }
    }
    if (candidates.length >= MAX_SHORTS_PER_MASTER) break;
  }

  // ── 2. Open-loop anchor spans ────────────────────────────────────────────
  // Each plantedAtSec → derive a span that includes the loop plant and payoff window
  if (openLoops?.plantedAtSec?.length) {
    for (let i = 0; i < openLoops.plantedAtSec.length; i++) {
      if (candidates.length >= MAX_SHORTS_PER_MASTER) break;
      const plantedAt = openLoops.plantedAtSec[i];
      const resolvedAt = openLoops.resolvedAtSec?.[i];

      // Span from 5 s before plant through resolution (or +30 s if no resolution)
      const rawStart = Math.max(0, plantedAt - 5);
      const rawEnd = resolvedAt != null ? resolvedAt + 5 : plantedAt + 30;
      const span = clampSpan(rawStart, rawEnd, masterDurationSec, DEFAULT_MIN_SHORT_SEC, maxSpanSec);
      if (!span) continue;

      // Avoid duplicating a span already covered by a chapter anchor (±10 s overlap)
      const isDuplicate = candidates.some(
        (c) => Math.abs(c.startSec - span.start) < 10 && Math.abs(c.endSec - span.end) < 10
      );
      if (isDuplicate) continue;

      candidates.push({
        id: `short-loop-${i}-${masterProductionId}`,
        startSec: span.start,
        endSec: span.end,
        openLoopAnchor: true,
        rationale: `Open-loop plant at ${plantedAt}s → resolved at ${resolvedAt ?? "end"}s — curiosity gap short`,
      });
    }
  }

  // ── 3. Fallback: even-split if no chapters/loops produced candidates ──────
  if (candidates.length === 0 && masterDurationSec >= DEFAULT_MIN_SHORT_SEC) {
    const slotCount = Math.min(3, MAX_SHORTS_PER_MASTER);
    const slotDur = Math.min(maxSpanSec, Math.floor(masterDurationSec / slotCount));
    for (let i = 0; i < slotCount; i++) {
      const start = i * slotDur;
      const span = clampSpan(start, start + slotDur, masterDurationSec, DEFAULT_MIN_SHORT_SEC, maxSpanSec);
      if (span) {
        candidates.push({
          id: `short-split-${i}-${masterProductionId}`,
          startSec: span.start,
          endSec: span.end,
          rationale: `Even-split fallback segment ${i + 1}/${slotCount} (no chapter metadata available)`,
        });
      }
    }
  }

  // ── 4. Enforce ≤8 cap ────────────────────────────────────────────────────
  const spans = candidates.slice(0, MAX_SHORTS_PER_MASTER);

  // ── 5. Build GenerationTask entries (kind: "short_cut") ──────────────────
  const now = new Date().toISOString();
  const tasks: GenerationTask[] = spans.map((span) => ({
    id: span.id,
    productionId: masterProductionId,
    kind: "short_cut",
    status: "planned",
    priority: "NORMAL",
    strategy: {
      modality: "mux_edit",
      includesEditing: true,
      notes: span.rationale,
    },
    requiredCapabilities: ["mux_edit"],
    dependsOn: masterUrl ? [`master-${masterProductionId}`] : [],
    dependencies: masterUrl
      ? [
          {
            taskId: `master-${masterProductionId}`,
            reason: "TEMPORAL" as const,
            strength: "hard" as const,
            requirement: "completed" as const,
            detail: `Requires canonical master URL: ${masterUrl}`,
          },
        ]
      : [],
    retryCount: 0,
  }));

  return { spans, tasks, masterProductionId, masterUrl };
}
