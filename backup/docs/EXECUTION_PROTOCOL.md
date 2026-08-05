# SPARK Agent Execution Protocol

This document defines the structured message contract used for communication and task handover between individual SPARK agents. It uses provider-agnostic schemas, ensuring it can translate across any underlying LLM provider.

---

## 1. Message Contract Interface

Every agent handover payload must adhere to the following TypeScript interface structure:

```typescript
export type AgentStatus = "pending" | "executing" | "completed" | "failed" | "paused";

export interface ExecutionMessage {
  taskId: string;                 // Unique transaction task identifier
  pipelineId: string;             // Associated production pipeline ID
  timestamp: string;              // ISO-8601 creation timestamp
  
  originAgent: string;            // Name of the dispatching agent (e.g. "ResearchAgent")
  destinationAgent: string;       // Target recipient agent (e.g. "CreativeAgent")
  
  status: AgentStatus;            // Execution status of this step
  
  context: {
    title: string;
    description: string;
    payload: any;                 // JSON object containing step data (scripts, hooks, etc.)
  };
  
  confidence: {
    score: number;                // Overall confidence score (0 to 100)
    brandFit: number;             // Matching score to brand content pillars
    qualityCheck: string;         // Pre-flight status code
  };
  
  evidence: {
    sources: string[];            // Links, search references, or video metrics
    reasoningText: string;        // Text explanation of the model's decision path
  };
  
  memoryReferences: {
    ruleIds: string[];            // List of strategic rule IDs from Brand Memory applied
    learnedFromTaskId?: string;   // Historical task source ID if applicable
  }[];
}
```

---

## 2. Handover Flow Protocol Example

```text
ResearchAgent (Discovers "AI Creators" Opportunity)
  │
  ├─► Generates ExecutionMessage (Status: "completed")
  │   ├─ Origin: "ResearchAgent"
  │   ├─ Destination: "CreativeAgent"
  │   └─ Context: { title: "AI in Nigeria", payload: { hook: "You are wasting your phone..." } }
  │
  ▼
CreativeAgent (Receives Message, Compiles Script)
  │
  ├─► Generates ExecutionMessage (Status: "completed")
  │   ├─ Origin: "CreativeAgent"
  │   ├─ Destination: "ProductionAgent"
  │   └─ Context: { scriptSnippet: "..." }
  │
  ▼
ProductionAgent (Creates Storyboard layout)
```
