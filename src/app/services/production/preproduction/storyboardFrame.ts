/**
 * Storyboard Frame Asset — individual clean panel frames for generation.
 *
 * Distinctions (do not collapse):
 *   StoryboardSheet       = multi-panel overview for review/communication
 *   StoryboardPanelSpec   = authoritative structured panel / shot plan
 *   StoryboardFrameAsset  = single clean visual frame for ONE panel (generation input)
 *   GeneratedStateFrame   = observed frame extracted from a generated video
 *
 * The sheet image is NEVER the default video-model input.
 * ShotSpec remains canonical; panel remains authoritative for planned visuals.
 */

import type { StoryboardBlueprint, StoryboardPanelSpec, StoryboardSheet } from "./types";

/** Asset category markers — extend existing AssetCategory without a second store. */
export const STORYBOARD_FRAME_CATEGORY = "storyboard_panel" as const;
export const STORYBOARD_SHEET_CATEGORY = "storyboard" as const;

export interface StoryboardFrameLineage {
  productionId: string;
  sequenceId?: string;
  sceneId?: string;
  shotId: string;
  panelId: string;
  sheetId?: string;
  storyboardId: string;
  storyboardVersion: number;
  referenceManifestVersion?: number;
  visualLockVersion?: number;
}

/**
 * Individual storyboard frame — planned visual state for one shot/panel.
 * Not a video. Not a generated state frame. Not the sheet overview.
 */
export interface StoryboardFrameAsset {
  id: string;
  kind: "panel_frame";
  category: typeof STORYBOARD_FRAME_CATEGORY;
  lineage: StoryboardFrameLineage;
  /** Durable URL when rendered/extracted; may be pending */
  url?: string;
  status: "planned" | "rendered" | "approved" | "locked" | "superseded";
  aspectRatio: string;
  /** Clean frame must exclude sheet chrome */
  excludesSheetChrome: true;
  excludesPanelNumbers: true;
  excludesExplanatoryText: true;
  compositionIntent: string;
  framingIntent: string;
  createdAt: string;
}

export interface StoryboardSheetAsset {
  id: string;
  kind: "sheet_overview";
  category: typeof STORYBOARD_SHEET_CATEGORY;
  productionId: string;
  storyboardId: string;
  sheetId: string;
  panelIds: string[];
  shotIds: string[];
  layout: StoryboardSheet["layout"];
  rangeLabel: string;
  url?: string;
  status: "planned" | "rendered" | "approved" | "locked" | "superseded";
  /** Sheets are for human review — not default video conditioning */
  defaultVideoInput: false;
  createdAt: string;
}

