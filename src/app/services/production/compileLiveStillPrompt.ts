/**
 * Live still prompt compiler — OS spine entry for pixel generation.
 * Prefer Spec shot compiled prompts; else StoryboardPanelSpec compiler;
 * never invent a parallel "inline AssetService" creative brain.
 */

import { compileIndividualStoryboardFramePrompt } from "./preproduction/storyboardFrame";
import type { StoryboardPanelSpec } from "./preproduction/types";
import { compileShotPrompt } from "./generation/promptCompiler";
import type { ProductionSpec, SceneSpec } from "./specification/productionSpec";
import type { ShotSpec } from "./specification/shotSpec";
import { buildRankedBrandLaws } from "../memory/rankBrandLaws";
import type { Character, ContentFormat, MemoryItem } from "../../domain/types";
import { stillMediumLockLine, isVisualGenreId, type VisualGenreId } from "../../domain/visualGenre";
import { listSpecShots } from "./productionMediaLineage";
import {
  contentFormatDirective,
  formatSubjectRoleLabel,
  normalizeCanonicalContentFormat,
  resolveProductionContentFormat,
} from "./contentFormatDirectives";
import { resolveDirectorSceneScript } from "./directorScriptAuthority";
import { isSceneMotionLock } from "./sceneMotionLock";
import {
  directorStillLookLaws,
  resolveLiveVisualGenre,
  visualGenreDirective,
  cinematicCraftEnabled,
} from "./visualGenreDirectives";

function emptyHandoff() {
  return {
    wardrobe: [] as string[],
    propsHeld: [] as string[],
    lighting: "",
    subjectPosition: "",
    notes: [] as string[],
  };
}

/** Subject lock line for stills — lives in the OS compiler, not AssetService. */
export function buildStillSubjectLine(params: {
  resolvedSubject: "main" | "support" | "insert" | "set" | string;
  character?: Character | null;
  activeChar?: Character | null;
  contentFormat?: ContentFormat | string | null;
  visualGenre?: VisualGenreId | string | null;
}): string {
  const { resolvedSubject, character, activeChar } = params;
  const format = normalizeCanonicalContentFormat(params.contentFormat);
  if (resolvedSubject === "set") {
    return "SUBJECT & COMPOSITION: Empty or wide establishing architectural set / location environment. NO people, NO characters, NO faces. Room geometry, lighting, interior design, textures, and architecture only.";
  }
  if (resolvedSubject === "insert") {
    return "SUBJECT & COMPOSITION: Cinematic B-roll / Detail insert. NO host face required. Focus on hands, product, screen interface, conceptual data visualization, chart, or contextual cinematic detail illustrating the spoken lines. NO random or unprompted faces.";
  }
  if (resolvedSubject === "support") {
    return `SUBJECT & IDENTITY: Supporting subject "${activeChar?.name || "Support Character"}" (${activeChar?.style || "Supporting Role"}). Face, hairstyle, skin tone, and signature wardrobe must strictly match reference IMAGE 1. Character is clearly visible in frame performing this beat's action.`;
  }
  const labels = formatSubjectRoleLabel(format, "main");
  const name = character?.name || labels.nameFallback;
  const style = character?.style || labels.styleFallback;
  const genreId: VisualGenreId = isVisualGenreId(params.visualGenre)
    ? params.visualGenre
    : format === "anime"
      ? "anime"
      : "cinematic";
  const medium = stillMediumLockLine(genreId);
  return `SUBJECT & IDENTITY: ${labels.roleLine} "${name}" (${style}). Face, hairstyle, skin tone, and signature wardrobe must strictly match reference IMAGE 1. Subject is clearly visible in frame performing this beat's action.${medium}`;
}

