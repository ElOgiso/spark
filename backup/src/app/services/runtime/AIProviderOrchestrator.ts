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
  if (customKeys?.[providerId]) return customKeys[providerId];

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const sparkKeysRaw = localStorage.getItem("spark_ai_keys");
      if (sparkKeysRaw) {
        const parsed = JSON.parse(sparkKeysRaw);
        if (parsed?.[providerId]) return parsed[providerId];
      }
      const directKey = localStorage.getItem(`${providerId}_api_key`) || localStorage.getItem(`spark_${providerId}_key`);
      if (directKey) return directKey;
    } catch {}
  }

  if (typeof process !== "undefined" && process.env) {
    const p = process.env;
    const envMap: Record<string, string | undefined> = {
      gemini: p.GOOGLE_AI_API_KEY || p.GEMINI_API_KEY || p.GOOGLE_API_KEY || p.VITE_GOOGLE_AI_API_KEY || p.VITE_GEMINI_API_KEY || p.VITE_GOOGLE_API_KEY,
      openai: p.OPENAI_API_KEY || p.OPEN_AI_KEY || p.VITE_OPENAI_API_KEY,
      claude: p.ANTHROPIC_API_KEY || p.CLAUDE_API_KEY || p.VITE_ANTHROPIC_API_KEY,
      grok: p.XAI_API_KEY || p.GROK_API_KEY || p.VITE_XAI_API_KEY,
      elevenlabs: p.elevenlabs_API_Key || p.ELEVENLABS_API_KEY || p.VITE_ELEVENLABS_API_KEY,
      higgsfield: p.HIGGSFIELD_API_KEY || p.VITE_HIGGSFIELD_API_KEY,
    };
    if (envMap[providerId]) return envMap[providerId];
  }

  if (typeof import.meta !== "undefined" && (import.meta as any).env) {
    const m = (import.meta as any).env;
    const metaMap: Record<string, string | undefined> = {
      gemini: m.VITE_GOOGLE_AI_API_KEY || m.GOOGLE_AI_API_KEY || m.VITE_GEMINI_API_KEY || m.GEMINI_API_KEY || m.VITE_GOOGLE_API_KEY || m.GOOGLE_API_KEY,
      openai: m.VITE_OPENAI_API_KEY || m.OPENAI_API_KEY,
      claude: m.VITE_ANTHROPIC_API_KEY || m.ANTHROPIC_API_KEY || m.VITE_CLAUDE_API_KEY,
      grok: m.VITE_XAI_API_KEY || m.XAI_API_KEY || m.VITE_GROK_API_KEY,
      elevenlabs: m.VITE_ELEVENLABS_API_KEY || m.elevenlabs_API_Key || m.ELEVENLABS_API_KEY,
      higgsfield: m.VITE_HIGGSFIELD_API_KEY || m.HIGGSFIELD_API_KEY,
    };
    if (metaMap[providerId]) return metaMap[providerId];
  }

  return undefined;
}

export class AIProviderOrchestrator {
  private static plugins: Map<AIProviderId, AIProviderPlugin> = new Map();
  private static providerHealth: Map<AIProviderId, { healthy: boolean; latencyMs: number; errorCount: number }> = new Map();

  static initialize(): void {
    if (this.plugins.size > 0) return;

    // 1. Google Gemini Provider Plugin
    this.registerPlugin({
      id: "gemini",
      name: "Google Gemini (2.0 Flash / Pro)",
      capabilities: ["Chat", "Vision", "Video Understanding", "Reasoning", "Text To Speech"],
      isAvailable: (customKeys) => Boolean(resolveProviderKey("gemini", customKeys)),
      execute: async (options) => {
        const apiKey = resolveProviderKey("gemini", options.customApiKeys);
        if (!apiKey) throw new Error("Google Gemini API Key missing");

        const { GoogleGenAI } = await import("@google/genai").catch(() => ({ GoogleGenAI: null as any }));
        if (!GoogleGenAI) throw new Error("Google GenAI SDK unavailable");

        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { "User-Agent": "aistudio-build" } },
        });

        const contents = (options.history || []).map((h) => ({
          role: h.role,
          parts: h.parts,
        }));
        contents.push({ role: "user", parts: [{ text: options.prompt }] });

        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash-exp",
          contents,
          config: options.systemInstruction ? { systemInstruction: options.systemInstruction } : undefined,
        });

        const text = response.text || "";
        if (options.onChunk) options.onChunk(text);
        return text;
      },
    });

    // 2. OpenAI Provider Plugin (GPT-4o / GPT-5.5)
    this.registerPlugin({
      id: "openai",
      name: "OpenAI (GPT-4o / GPT-5.5)",
      capabilities: ["Chat", "Vision", "Video Understanding", "Reasoning", "Tool Calling"],
      isAvailable: (customKeys) => Boolean(resolveProviderKey("openai", customKeys)),
      execute: async (options) => {
        const apiKey = resolveProviderKey("openai", options.customApiKeys);
        if (!apiKey) throw new Error("OpenAI API Key missing");

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

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`OpenAI API error (${res.status}): ${errText}`);
        }

        const data = await res.json();
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
      isAvailable: (customKeys) => Boolean(resolveProviderKey("claude", customKeys)),
      execute: async (options) => {
        const apiKey = resolveProviderKey("claude", options.customApiKeys);
        if (!apiKey) throw new Error("Anthropic API Key missing");

        const messages = [];
        if (options.history) {
          options.history.forEach((h) => {
            messages.push({ role: h.role === "model" ? "assistant" : "user", content: h.parts[0]?.text || "" });
          });
        }
        messages.push({ role: "user", content: options.prompt });

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

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Anthropic Claude API error (${res.status}): ${errText}`);
        }

        const data = await res.json();
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
      isAvailable: (customKeys) => Boolean(resolveProviderKey("grok", customKeys)),
      execute: async (options) => {
        const apiKey = resolveProviderKey("grok", options.customApiKeys);
        if (!apiKey) throw new Error("xAI Grok API Key missing");

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

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`xAI Grok API error (${res.status}): ${errText}`);
        }

        const data = await res.json();
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
        throw new Error("ElevenLabs execution requires voice synthesis parameter.");
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
    for (const plugin of allPlugins) {
      if (!candidates.some((c) => c.id === plugin.id)) {
        if (plugin.isAvailable(customKeys) && plugin.capabilities.includes(capability)) {
          const health = this.providerHealth.get(plugin.id);
          if (!health || health.healthy) {
            candidates.push(plugin);
          }
        }
      }
    }

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

          // Record healthy stats
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