function hashId(prefix: string, seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${prefix}_${(h >>> 0).toString(16)}`;
}

/** Build a planned individual frame descriptor from a structured panel. */
export function buildStoryboardFrameFromPanel(params: {
  blueprint: StoryboardBlueprint;
  panel: StoryboardPanelSpec;
  sheet?: StoryboardSheet;
  url?: string;
  status?: StoryboardFrameAsset["status"];
}): StoryboardFrameAsset {
  const { blueprint, panel, sheet } = params;
  const id = hashId("sbframe", `${blueprint.id}:${panel.panelId}:v${blueprint.version}`);
  return {
    id,
    kind: "panel_frame",
    category: STORYBOARD_FRAME_CATEGORY,
    lineage: {
      productionId: blueprint.productionId,
      sequenceId: blueprint.sequenceId,
      sceneId: blueprint.sceneId,
      shotId: panel.shotId,
      panelId: panel.panelId,
      sheetId: sheet?.sheetId,
      storyboardId: blueprint.id,
      storyboardVersion: blueprint.version,
      referenceManifestVersion: blueprint.referenceManifest?.version,
    },
    url: params.url,
    status: params.status || (params.url ? "rendered" : "planned"),
    aspectRatio: blueprint.aspectRatio,
    excludesSheetChrome: true,
    excludesPanelNumbers: true,
    excludesExplanatoryText: true,
    compositionIntent: panel.composition,
    framingIntent: panel.framing,
    createdAt: new Date().toISOString(),
  };
}

/** Build sheet overview asset — review surface only. */
export function buildStoryboardSheetAsset(params: {
  blueprint: StoryboardBlueprint;
  sheet: StoryboardSheet;
  url?: string;
}): StoryboardSheetAsset {
  const { blueprint, sheet } = params;
  return {
    id: hashId("sbsheet", `${blueprint.id}:${sheet.sheetId}:v${blueprint.version}`),
    kind: "sheet_overview",
    category: STORYBOARD_SHEET_CATEGORY,
    productionId: blueprint.productionId,
    storyboardId: blueprint.id,
    sheetId: sheet.sheetId,
    panelIds: [...sheet.panelIds],
    shotIds: [...sheet.shotIds],
    layout: sheet.layout,
    rangeLabel: sheet.rangeLabel,
    url: params.url,
    status: params.url ? "rendered" : "planned",
    defaultVideoInput: false,
    createdAt: new Date().toISOString(),
  };
}

/** Extract planned individual frames for every panel (dynamic density — not a fixed grid). */
export function extractStoryboardFramesFromBlueprint(blueprint: StoryboardBlueprint): {
  frames: StoryboardFrameAsset[];
  sheets: StoryboardSheetAsset[];
} {
  const sheets = (blueprint.sheets || []).map((sheet) =>
    buildStoryboardSheetAsset({ blueprint, sheet })
  );
  const sheetByPanel = new Map<string, StoryboardSheet>();
  for (const sheet of blueprint.sheets || []) {
    for (const pid of sheet.panelIds) sheetByPanel.set(pid, sheet);
  }
  const frames = blueprint.panels.map((panel) =>
    buildStoryboardFrameFromPanel({
      blueprint,
      panel,
      sheet: sheetByPanel.get(panel.panelId),
    })
  );
  return { frames, sheets };
}

/** Resolve the generation-ready frame for a shot — NEVER the full sheet by default. */
export function resolveStoryboardFrameForShot(params: {
  frames: StoryboardFrameAsset[];
  shotId: string;
  panelId?: string;
  requireApproved?: boolean;
}): StoryboardFrameAsset | null {
  const { frames, shotId, panelId, requireApproved } = params;
  const candidates = frames.filter((f) => {
    if (f.lineage.shotId !== shotId) return false;
    if (panelId && f.lineage.panelId !== panelId) return false;
    if (requireApproved && f.status !== "approved" && f.status !== "locked") return false;
    return true;
  });
  if (!candidates.length) return null;
  const rank = (s: StoryboardFrameAsset["status"]) =>
    s === "locked" ? 4 : s === "approved" ? 3 : s === "rendered" ? 2 : 1;
  return [...candidates].sort((a, b) => rank(b.status) - rank(a.status))[0];
}

/** Attach a rendered URL onto a planned frame (lineage preserved). */
export function attachStoryboardFrameUrl(
  frame: StoryboardFrameAsset,
  url: string,
  status: StoryboardFrameAsset["status"] = "rendered"
): StoryboardFrameAsset {
  return { ...frame, url, status };
}

/** Prompt for rendering a CLEAN individual panel frame (not a sheet). */
export function compileIndividualStoryboardFramePrompt(params: {
  panel: StoryboardPanelSpec;
  aspectRatio: string;
  styleSummary?: string;
}): string {
  const { panel, aspectRatio, styleSummary } = params;
  return [
    "Generate a SINGLE clean cinematic storyboard FRAME (not a multi-panel sheet).",
    "No panel borders, no panel numbers, no captions, no grid, no text overlays.",
    `Aspect ratio: ${aspectRatio}.`,
    `Shot purpose: ${panel.purpose}.`,
    `Dramatic beat: ${panel.dramaticBeat}.`,
    `Visual objective: ${panel.visualObjective}.`,
    `Composition: ${panel.composition}.`,
    `Framing: ${panel.framing}.`,
    `Camera: ${panel.camera.shotType}; ${panel.camera.position}; ${panel.camera.movement}; lens ${panel.camera.lensIntent}.`,
    `Subject action: ${panel.subjectAction}.`,
    `Environment: ${panel.environmentAction}.`,
    `Lighting: ${panel.lightingIntent}.`,
    `Start state: ${panel.startState}.`,
    `End state: ${panel.endState}.`,
    styleSummary ? `Visual treatment: ${styleSummary}.` : "",
    "Preserve character/location/product identity. One composition only.",
  ]
    .filter(Boolean)
    .join("\n");
}
