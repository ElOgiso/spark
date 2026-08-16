import { resolveProviderKey } from "../AIProviderOrchestrator";
import { SPARK_EXECUTIVE_VOICE_PROFILE } from "../../geminiService";

export interface ElevenLabsVoiceSummary {
  voiceId: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  description?: string;
  previewUrl?: string;
  accent?: string;
  gender?: string;
}

export const FALLBACK_CURATED_ELEVENLABS_VOICES: ElevenLabsVoiceSummary[] = [
  {
    voiceId: "21m00Tcm4TlvDq8ikWAM",
    name: "Rachel",
    category: "premade",
    labels: { accent: "American", gender: "female", age: "young", description: "calm" },
    accent: "American (Calm & Professional)",
    gender: "female",
    description: "Clear, reassuring executive narrator voice ideal for direct explainers.",
  },
  {
    voiceId: "pNInz6obpgDQGcFmaJgB",
    name: "Adam",
    category: "premade",
    labels: { accent: "American", gender: "male", age: "middle_aged", description: "deep" },
    accent: "American (Deep Executive)",
    gender: "male",
    description: "Authoritative, resonant tone for high-impact hook delivery and strategy breakdowns.",
  },
  {
    voiceId: "ErXwobaYiN019PkySvjV",
    name: "Antoni",
    category: "premade",
    labels: { accent: "American", gender: "male", age: "young", description: "clear" },
    accent: "American (Modern Creator)",
    gender: "male",
    description: "Energetic and crisp cadence with natural podcast-host cadence.",
  },
  {
    voiceId: "piTKgcLEGmPE4e6mEKli",
    name: "Nicole",
    category: "premade",
    labels: { accent: "American", gender: "female", age: "young", description: "dynamic" },
    accent: "American (Dynamic Host)",
    gender: "female",
    description: "High-energy pacing perfect for vertical TikTok and YouTube Shorts hooks.",
  },
  {
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    name: "George",
    category: "premade",
    labels: { accent: "British", gender: "male", age: "middle_aged", description: "warm" },
    accent: "British (Warm Storyteller)",
    gender: "male",
    description: "Rich, narrative tone built for long-form case studies and documentary cuts.",
  },
  {
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    name: "Sarah",
    category: "premade",
    labels: { accent: "American", gender: "female", age: "young", description: "confident" },
    accent: "American (Confident Presenter)",
    gender: "female",
    description: "Engaging, authoritative host voice with excellent rhythmic modulation.",
  },
  {
    voiceId: "nPczCjzI2devNBz1zQrb",
    name: "Brian",
    category: "premade",
    labels: { accent: "American", gender: "male", age: "middle_aged", description: "deep" },
    accent: "American (Documentary Voice)",
    gender: "male",
    description: "Deep cinematic weight for viral dramatic hooks and brand story films.",
  },
  {
    voiceId: "XB0fDUnXU5powFXDhCwa",
    name: "Charlotte",
    category: "premade",
    labels: { accent: "Swedish/Global", gender: "female", age: "young", description: "seductive" },
    accent: "Global International (Executive Host)",
    gender: "female",
    description: "Sophisticated global voice for luxury, tech, and design brand narratives.",
  },
];

/**
 * Fetch available voices from ElevenLabs API (direct or server proxy) or fallback to curated list
 */
export async function getElevenLabsVoices(customKey?: string): Promise<{ voices: ElevenLabsVoiceSummary[]; isLiveApi: boolean }> {
  const apiKey = customKey || resolveProviderKey("elevenlabs");

  // 1. Direct client fetch if key is present
  if (apiKey) {
    try {
      const res = await fetch("https://api.elevenlabs.io/v1/voices", {
        method: "GET",
        headers: {
          "xi-api-key": apiKey,
          Accept: "application/json",
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.voices && Array.isArray(data.voices)) {
          const mapped: ElevenLabsVoiceSummary[] = data.voices.map((v: any) => ({
            voiceId: v.voice_id,
            name: v.name,
            category: v.category || "library",
            labels: v.labels || {},
            description: v.description || (v.labels ? Object.values(v.labels).join(" · ") : "Narrator Voice"),
            previewUrl: v.preview_url || undefined,
            accent: v.labels?.accent ? `${v.labels.accent} (${v.labels?.gender || "Voice"})` : v.name,
            gender: v.labels?.gender || "neutral",
          }));
          if (mapped.length > 0) {
            return { voices: mapped, isLiveApi: true };
          }
        }
      }
    } catch (err) {
      console.warn("[ElevenLabs] Direct voices fetch error:", err);
    }
  }

  // 2. Server Proxy Fallback via /api/runtime/execute (uses Vercel server-side ELEVENLABS_API_KEY)
  try {
    const proxyRes = await fetch("/api/runtime/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "elevenlabs",
        endpoint: "https://api.elevenlabs.io/v1/voices",
        method: "GET",
      }),
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data?.voices && Array.isArray(data.voices)) {
        const mapped: ElevenLabsVoiceSummary[] = data.voices.map((v: any) => ({
          voiceId: v.voice_id,
          name: v.name,
          category: v.category || "library",
          labels: v.labels || {},
          description: v.description || (v.labels ? Object.values(v.labels).join(" · ") : "Narrator Voice"),
          previewUrl: v.preview_url || undefined,
          accent: v.labels?.accent ? `${v.labels.accent} (${v.labels?.gender || "Voice"})` : v.name,
          gender: v.labels?.gender || "neutral",
        }));
        if (mapped.length > 0) {
          return { voices: mapped, isLiveApi: true };
        }
      }
    }
  } catch (proxyErr) {
    console.warn("[ElevenLabs] Server proxy voices listing error:", proxyErr);
  }

  return { voices: FALLBACK_CURATED_ELEVENLABS_VOICES, isLiveApi: false };
}