/** Map a live storyboard / production scene row into a panel spec for the OS frame compiler. */
export function panelSpecFromLiveScene(scene: any, idx: number): StoryboardPanelSpec {
  const sceneNum = Number(scene?.scene || scene?.index || idx + 1) || idx + 1;
  const lock = isSceneMotionLock(scene?.motionLock) ? scene.motionLock : null;
  const director = resolveDirectorSceneScript({
    scene,
    sceneIndexZeroBased: idx,
  });
  // Frozen lock wins; else director physicalAction — never spoken dialogue / valueJob as the picture
  const action = lock?.physicalAction || director.physicalAction;
  const spoken = lock?.spokenLines || director.spokenLines;
  const camera =
    lock?.cameraDirection ||
    scene?.cameraDirection ||
    "Medium cinematic framing";
  return {
    panelId: scene?.panelId || `panel-${sceneNum}`,
    shotId: scene?.shotId || scene?.id || `shot-${sceneNum}`,
    sequenceIndex: sceneNum,
    purpose: scene?.purpose && !/host presents|open with a strong hook/i.test(String(scene.purpose))
      ? scene.purpose
      : action,
    dramaticBeat: action,
    visualObjective: action,
    editorialRole: scene?.editorialRole || "beat",
    composition: camera,
    framing: camera,
    camera: {
      shotType: camera,
      position: "eye-level",
      movement: "static or subtle push",
      lensIntent: "cinematic prime",
      depthOfField: "shallow subject separation",
    },
    characters: Array.isArray(scene?.characters) ? scene.characters : [],
    locations: Array.isArray(scene?.locations) ? scene.locations : [],
    props: Array.isArray(scene?.props) ? scene.props : [],
    products: Array.isArray(scene?.products) ? scene.products : [],
    blocking: action,
    subjectAction: action,
    environmentAction: scene?.environmentAction || "Locked set continuity",
    lightingIntent: scene?.lightingIntent || "High-contrast cinematic lighting",
    temporalBeat: {
      startSec: 0,
      endSec: Number(scene?.durationSec) || 5,
      pace: "medium",
    },
    startState: (!scene?.startState || /host presents/i.test(String(scene.startState))
      ? action
      : scene.startState),
    endState: (!scene?.endState || /host presents/i.test(String(scene.endState))
      ? action
      : scene.endState),
    incomingState: emptyHandoff(),
    outgoingState: emptyHandoff(),
    referenceRequirements: [],
    referenceAssignments: [],
    continuityRequirements: [],
    generationIntent: {
      appearanceLocked: true,
      compositionFromPanel: true,
      motionFromShotSpec: true,
      mode: "final",
    },
    rationale: spoken ? [`Spoken (audio only): ${spoken}`] : [],
    confidence: director.repaired ? 0.55 : 0.75,
    validationIssues: [],
  };
}

