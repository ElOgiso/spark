# SPARK Runtime Kernel Architecture

This document defines the architecture of the SPARK Runtime Kernel. The kernel serves as the execution environment that connects all control plane subsystems together, enabling safe execution flow under the orchestration of `SparkContext`.

---

## 1. Runtime Lifecycle & Flow Control

The Runtime Kernel manages the execution lifecycle of an `AgentTask` across three distinct phases:

### A. Pre-Execution (Planning & Routing)
1. **Intent Parser**: SparkContext receives user commands or automated timer triggers and requests a plan from the `Executive Decision Engine`.
2. **Task Construction**: The orchestrated plan generates a series of `AgentTask` objects.
3. **Capability Extraction**: Each task is evaluated by the `CapabilityAnalyzer` to produce a `CapabilityProfile`.
4. **Registry Lookup**: The `AgentRegistry` resolves compatible and healthy `AgentDefinition` candidates.
5. **Route Arbitration**: The `ModelRouter` scores model routes based on cost, latency, and history.

### B. Active Execution (Abstraction & Safe-Run)
1. **Payload Dispatch**: The `AgentDispatcher` instantiates the selected agent and issues the task.
2. **Adapter Translation**: The `ExecutionAdapter` wraps the task, translates the payload using the target `ProviderAdapter`, and manages AbortSignals and timeouts.
3. **API Execution**: The adapter posts requests to the provider API, captures the result, and normalizes the payload into the `AgentResult` format.

### C. Post-Execution (Governance & Analytics)
1. **Policy Gate**: The `ExecutivePolicyEngine` validates the `AgentResult` against active `AutomationMode` rules. If manual approval is required, execution pauses.
2. **Transition Mapping**: The `PipelineEngine` evaluates the completed step and determines the next destination in the workflow sequence.
3. **Telemetry Registry**: The result metadata is logged to `PerformanceHistory`.
4. **DB Sync**: Persists updates via repositories to Supabase.
5. **Insights Integration**: The Learning Service interprets analytics anomalies and updates active rules in the Brand Memory.

---

## 2. Telemetry and Learning Loop updates

* **Memory updates**: Strategic rules are stored as `MemoryItem` database rows. When a rule is added/archived, the change propagates via the context, forcing the `CapabilityAnalyzer` to apply updated formatting rules to subsequent creative tasks.
* **Analytics updates**: Execution snapshots record platform performance CTR and views, generating notifications for the user's home dashboard feed when anomalies are detected.
* **Failure & Retry Flows**:
  - Timeout and rate limits trigger exponential back-off delays.
  - Exceeding retry limits throws a `RETRY_EXHAUSTED` code, alerting the orchestrator to reroute task models or pause execution.
