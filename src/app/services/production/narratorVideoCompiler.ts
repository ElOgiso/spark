/**
 * Narrator Video Compiler Utility
 * Compiles ordered keyframe stills + voiceover audio into a postable WebM/MP4 video file
 * using HTML5 Canvas, Web Audio API, & MediaRecorder API without spending AI video generation credits.
 */

export interface CompileNarratorVideoOptions {
  imageUrls: string[];
  audioUrl?: string;
  sfxUrl?: string;
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
  let pendingObjectUrl: string | undefined;
  try {
    if (!url || typeof url !== "string") return null;
    const trimmed = url.trim();
    if (trimmed.length < 5) return null;

    let src = trimmed;
    let objectUrl: string | undefined = undefined;

    if (!trimmed.startsWith("data:") && !trimmed.startsWith("blob:")) {
      try {
        const resp = await fetch(trimmed, { credentials: "omit" });
        if (resp.ok) {
          const blob = await resp.blob();
          objectUrl = URL.createObjectURL(blob);
          pendingObjectUrl = objectUrl;
          src = objectUrl;
        }
      } catch (fetchErr) {
        console.warn("[NarratorVideoCompiler] Image direct fetch notice, falling back to img.src:", fetchErr);
      }
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
    if (pendingObjectUrl) URL.revokeObjectURL(pendingObjectUrl);
    console.warn("[NarratorVideoCompiler] Image load notice:", err);
    return null;
  }
}

async function loadCorsSafeAudio(
  url: string
): Promise<{ audioElement: HTMLAudioElement; duration: number; objectUrl?: string } | null> {
  let pendingObjectUrl: string | undefined;
  try {
    if (!url || typeof url !== "string") return null;
    const trimmed = url.trim();
    if (trimmed.length < 5) return null;

    let src = trimmed;
    let objectUrl: string | undefined = undefined;

    if (!trimmed.startsWith("data:") && !trimmed.startsWith("blob:")) {
      try {
        const resp = await fetch(trimmed, { credentials: "omit" });
        if (resp.ok) {
          const blob = await resp.blob();
          objectUrl = URL.createObjectURL(blob);
          pendingObjectUrl = objectUrl;
          src = objectUrl;
        }
      } catch (fetchErr) {
        console.warn("[NarratorVideoCompiler] Audio direct fetch notice, falling back to audio.src:", fetchErr);
      }
    }

    const audio = new Audio();
    audio.crossOrigin = "anonymous";
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
      audio.src = src;
      audio.load();
    });

    return { audioElement: audio, duration, objectUrl };
  } catch (err) {
    if (pendingObjectUrl) URL.revokeObjectURL(pendingObjectUrl);
    console.warn("[NarratorVideoCompiler] Audio load notice:", err);
    return null;
  }
}

export async function compileNarratorSlideshowVideo(options: CompileNarratorVideoOptions): Promise<NarratorCompileResult | null> {
  if (!options.audioUrl) throw new Error("Narrator compilation requires a voice audio URL.");
  return compileMixedVisualVideo({
    clips: options.imageUrls.map((url, i) => ({ url, mediaType: "image", durationSec: (options.totalDurationSec || 12) / options.imageUrls.length, text: options.onScreenTexts?.[i] })),
    audioUrl: options.audioUrl, sfxUrl: options.sfxUrl, width: options.width, height: options.height,
  });
}

async function loadCorsSafeVideo(
  url: string
): Promise<{ video: HTMLVideoElement; duration: number; objectUrl?: string } | null> {
  let pendingObjectUrl: string | undefined;
  try {
    if (!url || typeof url !== "string") return null;
    const trimmed = url.trim();
    if (trimmed.length < 5) return null;

    let src = trimmed;
    let objectUrl: string | undefined = undefined;

    if (!trimmed.startsWith("data:") && !trimmed.startsWith("blob:")) {
      try {
        const resp = await fetch(trimmed, { credentials: "omit" });
        if (resp.ok) {
          const blob = await resp.blob();
          objectUrl = URL.createObjectURL(blob);
          pendingObjectUrl = objectUrl;
          src = objectUrl;
        }
      } catch (fetchErr) {
        console.warn("[NarratorVideoCompiler] Video direct fetch notice, falling back to video.src:", fetchErr);
      }
    }

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.playsInline = true;
    video.muted = true;

    const duration = await new Promise<number>((resolve) => {
      const timeout = setTimeout(() => resolve(0), 12000);
      video.onloadeddata = () => {
        clearTimeout(timeout);
        resolve(video.duration || 0);
      };
      video.onerror = () => {
        clearTimeout(timeout);
        resolve(0);
      };
      video.src = src;
      video.load();
    });

    if (duration <= 0 && video.videoWidth === 0) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      return null;
    }

    return { video, duration: duration > 0 ? duration : 6, objectUrl };
  } catch (err) {
    if (pendingObjectUrl) URL.revokeObjectURL(pendingObjectUrl);
    console.warn("[NarratorVideoCompiler] Video load notice:", err);
    return null;
  }
}

