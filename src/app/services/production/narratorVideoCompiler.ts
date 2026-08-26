/**
 * Narrator Video Compiler Utility
 * Compiles ordered keyframe stills + voiceover audio into a postable WebM/MP4 video file
 * using HTML5 Canvas, Web Audio API, & MediaRecorder API without spending AI video generation credits.
 */

export interface CompileNarratorVideoOptions {
  imageUrls: string[];
  audioUrl?: string;
  onScreenTexts?: string[];
  totalDurationSec?: number;
  width?: number;
  height?: number;
}

export interface NarratorCompileResult {
  blob: Blob;
  mimeType: string;
  extension: "webm" | "mp4";
  durationSec: number;
}

async function loadCorsSafeImage(url: string): Promise<{ img: HTMLImageElement; objectUrl?: string } | null> {
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

    const img = new Image();
    img.crossOrigin = "anonymous";

    const loaded = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 8000);
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
  } catch (err) {
    console.warn("[NarratorVideoCompiler] Image load notice:", err);
    return null;
  }
}

async function loadCorsSafeAudio(
  url: string
): Promise<{ audioElement: HTMLAudioElement; duration: number; objectUrl?: string } | null> {
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

    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.src = src;

    const duration = await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Audio metadata timeout")), 10000);
      audio.onloadedmetadata = () => {
        clearTimeout(timeout);
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0) {
          resolve(audio.duration);
        } else {
          reject(new Error("Invalid audio duration"));
        }
      };
      audio.onerror = (e) => {
        clearTimeout(timeout);
        reject(e);
      };
    });

    return { audioElement: audio, duration, objectUrl };
  } catch (err) {
    console.warn("[NarratorVideoCompiler] Audio load notice:", err);
    return null;
  }
}

function extractAudioTrack(audioElement: HTMLAudioElement): MediaStreamTrack | null {
  try {
    const mediaEl = audioElement as any;
    if (typeof mediaEl.captureStream === "function") {
      const stream = mediaEl.captureStream();
      const tracks = stream.getAudioTracks();
      if (tracks.length > 0) return tracks[0];
    }
    if (typeof mediaEl.mozCaptureStream === "function") {
      const stream = mediaEl.mozCaptureStream();
      const tracks = stream.getAudioTracks();
      if (tracks.length > 0) return tracks[0];
    }
  } catch (e) {
    console.warn("[NarratorVideoCompiler] MediaElement.captureStream notice:", e);
  }

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaElementSource(audioElement);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      const tracks = dest.stream.getAudioTracks();
      if (tracks.length > 0) return tracks[0];
    }
  } catch (e) {
    console.warn("[NarratorVideoCompiler] Web Audio API destination notice:", e);
  }

  return null;
}

