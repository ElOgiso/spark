# SPARK Execution Flow Sequence

This document defines the complete lifecycle flow of a task execution inside the SPARK Media Operating System, demonstrating how data propagates from intent to telemetry logs.

---

## 1. Sequence Flow Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Context as SparkContext
    participant Analyzer as Capability Analyzer
    participant Policy as Policy Engine
    participant Router as Model Router
    participant Exec as Execution Adapter
    participant Prov as Provider Adapter
    participant LLM as LLM API
    participant History as Performance History

    Context->>Analyzer: 1. analyzeTask(taskType, payload)
    Analyzer-->>Context: return CapabilityRequirements
    
    Context->>Policy: 2. evaluatePipeline(taskType, mode)
    Policy-->>Context: return permissionToProceed: true
    
    Context->>Router: 3. resolveOptimalRoute(requirements)
    Router-->>Context: return TargetRoute (Model, Provider)
    
    Context->>Exec: 4. execute(AgentTask, TargetRoute)
    Note over Exec: Initiates timeout timers & retry loops
    
    Exec->>Prov: 5. translateRequest(AgentTask)
    Prov-->>Exec: return ProviderRequest
    
    Exec->>Prov: 6. executeCall(ProviderRequest)
    Prov->>LLM: 7. POST API Request
    LLM-->>Prov: return Raw Response
    
    Prov->>Exec: 8. normalizeResponse(Raw Response)
    Note over Exec: Computes token cost & response latency
    Exec-->>Context: return AgentResult (Standardized)
    
    Context->>History: 9. logExecution(AgentResult)
    History-->>Context: return confirmed
    
    Context->>Context: 10. Update state / notify UI
```
