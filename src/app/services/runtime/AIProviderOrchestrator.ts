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
  referenceImageUrl?: string;
  aspectRatio?: string;
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
      elevenlabs: [
        p.elevenlabs_API_Key,
        p.ELEVENLABS_API_KEY,
        p.VITE_ELEVENLABS_API_KEY,
        p.VITE_elevenlabs_API_Key,
        p.ELEVEN_LABS_API_KEY,
        p.VITE_ELEVEN_LABS_API_KEY,
      ],
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
      elevenlabs: [
        m.VITE_ELEVENLABS_API_KEY,
        m.VITE_elevenlabs_API_Key,
        m.elevenlabs_API_Key,
        m.ELEVENLABS_API_KEY,
        m.VITE_ELEVEN_LABS_API_KEY,
        m.ELEVEN_LABS_API_KEY,
      ],
      higgsfield: [m.VITE_HIGGSFIELD_API_KEY, m.HIGGSFIELD_API_KEY],
    };
    const list = candidates[providerId] || [];
    for (const val of list) {
      if (isNonEmpty(val)) return val.trim();
    }
  }

  return undefined;
}

export function extractGrokVideoUrl(pollData: any): string {
  if (!pollData) return "";
  if (typeof pollData.video?.url === "string" && pollData.video.url) return pollData.video.url;
  if (typeof pollData.video_url === "string" && pollData.video_url) return pollData.video_url;
  if (typeof pollData.url === "string" && pollData.url) return pollData.url;
  if (typeof pollData.data?.[0]?.url === "string" && pollData.data[0].url) return pollData.data[0].url;
  return "";
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
          const candidateVeoModels = [
            options.model,
            "veo-3.1-generate-preview",
            "veo-3.1-fast-generate-preview",
            "veo-3.1-generate-001",
            "veo-2.0-generate-001",
          ].filter(Boolean) as string[];

          const extractVeoUri = (data: any): string => {
            if (!data) return "";
            const paths = [
              data?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri,
              data?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri,
              data?.response?.generatedVideos?.[0]?.video?.uri,
              data?.generatedVideos?.[0]?.video?.uri,
              data?.video?.uri,
              data?.uri,
              data?.videoUrl,
              data?.url,
            ];
            for (const p of paths) {
              if (typeof p === "string" && p.trim()) return p.trim();
            }
            if (data.response) {
              const nested = extractVeoUri(data.response);
              if (nested) return nested;
            }
            if (data.result) {
              const nested = extractVeoUri(data.result);
              if (nested) return nested;
            }
            return "";
          };

          const convertToPlayableUrl = async (rawUri: string): Promise<string> => {
            if (!rawUri) return "";
            if (rawUri.startsWith("data:") || rawUri.startsWith("blob:")) return rawUri;

            const needsKey =
              rawUri.includes("generativelanguage.googleapis.com") ||
              rawUri.includes("files/") ||
              rawUri.includes(":download");

            const headers: Record<string, string> = {};
            let fetchUrl = rawUri;
            if (needsKey && apiKey) {
              headers["x-goog-api-key"] = apiKey;
              if (!fetchUrl.includes("key=")) {
                fetchUrl = `${fetchUrl}${fetchUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(apiKey)}`;
              }
            }

            try {
              const res = await fetch(fetchUrl, { headers });
              if (!res.ok) {
                console.warn(`[Veo Download] Download failed ${res.status}:`, fetchUrl.slice(0, 120));
                return rawUri;
              }
              const buf = await res.arrayBuffer();
              const bytes = new Uint8Array(buf);
              let binary = "";
              const chunkSize = 8192;
              for (let i = 0; i < bytes.length; i += chunkSize) {
                const chunk = bytes.subarray(i, i + chunkSize);
                binary += String.fromCharCode.apply(null, chunk as any);
              }
              const b64 = btoa(binary);
              return `data:video/mp4;base64,${b64}`;
            } catch (err) {
              console.warn("[Veo Download] Binary conversion notice:", err);
              return rawUri;
            }
          };

          let opName = "";
          let finalVideoUrl = "";

          const targetAspect = options.aspectRatio === "16:9" ? "16:9" : "9:16";
          for (const videoModel of candidateVeoModels) {
            const instanceObj: any = { prompt: options.prompt };
            if (options.referenceImageUrl) {
              if (options.referenceImageUrl.startsWith("data:")) {
                instanceObj.image = { imageBytes: options.referenceImageUrl.split(",")[1] };
              } else if (options.referenceImageUrl.startsWith("http")) {
                instanceObj.image = { gcsUri: options.referenceImageUrl };
              }
              console.log(`[Gemini Provider] Conditioning Veo video generation on scene still reference`);
            }

            const videoPayload = {
              instances: [instanceObj],
              parameters: {
                aspectRatio: targetAspect,
                sampleCount: 1,
              },
            };

            // 1. Direct Google GenAI SDK or REST call
            if (apiKey) {
              try {
                const { GoogleGenAI } = await import("@google/genai").catch(() => ({ GoogleGenAI: null as any }));
                if (GoogleGenAI) {
                  const ai = new GoogleGenAI({ apiKey });
                  try {
                    const sdkParams: any = {
                      model: videoModel,
                      prompt: options.prompt,
                      config: { aspectRatio: targetAspect },
                    };
                    if (options.referenceImageUrl) {
                      sdkParams.image = { uri: options.referenceImageUrl };
                    }
                    const veoRes = await (ai.models as any).generateVideos?.(sdkParams);
                    if (veoRes?.name) opName = veoRes.name;
                    const extracted = extractVeoUri(veoRes);
                    if (extracted) finalVideoUrl = extracted;
                  } catch (sdkVeoErr) {
                    console.warn(`[Gemini Provider] SDK Veo notice (${videoModel}):`, sdkVeoErr);
                  }
                }
              } catch (sdkErr) {
                console.warn("[Gemini Provider] SDK import notice:", sdkErr);
              }

              if (!opName && !finalVideoUrl) {
                const ep = `https://generativelanguage.googleapis.com/v1beta/models/${videoModel}:predictLongRunning`;
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
                    finalVideoUrl = extractVeoUri(vidData);
                    if (opName || finalVideoUrl) break;
                  } else {
                    const errTxt = await videoRes.text().catch(() => "");
                    console.warn(`[Gemini Provider] Veo predictLongRunning failed (${videoModel} - ${videoRes.status}):`, errTxt.slice(0, 300));
                  }
                } catch (vErr) {
                  console.warn(`[Gemini Provider] Video generation API direct notice (${ep}):`, vErr);
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
                  finalVideoUrl = extractVeoUri(data);
                  if (opName || finalVideoUrl) break;
                } else {
                  const errTxt = await proxyRes.text().catch(() => "");
                  console.warn(`[Gemini Provider] Veo proxy failed (${videoModel} - ${proxyRes.status}):`, errTxt.slice(0, 300));
                }
              } catch (pErr) {
                console.warn("[Gemini Provider] Video generation proxy notice:", pErr);
              }
            }

            if (opName || finalVideoUrl) break;
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
                  finalVideoUrl = extractVeoUri(pollData);
                  if (finalVideoUrl) {
                    console.log(`[Gemini Provider] Veo poll complete on attempt ${attempt + 1}: extracted URI -> ${finalVideoUrl.slice(0, 60)}...`);
                    break;
                  }
                }
              } catch (pollErr) {
                console.warn(`[Gemini Provider] Poll attempt ${attempt + 1} notice:`, pollErr);
              }
            }
          }

          if (finalVideoUrl) {
            const playableUrl = await convertToPlayableUrl(finalVideoUrl);
            console.log("[Gemini Provider] Veo Video generation SUCCESS:", playableUrl.slice(0, 80));
            if (options.onChunk) options.onChunk(playableUrl);
            return playableUrl;
          }

          throw new Error("Gemini Video Generation timed out or returned no URI.");
        }

        // 1B. Handle Gemini Native Image Generation (gemini-3.1-flash-image-preview / 2.5 / 3-pro / Imagen fallback)
        if (options.capability === "Image Generation") {
          const candidateNativeModels = [
            options.model,
            "gemini-3.1-flash-image-preview",
            "gemini-2.5-flash-image",
            "gemini-3-pro-image-preview",
          ].filter(Boolean) as string[];

          // 1. Direct SDK generateContent with responseModalities
          if (apiKey) {
            try {
              const { GoogleGenAI } = await import("@google/genai").catch(() => ({ GoogleGenAI: null as any }));
              if (GoogleGenAI) {
                const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
                for (const modelId of candidateNativeModels) {
                  try {
                    const response = await (ai.models as any).generateContent({
                      model: modelId,
                      contents: [{ role: "user", parts: [{ text: `Generate a 9:16 vertical high-contrast production image: ${options.prompt}` }] }],
                      config: {
                        responseModalities: ["IMAGE"],
                        imageConfig: { aspectRatio: "9:16" },
                      },
                    });

                    const parts = response.candidates?.[0]?.content?.parts || [];
                    for (const p of parts) {
                      if (p.inlineData?.data) {
                        const mime = p.inlineData.mimeType || "image/png";
                        const dataUri = `data:${mime};base64,${p.inlineData.data}`;
                        if (options.onChunk) options.onChunk(dataUri);
                        return dataUri;
                      }
                    }
                  } catch (sdkImgErr) {
                    console.warn(`[Gemini Provider] SDK native image notice (${modelId}):`, sdkImgErr);
                  }
                }
              }
            } catch (sdkErr) {
              console.warn("[Gemini Provider] SDK native image import notice:", sdkErr);
            }

            // Direct REST generateContent with responseModalities
            for (const modelId of candidateNativeModels) {
              try {
                const restRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: `Generate a 9:16 vertical high-contrast production image: ${options.prompt}` }] }],
                    generationConfig: {
                      responseModalities: ["IMAGE"],
                      imageConfig: { aspectRatio: "9:16" },
                    },
                  }),
                });

                if (restRes.ok) {
                  const data = await restRes.json();
                  const parts = data.candidates?.[0]?.content?.parts || [];
                  for (const p of parts) {
                    const b64 = p.inlineData?.data || p.inline_data?.data;
                    if (b64) {
                      const mime = p.inlineData?.mimeType || p.inline_data?.mime_type || "image/png";
                      const dataUri = `data:${mime};base64,${b64}`;
                      if (options.onChunk) options.onChunk(dataUri);
                      return dataUri;
                    }
                  }
                } else {
                  const errTxt = await restRes.text().catch(() => "");
                  console.warn(`[Gemini Provider] REST native image failed (${modelId} - ${restRes.status}):`, errTxt.slice(0, 300));
                }
              } catch (rErr) {
                console.warn(`[Gemini Provider] REST native image exception (${modelId}):`, rErr);
              }
            }
          }

          // 2. Server proxy fallback for Native Gemini Image
          for (const modelId of candidateNativeModels) {
            try {
              const proxyRes = await fetch("/api/runtime/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  provider: "google",
                  endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
                  payload: {
                    contents: [{ parts: [{ text: `Generate a 9:16 vertical high-contrast production image: ${options.prompt}` }] }],
                    generationConfig: {
                      responseModalities: ["IMAGE"],
                      imageConfig: { aspectRatio: "9:16" },
                    },
                  },
                }),
              });

              if (proxyRes.ok) {
                const data = await proxyRes.json();
                const parts = data.candidates?.[0]?.content?.parts || [];
                for (const p of parts) {
                  const b64 = p.inlineData?.data || p.inline_data?.data;
                  if (b64) {
                    const mime = p.inlineData?.mimeType || p.inline_data?.mime_type || "image/png";
                    const dataUri = `data:${mime};base64,${b64}`;
                    if (options.onChunk) options.onChunk(dataUri);
                    return dataUri;
                  }
                }
              } else {
                const errTxt = await proxyRes.text().catch(() => "");
                console.warn(`[Gemini Provider] Proxy native image failed (${modelId} - ${proxyRes.status}):`, errTxt.slice(0, 300));
              }
            } catch (pErr) {
              console.warn(`[Gemini Provider] Proxy native image notice (${modelId}):`, pErr);
            }
          }

          // 3. Imagen fallback
          const imagenEndpoints = [
            "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict",
            "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict",
            "https://generativelanguage.googleapis.com/v1beta/models/imagegeneration@006:predict",
          ];

          const imagenPayload = {
            instances: [{ prompt: options.prompt }],
            parameters: { sampleCount: 1, aspectRatio: "9:16", outputMimeType: "image/png" },
          };

          if (apiKey) {
            for (const ep of imagenEndpoints) {
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
                } else {
                  const errTxt = await imgRes.text().catch(() => "");
                  console.warn(`[Gemini Provider] Imagen predict failed (${ep} - ${imgRes.status}):`, errTxt.slice(0, 300));
                }
              } catch (iErr) {
                console.warn(`[Gemini Provider] Direct Imagen call notice (${ep}):`, iErr);
              }
            }
          }

          throw new Error("Gemini image generation failed across native and Imagen models.");
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

        // Handle OpenAI Image Generation (GPT-Image-1.5 / GPT-Image-1 / GPT-Image-1-Mini / DALL-E 3)
        if (options.capability === "Image Generation") {
          const requestedModel = options.model || "gpt-image-1.5";
          const candidateModels = [
            requestedModel,
            "gpt-image-1.5",
            "gpt-image-1",
            "gpt-image-1-mini",
            "dall-e-3",
          ].filter((m, idx, arr) => arr.indexOf(m) === idx);

          const buildPayload = (model: string, size = "1024x1536") => {
            const isGptImage = model.startsWith("gpt-image");
            if (isGptImage) {
              return {
                model,
                prompt: options.prompt,
                n: 1,
                size, // portrait 9:16 for GPT Image (no response_format!)
              };
            }
            return {
              model: "dall-e-3",
              prompt: options.prompt,
              n: 1,
              size: "1024x1792",
              response_format: "b64_json",
            };
          };

          for (const modelToTry of candidateModels) {
            const sizesToTry = modelToTry.startsWith("gpt-image") ? ["1024x1536", "1024x1024", "auto"] : ["1024x1792"];

            for (const sizeChoice of sizesToTry) {
              const openAiImagePayload = buildPayload(modelToTry, sizeChoice);

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
                  } else {
                    const errText = await imgRes.text().catch(() => "");
                    console.warn(`[OpenAI Provider] Direct image failed (${modelToTry}, ${sizeChoice} - ${imgRes.status}):`, errText.slice(0, 300));
                  }
                } catch (dallErr) {
                  console.warn(`[OpenAI Provider] Direct image call notice (${modelToTry}):`, dallErr);
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
                } else {
                  const errText = await proxyRes.text().catch(() => "");
                  console.warn(`[OpenAI Provider] Proxy image failed (${modelToTry}, ${sizeChoice} - ${proxyRes.status}):`, errText.slice(0, 300));
                }
              } catch (pErr) {
                console.warn(`[OpenAI Provider] Image proxy notice (${modelToTry}):`, pErr);
              }
            }
          }

          throw new Error("OpenAI image generation failed across all candidate models.");
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
              } else {
                const errText = await imgRes.text().catch(() => "");
                console.warn(`[Grok Provider] Direct image call failed (${imageModel} - ${imgRes.status}):`, errText.slice(0, 300));
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
            } else {
              const errText = await proxyRes.text().catch(() => "");
              console.warn(`[Grok Provider] Proxy image call failed (${imageModel} - ${proxyRes.status}):`, errText.slice(0, 300));
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

        // 4B. Grok Video Generation (grok-imagine-video-1.5 / grok-imagine-video 9:16 vertical)
        if (options.capability === "Video Generation") {
          const candidateVideoModels = [
            options.model,
            "grok-imagine-video-1.5",
            "grok-imagine-video",
          ].filter(Boolean) as string[];

          let requestId = "";
          let finalVideoUrl = "";

          const targetAspect = options.aspectRatio === "16:9" ? "16:9" : "9:16";
          for (const videoModel of candidateVideoModels) {
            const grokVideoPayload: any = {
              model: videoModel,
              prompt: options.prompt,
              aspect_ratio: targetAspect,
            };
            if (options.referenceImageUrl) {
              grokVideoPayload.image_url = options.referenceImageUrl;
              console.log(`[Grok Provider] Conditioning Grok video generation on scene still reference`);
            }

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
                  finalVideoUrl = extractGrokVideoUrl(vData);
                  if (requestId || finalVideoUrl) break;
                } else {
                  const errTxt = await vRes.text().catch(() => "");
                  console.warn(`[Grok Provider] Direct video generation start failed (${videoModel} - ${vRes.status}):`, errTxt.slice(0, 300));
                }
              } catch (vErr) {
                console.warn(`[Grok Provider] Direct video generation start notice (${videoModel}):`, vErr);
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
                  finalVideoUrl = extractGrokVideoUrl(data);
                  if (requestId || finalVideoUrl) break;
                } else {
                  const errTxt = await proxyRes.text().catch(() => "");
                  console.warn(`[Grok Provider] Proxy video generation start failed (${videoModel} - ${proxyRes.status}):`, errTxt.slice(0, 300));
                }
              } catch (pErr) {
                console.warn(`[Grok Provider] Video generation proxy start notice (${videoModel}):`, pErr);
              }
            }

            if (requestId || finalVideoUrl) break;
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
                  finalVideoUrl = extractGrokVideoUrl(pollData);
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

          throw new Error("Grok Video Generation timed out or returned no video URL.");
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
    // Video Generation: Gemini (default) -> Grok (never OpenAI/Claude)
    // Image Generation: OpenAI (default) -> Gemini -> Grok
    // Video Understanding: Grok -> Gemini -> OpenAI -> Claude
    // Chat / Reasoning / Others: OpenAI -> Gemini -> Claude -> Grok
    let categoryPriority: AIProviderId[];
    if (capability === "Video Generation") {
      categoryPriority = ["gemini", "grok"];
    } else if (capability === "Image Generation") {
      categoryPriority = ["openai", "gemini", "grok"];
    } else if (capability === "Video Understanding") {
      categoryPriority = ["grok", "gemini", "openai", "claude"];
    } else {
      categoryPriority = ["openai", "gemini", "claude", "grok"];
    }

    const hasExplicitKey = (p: AIProviderPlugin) => Boolean(resolveProviderKey(p.id, customKeys));

    availableOthers.sort((a, b) => {
      const keyA = hasExplicitKey(a) ? 0 : 1;
      const keyB = hasExplicitKey(b) ? 0 : 1;
      if (keyA !== keyB) return keyA - keyB;
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

    // Execute with automatic retry & seamless failover across candidate providers
    let lastError: Error | null = null;
    const maxCandidates = capability === "Image Generation" || capability === "Video Generation" ? 3 : 2;
    const candidatesToTry = candidates.slice(0, maxCandidates);

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
