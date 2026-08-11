import type { AICapabilityType, AIProviderId, ThinkingState } from "../../domain/types";

export interface AIExecutionOptions {
  prompt: string;
  systemInstruction?: string;
  history?: { role: "user" | "model"; parts: { text: string }[] }[];
  context?: any;
  preferredProvider?: AIProviderId;
  capability?: AICapabilityType;
  model?: string;
  onThinking?: (thinking: ThinkingState) => void;
  onChunk?: (chunkText: string) => void;
  customApiKeys?: Record<string, string>;
  frames?: string[];
}

export interface AIProviderPlugin {
  id: AIProviderId;
  name: string;
  capabilities: AICapabilityType[];
  isAvailable(customKeys?: Record<string, string>): boolean;
  execute(options: AIExecutionOptions): Promise<string>;
}

/**
 * Phase 19A: AI Provider Orchestrator
 * SPARK is the AI Operating System — AI Providers are interchangeable execution engines.
 */
/**
 * Dynamic Provider Key Resolver (Phase 19B.2 Spec)
 * Resolves API keys in order:
 * 1. User Settings (Supabase / customKeys option)
 * 2. localStorage.spark_ai_keys or provider-specific localStorage key
 * 3. Vercel / Node Environment (process.env)
 * 4. Vite Client Environment (import.meta.env)
 */
export function resolveProviderKey(providerId: AIProviderId, customKeys?: Record<string, string>): string | undefined {
  const isNonEmpty = (val: any): val is string => typeof val === "string" && val.trim().length > 0;

  if (customKeys?.[providerId] && isNonEmpty(customKeys[providerId])) {
    return customKeys[providerId].trim();
  }

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const sparkKeysRaw = localStorage.getItem("spark_ai_keys");
      if (sparkKeysRaw) {
        const parsed = JSON.parse(sparkKeysRaw);
        if (isNonEmpty(parsed?.[providerId])) return parsed[providerId].trim();
      }
      const directKey = localStorage.getItem(`${providerId}_api_key`) || localStorage.getItem(`spark_${providerId}_key`);
      if (isNonEmpty(directKey)) return directKey.trim();
    } catch {}
  }

  if (typeof process !== "undefined" && process.env) {
    const p = process.env;
    const candidates: Record<string, (string | undefined)[]> = {
      gemini: [p.GOOGLE_AI_API_KEY, p.GEMINI_API_KEY, p.GOOGLE_API_KEY, p.VITE_GOOGLE_AI_API_KEY, p.VITE_GEMINI_API_KEY, p.VITE_GOOGLE_API_KEY],
      openai: [p.OPENAI_API_KEY, p.OPEN_AI_KEY, p.VITE_OPENAI_API_KEY],
      claude: [p.ANTHROPIC_API_KEY, p.CLAUDE_API_KEY, p.VITE_ANTHROPIC_API_KEY, p.VITE_CLAUDE_API_KEY],
      grok: [p.XAI_API_KEY, p.GROK_API_KEY, p.VITE_XAI_API_KEY, p.VITE_GROK_API_KEY],
      elevenlabs: [p.elevenlabs_API_Key, p.ELEVENLABS_API_KEY, p.VITE_ELEVENLABS_API_KEY],
      higgsfield: [p.HIGGSFIELD_API_KEY, p.VITE_HIGGSFIELD_API_KEY],
    };
    const list = candidates[providerId] || [];
    for (const val of list) {
      if (isNonEmpty(val)) return val.trim();
    }
  }

  if (typeof import.meta !== "undefined" && (import.meta as any).env) {
    const m = (import.meta as any).env;
    const candidates: Record<string, (string | undefined)[]> = {
      gemini: [m.VITE_GOOGLE_AI_API_KEY, m.GOOGLE_AI_API_KEY, m.VITE_GEMINI_API_KEY, m.GEMINI_API_KEY, m.VITE_GOOGLE_API_KEY, m.GOOGLE_API_KEY],
      openai: [m.VITE_OPENAI_API_KEY, m.OPENAI_API_KEY, m.OPEN_AI_KEY],
      claude: [m.VITE_ANTHROPIC_API_KEY, m.ANTHROPIC_API_KEY, m.VITE_CLAUDE_API_KEY, m.CLAUDE_API_KEY],
      grok: [m.VITE_XAI_API_KEY, m.XAI_API_KEY, m.VITE_GROK_API_KEY, m.GROK_API_KEY],
      elevenlabs: [m.VITE_ELEVENLABS_API_KEY, m.elevenlabs_API_Key, m.ELEVENLABS_API_KEY],
      higgsfield: [m.VITE_HIGGSFIELD_API_KEY, m.HIGGSFIELD_API_KEY],
    };
    const list = candidates[providerId] || [];
    for (const val of list) {
      if (isNonEmpty(val)) return val.trim();
    }
  }

  return undefined;
}

export class AIProviderOrchestrator {
  private static plugins: Map<AIProviderId, AIProviderPlugin> = new Map();
  private static providerHealth: Map<AIProviderId, { healthy: boolean; latencyMs: number; errorCount: number }> = new Map();
  private static isInitialized = false;
  private static lastUsedProviderId: AIProviderId = "gemini";

