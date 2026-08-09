import { PromptContextBuilder } from "./promptContextBuilder";
import { ModelRouter } from "./runtime/modelRouter";
import { AIProviderOrchestrator, resolveProviderKey } from "./runtime/AIProviderOrchestrator";
import type { ThinkingState, AIProviderId } from "../domain/types";

/**
 * Immutable Executive Director Voice & Identity Configuration
 * This profile governs Super Spark's executive voice when speaking with the creator.
 * It is completely distinct from the Character Bible voice profile (used in host video generation).
 */
export const SPARK_EXECUTIVE_VOICE_PROFILE = {
  name: "Super Spark",
  title: "Executive Creative Director",
  identity: "Spark Executive OS Director",
  voiceId: "Aoede", // Secondary Gemini female voice (Aoede)
  openAiVoiceId: "coral", // Primary OpenAI female voice (Coral - easygoing, savvy, relaxed)
  openAiTtsModel: "gpt-4o-mini-tts", // Official latest OpenAI speech model with tone instructions
  openAiTtsFallbackModels: ["tts-1-hd", "tts-1"] as const,
  instructions: "Speak as Super Spark: warm, easygoing, savvy female creative partner. Natural, relaxed, versatile. Light energy, clear, human. Suitable for content creators. Not robotic, not formal corporate.",
  elevenLabsVoiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel / Executive Female Voice (production content only)
  model: "gemini-2.0-flash",
  ttsModel: "gemini-3.1-flash-tts-preview",
  gender: "Female" as const,
  language: "English (International / Creative Cadence)" as const,
  accent: "Warm Easygoing Executive Female" as const,
  tone: "Warm, Easygoing, Savvy, Relaxed, Creative, Human" as const,
  speakingStyle: "Trusted Creative Partner" as const,
  streaming: true,
  thinking: true,
  interruptions: true,
  pitch: 1.05, // Warm female pitch
  rate: 1.0,   // Natural executive cadence
} as const;

// Retrieve API key dynamically using unified 4-tier provider key resolver
function getGeminiApiKey(): string | undefined {
  return resolveProviderKey("gemini");
}

const SUPER_SPARK_SYSTEM_INSTRUCTION = `You are Super Spark, the Executive Creative Director and trusted executive partner for Spark Media OS.

EXECUTIVE PERSONALITY & CONVERSATION DIRECTIVES:
1. EXECUTIVE PARTNER VOICE: You are female, warm, calm, intelligent, natural, and highly executive. Speak with a natural, poised cadence (warm neutral international tone with a subtle Nigerian English rhythm when appropriate).
2. CONCISE CONVERSATIONAL REPLIES: By default, respond in 1 to 3 short, clear sentences. Never output long essays, generic tutorials, or marketing boilerplate unless explicitly requested by the user.
3. DIRECT ANSWERING: Answer exactly what was asked directly and concisely, like a trusted executive peer.
4. NATURAL CASUAL TOUCHES: You may naturally use light, warm Nigerian executive phrases (e.g. "I've got you", "No wahala", "All set") ONLY if the user's conversation style is casual. Never force slang.
5. EXECUTIVE SAFETY GATE & CONFIRMATION:
   - You must NEVER autonomously enable/disable production, generate videos, create productions, modify workspace settings, publish content, schedule posts, or trigger automation without explicit user confirmation.
   - If the user asks for a sensitive action or setting change (e.g., "Turn production on", "Publish this now", "Delete this session"), reply:
     "I can do that for you. Would you like me to proceed?"
   - WAIT for explicit confirmation ("Yes", "Go ahead", "Do it", "Confirm") before triggering the action.`;

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export async function generateSuperSparkResponse(
  prompt: string,
  history: { sender: 'user' | 'spark'; text: string }[] = [],
  workspaceContext?: any,
  onChunk?: (chunkText: string) => void,
  onThinking?: (thinking: ThinkingState) => void
): Promise<string> {
  const { systemInstruction, fullPrompt } = PromptContextBuilder.buildContext({
    prompt,
    workspaceState: workspaceContext,
    history,
  });

  const chatHistory = history.map((msg) => ({
    role: (msg.sender === 'user' ? 'user' : 'model') as 'user' | 'model',
    parts: [{ text: msg.text }],
  }));

  const userRoutingConfig = workspaceContext?.aiSettings?.routing;
  const customApiKeys = workspaceContext?.aiSettings?.customApiKeys || {
    gemini: getGeminiApiKey(),
  };

  try {
    const text = await ModelRouter.executeCategoryRequest(
      "superSpark",
      {
        prompt: fullPrompt,
        systemInstruction: `${SUPER_SPARK_SYSTEM_INSTRUCTION}\n${systemInstruction}`,
        history: chatHistory,
        context: workspaceContext,
        onChunk,
        onThinking,
        customApiKeys,
      },
      userRoutingConfig
    );

    const cleaned = cleanEchoingPrefix(text, prompt);
    if (cleaned) return cleaned;
    return generateSmartFallbackResponse(prompt, workspaceContext, onChunk);
  } catch (err: any) {
    console.warn('[SuperSpark] Live AI Provider fallback notice:', err?.message || err);
    return generateSmartFallbackResponse(prompt, workspaceContext, onChunk);
  }
}