/**
 * Preview TTS for a selected voice ID
 */
export async function previewElevenLabsVoice(
  voiceId: string,
  sampleText?: string,
  customKey?: string,
  signal?: AbortSignal
): Promise<string | null> {
  const text = sampleText || "Welcome to SPARK. I am ready to scale your media brand with automated high-retention content.";
  return generateElevenLabsVoice(text, voiceId, "eleven_multilingual_v2", signal, customKey);
}

/**
 * ElevenLabs Voice Design (text-to-voice)
 * Generates sample previews from a text description
 */
export async function designElevenLabsVoice(params: {
  description: string;
  sampleText?: string;
  customKey?: string;
  signal?: AbortSignal;
}): Promise<{ previews: { generated_voice_id: string; audio_base_64: string; previewUrl: string }[] } | null> {
  const apiKey = params.customKey || resolveProviderKey("elevenlabs");
  if (!apiKey || !params.description?.trim()) return null;

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/text-to-voice/design", {
      method: "POST",
      signal: params.signal,
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
        Accept: "application/json",
      },
      body: JSON.stringify({
        model_id: "eleven_multilingual_ttv_v2",
        voice_description: params.description.trim(),
        text: params.sampleText || "Welcome to SPARK. This voice is designed specifically for your brand.",
      }),
    });

    if (!res.ok) {
      console.warn("[ElevenLabs Voice Design] API error:", res.status, await res.text().catch(() => ""));
      return null;
    }

    const data = await res.json();
    if (!data?.previews || !Array.isArray(data.previews)) return null;

    const mapped = data.previews.map((p: any) => {
      const b64 = p.audio_base_64 || "";
      const dataUrl = b64.startsWith("data:") ? b64 : `data:audio/mpeg;base64,${b64}`;
      return {
        generated_voice_id: p.generated_voice_id,
        audio_base_64: b64,
        previewUrl: dataUrl,
      };
    });

    return { previews: mapped };
  } catch (err) {
    if ((err as any)?.name === "AbortError") throw err;
    console.warn("[ElevenLabs Voice Design] Provider notice:", err);
    return null;
  }
}

/**
 * ElevenLabs Voice Design Creation (saves a designed preview to voice library)
 */
export async function createDesignedElevenLabsVoice(params: {
  voiceName: string;
  voiceDescription: string;
  generatedVoiceId: string;
  customKey?: string;
}): Promise<{ voice_id: string } | null> {
  const apiKey = params.customKey || resolveProviderKey("elevenlabs");
  if (!apiKey || !params.generatedVoiceId) return null;

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/text-to-voice/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
        Accept: "application/json",
      },
      body: JSON.stringify({
        voice_name: params.voiceName || "Brand Narrator Voice",
        voice_description: params.voiceDescription || "Custom AI Voice designed in SPARK onboarding",
        generated_voice_id: params.generatedVoiceId,
      }),
    });

    if (!res.ok) {
      console.warn("[ElevenLabs Voice Create] API error:", res.status, await res.text().catch(() => ""));
      return null;
    }

    const data = await res.json();
    return { voice_id: data.voice_id || params.generatedVoiceId };
  } catch (err) {
    console.warn("[ElevenLabs Voice Create] Provider notice:", err);
    return null;
  }
}

/**
 * Synthesizes speech with ElevenLabs TTS, respecting optional AbortSignal
 */
export async function generateElevenLabsVoice(
  text: string,
  voiceId?: string,
  modelId?: string,
  signal?: AbortSignal,
  customKey?: string
): Promise<string | null> {
  const apiKey = customKey || resolveProviderKey("elevenlabs");

  const id = voiceId || SPARK_EXECUTIVE_VOICE_PROFILE.elevenLabsVoiceId || "21m00Tcm4TlvDq8ikWAM";
  const clean = text
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^[-*•]\s+/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim()
    .slice(0, 2500);

  if (!clean) return null;

  if (signal?.aborted) {
    const err = new Error("Generation cancelled by executive");
    err.name = "AbortError";
    throw err;
  }

  // 1. Direct client call if key available
  if (apiKey) {
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}`, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: clean,
          model_id: modelId || "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
            style: 0.35,
            use_speaker_boost: true,
          },
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        return await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      } else {
        console.warn("[ElevenLabsTTS] Direct API notice:", res.status);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") throw err;
      console.warn("[ElevenLabsTTS] Direct fetch notice:", err);
    }
  }

  // 2. Server Proxy Fallback via /api/runtime/execute (uses Vercel server-side ELEVENLABS_API_KEY)
  try {
    const proxyRes = await fetch("/api/runtime/execute", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "elevenlabs",
        endpoint: `https://api.elevenlabs.io/v1/text-to-speech/${id}`,
        payload: {
          text: clean,
          model_id: modelId || "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
            style: 0.35,
            use_speaker_boost: true,
          },
        },
      }),
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data.dataUrl) return data.dataUrl;
      if (data.audioBase64) return `data:audio/mpeg;base64,${data.audioBase64}`;
    }
  } catch (proxyErr: any) {
    if (proxyErr?.name === "AbortError") throw proxyErr;
    console.warn("[ElevenLabsTTS] Server proxy notice:", proxyErr);
  }

  return null;
}
