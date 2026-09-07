/**
 * Live motion prompt compiler — OS spine for I2V / scene motion.
 * Director script authority: physicalAction drives visuals; spokenLines are audio-only.
 */

import { buildSceneMotionPrompt, buildViralConceptDirective } from "./productionPromptPacks";
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
}): {
  prompt: string;
  compiler: "scene_motion";
  directorScript: ReturnType<typeof resolveDirectorSceneScript>;
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

  const directorScript = resolveDirectorSceneScript({
    scene,
    beat,
    environment,
    contentFormat: format,
    sceneIndexZeroBased: Math.max(0, sceneIndex - 1),
  });

  if (params.enforceDirectorGate !== false) {
    assertDirectorScriptReadyForMotion(directorScript, `Scene ${sceneIndex}`);
  }

  const lockLaw = isInsertOrSet
    ? "VISUAL LOCK LAW: IMAGE 1 is the mandatory first frame composition. Text describes physical action and camera motion only."
    : "VISUAL LOCK LAW: Character identity strictly lives in the model sheet reference. Scene still is the mandatory first frame composition.";

  const revisionLine = revisionNotes
    ? `EXECUTIVE REVISION: ${revisionNotes}\nVISUAL LOCK LAW: Animate from the scene still first frame. Sheet is identity only — never the first frame.`
    : lockLaw;

  const refHeader = [
    contentFormatDirective(format),
    ...refLabels,
    revisionLine,
    directorVisualSpeechLaw(directorScript.spokenLines),
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `${refHeader}\n${buildSceneMotionPrompt({
    mode,
    aspectRatio,
    sceneIndex,
    totalScenes,
    durationSec,
    shotFraming: scene?.cameraDirection,
    action: directorScript.physicalAction,
    spokenLines: undefined,
    performanceSpeech: directorScript.spokenLines,
    onScreenText: undefined,
    audio: scene?.audio,
    endPose:
      !directorScript.wasMeta && scene?.endState && !/host presents/i.test(String(scene.endState))
        ? scene.endState
        : "Hold a clear, readable end pose matching the physical action",
    characterName,
    characterStyle,
    environment,
    viralConcept: brief ? buildViralConceptDirective(brief) : undefined,
  })}`;

  return { prompt, compiler: "scene_motion", directorScript };
}