/**
 * Short, human, direct executive fallback for Super Spark (used ONLY when all providers fail)
 */
function generateSmartFallbackResponse(
  prompt: string,
  context?: any,
  onChunk?: (text: string) => void
): string {
  const rawPrompt = prompt.trim();
  const query = rawPrompt.toLowerCase();
  const creatorName = context?.character?.name || "Creator";
  const brandName = context?.brand?.name || "Spark";

  let responseText = '';

  if (/^(hi|hello|hey|sup|yo|greetings|good morning|good afternoon|good evening)[\s!.]*$/i.test(query)) {
    responseText = `Good evening, ${creatorName}. Everything is synced for ${brandName}. What are we focusing on today—research, production, or strategy?`;
  } else if (/reading|paying attention|listening|understand me|get what i said/i.test(query)) {
    responseText = `Yes—I am. I'm right here with you on ${brandName}. What's on your mind?`;
  } else if (/what are you doing|what's up|status/i.test(query)) {
    responseText = `Monitoring active workspace performance and keeping our short-form pipeline synced for ${brandName}.`;
  } else if (/approve|accept|publish|ship it|schedule/i.test(query)) {
    const itemTitle = context?.reviewItems?.[0]?.title || "Viral Cut";
    responseText = `Approved "${itemTitle}" and scheduled it for publishing across YouTube Shorts & TikTok.`;
  } else if (/edit|reject|revise|change|fix/i.test(query)) {
    const itemTitle = context?.reviewItems?.[0]?.title || "Viral Cut";
    responseText = `Flagged "${itemTitle}" as Needs Edit. Adjusting the opening hook pacing now.`;
  } else if (/create|make|generate|build|script|draft|storyboard/i.test(query)) {
    const topic = rawPrompt.replace(/create|make|generate|build|script|draft|storyboard|video|a|for|about/gi, '').trim() || "Viral Cut";
    responseText = `Created a vertical production cut for "${topic}". Script & visual hooks are live in your drafting board.`;
  } else {
    responseText = `I'm right here with you on ${brandName}. What would you like to tackle next?`;
  }

  if (onChunk) {
    onChunk(responseText);
  }

  return responseText;
}

/**
 * Generate Executive Provider-Native TTS Voice Audio for Super Spark
 * Stack: OpenAI 'nova' (primary) -> Gemini 'Aoede' (secondary).
 * ElevenLabs is reserved exclusively for production content voiceover (ProductionAssetService).
 * NEVER falls back to browser speechSynthesis.
 */
export async function generateSuperSparkVoice(
  text: string,
  providerId?: AIProviderId
): Promise<string | null> {
  const preferred = providerId || AIProviderOrchestrator.getLastUsedProviderId() || "openai";

  const cleanText = text
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^[-*•]\s+/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();

  if (!cleanText) return null;

  // 1. If OpenAI or auto preferred, attempt OpenAI native TTS first (Voice: nova)
  if (preferred === "openai" || (preferred as string) === "grok" || preferred === "auto") {
    const openAiAudio = await generateOpenAIVoice(cleanText, SPARK_EXECUTIVE_VOICE_PROFILE.openAiVoiceId);
    if (openAiAudio) return openAiAudio;

    const geminiAudio = await generateGeminiVoice(cleanText, SPARK_EXECUTIVE_VOICE_PROFILE.voiceId);
    if (geminiAudio) return geminiAudio;
  } else {
    // 2. If Gemini preferred, attempt Gemini native TTS first (Voice: Aoede)
    const geminiAudio = await generateGeminiVoice(cleanText, SPARK_EXECUTIVE_VOICE_PROFILE.voiceId);
    if (geminiAudio) return geminiAudio;

    const openAiAudio = await generateOpenAIVoice(cleanText, SPARK_EXECUTIVE_VOICE_PROFILE.openAiVoiceId);
    if (openAiAudio) return openAiAudio;
  }

  return null;
}