  static getLastUsedProviderId(): AIProviderId {
    return this.lastUsedProviderId;
  }

  static initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Google Gemini Provider Plugin (Gemini 2.5 Flash / Pro / Veo / Imagen)
    this.registerPlugin({
      id: "gemini",
      name: "Google Gemini (2.5 Flash / Pro / Veo / Imagen)",
      capabilities: ["Chat", "Vision", "Video Understanding", "Reasoning", "Text To Speech", "Video Generation", "Image Generation"],
      isAvailable: (customKeys) => true,
      execute: async (options) => {
        const apiKey = resolveProviderKey("gemini", options.customApiKeys);

        // 1A. Handle Video Generation via Google Veo (Official 9:16 short-form async pipeline)
        if (options.capability === "Video Generation") {
          const videoModel = options.model || "veo-3.1-generate-preview";
          const videoPayload = {
            instances: [{ prompt: options.prompt }],
            parameters: {
              aspectRatio: "9:16",
              sampleCount: 1,
            },
          };

          let opName = "";
          let finalVideoUrl = "";

          // 1. Direct Google GenAI SDK or REST call
          if (apiKey) {
            try {
              const { GoogleGenAI } = await import("@google/genai").catch(() => ({ GoogleGenAI: null as any }));
              if (GoogleGenAI) {
                const ai = new GoogleGenAI({ apiKey });
                try {
                  const veoRes = await (ai.models as any).generateVideos?.({
                    model: videoModel,
                    prompt: options.prompt,
                    config: { aspectRatio: "9:16" },
                  });
                  if (veoRes?.name) opName = veoRes.name;
                  if (veoRes?.response?.video?.uri) finalVideoUrl = veoRes.response.video.uri;
                } catch (sdkVeoErr) {
                  console.warn("[Gemini Provider] SDK Veo notice, trying REST predictLongRunning:", sdkVeoErr);
                }
              }
            } catch (sdkErr) {
              console.warn("[Gemini Provider] SDK import notice:", sdkErr);
            }

            if (!opName && !finalVideoUrl) {
              const veoEndpoints = [
                `https://generativelanguage.googleapis.com/v1beta/models/${videoModel}:predictLongRunning`,
                "https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning",
                "https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning",
              ];

              for (const ep of veoEndpoints) {
                try {
                  const videoRes = await fetch(ep, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "x-goog-api-key": apiKey,
                    },
                    body: JSON.stringify(videoPayload),
                  });

                  if (videoRes.ok) {
                    const vidData = await videoRes.json();
                    opName = vidData.name || "";
                    finalVideoUrl = vidData.response?.video?.uri || vidData.response?.generatedVideos?.[0]?.video?.uri || "";
                    if (opName || finalVideoUrl) break;
                  }
                } catch (vErr) {
                  console.warn(`[Gemini Provider] Video generation API direct notice (${ep}):`, vErr);
                }
              }
            }
          }

          // 2. Server proxy fallback if no opName or direct call failed
          if (!opName && !finalVideoUrl) {
            try {
              const proxyRes = await fetch("/api/runtime/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  provider: "google",
                  endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${videoModel}:predictLongRunning`,
                  payload: videoPayload,
                }),
              });

              if (proxyRes.ok) {
                const data = await proxyRes.json();
                opName = data.name || "";
                finalVideoUrl = data.response?.video?.uri || data.response?.generatedVideos?.[0]?.video?.uri || data.videoUrl || "";
              }
            } catch (pErr) {
              console.warn("[Gemini Provider] Video generation proxy notice:", pErr);
            }
          }

          // 3. Long Poll operation (up to 24 attempts x 15s = ~6 minutes budget)
          if (!finalVideoUrl && opName) {
            console.log(`[Gemini Provider] Polling Veo video operation: ${opName} (up to 6 min budget)`);
            for (let attempt = 0; attempt < 24; attempt++) {
              await new Promise((r) => setTimeout(r, 15000));
              try {
                let pollData: any = null;
                if (apiKey) {
                  const pollRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${opName}`, {
                    headers: { "x-goog-api-key": apiKey },
                  });
                  if (pollRes.ok) pollData = await pollRes.json();
                }

                if (!pollData) {
                  const proxyPoll = await fetch("/api/runtime/execute", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      provider: "google",
                      endpoint: `https://generativelanguage.googleapis.com/v1beta/${opName}`,
                      method: "GET",
                    }),
                  });
                  if (proxyPoll.ok) pollData = await proxyPoll.json();
                }

