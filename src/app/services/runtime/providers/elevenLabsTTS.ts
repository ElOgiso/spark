import { resolveProviderKey } from "../AIProviderOrchestrator";
import { SPARK_EXECUTIVE_VOICE_PROFILE } from "../../geminiService";

export async function generateElevenLabsVoice(
  text: string,
  voiceId?: string,
  modelId?: string
): Promise<string | null> {
  const apiKey = resolveProviderKey("elevenlabs");
  if (!apiKey || !text?.trim()) return null;

  const id = voiceId || SPARK_EXECUTIVE_VOICE_PROFILE.elevenLabsVoiceId || "21m00Tcm4TlvDq8ikWAM";
  const clean = text
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^[-*•]\s+/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim()
    .slice(0, 2500);

  if (!clean) return null;

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}`, {
      method: "POST",
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

    if (!res.ok) {
      console.warn("[ElevenLabsTTS] API notice:", res.status, await res.text().catch(() => ""));
      return null;
    }

    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("[ElevenLabsTTS] Provider notice:", err);
    return null;
  }
}
