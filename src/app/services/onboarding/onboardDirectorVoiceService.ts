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

class OnboardDirectorVoiceService {
  private isMutedState: boolean = false;
  private isSpeakingState: boolean = false;
  private currentAudio: HTMLAudioElement | null = null;
  private activeAbortController: AbortController | null = null;
  private listeners: Set<VoiceListener> = new Set();
  private preloadCache: Map<string, string> = new Map();
  private preloadingPromises: Map<string, Promise<string | null>> = new Map();
  private pendingAutoplaySpeech: string | null = null;
  private gestureListenerAttached: boolean = false;

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

    if (typeof window !== "undefined") {
      this.attachUserGestureListener();
    }
  }

  private attachUserGestureListener() {
    if (this.gestureListenerAttached || typeof window === "undefined") return;
    this.gestureListenerAttached = true;

    const onFirstGesture = () => {
      window.removeEventListener("click", onFirstGesture);
      window.removeEventListener("touchstart", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
      this.gestureListenerAttached = false;

      // If speech was blocked by autoplay, speak now
      if (this.pendingAutoplaySpeech && !this.isMutedState) {
        const textToSpeak = this.pendingAutoplaySpeech;
        this.pendingAutoplaySpeech = null;
        void this.speak(textToSpeak);
      }
    };

    window.addEventListener("click", onFirstGesture, { once: true, passive: true });
    window.addEventListener("touchstart", onFirstGesture, { once: true, passive: true });
    window.addEventListener("keydown", onFirstGesture, { once: true, passive: true });
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
      this.pendingAutoplaySpeech = null;
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
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    if (this.isSpeakingState) {
      this.isSpeakingState = false;
      this.notify();
    }
  }

  /**
   * Pre-fetches audio synthesis in background so step entry speech is fast
   */
  public async preload(textOrKey: string, scriptKey?: string): Promise<void> {
    if (!textOrKey || !textOrKey.trim()) return;

    const cleanText = this.cleanseText(textOrKey);
    if (!cleanText) return;

    if (this.preloadCache.has(cleanText)) {
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
   * Speaks director speech with resilient multi-tier fallback:
   * Tier 1: ElevenLabs TTS
   * Tier 2: Gemini TTS
   * Tier 3: Native Web Speech Synthesis
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

      let audioUrl: string | null = null;
      if (this.preloadCache.has(cleanText)) {
        audioUrl = this.preloadCache.get(cleanText) || null;
      }

      // Synthesize if not in cache
      if (!audioUrl) {
        audioUrl = await this.synthesizeAudio(cleanText, signal);
        if (audioUrl) {
          this.preloadCache.set(cleanText, audioUrl);
        }
      }

      if (signal.aborted) return;

      if (audioUrl) {
        const playedSuccessfully = await this.playAudioUrl(audioUrl, signal);
        if (playedSuccessfully || signal.aborted) {
          return;
        }
      }

      // Fallback: Web Speech Synthesis API
      if (!signal.aborted) {
        await this.speakWithWebSpeech(cleanText, signal);
      }
    } catch (err: any) {
      if (err?.name === "AbortError" || signal.aborted) {
        return;
      }
      console.warn("[OnboardDirectorVoice] Primary TTS failed, trying Web Speech fallback:", err);
      if (!signal.aborted) {
        await this.speakWithWebSpeech(cleanText, signal);
      }
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
    // 1. Primary: ElevenLabs TTS
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
      console.warn("[OnboardDirectorVoice] ElevenLabs TTS notice, trying Gemini:", elevenErr);
    }

    if (signal?.aborted) return null;

    // 2. Secondary: Gemini TTS
    try {
      const apiKey = resolveProviderKey("gemini");
      const modelsToTry = ["gemini-2.0-flash", "gemini-2.5-flash-tts-preview"];

      // Direct REST
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
                contents: [{ parts: [{ text: `Speak in a calm, confident, helpful creative director tone: ${text.slice(0, 400)}` }] }],
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

      // Server Proxy
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
                contents: [{ parts: [{ text: `Speak in a calm, confident, helpful creative director tone: ${text.slice(0, 400)}` }] }],
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
    }

    return null;
  }

  private formatInlineAudio(base64Data: string, mimeType?: string): string {
    const mime = (mimeType || "").toLowerCase();
    if (mime.includes("mp3") || mime.includes("mpeg") || mime.includes("ogg") || mime.includes("wav")) {
      return `data:${mimeType || "audio/mp3"};base64,${base64Data}`;
    }

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
      return `data:audio/wav;base64,${base64Data}`;
    }
  }

  private playAudioUrl(url: string, signal: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        this.isSpeakingState = false;
        this.notify();
        resolve(false);
        return;
      }

      const audio = new Audio(url);
      this.currentAudio = audio;

      let hasEnded = false;
      const cleanup = (success: boolean) => {
        if (hasEnded) return;
        hasEnded = true;
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        if (url.startsWith("blob:")) {
          try { URL.revokeObjectURL(url); } catch {}
        }
        this.isSpeakingState = false;
        this.notify();
        resolve(success);
      };

      audio.onended = () => cleanup(true);
      audio.onerror = () => cleanup(false);

      audio.play().catch((playErr: any) => {
        // Autoplay policy was triggered before user interaction
        if (playErr?.name === "NotAllowedError" || String(playErr).includes("interact")) {
          this.pendingAutoplaySpeech = ONBOARD_FIXED_SCRIPTS.welcome_super_spark;
          this.attachUserGestureListener();
        }
        cleanup(false);
      });
    });
  }

  private speakWithWebSpeech(text: string, signal: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
      if (signal.aborted || typeof window === "undefined" || !window.speechSynthesis) {
        this.isSpeakingState = false;
        this.notify();
        resolve(false);
        return;
      }

      try {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.02;
        utterance.pitch = 1.05;

        // Try selecting a clean English voice
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(
          (v) =>
            (v.name.includes("Samantha") ||
              v.name.includes("Natural") ||
              v.name.includes("Jenny") ||
              v.name.includes("Google US English") ||
              v.name.includes("Victoria") ||
              v.lang === "en-US") &&
            v.lang.startsWith("en")
        );
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onstart = () => {
          this.isSpeakingState = true;
          this.notify();
        };

        const finish = (success: boolean) => {
          this.isSpeakingState = false;
          this.notify();
          resolve(success);
        };

        utterance.onend = () => finish(true);
        utterance.onerror = (e) => {
          if (e.error === "not-allowed") {
            this.pendingAutoplaySpeech = text;
            this.attachUserGestureListener();
          }
          finish(false);
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        this.isSpeakingState = false;
        this.notify();
        resolve(false);
      }
    });
  }
}

export const onboardDirectorVoiceService = new OnboardDirectorVoiceService();