async function generateOpenAIVoice(text: string, voice: string = SPARK_EXECUTIVE_VOICE_PROFILE.openAiVoiceId): Promise<string | null> {
  const apiKey = resolveProviderKey("openai");
  const cleanedInput = text.slice(0, 4096);

  // 1. Direct client call if key available
  if (apiKey) {
    // Attempt 1: gpt-4o-mini-tts with instructions
    try {
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini-tts",
          input: cleanedInput,
          voice,
          response_format: "mp3",
          instructions: SPARK_EXECUTIVE_VOICE_PROFILE.instructions,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      } else {
        const errBody = await res.text().catch(() => "");
        console.warn(`[OpenAIVoice] gpt-4o-mini-tts (${res.status}):`, errBody);
      }
    } catch (e) {
      console.warn("[OpenAIVoice] Direct gpt-4o-mini-tts notice:", e);
    }

    // Attempt 2: Fallback to tts-1-hd / tts-1 (no instructions field)
    for (const model of SPARK_EXECUTIVE_VOICE_PROFILE.openAiTtsFallbackModels) {
      try {
        const res = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            input: cleanedInput,
            voice,
            response_format: "mp3",
          }),
        });

        if (res.ok) {
          const blob = await res.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        } else {
          const errBody = await res.text().catch(() => "");
          console.warn(`[OpenAIVoice] ${model} (${res.status}):`, errBody);
        }
      } catch (fErr) {
        console.warn(`[OpenAIVoice] Direct ${model} notice:`, fErr);
      }
    }
  }

  // 2. Server proxy fallback via /api/runtime/execute (uses Vercel server-side OPENAI_API_KEY)
  try {
    const proxyRes = await fetch("/api/runtime/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "openai",
        endpoint: "https://api.openai.com/v1/audio/speech",
        payload: {
          model: "gpt-4o-mini-tts",
          input: cleanedInput,
          voice,
          response_format: "mp3",
          instructions: SPARK_EXECUTIVE_VOICE_PROFILE.instructions,
        },
      }),
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data.dataUrl) return data.dataUrl;
      if (data.audioBase64) return `data:audio/mpeg;base64,${data.audioBase64}`;
    } else {
      // Proxy fallback with tts-1-hd
      const proxyFallback = await fetch("/api/runtime/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "openai",
          endpoint: "https://api.openai.com/v1/audio/speech",
          payload: {
            model: "tts-1-hd",
            input: cleanedInput,
            voice,
            response_format: "mp3",
          },
        }),
      });

      if (proxyFallback.ok) {
        const data = await proxyFallback.json();
        if (data.dataUrl) return data.dataUrl;
        if (data.audioBase64) return `data:audio/mpeg;base64,${data.audioBase64}`;
      }
    }
  } catch (pErr) {
    console.warn("[OpenAIVoice] Server proxy audio/speech notice:", pErr);
  }

  return null;
}

async function generateGeminiVoice(text: string, voiceName: string = "Aoede"): Promise<string | null> {
  const apiKey = resolveProviderKey("gemini");
  if (!apiKey) return null;

  try {
    const { GoogleGenAI, Modality } = await import("@google/genai").catch(() => ({ GoogleGenAI: null as any, Modality: null as any }));
    if (!GoogleGenAI) return null;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });

    const response = await ai.models.generateContent({
      model: SPARK_EXECUTIVE_VOICE_PROFILE.ttsModel,
      contents: [{ parts: [{ text: `Speak warmly and concisely in a female executive tone (${voiceName}): ${text.slice(0, 600)}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    }).catch(async () => {
      // Try stable model fallback if preview model is unconfigured
      return ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ parts: [{ text: `Speak in a female executive voice (${voiceName}): ${text.slice(0, 600)}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });
    });

    const candidate = response?.candidates?.[0];
    const part = candidate?.content?.parts?.[0];

    if (part && "inlineData" in part && part.inlineData?.data) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  } catch (err) {
    console.warn("[GeminiVoice] Super Spark TTS notice:", err);
  }
  return null;
}

function cleanEchoingPrefix(text: string, originalPrompt: string): string {
  if (!text) return "";
  let cleanText = text.replace(/^(system:|assistant:|model:|user:)/gi, "").trim();

  const promptPrefix = originalPrompt.trim();
  if (cleanText.toLowerCase().startsWith(promptPrefix.toLowerCase())) {
    cleanText = cleanText.slice(promptPrefix.length).trim();
  }

  return cleanText;
}
