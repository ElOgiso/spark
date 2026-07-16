# SPARK Execution Adapter Architecture

This document defines the architecture of the SPARK Execution Adapter. The adapter serves as the runtime abstraction layer positioned between the Model Router and external AI providers, keeping SPARK's core logic entirely provider-agnostic.

---

## 1. Execution Adapter Map

```text
                  Model Router (Resolves Target Route)
                               │
                               ▼
                       Execution Adapter
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
      Gemini Adapter     OpenAI Adapter     Claude Adapter (Provider Adapters)
            │                  │                  │
            ▼                  ▼                  ▼
        Google AI          OpenAI API         Anthropic API (External LLMs)
```

---

## 2. Design Goals & Responsibilities

1. **Provider Encapsulation**: Low-level vendor SDKs (e.g. `@google/generative-ai` or `openai` node packages) are restricted to their corresponding Provider Adapter file. They are never imported by agents, state providers, or database schemas.
2. **Translation & Normalization**:
   - Converts the inbound `AgentTask` payload into the structure required by the target provider's API.
   - Restructures raw provider outputs (e.g., Anthropic content blocks vs. Gemini candidates) back into the standard `AgentResult` format.
3. **Task Controls**: Directs retry back-off loops, stream chunking, structured JSON schema validations, and task cancellations.
4. **Metrics Tracking**: Computes token usage, response delays, and monetary costs, packing them into the `ExecutionMetrics` contract.
