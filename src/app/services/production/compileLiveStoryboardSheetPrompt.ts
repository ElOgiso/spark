/**
 * Live multi-panel storyboard sheet compiler.
 * Converts finalized text panels into ONE sequential storyboard sheet image prompt.
 * Each panel on the sheet IS the scene still (cropped for I2V) — not a throwaway blueprint.
 * Reuses OS layout packing + sheet image compiler.
 */

import {
  chooseStoryboardLayout,
  compileStoryboardImagePrompt,
  packStoryboardSheets,
} from "./preproduction/storyboardBlueprint";
import type { StoryboardBlueprint, StoryboardLayout } from "./preproduction/types";
import { panelSpecFromLiveScene } from "./compileLiveStillPrompt";
import {
  contentFormatDirective,
  normalizeCanonicalContentFormat,
} from "./contentFormatDirectives";

/** Cap for a single overview sheet (4×4). Longer boards still pack chronologically. */
export const LIVE_STORYBOARD_SHEET_MAX_PANELS = 16;

export function compileLiveStoryboardSheetPrompt(params: {
  scenes: any[];
  aspectRatio: string;
  productionId?: string;
  brandName?: string;
  environment?: string;
  styleLook?: string;
  contentFormat?: string | null;
}): {
  prompt: string;
  layout: StoryboardLayout;
  panelCount: number;
  sheetLabel: string;
  compiler: "live_storyboard_sheet";
} {
  const aspectRatio = params.aspectRatio || "9:16";
  const rawScenes = Array.isArray(params.scenes) ? params.scenes : [];
  const scenes = rawScenes.slice(0, LIVE_STORYBOARD_SHEET_MAX_PANELS);
  const format = normalizeCanonicalContentFormat(params.contentFormat);
  const formatLaw = contentFormatDirective(format);

  const panels = scenes.map((scene, i) => {
    const panel = panelSpecFromLiveScene(scene, i);
    return {
      ...panel,
      sequenceIndex: i,
      panelId: panel.panelId || `panel_${String(i + 1).padStart(2, "0")}`,
      shotId: panel.shotId || `shot_${String(i + 1).padStart(2, "0")}`,
    };
  });

  const layout = chooseStoryboardLayout(Math.max(panels.length, 1), aspectRatio);
  const sheets = packStoryboardSheets({
    panels: panels.map((p) => ({
      panelId: p.panelId,
      shotId: p.shotId,
      sequenceIndex: p.sequenceIndex,
    })),
    aspectRatio,
    maxPanelsPerSheet: Math.max(panels.length, 1),
  });

  const panelToShotMap: Record<string, string> = {};
  for (const p of panels) panelToShotMap[p.panelId] = p.shotId;

  const blueprint: StoryboardBlueprint = {
    id: `live_sheet_${params.productionId || "prod"}`,
    productionId: params.productionId || "live",
    sceneId: "live_sequence",
    sequenceId: "live_sequence",
    aspectRatio,
    layout,
    sheets,
    panels,
    panelToShotMap,
    coveragePlan: `Live overview sheet — ${panels.length} chronological story beats`,
    continuityState: {
      handoffs: panels.map((p) => ({
        panelId: p.panelId,
        incoming: p.incomingState,
        outgoing: p.outgoingState,
      })),
    },
    referenceManifest: {
      id: "live_sheet_refs",
      productionId: params.productionId || "live",
      references: [],
      priorityOrder: [
        "character_contract",
        "location_contract",
        "storyboard_composition",
        "visual_treatment",
      ],
      conflicts: [],
      version: 1,
    },
    validation: { ok: true, issues: [] },
    version: 1,
    status: "draft",
    visualLock: false,
    mode: "previs",
  };

  const core = compileStoryboardImagePrompt(blueprint, {
    look:
      params.styleLook ||
      (format === "anime"
        ? "anime sequential storyboard sheet"
        : format === "faceless"
          ? "faceless VO B-roll sequential storyboard"
          : "cinematic sequential storyboard"),
    colorLanguage: undefined,
  } as any);

  const laws = [
    "You are an expert storyboard director and visual continuity supervisor.",
    formatLaw,
    "Generate ONE multi-panel storyboard SHEET image (not a single hero still).",
    `Layout: ${layout} with exactly ${panels.length} sequential panels in reading order.`,
    "Preserve exact narrative chronology. Each panel is a meaningful story beat.",
    format === "faceless"
      ? "Prefer B-roll / product / environment panels. Do not invent a host face."
      : "Maintain identical character appearance, wardrobe, props, and environment across panels when characters appear.",
    "Clear panel separation, sequential numbering when possible, readable action.",
    "Do not invent unrequested characters. Do not change locations without narrative justification.",
    "Each panel IS the scene still — panels will be cropped 1:1 for motion/I2V. Fill every panel with a complete frame.",
    "NO burned-in marketing copy, NO subtitles, NO logos unless part of the set.",
    params.brandName ? `Brand / series context: ${params.brandName}.` : "",
    params.environment ? `Locked environment: ${params.environment}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const sheetLabel =
    sheets[0]?.rangeLabel ||
    (panels.length <= 1 ? "Shot 01" : `Shots 01–${String(panels.length).padStart(2, "0")}`);

  return {
    prompt: `${laws}\n\n${core}`,
    layout,
    panelCount: panels.length,
    sheetLabel,
    compiler: "live_storyboard_sheet",
  };
}

/** True when storyboardGridUrl is a real multi-panel sheet (not a mislabeled first still). */
export function isRealStoryboardSheetUrl(params: {
  storyboardGridUrl?: string | null;
  firstStillUrl?: string | null;
}): boolean {
  const grid = typeof params.storyboardGridUrl === "string" ? params.storyboardGridUrl.trim() : "";
  if (!grid || grid.length < 8) return false;
  const first = typeof params.firstStillUrl === "string" ? params.firstStillUrl.trim() : "";
  // If grid equals first still, it was the old mislabel — treat as not a real sheet
  if (first && grid === first) return false;
  return true;
}
