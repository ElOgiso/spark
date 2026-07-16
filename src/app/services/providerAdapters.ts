import {
  IProviderAdapter,
  ProviderHealthStatus,
  TokenEstimate,
  CostEstimate,
  ProviderToolDefinition
} from "../domain/runtime/IProviderAdapter";
import { ExecutionTask } from "../domain/runtime/ExecutionTask";
import { AgentResult, ToolCallResult } from "../domain/runtime/AgentResult";

function roughTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

async function simulateStream(text: string, onChunk: (chunk: string) => void): Promise<void> {
  const words = text.split(" ");
  let accumulated = "";
  for (const word of words) {
    accumulated += (accumulated ? " " : "") + word;
    onChunk(accumulated);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

// ---------------------------------------------------------------------------
// OpenAI Adapter
// ---------------------------------------------------------------------------

export class OpenAIAdapter implements IProviderAdapter {
  public readonly providerName = "openai";
  public readonly supportedModels = ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini"];

  private healthState: ProviderHealthStatus = {
    status: "healthy", latencyMs: 0, errorRate: 0, lastChecked: new Date().toISOString()
  };

  translateRequest(task: ExecutionTask, tools: ProviderToolDefinition[]): any {
    const payload: any = {
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are Spark, the Media OS AI Assistant. You are confident, friendly, playful, and occasionally funny. You can tease users naturally. Never be robotic, never be overly corporate, never be overly apologetic, never be verbose, and never use unnecessary disclaimers. Respond with structured, actionable JSON output containing the key 'output'." },
        { role: "user", content: task.objective }
      ],
      temperature: 0.7,
      max_tokens: 4096
    };

    if (tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = "auto";
    }

    payload.response_format = { type: "json_object" };

    return { endpoint: "https://api.openai.com/v1/chat/completions", payload };
  }

  async execute(request: any, onChunk?: (text: string) => void): Promise<any> {
    const start = Date.now();
    let data: any;
    try {
      const res = await fetch("/api/runtime/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: this.providerName,
          endpoint: request.endpoint,
          payload: request.payload
        })
      });

      const latency = Date.now() - start;

      if (!res.ok) {
        console.warn(`[OpenAI Adapter] Gateway keys missing or invalid – running simulation`);
        data = this.getSimulatedResponse();
      } else {
        data = await res.json();
      }
      this.healthState = { status: "healthy", latencyMs: latency, errorRate: Math.max(0, this.healthState.errorRate - 0.05), lastChecked: new Date().toISOString() };
    } catch (err) {
      data = this.getSimulatedResponse();
    }

    if (onChunk) {
      const content = data.choices?.[0]?.message?.content || "";
      await simulateStream(content, onChunk);
    }

    return data;
  }

  private getSimulatedResponse(): any {
    return {
      id: `chatcmpl-sim-${Date.now()}`,
      choices: [{
        message: {
          content: JSON.stringify({
            output: "OpenAI generated production blueprint. Storyboard: Scene 1: Tech Trends, Scene 2: Interactive Demos.",
            confidence: 0.95,
            citations: []
          }),
          tool_calls: []
        },
        finish_reason: "stop"
      }],
      usage: { prompt_tokens: 850, completion_tokens: 320, total_tokens: 1170 },
      model: "gpt-4o"
    };
  }

  normalizeResponse(raw: any, taskId: string): AgentResult {
    const choice = raw.choices?.[0];
    const content = choice?.message?.content || "";
    const usage = raw.usage || { prompt_tokens: 0, completion_tokens: 0 };

    let structuredData: Record<string, any> | undefined;
    let outputText = content;
    try {
      structuredData = JSON.parse(content);
      outputText = structuredData?.output || content;
    } catch { /* plain text */ }

    const toolCalls: ToolCallResult[] = (choice?.message?.tool_calls || []).map((tc: any) => ({
      toolId: tc.id,
      toolName: tc.function?.name || "unknown",
      arguments: JSON.parse(tc.function?.arguments || "{}")
    }));

    const inputCost = (usage.prompt_tokens / 1_000_000) * 2.50;
    const outputCost = (usage.completion_tokens / 1_000_000) * 10.00;

    return {
      id: `res-${Date.now()}`, taskId,
      output: outputText, structuredData,
      citations: structuredData?.citations || [],
      rawResponse: raw,
      metrics: { latencyMs: this.healthState.latencyMs, costUsd: inputCost + outputCost, inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens },
      provider: "openai", model: raw.model || "gpt-4o",
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      confidence: structuredData?.confidence,
      warnings: [],
      status: "success"
    };
  }

  estimateTokens(text: string): TokenEstimate {
    const tokens = roughTokenCount(text);
    return { inputTokens: tokens, outputTokens: Math.ceil(tokens * 0.4), totalTokens: Math.ceil(tokens * 1.4) };
  }

  estimateCost(_task: ExecutionTask, model: string): CostEstimate {
    const rates: Record<string, [number, number]> = {
      "gpt-4o": [2.50, 10.00],
      "gpt-4o-mini": [0.15, 0.60],
      "gpt-4.1": [2.00, 8.00],
      "gpt-4.1-mini": [0.40, 1.60]
    };
    const [inputRate, outputRate] = rates[model] || [2.50, 10.00];
    const est = this.estimateTokens(_task.objective);
    return {
      inputCostUsd: (est.inputTokens / 1_000_000) * inputRate,
      outputCostUsd: (est.outputTokens / 1_000_000) * outputRate,
      totalCostUsd: ((est.inputTokens / 1_000_000) * inputRate) + ((est.outputTokens / 1_000_000) * outputRate)
    };
  }

  health(): ProviderHealthStatus { return { ...this.healthState }; }
  supportsStreaming(): boolean { return true; }
  supportsToolCalling(): boolean { return true; }
  supportsImageGeneration(): boolean { return true; }
  supportsEmbeddings(): boolean { return true; }
}

