# SPARK Agent Registry Architecture

This document defines the architecture of the SPARK Agent Registry. The registry serves as the authoritative, stateless catalog of all active AI agent nodes inside the SPARK Media Operating System, decoupling execution logic from client routing.

---

## 1. Registry Architecture Map

```text
                  Spark Orchestrator (Context)
                               │
                               ▼
                        Agent Registry <─── [Dynamic Registration]
                               │
                               ▼
                        Agent Dispatcher
                               │
                  ┌────────────┴────────────┐
                  ▼                         ▼
            Internal Agents           External Adapters
         (Research, Creative)       (MCP Tools, Plugins)
```

---

## 2. Structural Principles

1. **Decoupled Discovery**: The orchestrator (`SparkContext`) never references concrete agent classes (e.g. `ResearchAgent` or `CreativeAgent`). Instead, it describes task requirements and queries the registry dynamically.
2. **Stateless Operations**: The registry is a read-only registry at runtime, loaded during application boot, and queried statelessly.
3. **Pluggable Extensions**: Supports registering internal agents, Google/OpenAI cloud agents, or community plugins via standard JSON manifest configurations (MCP adapters).
4. **Health Guardrails**: Tracks agent status (healthy, degraded, unavailable) to dynamically fallback or skip steps before dispatching execution payloads.
