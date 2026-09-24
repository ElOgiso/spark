/**
 * Asset → EditorialTimeline assembly.
 * Does not mutate ProductionSpec. Does not silently substitute unrelated media.
 */

import type { ProductionAsset } from "../../../domain/types";
import type { ProductionSpec } from "../specification/productionSpec";
import type { ProductionQcVerdict } from "../qc/types";
import type {
  EditorialTimeline,
  EditorialScene,
  EditorialClip,
  UnresolvedDependency,
} from "./types";
import { DEFAULT_FRAME_RATE, secToFrames, parseDurationToSec, identityTransform } from "./timebase";
import { defaultAssemblyTracks, ensureTrack } from "./tracks";
import { normalizeTransition, buildTransitionsFromClips } from "./transitions";
import {
  evaluateShotEligibility,
  DEFAULT_ENTRY_POLICY,
  type EditorialEntryPolicy,
} from "./eligibility";
import { buildCaptionsFromSpec } from "./captions";
import { assembleAudioTracks, buildAudioMixInstructions } from "./audioMix";
import { createDefaultVariants, resolveAspectDimensions } from "./variants";
import { userFacingEditorialStatus } from "./userMessages";

export interface AssembleEditorialOptions {
  assets?: ProductionAsset[];
  qcVerdict?: ProductionQcVerdict;
  frameRate?: number;
  policy?: EditorialEntryPolicy;
  manualExceptionShotIds?: string[];
  language?: string;
  /** When true, build planned layout even without assets (legacy / dry planning) */
  allowPlannedWithoutAssets?: boolean;
}

function newTimelineId(): string {
  return `etl_${Math.random().toString(36).slice(2, 10)}`;
}

function clipId(prefix: string, shotId: string): string {
  return `${prefix}_${shotId}`;
}

