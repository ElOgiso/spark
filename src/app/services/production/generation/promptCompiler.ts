/**
 * Prompt compiler — structured semantic + cinematic intermediates → provider compilation.
 * Prompt packs are outputs, not the production brain.
 * Avoids generic filler (beautiful/stunning/epic/masterpiece).
 */

import type { ProductionSpec } from "../specification/productionSpec";
import type { SceneSpec } from "../specification/sceneSpec";
import type { ShotSpec } from "../specification/shotSpec";
import { VIDEO_NEGATIVE_LAWS } from "../productionPromptPacks";
import { COMPILER_VERSION } from "../specification/adapters";

export interface SemanticPromptLayer {
  productionTitle: string;
  genre: string;
  scenePurpose: string;
  narrativeFunction: string;
  shotPurpose: string;
  productionReason: string;
  subject: string;
  subjectAction: string;
  environment: string;
  dialogue?: string;
  narration?: string;
  continuity: string[];
  masterAssetRefs: string[];
}

export interface CinematicPromptLayer {
  shotType: string;
  framing: string;
  composition: string;
  cameraPosition: string;
  cameraMovement: string;
  lens?: string;
  depthOfField?: string;
  focus?: string;
  lighting: string;
  atmosphere?: string;
  beginState: string;
  endState: string;
  cameraMoveDetail: string;
  performance?: string;
  blocking?: string;
}

export interface CompiledShotPrompt {
  shotId: string;
  provider: string;
  strategy: string;
  semantic: SemanticPromptLayer;
  cinematic: CinematicPromptLayer;
  /** Provider-shaped final instruction string */
  prompt: string;
  negativePrompt: string;
}

const BANNED_FILLER = /\b(beautiful|stunning|epic|masterpiece|ultra[- ]detailed|breathtaking)\b/gi;

function stripFiller(text: string): string {
  return text.replace(BANNED_FILLER, "").replace(/\s{2,}/g, " ").trim();
}

function characterBlock(spec: ProductionSpec, shot: ShotSpec): string {
  const chars = spec.characters.filter(
    (c) =>
      shot.characterIds.includes(c.identity.ref) || shot.characterIds.includes(c.identity.baseId)
  );
  if (!chars.length) return "";
  return chars
    .map((c) => {
      const traits = c.visualAttributes.definingCharacteristics.join(", ");
      return `CHARACTER LOCK ${c.identity.ref}: ${c.name}. ${c.description}. ${
        traits ? `Traits: ${traits}.` : ""
      } ${c.wardrobeState?.description ? `Wardrobe: ${c.wardrobeState.description}.` : ""} Use approved references only; no identity drift.`;
    })
    .join("\n");
}

export function buildSemanticLayer(
  spec: ProductionSpec,
  scene: SceneSpec,
  shot: ShotSpec
): SemanticPromptLayer {
  return {
    productionTitle: spec.project.title,
    genre: spec.creative.genre,
    scenePurpose: scene.purpose,
    narrativeFunction: scene.narrativeFunction,
    shotPurpose: shot.purpose,
    productionReason: shot.productionReason,
    subject: shot.subject,
    subjectAction: shot.subjectAction,
    environment: shot.environment,
    dialogue: shot.dialogue,
    narration: shot.narration,
    continuity: shot.continuityRequirements,
    masterAssetRefs: [
      ...shot.references.characterRefs,
      ...shot.references.locationRefs,
      ...shot.references.styleRefs,
    ],
  };
}

export function buildCinematicLayer(shot: ShotSpec): CinematicPromptLayer {
  const cine = shot.cinematic;
  return {
    shotType: String(shot.camera.shotType),
    framing: shot.camera.framing,
    composition: shot.camera.composition,
    cameraPosition: shot.camera.cameraPosition,
    cameraMovement: String(shot.camera.cameraMovement),
    lens: shot.camera.lens,
    depthOfField: shot.camera.depthOfField,
    focus: shot.camera.focus,
    lighting: [shot.lighting.direction, shot.lighting.intensity, shot.lighting.color, shot.lighting.timeOfDay]
      .filter(Boolean)
      .join("; "),
    atmosphere: shot.atmosphere || shot.lighting.atmosphere,
    beginState: shot.motion.beginState,
    endState: shot.motion.endState,
    cameraMoveDetail: cine?.rationale.movement || shot.motion.cameraMovementDetail,
    // Phase 5: keep provider prompt lean — only compile relevant cinematic intent
    performance: shot.performanceDirection || shot.motion.performanceDirection,
    blocking: shot.blocking,
  };
}

