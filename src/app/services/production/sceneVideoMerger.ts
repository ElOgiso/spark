/**
 * Scene Video Merger Utility
 * Merges sequential scene video clips into a single master video file
 * using HTML5 Canvas & MediaRecorder API without needing native external binaries.
 */

export interface MergeSceneVideosOptions {
  videoUrls: string[];
  audioUrl?: string;
  onScreenTexts?: string[];
  width?: number;
  height?: number;
}

export interface SceneMergeResult {
  blob: Blob;
  mimeType: string;
  extension: "webm" | "mp4";
  durationSec: number;
}

async function fetchVideoAsObjectUrl(url: string): Promise<{ video: HTMLVideoElement; objectUrl?: string } | null> {
  try {
    if (!url || typeof url !== "string") return null;
    const trimmed = url.trim();
    if (trimmed.length < 5) return null;

    let src = trimmed;
    let objectUrl: string | undefined = undefined;

    if (!trimmed.startsWith("data:") && !trimmed.startsWith("blob:")) {
      const resp = await fetch(trimmed);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      objectUrl = URL.createObjectURL(blob);
      src = objectUrl;
    }

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.playsInline = true;
    video.muted = true;

    const loaded = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 12000);
      video.onloadeddata = () => {
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

    return { video, objectUrl };
  } catch (err) {
    console.warn("[SceneVideoMerger] Video load notice:", err);
    return null;
  }
}

export async function mergeSceneVideos(
  options: MergeSceneVideosOptions
): Promise<SceneMergeResult | null> {
  const { videoUrls, audioUrl, onScreenTexts, width = 1080, height = 1920 } = options;

  const validUrls = videoUrls.filter((u) => typeof u === "string" && u.trim().length > 5);
  if (validUrls.length === 0) return null;

  // Single video optimization: fetch & return directly
  if (validUrls.length === 1 && !audioUrl) {
    try {
      const resp = await fetch(validUrls[0]);
      if (resp.ok) {
        const blob = await resp.blob();
        return {
          blob,
          mimeType: blob.type || "video/mp4",
          extension: blob.type?.includes("webm") ? "webm" : "mp4",
          durationSec: 10,
        };
      }
    } catch {}
  }

  // Load all scene videos
  const loadedVideos: { video: HTMLVideoElement; objectUrl?: string }[] = [];
  for (const url of validUrls) {
    const loaded = await fetchVideoAsObjectUrl(url);
    if (loaded) loadedVideos.push(loaded);
  }

  if (loadedVideos.length === 0) return null;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const stream = canvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported("video/mp4;codecs=h264")
      ? "video/mp4;codecs=h264"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6000000 });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const recordingPromise = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: mimeType });
        resolve(finalBlob);
      };
      recorder.onerror = (err) => reject(err);
    });

    recorder.start(100);

    // Render scenes sequentially onto canvas
    let totalDuration = 0;
    for (let vIdx = 0; vIdx < loadedVideos.length; vIdx++) {
      const { video } = loadedVideos[vIdx];
      const sceneDuration = video.duration && !isNaN(video.duration) ? video.duration : 8;
      totalDuration += sceneDuration;

      video.currentTime = 0;
      await video.play().catch(() => {});

      const startTime = performance.now();
      const targetTimeMs = sceneDuration * 1000;
      const currentCaption = onScreenTexts && onScreenTexts[vIdx] ? onScreenTexts[vIdx].trim() : "";

      while (performance.now() - startTime < targetTimeMs) {
        ctx.fillStyle = "#0B0F17";
        ctx.fillRect(0, 0, width, height);

        // Aspect fit draw
        const vRatio = video.videoWidth / video.videoHeight;
        const cRatio = width / height;
        let dWidth = width;
        let dHeight = height;
        let dx = 0;
        let dy = 0;

        if (vRatio > cRatio) {
          dHeight = width / vRatio;
          dy = (height - dHeight) / 2;
        } else {
          dWidth = height * vRatio;
          dx = (width - dWidth) / 2;
        }

        ctx.drawImage(video, dx, dy, dWidth, dHeight);

        // Burn lower-third on-screen text overlay
        if (currentCaption) {
          const fontSize = Math.round(width * 0.038);
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          const maxWidth = width * 0.82;
          const words = currentCaption.split(" ");
          const lines: string[] = [];
          let currentLine = "";

          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const testWidth = ctx.measureText(testLine).width;
            if (testWidth > maxWidth && currentLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) lines.push(currentLine);

          const paddingX = Math.round(width * 0.035);
          const paddingY = Math.round(height * 0.012);
          const lineHeight = fontSize * 1.35;
          const maxLineWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
          const boxWidth = Math.min(width * 0.88, maxLineWidth + paddingX * 2);
          const boxHeight = lines.length * lineHeight + paddingY * 2;
          const boxX = (width - boxWidth) / 2;
          const boxY = height * 0.80 - boxHeight / 2;

          ctx.fillStyle = "rgba(11, 15, 23, 0.82)";
          ctx.beginPath();
          const radius = 14;
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(boxX, boxY, boxWidth, boxHeight, radius);
          } else {
            ctx.rect(boxX, boxY, boxWidth, boxHeight);
          }
          ctx.fill();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = "#FFFFFF";
          ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
          ctx.shadowBlur = 4;
          ctx.shadowOffsetY = 2;

          lines.forEach((line, lIdx) => {
            const lineY = boxY + paddingY + (lIdx + 0.5) * lineHeight;
            ctx.fillText(line, width / 2, lineY);
          });

          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;
        }

        await new Promise((r) => setTimeout(r, 33));
      }

      video.pause();
    }

    recorder.stop();
    const finalBlob = await recordingPromise;

    // Cleanup loaded object URLs
    loadedVideos.forEach((v) => {
      if (v.objectUrl) URL.revokeObjectURL(v.objectUrl);
    });

    return {
      blob: finalBlob,
      mimeType,
      extension: mimeType.includes("mp4") ? "mp4" : "webm",
      durationSec: Math.round(totalDuration),
    };
  } catch (err) {
    console.error("[SceneVideoMerger] Merge execution error:", err);
    loadedVideos.forEach((v) => {
      if (v.objectUrl) URL.revokeObjectURL(v.objectUrl);
    });
    return null;
  }
}
