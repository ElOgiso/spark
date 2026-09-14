/**
 * SPARK Stage 3 — Structured Shot Direction Spec
 * Provider-agnostic director envelope for per-shot I2V motion compilation.
 * Bridges director authority, scene motion locks, and production elements.
 */

import type { ContentFormat, ProductionBrief } from "../../domain/types";
import type { DirectorSceneScript } from "./directorScriptAuthority";
import type { ProductionElement } from "./elements/productionElements";
import type { SceneMotionLock } from "./sceneMotionLock";

export interface ShotDirectionSpec {
  /** High-level scene narrative context (1–3 sentences) */
  sceneContext: string;
  /** Active element tags bound to this shot (e.g. ["@main_character", "@loc_cabin"]) */
  elementTags: string[];
  /** Optional geometry, axis, or spatial relationship map (one sentence) */
  locationMap?: string;
  /** Intent of the starting keyframe (must match the still, not redesign) */
  firstFrameIntent?: string;
  /** Shot format: continuous single shot or segment of a multishot */
  formatMode: "single_continuous" | "segment_of_multishot";
  /** Physical action of visible subjects (motion only) */
  action: string;
  /** Camera framing and camera move motivation */
  camera: string;
  /** Performance / spoken lines intent (audio only, never visual glyphs) */
  performance?: string;
  /** Environmental physics (cloth, smoke, water, hair, particle dynamics) */
  physics?: string;
  /** Optical lighting behavior during movement */
  lighting?: string;
  /** Diegetic audio intent (no score or background music) */
  audioDiegetic?: string;
  /** Positive production locks enforcing continuity and preventing artifacts */
  positiveLocks: string[];
  /** Duration in seconds snapped to provider constraints */
  durationSec?: number;
}

export interface DeriveShotDirectionParams {
  scene: any;
  sceneIndex: number;
  totalScenes: number;
  durationSec: number;
  motionLock?: SceneMotionLock | null;
  directorScript?: DirectorSceneScript | null;
  brief?: ProductionBrief | null;
  elements?: ProductionElement[] | null;
  isInsertOrSet?: boolean;
  characterName?: string;
  environment?: string;
  contentFormat?: ContentFormat | string | null;
  explicitSpec?: Partial<ShotDirectionSpec> | null;
}

/**
 * Strips subjective AI marketing filler from prompt strings.
 */
export function sanitizeMotionText(text?: string | null): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/\b(ultra[- ]?realistic|hyper[- ]?realistic|photorealistic|8k|4k|stunning|breathtaking|masterpiece|award[- ]?winning)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Derives a rich or thin ShotDirectionSpec from existing scene, motionLock, directorScript, and elements.
 * Never throws hard failures when optional fields are missing.
 */