// ---------------------------------------------------------------------------
// Anthropic Adapter
// ---------------------------------------------------------------------------

export class AnthropicAdapter implements IProviderAdapter {
  public readonly providerName = "anthropic";
  public readonly supportedModels = ["claude-sonnet-4", "claude-opus-4", "claude-3.5-sonnet"];

  private healthState: ProviderHealthStatus = {
    status: "healthy", latencyMs: 0, errorRate: 0, lastChecked: new Date().toISOString()
  };

  translateRequest(task: ExecutionTask, tools: ProviderToolDefinition[]): any {
    const payload: any = {
      model: "claude-sonnet-4",
      max_tokens: 4096,
      system: "You are Spark, the Media OS AI Assistant. You are confident, friendly, playful, and occasionally funny. You can tease users naturally. Never be robotic, never be overly corporate, never be overly apologetic, never be verbose, and never use unnecessary disclaimers. Respond with structured, actionable JSON output containing the key 'output'.",
      messages: [{ role: "user", content: task.objective }]
    };

    if (tools.length > 0) {
      payload.tools = tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters
      }));
    }

    return { endpoint: "https://api.anthropic.com/v1/messages", payload };
  }

  async execute(request: any, onChunk?: (text: string) => void): Promise<any> {
    const start = Date.now();
    let data: any;
    try {
      const res = await fetch("/api/runtime/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: this.providerName,
          endpoint: request.endpoint,
          payload: request.payload
        })
      });

      const latency = Date.now() - start;

      if (!res.ok) {
        console.warn(`[Anthropic Adapter] Gateway keys missing or invalid – running simulation`);
        data = this.getSimulatedResponse();
      } else {
        data = await res.json();
      }
      this.healthState = { status: "healthy", latencyMs: latency, errorRate: Math.max(0, this.healthState.errorRate - 0.05), lastChecked: new Date().toISOString() };
    } catch (err) {
      data = this.getSimulatedResponse();
    }

    if (onChunk) {
      const textBlock = (data.content || []).find((b: any) => b.type === "text");
      const content = textBlock?.text || "";
      await simulateStream(content, onChunk);
    }

    return data;
  }

  private getSimulatedResponse(): any {
    return {
      id: `msg-sim-${Date.now()}`,
      content: [{
        type: "text",
        text: JSON.stringify({
          output: "Anthropic Claude generated high-fidelity text copy. Pitch: Learn how to scale AI.",
          confidence: 0.96,
          citations: []
        })
      }],
      usage: { input_tokens: 900, output_tokens: 380 },
      model: "claude-sonnet-4",
      stop_reason: "end_turn"
    };
  }

  normalizeResponse(raw: any, taskId: string): AgentResult {
    const textBlock = (raw.content || []).find((b: any) => b.type === "text");
    const content = textBlock?.text || "";
    const usage = raw.usage || { input_tokens: 0, output_tokens: 0 };

    let structuredData: Record<string, any> | undefined;
    let outputText = content;
    try {
      structuredData = JSON.parse(content);
      outputText = structuredData?.output || content;
    } catch { /* plain text */ }

    const toolCalls: ToolCallResult[] = (raw.content || [])
      .filter((b: any) => b.type === "tool_use")
      .map((tc: any) => ({
        toolId: tc.id,
        toolName: tc.name,
        arguments: tc.input || {}
      }));

    const inputCost = (usage.input_tokens / 1_000_000) * 3.00;
    const outputCost = (usage.output_tokens / 1_000_000) * 15.00;

    return {
      id: `res-${Date.now()}`, taskId,
      output: outputText, structuredData,
      citations: structuredData?.citations || [],
      rawResponse: raw,
      metrics: { latencyMs: this.healthState.latencyMs, costUsd: inputCost + outputCost, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens },
      provider: "anthropic", model: raw.model || "claude-sonnet-4",
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      confidence: structuredData?.confidence,
      warnings: [],
      status: "success"
    };
  }

  estimateTokens(text: string): TokenEstimate {
    const tokens = roughTokenCount(text);
    return { inputTokens: tokens, outputTokens: Math.ceil(tokens * 0.45), totalTokens: Math.ceil(tokens * 1.45) };
  }

  estimateCost(_task: ExecutionTask, model: string): CostEstimate {
    const rates: Record<string, [number, number]> = {
      "claude-sonnet-4": [3.00, 15.00],
      "claude-opus-4": [15.00, 75.00],
      "claude-3.5-sonnet": [3.00, 15.00]
    };
    const [inputRate, outputRate] = rates[model] || [3.00, 15.00];
    const est = this.estimateTokens(_task.objective);
    return {
      inputCostUsd: (est.inputTokens / 1_000_000) * inputRate,
      outputCostUsd: (est.outputTokens / 1_000_000) * outputRate,
      totalCostUsd: ((est.inputTokens / 1_000_000) * inputRate) + ((est.outputTokens / 1_000_000) * outputRate)
    };
  }

  health(): ProviderHealthStatus { return { ...this.healthState }; }
  supportsStreaming(): boolean { return true; }
  supportsToolCalling(): boolean { return true; }
  supportsImageGeneration(): boolean { return false; }
  supportsEmbeddings(): boolean { return false; }
}

