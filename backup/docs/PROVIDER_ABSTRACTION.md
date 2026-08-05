# SPARK Provider Abstraction

This document defines the common TypeScript interface contract for model providers in the SPARK Media Operating System. All provider adapters (Gemini, Claude, OpenAI, etc.) must implement this contract, making underlying models hot-swappable.

---

## 1. Provider Contract Interface

```typescript
export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  systemInstruction?: string;
  responseMimeType?: "text/plain" | "application/json";
  responseSchema?: any;           // JSON Schema for structured output
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: any;                // JSON Schema parameters
}

export interface ProviderResponse {
  text: string;
  role: "model" | "assistant";
  toolCalls?: { name: string; args: any }[];
  finishReason: "stop" | "max_tokens" | "safety" | string;
}

export interface ILlmProvider {
  /**
   * Generates a single static text completion.
   */
  generate(prompt: string, options?: GenerationOptions): Promise<ProviderResponse>;

  /**
   * Streams generation chunks in real-time.
   */
  stream(prompt: string, options?: GenerationOptions): Promise<ReadableStream<string>>;

  /**
   * Generates vector embeddings for a given input text.
   */
  embed(text: string): Promise<number[]>;

  /**
   * Analyzes vision/image files alongside prompt context.
   */
  vision(imageBuffer: ArrayBuffer, prompt: string, options?: GenerationOptions): Promise<ProviderResponse>;

  /**
   * Executes multi-step complex reasoning tasks (using reasoning-capable models).
   */
  reason(prompt: string, options?: GenerationOptions): Promise<ProviderResponse>;

  /**
   * Guarantees structured output conforming to a specified JSON Schema.
   */
  structuredOutput<T>(prompt: string, schema: any, options?: GenerationOptions): Promise<T>;

  /**
   * Binds tool/function definitions allowing the model to return tool calls.
   */
  toolCalling(prompt: string, tools: ToolDefinition[], options?: GenerationOptions): Promise<ProviderResponse>;

  /**
   * Returns current health and rate-limit availability statistics of the provider.
   */
  availability(): Promise<{ healthy: boolean; remainingRequests: number; resetTime: string }>;
}
```

---

## 2. Integration Mapping

* **Gemini Adapter**: Maps `ILlmProvider` to Google's `@google/generative-ai` SDK. Supports native `structuredOutput` and high-speed `stream` routines.
* **OpenAI Adapter**: Maps to the official `openai` Node SDK.
* **Claude Adapter**: Maps to `@anthropic-ai/sdk` and handles Anthropic prompt structures.
