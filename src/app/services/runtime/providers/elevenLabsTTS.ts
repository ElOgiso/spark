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
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/df6788f9-1955-4780-8046-1fc102a80649.mp3",
  },
  {
    voiceId: "AZnzlk1XvdvUeBnXmlld",
    name: "Domi",
    category: "premade",
    labels: { accent: "American", gender: "female", age: "young", description: "energetic" },
    accent: "American (Energetic & Punchy)",
    gender: "female",
    description: "Confident, dynamic pacing for high-tempo hooks and short-form video.",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/AZnzlk1XvdvUeBnXmlld/50dd3000-192e-4a6f-a861-f163f3143236.mp3",
  },
  {
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    name: "Bella",
    category: "premade",
    labels: { accent: "American", gender: "female", age: "young", description: "conversational" },
    accent: "American (Warm Storyteller)",
    gender: "female",
    description: "Warm, conversational host tone with natural narrative modulation.",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/04f36466-8b9f-4321-8329-ff64b72304f7.mp3",
  },
  {
    voiceId: "ErXwobaYiN019PkySvjV",
    name: "Antoni",
    category: "premade",
    labels: { accent: "American", gender: "male", age: "young", description: "clear" },
    accent: "American (Modern Creator)",
    gender: "male",
    description: "Energetic and crisp cadence with natural podcast-host delivery.",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/ErXwobaYiN019PkySvjV/38d8f8f0-0086-4298-b0bc-ba543271e118.mp3",
  },
  {
    voiceId: "MF3mGyEYCl7XYWbV9V6O",
    name: "Elli",
    category: "premade",
    labels: { accent: "American", gender: "female", age: "young", description: "emotional" },
    accent: "American (Natural & Expressive)",
    gender: "female",
    description: "Expressive young narrator voice with nuanced tone shifts.",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/MF3mGyEYCl7XYWbV9V6O/d902ad66-3370-43db-84f2-a3ed177788d7.mp3",
  },
  {
    voiceId: "TxGEqnHWrfWFTfGW9XjX",
    name: "Josh",
    category: "premade",
    labels: { accent: "American", gender: "male", age: "young", description: "deep" },
    accent: "American (Deep & Resonant)",
    gender: "male",
    description: "Deep, smooth male voice tailored for tech teardowns and executive updates.",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/TxGEqnHWrfWFTfGW9XjX/36979207-640a-4a57-8dfa-3f1ab9bebe78.mp3",
  },
  {
    voiceId: "VR6AewLTigWG4xTspXx2",
    name: "Arnold",
    category: "premade",
    labels: { accent: "American", gender: "male", age: "middle_aged", description: "crisp" },
    accent: "American (Executive Delivery)",
    gender: "male",
    description: "Crisp, trend-native executive voice with sharp cadence and clear enunciation.",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/VR6AewLTigWG4xSOukaG/66e83832-9032-4467-9c98-4d57a26f86c2.mp3",
  },
  {
    voiceId: "pNInz6ovD88D3lfl6J3s",
    name: "Adam",
    category: "premade",
    labels: { accent: "American", gender: "male", age: "middle_aged", description: "deep" },
    accent: "American (Deep Executive)",
    gender: "male",
    description: "Authoritative, resonant tone for high-impact hook delivery and strategy breakdowns.",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/6734d750-da3d-429e-9767-4ccf318029db.mp3",
  },
  {
    voiceId: "piTKgcLEGmPE4e6mEKli",
    name: "Nicole",
    category: "premade",
    labels: { accent: "American", gender: "female", age: "young", description: "dynamic" },
    accent: "American (Dynamic Host)",
    gender: "female",
    description: "High-energy pacing perfect for vertical TikTok and YouTube Shorts hooks.",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/piTKgcLEGmPE4e6mEKli/4f4414d2-3011-4770-98e6-e01fa3a0aeaa.mp3",
  },
  {
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    name: "George",
    category: "premade",
    labels: { accent: "British", gender: "male", age: "middle_aged", description: "warm" },
    accent: "British (Warm Storyteller)",
    gender: "male",
    description: "Rich, narrative tone built for long-form case studies and documentary cuts.",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/JBFqnCBsd6RMkjVDRZzb/e6206d1a-0721-4787-acb8-e3a36660834e.mp3",
  },
  {
    voiceId: "XB0fDUnXU5powFXDhCwa",
    name: "Charlotte",
    category: "premade",
    labels: { accent: "Swedish/Global", gender: "female", age: "young", description: "seductive" },
    accent: "Global International (Executive Host)",
    gender: "female",
    description: "Sophisticated global voice for luxury, tech, and design brand narratives.",
    previewUrl: "https://storage.googleapis.com/eleven-public-prod/premade/voices/XB0fDUnXU5powFXDhCwa/942356dc-f10d-4d70-8772-a44e05b57244.mp3",
  },
];

// Session-level in-memory preview audio cache (avoids repeated generation per click)
const sessionVoicePreviewCache = new Map<string, string>();

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
 * Preview TTS for a selected voice ID — instant playback with multi-tier fallback
 */
export async function previewElevenLabsVoice(
  voiceId: string,
  sampleText?: string,
  customKey?: string,
  signal?: AbortSignal
): Promise<string | null> {
  if (!voiceId) return null;

  // 1. In-memory session cache hit (blob URL or base64 data URL)
  if (sessionVoicePreviewCache.has(voiceId)) {
    return sessionVoicePreviewCache.get(voiceId)!;
  }

  const text = sampleText || "Welcome to SPARK. I am ready to scale your media brand with automated high-retention content.";

  // 2. ElevenLabs live API or server proxy synthesis
  try {
    const generated = await generateElevenLabsVoice(text, voiceId, "eleven_multilingual_v2", signal, customKey);
    if (generated) {
      sessionVoicePreviewCache.set(voiceId, generated);
      return generated;
    }
  } catch (err) {
    console.warn("[ElevenLabs] Live preview generation notice:", err);
  }

  // 3. Fall through to pre-recorded curated preview URL if live API/proxy is unreachable
  const matchedCurated = FALLBACK_CURATED_ELEVENLABS_VOICES.find((v) => v.voiceId === voiceId);
  if (matchedCurated?.previewUrl) {
    sessionVoicePreviewCache.set(voiceId, matchedCurated.previewUrl);
    return matchedCurated.previewUrl;
  }

  return null;
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

export async function generateElevenLabsSoundEffect(
  text: string,
  durationSeconds = 1.5,
  signal?: AbortSignal,
  customKey?: string
): Promise<string | null> {
  const apiKey = customKey || resolveProviderKey("elevenlabs");
  if (!apiKey || !text?.trim()) return null;
  if (signal?.aborted) {
    const err = new Error("Generation cancelled by executive");
    err.name = "AbortError";
    throw err;
  }
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: text.trim().slice(0, 200),
        duration_seconds: Math.min(5, Math.max(0.5, durationSeconds)),
      }),
    });
    if (!res.ok) {
      console.warn("[ElevenLabs SFX] API error:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const buf = await res.arrayBuffer();
    if (!buf || buf.byteLength < 32) return null;
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)) as any);
    }
    return `data:audio/mpeg;base64,${btoa(binary)}`;
  } catch (err: any) {
    if (err?.name === "AbortError") throw err;
    console.warn("[ElevenLabs SFX] Provider notice:", err);
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
