/**
 * Review docked-player fullscreen: native FS of the video file only.
 * Never fullscreens the Review card chrome (badges, dimmers, transport, sidebar).
 */

export type ReviewFsVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export type ReviewFsStage = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export type ReviewFsEnterResult = "video" | "webkit" | "stage" | "none";

export function reviewVideoObjectFitClass(isFullscreen: boolean): string {
  return isFullscreen
    ? "w-full h-full object-contain bg-black"
    : "absolute inset-0 w-full h-full object-cover";
}

export function isReviewVideoFullscreen(
  video: ReviewFsVideo | null,
  stage: ReviewFsStage | null,
  fullscreenElement?: Element | null
): boolean {
  const fs =
    fullscreenElement !== undefined
      ? fullscreenElement
      : typeof document !== "undefined"
        ? document.fullscreenElement
        : null;
  if (fs && video && (fs === video || (typeof fs.contains === "function" && fs.contains(video)))) return true;
  if (fs && stage && (fs === stage || (typeof fs.contains === "function" && fs.contains(stage)))) return true;
  if (video?.webkitDisplayingFullscreen) return true;
  return false;
}

/** Standard Fullscreen API only — do not alias webkitRequestFullscreen (iOS needs webkitEnterFullscreen). */
async function tryRequestFullscreen(el: { requestFullscreen?: () => Promise<void> } | null): Promise<boolean> {
  if (!el || typeof el.requestFullscreen !== "function") return false;
  try {
    await el.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

/** Fallbacks in order: video.requestFullscreen → webkitEnterFullscreen → stage.requestFullscreen. Never the card. */
export async function enterReviewVideoFullscreen(opts: {
  video: ReviewFsVideo | null;
  stage: ReviewFsStage | null;
}): Promise<ReviewFsEnterResult> {
  const { video, stage } = opts;
  if (await tryRequestFullscreen(video)) return "video";
  if (video && typeof video.webkitEnterFullscreen === "function") {
    try {
      video.webkitEnterFullscreen();
      return "webkit";
    } catch {
      // continue to stage
    }
  }
  if (await tryRequestFullscreen(stage)) return "stage";
  return "none";
}

export async function exitReviewVideoFullscreen(video: ReviewFsVideo | null): Promise<void> {
  try {
    if (typeof document !== "undefined" && document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
    }
  } catch {
    // ignore
  }
  try {
    if (video?.webkitDisplayingFullscreen && typeof video.webkitExitFullscreen === "function") {
      video.webkitExitFullscreen();
    }
  } catch {
    // ignore
  }
}

function orientationApi(): { lock?: (t: string) => Promise<void>; unlock?: () => void } | null {
  if (typeof screen === "undefined") return null;
  return (screen as Screen & { orientation?: { lock?: (t: string) => Promise<void>; unlock?: () => void } }).orientation || null;
}

export async function applyReviewFullscreenOrientation(video: ReviewFsVideo | null): Promise<void> {
  const orientation = orientationApi();
  if (!orientation) return;
  try {
    orientation.unlock?.();
  } catch {
    // desktop / missing permission
  }
  try {
    if (typeof orientation.lock !== "function" || !video) return;
    const w = video.videoWidth || 0;
    const h = video.videoHeight || 0;
    if (w > 0 && h > 0) {
      await orientation.lock(w > h ? "landscape" : "portrait");
    }
  } catch {
    // lock often requires a user gesture / is unsupported
  }
}

export function unlockReviewFullscreenOrientation(): void {
  try {
    orientationApi()?.unlock?.();
  } catch {
    // ignore
  }
}
