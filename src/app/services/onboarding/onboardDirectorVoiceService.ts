/**
 * SPARK Onboard Director Voice Service
 * 
 * Generates and speaks director speech during Brand Genesis / onboard using Gemini TTS.
 * Model: gemini-3.1-flash-tts-preview (with fail-soft fallback to 2.5-flash / 2.0-flash)
 * Voice: Zephyr (fixed default)
 * Personality: friendly, leisure, relaxed, laid-back, calm, helpful onboard guide.
 * 
 * Mute control:
 * - Persisted in localStorage ('spark_onboard_voice_muted')
 * - Immediately stops active playback and suppresses further auto-speech until unmuted.
 */

import { resolveProviderKey } from "../runtime/AIProviderOrchestrator";

export interface DirectorVoiceState {
  isSpeaking: boolean;
  isMuted: boolean;
}

type VoiceListener = (state: DirectorVoiceState) => void;

class OnboardDirectorVoiceService {
  private isMutedState: boolean = false;
  private isSpeakingState: boolean = false;
  private currentAudio: HTMLAudioElement | null = null;
  private activeAbortController: AbortController | null = null;
  private listeners: Set<VoiceListener> = new Set();

  constructor() {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const savedMuted = localStorage.getItem("spark_onboard_voice_muted");
        if (savedMuted !== null) {
          this.isMutedState = savedMuted === "true";
        }
      } catch {}
    }
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
   * Generates and speaks director speech using Gemini TTS (model: gemini-3.1-flash-tts-preview, voice: Zephyr).
   */
  public async speak(text: string): Promise<void> {
    if (this.isMutedState || !text || !text.trim()) {
      return;
    }

    // Stop any existing playback or pending generation
    this.stop();

    const apiKey = resolveProviderKey("gemini");
    if (!apiKey) {
      console.warn("[OnboardDirectorVoice] Gemini API key not found. Skipping auto-speech.");
      return;
    }

    const cleanText = text
      .replace(/^#+\s*/gm, "")
      .replace(/\*\*/g, "")
      .replace(/^[-*•]\s+/gm, "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/<[^>]*>/g, "")
      .replace(/\n+/g, " ")
      .trim();

    if (!cleanText) return;

    this.activeAbortController = new AbortController();
    const signal = this.activeAbortController.signal;

    try {
      this.isSpeakingState = true;
      this.notify();

      const audioDataUrl = await this.generateTtsAudio(cleanText, apiKey, signal);

      if (signal.aborted) return;

      if (!audioDataUrl) {
        this.isSpeakingState = false;
        this.notify();
        return;
      }

      await this.playAudioUrl(audioDataUrl, signal);
    } catch (err: any) {
      if (err?.name === "AbortError" || signal.aborted) {
        return;
      }
      console.warn("[OnboardDirectorVoice] Speech playback notice:", err);
      this.isSpeakingState = false;
      this.notify();
    }
  }

  private async generateTtsAudio(
    text: string,
    apiKey: string,
    signal: AbortSignal
  ): Promise<string | null> {
    const modelsToTry = [
      "gemini-3.1-flash-tts-preview",
      "gemini-2.5-flash-tts-preview",
      "gemini-2.0-flash",
    ];

    // 1. Try @google/genai SDK
    try {
      const { GoogleGenAI, Modality } = await import("@google/genai").catch(() => ({
        GoogleGenAI: null as any,
        Modality: null as any,
      }));

      if (GoogleGenAI) {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { "User-Agent": "aistudio-build" } },
        });

        for (const model of modelsToTry) {
          if (signal.aborted) return null;
          try {
            const response = await ai.models.generateContent({
              model,
              contents: [
                {
                  parts: [
                    {
                      text: `Speak as the onboard guide in a friendly, leisure, relaxed, laid-back, calm, helpful tone (Zephyr): ${text.slice(0, 600)}`,
                    },
                  ],
                },
              ],
              config: {
                responseModalities: [Modality?.AUDIO || "AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: "Zephyr" },
                  },
                },
              },
            });

            const candidate = response?.candidates?.[0];
            const part = candidate?.content?.parts?.[0];

            if (part && "inlineData" in part && part.inlineData?.data) {
              return this.formatInlineAudio(part.inlineData.data, part.inlineData.mimeType);
            }
          } catch (modelErr) {
            console.warn(`[OnboardDirectorVoice] Model ${model} try notice:`, modelErr);
          }
        }
      }
    } catch (sdkErr) {
      console.warn("[OnboardDirectorVoice] SDK init notice:", sdkErr);
    }

    // 2. Direct REST API Fallback
    for (const model of modelsToTry) {
      if (signal.aborted) return null;
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(endpoint, {
          method: "POST",
          signal,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Speak as the onboard guide in a friendly, leisure, relaxed, laid-back, calm, helpful tone (Zephyr): ${text.slice(0, 600)}`,
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Zephyr" },
                },
              },
            },
          }),
        });

        if (!res.ok) continue;

        const json = await res.json();
        const candidate = json?.candidates?.[0];
        const part = candidate?.content?.parts?.[0];

        if (part && part.inlineData?.data) {
          return this.formatInlineAudio(part.inlineData.data, part.inlineData.mimeType);
        }
      } catch (restErr: any) {
        if (restErr?.name === "AbortError") throw restErr;
      }
    }

    return null;
  }

  private formatInlineAudio(base64Data: string, mimeType?: string): string {
    const mime = (mimeType || "").toLowerCase();

    // If containerized (mp3, standard wav, ogg), return base64 data URL
    if (mime.includes("mp3") || mime.includes("mpeg") || mime.includes("ogg") || mime.includes("wav")) {
      return `data:${mimeType || "audio/mp3"};base64,${base64Data}`;
    }

    // Convert raw PCM (typically 24000Hz 16-bit Mono) to standard WAV base64 data URL
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

      // "RIFF" chunk
      view.setUint32(0, 0x52494646, false);
      view.setUint32(4, 36 + len, true);
      view.setUint32(8, 0x57415645, false); // "WAVE"

      // "fmt " chunk
      view.setUint32(12, 0x666d7420, false);
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM format
      view.setUint16(22, 1, true); // Mono
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true); // 16 bits

      // "data" chunk
      view.setUint32(36, 0x64617461, false);
      view.setUint32(40, len, true);

      const wavBytes = new Uint8Array(44 + len);
      wavBytes.set(new Uint8Array(header), 0);
      wavBytes.set(bytes, 44);

      let wavBinary = "";
      const chunkSize = 8192;
      for (let i = 0; i < wavBytes.length; i += chunkSize) {
        wavBinary += String.fromCharCode.apply(null, Array.from(wavBytes.subarray(i, i + chunkSize)));
      }
      const wavBase64 = btoa(wavBinary);
      return `data:audio/wav;base64,${wavBase64}`;
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
