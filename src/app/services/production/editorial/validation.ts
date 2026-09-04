/**
 * Deterministic editorial validation — machine-readable.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { EditorialTimeline, UnresolvedDependency } from "./types";

export type EditorialValidationStatus = "valid" | "warning" | "invalid";

export interface EditorialValidationIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
  sceneId?: string;
  shotId?: string;
  clipId?: string;
  trackId?: string;
}

export interface EditorialValidationResult {
  status: EditorialValidationStatus;
  errors: EditorialValidationIssue[];
  warnings: EditorialValidationIssue[];
  unresolvedDependencies: UnresolvedDependency[];
  score: number;
}

export function validateEditorialTimeline(
  timeline: EditorialTimeline,
  spec?: ProductionSpec
): EditorialValidationResult {
  const errors: EditorialValidationIssue[] = [];
  const warnings: EditorialValidationIssue[] = [];

  const video = timeline.tracks.find((t) => t.kind === "video");
  const clips = video?.clips || [];

  if (!clips.length) {
    errors.push({
      code: "missing_shots",
      severity: "error",
      message: "No video clips on primary track",
    });
  }

  if (timeline.durationFrames <= 0) {
    errors.push({
      code: "invalid_duration",
      severity: "error",
      message: "Timeline duration must be positive",
    });
  }

  // Structural: invalid source ranges, overlaps on same track, gaps
  for (const track of timeline.tracks) {
    const sorted = [...track.clips].sort((a, b) => a.timelineStartFrames - b.timelineStartFrames);
    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i];
      if (c.sourceEndFrames <= c.sourceStartFrames) {
        errors.push({
          code: "invalid_source_range",
          severity: "error",
          message: `Invalid source range on clip ${c.id}`,
          clipId: c.id,
          trackId: track.id,
          shotId: c.shotId,
        });
      }
      if (c.timelineEndFrames <= c.timelineStartFrames) {
        errors.push({
          code: "invalid_duration",
          severity: "error",
          message: `Invalid timeline range on clip ${c.id}`,
          clipId: c.id,
          trackId: track.id,
        });
      }
      if (i > 0 && track.kind === "video") {
        const prev = sorted[i - 1];
        if (c.timelineStartFrames < prev.timelineEndFrames) {
          errors.push({
            code: "overlapping_clips",
            severity: "error",
            message: `Overlapping video clips ${prev.id} and ${c.id}`,
            clipId: c.id,
            trackId: track.id,
          });
        } else if (c.timelineStartFrames > prev.timelineEndFrames + timeline.frameRate) {
          // gap > 1 second
          warnings.push({
            code: "timeline_gap",
            severity: "warning",
            message: `Gap between ${prev.id} and ${c.id}`,
            clipId: c.id,
            trackId: track.id,
          });
        }
      }
    }

    // Duplicate placement of same shot on video
    if (track.kind === "video") {
      const seen = new Set<string>();
      for (const c of track.clips) {
        if (!c.shotId) continue;
        if (seen.has(c.shotId)) {
          errors.push({
            code: "duplicate_placement",
            severity: "error",
            message: `Shot ${c.shotId} placed more than once`,
            shotId: c.shotId,
            clipId: c.id,
          });
        }
        seen.add(c.shotId);
      }
    }
  }

  // Transitions referencing missing clips
  const clipIds = new Set(timeline.tracks.flatMap((t) => t.clips.map((c) => c.id)));
  for (const tr of timeline.transitions) {
    if (tr.fromClipId && !clipIds.has(tr.fromClipId)) {
      errors.push({
        code: "invalid_transition",
        severity: "error",
        message: `Transition ${tr.id} references missing fromClip`,
      });
    }
    if (tr.toClipId && !clipIds.has(tr.toClipId)) {
      errors.push({
        code: "invalid_transition",
        severity: "error",
        message: `Transition ${tr.id} references missing toClip`,
      });
    }
  }

  // Narrative order vs spec
  if (spec) {
    const plannedShotOrder = spec.scenes.flatMap((s) => s.shots.map((sh) => sh.id));
    const assembledOrder = clips.map((c) => c.shotId).filter(Boolean) as string[];
    // Assembled should be subsequence of planned (missing ok if unresolved)
    let pi = 0;
    for (const id of assembledOrder) {
      while (pi < plannedShotOrder.length && plannedShotOrder[pi] !== id) pi += 1;
      if (pi >= plannedShotOrder.length) {
        errors.push({
          code: "shot_order_mismatch",
          severity: "error",
          message: `Shot ${id} appears out of planned order`,
          shotId: id,
        });
        break;
      }
      pi += 1;
    }

    const plannedSceneOrder = spec.scenes.map((s) => s.id);
    const assembledScenes = timeline.scenes.map((s) => s.sceneSpecId);
    for (let i = 0; i < assembledScenes.length; i++) {
      const expectedIdx = plannedSceneOrder.indexOf(assembledScenes[i]);
      if (expectedIdx < 0) continue;
      if (i > 0) {
        const prevIdx = plannedSceneOrder.indexOf(assembledScenes[i - 1]);
        if (prevIdx > expectedIdx) {
          errors.push({
            code: "scene_order_mismatch",
            severity: "error",
            message: "Scene order does not match ProductionSpec",
            sceneId: assembledScenes[i],
          });
        }
      }
    }

    // Missing narrative ending
    const lastScene = spec.scenes[spec.scenes.length - 1];
    if (lastScene && !timeline.scenes.some((s) => s.sceneSpecId === lastScene.id && s.clipIds.length)) {
      warnings.push({
        code: "missing_ending",
        severity: "warning",
        message: "Planned ending scene has no assembled clips",
        sceneId: lastScene.id,
      });
    }

    if (spec.audio.hasDialogue) {
      const hasDlg = timeline.tracks.some((t) => t.kind === "dialogue" && t.clips.length);
      if (!hasDlg) {
        warnings.push({
          code: "missing_dialogue",
          severity: "warning",
          message: "Dialogue required by audio plan but no dialogue track clips",
        });
      }
    }
    if (spec.audio.hasNarration) {
      const hasNar = timeline.tracks.some((t) => t.kind === "narration" && t.clips.length);
      if (!hasNar) {
        errors.push({
          code: "missing_narration",
          severity: "error",
          message: "Narration required but missing from timeline",
        });
      }
    }
    if (spec.audio.hasMusic) {
      const hasMusic = timeline.tracks.some((t) => t.kind === "music" && t.clips.length);
      if (!hasMusic) {
        warnings.push({
          code: "missing_music",
          severity: "warning",
          message: "Music explicitly required but missing",
        });
      }
    }
  }

  // Captions timing
  for (const cue of timeline.captions) {
    if (cue.endFrames <= cue.startFrames) {
      errors.push({
        code: "invalid_caption_timing",
        severity: "error",
        message: `Caption ${cue.id} has invalid timing`,
      });
    }
  }

  // Technical: resolution / aspect
  if (!timeline.resolution.width || !timeline.resolution.height) {
    errors.push({
      code: "invalid_resolution",
      severity: "error",
      message: "Timeline resolution missing",
    });
  }
  if (!timeline.frameRate || timeline.frameRate <= 0) {
    errors.push({
      code: "invalid_timebase",
      severity: "error",
      message: "Invalid frame rate / timebase",
    });
  }

  for (const dep of timeline.unresolvedDependencies) {
    errors.push({
      code: dep.kind,
      severity: "error",
      message: dep.message,
      sceneId: dep.sceneId,
      shotId: dep.shotId,
    });
  }

  const score = Math.max(0, 100 - errors.length * 12 - warnings.length * 4);
  const status: EditorialValidationStatus =
    errors.length > 0 ? "invalid" : warnings.length > 0 ? "warning" : "valid";

  return {
    status,
    errors,
    warnings,
    unresolvedDependencies: timeline.unresolvedDependencies,
    score,
  };
}
