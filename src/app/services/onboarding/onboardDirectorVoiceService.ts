import { generateElevenLabsVoice } from "../runtime/providers/elevenLabsTTS";
import { resolveProviderKey } from "../runtime/AIProviderOrchestrator";
import { supabase } from "../../backend/supabaseClient";

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
  private pendingAutoplayScriptKey: string | undefined = undefined;
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

      // If speech was blocked by autoplay, speak the queued text/scriptKey
      if (this.pendingAutoplaySpeech && !this.isMutedState) {
        const textToSpeak = this.pendingAutoplaySpeech;
        const keyToSpeak = this.pendingAutoplayScriptKey;
        this.pendingAutoplaySpeech = null;
        this.pendingAutoplayScriptKey = undefined;
        void this.speak(textToSpeak, keyToSpeak);
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

      // Check Supabase Storage cache for fixed director script keys
      if (!audioUrl && scriptKey) {
        audioUrl = await this.getCachedStorageAudio(scriptKey);
      }

      // Synthesize via ElevenLabs if not in cache
      if (!audioUrl) {
        audioUrl = await this.synthesizeAudio(cleanText, scriptKey, signal);
        if (audioUrl) {
          this.preloadCache.set(cleanText, audioUrl);
        }
      }

      if (signal.aborted) return;

      if (audioUrl) {
        const playedSuccessfully = await this.playAudioUrl(audioUrl, cleanText, scriptKey, signal);
        if (playedSuccessfully || signal.aborted) {
          return;
        }
      }

      // If playback failed or audioUrl was null, notify state of failure (no WebSpeech fallback)
      console.warn("[OnboardDirectorVoice] Audio playback failed or ElevenLabs audio unavailable.");
      this.isSpeakingState = false;
      this.notify();
    } catch (err: any) {
      if (err?.name === "AbortError" || signal.aborted) {
        return;
      }
      console.error("[OnboardDirectorVoice] ElevenLabs speech generation failed:", err);
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

  private async getCachedStorageAudio(scriptKey: string): Promise<string | null> {
    if (!supabase) return null;
    try {
      const storagePath = `director_audio/${this.defaultGuideVoiceId}_${scriptKey}.mp3`;
      const { data } = supabase.storage.from("Spark").getPublicUrl(storagePath);
      if (data?.publicUrl) {
        // Verify clip exists via HEAD check
        const res = await fetch(data.publicUrl, { method: "HEAD" });
        if (res.ok) {
          return data.publicUrl;
        }
      }
    } catch (err) {
      console.warn("[OnboardDirectorVoice] Storage audio check notice:", err);
    }
    return null;
  }

  private async synthesizeAudio(text: string, scriptKey?: string, signal?: AbortSignal): Promise<string | null> {
    // ElevenLabs TTS (Exclusive for SPARK director voice)
    try {
      const elevenAudio = await generateElevenLabsVoice(
        text,
        this.defaultGuideVoiceId,
        "eleven_multilingual_v2",
        signal
      );

      if (elevenAudio) {
        // Asynchronously cache to Supabase Storage if scriptKey provided
        if (supabase && scriptKey) {
          void (async () => {
            try {
              const res = await fetch(elevenAudio);
              const blob = await res.blob();
              const storagePath = `director_audio/${this.defaultGuideVoiceId}_${scriptKey}.mp3`;
              await supabase.storage.from("Spark").upload(storagePath, blob, {
                upsert: true,
                contentType: "audio/mp3"
              });
            } catch (uErr) {
              console.warn("[OnboardDirectorVoice] Upload to Supabase Storage notice:", uErr);
            }
          })();
        }
        return elevenAudio;
      }
    } catch (elevenErr: any) {
      if (elevenErr?.name === "AbortError") throw elevenErr;
      console.error("[OnboardDirectorVoice] ElevenLabs TTS error:", elevenErr);
    }

    return null;
  }

  private playAudioUrl(url: string, textToSpeak: string, scriptKey: string | undefined, signal: AbortSignal): Promise<boolean> {
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
        this.isSpeakingState = false;
        this.notify();
        resolve(success);
      };

      audio.onended = () => cleanup(true);
      audio.onerror = () => cleanup(false);

      audio.play().catch((playErr: any) => {
        // Autoplay policy was triggered before user interaction
        if (playErr?.name === "NotAllowedError" || String(playErr).includes("interact")) {
          console.warn("[OnboardDirectorVoice] Autoplay blocked by browser. Queuing exact script for user gesture.");
          this.pendingAutoplaySpeech = textToSpeak;
          this.pendingAutoplayScriptKey = scriptKey;
          this.attachUserGestureListener();
        }
        cleanup(false);
      });
    });
  }
}

export const onboardDirectorVoiceService = new OnboardDirectorVoiceService();