export function assembleEditorialTimeline(
  spec: ProductionSpec,
  options: AssembleEditorialOptions = {}
): EditorialTimeline {
  const frameRate = options.frameRate || DEFAULT_FRAME_RATE;
  const assets = options.assets || [];
  const policy = options.policy || DEFAULT_ENTRY_POLICY;
  const manual = new Set(options.manualExceptionShotIds || []);
  const allowPlanned = options.allowPlannedWithoutAssets === true;

  const tracks = defaultAssemblyTracks();
  const scenes: EditorialScene[] = [];
  const unresolved: UnresolvedDependency[] = [];
  const assembledAssetIds: string[] = [];
  const placements: Array<{
    shotId: string;
    sceneId: string;
    startFrames: number;
    endFrames: number;
    dialogue?: string;
    narration?: string;
    onScreenText?: string;
  }> = [];

  let cursor = 0;
  const dims = resolveAspectDimensions(spec.project.aspectRatio || "9:16");

  for (const scene of spec.scenes) {
    const sceneStart = cursor;
    const shotIds: string[] = [];
    const clipIds: string[] = [];

    for (const shot of scene.shots) {
      const eligibility = evaluateShotEligibility({
        shot,
        assets,
        qcVerdict: options.qcVerdict,
        policy,
        manualExceptionShotIds: manual,
      });

      const plannedDur = secToFrames(shot.durationSec || 0, frameRate);
      const assetDurSec = parseDurationToSec(eligibility.asset?.duration);
      const sourceDur = assetDurSec
        ? secToFrames(assetDurSec, frameRate)
        : plannedDur;
      const timelineDur = plannedDur > 0 ? plannedDur : sourceDur || secToFrames(3, frameRate);

      if (!eligibility.eligible) {
        if (!allowPlanned) {
          unresolved.push({
            kind:
              eligibility.status === "excluded"
                ? eligibility.reason.includes("QC")
                  ? "qc_blocked"
                  : "failed_asset"
                : "missing_asset",
            sceneId: scene.id,
            shotId: shot.id,
            taskId: eligibility.asset?.taskId,
            message: eligibility.reason,
          });
          continue;
        }
        // Planned layout mode: place structural clips without treating as hard unresolved
      }

      const start = cursor;
      const end = cursor + timelineDur;
      const videoTrack = ensureTrack(tracks, "video", 0);
      const mediaType =
        eligibility.asset?.assetType === "audio"
          ? "audio"
          : eligibility.asset?.assetType === "image" || eligibility.asset?.assetType === "frame"
            ? "image"
            : "video";

      const sourceUrl = eligibility.asset?.publicUrl || shot.mediaUrl || shot.keyframeUrl;
      const provenance = {
        productionId: spec.project.id,
        sceneId: scene.id,
        shotId: shot.id,
        taskId: eligibility.asset?.taskId,
        assetId: eligibility.asset?.id,
        assetVersion: eligibility.asset?.createdAt || eligibility.asset?.id,
        generationAttempt: shot.retry?.attempt,
        qcStatus: shot.qcStatus,
        sourceAssetIds: eligibility.asset?.id ? [eligibility.asset.id] : [],
      };

      if (eligibility.eligible || allowPlanned) {
        const clip: EditorialClip = {
          id: clipId("v", shot.id),
          trackId: videoTrack.id,
          assetId: eligibility.asset?.id,
          shotId: shot.id,
          sceneId: scene.id,
          sourceStartFrames: 0,
          sourceEndFrames: Math.max(1, sourceDur || timelineDur),
          timelineStartFrames: start,
          timelineEndFrames: end,
          playbackRate: 1,
          transform: identityTransform(),
          opacity: 1,
          volume: 1,
          muted: false,
          volumeAutomation: [],
          transitionIn: normalizeTransition(shot.transitionIn),
          transitionOut: normalizeTransition(shot.transitionOut || scene.transitionOut),
          label: shot.purpose || shot.productionReason || shot.id,
          mediaType: mediaType as EditorialClip["mediaType"],
          sourceUrl,
          mimeType: eligibility.asset?.mimeType,
          status: eligibility.eligible ? eligibility.status : "planned",
          provenance,
        };
        videoTrack.clips.push(clip);
        clipIds.push(clip.id);
        shotIds.push(shot.id);
        if (eligibility.asset?.id) assembledAssetIds.push(eligibility.asset.id);

        if (scene.onScreenText) {
          const tTrack = ensureTrack(tracks, "text", 0);
          tTrack.clips.push({
            ...clip,
            id: clipId("t", shot.id),
            trackId: tTrack.id,
            mediaType: "text",
            label: scene.onScreenText,
            timelineEndFrames: Math.min(end, start + secToFrames(3, frameRate)),
            sourceUrl: undefined,
            assetId: undefined,
          });
        }

        placements.push({
          shotId: shot.id,
          sceneId: scene.id,
          startFrames: start,
          endFrames: end,
          dialogue: shot.dialogue || scene.dialogue,
          narration: shot.narration || scene.narration,
          onScreenText: scene.onScreenText,
        });

        cursor = end;
      }
    }

    scenes.push({
      id: `escene_${scene.id}`,
      sceneSpecId: scene.id,
      order: scene.index,
      startFrames: sceneStart,
      durationFrames: Math.max(0, cursor - sceneStart),
      shotIds,
      clipIds,
      transitionIn: normalizeTransition(scene.transitionIn),
      transitionOut: normalizeTransition(scene.transitionOut),
      continuitySummary: scene.continuity?.exitState,
      audioNotes: scene.music || scene.ambience,
      effects: scene.vfx,
    });
  }

  const audio = assembleAudioTracks({ spec, assets, tracks, scenes, frameRate, durationFrames: cursor, allowPlanned });
  unresolved.push(...audio.unresolved);
  assembledAssetIds.push(...audio.assetIds);

  const videoClips = tracks.find((t) => t.kind === "video")?.clips || [];
  const transitions = buildTransitionsFromClips(videoClips, frameRate);
  const captions = buildCaptionsFromSpec({
    spec,
    frameRate,
    shotPlacements: placements,
    language: options.language,
  });

  const durationFrames = cursor || secToFrames(spec.project.targetDurationSec || 0, frameRate);
  const status =
    unresolved.length === 0 && videoClips.length > 0
      ? "validated"
      : videoClips.length > 0
        ? "incomplete"
        : "draft";

  const result: EditorialTimeline = {
    id: newTimelineId(),
    productionId: spec.project.id,
    version: 1,
    frameRate,
    timebase: "frames",
    durationFrames,
    resolution: dims,
    aspectRatio: spec.project.aspectRatio || "9:16",
    scenes,
    tracks: tracks.filter((t) => t.clips.length > 0 || t.kind === "video"),
    transitions,
    captions,
    audioMix: [],
    audioMastering: spec.audio.mastering,
    variants: createDefaultVariants({
      masterAspect: spec.project.aspectRatio || "9:16",
      masterWidth: dims.width,
      masterHeight: dims.height,
      frameRate,
    }),
    status: status as EditorialTimeline["status"],
    unresolvedDependencies: unresolved,
    provenance: {
      productionId: spec.project.id,
      qcVerdict: options.qcVerdict,
      assembledFromAssetIds: [...new Set(assembledAssetIds)],
      sourceSpecVersion: spec.version,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userMessage: userFacingEditorialStatus(status as EditorialTimeline["status"], unresolved.length),
    diagnostics: {
      shotCountPlanned: spec.scenes.reduce((n, s) => n + s.shots.length, 0),
      videoClipCount: videoClips.length,
      allowPlanned,
    },
  };

  result.audioMix = buildAudioMixInstructions({
    timeline: result,
    hasMusic: spec.audio.hasMusic,
  });

  if (result.status === "validated") {
    result.status = "ready_for_master";
    result.userMessage = userFacingEditorialStatus("ready_for_master", 0);
  }

  return result;
}
