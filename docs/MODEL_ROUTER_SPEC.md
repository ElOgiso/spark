# Model Router Specification

This document defines the interface and routing parameter mappings for SPARK's Model Router. The router resolves available routes based on task requirements and provider performance logs.

---

## 1. Model Router Interface

```typescript
import { CapabilityRequirements } from "./decision";

export interface ProviderHealth {
  healthy: boolean;
  pingMs: number;
  rateLimitRemaining: number;
}

export interface RouterMetrics {
  qualityWeight: number;         // Scale of 0-10
  costWeight: number;            // Scale of 0-10
  latencyWeight: number;         // Scale of 0-10
  historicalSuccessWeight: number;// Scale of 0-10
}

export interface TargetRoute {
  modelId: string;
  provider: "gemini" | "openai" | "claude" | string;
  contextWindow: number;
  inputTokenCost: number;
  outputTokenCost: number;
}

export interface IModelRouter {
  /**
   * Evaluates requirements against model profiles and returns the optimal route.
   */
  resolveOptimalRoute(
    requirements: CapabilityRequirements,
    metrics: RouterMetrics,
    preferences: {
      overrideModelId?: string;
      preferredProvider?: string;
      automationMode: "manual" | "balanced" | "autonomous";
    }
  ): Promise<TargetRoute>;

  /**
   * Audits health and availability scores across providers.
   */
  auditProviderHealth(provider: string): Promise<ProviderHealth>;
}
```

---

## 2. Parameter Evaluation Strategy

1. **Quality**: Weighted for creative storytelling and safety checks.
2. **Cost**: Prioritized for background automation runs (e.g. daily indexing).
3. **Latency**: Heavily weighted for active chat console responses and voice processing.
4. **Context Window**: Determines feasibility (e.g. prompts exceeding 100k tokens trigger large-window model routes).
5. **Provider Health & Success Rate**: Historical metrics (e.g. 5xx rate and timeouts) deduct weight scores dynamically to bypass degraded API providers.