export interface CompileHybridVideoOptions {
  hookVideoUrl: string;
  remainingImageUrls: string[];
  audioUrl?: string;
  onScreenTexts?: string[];
  totalDurationSec?: number;
  width?: number;
  height?: number;
}

export async function compileHybridVideo(options: CompileHybridVideoOptions): Promise<NarratorCompileResult | null> {
  const images = options.remainingImageUrls || [];
  const duration = (options.totalDurationSec || 15) / (images.length + 1);
  return compileMixedVisualVideo({
    clips: [{ url: options.hookVideoUrl, mediaType: "video", durationSec: duration, text: options.onScreenTexts?.[0] },
      ...images.map((url, i) => ({ url, mediaType: "image" as const, durationSec: duration, text: options.onScreenTexts?.[i + 1] }))],
    audioUrl: options.audioUrl, width: options.width, height: options.height, preserveOpeningVideoDuration: true,
  });
}

export interface MixedVisualClip {
  url: string;
  mediaType: "image" | "video";
  durationSec: number;
  text?: string;
  /** Deterministic graphic frames, in reveal order. */
  animationFrames?: string[];
}

/** Same compiler boundary for any ordered mix of stills, sourced clips and AI video. */
export async function compileMixedVisualVideo(options: {
  clips: MixedVisualClip[];
  audioUrl?: string;
  sfxUrl?: string;
  width?: number;
  height?: number;
  signal?: AbortSignal;
  /** Compatibility with existing hook + stills callers. */
  preserveOpeningVideoDuration?: boolean;
}): Promise<NarratorCompileResult> {
  const { clips, signal, width = 1080, height = 1920 } = options;
  if (!clips.length || clips.some(c => !c.url || !Number.isFinite(c.durationSec) || c.durationSec <= 0)) {
    throw new Error("Every planned visual needs a source and a positive duration");
  }
  if (typeof document === "undefined" || typeof MediaRecorder === "undefined") throw new Error("Mixed visual compilation requires a recording-capable browser");
  const resources: Array<{ objectUrl?: string }> = [];
  const videos: HTMLVideoElement[] = [];
  const audios: HTMLAudioElement[] = [];
  let audioCtx: AudioContext | undefined;
  let stream: MediaStream | undefined;
  let recorder: MediaRecorder | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectRecording: ((reason: Error) => void) | undefined;
  const abort = () => rejectRecording?.(new Error("Visual compilation cancelled"));
  try {
    signal?.throwIfAborted();
    // Preserve every slot; failing media cannot silently remove a narrative beat.
    const loaded: Array<{ image?: HTMLImageElement; video?: HTMLVideoElement; frames?: HTMLImageElement[] }> = [];
    for (const clip of clips) {
      signal?.throwIfAborted();
      if (clip.mediaType === "video") {
        const item = await loadCorsSafeVideo(clip.url);
        if (!item) throw new Error(`Required video failed to load at beat ${loaded.length + 1}`);
        resources.push(item); videos.push(item.video);
        item.video.muted = true;
        loaded.push({ video: item.video });
      } else {
        const frames: HTMLImageElement[] = [];
        for (const url of clip.animationFrames?.length ? clip.animationFrames : [clip.url]) {
          const item = await loadCorsSafeImage(url);
          if (!item) throw new Error(`Required image failed to load at beat ${loaded.length + 1}`);
          resources.push(item); frames.push(item.img);
        }
        loaded.push({ image: frames[0], frames });
      }
    }
    let narration: HTMLAudioElement | undefined;
    let durationSec = clips.reduce((n, c) => n + c.durationSec, 0);
    if (options.audioUrl) {
      const item = await loadCorsSafeAudio(options.audioUrl);
      if (!item) throw new Error("Required narration failed to load");
      resources.push(item); audios.push(item.audioElement); narration = item.audioElement;
      durationSec = item.duration;
    }
    let sfx: HTMLAudioElement | undefined;
    if (options.sfxUrl) {
      const item = await loadCorsSafeAudio(options.sfxUrl);
      if (!item) throw new Error("Requested sound effects failed to load");
      resources.push(item); audios.push(item.audioElement); sfx = item.audioElement;
    }
    const plannedDuration = clips.reduce((n, c) => n + c.durationSec, 0);
    const ends: number[] = [];
    const openingDuration = options.preserveOpeningVideoDuration ? loaded[0].video?.duration : undefined;
    if (openingDuration && Number.isFinite(openingDuration)) {
      if (clips.length > 1 && durationSec <= openingDuration) throw new Error("Narration/timeline leaves no time for planned stills after the opening video");
      durationSec = Math.max(durationSec, openingDuration);
      clips.forEach((_, i) => ends.push(i === 0 ? (clips.length === 1 ? durationSec : openingDuration) : openingDuration + (durationSec - openingDuration) * i / (clips.length - 1)));
    } else clips.reduce((cursor, clip) => { const end = cursor + clip.durationSec / plannedDuration * durationSec; ends.push(end); return end; }, 0);
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof canvas.captureStream !== "function") throw new Error("Canvas recording unavailable");
    stream = canvas.captureStream(30);
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if ((audios.length || videos.length) && !AudioCtx) throw new Error("Audio mixing unavailable");
    if (AudioCtx && (audios.length || videos.length)) {
      audioCtx = new AudioCtx();
      const destination = audioCtx!.createMediaStreamDestination();
      for (const element of [...audios, ...videos]) {
        const source = audioCtx!.createMediaElementSource(element);
        const gain = audioCtx!.createGain();
        gain.gain.value = videos.includes(element as HTMLVideoElement) ? (narration ? 0 : 1) : element === sfx ? 0.35 : 1;
        source.connect(gain); gain.connect(destination);
      }
      await audioCtx!.resume();
      if (audioCtx!.state !== "running") throw new Error("Browser blocked audio playback; start playback and retry");
      destination.stream.getAudioTracks().forEach(t => stream!.addTrack(t));
    }
    const mimeType = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(t => MediaRecorder.isTypeSupported(t));
    if (!mimeType) throw new Error("No supported video recording codec");
    recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    let active = -1;
    const activate = async (index: number) => {
      if (active === index) return;
      if (active >= 0) loaded[active].video?.pause();
      active = index;
      const video = loaded[index].video;
      if (video) { video.currentTime = 0; await video.play(); }
    };
    const draw = (time: number) => {
      const index = Math.min(ends.findIndex(end => time < end) < 0 ? clips.length - 1 : ends.findIndex(end => time < end), clips.length - 1);
      const start = index ? ends[index - 1] : 0;
      const item = loaded[index];
      const progress = Math.min(1, (time - start) / (ends[index] - start));
      const image = item.video || item.frames?.[Math.min(item.frames.length - 1, Math.floor(progress * item.frames.length))] || item.image!;
      const iw = item.video ? item.video.videoWidth : (image as HTMLImageElement).naturalWidth;
      const ih = item.video ? item.video.videoHeight : (image as HTMLImageElement).naturalHeight;
      if (!iw || !ih) throw new Error(`Visual dimensions unavailable at beat ${index + 1}`);
      const scale = Math.min(width / iw, height / ih);
      ctx.fillStyle = "#0b0f17"; ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, (width - iw * scale) / 2, (height - ih * scale) / 2, iw * scale, ih * scale);
      if (clips[index].text) {
        const fontSize = Math.round(width * .035);
        ctx.font = `${fontSize}px sans-serif`; ctx.textAlign = "center";
        const lines: string[] = []; let line = "";
        for (const word of clips[index].text!.split(/\s+/)) {
          const next = line ? `${line} ${word}` : word;
          if (line && ctx.measureText(next).width > width * .82) { lines.push(line); line = word; }
          else line = next;
        }
        if (line) lines.push(line);
        const lineHeight = fontSize * 1.35;
        const boxHeight = lines.length * lineHeight + fontSize;
        const top = height * .88 - boxHeight;
        ctx.fillStyle = "rgba(0,0,0,.8)"; ctx.fillRect(width * .05, top, width * .9, boxHeight);
        ctx.fillStyle = "white";
        lines.forEach((text, i) => ctx.fillText(text, width / 2, top + fontSize + i * lineHeight, width * .84));
      }
      return index;
    };
    await activate(0); draw(0);
    signal?.throwIfAborted();
    const result = await new Promise<NarratorCompileResult>((resolve, reject) => {
      rejectRecording = reject;
      recorder!.onerror = () => reject(new Error("Media recording failed"));
      recorder!.onstop = () => {
        const actualMime = recorder!.mimeType;
        const blob = new Blob(chunks, { type: actualMime });
        if (!blob.size) reject(new Error("Compiler produced an empty video"));
        else resolve({ blob, mimeType: actualMime, extension: actualMime.includes("mp4") ? "mp4" : "webm", durationSec });
      };
      signal?.addEventListener("abort", abort, { once: true });
      recorder!.start(1000);
      const started = performance.now();
      Promise.all(audios.map(a => a.play())).catch(reject);
      const tick = async () => {
        try {
          signal?.throwIfAborted();
          const time = (performance.now() - started) / 1000;
          if (time >= durationSec) { recorder!.stop(); return; }
          const index = draw(time);
          await activate(index);
          timer = setTimeout(tick, 1000 / 30);
        } catch (error) { reject(error); }
      };
      void tick();
    });
    return result;
  } finally {
    signal?.removeEventListener("abort", abort);
    if (timer) clearTimeout(timer);
    if (recorder?.state !== "inactive" && recorder) recorder.stop();
    [...audios, ...videos].forEach(e => { e.pause(); e.removeAttribute("src"); e.load(); });
    stream?.getTracks().forEach(t => t.stop());
    await audioCtx?.close();
    resources.forEach(r => { if (r.objectUrl) URL.revokeObjectURL(r.objectUrl); });
  }
}
