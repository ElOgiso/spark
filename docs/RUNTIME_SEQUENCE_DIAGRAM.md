# SPARK Runtime Sequence Diagram

This document defines the complete sequence trace of task execution, demonstrating the interactions between all decoupled subsystems of the SPARK Operating System.

---

## 1. System Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    actor Executive as Executive (User UI)
    participant Context as SparkContext
    participant DecEngine as Executive Decision Engine
    participant Analyzer as Capability Analyzer
    participant Registry as Agent Registry
    participant Dispatcher as Agent Dispatcher
    participant Agent as Selected Agent
    participant Router as Model Router
    participant Adapter as Execution Adapter
    participant Provider as Provider Adapter
    participant Model as Model Provider
    participant Policy as Executive Policy Engine
    participant Pipeline as Pipeline Engine
    participant Repos as Repositories
    participant Analytics as Analytics Service
    participant Learning as Learning Service
    participant Memory as Brand Memory

    Executive->>Context: Input Intent / Trigger
    Context->>DecEngine: generatePlan(intent)
    DecEngine-->>Context: return DecisionPlan
    
    loop For Each Step in Plan
        Context->>Analyzer: analyzeTask(step)
        Analyzer-->>Context: return CapabilityRequirements
        
        Context->>Registry: findByCapability(requirements)
        Registry-->>Context: return AgentDefinition (Selected)
        
        Context->>Dispatcher: dispatch(AgentDefinition, Task)
        Dispatcher->>Agent: executeTask(Task)
        
        Agent->>Router: resolveOptimalRoute(Task)
        Router-->>Agent: return TargetRoute (Model, Provider)
        
        Agent->>Adapter: execute(Task, TargetRoute)
        Adapter->>Provider: translateRequest(Task)
        Provider-->>Adapter: return ProviderRequest
        
        Adapter->>Provider: executeCall(ProviderRequest)
        Provider->>Model: POST API Call
        Model-->>Provider: return Raw Response
        
        Provider->>Adapter: normalizeResponse(Raw Response)
        Adapter-->>Agent: return AgentResult (Standardized)
        Agent-->>Dispatcher: return AgentResult
        Dispatcher-->>Context: return AgentResult
        
        Context->>Policy: evaluatePipeline(AgentResult)
        
        alt Fails Policy Checks
            Policy-->>Context: status: "paused" (Wait for Review)
        else Passes Policy Checks
            Policy-->>Context: status: "completed" (Proceed)
            
            Context->>Pipeline: advancePipeline(step)
            Pipeline-->>Context: return nextStep
            
            Context->>Repos: saveUpdate(stepResult)
            Repos-->>Context: sync confirmed
            
            opt Step is Analytics
                Context->>Analytics: auditPerformance(stepResult)
                Analytics-->>Context: return Performance Insights
                Context->>Learning: evaluateInsights(Insights)
                Learning->>Memory: appendRule(New Rule)
            end
        end
    end
```
