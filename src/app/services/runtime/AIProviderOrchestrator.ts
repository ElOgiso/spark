import type { AICapabilityType, AIProviderId, ThinkingState } from "../../domain/types";

export interface AIExecutionOptions {
  prompt: string;
  systemInstruction?: string;
  history?: { role: "user" | "model"; parts: { text: string }[] }[];
  context?: any;
  preferredProvider?: AIProviderId;
  capability?: AICapabilityType;
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

    // 1. Google Gemini Provider Plugin (Gemini 2.0 Flash)
    this.registerPlugin({
      id: "gemini",
      name: "Google Gemini (2.0 Flash / Pro)",
      capabilities: ["Chat", "Vision", "Video Understanding", "Reasoning", "Text To Speech"],
      isAvailable: (customKeys) => true,
      execute: async (options) => {
        const apiKey = resolveProviderKey("gemini", options.customApiKeys);
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
                model: "gemini-2.0-flash",
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
        const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
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

    // 2. OpenAI Provider Plugin (GPT-4o / GPT-5.4 / GPT-Image-1.5)
    this.registerPlugin({
      id: "openai",
      name: "OpenAI (GPT-4o / GPT-5.4 / GPT-Image-1.5)",
      capabilities: ["Chat", "Vision", "Video Understanding", "Reasoning", "Tool Calling", "Image Generation"],
      isAvailable: (customKeys) => true,
      execute: async (options) => {
        const apiKey = resolveProviderKey("openai", options.customApiKeys);

        if (apiKey) {
          // Direct client execution if key present
          if (options.capability === "Image Generation") {
            try {
              const res = await fetch("https://api.openai.com/v1/responses", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                  model: "gpt-5.4-mini",
                  input: [{ role: "user", content: options.prompt }],
                  text: { format: { type: "text" }, verbosity: "medium" },
                  reasoning: { effort: "medium", mode: "standard", summary: "auto" },
                  tools: [
                    { type: "web_search", user_location: { type: "approximate" }, search_context_size: "high" },
                    {
                      type: "image_generation",
                      model: "gpt-image-1.5",
                      size: "auto",
                      quality: "high",
                      output_format: "png",
                      background: "auto",
                      moderation: "auto",
                      partial_images: 3,
                    },
                  ],
                  store: true,
                  include: ["reasoning.encrypted_content", "web_search_call.action.sources"],
                }),
              });

              if (res.ok) {
                const data = await res.json();
                const outputItem = data.output?.find((o: any) => o.type === "image_generation" || o.type === "message" || o.image_url);
                const imageUrl = outputItem?.image_url || outputItem?.content?.[0]?.image_url?.url || data.output?.[0]?.content?.[0]?.text;
                if (imageUrl) {
                  if (options.onChunk) options.onChunk(imageUrl);
                  return imageUrl;
                }
              }
            } catch (respErr) {
              console.warn("[OpenAI Provider] Responses API image generation notice, falling back:", respErr);
            }

            const imgRes = await fetch("https://api.openai.com/v1/images/generations", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: "dall-e-3",
                prompt: options.prompt,
                n: 1,
                size: "1024x1024",
              }),
            });
            if (imgRes.ok) {
              const imgData = await imgRes.json();
              const url = imgData.data?.[0]?.url || "";
              if (options.onChunk) options.onChunk(url);
              return url;
            }
          }

          try {
            const messages = [];
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
                model: "gpt-4o",
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
            payload: { model: "gpt-4o", messages, temperature: 0.7 },
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

    // 3. Anthropic Claude Provider Plugin (Claude 3.5 Sonnet)
    this.registerPlugin({
      id: "claude",
      name: "Anthropic Claude (3.5 Sonnet)",
      capabilities: ["Chat", "Vision", "Reasoning", "Tool Calling"],
      isAvailable: (customKeys) => true,
      execute: async (options) => {
        const apiKey = resolveProviderKey("claude", options.customApiKeys);

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

            const res = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true",
              },
              body: JSON.stringify({
                model: "claude-3-5-sonnet-20241022",
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

        const proxyRes = await fetch("/api/runtime/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "anthropic",
            endpoint: "https://api.anthropic.com/v1/messages",
            payload: {
              model: "claude-3-5-sonnet-20241022",
              max_tokens: 4096,
              system: options.systemInstruction,
              messages,
            },
          }),
        });

        if (!proxyRes.ok) {
          const errData = await proxyRes.json().catch(() => ({}));
          throw new Error(errData.error || `Anthropic Claude proxy failed (${proxyRes.status})`);
        }

        const data = await proxyRes.json();
        const text = data.content?.[0]?.text || "";
        if (options.onChunk) options.onChunk(text);
        return text;
      },
    });

    // 4. xAI Grok Provider Plugin (Grok Vision / Beta)
    this.registerPlugin({
      id: "grok",
      name: "xAI Grok (Grok-2 / Grok Vision)",
      capabilities: ["Chat", "Vision", "Video Understanding", "Reasoning"],
      isAvailable: (customKeys) => true,
      execute: async (options) => {
        const apiKey = resolveProviderKey("grok", options.customApiKeys);

        if (apiKey) {
          try {
            const messages = [];
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
                model: "grok-beta",
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
            payload: { model: "grok-beta", messages, temperature: 0.7 },
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
        const audioUri = await generateElevenLabsVoice(options.prompt);
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

    // Execute with automatic retry & seamless failover across candidate providers
    let lastError: Error | null = null;

    for (let i = 0; i < candidates.length; i++) {
      const provider = candidates[i];
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