                if (pollData?.done) {
                  finalVideoUrl =
                    pollData.response?.video?.uri ||
                    pollData.response?.generatedVideos?.[0]?.video?.uri ||
                    pollData.response?.videoUrl ||
                    "";
                  if (finalVideoUrl) break;
                }
              } catch (pollErr) {
                console.warn(`[Gemini Provider] Poll attempt ${attempt + 1} notice:`, pollErr);
              }
            }
          }

          if (finalVideoUrl) {
            if (apiKey && finalVideoUrl.includes("generativelanguage.googleapis.com") && !finalVideoUrl.includes("key=")) {
              finalVideoUrl = `${finalVideoUrl}${finalVideoUrl.includes("?") ? "&" : "?"}key=${apiKey}`;
            }
            if (options.onChunk) options.onChunk(finalVideoUrl);
            return finalVideoUrl;
          }

          throw new Error("Gemini Video Generation is processing or timed out after 6 minutes.");
        }

        // 1B. Handle Image Generation via Google Imagen 4.0 / 3.0
        if (options.capability === "Image Generation") {
          const imageModel = options.model || "imagen-4.0-generate-001";
          const imagenPayload = {
            instances: [{ prompt: options.prompt }],
            parameters: { sampleCount: 1, aspectRatio: "9:16", outputMimeType: "image/png" },
          };

          if (apiKey) {
            const endpoints = [
              `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:predict`,
              "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict",
              "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict",
            ];

            for (const ep of endpoints) {
              try {
                const imgRes = await fetch(ep, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey,
                  },
                  body: JSON.stringify(imagenPayload),
                });

                if (imgRes.ok) {
                  const imgData = await imgRes.json();
                  const b64 = imgData.predictions?.[0]?.bytesBase64Encoded;
                  if (b64) {
                    const dataUri = `data:image/png;base64,${b64}`;
                    if (options.onChunk) options.onChunk(dataUri);
                    return dataUri;
                  }
                }
              } catch (iErr) {
                console.warn(`[Gemini Provider] Direct Imagen call notice (${ep}):`, iErr);
              }
            }
          }

          // Server proxy fallback for Imagen
          try {
            const proxyRes = await fetch("/api/runtime/execute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                provider: "google",
                endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:predict`,
                payload: imagenPayload,
              }),
            });

            if (proxyRes.ok) {
              const imgData = await proxyRes.json();
              const b64 = imgData.predictions?.[0]?.bytesBase64Encoded;
              if (b64) {
                const dataUri = `data:image/png;base64,${b64}`;
                if (options.onChunk) options.onChunk(dataUri);
                return dataUri;
              }
            }
          } catch (pErr) {
            console.warn("[Gemini Provider] Imagen proxy notice:", pErr);
          }
        }

        const chatModel = options.model || "gemini-2.0-flash";

        if (apiKey) {
          try {
            const { GoogleGenAI } = await import("@google/genai").catch(() => ({ GoogleGenAI: null as any }));
            if (GoogleGenAI) {
              const ai = new GoogleGenAI({
                apiKey,
                httpOptions: { headers: { "User-Agent": "aistudio-build" } },
              });

              const contents = (options.history || []).map((h) => ({
                role: h.role,
                parts: h.parts,
              }));

              const userParts: any[] = [];
              if (options.frames && options.frames.length > 0) {
                for (const frameUrl of options.frames) {
                  if (frameUrl.startsWith("data:image/")) {
                    const mimeType = frameUrl.split(";")[0].replace("data:", "");
                    const data = frameUrl.split(",")[1];
                    userParts.push({ inlineData: { mimeType, data } });
                  } else if (frameUrl.startsWith("http")) {
                    userParts.push({ text: `[Keyframe Image URL: ${frameUrl}]` });
                  }
                }
              }
              userParts.push({ text: options.prompt });
              contents.push({ role: "user", parts: userParts });

              const response = await ai.models.generateContent({
                model: chatModel,
                contents,
                config: options.systemInstruction ? { systemInstruction: options.systemInstruction } : undefined,
              });

              const text = response.text || "";
              if (options.onChunk) options.onChunk(text);
              return text;
            }
          } catch (err) {
            console.warn("[Gemini Provider] Direct client execution notice, falling back to server proxy:", err);
          }
        }

        // Server Proxy Fallback via /api/runtime/execute (uses Vercel server-side GEMINI_API_KEY / GOOGLE_AI_API_KEY)
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${chatModel}:generateContent`;
        const contents = (options.history || []).map((h) => ({ role: h.role, parts: h.parts }));
        contents.push({ role: "user", parts: [{ text: options.prompt }] });

        const payload: any = { contents };
        if (options.systemInstruction) {
          payload.systemInstruction = { parts: [{ text: options.systemInstruction }] };
        }

        const proxyRes = await fetch("/api/runtime/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "google", endpoint, payload }),
        });

        if (!proxyRes.ok) {
          const errData = await proxyRes.json().catch(() => ({}));
          throw new Error(errData.error || `Gemini proxy failed (${proxyRes.status})`);
        }

        const data = await proxyRes.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (options.onChunk) options.onChunk(text);
        return text;
      },
    });

    // 2. OpenAI Provider Plugin (GPT-5.6 / GPT-5.6-Sol / GPT-Image-1.5 / DALL-E 3)
    this.registerPlugin({
      id: "openai",
      name: "OpenAI (GPT-5.6 / GPT-5.6-Sol / GPT-Image-1.5)",
      capabilities: ["Chat", "Vision", "Video Understanding", "Reasoning", "Tool Calling", "Image Generation", "Text To Speech"],
      isAvailable: (customKeys) => true,
      execute: async (options) => {
        const apiKey = resolveProviderKey("openai", options.customApiKeys);

        // Handle OpenAI Image Generation (GPT-Image-1.5 / DALL-E 3 portrait 9:16)
        if (options.capability === "Image Generation") {
          const imageModel = options.model || "gpt-image-1.5";
          const openAiImagePayload = {
            model: imageModel,
            prompt: options.prompt,
            n: 1,
            size: "1024x1792", // portrait 9:16 for storyboard and thumbnails
            response_format: "b64_json",
          };

          // 1. Direct client call
          if (apiKey) {
            try {
              const imgRes = await fetch("https://api.openai.com/v1/images/generations", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(openAiImagePayload),
              });

              if (imgRes.ok) {
                const imgData = await imgRes.json();
                const b64 = imgData.data?.[0]?.b64_json;
                if (b64) {
                  const dataUri = `data:image/png;base64,${b64}`;
                  if (options.onChunk) options.onChunk(dataUri);
                  return dataUri;
                }
                const url = imgData.data?.[0]?.url;
                if (url) {
                  if (options.onChunk) options.onChunk(url);
                  return url;
                }
              } else if (imageModel !== "dall-e-3") {
                // Fallback to dall-e-3 if new image model is not yet provisioned on this key
                const dallRes = await fetch("https://api.openai.com/v1/images/generations", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                  },
                  body: JSON.stringify({
                    model: "dall-e-3",
                    prompt: options.prompt,
                    n: 1,
                    size: "1024x1792",
                    response_format: "b64_json",
                  }),
                }).catch(() => null);

                if (dallRes && dallRes.ok) {
                  const dallData = await dallRes.json();
                  const b64 = dallData.data?.[0]?.b64_json;
                  if (b64) {
                    const dataUri = `data:image/png;base64,${b64}`;
                    if (options.onChunk) options.onChunk(dataUri);
                    return dataUri;
                  }
                }
              }
            } catch (dallErr) {
              console.warn("[OpenAI Provider] Direct image generations notice:", dallErr);
            }
          }

          // 2. Server proxy fallback via /api/runtime/execute
          try {
            const proxyRes = await fetch("/api/runtime/execute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                provider: "openai",
                endpoint: "https://api.openai.com/v1/images/generations",
                payload: openAiImagePayload,
              }),
            });

            if (proxyRes.ok) {
              const imgData = await proxyRes.json();
              const b64 = imgData.data?.[0]?.b64_json;
              if (b64) {
                const dataUri = `data:image/png;base64,${b64}`;
                if (options.onChunk) options.onChunk(dataUri);
                return dataUri;
              }
              const url = imgData.data?.[0]?.url;
              if (url) {
                if (options.onChunk) options.onChunk(url);
                return url;
              }
            }
          } catch (pErr) {
            console.warn("[OpenAI Provider] Image generation proxy notice:", pErr);
          }

          // 3. Fallback to Gemini Imagen if OpenAI image failed
          try {
            const geminiPlugin = AIProviderOrchestrator.plugins.get("gemini");
            if (geminiPlugin) {
              const geminiImg = await geminiPlugin.execute({ ...options, capability: "Image Generation" });
              if (geminiImg) return geminiImg;
            }
          } catch (gImgErr) {
            console.warn("[OpenAI Provider] Gemini Imagen fallback notice:", gImgErr);
          }

          throw new Error("OpenAI image generation failed or returned no image bytes.");
        }

        const chatModel = options.model || "gpt-5.6";

        if (apiKey) {
          try {
            const messages: any[] = [];
            if (options.systemInstruction) {
              messages.push({ role: "system", content: options.systemInstruction });
            }
            if (options.history) {
              options.history.forEach((h) => {
                messages.push({ role: h.role === "model" ? "assistant" : "user", content: h.parts[0]?.text || "" });
              });
            }
            
            let userContent: any = options.prompt;
            if (options.frames && options.frames.length > 0) {
              userContent = [
                { type: "text", text: options.prompt },
                ...options.frames.map((url) => ({
                  type: "image_url",
                  image_url: { url, detail: "low" },
                })),
              ];
            }
            messages.push({ role: "user", content: userContent });

            const res = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: chatModel,
                messages,
                temperature: 0.7,
              }),
            });

            if (res.ok) {
              const data = await res.json();
              const text = data.choices?.[0]?.message?.content || "";
              if (options.onChunk) options.onChunk(text);
              return text;
            } else if (chatModel !== "gpt-4o") {
              // Failover to gpt-4o if newly aliased model returns 404 on legacy key
              const failoverRes = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                  model: "gpt-4o",
                  messages,
                  temperature: 0.7,
                }),
              }).catch(() => null);

              if (failoverRes && failoverRes.ok) {
                const fData = await failoverRes.json();
                const text = fData.choices?.[0]?.message?.content || "";
                if (options.onChunk) options.onChunk(text);
                return text;
              }
            }
          } catch (err) {
            console.warn("[OpenAI Provider] Direct client execution notice, falling back to server proxy:", err);
          }
        }

        // Server Proxy Fallback via /api/runtime/execute
        const messages = [];
        if (options.systemInstruction) {
          messages.push({ role: "system", content: options.systemInstruction });
        }
        if (options.history) {
          options.history.forEach((h) => {
            messages.push({ role: h.role === "model" ? "assistant" : "user", content: h.parts[0]?.text || "" });
          });
        }
        messages.push({ role: "user", content: options.prompt });

        const proxyRes = await fetch("/api/runtime/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "openai",
            endpoint: "https://api.openai.com/v1/chat/completions",
            payload: { model: chatModel, messages, temperature: 0.7 },
          }),
        });

        if (!proxyRes.ok) {
          const errData = await proxyRes.json().catch(() => ({}));
          throw new Error(errData.error || `OpenAI proxy failed (${proxyRes.status})`);
        }

        const data = await proxyRes.json();
        const text = data.choices?.[0]?.message?.content || "";
        if (options.onChunk) options.onChunk(text);
        return text;
      },
    });

    // 3. Anthropic Claude Provider Plugin (Claude Sonnet 5 / Opus 5 / Fable 5)
    this.registerPlugin({
      id: "claude",
      name: "Anthropic Claude (Claude Sonnet 5 / Opus 5)",
      capabilities: ["Chat", "Vision", "Reasoning", "Tool Calling"],
      isAvailable: (customKeys) => true,
      execute: async (options) => {
        const apiKey = resolveProviderKey("claude", options.customApiKeys);
        const requestedModel = options.model || "claude-sonnet-5";
        const candidateModels = [
          requestedModel,
          "claude-sonnet-5",
          "claude-3-5-sonnet-20241022",
          "claude-3-5-haiku-20241022",
        ].filter((m, idx, arr) => arr.indexOf(m) === idx);

        if (apiKey) {
          try {
            const messages = [];
            if (options.history) {
              options.history.forEach((h) => {
                messages.push({ role: h.role === "model" ? "assistant" : "user", content: h.parts[0]?.text || "" });
              });
            }

            let userContent: any = options.prompt;
            if (options.frames && options.frames.length > 0) {
              userContent = [];
              for (const frameUrl of options.frames) {
                if (frameUrl.startsWith("data:image/")) {
                  const mimeType = frameUrl.split(";")[0].replace("data:", "");
                  const data = frameUrl.split(",")[1];
                  userContent.push({
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: mimeType,
                      data,
                    },
                  });
                }
              }
              userContent.push({ type: "text", text: options.prompt });
            }
            messages.push({ role: "user", content: userContent });

            for (const modelId of candidateModels) {
              try {
                const res = await fetch("https://api.anthropic.com/v1/messages", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "anthropic-version": "2023-06-01",
                    "anthropic-dangerous-direct-browser-access": "true",
                  },
                  body: JSON.stringify({
                    model: modelId,
                    max_tokens: 4096,
                    system: options.systemInstruction,
                    messages,
                  }),
                });

                if (res.ok) {
                  const data = await res.json();
                  const text = data.content?.[0]?.text || "";
                  if (options.onChunk) options.onChunk(text);
                  return text;
                }
              } catch (tryErr) {
                console.warn(`[Claude Provider] Attempt with model ${modelId} notice:`, tryErr);
              }
            }
          } catch (err) {
            console.warn("[Claude Provider] Direct client execution notice, falling back to server proxy:", err);
          }
        }

        // Server Proxy Fallback via /api/runtime/execute
        const messages = [];
        if (options.history) {
          options.history.forEach((h) => {
            messages.push({ role: h.role === "model" ? "assistant" : "user", content: h.parts[0]?.text || "" });
          });
        }
        messages.push({ role: "user", content: options.prompt });

        for (const modelId of candidateModels) {
          try {
            const proxyRes = await fetch("/api/runtime/execute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                provider: "anthropic",
                endpoint: "https://api.anthropic.com/v1/messages",
                payload: {
                  model: modelId,
                  max_tokens: 4096,
                  system: options.systemInstruction,
                  messages,
                },
              }),
            });

            if (proxyRes.ok) {
              const data = await proxyRes.json();
              const text = data.content?.[0]?.text || "";
              if (options.onChunk) options.onChunk(text);
              return text;
            }
          } catch (pErr) {
            console.warn(`[Claude Provider] Proxy attempt with model ${modelId} notice:`, pErr);
          }
        }

        throw new Error("Anthropic Claude execution failed across all candidate models.");
      },
    });

    // 4. xAI Grok Provider Plugin (Grok 4.5 / Grok Imagine / Grok Video / Grok TTS)
    this.registerPlugin({
      id: "grok",
      name: "xAI Grok (Grok 4.5 / Imagine / Video / TTS)",
      capabilities: ["Chat", "Vision", "Video Understanding", "Reasoning", "Image Generation", "Video Generation", "Text To Speech"],
      isAvailable: (customKeys) => true,
      execute: async (options) => {
        const apiKey = resolveProviderKey("grok", options.customApiKeys);

        // 4A. Grok Image Generation (grok-imagine-image-quality 9:16)
        if (options.capability === "Image Generation") {
          const imageModel = options.model || "grok-imagine-image-quality";
          const grokImagePayload = {
            model: imageModel,
            prompt: options.prompt,
            n: 1,
            response_format: "b64_json",
          };

          // 1. Direct call
          if (apiKey) {
            try {
              const imgRes = await fetch("https://api.x.ai/v1/images/generations", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(grokImagePayload),
              });

              if (imgRes.ok) {
                const imgData = await imgRes.json();
                const b64 = imgData.data?.[0]?.b64_json;
                if (b64) {
                  const dataUri = `data:image/png;base64,${b64}`;
                  if (options.onChunk) options.onChunk(dataUri);
                  return dataUri;
                }
                const url = imgData.data?.[0]?.url;
                if (url) {
                  if (options.onChunk) options.onChunk(url);
                  return url;
                }
              }
            } catch (gImgErr) {
              console.warn("[Grok Provider] Direct image generation notice:", gImgErr);
            }
          }

          // 2. Server proxy fallback
          try {
            const proxyRes = await fetch("/api/runtime/execute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                provider: "grok",
                endpoint: "https://api.x.ai/v1/images/generations",
                payload: grokImagePayload,
              }),
            });

            if (proxyRes.ok) {
              const imgData = await proxyRes.json();
              const b64 = imgData.data?.[0]?.b64_json;
              if (b64) {
                const dataUri = `data:image/png;base64,${b64}`;
                if (options.onChunk) options.onChunk(dataUri);
                return dataUri;
              }
              const url = imgData.data?.[0]?.url;
              if (url) {
                if (options.onChunk) options.onChunk(url);
                return url;
              }
            }
          } catch (pErr) {
            console.warn("[Grok Provider] Image generation proxy notice:", pErr);
          }

          // 3. Fallback to OpenAI / Gemini image generation
          const openAiPlugin = AIProviderOrchestrator.plugins.get("openai");
          if (openAiPlugin) {
            return openAiPlugin.execute({ ...options, capability: "Image Generation" });
          }
          throw new Error("Grok image generation failed and no fallback available.");
        }

        // 4B. Grok Video Generation (grok-imagine-video 9:16 vertical)
        if (options.capability === "Video Generation") {
          const videoModel = options.model || "grok-imagine-video";
          const grokVideoPayload = {
            model: videoModel,
            prompt: options.prompt,
            aspect_ratio: "9:16",
          };

          let requestId = "";
          let finalVideoUrl = "";

          if (apiKey) {
            try {
              const vRes = await fetch("https://api.x.ai/v1/videos/generations", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(grokVideoPayload),
              });

              if (vRes.ok) {
                const vData = await vRes.json();
                requestId = vData.id || vData.request_id || "";
                finalVideoUrl = vData.video_url || vData.url || "";
              }
            } catch (vErr) {
              console.warn("[Grok Provider] Direct video generation start notice:", vErr);
            }
          }

          if (!requestId && !finalVideoUrl) {
            try {
              const proxyRes = await fetch("/api/runtime/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  provider: "grok",
                  endpoint: "https://api.x.ai/v1/videos/generations",
                  payload: grokVideoPayload,
                }),
              });

              if (proxyRes.ok) {
                const data = await proxyRes.json();
                requestId = data.id || data.request_id || "";
                finalVideoUrl = data.video_url || data.url || "";
              }
            } catch (pErr) {
              console.warn("[Grok Provider] Video generation proxy start notice:", pErr);
            }
          }

          // Poll video status if asynchronous request_id returned
          if (!finalVideoUrl && requestId) {
            console.log(`[Grok Provider] Polling video generation status for ${requestId}...`);
            for (let attempt = 0; attempt < 24; attempt++) {
              await new Promise((r) => setTimeout(r, 10000));
              try {
                let pollData: any = null;
                if (apiKey) {
                  const pollRes = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
                    headers: { Authorization: `Bearer ${apiKey}` },
                  });
                  if (pollRes.ok) pollData = await pollRes.json();
                }

                if (!pollData) {
                  const proxyPoll = await fetch("/api/runtime/execute", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      provider: "grok",
                      endpoint: `https://api.x.ai/v1/videos/${requestId}`,
                      method: "GET",
                    }),
                  });
                  if (proxyPoll.ok) pollData = await proxyPoll.json();
                }

                if (pollData?.status === "done" || pollData?.status === "completed" || pollData?.status === "ready") {
                  finalVideoUrl = pollData.video_url || pollData.url || pollData.data?.[0]?.url || "";
                  if (finalVideoUrl) break;
                } else if (pollData?.status === "failed") {
                  throw new Error(`Grok video generation failed: ${pollData.error || "unknown"}`);
                }
              } catch (pollErr) {
                console.warn(`[Grok Provider] Video poll attempt ${attempt + 1} notice:`, pollErr);
              }
            }
          }

          if (finalVideoUrl) {
            if (options.onChunk) options.onChunk(finalVideoUrl);
            return finalVideoUrl;
          }

          // Fallback to Gemini Veo if Grok video timed out
          const geminiPlugin = AIProviderOrchestrator.plugins.get("gemini");
          if (geminiPlugin) {
            return geminiPlugin.execute({ ...options, capability: "Video Generation" });
          }

          throw new Error("Grok Video Generation is processing or timed out.");
        }

        // 4C. Grok Voice / TTS (/v1/tts)
        if (options.capability === "Text To Speech") {
          const ttsPayload = {
            text: options.prompt,
            voice_id: "eve",
            language: "en",
          };

          if (apiKey) {
            try {
              const ttsRes = await fetch("https://api.x.ai/v1/tts", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(ttsPayload),
              });

              if (ttsRes.ok) {
                const blob = await ttsRes.blob();
                return await new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.onerror = () => resolve("");
                  reader.readAsDataURL(blob);
                });
              }
            } catch (tErr) {
              console.warn("[Grok Provider] Direct TTS notice:", tErr);
            }
          }

          // Server proxy fallback for TTS
          try {
            const proxyRes = await fetch("/api/runtime/execute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                provider: "grok",
                endpoint: "https://api.x.ai/v1/tts",
                payload: ttsPayload,
              }),
            });

            if (proxyRes.ok) {
              const data = await proxyRes.json();
              if (data.dataUrl) return data.dataUrl;
            }
          } catch (pErr) {
            console.warn("[Grok Provider] TTS proxy notice:", pErr);
          }

          // Fallback to ElevenLabs TTS
          const elevenPlugin = AIProviderOrchestrator.plugins.get("elevenlabs");
          if (elevenPlugin) {
            return elevenPlugin.execute(options);
          }
          throw new Error("Grok TTS failed and no fallback available.");
        }

        // 4D. Grok Chat / Reasoning (/v1/responses preferred, /v1/chat/completions fallback)
        const chatModel = options.model || "grok-4.5";

        if (apiKey) {
          // 1. Try official /v1/responses endpoint
          try {
            const responseInput: any[] = [];
            if (options.systemInstruction) {
              responseInput.push({ role: "system", content: options.systemInstruction });
            }
            if (options.history) {
              options.history.forEach((h) => {
                responseInput.push({ role: h.role === "model" ? "assistant" : "user", content: h.parts[0]?.text || "" });
              });
            }
            responseInput.push({ role: "user", content: options.prompt });

            const respRes = await fetch("https://api.x.ai/v1/responses", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: chatModel,
                input: responseInput,
              }),
            });

            if (respRes.ok) {
              const rData = await respRes.json();
              const text = rData.output_text || rData.choices?.[0]?.message?.content || rData.response || "";
              if (text) {
                if (options.onChunk) options.onChunk(text);
                return text;
              }
            }
          } catch (respErr) {
            console.warn("[Grok Provider] /v1/responses notice, trying /v1/chat/completions:", respErr);
          }

          // 2. Fallback to /v1/chat/completions
          try {
            const messages: any[] = [];
            if (options.systemInstruction) {
              messages.push({ role: "system", content: options.systemInstruction });
            }
            if (options.history) {
              options.history.forEach((h) => {
                messages.push({ role: h.role === "model" ? "assistant" : "user", content: h.parts[0]?.text || "" });
              });
            }

            let userContent: any = options.prompt;
            if (options.frames && options.frames.length > 0) {
              userContent = [
                { type: "text", text: options.prompt },
                ...options.frames.map((url) => ({
                  type: "image_url",
                  image_url: { url },
                })),
              ];
            }
            messages.push({ role: "user", content: userContent });

            const res = await fetch("https://api.x.ai/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: chatModel,
                messages,
                temperature: 0.7,
              }),
            });

            if (res.ok) {
              const data = await res.json();
              const text = data.choices?.[0]?.message?.content || "";
              if (options.onChunk) options.onChunk(text);
              return text;
            }
          } catch (err) {
            console.warn("[Grok Provider] Direct client execution notice, falling back to server proxy:", err);
          }
        }

        // Server Proxy Fallback via /api/runtime/execute
        const messages = [];
        if (options.systemInstruction) {
          messages.push({ role: "system", content: options.systemInstruction });
        }
        if (options.history) {
          options.history.forEach((h) => {
            messages.push({ role: h.role === "model" ? "assistant" : "user", content: h.parts[0]?.text || "" });
          });
        }
        messages.push({ role: "user", content: options.prompt });

        const proxyRes = await fetch("/api/runtime/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "grok",
            endpoint: "https://api.x.ai/v1/chat/completions",
            payload: { model: chatModel, messages, temperature: 0.7 },
          }),
        });

        if (!proxyRes.ok) {
          const errData = await proxyRes.json().catch(() => ({}));
          throw new Error(errData.error || `xAI Grok proxy failed (${proxyRes.status})`);
        }

        const data = await proxyRes.json();
        const text = data.choices?.[0]?.message?.content || "";
        if (options.onChunk) options.onChunk(text);
        return text;
      },
    });

    // 5. ElevenLabs Provider Plugin
    this.registerPlugin({
      id: "elevenlabs",
      name: "ElevenLabs (Speech / TTS)",
      capabilities: ["Speech", "Text To Speech"],
      isAvailable: (customKeys) => Boolean(resolveProviderKey("elevenlabs", customKeys)),
      execute: async (options) => {
        const { generateElevenLabsVoice } = await import("./providers/elevenLabsTTS");
        const audioUri = await generateElevenLabsVoice(options.prompt, undefined, options.model);
        if (!audioUri) {
          throw new Error("ElevenLabs voice synthesis returned null or provider key missing.");
        }
        return audioUri;
      },
    });

    // 6. Higgsfield Provider Plugin
    this.registerPlugin({
      id: "higgsfield",
      name: "Higgsfield AI (Video Generation)",
      capabilities: ["Video Understanding"],
      isAvailable: (customKeys) => Boolean(resolveProviderKey("higgsfield", customKeys)),
      execute: async (options) => {
        throw new Error("Higgsfield execution requires video generation payload.");
      },
    });
  }

  static registerPlugin(plugin: AIProviderPlugin): void {
    this.plugins.set(plugin.id, plugin);
    if (!this.providerHealth.has(plugin.id)) {
      this.providerHealth.set(plugin.id, { healthy: true, latencyMs: 120, errorCount: 0 });
    }
  }

  static listPlugins(): AIProviderPlugin[] {
    this.initialize();
    return Array.from(this.plugins.values());
  }

  static getPlugin(id: AIProviderId): AIProviderPlugin | undefined {
    this.initialize();
    return this.plugins.get(id);
  }

  /**
   * Main Execution Entry Point with Dynamic Retry, Streaming Thinking & Automatic Failover
   */
  static async execute(options: AIExecutionOptions): Promise<string> {
    this.initialize();

    const capability = options.capability || "Chat";
    const customKeys = options.customApiKeys;

    // Build ordered list of candidate provider plugins
    const candidates: AIProviderPlugin[] = [];

    // Priority 1: User preferred provider if available
    if (options.preferredProvider && options.preferredProvider !== "auto") {
      const pref = this.plugins.get(options.preferredProvider);
      if (pref && pref.isAvailable(customKeys) && pref.capabilities.includes(capability)) {
        candidates.push(pref);
      }
    }

    // Priority 2: All remaining healthy providers supporting this capability
    const allPlugins = Array.from(this.plugins.values());
    const availableOthers: AIProviderPlugin[] = [];

    for (const plugin of allPlugins) {
      if (!candidates.some((c) => c.id === plugin.id)) {
        if (plugin.isAvailable(customKeys) && plugin.capabilities.includes(capability)) {
          const health = this.providerHealth.get(plugin.id);
          if (!health || health.healthy) {
            availableOthers.push(plugin);
          }
        }
      }
    }

    // Default Priority Table:
    // Chat / Auto -> OpenAI -> Gemini -> Claude -> Grok
    // Video Understanding -> Grok -> Gemini -> OpenAI -> Claude
    const categoryPriority: AIProviderId[] =
      capability === "Video Understanding"
        ? ["grok", "gemini", "openai", "claude"]
        : ["openai", "gemini", "claude", "grok"];

    availableOthers.sort((a, b) => {
      const posA = categoryPriority.indexOf(a.id);
      const posB = categoryPriority.indexOf(b.id);
      return (posA !== -1 ? posA : 99) - (posB !== -1 ? posB : 99);
    });

    candidates.push(...availableOthers);

    // Fallback: If no key is set anywhere, check if simulation or fallback is allowed
    if (candidates.length === 0) {
      // Include any provider that claims capability as last resort
      for (const plugin of allPlugins) {
        if (!candidates.some((c) => c.id === plugin.id) && plugin.capabilities.includes(capability)) {
          candidates.push(plugin);
        }
      }
    }

    if (candidates.length === 0) {
      throw new Error(`No AI providers registered for capability: ${capability}`);
    }

    // Emit initial thinking state with executive stages
    if (options.onThinking) {
      options.onThinking({
        step: "Reviewing workspace...",
        timestamp: new Date().toISOString(),
        provider: candidates[0]?.name,
      });
    }

    // Execute with automatic retry & seamless failover across candidate providers (max 2 candidates: A -> B -> stop)
    let lastError: Error | null = null;
    const candidatesToTry = candidates.slice(0, 2);

    for (let i = 0; i < candidatesToTry.length; i++) {
      const provider = candidatesToTry[i];
      const startTime = Date.now();

      if (options.onThinking && i > 0) {
        options.onThinking({
          step: "Researching...",
          timestamp: new Date().toISOString(),
          provider: provider.name,
        });
      }

      // Try execution with 1 retry on transient error
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          if (options.onThinking && attempt === 1) {
            options.onThinking({
              step: "Thinking...",
              timestamp: new Date().toISOString(),
              provider: provider.name,
            });
          }

          const result = await provider.execute(options);
          const latencyMs = Date.now() - startTime;

          // Record healthy stats and last used provider for provider-native TTS
          this.lastUsedProviderId = provider.id;
          this.providerHealth.set(provider.id, { healthy: true, latencyMs, errorCount: 0 });

          if (options.onThinking) {
            options.onThinking({
              step: "Finalizing...",
              timestamp: new Date().toISOString(),
              provider: provider.name,
            });
          }

          return result;
        } catch (err: any) {
          lastError = err;
          console.warn(`[AIProviderOrchestrator] Attempt ${attempt} failed on ${provider.name}:`, err.message);

          if (attempt === 1) {
            // Wait 200ms before single retry
            await new Promise((r) => setTimeout(r, 200));
          }
        }
      }

      // Mark degraded if both attempts fail
      this.providerHealth.set(provider.id, { healthy: false, latencyMs: 9999, errorCount: 2 });

      if (options.onThinking && i < candidates.length - 1) {
        options.onThinking({
          step: "Planning...",
          timestamp: new Date().toISOString(),
          provider: candidates[i + 1].name,
        });
      }
    }

    // If all live network provider calls fail, throw error so caller handles cleanly
    throw lastError || new Error("All AI execution providers failed.");
  }
}

// Auto-initialize orchestrator on import
AIProviderOrchestrator.initialize();
