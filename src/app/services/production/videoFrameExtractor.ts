/**
 * Video Frame Extractor Utility
 * Extracts the last frame of a video clip to a high-quality JPEG/PNG image data URL and Blob
 * using HTML5 Canvas seeking to Math.max(0, duration - 0.05s).
 */

export async function extractVideoLastFrame(
  videoUrlOrBlob: string | Blob
): Promise<{ dataUrl: string; blob: Blob } | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null;

  try {
    let src = "";
    let objectUrl: string | undefined = undefined;

    if (typeof videoUrlOrBlob === "string") {
      const trimmed = videoUrlOrBlob.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
        src = trimmed;
      } else {
        try {
          const resp = await fetch(trimmed);
          if (resp.ok) {
            const b = await resp.blob();
            objectUrl = URL.createObjectURL(b);
            src = objectUrl;
          } else {
            src = trimmed;
          }
        } catch {
          src = trimmed;
        }
      }
    } else if (videoUrlOrBlob instanceof Blob) {
      objectUrl = URL.createObjectURL(videoUrlOrBlob);
      src = objectUrl;
    }

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.playsInline = true;
    video.muted = true;

    const loaded = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 15000);
      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        resolve(video.videoWidth > 0 && video.videoHeight > 0);
      };
      video.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
      video.src = src;
      video.load();
    });

    if (!loaded) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      return null;
    }

    const duration =
      video.duration && !isNaN(video.duration) && isFinite(video.duration)
        ? video.duration
        : 4;
    const targetTime = Math.max(0, duration - 0.05);

    await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 6000);
      video.onseeked = () => {
        clearTimeout(timeout);
        resolve(true);
      };
      video.currentTime = targetTime;
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      return null;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.95);
    });

    if (objectUrl) URL.revokeObjectURL(objectUrl);

    if (dataUrl && blob) {
      return { dataUrl, blob };
    }
    return null;
  } catch (err) {
    console.warn("[VideoFrameExtractor] Last frame extraction notice:", err);
    return null;
  }
}