function compileProviderPrompt(
  provider: string,
  strategy: string,
  semantic: SemanticPromptLayer,
  cinematic: CinematicPromptLayer,
  spec: ProductionSpec,
  shot: ShotSpec
): string {
  const char = characterBlock(spec, shot);
  const base = [
    `PRODUCTION: ${semantic.productionTitle} | GENRE: ${semantic.genre} | STYLE: ${spec.visualStyle.look}`,
    `SCENE (${semantic.narrativeFunction}): ${semantic.scenePurpose}`,
    `SHOT PURPOSE: ${semantic.shotPurpose}` + (shot.cinematic ? ` | DRAMATIC: ${shot.cinematic.dramaticPurpose} | MOVE WHY: ${shot.cinematic.rationale.movement}` : ""),
    `WHY: ${semantic.productionReason}`,
    char,
    `SUBJECT: ${semantic.subject}`,
    `ACTION: ${semantic.subjectAction}`,
    `ENVIRONMENT: ${semantic.environment}`,
    `CAMERA: ${cinematic.shotType}; ${cinematic.framing}; ${cinematic.composition}; position ${cinematic.cameraPosition}; lens ${cinematic.lens || "prime"}; move ${cinematic.cameraMovement}; DOF ${cinematic.depthOfField || "natural"}; focus ${cinematic.focus || "subject"}`,
    `LIGHTING: ${cinematic.lighting}`,
    cinematic.atmosphere ? `ATMOSPHERE: ${cinematic.atmosphere}` : "",
    cinematic.blocking ? `BLOCKING: ${cinematic.blocking}` : "",
    cinematic.performance ? `PERFORMANCE: ${cinematic.performance}` : "",
    `BEGIN STATE: ${cinematic.beginState}`,
    `CAMERA MOVE: ${cinematic.cameraMoveDetail}`,
    `END STATE: ${cinematic.endState}`,
    semantic.narration ? `NARRATION CONTEXT (do not burn as on-screen text): ${semantic.narration}` : "",
    semantic.dialogue ? `DIALOGUE PERFORMANCE: ${semantic.dialogue}` : "",
    semantic.masterAssetRefs.length
      ? `MASTER ASSET REFS: ${semantic.masterAssetRefs.join(", ")}`
      : "",
    `CONTINUITY: ${semantic.continuity.join(" | ")}`,
    `ASPECT: ${shot.aspectRatio || spec.project.aspectRatio} | DURATION: ${shot.durationSec}s`,
    `ANTI-SLOP: ${spec.visualStyle.antiSlopLaws.slice(0, 4).join(" ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  let prompt = base;
  if (provider === "kling" || provider === "seedance") {
    prompt = `${base}\nCONDITIONING: Prefer first-frame (and last-frame when supplied) continuity. Single primary action only.`;
  } else if (provider === "grok") {
    prompt = `${base}\nCONDITIONING: Start-frame locked; maintain face references; audio-capable motion.`;
  } else if (provider === "runway") {
    prompt = `${base}\nCAMERA CONTROL: Emphasize explicit camera move; single coherent motion path.`;
  } else if (provider === "luma") {
    prompt = `${base}\nCONDITIONING: First-frame continuity; natural motion only.`;
  } else if (provider === "higgsfield") {
    prompt = `${base}\nCONDITIONING: Stylized motion consistent with visual language; no identity drift.`;
  } else if (strategy === "slideshow_still" || strategy === "text_to_image") {
    prompt = `${base}\nSTILL: Single decisive frame; no burned-in text; identity locked to references.`;
  } else if (provider === "gemini") {
    prompt = `${base}\nCONDITIONING: First-frame aware motion; keep wardrobe and set locked.`;
  }

  return stripFiller(prompt);
}

export function compileShotPrompt(
  spec: ProductionSpec,
  scene: SceneSpec,
  shot: ShotSpec
): CompiledShotPrompt {
  const provider = shot.provider || "gemini";
  const semantic = buildSemanticLayer(spec, scene, shot);
  const cinematic = buildCinematicLayer(shot);
  const prompt = compileProviderPrompt(
    provider,
    shot.generationStrategy,
    semantic,
    cinematic,
    spec,
    shot
  );

  return {
    shotId: shot.id,
    provider,
    strategy: shot.generationStrategy,
    semantic,
    cinematic,
    prompt,
    negativePrompt: VIDEO_NEGATIVE_LAWS,
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
