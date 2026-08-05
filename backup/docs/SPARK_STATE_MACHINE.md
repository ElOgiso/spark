# SPARK State Machine Specification

This document maps all runtime states, tracking how mutations are restricted exclusively to the `ExecutivePolicyEngine` and `PipelineEngine`.

---

## 1. Runtime State Schema

The system tracks resources using these states:

### A. Workspace States
* `active` | `suspended` | `archived`
* *Rules*: Transition occurs via executive action only.

### B. Pipeline States
* `drafting` | `pending_review` | `approved` | `published` | `failed`
* *Rules*: Governed by `PipelineEngine.advancePipeline()`.

### C. Agent States
* `idle` | `executing` | `paused` | `degraded`
* *Rules*: Managed by `AgentRegistry` and `AgentDispatcher`.

### D. Task States
* `pending` | `running` | `completed` | `failed`
* *Rules*: Set by the `ExecutionAdapter`.

### E. Memory States
* `active` | `archived`
* *Rules*: Updates require manual confirmation or `autonomous` learning loops.

### F. Review States
* `pending` | `approved` | `needs_edit`
* *Rules*: Managed by `ReviewService`.

---

## 2. Transition Guardrail Rules

To ensure state consistency, all state changes must pass through standard filters:

```text
 Inbound Trigger
       │
       ▼
 [Policy Check] (ExecutivePolicyEngine verifies Automation Mode & Confidence)
       │
       ▼
[Sequence Path] (PipelineEngine resolves next target state)
       │
       ▼
[Database Sync] (Repository saves mutations to Supabase)
```
