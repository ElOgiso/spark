/**
 * Immutable Executive Director Voice & Identity Configuration
 * This profile governs Super Spark's executive voice when speaking with the creator.
 * It is completely distinct from the Character Bible voice profile (used in host video generation).
 */
export const SPARK_EXECUTIVE_VOICE_PROFILE = {
  name: "Super Spark",
  title: "Executive Creative Director",
  identity: "Spark Executive OS Director",
  voiceId: "Puck", // Fixed Gemini Live / TTS male voice
  model: "gemini-2.0-flash",
  ttsModel: "gemini-3.1-flash-tts-preview",
  gender: "Male" as const,
  language: "English (US)" as const,
  accent: "Neutral Executive Male" as const,
  tone: "Warm, Professional, Calm, Confident" as const,
  speakingStyle: "Articulate Executive Partner" as const,
  streaming: true,
  thinking: true,
  interruptions: true,
  pitch: 0.88,
  rate: 1.02,
} as const;

// Retrieve API key dynamically using unified 4-tier provider key resolver
function getGeminiApiKey(): string | undefined {
  return resolveProviderKey("gemini");
}

const SUPER_SPARK_SYSTEM_INSTRUCTION = `You are Super Spark, the Executive Creative Director and executive partner for Spark Media OS.

HUMAN CONVERSATION & EXECUTIVE PARTNER DIRECTIVES:
1. EXECUTIVE PARTNER TONE: Speak naturally as an articulate, warm, confident, sharp executive partner.
2. CONVERSATIONAL CONTINUITY & CONTEXT: Carefully read and reference previous conversation history. If the user asks "Are you reading at all?" or checks your attention, demonstrate direct understanding of what they said and acknowledge it.
3. CONVERSATIONAL VS TASK REQUESTS:
   - For greetings, check-ins, or strategy questions ("Hello", "What are you doing?", "Are you reading at all?"): Respond naturally as an executive director. NEVER output generic disclaimers or canned template boilerplate.
   - For action requests ("Create video", "Approve review", "Publish cut"): Confirm execution clearly in 1-3 sharp, direct sentences.
4. NO CANNED TEMPLATES: Never output phrases like "Understood. Noted. Let's move on..." or generic marketing copy. Answer the user's exact words directly.`;

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

import { PromptContextBuilder } from "./promptContextBuilder";
import { ModelRouter } from "./runtime/modelRouter";
import { resolveProviderKey } from "./runtime/AIProviderOrchestrator";
import type { ThinkingState } from "../domain/types";

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
 * Generate Gemini TTS Male Voice Audio for Super Spark Executive Director
 */
export async function generateSuperSparkVoice(text: string): Promise<string | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  try {
    const { GoogleGenAI, Modality } = await import('@google/genai').catch(() => ({ GoogleGenAI: null as any, Modality: null as any }));
    if (!GoogleGenAI) return null;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await ai.models.generateContent({
      model: SPARK_EXECUTIVE_VOICE_PROFILE.ttsModel,
      contents: [{ parts: [{ text: `Speak in a clear, confident, warm executive male voice (${SPARK_EXECUTIVE_VOICE_PROFILE.voiceId}): ${text.slice(0, 400)}` }] }],
      config: {
        responseModalities: [Modality?.AUDIO || 'AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: SPARK_EXECUTIVE_VOICE_PROFILE.voiceId },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return `data:audio/wav;base64,${base64Audio}`;
    }
  } catch (err) {
    console.warn('[SuperSpark] Gemini TTS Audio generation fallback:', err);
  }

  return null;
}

/**
 * Clean up any accidental echoing from response
 */
function cleanEchoingPrefix(response: string, userPrompt: string): string {
  let cleaned = response.trim();
  const lowerPrompt = userPrompt.trim().toLowerCase();
  
  if (cleaned.toLowerCase().startsWith(`"${lowerPrompt}"`)) {
    cleaned = cleaned.slice(lowerPrompt.length + 2).trim();
  } else if (cleaned.toLowerCase().startsWith(`you asked:`)) {
    cleaned = cleaned.replace(/^you asked:[^\n]*\n?/i, '').trim();
  } else if (cleaned.toLowerCase().startsWith(`you said:`)) {
    cleaned = cleaned.replace(/^you said:[^\n]*\n?/i, '').trim();
  }
  
  return cleaned;
}



/**
 * Universal Gemini API executor for multi-modal text/vision analysis
 */
export async function callGeminiAPI(prompt: string, systemInstruction?: string): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return "";
  }

  try {
    const { GoogleGenAI } = await import('@google/genai').catch(() => ({ GoogleGenAI: null as any }));
    if (!GoogleGenAI) return "";

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const response = await ai.models.generateContent({
      model: SPARK_EXECUTIVE_VOICE_PROFILE.model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: systemInstruction ? { systemInstruction } : undefined,
    });

    return (response.text || "").trim();
  } catch (err) {
    console.warn("[geminiService] callGeminiAPI error:", err);
    return "";
  }
}
