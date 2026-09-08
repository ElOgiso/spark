/**
 * Official production I2V frame contract.
 * Frame 1 = THIS shot's still only. Continuity uses lastFrame / endFrame — never a grid or sheet as start.
 */

import { isRealStoryboardSheetUrl } from "./compileLiveStoryboardSheetPrompt";

function isUsableImageUrl(val?: string | null): val is string {
  if (!val || typeof val !== "string") return false;
  return val.trim().length >= 8;
}

export function looksLikeSheetOrGridUrl(url: string): boolean {
  return /storyboard[-_]?grid|contact[-_]?sheet|character[-_]?sheet|model[-_]?sheet|location[-_]?plate/i.test(
    url
  );
}

export function isForbiddenI2vStartFrame(
  url: string | undefined,
  forbidden: {
    gridUrl?: string | null;
    sheetUrls?: Array<string | undefined | null>;
    plateUrl?: string | null;
  } = {}
): boolean {
  if (!isUsableImageUrl(url)) return true;
  const t = url.trim();
  if (looksLikeSheetOrGridUrl(t)) return true;
  const sheets = (forbidden.sheetUrls || []).filter(isUsableImageUrl);
  if (sheets.includes(t)) return true;
  if (forbidden.plateUrl && forbidden.plateUrl.trim() === t) return true;
  const grid = forbidden.gridUrl?.trim();
  if (
    grid &&
    grid === t &&
    isRealStoryboardSheetUrl({ storyboardGridUrl: grid, firstStillUrl: undefined }) &&
    /storyboard/i.test(grid)
  ) {
    return true;
  }
  return false;
}

export function resolveOfficialShotStill(params: {
  sceneImage?: string | null;
  keyframeUrl?: string | null;
  generatedFrameUrl?: string | null;
  forbidden?: {
    gridUrl?: string | null;
    sheetUrls?: Array<string | undefined | null>;
    plateUrl?: string | null;
  };
}): string | undefined {
  const candidates = [params.sceneImage, params.keyframeUrl, params.generatedFrameUrl];
  for (const c of candidates) {
    if (!isUsableImageUrl(c)) continue;
    if (isForbiddenI2vStartFrame(c, params.forbidden || {})) continue;
    return c.trim();
  }
  return undefined;
}

export function resolveOfficialI2vClipFrames(params: {
  sceneImage?: string | null;
  keyframeUrl?: string | null;
  generatedFrameUrl?: string | null;
  previousLastFrameUrl?: string | null;
  plannedEndUrl?: string | null;
  forbidden?: {
    gridUrl?: string | null;
    sheetUrls?: Array<string | undefined | null>;
    plateUrl?: string | null;
  };
  sceneLabel?: string;
}): {
  firstFrameUrl: string;
  lastFrameUrl?: string;
  endFrameUrl?: string;
} {
  const firstFrameUrl = resolveOfficialShotStill(params);
  if (!firstFrameUrl) {
    throw new Error(
      `I2V requires this shot's still as frame 1${params.sceneLabel ? ` (${params.sceneLabel})` : ""} — not a grid, sheet, or plate.`
    );
  }

  const prevLast = isUsableImageUrl(params.previousLastFrameUrl)
    ? params.previousLastFrameUrl.trim()
    : undefined;
  const lastFrameUrl =
    prevLast &&
    prevLast !== firstFrameUrl &&
    !isForbiddenI2vStartFrame(prevLast, params.forbidden || {})
      ? prevLast
      : undefined;

  const planned = isUsableImageUrl(params.plannedEndUrl) ? params.plannedEndUrl.trim() : undefined;
  const endFrameUrl =
    lastFrameUrl ||
    (planned && planned !== firstFrameUrl && !isForbiddenI2vStartFrame(planned, params.forbidden || {})
      ? planned
      : undefined);

  return { firstFrameUrl, lastFrameUrl, endFrameUrl };
}
