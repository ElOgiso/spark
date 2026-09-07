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
import type { Character, MemoryItem } from "../../domain/types";
import { buildViralConceptDirective } from "./productionPromptPacks";
import { listSpecShots } from "./productionMediaLineage";

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
}): string {
  const { resolvedSubject, character, activeChar } = params;
  if (resolvedSubject === "set") {
    return "SUBJECT & COMPOSITION: Empty or wide establishing architectural set / location environment. NO people, NO characters, NO faces. Room geometry, lighting, interior design, textures, and architecture only.";
  }
  if (resolvedSubject === "insert") {
    return "SUBJECT & COMPOSITION: Cinematic B-roll / Detail insert. NO host face required. Focus on hands, product, screen interface, conceptual data visualization, chart, or contextual cinematic detail illustrating the spoken lines. NO random or unprompted faces.";
  }
  if (resolvedSubject === "support") {
    return `SUBJECT & IDENTITY: Supporting subject "${activeChar?.name || "Support Character"}" (${activeChar?.style || "Supporting Role"}). Face, hairstyle, skin tone, and signature wardrobe must strictly match reference IMAGE 1. Character is clearly visible in frame performing this beat's action.`;
  }
  return `SUBJECT & IDENTITY: Primary host "${character?.name || "Host"}" (${character?.style || "Executive Presenter"}). Face, hairstyle, skin tone, and signature wardrobe must strictly match reference IMAGE 1. Host is clearly visible in frame performing this beat's action.`;
}

/** Map a live storyboard / production scene row into a panel spec for the OS frame compiler. */
export function panelSpecFromLiveScene(scene: any, idx: number): StoryboardPanelSpec {
  const sceneNum = Number(scene?.scene || scene?.index || idx + 1) || idx + 1;
  const action =
    scene?.visualDescription ||
    scene?.primaryChange ||
    scene?.startState ||
    scene?.action ||
    scene?.description ||
    "Host presents key insight";
  const spoken = scene?.spokenLines || scene?.scriptSnippet || "";
  const camera = scene?.cameraDirection || "Medium cinematic framing";
  return {
    panelId: scene?.panelId || `panel-${sceneNum}`,
    shotId: scene?.shotId || scene?.id || `shot-${sceneNum}`,
    sequenceIndex: sceneNum,
    purpose: scene?.purpose || spoken || action,
    dramaticBeat: spoken || action,
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
    startState: scene?.startState || action,
    endState: scene?.endState || action,
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
    rationale: [],
    confidence: 0.7,
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

  const laws = buildRankedBrandLaws(memoryItems).lawsBlock;
  const viral = brief ? buildViralConceptDirective(brief) : "";
  const styleSummary = [
    laws ? `BRAND LAWS:\n${laws}` : "",
    viral || "",
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
        const compiled =
          (shot as any).compiledPrompt ||
          compileShotPrompt(spec, sc as SceneSpec, shot as ShotSpec).prompt;
        const prompt = [
          refPromptHeader,
          styleSummary,
          compiled,
          "Generate a SINGLE clean cinematic still frame (not a multi-panel sheet).",
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
        const compiled =
          shot.compiledPrompt ||
          compileShotPrompt(spec, sc as SceneSpec, shot as ShotSpec).prompt;
        const prompt = [
          refPromptHeader,
          styleSummary,
          compiled,
          "Generate a SINGLE clean cinematic still frame (not a multi-panel sheet).",
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
