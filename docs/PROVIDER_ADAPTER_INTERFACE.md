# Provider Adapter Interface Specification

This document defines the interface and data translation requirements for SPARK's Provider Adapters.

---

## 1. Provider Adapter Interface

```typescript
import { AgentTask, AgentResult } from "./decision";

export interface ProviderRequest {
  model: string;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  tools?: any[];
  responseFormat?: { type: "json_object"; schema?: any };
  temperature?: number;
  maxTokens?: number;
}

export interface IProviderAdapter {
  providerId: "gemini" | "openai" | "anthropic";

  /**
   * Translates the generic AgentTask payload into a vendor-specific request object.
   */
  translateRequest(task: AgentTask): Promise<ProviderRequest>;

  /**
   * Sends the translated request to the LLM API endpoints.
   */
  executeCall(request: ProviderRequest, signal?: AbortSignal): Promise<any>;

  /**
   * Restructures the vendor-specific raw response back into the standard AgentResult contract.
   */
  normalizeResponse(
    rawResponse: any,
    taskId: string,
    pipelineId: string
  ): Promise<Omit<AgentResult, "metrics">>;
}
```

---

## 2. Core Implementation Responsibilities

### A. Gemini Adapter
* **Mapping**: Connects to the Google Generative AI API.
* **Translation**: Formulates `Content[]` inputs mapping `systemInstruction`.
* **Output Normalization**: Parses `candidate.content.parts[0].text` and extracts tool call triggers.

### B. OpenAI Adapter
* **Mapping**: Connects to the OpenAI completions endpoint.
* **Translation**: Transforms parameters into the `ChatCompletionCreateParams` layout.
* **Output Normalization**: Unpacks `choices[0].message.content` and logs token usage counts.

### C. Anthropic Adapter
* **Mapping**: Connects to the Anthropic Messages API.
* **Translation**: Separates the system instruction parameter from chat message blocks.
* **Output Normalization**: Extracts data from Anthropic `ContentBlock` objects.
