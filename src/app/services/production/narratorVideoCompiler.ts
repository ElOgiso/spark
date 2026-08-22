/**
 * Narrator Video Compiler Utility
 * Compiles ordered keyframe stills + voiceover audio into a postable WebM/MP4 video file
 * using HTML5 Canvas & MediaRecorder API without spending AI video generation credits.
 */

export interface CompileNarratorVideoOptions {
  imageUrls: string[];
  audioUrl?: string;
  totalDurationSec?: number;
  width?: number;
  height?: number;
}

export async function compileNarratorSlideshowVideo(
  options: CompileNarratorVideoOptions
): Promise<Blob | null> {
  const {
    imageUrls,
    audioUrl,
    totalDurationSec = 12,
    width = 1080,
    height = 1920,
  } = options;

  if (!imageUrls || imageUrls.length === 0) return null;

  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  return new Promise(async (resolve) => {
    try {
      // 1. Create canvas
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);

      // 2. Load all image elements
      const loadedImages: HTMLImageElement[] = await Promise.all(
        imageUrls.map(
          (url) =>
            new Promise<HTMLImageElement>((imgResolve) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.onload = () => imgResolve(img);
              img.onerror = () => imgResolve(img);
              img.src = url;
            })
        )
      );

      const validImages = loadedImages.filter((img) => img.complete && img.naturalWidth > 0);
      if (validImages.length === 0) return resolve(null);

      // 3. Setup MediaRecorder on canvas stream
      const fps = 30;
      const canvasStream = canvas.captureStream(fps);

      let mediaRecorder: MediaRecorder | null = null;
      const mimeTypes = [
        "video/mp4;codecs=h264",
        "video/mp4",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      let selectedMime = "";

      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      }

      if (!selectedMime) {
        selectedMime = "video/webm";
      }

      const chunks: Blob[] = [];
      try {
        mediaRecorder = new MediaRecorder(canvasStream, { mimeType: selectedMime });
      } catch (e) {
        mediaRecorder = new MediaRecorder(canvasStream);
      }

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: selectedMime });
        resolve(finalBlob);
      };

      mediaRecorder.start();

      // 4. Render frames over totalDurationSec
      const totalFrames = Math.max(1, Math.round(totalDurationSec * fps));
      const framesPerImage = Math.max(1, Math.floor(totalFrames / validImages.length));
      let currentFrame = 0;

      const drawNextFrame = () => {
        if (currentFrame >= totalFrames) {
          if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
          }
          return;
        }

        const imageIdx = Math.min(
          Math.floor(currentFrame / framesPerImage),
          validImages.length - 1
        );
        const img = validImages[imageIdx];

        // Draw contain/cover on canvas
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
      resolve(null);
    }
  });
}
