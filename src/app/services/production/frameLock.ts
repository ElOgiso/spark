/**
 * Production Frame Lock — geometry spine before storyboard / generation.
 *
 * Hierarchy:
 *   delivery intent → format → aspect → frame → panel → composition → pixels
 *
 * Hard constraints: aspect, orientation, no accidental crop/stretch/letterbox.
 * Soft preferences (lens, negative space) never override the frame.
 */

import { resolveAspectDimensions } from "./editorial/variants";

export type FrameOrientation = "landscape" | "portrait" | "square";

export interface ProductionFrameLock {
  /** Stable id for lineage (format + aspect). */
  frameLockId: string;
  orientation: FrameOrientation;
  /** Locked production aspect, e.g. "16:9" | "9:16" | "1:1". */
  aspectRatio: string;
  targetWidth: number;
  targetHeight: number;
  /** Every storyboard panel must match this ratio (native production frame). */
  panelAspectRatio: string;
  /** Platform / delivery hint (YouTube Long, Shorts, TikTok, square, …). */
  platformHint?: string;
  contentFormat?: string;
  cropLater: false;
  stretchLater: false;
  letterboxPolicy: "prohibited";
  pillarboxPolicy: "prohibited";
  /**
   * Accept sheet crops as scene stills only when cell AR matches panelAspectRatio.
   * Otherwise regenerate full-bleed stills at locked AR.
   */
  panelExtractPolicy: "native_ar_or_regen";
  /** Absolute |observed - expected| tolerance on width/height ratio. */
  aspectTolerance: number;
  createdAt: string;
}

export const DEFAULT_ASPECT_TOLERANCE = 0.06;

