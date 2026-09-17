import type { ProductionLookLaw } from "./productionLookLaw";
import { assertLookLawInPrompt } from "./productionLookLaw";
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
import {
  formatElementBindingHeader,
  type ProductionElement,
} from "./elements/productionElements";
import {
  deriveShotDirectionSpec,
  type ShotDirectionSpec,
} from "./shotDirectionSpec";

export function compileLiveMotionPrompt(params: {
  lookLaw?: ProductionLookLaw;
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
  /** Optional production elements for machine-readable ELEMENT BINDING header */
  elements?: ProductionElement[];
  /** Optional Stage 3 explicit shot direction specification */
  shotDirection?: Partial<ShotDirectionSpec>;
}): {
  prompt: string;
  compiler: "scene_motion";
  directorScript: ReturnType<typeof resolveDirectorSceneScript>;
  motionLock: SceneMotionLock;
  fromPersistedLock: boolean;
  shotDirection: ShotDirectionSpec;
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

  const shotDirection = deriveShotDirectionSpec({
    scene,
    sceneIndex,
    totalScenes,
    durationSec,
    motionLock,
    directorScript,
    brief,
    elements: params.elements,
    isInsertOrSet,
    characterName,
    environment,
    contentFormat: format,
    explicitSpec: params.shotDirection,
  });

  const bindingBlock =
    params.elements && params.elements.length > 0
      ? formatElementBindingHeader(params.elements)
      : [
          "ELEMENT BINDING:",
          ...refLabels.filter((l) => !l.startsWith("INPUT REF [1]")),
          "IMAGE 1 = this shot’s storyboard still (first frame). Animate only. Do not restyle.",
        ]
          .filter(Boolean)
          .join("\n");

  const locationMapSection = shotDirection.locationMap
    ? `LOCATION MAP: ${shotDirection.locationMap}`
    : "";

  const formatSection =
    shotDirection.formatMode === "single_continuous"
      ? "FORMAT: single continuous clip; no internal cuts."
      : "FORMAT: this clip is one segment of a multishot; no internal cuts.";

  const actionSection = `ACTION: ${shotDirection.action}`;
  const cameraSection = shotDirection.cameraCraft
    ? `CAMERA: ${shotDirection.camera} [Craft Execution: ${shotDirection.cameraCraft}]`
    : `CAMERA: ${shotDirection.camera}`;
  const performanceSection = shotDirection.performance
    ? `PERFORMANCE (AUDIO ONLY — never draw text): natural lip/body sync for intent «${shotDirection.performance.replace(/"/g, "'")}».`
    : "";
  const physicsSection = shotDirection.physics
    ? `PHYSICS: ${shotDirection.physics}`
    : "";
  const lightingSection = shotDirection.lighting
    ? `LIGHTING: ${shotDirection.lighting}`
    : "";
  const audioSection = `AUDIO: ${shotDirection.audioDiegetic || "diegetic only; no score/music."}`;

  const positiveLocksSection = [
    "POSITIVE LOCKS:",
    ...shotDirection.positiveLocks.map((l) => `- ${l}`),
  ].join("\n");

  const stage3Envelope = [
    `SCENE CONTEXT: ${shotDirection.sceneContext}`,
    locationMapSection,
    formatSection,
    actionSection,
    cameraSection,
    performanceSection,
    physicsSection,
    lightingSection,
    audioSection,
    positiveLocksSection,
  ]
    .filter(Boolean)
    .join("\n");

  const refHeader = [
    contentFormatDirective(format),
    genreLaw,
    bindingBlock,
    ...refLabels,
    stage3Envelope,
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
    shotDirection,
  };
}