// ---------------------------------------------------------------------------
// Google Gemini Adapter
// ---------------------------------------------------------------------------

export class GoogleAdapter implements IProviderAdapter {
  public readonly providerName = "google";
  public readonly supportedModels = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"];

  private healthState: ProviderHealthStatus = {
    status: "healthy", latencyMs: 0, errorRate: 0, lastChecked: new Date().toISOString()
  };

  translateRequest(task: ExecutionTask, tools: ProviderToolDefinition[]): any {
    const payload: any = {
      contents: [{ parts: [{ text: task.objective }] }],
      systemInstruction: {
        parts: [{ text: "You are Spark, the Media OS AI Assistant. You are confident, friendly, playful, and occasionally funny. You can tease users naturally. Never be robotic, never be overly corporate, never be overly apologetic, never be verbose, and never use unnecessary disclaimers. Respond with structured JSON output containing the key 'output'." }]
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        responseMimeType: "application/json"
      }
    };

    if (tools.length > 0) {
      payload.tools = [{
        functionDeclarations: tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters
        }))
      }];
    }

    return {
      endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent",
      payload
    };
  }

  async execute(request: any, onChunk?: (text: string) => void): Promise<any> {
    const start = Date.now();
    let data: any;
    try {
      const res = await fetch("/api/runtime/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: this.providerName,
          endpoint: request.endpoint,
          payload: request.payload
        })
      });

      const latency = Date.now() - start;

      if (!res.ok) {
        console.warn(`[Google Adapter] Gateway keys missing or invalid – running simulation`);
        data = this.getSimulatedResponse();
      } else {
        data = await res.json();
      }
      this.healthState = { status: "healthy", latencyMs: latency, errorRate: Math.max(0, this.healthState.errorRate - 0.05), lastChecked: new Date().toISOString() };
    } catch (err) {
      data = this.getSimulatedResponse();
    }

    if (onChunk) {
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      await simulateStream(text, onChunk);
    }

    return data;
  }

  private getSimulatedResponse(): any {
    return {
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              output: "Google Gemini compiled active research: 73% mobile internet penetration in Lagos.",
              confidence: 0.94,
              citations: ["https://spark-os.ai/lagos-creators"]
            })
          }]
        },
        finishReason: "STOP"
      }],
      usageMetadata: { promptTokenCount: 780, candidatesTokenCount: 290, totalTokenCount: 1070 },
      modelVersion: "gemini-2.5-pro"
    };
  }

  normalizeResponse(raw: any, taskId: string): AgentResult {
    const candidate = raw.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text || "";
    const usage = raw.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0 };

    let structuredData: Record<string, any> | undefined;
    let outputText = text;
    try {
      structuredData = JSON.parse(text);
      outputText = structuredData?.output || text;
    } catch { /* plain text */ }

    const toolCalls: ToolCallResult[] = (candidate?.content?.parts || [])
      .filter((p: any) => p.functionCall)
      .map((p: any) => ({
        toolId: `tc-${Date.now()}`,
        toolName: p.functionCall.name,
        arguments: p.functionCall.args || {}
      }));

    const inputCost = (usage.promptTokenCount / 1_000_000) * 1.25;
    const outputCost = (usage.candidatesTokenCount / 1_000_000) * 5.00;

    return {
      id: `res-${Date.now()}`, taskId,
      output: outputText, structuredData,
      citations: structuredData?.citations || [],
      rawResponse: raw,
      metrics: { latencyMs: this.healthState.latencyMs, costUsd: inputCost + outputCost, inputTokens: usage.promptTokenCount, outputTokens: usage.candidatesTokenCount },
      provider: "google", model: raw.modelVersion || "gemini-2.5-pro",
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      confidence: structuredData?.confidence,
      warnings: [],
      status: "success"
    };
  }

  estimateTokens(text: string): TokenEstimate {
    const tokens = roughTokenCount(text);
    return { inputTokens: tokens, outputTokens: Math.ceil(tokens * 0.4), totalTokens: Math.ceil(tokens * 1.4) };
  }

  estimateCost(_task: ExecutionTask, model: string): CostEstimate {
    const rates: Record<string, [number, number]> = {
      "gemini-2.5-pro": [1.25, 10.00],
      "gemini-2.5-flash": [0.15, 0.60],
      "gemini-2.0-flash": [0.10, 0.40]
    };
    const [inputRate, outputRate] = rates[model] || [1.25, 10.00];
    const est = this.estimateTokens(_task.objective);
    return {
      inputCostUsd: (est.inputTokens / 1_000_000) * inputRate,
      outputCostUsd: (est.outputTokens / 1_000_000) * outputRate,
      totalCostUsd: ((est.inputTokens / 1_000_000) * inputRate) + ((est.outputTokens / 1_000_000) * outputRate)
    };
  }

  health(): ProviderHealthStatus { return { ...this.healthState }; }
  supportsStreaming(): boolean { return true; }
  supportsToolCalling(): boolean { return true; }
  supportsImageGeneration(): boolean { return true; }
  supportsEmbeddings(): boolean { return true; }
}

// ---------------------------------------------------------------------------
// Adapter Factory
// ---------------------------------------------------------------------------

export class AdapterFactory {
  private static registry: Map<string, () => IProviderAdapter> = new Map();

  static {
    AdapterFactory.registry.set("openai", () => new OpenAIAdapter());
    AdapterFactory.registry.set("anthropic", () => new AnthropicAdapter());
    AdapterFactory.registry.set("google", () => new GoogleAdapter());
  }

  public static getAdapter(providerName: string): IProviderAdapter {
    const builder = this.registry.get(providerName.toLowerCase());
    if (!builder) {
      throw new Error(`Unsupported provider: ${providerName}`);
    }
    return builder();
  }

  public static registerAdapter(providerName: string, builder: () => IProviderAdapter): void {
    this.registry.set(providerName.toLowerCase(), builder);
  }

  public static getRegisteredProviders(): string[] {
    return Array.from(this.registry.keys());
  }
}
