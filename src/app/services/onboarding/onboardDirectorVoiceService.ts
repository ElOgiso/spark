import { generateElevenLabsVoice } from "../runtime/providers/elevenLabsTTS";
import { resolveProviderKey } from "../runtime/AIProviderOrchestrator";

export interface DirectorVoiceState {
  isSpeaking: boolean;
  isMuted: boolean;
}

type VoiceListener = (state: DirectorVoiceState) => void;

export const ONBOARD_SCRIPT_KEYS = {
  welcome_super_spark: "welcome_super_spark",
  step_connect_account: "step_connect_account",
  step_brand_identity: "step_brand_identity",
  step_character_host: "step_character_host",
  step_narrator_voice: "step_narrator_voice",
  step_research_sources: "step_research_sources",
  step_production_mode: "step_production_mode",
  step_ready_launch: "step_ready_launch",
} as const;

export type OnboardScriptKey = keyof typeof ONBOARD_SCRIPT_KEYS;

export const ONBOARD_FIXED_SCRIPTS: Record<OnboardScriptKey, string> = {
  welcome_super_spark: "Welcome. I'm Super Spark, your executive creative director. Let's build the brand SPARK will run.",
  step_connect_account: "Connect the social accounts you want SPARK to manage. I'll use them for identity, publishing, and distribution.",
  step_brand_identity: "What should we call this brand — and what niche does SPARK own?",
  step_character_host: "Who is the host on camera? Lock a character SPARK can keep consistent forever.",
  step_narrator_voice: "Choose the narrator voice for your content. This is your brand voice — not my chat voice.",
  step_research_sources: "Paste channels or profiles SPARK should learn from. I'll start analysing as soon as you add them.",
  step_production_mode: "How should SPARK produce — and how much should I decide without you?",
  step_ready_launch: "Your SPARK is ready. Enter when you are.",
};

export const FRAME_TO_SCRIPT_KEY: Record<number, OnboardScriptKey> = {
  0: "welcome_super_spark",
  1: "step_connect_account",
  2: "step_brand_identity",
  3: "step_character_host",
  4: "step_narrator_voice",
  5: "step_research_sources",
  6: "step_production_mode",
  7: "step_ready_launch",
};

// Supabase Storage Public Audio Bucket URLs (Preloaded / Cached for instant latency-free speech)
const SUPABASE_STORAGE_ONBOARD_BASE = "https://jaqzjhabmtvqtvinoafq.supabase.co/storage/v1/object/public/spark/onboard-audio";

export const FIXED_ONBOARD_AUDIO_URLS: Record<OnboardScriptKey, string> = {
  welcome_super_spark: `${SUPABASE_STORAGE_ONBOARD_BASE}/welcome_super_spark.mp3`,
  step_connect_account: `${SUPABASE_STORAGE_ONBOARD_BASE}/step_connect_account.mp3`,
  step_brand_identity: `${SUPABASE_STORAGE_ONBOARD_BASE}/step_brand_identity.mp3`,
  step_character_host: `${SUPABASE_STORAGE_ONBOARD_BASE}/step_character_host.mp3`,
  step_narrator_voice: `${SUPABASE_STORAGE_ONBOARD_BASE}/step_narrator_voice.mp3`,
  step_research_sources: `${SUPABASE_STORAGE_ONBOARD_BASE}/step_research_sources.mp3`,
  step_production_mode: `${SUPABASE_STORAGE_ONBOARD_BASE}/step_production_mode.mp3`,
  step_ready_launch: `${SUPABASE_STORAGE_ONBOARD_BASE}/step_ready_launch.mp3`,
};

class OnboardDirectorVoiceService {
  private isMutedState: boolean = false;
  private isSpeakingState: boolean = false;
  private currentAudio: HTMLAudioElement | null = null;
  private activeAbortController: AbortController | null = null;
  private listeners: Set<VoiceListener> = new Set();
  private preloadCache: Map<string, string> = new Map();
  private preloadingPromises: Map<string, Promise<string | null>> = new Map();

  // Primary ElevenLabs guide voice ID (Rachel: calm, warm, relaxed onboard director)
  private readonly defaultGuideVoiceId = "21m00Tcm4TlvDq8ikWAM";