export async function compileNarratorSlideshowVideo(
  options: CompileNarratorVideoOptions
): Promise<NarratorCompileResult | null> {
  const {
    imageUrls,
    audioUrl,
    onScreenTexts,
    totalDurationSec: fallbackDuration = 12,
    width = 1080,
    height = 1920,
  } = options;

  if (!imageUrls || imageUrls.length === 0) {
    throw new Error("Narrator video compilation requires at least one image URL.");
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Narrator video compiler requires a browser DOM environment.");
  }

  if (!audioUrl) {
    throw new Error("Narrator compilation requires a voice audio URL.");
  }

  // 1. CORS-safe load images in scene order
  const loadedImageResults = await Promise.all(imageUrls.map((u) => loadCorsSafeImage(u)));
  const validImageItems = loadedImageResults.filter((item): item is { img: HTMLImageElement; objectUrl?: string } => item !== null);

  if (validImageItems.length === 0) {
    throw new Error("Zero valid images could be loaded for Narrator compilation (CORS or broken URLs).");
  }

  const cleanupObjectUrls = () => {
    validImageItems.forEach((item) => {
      if (item.objectUrl) URL.revokeObjectURL(item.objectUrl);
    });
  };

  // 2. CORS-safe load audio
  let audioData: { audioElement: HTMLAudioElement; duration: number; objectUrl?: string } | null = null;
  audioData = await loadCorsSafeAudio(audioUrl);
  if (!audioData) {
    cleanupObjectUrls();
    throw new Error("Narrator voice audio failed to load (CORS or invalid audio URL).");
  }

  const durationSec = audioData.duration && audioData.duration > 0 ? audioData.duration : fallbackDuration;

  return new Promise((resolve, reject) => {
    try {
      // 3. Create Canvas
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        cleanupObjectUrls();
        if (audioData?.objectUrl) URL.revokeObjectURL(audioData.objectUrl);
        return reject(new Error("Unable to obtain 2D rendering context for Narrator canvas."));
      }

      // 4. Capture Streams & Audio Track
      const fps = 30;
      if (typeof (canvas as any).captureStream !== "function") {
        cleanupObjectUrls();
        if (audioData?.objectUrl) URL.revokeObjectURL(audioData.objectUrl);
        return reject(new Error("Browser does not support canvas.captureStream for video compilation."));
      }

      const canvasStream = canvas.captureStream(fps);
      const videoTrack = canvasStream.getVideoTracks()[0];

      const tracks: MediaStreamTrack[] = [videoTrack];
      let audioTrack: MediaStreamTrack | null = null;

      if (audioData) {
        audioTrack = extractAudioTrack(audioData.audioElement);
        if (audioTrack) {
          tracks.push(audioTrack);
        }
      }

      const combinedStream = new MediaStream(tracks);

      // Select supported Mime Type
      const mimeTypes = [
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];

      let selectedMime = "";
      for (const mime of mimeTypes) {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      }
      if (!selectedMime) selectedMime = "video/webm";

      const extension: "webm" | "mp4" = selectedMime.includes("mp4") ? "mp4" : "webm";
      const chunks: Blob[] = [];

      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(combinedStream, { mimeType: selectedMime });
      } catch (e) {
        mediaRecorder = new MediaRecorder(combinedStream);
      }

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        cleanupObjectUrls();
        if (audioData?.objectUrl) URL.revokeObjectURL(audioData.objectUrl);

        const finalBlob = new Blob(chunks, { type: selectedMime });
        if (finalBlob.size === 0) {
          return resolve(null);
        }

        resolve({
          blob: finalBlob,
          mimeType: selectedMime,
          extension,
          durationSec,
        });
      };

      // 5. Start Recording & Audio Playback
      mediaRecorder.start();

      if (audioData) {
        audioData.audioElement.currentTime = 0;
        audioData.audioElement.play().catch((pErr) => {
          console.warn("[NarratorVideoCompiler] Audio playback warning:", pErr);
        });
      }

      // 6. Draw Frames Loop over durationSec
      const totalFrames = Math.max(1, Math.round(durationSec * fps));
      const validImages = validImageItems.map((item) => item.img);
      const framesPerImage = Math.max(1, Math.floor(totalFrames / validImages.length));
      let currentFrame = 0;

      const drawNextFrame = () => {
        if (currentFrame >= totalFrames) {
          if (audioData) {
            audioData.audioElement.pause();
          }
          if (mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
          }
          return;
        }

        const imageIdx = Math.min(
          Math.floor(currentFrame / framesPerImage),
          validImages.length - 1
        );
        const img = validImages[imageIdx];

        ctx.fillStyle = "#0B0F17";
        ctx.fillRect(0, 0, width, height);

        const imgAspect = img.naturalWidth / img.naturalHeight;
        const canvasAspect = width / height;
        let drawW = width;
        let drawH = height;
        let drawX = 0;
        let drawY = 0;

        if (imgAspect > canvasAspect) {
          drawH = width / imgAspect;
          drawY = (height - drawH) / 2;
        } else {
          drawW = height * imgAspect;
          drawX = (width - drawW) / 2;
        }

        ctx.drawImage(img, drawX, drawY, drawW, drawH);

        // Draw lower-third on-screen text overlay
        const currentText = onScreenTexts && onScreenTexts[imageIdx] ? onScreenTexts[imageIdx].trim() : "";
        if (currentText) {
          const fontSize = Math.round(width * 0.038);
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          const maxWidth = width * 0.82;
          const words = currentText.split(" ");
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

          lines.forEach((line, idx) => {
            const lineY = boxY + paddingY + (idx + 0.5) * lineHeight;
            ctx.fillText(line, width / 2, lineY);
          });

          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;
        }

        currentFrame++;
        setTimeout(drawNextFrame, 1000 / fps);
      };

      drawNextFrame();
    } catch (err) {
      console.warn("[NarratorVideoCompiler] Slideshow compile exception:", err);
      cleanupObjectUrls();
      if (audioData?.objectUrl) URL.revokeObjectURL(audioData.objectUrl);
      resolve(null);
    }
  });
}