/** Parse "16:9" / "9:16" / "1:1" → numeric width/height ratio. */
export function parseAspectRatioValue(aspect: string): number | null {
  const raw = String(aspect || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("portrait") || raw === "9x16") return 9 / 16;
  if (raw.includes("landscape") || raw === "16x9") return 16 / 9;
  if (raw.includes("square")) return 1;
  const m = raw.match(/^(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!(w > 0) || !(h > 0)) return null;
  return w / h;
}

export function aspectRatioError(observed: number, expected: number): number {
  if (!(expected > 0) || !(observed > 0)) return Number.POSITIVE_INFINITY;
  return Math.abs(observed - expected);
}

export function aspectRatiosMatch(
  observedAspect: number,
  expectedAspect: string | number,
  tolerance: number = DEFAULT_ASPECT_TOLERANCE
): boolean {
  const expected =
    typeof expectedAspect === "number" ? expectedAspect : parseAspectRatioValue(expectedAspect);
  if (expected == null || !(observedAspect > 0)) return false;
  return aspectRatioError(observedAspect, expected) <= tolerance;
}

export function inferOrientation(aspectRatio: string): FrameOrientation {
  const v = parseAspectRatioValue(aspectRatio);
  if (v == null) return "portrait";
  if (Math.abs(v - 1) <= 0.02) return "square";
  return v > 1 ? "landscape" : "portrait";
}

export function normalizeProductionAspect(params: {
  aspectRatio?: string | null;
  aspectMode?: string | null;
}): string {
  const fromRatio = String(params.aspectRatio || "").trim();
  if (fromRatio === "16:9" || fromRatio === "9:16" || fromRatio === "1:1" || fromRatio === "4:5") {
    return fromRatio;
  }
  const mode = String(params.aspectMode || "").toLowerCase();
  if (mode === "landscape") return "16:9";
  if (mode === "portrait") return "9:16";
  if (mode === "square") return "1:1";
  // dynamic / unknown — prefer portrait (Spark default social)
  if (fromRatio.includes("16:9") || fromRatio.includes("landscape")) return "16:9";
  if (fromRatio.includes("1:1") || fromRatio.includes("square")) return "1:1";
  return "9:16";
}

export function inferPlatformHint(params: {
  aspectRatio: string;
  platformFit?: string | null;
  account?: string | null;
}): string {
  const blob = `${params.platformFit || ""} ${params.account || ""}`.toLowerCase();
  if (/tiktok/.test(blob)) return "TikTok";
  if (/short/.test(blob)) return "YouTube Shorts";
  if (/reel/.test(blob)) return "Instagram Reels";
  if (/square/.test(blob) || params.aspectRatio === "1:1") return "Square Social";
  if (/youtube|long|cinematic|documentary/.test(blob) || params.aspectRatio === "16:9") {
    return params.aspectRatio === "16:9" ? "YouTube Long Form" : "YouTube Shorts";
  }
  if (params.aspectRatio === "16:9") return "YouTube Long Form";
  if (params.aspectRatio === "9:16") return "Vertical Social";
  return "Custom";
}

/**
 * Create the Frame Lock before storyboard / sheet / still generation.
 */
export function createProductionFrameLock(params: {
  aspectRatio?: string | null;
  aspectMode?: string | null;
  contentFormat?: string | null;
  platformFit?: string | null;
  account?: string | null;
  aspectTolerance?: number;
}): ProductionFrameLock {
  const aspectRatio = normalizeProductionAspect({
    aspectRatio: params.aspectRatio,
    aspectMode: params.aspectMode,
  });
  const dims = resolveAspectDimensions(aspectRatio);
  const orientation = inferOrientation(aspectRatio);
  const platformHint = inferPlatformHint({
    aspectRatio,
    platformFit: params.platformFit,
    account: params.account,
  });
  const frameLockId = `fl_${aspectRatio.replace(":", "x")}_${orientation}`;

  return {
    frameLockId,
    orientation,
    aspectRatio,
    targetWidth: dims.width,
    targetHeight: dims.height,
    panelAspectRatio: aspectRatio,
    platformHint,
    contentFormat: params.contentFormat || undefined,
    cropLater: false,
    stretchLater: false,
    letterboxPolicy: "prohibited",
    pillarboxPolicy: "prohibited",
    panelExtractPolicy: "native_ar_or_regen",
    aspectTolerance: params.aspectTolerance ?? DEFAULT_ASPECT_TOLERANCE,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Sheet overall AR that makes equal grid cells match `panelAspect`.
 * sheetAR = panelAR * (cols / rows)
 */
export function computeSheetAspectForNativePanels(params: {
  panelAspectRatio: string;
  cols: number;
  rows: number;
}): number | null {
  const panel = parseAspectRatioValue(params.panelAspectRatio);
  if (panel == null) return null;
  const cols = Math.max(1, params.cols);
  const rows = Math.max(1, params.rows);
  return panel * (cols / rows);
}

/** Observed cell AR for an equal grid on a sheet image. */
export function computeEqualGridCellAspect(params: {
  sheetWidth: number;
  sheetHeight: number;
  cols: number;
  rows: number;
}): number | null {
  const w = params.sheetWidth;
  const h = params.sheetHeight;
  const cols = Math.max(1, params.cols);
  const rows = Math.max(1, params.rows);
  if (!(w > 0) || !(h > 0)) return null;
  return w / cols / (h / rows);
}

export interface PanelGeometryValidation {
  ok: boolean;
  expectedAspect: string;
  observedCellAspect: number | null;
  ratioError: number;
  cropRisk: "none" | "aspect_mismatch" | "unknown_dims";
  extractionReady: boolean;
  reason: string;
}

/**
 * Validate that equal-grid cells on a sheet match the Frame Lock panel AR.
 * This is the hard gate before accepting sheet crops as scene stills.
 */
export function validateSheetPanelGeometry(params: {
  frameLock: ProductionFrameLock;
  sheetWidth: number;
  sheetHeight: number;
  cols: number;
  rows: number;
}): PanelGeometryValidation {
  const expected = params.frameLock.panelAspectRatio;
  const observed = computeEqualGridCellAspect({
    sheetWidth: params.sheetWidth,
    sheetHeight: params.sheetHeight,
    cols: params.cols,
    rows: params.rows,
  });
  if (observed == null) {
    return {
      ok: false,
      expectedAspect: expected,
      observedCellAspect: null,
      ratioError: Number.POSITIVE_INFINITY,
      cropRisk: "unknown_dims",
      extractionReady: false,
      reason: "Sheet dimensions unavailable — cannot validate panel geometry",
    };
  }
  const expectedV = parseAspectRatioValue(expected);
  const ratioError = expectedV == null ? Number.POSITIVE_INFINITY : aspectRatioError(observed, expectedV);
  const ok = aspectRatiosMatch(observed, expected, params.frameLock.aspectTolerance);
  return {
    ok,
    expectedAspect: expected,
    observedCellAspect: observed,
    ratioError,
    cropRisk: ok ? "none" : "aspect_mismatch",
    extractionReady: ok,
    reason: ok
      ? `Panel cells match Frame Lock ${expected} (err=${ratioError.toFixed(4)})`
      : `Panel cell AR ${observed.toFixed(4)} ≠ locked ${expected} (err=${ratioError.toFixed(4)}) — reject crop, regen native stills`,
  };
}

/**
 * Prefer square grids so equal cells inherit sheet AR (= production AR when sheet is locked).
 * Non-square classic boards (1x5, 2x4, 3x4) distort panel AR when sheet = panel AR.
 */
export function chooseNativePanelStoryboardLayout(panelCount: number): import("./preproduction/types").StoryboardLayout {
  const n = Math.max(1, Math.floor(panelCount) || 1);
  if (n <= 1) return "single-panel";
  if (n <= 4) return "2x2";
  if (n <= 9) return "3x3";
  return "4x4";
}

/** Prompt laws for native panel geometry inside a sheet. */
export function frameLockPanelPromptLaws(frameLock: ProductionFrameLock): string {
  const ar = frameLock.panelAspectRatio;
  const orient =
    frameLock.orientation === "portrait"
      ? "portrait / vertical"
      : frameLock.orientation === "landscape"
        ? "landscape / horizontal"
        : "square";
  return [
    `FRAME LOCK (${frameLock.frameLockId}): ${frameLock.platformHint || "Production"} — ${ar} (${orient}).`,
    `Target production frame: ${frameLock.targetWidth}×${frameLock.targetHeight}.`,
    `Generate EACH storyboard panel as an independent native ${ar} production frame.`,
    `Every panel must fill its cell edge-to-edge with ${ar}-native composition (not a crop of another ratio).`,
    "Compose specifically for this aspect — redesign blocking/headroom/negative space for the frame.",
    "Do NOT rely on later cropping, stretching, letterboxing, or pillarboxing to fix geometry.",
    "Each panel must remain usable as a direct I2V / video start frame without reframing.",
  ].join("\n");
}
