# SPARK Execution Error Model

This document outlines the standardized error model schema and handling policies used by the Execution Adapter when communicating with external LLM providers.

---

## 1. Standard Error Schema

Every failure occurring during execution must map to the following standardized representation:

```typescript
export type ErrorCategory =
  | "PROVIDER_UNAVAILABLE"       // 503, connection dropped, DNS timeouts
  | "TIMEOUT"                    // AbortSignal triggered by deadline policies
  | "RATE_LIMIT"                 // 429 quota exhaustion
  | "INVALID_RESPONSE"           // Malformed JSON output or failed schema checks
  | "PARTIAL_COMPLETION"         // Output terminated due to max_tokens or finish_reason safety
  | "RETRY_EXHAUSTED"            // Attempt count exceeded retry limit
  | "VALIDATION_FAILED";         // Input validation checks failed prior to call

export interface SparkExecutionError {
  taskId: string;
  pipelineId: string;
  category: ErrorCategory;
  message: string;
  timestamp: string;
  
  // Retries context
  attemptNumber: number;
  maxAttempts: number;
  
  // Provider specifics (sanitized)
  providerId: string;
  modelId: string;
  rawErrorCode?: string | number;
}
```

---

## 2. Standardized Error Policies

* **Provider Unavailable / Connection Failures**:
  - *Policy*: Trigger exponential back-off retries (`attemptNumber * 1000ms`). If attempts reach the retry limit, route is flagged as degraded and the task returns `RETRY_EXHAUSTED` to the orchestrator.
* **Rate Limits (429)**:
  - *Policy*: Check for `Retry-After` header. If absent, apply jitter back-off (random latency buffer) before trying again.
* **Timeouts**:
  - *Policy*: Enforce a standard 15-second timeout window using `AbortController` signals. Bypasses additional retries and reports immediately to trigger a router model-swap.
* **Invalid Responses / Schema Failures**:
  - *Policy*: If structured JSON validation fails, try once more with a system prompt correction override. If it fails again, abort and throw `INVALID_RESPONSE`.
