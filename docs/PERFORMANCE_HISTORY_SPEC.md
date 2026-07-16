# Performance History Specification

This document defines how SPARK records performance history logs to optimize model routing weights dynamically over time.

---

## 1. Performance History Interface

```typescript
export interface PerformanceRecord {
  recordId: string;
  timestamp: string;
  
  // Handover Context
  taskType: string;               // e.g. "research", "creative"
  agentName: string;              // e.g. "ResearchAgent"
  
  // Route details
  provider: string;               // e.g. "gemini"
  model: string;                  // e.g. "gemini-1.5-flash"
  
  // Cost Metrics
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  
  // Performance Metrics
  latencyMs: number;
  agentConfidenceScore: number;   // 0 to 100
  
  // Feedback Metrics
  status: "success" | "failure";
  userCorrectionApplied: boolean;  // Did user edit script/concept in review?
  userFeedbackScore?: number;     // 1 to 5 stars if provided
}

export interface IPerformanceHistory {
  /**
   * Appends an execution log record to the persistent store.
   */
  logExecution(record: Omit<PerformanceRecord, "recordId" | "timestamp">): Promise<PerformanceRecord>;

  /**
   * Summarizes success rates and latencies for a model over a sliding time window.
   */
  getModelStats(modelId: string, daysLookback?: number): Promise<{
    averageLatencyMs: number;
    successRatePercentage: number;
    totalRuns: number;
  }>;
}
```

---

## 2. Dynamic Weight Tuning

The Model Router queries the Performance History to adjust its criteria weights dynamically:

```text
Model Score Deduction = BaseScore * ((100 - SuccessRate) / 100) * SeverityMultiplier
```

* **Retry/Failure Penalty**: Models experiencing consecutive `500 Server Error` or timeout failures are temporarily penalized (reducing route priority weights for 30 minutes).
* **Correction Penalty**: If the `userCorrectionApplied` flag is consistently `true` for a specific agent-model combination (meaning the model's generated scripts are frequently corrected by the user in the Review Center), the router automatically downgrades the model's quality weight for creative tasks, promoting high-reasoning models instead.
* **Latency Calibration**: Slow cold starts are tracked to dynamically offset target latency margins.
