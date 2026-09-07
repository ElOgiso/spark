/**
 * Extract scene stills from a multi-panel storyboard SHEET.
 *
 * Law: panels on the sheet ARE the scene images — crop them; do not
 * re-generate full-bleed stills when extraction succeeds.
 */

import type { StoryboardLayout } from "./preproduction/types";

export interface PanelGrid {
  cols: number;
  rows: number;
}

export interface PanelCropRect {
  panelIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Default inset fraction of each cell to reduce border/number chrome bleed. */
export const DEFAULT_PANEL_GUTTER_RATIO = 0.04;

/**
 * Map OS StoryboardLayout → cols × rows.
 * Named layouts use `{rows}x{cols}` (e.g. 2x4 = 2 rows × 4 cols = 8 panels).
 */
export function storyboardLayoutToGrid(
  layout: StoryboardLayout | string,
  panelCount: number
): PanelGrid {
  const n = Math.max(1, Math.floor(panelCount) || 1);
  switch (layout) {
    case "single-panel":
      return { cols: 1, rows: 1 };
    case "1x5":
      return { cols: 5, rows: 1 };
    case "2x2":
      return { cols: 2, rows: 2 };
    case "2x4":
      return { cols: 4, rows: 2 };
    case "3x3":
      return { cols: 3, rows: 3 };
    case "3x4":
      return { cols: 4, rows: 3 };
    case "4x4":
      return { cols: 4, rows: 4 };
    case "4x5":
      return { cols: 5, rows: 4 };
    case "horizontal-sequence":
      return { cols: n, rows: 1 };
    case "vertical-sequence":
      return { cols: 1, rows: n };
    default: {
      // Fallback: nearest square-ish grid that fits panelCount
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);
      return { cols, rows };
    }
  }
}

/**
 * Compute row-major crop rects for the first `panelCount` panels inside a sheet image.
 * Applies a uniform gutter inset so borders / panel numbers are less likely to leak.
 */
export function computePanelCropRects(params: {
  imageWidth: number;
  imageHeight: number;
  layout: StoryboardLayout | string;
  panelCount: number;
  gutterRatio?: number;
}): PanelCropRect[] {
  const w = Math.max(1, Math.floor(params.imageWidth));
  const h = Math.max(1, Math.floor(params.imageHeight));
  const panelCount = Math.max(0, Math.floor(params.panelCount) || 0);
  if (panelCount === 0) return [];

  const { cols, rows } = storyboardLayoutToGrid(params.layout, panelCount);
  const cellW = w / cols;
  const cellH = h / rows;
  const gutter = Math.max(0, Math.min(0.2, params.gutterRatio ?? DEFAULT_PANEL_GUTTER_RATIO));
  const insetX = cellW * gutter;
  const insetY = cellH * gutter;

  const rects: PanelCropRect[] = [];
  for (let i = 0; i < panelCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    if (row >= rows) break;
    const x = Math.round(col * cellW + insetX);
    const y = Math.round(row * cellH + insetY);
    const width = Math.max(1, Math.round(cellW - insetX * 2));
    const height = Math.max(1, Math.round(cellH - insetY * 2));
    // Clamp to image bounds
    const cx = Math.min(x, w - 1);
    const cy = Math.min(y, h - 1);
    const cw = Math.min(width, w - cx);
    const ch = Math.min(height, h - cy);
    rects.push({ panelIndex: i, x: cx, y: cy, width: cw, height: ch });
  }
  return rects;
}

async function loadSheetImage(
  url: string
): Promise<{ img: HTMLImageElement; objectUrl?: string } | null> {
  try {
    if (typeof document === "undefined" || typeof Image === "undefined") {
      return null;
    }
    const trimmed = typeof url === "string" ? url.trim() : "";
    if (trimmed.length < 5) return null;

    let src = trimmed;
    let objectUrl: string | undefined;

    if (!trimmed.startsWith("data:") && !trimmed.startsWith("blob:")) {
      try {
        const resp = await fetch(trimmed, { credentials: "omit" });
        if (resp.ok) {
          const blob = await resp.blob();
          objectUrl = URL.createObjectURL(blob);
          src = objectUrl;
        }
      } catch {
        // fall through to img.src
      }
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    const loaded = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 12000);
      img.onload = () => {
        clearTimeout(timeout);
        resolve(img.naturalWidth > 0 && img.naturalHeight > 0);
      };
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
      img.src = src;
    });

    if (!loaded) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      return null;
    }
    return { img, objectUrl };
  } catch {
    return null;
  }
}

/**
 * Crop each panel from the sheet into a JPEG data URL (row-major → scene order).
 * Returns [] when the environment cannot crop (SSR / no canvas) or load fails.
 */
export async function extractStoryboardSheetPanels(params: {
  sheetUrl: string;
  layout: StoryboardLayout | string;
  panelCount: number;
  gutterRatio?: number;
  mimeType?: "image/jpeg" | "image/png";
  quality?: number;
}): Promise<string[]> {
  const panelCount = Math.max(0, Math.floor(params.panelCount) || 0);
  if (!params.sheetUrl || panelCount === 0) return [];

  if (typeof document === "undefined") {
    console.warn("[SPARK Pipeline] Panel extract skipped — no document/canvas environment");
    return [];
  }

  const loaded = await loadSheetImage(params.sheetUrl);
  if (!loaded) {
    console.warn("[SPARK Pipeline] Panel extract failed — could not load storyboard sheet image");
    return [];
  }

  try {
    const { img, objectUrl } = loaded;
    const rects = computePanelCropRects({
      imageWidth: img.naturalWidth,
      imageHeight: img.naturalHeight,
      layout: params.layout,
      panelCount,
      gutterRatio: params.gutterRatio,
    });

    const mime = params.mimeType || "image/jpeg";
    const quality = params.quality ?? 0.92;
    const out: string[] = [];

    for (const rect of rects) {
      const canvas = document.createElement("canvas");
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      ctx.drawImage(
        img,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        0,
        0,
        rect.width,
        rect.height
      );
      const dataUrl =
        mime === "image/png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", quality);
      if (dataUrl && dataUrl.length > 32) out.push(dataUrl);
    }

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    return out;
  } catch (err) {
    console.warn("[SPARK Pipeline] Panel extract notice:", err);
    if (loaded.objectUrl) URL.revokeObjectURL(loaded.objectUrl);
    return [];
  }
}
