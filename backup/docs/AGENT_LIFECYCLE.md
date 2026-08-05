# SPARK Agent Lifecycle Specification

This document defines the runtime lifecycle, failure recovery guidelines, and transition states for every active agent node in the SPARK Media Operating System.

---

## 1. Agent State Machine Lifecycle

An agent node transitions through these standard states:

```text
  [Registration] (Manifest loaded into Agent Registry)
        │
        ▼
   [Discovery] (Registry matches capabilities to a task request)
        │
        ▼
   [Assignment] (Dispatcher instantiates thread with AgentTask)
        │
        ▼
   [Execution] (Processes request via Provider Adapter)
        │
        ├─► [Suspension] (Timeout / Rate limits trigger back-off sleep)
        ├─► [Failure / Recovery] (Swaps route model or returns RETRY_EXHAUSTED)
        ▼
[Policy Validation] (Enforces manual review or autonomous gates)
        │
        ▼
[Pipeline Transition] (Pipeline Engine routes execution to next step)
        │
        ▼
   [Analytics] (Audits post-publish performance)
        │
        ▼
    [Learning] (Extracts format rules)
        │
        ▼
 [Memory Update] (Appends tags to guidelines database)
        │
        ▼
     [Sleep] (Thread returns resources to pool, idle)
        │
        ├─► [Reactivate] (New task matching capability profile arrives)
        ▼
  [Retirement] (Agent manifest unregistered from Registry)
```

---

## 2. Recovery & Fault Tolerance Policies

1. **Suspension**: If a rate limit (429) is encountered, the Execution Adapter suspends execution, registers a jitter delay buffer, and sleeps before retrying.
2. **Failure Routing**: If an agent experiences persistent failures (`RETRY_EXHAUSTED`), the dispatcher attempts route recovery by swapping the provider endpoint (e.g. failing Gemini calls route to OpenAI).
3. **Retirement**: Legacy agent versions are safely retired by unregistering their manifests from the Agent Registry during system boot sequences.