export function compileLiveStillPrompt(params: {
  scene: any;
  sceneIndexZeroBased: number;
  aspectRatio: string;
  production?: any;
  brief?: any;
  memoryItems?: MemoryItem[];
  refPromptHeader?: string;
  subjectLine?: string;
  contentFormat?: ContentFormat | string | null;
}): { prompt: string; shotId?: string; compiler: "spec_shot" | "storyboard_frame" } {
  const {
    scene,
    sceneIndexZeroBased,
    aspectRatio,
    production,
    brief,
    memoryItems = [],
    refPromptHeader = "",
    subjectLine = "",
  } = params;

  const format = resolveProductionContentFormat({
    production,
    brief,
    formatSettings: params.contentFormat
      ? { contentFormat: params.contentFormat }
      : production?.formatSettings || brief?.formatSettings,
    settingsSnapshot: production?.reasoning?.settingsSnapshot,
    specMeta: production?.reasoning?.productionSpec?.meta,
  });
  const formatLaw = contentFormatDirective(format);
  const visualGenre = resolveLiveVisualGenre({
    formatSettings: brief?.formatSettings || production?.formatSettings,
    contentFormat: format,
    production,
    brief,
  });
  const cinematicCraft = cinematicCraftEnabled(
    production?.reasoning?.settingsSnapshot?.formatSettings ||
      brief?.formatSettings ||
      production?.formatSettings
  );
  const genreLaw = visualGenreDirective({ visualGenre, cinematicCraft });

  const lock = isSceneMotionLock(scene?.motionLock)
    ? scene.motionLock
    : null;
  const director = resolveDirectorSceneScript({
    scene,
    sceneIndexZeroBased,
  });
  const physicalAction = lock?.physicalAction || director.physicalAction;
  const cameraDirection =
    lock?.cameraDirection || scene?.cameraDirection || "Medium cinematic framing";
  const directorLockLaws = directorStillLookLaws({
    physicalAction,
    cameraDirection,
    visualGenre,
    cinematicCraft,
  });

function cleanStillCompiledPrompt(compiled: string): string {
  return compiled
    .split("\n")
    .filter((line) => {
      const l = line.trim();
      if (!l) return false;
      if (/^(SCENE\s*\(|SHOT PURPOSE:|WHY:|DIALOGUE PERFORMANCE:|NARRATION CONTEXT)/i.test(l)) {
        return false;
      }
      return true;
    })
    .join("\n");
}

  const styleSummary = [
    formatLaw,
    genreLaw,
    directorLockLaws,
    subjectLine || "",
  ]
    .filter(Boolean)
    .join("\n");

  const shotId = scene?.shotId || scene?.id;
  const spec: ProductionSpec | undefined =
    production?.reasoning?.productionSpec || production?.productionSpec;
  if (spec && shotId) {
    for (const sc of spec.scenes || []) {
      const shot = (sc.shots || []).find(
        (s: ShotSpec) => s.id === shotId || (s as any).shotId === shotId
      );
      if (shot) {
        const rawCompiled =
          (shot as any).compiledPrompt ||
          compileShotPrompt(spec, sc as SceneSpec, shot as ShotSpec).prompt;
        const compiled = cleanStillCompiledPrompt(rawCompiled);
        const prompt = [
          refPromptHeader,
          styleSummary,
          compiled,
          "PHYSICAL ACTION in DIRECTOR STILL LOCK overrides any narrative notes for the picture.",
          "Generate a SINGLE clean still frame (not a multi-panel sheet).",
          "NO TEXT, NO LETTERS, NO CAPTIONS on image. Full-bleed only.",
          `Aspect ratio: ${aspectRatio}.`,
        ]
          .filter(Boolean)
          .join("\n");
        return { prompt, shotId: shot.id, compiler: "spec_shot" };
      }
    }
  }

  // Spec ordinal fallback
  if (spec) {
    const flat = listSpecShots(production);
    const shot = flat[sceneIndexZeroBased];
    if (shot) {
      const sc = (spec.scenes || []).find((s: any) =>
        (s.shots || []).some((x: any) => x.id === shot.id)
      );
      if (sc) {
        const rawCompiled =
          shot.compiledPrompt ||
          compileShotPrompt(spec, sc as SceneSpec, shot as ShotSpec).prompt;
        const compiled = cleanStillCompiledPrompt(rawCompiled);
        const prompt = [
          refPromptHeader,
          styleSummary,
          compiled,
          "PHYSICAL ACTION in DIRECTOR STILL LOCK overrides any narrative notes for the picture.",
          "Generate a SINGLE clean still frame (not a multi-panel sheet).",
          "NO TEXT, NO LETTERS, NO CAPTIONS on image. Full-bleed only.",
          `Aspect ratio: ${aspectRatio}.`,
        ]
          .filter(Boolean)
          .join("\n");
        return { prompt, shotId: shot.id, compiler: "spec_shot" };
      }
    }
  }

  const panel = panelSpecFromLiveScene(scene, sceneIndexZeroBased);
  const framePrompt = compileIndividualStoryboardFramePrompt({
    panel,
    aspectRatio,
    styleSummary,
  });
  const prompt = [refPromptHeader, framePrompt].filter(Boolean).join("\n");
  return { prompt, shotId: panel.shotId, compiler: "storyboard_frame" };
}
