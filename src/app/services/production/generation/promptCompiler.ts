/**
 * Prompt compiler — ProductionSpec/ShotSpec → provider-specific generation instructions.
 * The detailed prompt is an OUTPUT of Spark, not the production brain.
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { SceneSpec } from "../specification/sceneSpec";
import type { ShotSpec } from "../specification/shotSpec";
import { VIDEO_NEGATIVE_LAWS } from "../productionPromptPacks";
import { COMPILER_VERSION } from "../specification/adapters";

export interface CompiledShotPrompt {
  shotId: string;
  provider: string;
  prompt: string;
  negativePrompt: string;
  strategy: string;
}

function characterBlock(spec: ProductionSpec, shot: ShotSpec): string {
  const chars = spec.characters.filter((c) =>
    shot.characterIds.includes(c.identity.ref) || shot.characterIds.includes(c.identity.baseId)
  );
  if (!chars.length) return "";
  return chars
    .map((c) => {
      const traits = c.visualAttributes.definingCharacteristics.join(", ");
      return `CHARACTER LOCK ${c.identity.ref}: ${c.name}. ${c.description}. ${traits ? `Traits: ${traits}.` : ""} ${c.wardrobeState?.description ? `Wardrobe: ${c.wardrobeState.description}.` : ""} Use approved references only; no identity drift.`;
    })
    .join("\n");
}

export function compileShotPrompt(spec: ProductionSpec, scene: SceneSpec, shot: ShotSpec): CompiledShotPrompt {
  const provider = shot.provider || "gemini";
  const char = characterBlock(spec, shot);
  const motion = [
    `BEGIN STATE: ${shot.motion.beginState}`,
    `ACTION: ${shot.motion.subjectMovement}`,
    `CAMERA MOVE: ${shot.motion.cameraMovementDetail}`,
    shot.motion.environmentalMovement ? `ENV MOVE: ${shot.motion.environmentalMovement}` : "",
    `END STATE: ${shot.motion.endState}`,
  ]
    .filter(Boolean)
    .join("\n");

  const camera = `CAMERA: ${shot.camera.shotType}; ${shot.camera.framing}; lens ${shot.camera.lens || "prime"}; move ${shot.camera.cameraMovement}; focus ${shot.camera.focus || "subject"}`;
  const light = `LIGHTING: ${[shot.lighting.direction, shot.lighting.intensity, shot.lighting.color, shot.lighting.timeOfDay].filter(Boolean).join("; ")}`;

  const base = [
    `PRODUCTION: ${spec.project.title} | GENRE: ${spec.creative.genre} | STYLE: ${spec.visualStyle.look}`,
    `SCENE ${scene.index + 1} (${scene.narrativeFunction}): ${scene.purpose}`,
    `SHOT ${shot.index + 1} PURPOSE: ${shot.purpose}`,
    `WHY: ${shot.productionReason}`,
    char,
    `SUBJECT: ${shot.subject}`,
    `ENVIRONMENT: ${shot.environment}`,
    camera,
    light,
    motion,
    shot.narration ? `NARRATION CONTEXT (do not render as on-screen text): ${shot.narration}` : "",
    shot.dialogue ? `DIALOGUE PERFORMANCE: ${shot.dialogue}` : "",
    `CONTINUITY: ${shot.continuityRequirements.join(" | ")}`,
    `ASPECT: ${shot.aspectRatio || spec.project.aspectRatio} | DURATION: ${shot.durationSec}s`,
    `ANTI-SLOP: ${spec.visualStyle.antiSlopLaws.slice(0, 4).join(" ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Provider-specific shaping
  let prompt = base;
  if (provider === "kling" || provider === "seedance") {
    prompt = `${base}\nCONDITIONING: Prefer first-frame (and last-frame when supplied) continuity. Single primary action only.`;
  } else if (provider === "grok") {
    prompt = `${base}\nCONDITIONING: Start-frame locked; maintain face references; audio-capable motion.`;
  } else if (provider === "runway") {
    prompt = `${base}\nCAMERA CONTROL: Emphasize explicit camera move; cinematic motion.`;
  } else if (shot.generationStrategy === "slideshow_still" || shot.generationStrategy === "text_to_image") {
    prompt = `${base}\nSTILL: Single decisive frame; no burned-in text; identity locked to references.`;
  }

  return {
    shotId: shot.id,
    provider,
    prompt,
    negativePrompt: VIDEO_NEGATIVE_LAWS,
    strategy: shot.generationStrategy,
  };
}

export function compileProductionPrompts(spec: ProductionSpec): ProductionSpec {
  const scenes = spec.scenes.map((scene) => ({
    ...scene,
    shots: scene.shots.map((shot) => {
      const compiled = compileShotPrompt(spec, scene, shot);
      return {
        ...shot,
        compiledPrompt: compiled.prompt,
        compiledNegativePrompt: compiled.negativePrompt,
        observability: {
          ...(shot.observability || {}),
          productionId: spec.project.id,
          promptCompilerVersion: COMPILER_VERSION,
        },
      };
    }),
  }));
  return { ...spec, scenes };
}