  constructor() {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const savedMuted = localStorage.getItem("spark_onboard_voice_muted");
        if (savedMuted !== null) {
          this.isMutedState = savedMuted === "true";
        }
      } catch {}
    }

    // Pre-populate fixed script URLs into the cache immediately
    Object.entries(FIXED_ONBOARD_AUDIO_URLS).forEach(([key, url]) => {
      const scriptText = ONBOARD_FIXED_SCRIPTS[key as OnboardScriptKey];
      if (scriptText) {
        this.preloadCache.set(key, url);
        this.preloadCache.set(this.cleanseText(scriptText), url);
      }
    });

    // Eagerly prefetch the first 2 clips on initial load
    if (typeof window !== "undefined") {
      this.prefetchUrl(FIXED_ONBOARD_AUDIO_URLS.welcome_super_spark);
      this.prefetchUrl(FIXED_ONBOARD_AUDIO_URLS.step_connect_account);
    }
  }

  private prefetchUrl(url: string) {
    if (typeof window === "undefined" || !url) return;
    try {
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = url;
    } catch {}
  }

  public isMuted(): boolean {
    return this.isMutedState;
  }

  public isSpeaking(): boolean {
    return this.isSpeakingState;
  }

  public setMuted(muted: boolean): void {
    this.isMutedState = muted;
    try {
      localStorage.setItem("spark_onboard_voice_muted", String(muted));
    } catch {}
    if (muted) {
      this.stop();
    }
    this.notify();
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMutedState);
    return this.isMutedState;
  }

  public subscribe(listener: VoiceListener): () => void {
    this.listeners.add(listener);
    listener({ isSpeaking: this.isSpeakingState, isMuted: this.isMutedState });
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state: DirectorVoiceState = {
      isSpeaking: this.isSpeakingState,
      isMuted: this.isMutedState,
    };
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.warn("[OnboardDirectorVoice] listener error:", err);
      }
    });
  }

  public stop(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.src = "";
      } catch {}
      this.currentAudio = null;
    }
    if (this.isSpeakingState) {
      this.isSpeakingState = false;
      this.notify();
    }
  }

  /**
   * Pre-fetches / warms up audio synthesis so step entry speech starts instantly
   */
  public async preload(textOrKey: string, scriptKey?: string): Promise<void> {
    if (!textOrKey || !textOrKey.trim()) return;

    // 1. If matching fixed script key or text in fixed map, prefetch URL
    if (scriptKey && FIXED_ONBOARD_AUDIO_URLS[scriptKey as OnboardScriptKey]) {
      this.prefetchUrl(FIXED_ONBOARD_AUDIO_URLS[scriptKey as OnboardScriptKey]);
      return;
    }

    const cleanText = this.cleanseText(textOrKey);
    if (this.preloadCache.has(cleanText)) {
      const url = this.preloadCache.get(cleanText);
      if (url) this.prefetchUrl(url);
      return;
    }

    if (this.preloadingPromises.has(cleanText)) {
      await this.preloadingPromises.get(cleanText);
      return;
    }

    const promise = this.synthesizeAudio(cleanText).then((url) => {
      if (url) {
        this.preloadCache.set(cleanText, url);
      }
      this.preloadingPromises.delete(cleanText);
      return url;
    });

    this.preloadingPromises.set(cleanText, promise);
    await promise;
  }

  /**
   * Speaks director speech instantly from preloaded Supabase storage or live fallback
   */
  public async speak(text: string, scriptKey?: string): Promise<void> {
    if (this.isMutedState || !text || !text.trim()) {
      return;
    }

    // Stop any existing playback or pending generation
    this.stop();

    const cleanText = this.cleanseText(text);
    if (!cleanText) return;

    this.activeAbortController = new AbortController();
    const signal = this.activeAbortController.signal;

    try {
      this.isSpeakingState = true;
      this.notify();

      // 1. Check fixed script key or preloaded cache
      let audioUrl: string | null = null;

      if (scriptKey && FIXED_ONBOARD_AUDIO_URLS[scriptKey as OnboardScriptKey]) {
        audioUrl = FIXED_ONBOARD_AUDIO_URLS[scriptKey as OnboardScriptKey];
      } else if (this.preloadCache.has(cleanText)) {
        audioUrl = this.preloadCache.get(cleanText) || null;
      }

      // 2. If not found in fixed map, synthesize live
      if (!audioUrl) {
        audioUrl = await this.synthesizeAudio(cleanText, signal);
        if (audioUrl) {
          this.preloadCache.set(cleanText, audioUrl);
        }
      }

      if (signal.aborted) return;

      if (!audioUrl) {
        this.isSpeakingState = false;
        this.notify();
        return;
      }

      await this.playAudioUrl(audioUrl, signal);
    } catch (err: any) {
      if (err?.name === "AbortError" || signal.aborted) {
        return;
      }
      console.warn("[OnboardDirectorVoice] Speech playback notice:", err);
      this.isSpeakingState = false;
      this.notify();
    }
  }

  private cleanseText(text: string): string {
    return text
      .replace(/^#+\s*/gm, "")
      .replace(/\*\*/g, "")
      .replace(/^[-*•]\s+/gm, "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/<[^>]*>/g, "")
      .replace(/\n+/g, " ")
      .trim();
  }

  private async synthesizeAudio(text: string, signal?: AbortSignal): Promise<string | null> {
    // 1. Primary: ElevenLabs TTS (via direct key or server proxy /api/runtime/execute)
    try {
      const elevenAudio = await generateElevenLabsVoice(
        text,
        this.defaultGuideVoiceId,
        "eleven_multilingual_v2",
        signal
      );
      if (elevenAudio) return elevenAudio;
    } catch (elevenErr: any) {
      if (elevenErr?.name === "AbortError") throw elevenErr;
      console.warn("[OnboardDirectorVoice] ElevenLabs TTS notice, trying fallback:", elevenErr);
    }

    if (signal?.aborted) return null;

    // 2. Fail-soft Fallback: Gemini TTS via server proxy or direct key
    try {
      const apiKey = resolveProviderKey("gemini");
      const modelsToTry = ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash-tts-preview", "gemini-2.0-flash"];

      // 2a. Direct REST
      if (apiKey) {
        for (const model of modelsToTry) {
          if (signal?.aborted) return null;
          try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
            const res = await fetch(endpoint, {
              method: "POST",
              signal,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `Speak as the onboard guide in a friendly, relaxed, calm, helpful tone: ${text.slice(0, 500)}` }] }],
                generationConfig: {
                  responseModalities: ["AUDIO"],
                  speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } } },
                },
              }),
            });
            if (res.ok) {
              const json = await res.json();
              const candidate = json?.candidates?.[0];
              const part = candidate?.content?.parts?.[0];
              if (part && part.inlineData?.data) {
                return this.formatInlineAudio(part.inlineData.data, part.inlineData.mimeType);
              }
            }
          } catch (rErr: any) {
            if (rErr?.name === "AbortError") throw rErr;
          }
        }
      }

      // 2b. Server Proxy
      for (const model of modelsToTry) {
        if (signal?.aborted) return null;
        try {
          const proxyRes = await fetch("/api/runtime/execute", {
            method: "POST",
            signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: "google",
              endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
              payload: {
                contents: [{ parts: [{ text: `Speak as the onboard guide in a friendly, relaxed, calm, helpful tone: ${text.slice(0, 500)}` }] }],
                generationConfig: {
                  responseModalities: ["AUDIO"],
                  speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } } },
                },
              },
            }),
          });
          if (proxyRes.ok) {
            const json = await proxyRes.json();
            const candidate = json?.candidates?.[0];
            const part = candidate?.content?.parts?.[0];
            if (part && part.inlineData?.data) {
              return this.formatInlineAudio(part.inlineData.data, part.inlineData.mimeType);
            }
          }
        } catch (pErr: any) {
          if (pErr?.name === "AbortError") throw pErr;
        }
      }
    } catch (fallbackErr: any) {
      if (fallbackErr?.name === "AbortError") throw fallbackErr;
      console.warn("[OnboardDirectorVoice] Fallback audio notice:", fallbackErr);
    }

    return null;
  }

  private formatInlineAudio(base64Data: string, mimeType?: string): string {
    const mime = (mimeType || "").toLowerCase();
    if (mime.includes("mp3") || mime.includes("mpeg") || mime.includes("ogg") || mime.includes("wav")) {
      return `data:${mimeType || "audio/mp3"};base64,${base64Data}`;
    }

    // Convert raw PCM to standard 44-byte RIFF WAV
    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      let sampleRate = 24000;
      const rateMatch = mime.match(/rate=(\d+)/);
      if (rateMatch && rateMatch[1]) {
        sampleRate = parseInt(rateMatch[1], 10) || 24000;
      }

      const header = new ArrayBuffer(44);
      const view = new DataView(header);
      view.setUint32(0, 0x52494646, false); // "RIFF"
      view.setUint32(4, 36 + len, true);
      view.setUint32(8, 0x57415645, false); // "WAVE"
      view.setUint32(12, 0x666d7420, false); // "fmt "
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM format
      view.setUint16(22, 1, true); // Mono
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true); // 16 bits
      view.setUint32(36, 0x64617461, false); // "data"
      view.setUint32(40, len, true);

      const wavBytes = new Uint8Array(44 + len);
      wavBytes.set(new Uint8Array(header), 0);
      wavBytes.set(bytes, 44);

      let wavBinary = "";
      const chunkSize = 8192;
      for (let i = 0; i < wavBytes.length; i += chunkSize) {
        wavBinary += String.fromCharCode.apply(null, Array.from(wavBytes.subarray(i, i + chunkSize)));
      }
      return `data:audio/wav;base64,${btoa(wavBinary)}`;
    } catch (err) {
      console.warn("[OnboardDirectorVoice] Failed to wrap PCM in WAV header:", err);
      return `data:audio/wav;base64,${base64Data}`;
    }
  }

  private playAudioUrl(url: string, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        this.isSpeakingState = false;
        this.notify();
        resolve();
        return;
      }

      const audio = new Audio(url);
      this.currentAudio = audio;

      const cleanup = () => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        if (url.startsWith("blob:")) {
          try { URL.revokeObjectURL(url); } catch {}
        }
        this.isSpeakingState = false;
        this.notify();
        resolve();
      };

      audio.onended = cleanup;
      audio.onerror = cleanup;

      audio.play().catch((playErr) => {
        console.warn("[OnboardDirectorVoice] playback notice:", playErr);
        cleanup();
      });
    });
  }
}

export const onboardDirectorVoiceService = new OnboardDirectorVoiceService();
