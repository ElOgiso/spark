/**
 * Live motion prompt compiler — OS spine for I2V / scene motion.
 *
 * Keeps the powerful LOCKED SPARK SHOT MOTION envelope, but follows the
 * storyboard still: IMAGE 1 owns character / environment / props.
 * Prefer SceneMotionLock frozen at still/panel time over free scene rewrite.
 */

import { buildSceneMotionPrompt } from "./productionPromptPacks";
import type { ContentFormat, ProductionBrief } from "../../domain/types";
import {
  contentFormatDirective,
  formatSubjectRoleLabel,
  normalizeCanonicalContentFormat,
} from "./contentFormatDirectives";
import {
  assertDirectorScriptReadyForMotion,
  directorVisualSpeechLaw,
  resolveDirectorSceneScript,
} from "./directorScriptAuthority";
import {
  resolveSceneMotionLock,
  storyboardStillAnimateLaws,
  type SceneMotionLock,
} from "./sceneMotionLock";
import {
  resolveLiveVisualGenre,
  visualGenreDirective,
} from "./visualGenreDirectives";
import { isVisualGenreId, opticalDisciplineForVisualGenre } from "../../domain/visualGenre";

export function compileLiveMotionPrompt(params: {
  mode: "express" | "standard" | "deep";
  aspectRatio: string;
  sceneIndex: number;
  totalScenes: number;
  durationSec: number;
  scene: any;
  refLabels: string[];
  isInsertOrSet: boolean;
  characterName?: string;
  characterStyle?: string;
  environment: string;
  brief?: ProductionBrief;
  revisionNotes?: string;
  contentFormat?: ContentFormat | string | null;
  /** When true (default), refuse banned Host-presents fallbacks. */
  enforceDirectorGate?: boolean;
  /**
   * When true (default), I2V follows locked storyboard still —
   * animate to life without redesigning look.
   */
  followStoryboardStill?: boolean;
}): {
  prompt: string;
  compiler: "scene_motion";
  directorScript: ReturnType<typeof resolveDirectorSceneScript>;
  motionLock: SceneMotionLock;
  fromPersistedLock: boolean;
} {
  const {
    mode,
    aspectRatio,
    sceneIndex,
    totalScenes,
    durationSec,
    scene,
    refLabels,
    isInsertOrSet,
    environment,
    brief,
    revisionNotes,
  } = params;

  const followStoryboardStill = params.followStoryboardStill !== false;
  const format = normalizeCanonicalContentFormat(params.contentFormat);
  const labels = formatSubjectRoleLabel(format, isInsertOrSet ? "insert" : "main");
  const characterName = isInsertOrSet
    ? undefined
    : params.characterName || labels.nameFallback;
  const characterStyle = isInsertOrSet
    ? "B-Roll / Cinematic Visual"
    : params.characterStyle || labels.styleFallback;

  const beat =
    brief?.beats && Array.isArray(brief.beats)
      ? brief.beats[Math.max(0, sceneIndex - 1)] || brief.beats[sceneIndex]
      : undefined;

  const { lock: motionLock, fromPersisted: fromPersistedLock } = resolveSceneMotionLock({
    scene,
    beat,
    environment,
    contentFormat: format,
    sceneIndexZeroBased: Math.max(0, sceneIndex - 1),
    attachIfMissing: true,
    sourceStill: scene?.sourceStill,
    stillUrl: scene?.image || scene?.keyframeImageUrl,
  });

  // Director script for gate + speech law — prefer lock fields when present
  const directorScript = resolveDirectorSceneScript({
    scene: {
      ...scene,
      physicalAction: motionLock.physicalAction,
      spokenLines: motionLock.spokenLines || scene?.spokenLines,
      cameraDirection: motionLock.cameraDirection || scene?.cameraDirection,
      endState: motionLock.endPose,
    },
    beat,
    environment,
    contentFormat: format,
    sceneIndexZeroBased: Math.max(0, sceneIndex - 1),
  });

  if (params.enforceDirectorGate !== false) {
    assertDirectorScriptReadyForMotion(directorScript, `Scene ${sceneIndex}`);
  }

  const lockLaw = followStoryboardStill
    ? isInsertOrSet
      ? "VISUAL LOCK LAW: IMAGE 1 is the mandatory storyboard still. Animate props/set motion only — never redesign the plate."
      : "VISUAL LOCK LAW: IMAGE 1 (storyboard still) owns character, wardrobe, props, and environment. Sheet is identity backup only. Text = motion + camera only."
    : isInsertOrSet
      ? "VISUAL LOCK LAW: IMAGE 1 is the mandatory first frame composition. Text describes physical action and camera motion only."
      : "VISUAL LOCK LAW: Character identity strictly lives in the model sheet reference. Scene still is the mandatory first frame composition.";

  const revisionLine = revisionNotes
    ? `EXECUTIVE REVISION: ${revisionNotes}\nVISUAL LOCK LAW: Animate from the revised scene still first frame. Keep character, environment, and props locked to IMAGE 1 — change only the requested motion/action.`
    : lockLaw;

  const visualGenre = isVisualGenreId(motionLock.visualGenre)
    ? motionLock.visualGenre
    : resolveLiveVisualGenre({
        formatSettings: brief?.formatSettings,
        contentFormat: format,
        brief,
      });
  const cinematicCraft = motionLock.cinematicCraft !== false;
  const genreLaw = visualGenreDirective({ visualGenre, cinematicCraft });

  const refHeader = [
    contentFormatDirective(format),
    genreLaw,
    ...refLabels,
    revisionLine,
    followStoryboardStill ? storyboardStillAnimateLaws() : "",
    directorVisualSpeechLaw(directorScript.spokenLines || motionLock.spokenLines),
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `${refHeader}\n${buildSceneMotionPrompt({
    mode,
    aspectRatio,
    sceneIndex,
    totalScenes,
    durationSec,
    shotFraming: motionLock.cameraDirection || scene?.cameraDirection,
    action: motionLock.physicalAction || directorScript.physicalAction,
    spokenLines: undefined,
    performanceSpeech: motionLock.spokenLines || directorScript.spokenLines,
    onScreenText: undefined,
    audio: scene?.audio,
    endPose: motionLock.endPose,
    characterName,
    characterStyle,
    environment,
    viralConcept: undefined,
    followStoryboardStill,
    opticalDiscipline: opticalDisciplineForVisualGenre(visualGenre),
  })}`;

  return {
    prompt,
    compiler: "scene_motion",
    directorScript,
    motionLock,
    fromPersistedLock,
  };
}