export function deriveShotDirectionSpec(params: DeriveShotDirectionParams): ShotDirectionSpec {
  const {
    scene = {},
    sceneIndex,
    totalScenes,
    durationSec,
    motionLock,
    directorScript,
    brief,
    elements,
    isInsertOrSet = false,
    characterName,
    environment = "Studio Environment",
    explicitSpec,
  } = params;

  // 1. Scene Context (1–3 sentences)
  let context = explicitSpec?.sceneContext || scene.sceneContext || scene.purpose;
  if (!context || /host presents/i.test(context)) {
    const beat =
      brief?.beats && Array.isArray(brief.beats)
        ? brief.beats[Math.max(0, sceneIndex - 1)] || brief.beats[sceneIndex]
        : undefined;
    if ((beat as any)?.description) {
      context = (beat as any).description;
    } else if ((beat as any)?.purpose) {
      context = (beat as any).purpose;
    } else if (beat?.physicalAction) {
      context = beat.physicalAction;
    } else if (brief?.visualDirection) {
      context = brief.visualDirection;
    } else {
      context = `Scene ${sceneIndex} establishes ${
        isInsertOrSet ? "the environment and key visual focal elements" : characterName ? `${characterName}` : "the primary subject"
      } in ${environment}.`;
    }
  }
  context = sanitizeMotionText(String(context).trim());

  // 2. Element Tags
  let elementTags: string[] = [];
  if (explicitSpec?.elementTags && Array.isArray(explicitSpec.elementTags)) {
    elementTags = explicitSpec.elementTags;
  } else if (elements && elements.length > 0) {
    elementTags = elements.map((e) => e.tag);
  } else if (scene.elementTags && Array.isArray(scene.elementTags)) {
    elementTags = scene.elementTags;
  } else if (scene.neededTags && Array.isArray(scene.neededTags)) {
    elementTags = scene.neededTags;
  }

  // 3. Location Map
  const locationMap = explicitSpec?.locationMap || scene.locationMap || scene.spatialMap || scene.axis || undefined;

  // 4. First Frame Intent
  const firstFrameIntent =
    explicitSpec?.firstFrameIntent ||
    scene.firstFrameIntent ||
    "IMAGE 1 is the locked starting keyframe; animate physical action seamlessly without redesigning look or set geometry.";

  // 5. Format Mode
  const formatMode: "single_continuous" | "segment_of_multishot" =
    explicitSpec?.formatMode ||
    scene.formatMode ||
    (totalScenes > 1 ? "segment_of_multishot" : "single_continuous");

  // 6. Action (physical only)
  const rawAction =
    explicitSpec?.action ||
    motionLock?.physicalAction ||
    directorScript?.physicalAction ||
    scene.physicalAction ||
    scene.action ||
    "Subject performs a focused, continuous physical action motivated by the scene narrative.";
  const action = sanitizeMotionText(rawAction);

  // 7. Camera
  const rawCamera =
    explicitSpec?.camera ||
    motionLock?.cameraDirection ||
    scene.cameraDirection ||
    scene.camera?.shotType ||
    "Medium cinematic shot with motivated camera motion.";
  const camera = sanitizeMotionText(rawCamera);

  // 8. Performance (audio only)
  const rawSpeech =
    explicitSpec?.performance ||
    motionLock?.spokenLines ||
    directorScript?.spokenLines ||
    scene.spokenLines ||
    scene.performance;
  const performance = rawSpeech ? sanitizeMotionText(String(rawSpeech)) : undefined;

  // 9. Physics
  const rawPhysics = explicitSpec?.physics || scene.physics || scene.environmentalPhysics;
  const physics = rawPhysics ? sanitizeMotionText(String(rawPhysics)) : undefined;

  // 10. Lighting
  const rawLighting = explicitSpec?.lighting || scene.lighting || scene.lightingDirection;
  const lighting = rawLighting ? sanitizeMotionText(String(rawLighting)) : undefined;

  // 11. Diegetic Audio
  const audioDiegetic =
    explicitSpec?.audioDiegetic ||
    scene.audioDiegetic ||
    (scene.audio === "vo"
      ? "Clean visual motion leaving acoustic space for external voiceover bed; subtle diegetic foley."
      : "Diegetic natural sound, room acoustic ambience, subtle foley. No score or background music.");

  // 12. Positive Locks
  const positiveLocks: string[] = [
    `Headcount: exactly ${isInsertOrSet ? "0 on-screen human subjects (set / insert focus)" : "1 primary subject in frame"}`,
    "Direction Axis: maintain continuous spatial screen direction and eyeline throughout the shot",
    "Identity Lock: facial features, skin tone, hairstyle, and wardrobe match reference assets exactly",
    "First Frame Lock: preserve IMAGE 1 framing, lighting, set architecture, and color grading",
    "Clean Frame: no borders, no sheet edges, no multi-panel split, no text glyphs or subtitles",
    "Mouth Clean: no unnatural jaw morphing, glitch artifacts, or speech lip distortion",
  ];
  if (explicitSpec?.positiveLocks && Array.isArray(explicitSpec.positiveLocks)) {
    for (const lock of explicitSpec.positiveLocks) {
      if (!positiveLocks.includes(lock)) {
        positiveLocks.push(lock);
      }
    }
  }

  return {
    sceneContext: context,
    elementTags,
    locationMap,
    firstFrameIntent,
    formatMode,
    action,
    camera,
    performance,
    physics,
    lighting,
    audioDiegetic,
    positiveLocks,
    durationSec,
  };
}
