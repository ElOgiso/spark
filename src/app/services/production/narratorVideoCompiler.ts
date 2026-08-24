/**
 * Narrator Video Compiler Utility
 * Compiles ordered keyframe stills + voiceover audio into a postable WebM/MP4 video file
 * using HTML5 Canvas, Web Audio API, & MediaRecorder API without spending AI video generation credits.
 */

export interface CompileNarratorVideoOptions {
  imageUrls: string[];
  audioUrl?: string;
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
    totalDurationSec: fallbackDuration = 12,
    width = 1080,
    height = 1920,
  } = options;

  if (!imageUrls || imageUrls.length === 0) return null;

  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  // 1. CORS-safe load images
  const loadedImageResults = await Promise.all(imageUrls.map((u) => loadCorsSafeImage(u)));
  const validImageItems = loadedImageResults.filter((item): item is { img: HTMLImageElement; objectUrl?: string } => item !== null);

  if (validImageItems.length === 0) {
    console.warn("[NarratorVideoCompiler] Zero valid images loaded (CORS or broken URLs). Aborting compilation.");
    return null;
  }

  const cleanupObjectUrls = () => {
    validImageItems.forEach((item) => {
      if (item.objectUrl) URL.revokeObjectURL(item.objectUrl);
    });
  };

  // 2. CORS-safe load audio (if audioUrl provided)
  let audioData: { audioElement: HTMLAudioElement; duration: number; objectUrl?: string } | null = null;
  if (audioUrl) {
    audioData = await loadCorsSafeAudio(audioUrl);
    if (!audioData) {
      console.warn("[NarratorVideoCompiler] Audio URL was provided but failed to load. Aborting compilation.");
      cleanupObjectUrls();
      return null;
    }
  }

  const durationSec = audioData?.duration || fallbackDuration;

  return new Promise((resolve) => {
    try {
      // 3. Create Canvas
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        cleanupObjectUrls();
        if (audioData?.objectUrl) URL.revokeObjectURL(audioData.objectUrl);
        return resolve(null);
      }

      // 4. Capture Streams & Audio Track
      const fps = 30;
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
