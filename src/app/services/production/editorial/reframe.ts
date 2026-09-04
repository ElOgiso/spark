/**
 * Deterministic reframe / crop strategy abstraction.
 * Subject-aware CV is deferred — strategy reserved for later.
 */

import type { CropReframe } from "./types";

export function planReframe(params: {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  strategy?: CropReframe["strategy"];
}): CropReframe {
  const strategy = params.strategy || "center";
  const srcAR = params.sourceWidth / Math.max(1, params.sourceHeight);
  const tgtAR = params.targetWidth / Math.max(1, params.targetHeight);

  let width: number;
  let height: number;
  let x: number;
  let y: number;

  if (srcAR > tgtAR) {
    // Source wider — crop sides
    height = 1;
    width = tgtAR / srcAR;
    x = (1 - width) / 2;
    y = 0;
  } else {
    // Source taller — crop top/bottom
    width = 1;
    height = srcAR / tgtAR;
    x = 0;
    y = (1 - height) / 2;
  }

  if (strategy === "top") y = 0;
  if (strategy === "bottom") y = 1 - height;
  if (strategy === "left") x = 0;
  if (strategy === "right") x = 1 - width;

  return {
    strategy,
    x: round4(x),
    y: round4(y),
    width: round4(width),
    height: round4(height),
    subjectAwareHint:
      strategy === "subject_aware"
        ? "reserved_for_future_subject_tracking"
        : undefined,
    safeAreaInsets: { top: 0.05, right: 0.05, bottom: 0.08, left: 0.05 },
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
