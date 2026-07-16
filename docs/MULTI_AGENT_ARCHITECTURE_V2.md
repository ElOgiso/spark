# SPARK Multi-Agent Architecture (V2)

This document outlines the evolved multi-agent architecture of the SPARK Media Operating System (V2). It positions the Capability Analyzer, Model Router, and Policy Engine as shared utilities supporting all specialized agent departments.

---

## 1. Architectural Map

```text
                     Executive (User UI)
                              │
                              ▼
                  Spark Orchestrator (Context)
                              │
                              ▼
                       Agent Dispatcher
                              │
      ┌──────────┬──────────┬─┴────────┬──────────┐
      ▼          ▼          ▼          ▼          ▼
   Research   Creative  Production   Review    Analytics ... (Agents)
      │          │          │          │          │
      └──────────┴──────────┴─┬────────┴──────────┘
                              │
                              ▼
                     Capability Analyzer
                              │
                              ▼
                         Model Router
                              │
                              ▼
                        Policy Engine
                              │
                              ▼
                     Performance History
                              │
                              ▼
            Gemini • Claude • GPT • Future Models (Providers)
```

---

## 2. Layer Definitions & Execution Order

### Tier 1: Executive UI
* **Role**: The console for configuring settings, toggling automation modes, and verifying reviews.
* **Preservation**: Faithful to the original "Command Center" layout.

### Tier 2: Spark Orchestrator (`SparkContext.tsx`)
* **Role**: Central state and event registry coordinating database updates and UI alerts.

### Tier 3: Agent Dispatcher
* **Role**: Spawns and delegates tasks to individual agent nodes based on intent.

### Tier 4: Specialized Agent Nodes (Research, Creative, Production, etc.)
* **Role**: Focuses strictly on department-level logic (e.g., Creative handles script drafts; Research handles trends).
* **Dependencies**: Consults the Capability Analyzer.

### Tier 5: Capability Analyzer
* **Role**: Shared utility. Analyzes tasks to extract required specifications (e.g., token limits, search access, formatting) without knowing model details.

### Tier 6: Model Router
* **Role**: Resolves the optimal routing path (provider and model) matching capability constraints and preferences.

### Tier 7: Policy Engine
* **Role**: Verifies route compliance against active automation limits (Manual, Balanced, Autonomous).

### Tier 8: Performance History
* **Role**: Records execution durations, costs, and feedback to adjust future model weights.

### Tier 9: Provider Adapters
* **Role**: Connects calls to LLM SDKs.
