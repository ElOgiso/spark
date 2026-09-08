/**
 * Scene Motion Lock — creative spine frozen when the storyboard still is locked.
 *
 * Law:
 *   Still / panel pixels own character, wardrobe, props, environment, lighting, composition.
 *   Motion compile keeps its powerful animate envelope, but must follow this lock —
 *   do not re-author look from free scene object text at I2V time.
 */

import {
  resolveDirectorSceneScript,
  type DirectorSceneScript,
} from "./directorScriptAuthority";

export const SCENE_MOTION_LOCK_VERSION = 1 as const;

export interface SceneMotionLock {
  version: typeof SCENE_MOTION_LOCK_VERSION;
  /** Visible body/camera action only — drives I2V Subject Action. */
  physicalAction: string;
  /** Camera framing / move intent. */
  cameraDirection: string;
  /** Audio-only spoken performance (never glyphs). */
  spokenLines: string;
  /** Readable end pose for the clip. */
  endPose: string;
  /** Where the first-frame still came from. */
  sourceStill:
    | "storyboard_panel"
    | "storyboard_panel_needs_fix"
    | "scene_still"
    | "revised_still"
    | "unknown";
  /** Visual genre frozen with the still. */
  visualGenre?: string;
  cinematicCraft?: boolean;
  /** Optional URL of the locked still when known. */
  stillUrl?: string;
  lockedAt: string;
  directorSource: DirectorSceneScript["source"];
  repaired: boolean;
}

export function isSceneMotionLock(value: unknown): value is SceneMotionLock {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === SCENE_MOTION_LOCK_VERSION &&
    typeof v.physicalAction === "string" &&
    v.physicalAction.trim().length >= 12 &&
    typeof v.cameraDirection === "string" &&
    typeof v.spokenLines === "string"
  );
}

/**
 * Build a motion lock from the director script at still/panel lock time.
 * Call once when scene.image is set; reuse at I2V so motion follows the board.
 */
export function buildSceneMotionLock(params: {
  scene: any;
  beat?: any;
  environment?: string;
  contentFormat?: string | null;
  sceneIndexZeroBased?: number;
  sourceStill?: SceneMotionLock["sourceStill"];
  stillUrl?: string | null;
  visualGenre?: string | null;
  cinematicCraft?: boolean;
}): SceneMotionLock {
  const scene = params.scene || {};
  const director = resolveDirectorSceneScript({
    scene,
    beat: params.beat,
    environment: params.environment,
    contentFormat: params.contentFormat,
    sceneIndexZeroBased: params.sceneIndexZeroBased,
  });

  const camera =
    String(scene.cameraDirection || scene.camera?.shotType || "").trim() ||
    "Medium dynamic shot";

  const endRaw = String(scene.endState || "").trim();
  const endPose =
    endRaw && !/host presents/i.test(endRaw)
      ? endRaw
      : "Hold a clear, readable end pose matching the physical action — same character, wardrobe, props, and set as IMAGE 1";

  const stillUrl =
    typeof params.stillUrl === "string" && params.stillUrl.trim()
      ? params.stillUrl.trim()
      : typeof scene.image === "string" && scene.image.trim()
        ? scene.image.trim()
        : typeof scene.keyframeImageUrl === "string" && scene.keyframeImageUrl.trim()
          ? scene.keyframeImageUrl.trim()
          : undefined;

  return {
    version: SCENE_MOTION_LOCK_VERSION,
    physicalAction: director.physicalAction,
    cameraDirection: camera,
    spokenLines: director.spokenLines,
    endPose,
    sourceStill: params.sourceStill || (scene.sourceStill as SceneMotionLock["sourceStill"]) || "unknown",
    visualGenre: params.visualGenre || scene.motionLock?.visualGenre || scene.visualGenre,
    cinematicCraft: params.cinematicCraft !== false,
    stillUrl,
    lockedAt: new Date().toISOString(),
    directorSource: director.source,
    repaired: director.repaired,
  };
}

/** Attach lock onto a mutable scene row (storyboard panel / still / revise). */
export function attachSceneMotionLock(
  scene: any,
  params: Omit<Parameters<typeof buildSceneMotionLock>[0], "scene"> & {
    scene?: any;
  } = {}
): SceneMotionLock {
  const lock = buildSceneMotionLock({
    ...params,
    scene: params.scene || scene,
  });
  scene.motionLock = lock;
  scene.physicalAction = lock.physicalAction;
  if (!scene.cameraDirection) scene.cameraDirection = lock.cameraDirection;
  return lock;
}

/**
 * Prefer persisted lock; else build (and optionally attach) from scene.
 * Pass forceRebuild to overwrite (e.g. after executive still revision).
 */
export function resolveSceneMotionLock(params: {
  scene: any;
  beat?: any;
  environment?: string;
  contentFormat?: string | null;
  sceneIndexZeroBased?: number;
  /** When true and lock missing, write lock onto scene. */
  attachIfMissing?: boolean;
  /** When true, always rebuild and overwrite scene.motionLock. */
  forceRebuild?: boolean;
  sourceStill?: SceneMotionLock["sourceStill"];
  stillUrl?: string | null;
}): { lock: SceneMotionLock; fromPersisted: boolean } {
  const scene = params.scene || {};
  if (!params.forceRebuild && isSceneMotionLock(scene.motionLock)) {
    return { lock: scene.motionLock, fromPersisted: true };
  }
  const lock = buildSceneMotionLock({
    scene,
    beat: params.beat,
    environment: params.environment,
    contentFormat: params.contentFormat,
    sceneIndexZeroBased: params.sceneIndexZeroBased,
    sourceStill: params.sourceStill,
    stillUrl: params.stillUrl,
  });
  if (params.forceRebuild || params.attachIfMissing !== false) {
    scene.motionLock = lock;
    if (!scene.physicalAction || params.forceRebuild) {
      scene.physicalAction = lock.physicalAction;
    }
  }
  return { lock, fromPersisted: false };
}

/** Bind the generated still URL onto an existing lock without re-resolving director. */
export function bindMotionLockStillUrl(scene: any, stillUrl: string): void {
  if (!stillUrl || typeof stillUrl !== "string") return;
  scene.image = scene.image || stillUrl;
  scene.keyframeImageUrl = scene.keyframeImageUrl || stillUrl;
  if (isSceneMotionLock(scene.motionLock)) {
    scene.motionLock = { ...scene.motionLock, stillUrl };
  }
}

/**
 * Hard visual laws for I2V when a storyboard still is the first frame.
 * Keeps motion power; forbids look rewrite.
 */
export function storyboardStillAnimateLaws(): string {
  return [
    "STORYBOARD STILL AUTHORITY (IMAGE 1):",
    "- IMAGE 1 is the locked storyboard / scene keyframe. Animate it to life — do NOT redesign the shot.",
    "- Character face, hair, skin, body, and wardrobe must remain identical to IMAGE 1 for the full clip.",
    "- Environment, set architecture, props, products, lighting, color grade, and depth of field must remain identical to IMAGE 1.",
    "- Do NOT invent new props, wardrobe, characters, locations, or background resets.",
    "- Text may only describe continuous physical action, camera motion, timing, and audio performance — never a new look.",
  ].join("\n");
}
