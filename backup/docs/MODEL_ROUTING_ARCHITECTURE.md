# SPARK Model Routing Architecture

This document defines the interface and routing protocol for SPARK's provider-agnostic Model Routing System. The router has no business logic; it acts as an arbitrator determining which model is best suited to execute a given task.

---

## 1. Model Routing Interface

```typescript
export interface ModelRoutingCriteria {
  minContextWindow?: number;      // e.g. 8k, 128k, 1m tokens
  maxLatencyMs?: number;          // e.g. 500ms, 2000ms
  maxCostPerToken?: number;       // e.g. cost boundaries
  requiredCapabilities?: ("reasoning" | "vision" | "structuredOutput" | "toolCalling")[];
  priority?: "latency" | "cost" | "quality";
}

export interface RouterPreferences {
  workspacePreference?: string;   // e.g. "always-gemini"
  executiveOverrideModel?: string;// e.g. Manual override set in settings
  automationPolicy?: string;      // e.g. "manual", "balanced", "autonomous"
}

export interface ModelRoute {
  modelId: string;
  provider: "gemini" | "openai" | "claude" | string;
  endpointUrl: string;
  estimatedCostPerToken: number;
  estimatedLatencyMs: number;
}

export interface IModelRouter {
  /**
   * Resolves the best available route for a given task execution context.
   */
  resolveRoute(
    taskType: string,
    criteria: ModelRoutingCriteria,
    preferences: RouterPreferences
  ): Promise<ModelRoute>;

  /**
   * Lists all currently active and available models across configured providers.
   */
  getAvailableRoutes(): Promise<ModelRoute[]>;
}
```

---

## 2. Routing Decision Factors

The router determines execution paths using a multi-criteria scoring algorithm:

```text
Decision Score = (Quality_Weight * Quality) + (Latency_Weight * Latency) - (Cost_Weight * Cost)
```

1. **Context Window**: Heavy data analysis (e.g. Analytics audit of 30 past video summaries) routes to models with large windows (e.g. Gemini 1.5 Pro).
2. **Latency**: Fast chat prompts and voice streaming route to highly optimized low-latency models (e.g. Gemini Flash).
3. **Cost**: Repetitive pipeline operations (e.g. keyword expansion) route to lightweight models.
4. **Reasoning / Quality**: Creative scripting and storyboard layout reviews route to high-reasoning frontier models.
5. **Executive Override**: Any model specified in the user's Settings panel bypasses the auto-scoring router immediately.
6. **Automation Policy**: In `autonomous` mode, cost/latency optimization weight is increased; in `manual` mode, quality/reasoning score weight is prioritized.
