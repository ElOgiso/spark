/**
 * Live motion prompt compiler — OS spine for I2V / scene motion.
 * AssetService supplies refs + scene fields; this module owns creative text.
 */

import { buildSceneMotionPrompt, buildViralConceptDirective } from "./productionPromptPacks";
import type { ProductionBrief } from "../../domain/types";

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
}): { prompt: string; compiler: "scene_motion" } {
  const {
    mode,
    aspectRatio,
    sceneIndex,
    totalScenes,
    durationSec,
    scene,
    refLabels,
    isInsertOrSet,
    characterName,
    characterStyle,
    environment,
    brief,
    revisionNotes,
  } = params;

  const lockLaw = isInsertOrSet
    ? "VISUAL LOCK LAW: IMAGE 1 is the mandatory first frame composition. Text describes physical action and camera motion only."
    : "VISUAL LOCK LAW: Character identity strictly lives in the model sheet reference. Scene still is the mandatory first frame composition.";

  const revisionLine = revisionNotes
    ? `EXECUTIVE REVISION: ${revisionNotes}\nVISUAL LOCK LAW: Animate from the scene still first frame. Sheet is identity only — never the first frame.`
    : lockLaw;

  const refHeader = [...refLabels, revisionLine].filter(Boolean).join("\n");

  const prompt = `${refHeader}\n${buildSceneMotionPrompt({
    mode,
    aspectRatio,
    sceneIndex,
    totalScenes,
    durationSec,
    shotFraming: scene?.cameraDirection,
    action:
      scene?.primaryChange ||
      scene?.action ||
      scene?.visualDescription ||
      scene?.startState ||
      scene?.scriptBeat,
    spokenLines: scene?.spokenLines || scene?.scriptSnippet,
    onScreenText: scene?.onScreenText,
    audio: scene?.audio,
    endPose: scene?.endState,
    characterName: isInsertOrSet ? undefined : characterName || "Host",
    characterStyle: isInsertOrSet
      ? "B-Roll / Cinematic Visual"
      : characterStyle || "Executive Presenter",
    environment,
    viralConcept: brief ? buildViralConceptDirective(brief) : undefined,
  })}`;

  return { prompt, compiler: "scene_motion" };
}
