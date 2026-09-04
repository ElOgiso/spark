/**
 * Deterministic frame-based time helpers — prefer integer frames over float seconds.
 */

export const DEFAULT_FRAME_RATE = 30;

export function secToFrames(sec: number, frameRate: number = DEFAULT_FRAME_RATE): number {
  if (!Number.isFinite(sec) || sec < 0) return 0;
  return Math.round(sec * frameRate);
}

export function framesToSec(frames: number, frameRate: number = DEFAULT_FRAME_RATE): number {
  if (!frameRate) return 0;
  return frames / frameRate;
}

export function parseDurationToSec(value: string | number | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  const m = trimmed.match(/^(\d+):(\d{2})(?:\.(\d+))?$/);
  if (m) {
    const min = Number(m[1]);
    const sec = Number(m[2]);
    const frac = m[3] ? Number(`0.${m[3]}`) : 0;
    return min * 60 + sec + frac;
  }
  const s = trimmed.match(/^(\d+(?:\.\d+)?)\s*s$/i);
  if (s) return Number(s[1]);
  return undefined;
}

export function clampFrames(n: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function identityTransform() {
  return { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, rotationDeg: 0 };
}
